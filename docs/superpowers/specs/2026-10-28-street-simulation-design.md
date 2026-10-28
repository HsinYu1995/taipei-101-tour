# Street simulation - design

Status: agreed 2026-10-28, not started. Next step: implementation plan (superpowers:writing-plans).

## Why

The visitor, crowd and traffic block each other, but each advances in its own frame callback: the visitor from `CameraRig` via `StreetApi.step`, the crowd from `People`'s `useFrame`, traffic from `Scooters`'s `useFrame`. Each caps dt on its own, the order between them follows React mount order, and they are wired through closures and arrays copied every frame (`people` circles in `StreetScene`, `traffic.bodies`, `crowd.agents`). The crossing give-way bug (7daf4cd) lived in this wiring.

Side effects of the split:
- Once the street has loaded, crowd and traffic step every frame for the rest of the visit, even far from the street (`useFrame` runs regardless of `visible`). The visitor they avoid is frozen wherever the user last stood.
- Their interaction is only tested in e2e under SwiftShader at a few fps (e.g. "the visitor cannot walk through a person" ~27s). The street e2e tests pushed CI past its 20-minute limit.

## Design

One **street simulation** module (see `CONTEXT.md`).

- **Built from** the Xinyi data and the ground function. Collider construction (`buildColliders`), tree placement, the footway graph, road lanes, counts and seeds (90 people, 24 scooters, seed 101) move inside it, out of `StreetScene`.
- **`step(dt, input)`** advances visitor, then crowd, then traffic. `input` (held keys, thumbstick, look drag) is an argument, not the shared `input` global; no input means the visitor stands still. The 0.1 s dt cap moves inside. No other behaviour change.
- **Read side:** visitor position and eye pose; people (x, z, heading, moving, phase) and scooters (x, z, heading) for renderers and tests; `landing()`, `reset()`, `place()`, `blocked()` for the camera and tests.
- **Scheduling:** `StreetScene` steps it once per frame during descending, street and ascending; input is passed only in street mode. Paused in tour/explore/returning, resuming where it left off (not reset). Accepted consequence: from the tower stop the distant street stands still.
- **Callers:** `People` and `Scooters` become pure drawing. `CameraRig` only reads the eye pose (and the landing pose for the descent).
- **Inside:** `Crowd`, `Traffic`, `Walker`, `Colliders` stay as internal parts with their existing unit tests.

## Tests (owner's choice: option B)

Keep e2e slim: only critical workflows that only e2e can verify.

- New street simulation tests on the real Xinyi data, all actors present: visitor slides round a standing person; walls, walk area edge and tree trunks block the visitor; the crowd moves and yields to the visitor; scooters stop for people on crossings; pausing and resuming.
- Street e2e tests that only checked these behaviours shrink to wiring checks: keys move the visitor, people and scooters are drawn and moving, leaving works.

## Left to the builder

Exact type names and file layout; how the `input` global and `StreetHud` hand input to `step`; which existing e2e tests are deleted vs rewritten (list them in the plan).
