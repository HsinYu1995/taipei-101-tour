import { CHAPTERS, INTRO_POSE, STOP_WEIGHT, TRAVEL_WEIGHT } from './chapters';
import type { Pose, Segment, Vec3 } from './types';

const CHAPTER_WEIGHT = TRAVEL_WEIGHT + STOP_WEIGHT;
const TOTAL_WEIGHT = CHAPTERS.length * CHAPTER_WEIGHT;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return { position: lerpVec(a.position, b.position, t), target: lerpVec(a.target, b.target, t) };
}

/**
 * Interpolates around the target instead of through it: the target moves linearly while the camera's
 * offset moves in spherical coordinates (radius, polar, shortest-way azimuth).
 */
export function orbitLerpPose(a: Pose, b: Pose, t: number): Pose {
  const target = lerpVec(a.target, b.target, t);
  const sa = toSpherical(a);
  const sb = toSpherical(b);
  let dTheta = sb.theta - sa.theta;
  dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
  const radius = sa.radius + (sb.radius - sa.radius) * t;
  const phi = sa.phi + (sb.phi - sa.phi) * t;
  const theta = sa.theta + dTheta * t;
  if (t === 1) return b;
  return {
    position: [
      target[0] + radius * Math.sin(phi) * Math.sin(theta),
      target[1] + radius * Math.cos(phi),
      target[2] + radius * Math.sin(phi) * Math.cos(theta),
    ],
    target,
  };
}

/** Same convention as camera-controls: theta is azimuth around +y measured from +z, phi is polar from +y. */
function toSpherical({ position, target }: Pose) {
  const x = position[0] - target[0];
  const y = position[1] - target[1];
  const z = position[2] - target[2];
  const radius = Math.hypot(x, y, z);
  return { radius, theta: Math.atan2(x, z), phi: radius === 0 ? 0 : Math.acos(Math.min(Math.max(y / radius, -1), 1)) };
}

export function segmentAt(progress: number): Segment {
  const w = Math.min(Math.max(progress, 0), 1) * TOTAL_WEIGHT;
  const chapterIndex = Math.min(Math.floor(w / CHAPTER_WEIGHT), CHAPTERS.length - 1);
  const local = w - chapterIndex * CHAPTER_WEIGHT;
  if (local < TRAVEL_WEIGHT) return { kind: 'travel', chapterIndex, t: local / TRAVEL_WEIGHT };
  return { kind: 'stop', chapterIndex, t: Math.min((local - TRAVEL_WEIGHT) / STOP_WEIGHT, 1) };
}

export function poseAt(progress: number): Pose {
  const s = segmentAt(progress);
  const stop = CHAPTERS[s.chapterIndex].stop;
  if (s.kind === 'stop') return stop;
  const from = s.chapterIndex === 0 ? INTRO_POSE : CHAPTERS[s.chapterIndex - 1].stop;
  return lerpPose(from, stop, easeInOutCubic(s.t));
}
