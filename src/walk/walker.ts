import type { Pose } from '../tour/types';
import { EYE_HEIGHT, eyePose, type Spot } from './api';
import type { Circle, Colliders } from './collide';
import type { WalkInput } from './input';

/** Metres per second, walking and hurrying (Shift). Brisker than real life so the street doesn't drag. */
export const WALK_SPEED = 4;
export const HURRY_SPEED = 8;
/** Radians of turn per pixel dragged. */
export const LOOK_RAD_PER_PX = 0.004;
const PITCH = { min: -0.6, max: 1.2 };

/** The visitor on foot: where they stand, where they look, and how input moves them. */
export class Walker {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  private readonly colliders: Colliders;
  private readonly ground: (x: number, z: number) => number;
  private readonly home: Spot;

  /** `home` is where the visitor lands and where `reset` puts them back. */
  constructor(colliders: Colliders, ground: (x: number, z: number) => number, home: Spot) {
    this.colliders = colliders;
    this.ground = ground;
    this.home = home;
    ({ x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch } = home);
  }

  reset() {
    ({ x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch } = this.home);
  }

  pose(): Pose {
    return eyePose(this.x, this.ground(this.x, this.z) + EYE_HEIGHT, this.z, this.yaw, this.pitch);
  }

  /**
   * Advances by dt seconds of `input` (none: stand still); `others` are people to walk around. Reads `input`
   * without changing it. Returns the eye pose.
   */
  step(dt: number, input: WalkInput | undefined, others: readonly Circle[] = []): Pose {
    if (!input) return this.pose();
    const held = (...keys: string[]) => (keys.some((k) => input.keys.has(k)) ? 1 : 0);
    // Dragging right turns right (yaw decreases); dragging up looks up.
    this.yaw -= input.look.dx * LOOK_RAD_PER_PX;
    this.pitch = Math.min(Math.max(this.pitch - input.look.dy * LOOK_RAD_PER_PX, PITCH.min), PITCH.max);

    let forward = held('w', 'arrowup') - held('s', 'arrowdown') - input.stick.y;
    let right = held('d', 'arrowright') - held('a', 'arrowleft') + input.stick.x;
    const amount = Math.hypot(forward, right);
    if (amount > 1) {
      forward /= amount;
      right /= amount;
    }
    if (amount > 0) {
      const step = (input.keys.has('shift') ? HURRY_SPEED : WALK_SPEED) * dt;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Forward is (-sin, -cos); right is forward turned clockwise seen from above: (cos, -sin).
      const to: [number, number] = [this.x + (-sin * forward + cos * right) * step, this.z + (-cos * forward - sin * right) * step];
      [this.x, this.z] = this.colliders.move([this.x, this.z], to, others);
    }
    return this.pose();
  }

  /** Puts the visitor somewhere (test hook and debugging), keeping them out of walls. */
  place(x: number, z: number, yaw = this.yaw, pitch = this.pitch) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.pitch = pitch;
  }
}
