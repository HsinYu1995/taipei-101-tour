/** What the visitor asks for in one step. */
export interface WalkInput {
  keys: ReadonlySet<string>;
  stick: { x: number; y: number };
  look: { dx: number; dy: number };
}

/** What the visitor is asking for right now; written by StreetHud, handed to the street simulation each frame. */
export const input = {
  /** Held keys, lower-cased `KeyboardEvent.key` values ('w', 'arrowup', 'shift', ...). */
  keys: new Set<string>(),
  /** Thumbstick deflection, -1..1 each way; y is down the screen, so pushing up is negative. */
  stick: { x: 0, y: 0 },
  /** Look drag accumulated since the last step, in CSS pixels. */
  look: { dx: 0, dy: 0 },
  /** Set on the first movement after landing; hides the hint. */
  moved: false,
};

export function clearInput() {
  input.keys.clear();
  input.stick.x = input.stick.y = 0;
  input.look.dx = input.look.dy = 0;
}

/** This frame's input for the street simulation: what is held, and the look drag since the last call (then cleared). */
export function takeInput(): WalkInput {
  const look = { dx: input.look.dx, dy: input.look.dy };
  input.look.dx = input.look.dy = 0;
  return { keys: new Set(input.keys), stick: { ...input.stick }, look };
}
