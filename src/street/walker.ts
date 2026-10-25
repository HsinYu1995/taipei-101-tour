import type { Pose } from '../tour/types';
import { EYE_HEIGHT, LANDING, eyePose } from './api';
import type { Circle, Colliders } from './collide';
import { clearInput, input } from './input';

/** Metres per second; Shift doubles it. */
export const WALK_SPEED = 1.4;
/** Radians of turn per pixel dragged. */
export const LOOK_RAD_PER_PX = 0.004;
const PITCH = { min: -0.6, max: 1.2 };

const held = (...keys: string[]) => (keys.some((k) => input.keys.has(k)) ? 1 : 0);

/** The visitor on foot: where they stand, where they look, and how input moves them. */
export class Walker {
  x = LANDING.x;
  z = LANDING.z;
  yaw = LANDING.yaw;
  pitch = LANDING.pitch;
  private readonly colliders: Colliders;
  private readonly ground: (x: number, z: number) => number;

  constructor(colliders: Colliders, ground: (x: number, z: number) => number) {
    this.colliders = colliders;
    this.ground = ground;
  }

  reset() {
    this.x = LANDING.x;
    this.z = LANDING.z;
    this.yaw = LANDING.yaw;
    this.pitch = LANDING.pitch;
    clearInput();
  }

  pose(): Pose {
    return eyePose(this.x, this.ground(this.x, this.z) + EYE_HEIGHT, this.z, this.yaw, this.pitch);
  }

  /** Advances by dt seconds of input; `others` are people to walk around. Returns the eye pose. */
  step(dt: number, others: readonly Circle[] = []): Pose {
    // Dragging right turns right (yaw decreases); dragging up looks up.
    this.yaw -= input.look.dx * LOOK_RAD_PER_PX;
    this.pitch = Math.min(Math.max(this.pitch - input.look.dy * LOOK_RAD_PER_PX, PITCH.min), PITCH.max);
    input.look.dx = input.look.dy = 0;

    let forward = held('w', 'arrowup') - held('s', 'arrowdown') - input.stick.y;
    let right = held('d', 'arrowright') - held('a', 'arrowleft') + input.stick.x;
    const amount = Math.hypot(forward, right);
    if (amount > 1) {
      forward /= amount;
      right /= amount;
    }
    if (amount > 0) {
      const step = WALK_SPEED * (input.keys.has('shift') ? 2 : 1) * dt;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Forward is (-sin, -cos); right is forward turned clockwise seen from above: (cos, -sin).
      const to: [number, number] = [this.x + (-sin * forward + cos * right) * step, this.z + (-cos * forward - sin * right) * step];
      [this.x, this.z] = this.colliders.move([this.x, this.z], to, others);
    }
    return this.pose();
  }

  /** Puts the visitor somewhere (test hook and debugging), keeping them out of walls. */
  place(x: number, z: number, yaw = this.yaw) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
  }
}
