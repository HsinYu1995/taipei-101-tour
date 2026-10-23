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
