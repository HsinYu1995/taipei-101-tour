import { PODIUM } from '../scene/tower/podium';
import { TOWER_BASE } from '../scene/tower/towerBase';
import type { Pose } from '../tour/types';
import type { Phase } from '../walk/api';
import { Colliders, type Circle } from '../walk/collide';
import type { WalkInput } from '../walk/input';
import { Walker } from '../walk/walker';
import { ENTRANCE, LANDING, OUTSIDE_ENTRANCE } from './api';
import { SCENE_AREA, WALK_AREA } from './areas';
import { buildGraph, Crowd, type Agent } from './crowd';
import { buildLanes, Traffic, type Scooter } from './traffic';
import { placeTrees } from './trees';
import type { P, XinyiData } from './types';

/** The visitor's body radius. */
const RADIUS = 0.3;
/** People in the crowd, and the seed that places them. */
const CROWD = { count: 90, seed: 101, radius: 0.3 };
/** Scooters on the car roads, and the seed that places them. */
const TRAFFIC = { count: 24, seed: 101 };
/** Tree trunks block like posts. */
const TRUNK_RADIUS = 0.35;
/** Footprints this far outside the walk area can still be reached at its edge. */
const REACH = 10;
/** Longest step taken, so a stalled frame never teleports anyone. */
const MAX_STEP = 0.1;

/** What the visitor cannot walk through: real buildings, the 101 podium, the tower base and tree trunks. */
function buildColliders(data: XinyiData, trees: P[]) {
  const near = (ring: P[]) =>
    ring.some(([x, z]) => x > WALK_AREA.x0 - REACH && x < WALK_AREA.x1 + REACH && z > WALK_AREA.z0 - REACH && z < WALK_AREA.z1 + REACH);
  const footprints = data.buildings.filter((b) => !b.roof && b.base < 2 && near(b.outer)).map((b) => b.outer);
  const trunks = trees.map(([x, z]) => ({ x, z, r: TRUNK_RADIUS }));
  return new Colliders([...footprints, PODIUM.outline, TOWER_BASE], WALK_AREA, RADIUS, trunks);
}

/**
 * Everything that moves on the street (visitor, crowd, traffic) and what blocks it, advanced together by one
 * step in a fixed order: visitor, then crowd, then traffic.
 */
export class StreetSimulation {
  /** Street trees, OSM's own and the park fill; their trunks block the visitor. */
  readonly trees: readonly P[];
  /** Everyone in the crowd, the same objects every step. */
  readonly people: readonly Agent[];
  /** Every scooter, the same objects every step. */
  readonly scooters: readonly Scooter[];
  private readonly colliders: Colliders;
  private readonly ground: (x: number, z: number) => number;
  private readonly walker: Walker;
  private readonly crowd: Crowd;
  private readonly traffic: Traffic;
  /** Each person as a circle the visitor slides round; reused every step. */
  private readonly circles: Circle[];

  constructor(data: XinyiData, ground: (x: number, z: number) => number) {
    const trees = placeTrees(data);
    this.trees = trees;
    this.ground = ground;
    this.colliders = buildColliders(data, trees);
    this.walker = new Walker(this.colliders, ground, LANDING);
    // People walk the footways and the zebra crossings that join them across roads.
    this.crowd = new Crowd(buildGraph(data.footways, WALK_AREA, data.crossings), CROWD.count, CROWD.seed);
    // Scooters ride every car road in the scene area, including the stretches beyond the walkable part.
    this.traffic = new Traffic(buildLanes(data.roads, SCENE_AREA), TRAFFIC.count, TRAFFIC.seed);
    this.people = this.crowd.agents;
    this.scooters = this.traffic.scooters;
    this.circles = this.crowd.agents.map(() => ({ x: 0, z: 0, r: CROWD.radius }));
  }

  visitor() {
    const { x, z, yaw, pitch } = this.walker;
    return { x, z, yaw, pitch };
  }

  /** The visitor's eye pose. */
  eye(): Pose {
    return this.walker.pose();
  }

  /** Eye pose at the landing spot, on the ground. */
  landing(): Pose {
    return new Walker(this.colliders, this.ground, LANDING).pose();
  }

  /** Puts the visitor back at the landing spot. */
  reset() {
    this.walker.reset();
  }

  /** Puts the visitor outside the south entrance, facing out: where leaving the mall lands. */
  arrive() {
    const { x, z, yaw, pitch } = OUTSIDE_ENTRANCE;
    this.walker.place(x, z, yaw, pitch);
  }

  /** Whether the visitor has walked into 101's south entrance. */
  atEntrance() {
    const { x, z } = this.walker;
    return x >= ENTRANCE.x0 && x <= ENTRANCE.x1 && z >= ENTRANCE.z0 && z <= ENTRANCE.z1;
  }

  /** Puts the visitor somewhere (test hook and debugging). */
  place(x: number, z: number, yaw?: number, pitch?: number) {
    this.walker.place(x, z, yaw, pitch);
  }

  /** Whether the visitor could not stand at (x, z). */
  blocked(x: number, z: number) {
    return this.colliders.blocked([x, z]);
  }

  /** Advances everyone by dt seconds (at most 0.1); without `input` the visitor stands still. */
  step(dt: number, input?: WalkInput) {
    dt = Math.min(dt, MAX_STEP);
    this.crowd.agents.forEach((a, i) => {
      this.circles[i].x = a.x;
      this.circles[i].z = a.z;
    });
    this.walker.step(dt, input, this.circles);
    const visitor: P = [this.walker.x, this.walker.z];
    this.crowd.step(dt, visitor, this.traffic.bodies);
    this.traffic.step(dt, visitor, this.crowd.agents);
  }

  /** One frame in `phase`: paused, nothing moves; still, everyone but the visitor; walking, the visitor too. */
  tick(phase: Phase, dt: number, input?: WalkInput) {
    if (phase !== 'paused') this.step(dt, phase === 'walking' ? input : undefined);
  }
}
