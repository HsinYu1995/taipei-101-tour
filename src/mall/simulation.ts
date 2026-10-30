import { buildGraph, Crowd, type Agent } from '../street/crowd';
import type { P } from '../street/types';
import type { Pose } from '../tour/types';
import { EYE_HEIGHT, eyePose, type Phase, type Spot } from '../walk/api';
import type { Circle, Colliders } from '../walk/collide';
import type { WalkInput } from '../walk/input';
import { Walker } from '../walk/walker';
import { CHARACTER, FLOOR_Y } from './floors';
import { buildFloor, floorColliders, MALL_BOUNDS, MALL_ENTRY, type FloorPlan } from './layout';
import { FLOOR_IDS, type FloorId, type MallTenants } from './types';

/** Seconds a floor button's change takes: fade to black, switch floor, fade up at that floor's lobby. */
export const CHANGE_S = 1;
/** Summed frame steps fall just short of round numbers (30 frames of 1/30 s make 0.9999999999999999). */
const EPS = 1e-9;
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

/**
 * A floor button's change to `to`'s lobby: the black overlay's opacity `fade`, rising until black, where the
 * visitor switches floor, then falling.
 */
interface Change {
  to: FloorId;
  fade: number;
  rising: boolean;
}

/**
 * The mall's floors B1 to 5F, each with its own visitor walk and crowd, and the floor panel's change between them.
 * Every floor's crowd steps every frame; the visitor walks only the current floor, and changes floor only at a
 * change's midpoint, in black. The camera never travels between floors.
 */
export class MallSimulation {
  readonly plans: Record<FloorId, FloorPlan>;
  private readonly base: number;
  private readonly floors: Record<FloorId, FloorWalk>;
  private current: FloorId = '1F';
  private change: Change | null = null;

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

  /** The floor the visitor stands on; during a change, the one they left until the midpoint. */
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

  /** The visitor's eye pose, always where they stand on the current floor. */
  eye(): Pose {
    return this.floors[this.current].walker.pose();
  }

  /** Eye pose where the street's door fades in: MALL_ENTRY on 1F. */
  landing(): Pose {
    return this.eyeAt(MALL_ENTRY, '1F');
  }

  /** Puts the visitor back at MALL_ENTRY on 1F, ending any change. */
  reset() {
    this.change = null;
    this.current = '1F';
    this.floors['1F'].walker.reset();
  }

  /** Puts the visitor somewhere on the current floor, ending any change (test hook and debugging). */
  place(x: number, z: number, yaw?: number, pitch?: number) {
    this.change = null;
    this.floors[this.current].walker.place(x, z, yaw, pitch);
  }

  /** Whether the visitor could not stand at (x, z) on the current floor. */
  blocked(x: number, z: number) {
    return this.floors[this.current].colliders.blocked([x, z]);
  }

  /**
   * Changes to `floor`'s lobby over CHANGE_S. The fade rises from where it is, so a press mid-change never flashes
   * clear: before black it only retargets, after it the view darkens again. The floor the visitor is already
   * standing on, with no change under way, is no change at all.
   */
  goTo(floor: FloorId) {
    if (!this.change && floor === this.current) return;
    this.change = { to: floor, fade: this.fade(), rising: true };
  }

  changing() {
    return this.change !== null;
  }

  /** The black overlay's opacity: 0 to 1 over a change's first half, 1 to 0 over its second. */
  fade(): number {
    return this.change?.fade ?? 0;
  }

  /** Advances everyone by dt seconds (at most 0.1); without `input`, or mid-change, the visitor stands still. */
  step(dt: number, input?: WalkInput) {
    dt = Math.min(dt, MAX_STEP);
    const change = this.change;
    if (change) {
      const by = dt / (CHANGE_S / 2);
      if (change.rising) {
        change.fade += by;
        if (change.fade >= 1 - EPS) {
          // Black: switch floor, and spend the rest of this frame fading up.
          change.rising = false;
          change.fade = Math.min(1, 2 - change.fade);
          this.land(change.to);
        }
      } else {
        change.fade -= by;
        if (change.fade <= EPS) this.change = null;
      }
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
      crowd.step(dt, f === this.current ? [walker.x, walker.z] : AWAY);
    }
  }

  /** One frame in `phase`: paused, nothing moves; still, everyone but the visitor; walking, the visitor too. */
  tick(phase: Phase, dt: number, input?: WalkInput) {
    if (phase !== 'paused') this.step(dt, phase === 'walking' ? input : undefined);
  }

  private land(floor: FloorId) {
    const { x, z, yaw, pitch } = this.plans[floor].lobby;
    this.current = floor;
    this.floors[floor].walker.place(x, z, yaw, pitch);
  }

  private eyeAt({ x, z, yaw, pitch }: Spot, floor: FloorId): Pose {
    return eyePose(x, this.base + FLOOR_Y[floor] + EYE_HEIGHT, z, yaw, pitch);
  }
}
