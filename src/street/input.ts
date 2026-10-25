/** What the visitor is asking for right now; written by StreetHud, read (and look deltas consumed) by the Walker. */
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
