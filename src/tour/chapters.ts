import type { Chapter, Pose } from './types';

// World units are metres. Taipei 101 stands at the origin.
// Poses are first drafts; tune them with the ?debug P-key capture tool.

export const TRAVEL_WEIGHT = 1.0;
export const STOP_WEIGHT = 1.2;

export const INTRO_POSE: Pose = { position: [0, 6000, 9000], target: [0, 0, 0] };

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'basin',
    stop: { position: [2500, 1800, 4500], target: [0, 200, 0] },
    explore: { minDistance: 3000, maxDistance: 9000, azimuthRange: 0.8, minPolar: 0.6, maxPolar: 1.3 },
    hotspot: { id: 'basin-101', position: [0, 470, 0] },
  },
  {
    id: 'tower',
    // South-west of the tower so the golden afternoon sun (west-south-west) lights the faces in view.
    stop: { position: [-200, 290, 230], target: [0, 280, 0] },
    explore: { minDistance: 150, maxDistance: 600, azimuthRange: 1.2, minPolar: 0.9, maxPolar: 1.9 },
    // On the face of segment 6, a metre proud of the glass (see towerProfile.ts).
    hotspot: { id: 'tower-segments', position: [0, 307.8, 25.75] },
  },
  {
    id: 'damper',
    stop: { position: [0, 386, 9], target: [0, 380, 0] },
    explore: { minDistance: 6, maxDistance: 10, azimuthRange: 3.14, minPolar: 0.8, maxPolar: 2.2 },
    hotspot: { id: 'damper-sphere', position: [0, 380, 3] },
  },
  {
    id: 'view',
    stop: { position: [0, 383, 24], target: [0, 383, 25] },
    explore: { minDistance: 1, maxDistance: 1, azimuthRange: 1.57, minPolar: 1.0, maxPolar: 2.1 },
    hotspot: { id: 'view-city', position: [0, 300, 400] },
  },
];
