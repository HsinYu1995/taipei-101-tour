import { buildGraph, Crowd, type Agent } from '../street/crowd';
import type { P } from '../street/types';
import { easeInOutCubic, lerpPose } from '../tour/path';
import type { Pose } from '../tour/types';
import { EYE_HEIGHT, eyePose, type Phase, type Spot } from '../walk/api';
import type { Circle, Colliders } from '../walk/collide';
import type { WalkInput } from '../walk/input';
import { Walker } from '../walk/walker';
import { CHARACTER, FLOOR_Y } from './floors';
import { buildFloor, floorColliders, MALL_BOUNDS, MALL_ENTRY, type FloorPlan } from './layout';
import { FLOOR_IDS, type FloorId, type MallTenants } from './types';

/** Seconds a floor button's glide to that floor's lobby takes. */
export const GLIDE_S = 1;
/** The visitor's body radius, as on the street. */
const RADIUS = 0.3;
/** The seed that places each floor's crowd, and a shopper's radius. */
const CROWD = { seed: 101, radius: 0.3 };
/** Longest step taken, so a stalled frame never teleports anyone. */
const MAX_STEP = 0.1;
/** Where the crowds of the floors the visitor is not on think the visitor is. */
const AWAY: P = [1e6, 1e6];

/** One floor's walk: its visitor, what blocks them, and its shoppers. */
interface FloorWalk {
  colliders: Colliders;
  walker: Walker;
  crowd: Crowd;
  /** Seated and queuing people, posts in the floor's colliders. */
  seated: readonly Spot[];
  /** Each shopper as a circle the visitor slides round; reused every step. */
  circles: Circle[];
}

/** A floor button's glide: from the eye pose when it was pressed to `to`'s lobby. */
interface Glide {
  from: Pose;
  to: FloorId;
  t: number;
}

/**
 * The mall's floors B1 to 5F, each with its own visitor walk and crowd, and the floor panel's glide between them.
 * Every floor's crowd steps every frame; the visitor walks only the current floor, and changes floor only by a glide.
 */
export class MallSimulation {
  readonly plans: Record<FloorId, FloorPlan>;
  private readonly base: number;
  private readonly floors: Record<FloorId, FloorWalk>;
  private current: FloorId = '1F';
  private glide: Glide | null = null;

  /** `base` is the world y of the 1F floor. */
  constructor(tenants: MallTenants, base: number) {
    this.base = base;
    const plans = {} as Record<FloorId, FloorPlan>;
    const floors = {} as Record<FloorId, FloorWalk>;
    for (const f of FLOOR_IDS) {
      const plan = buildFloor(f, tenants.floors[f]);
      const crowd = new Crowd(buildGraph(plan.walkways, MALL_BOUNDS), CHARACTER[f].crowd, CROWD.seed);
      const colliders = floorColliders(plan, RADIUS);
      const ground = () => base + FLOOR_Y[f];
      plans[f] = plan;
      floors[f] = {
        colliders,
        // 1F is where the street's door fades in; every other floor is reached at its lobby.
        walker: new Walker(colliders, ground, f === '1F' ? MALL_ENTRY : plan.lobby),
        crowd,
        seated: [...plan.seats, ...plan.queue],
        circles: crowd.agents.map(() => ({ x: 0, z: 0, r: CROWD.radius })),
      };
    }
    this.plans = plans;
    this.floors = floors;
  }

  /** The floor the visitor stands on; during a glide, the one they left. */
  floor(): FloorId {
    return this.current;
  }

  /** Walkers and standers on `floor`, the same objects every step. */
  people(floor: FloorId): readonly Agent[] {
    return this.floors[floor].crowd.agents;
  }

  /** Seated people and the ticket queue on `floor`: they never move. */
  seated(floor: FloorId): readonly Spot[] {
    return this.floors[floor].seated;
  }

  visitor() {
    const { x, z, yaw, pitch } = this.floors[this.current].walker;
    return { x, z, yaw, pitch };
  }

  /** The visitor's eye pose; mid-glide, the glide's. */
  eye(): Pose {
    if (!this.glide) return this.floors[this.current].walker.pose();
    const { from, to, t } = this.glide;
    return lerpPose(from, this.eyeAt(this.plans[to].lobby, to), easeInOutCubic(t / GLIDE_S));
  }

  /** Eye pose where the street's door fades in: MALL_ENTRY on 1F. */
  landing(): Pose {
    return this.eyeAt(MALL_ENTRY, '1F');
  }

  /** Puts the visitor back at MALL_ENTRY on 1F, ending any glide. */
  reset() {
    this.glide = null;
    this.current = '1F';
    this.floors['1F'].walker.reset();
  }

  /** Puts the visitor somewhere on the current floor (test hook and debugging). */
  place(x: number, z: number, yaw?: number, pitch?: number) {
    this.floors[this.current].walker.place(x, z, yaw, pitch);
  }

  /** Whether the visitor could not stand at (x, z) on the current floor. */
  blocked(x: number, z: number) {
    return this.floors[this.current].colliders.blocked([x, z]);
  }

  /** Glides to `floor`'s lobby over GLIDE_S, from wherever the eye is now (mid-glide too, so it never jumps). */
  goTo(floor: FloorId) {
    this.glide = { from: this.eye(), to: floor, t: 0 };
  }

  gliding() {
    return this.glide !== null;
  }

  /** Advances everyone by dt seconds (at most 0.1); without `input`, or mid-glide, the visitor stands still. */
  step(dt: number, input?: WalkInput) {
    dt = Math.min(dt, MAX_STEP);
    if (this.glide) {
      this.glide.t += dt;
      if (this.glide.t >= GLIDE_S) this.land(this.glide.to);
    } else {
      const here = this.floors[this.current];
      here.crowd.agents.forEach((a, i) => {
        here.circles[i].x = a.x;
        here.circles[i].z = a.z;
      });
      here.walker.step(dt, input, here.circles);
    }
    for (const f of FLOOR_IDS) {
      const { crowd, walker } = this.floors[f];
      crowd.step(dt, f === this.current && !this.glide ? [walker.x, walker.z] : AWAY);
    }
  }

  /** One frame in `phase`: paused, nothing moves; still, everyone but the visitor; walking, the visitor too. */
  tick(phase: Phase, dt: number, input?: WalkInput) {
    if (phase !== 'paused') this.step(dt, phase === 'walking' ? input : undefined);
  }

  private land(floor: FloorId) {
    const { x, z, yaw, pitch } = this.plans[floor].lobby;
    this.glide = null;
    this.current = floor;
    this.floors[floor].walker.place(x, z, yaw, pitch);
  }

  private eyeAt({ x, z, yaw, pitch }: Spot, floor: FloorId): Pose {
    return eyePose(x, this.base + FLOOR_Y[floor] + EYE_HEIGHT, z, yaw, pitch);
  }
}
