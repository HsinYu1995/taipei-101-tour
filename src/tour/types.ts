export type Vec3 = readonly [number, number, number];

export type ChapterId = 'basin' | 'tower' | 'damper' | 'view';

export interface Pose {
  position: Vec3;
  target: Vec3;
}

export interface ExploreBounds {
  minDistance: number;
  maxDistance: number;
  /** Radians, plus or minus around the stop's azimuth. */
  azimuthRange: number;
  minPolar: number;
  maxPolar: number;
}

export interface Chapter {
  id: ChapterId;
  stop: Pose;
  explore: ExploreBounds;
  hotspot: { id: string; position: Vec3 };
}

export interface Segment {
  kind: 'travel' | 'stop';
  chapterIndex: number;
  /** 0..1 within the segment. */
  t: number;
}
