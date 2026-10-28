# Street Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advance the visitor, crowd and traffic in one street simulation module with one step in a fixed order, so renderers only draw and the street's behaviour is tested in fast module tests instead of slow e2e.

**Architecture:** A plain TypeScript class `StreetSimulation` (`src/street/simulation.ts`) is built from the Xinyi data and the ground function, owns `Walker`, `Crowd`, `Traffic` and `Colliders`, and exposes `step` / `tick` plus a read side. `StreetScene` builds it, ticks it once per frame before the camera, and hands `People`, `Scooters`, `CameraRig` and the test probe read-only views. Input reaches the simulation as an argument, never through the `input` global.

**Tech Stack:** TypeScript, React 19, @react-three/fiber 9, three 0.186, zustand, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-street-simulation-design.md` (terms in `CONTEXT.md`)

## Global Constraints

- Step order inside the simulation: visitor, then crowd, then traffic.
- dt is capped at 0.1 s inside the simulation; callers pass the raw frame delta.
- Counts and seeds unchanged: 90 people (seed 101, radius 0.3), 24 scooters (seed 101), visitor radius 0.3, trunk radius 0.35, footprint reach 10 m.
- No input means the visitor stands still.
- Stepped during `descending`, `street`, `ascending`; input only in `street`. Paused (not reset) in `tour`, `explore`, `returning`.
- No other behaviour change: walking speeds, collisions, yielding and drawing look and feel as before.
- Domain words from `CONTEXT.md`: visitor, crowd, traffic, street simulation. Not "player".
- E2E stays slim: only wiring that only a browser can show (see memory note: e2e only for critical workflows testable nowhere else).
- No em dashes in docs, comments or commit messages. No `Co-Authored-By` or other AI attribution in commits.

## Review Focus

1. **A long frame (tab switched away and back)** - the visitor must move at most one capped step (0.1 s of walking), not teleport. Test in Task 1.
2. **Look drag between frames** - a drag that arrives while no frame runs must turn the view once, not zero times and not twice. Test of `takeInput` in Task 2.
3. **Leaving with a key held, then coming back** - the visitor lands at the landing spot and stands still. Kept e2e `a key held while leaving does not keep walking on the next visit` (Task 3).
4. **Leaving and re-entering mid-visit** - the crowd and traffic resume where they were, not from their spawn spots. Test in Task 1.
5. **Camera one frame behind the visitor** - the simulation must be stepped before `CameraRig` reads the eye pose in the same frame; otherwise the camera trails by a frame. Kept e2e `W walks forward; the camera keeps eye height` (Task 3) plus the priority note in Task 2.

---

### Task 1: The street simulation module

**Files:**
- Create: `src/street/simulation.ts`
- Modify: `src/street/input.ts` (add `WalkInput` type only)
- Modify: `src/street/walker.ts` (input becomes an argument)
- Modify: `tests/unit/walker.test.ts` (pass input objects)
- Test: `tests/unit/streetSimulation.test.ts`

**Interfaces:**
- Produces, in `src/street/input.ts`:
  ```ts
  /** What the visitor asks for in one step. */
  export interface WalkInput {
    keys: ReadonlySet<string>;
    stick: { x: number; y: number };
    look: { dx: number; dy: number };
  }
  ```
  The existing `input` global keeps its shape and is assignable to `WalkInput`.
- Produces, in `src/street/walker.ts`: `step(dt: number, input: WalkInput | undefined, others?: readonly Circle[]): Pose`. It reads `input` but never mutates it (no zeroing of look). `reset()` no longer calls `clearInput()`. The walker no longer imports the `input` global.
- Produces, in `src/street/simulation.ts`:
  ```ts
  export class StreetSimulation {
    constructor(data: XinyiData, ground: (x: number, z: number) => number);
    readonly trees: readonly P[];             // placeTrees(data), for Props
    readonly people: readonly Agent[];        // crowd.agents, same objects every frame
    readonly scooters: readonly Scooter[];    // traffic.scooters, same objects every frame
    visitor(): { x: number; z: number; yaw: number; pitch: number };
    eye(): Pose;                              // walker.pose()
    landing(): Pose;                          // eye pose at LANDING, on the ground
    reset(): void;                            // visitor back to LANDING
    place(x: number, z: number, yaw?: number, pitch?: number): void;
    blocked(x: number, z: number): boolean;
    step(dt: number, input?: WalkInput): void;
    tick(mode: Mode, dt: number, input?: WalkInput): void;
  }
  ```
  `buildColliders`, the constants `RADIUS`, `CROWD`, `TRAFFIC`, `TRUNK_RADIUS`, `REACH` and the graph/lane construction move here from `StreetScene.tsx` unchanged. `step` caps dt at 0.1, copies agent positions into the reused people circles, then runs `walker.step(dt, input, circles)`, `crowd.step(dt, [walker.x, walker.z], traffic.bodies)`, `traffic.step(dt, [walker.x, walker.z], crowd.agents)`. `tick` calls `step(dt, mode === 'street' ? input : undefined)` when `isStreetMode(mode)`, and does nothing otherwise.

Test setup for the new file: the real data and ground, as other unit tests load them.

```ts
const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));
const buf = readFileSync('src/scene/terrain/taipei-dtm.bin');
const ground = groundAt(new HeightField(new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2)));
const DT = 1 / 30;
const keys = (...k: string[]): WalkInput => ({ keys: new Set(k), stick: { x: 0, y: 0 }, look: { dx: 0, dy: 0 } });
/** Steps `seconds` of frames at 30 fps, calling `each` after every step. */
function run(sim: StreetSimulation, seconds: number, input?: WalkInput, each?: () => void): void;
```

Each test builds a fresh `new StreetSimulation(data, ground)` and steps once with no input before placing anyone, so the crowd and traffic have positions.

- [ ] **Step 1: Write the failing tests** in `tests/unit/streetSimulation.test.ts`, `describe('street simulation')`:
  - `'the landing spot is open ground and people are in sight of it'`: `blocked(LANDING.x, LANDING.z)` is false; `visitor()` x, z equal `LANDING` to 1e-6; at least one of `people` is within 80 m of the landing spot.
  - `'with no input the visitor stands still while the crowd and traffic move'`: record visitor, people, scooters; `run(sim, 2)`; visitor moved < 1e-9; more than half of `people` moved > 0.3 m; more than 12 of the 24 scooters moved > 3 m (2 s at 8-11 m/s; adjust to 3 s if the seeded start has many scooters braking).
  - `'a long frame moves the visitor at most one capped step'`: place at `LANDING` facing yaw `LANDING.yaw`; `sim.step(5, keys('w'))`; distance moved ≤ 0.4 + 1e-6 (4 m/s × 0.1 s).
  - `'the visitor slides round a standing person, never through'`: pick `p = people.find(a => !a.moving)`; place visitor at `(p.x, p.z + 3)`, yaw 0; `run(sim, 3, keys('w'), ...)` tracking the closest approach to `p`'s current position; closest < 0.8 and ≥ 0.55 (from the deleted e2e of the same name).
  - `'a building wall stops the visitor'`: place `(0, 47)`, yaw 0; `run(sim, 2, keys('w', 'shift'))`; `z` in (42.8, 44); `blocked(x, z)` false.
  - `'the walk area edge stops the visitor'`: place `(-100, WALK_AREA.z1 - 2)`, yaw π; `run(sim, 2, keys('arrowup'))`; `z` in (`WALK_AREA.z1 - 1`, `WALK_AREA.z1`].
  - `'a tree trunk stops the visitor'`: the first `data.trees` entry more than 20 m inside every `WALK_AREA` edge; `blocked(x, z)` true and `blocked(x + 1, z)` false; place `(x, z + 3)`, yaw 0; `run(sim, 2, keys('w'))`; final z < z + 1 and distance to the trunk > 0.6.
  - `'the crowd yields to the visitor'`: `w = people.find(a => a.moving)`; place the visitor 0.5 m ahead along its heading (`[w.x - sin(h)*0.5, w.z - cos(h)*0.5]`); `run(sim, 1)`; the gap never fell below its starting value minus 1e-6.
  - `'scooters stop for people on the crossings'`: visitor left standing at `LANDING` (on the sidewalk, so it never blocks a lane); `run(sim, 120, undefined, ...)`. Count contacts with the same `touching` test as `tests/unit/traffic.test.ts` (`|along| < 0.85 + 0.3`, `|side| < 0.18 + 0.3`); expect 0. Give it a 30 s Vitest timeout.
  - `'outside the street walk nothing moves, and it resumes where it left off'`: `run` 2 s via `tick('street', DT, keys('w'))`; snapshot visitor, people, scooters; 60 ticks each of `'tour'`, `'explore'`, `'returning'` with `keys('w')`: everything equals the snapshot; 30 ticks of `'descending'` with `keys('w')`: visitor unchanged, some people moved; one `tick('street', DT)` afterwards: no person or scooter moved more than `11 * DT + 0.01` m in that tick (resumed, not respawned or reset).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/streetSimulation.test.ts`
Expected: FAIL, cannot resolve `../../src/street/simulation`.

- [ ] **Step 3: Change `Walker.step` to take `input`, update `tests/unit/walker.test.ts`** so each test builds its own `WalkInput` instead of mutating the global (drop `afterEach(clearInput)`). Any walker test that asserted look deltas get zeroed is rewritten to assert the walker leaves its input untouched.

- [ ] **Step 4: Implement `src/street/simulation.ts`** per the Interfaces block. Keep `StreetScene.tsx` compiling by leaving it untouched for now except where `Walker.step`'s new signature forces a change: `walker.step(dt, input, people)` followed by `input.look.dx = input.look.dy = 0` (the walker no longer consumes the drag; without this the view would keep turning). `walker.reset()` in the api becomes `walker.reset(); clearInput()`. Task 2 replaces this code.

- [ ] **Step 5: Run the unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass, including the new file. If a placement test is blocked by a person who happens to stand in the path under seed 101, move the start a few metres along the same wall rather than changing a seed.

- [ ] **Step 6: Commit**

```bash
git add src/street/simulation.ts src/street/input.ts src/street/walker.ts src/street/StreetScene.tsx tests/unit/streetSimulation.test.ts tests/unit/walker.test.ts
git commit -m "feat: one street simulation steps the visitor, crowd and traffic in order"
```

---

### Task 2: Wire the scene to the simulation

**Files:**
- Modify: `src/street/StreetScene.tsx`
- Modify: `src/street/api.ts` (`StreetApi`)
- Modify: `src/street/input.ts` (add `takeInput`)
- Modify: `src/street/People.tsx`, `src/street/Scooters.tsx` (draw only)
- Modify: `src/scene/CameraRig.tsx` (read the eye pose; drop `MAX_STEP`)
- Modify: `src/debug/testHook.ts` (probe reads the simulation; drop `blocked`)
- Test: `tests/unit/input.test.ts`

**Interfaces:**
- Consumes: `StreetSimulation`, `WalkInput` from Task 1.
- Produces, in `src/street/input.ts`: `takeInput(): WalkInput` returns the held keys, the stick and the look drag accumulated since the last call, then zeroes `input.look`. The returned object must not change when the global changes later (copy look; keys may be a fresh `Set`).
- Produces, in `src/street/api.ts`:
  ```ts
  export interface StreetApi {
    landing(): Pose;   // sim.landing()
    reset(): void;     // sim.reset() then clearInput()
    eye(): Pose;       // sim.eye(); replaces step(dt)
  }
  ```
- `People({ people, ground })` with `people: readonly Agent[]`; `Scooters({ scooters, ground })` with `scooters: readonly Scooter[]`. Neither steps a model nor takes `visitor`. People still eases the swing amplitude with the frame's delta (capped at 0.1 as now).
- Probe `street` keeps `visitor`, `place`, `people`, `scooters`, all reading the simulation; `blocked` is removed from `Probes` (its e2e callers go in Task 3).

- [ ] **Step 1: Write the failing test** `tests/unit/input.test.ts`, `'a look drag is handed over once'`: set `input.look.dx = 30`; `takeInput().look.dx` is 30; a second `takeInput().look.dx` is 0; mutating `input.look.dx` after the first call leaves the first result at 30. `afterEach(clearInput)`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/input.test.ts`
Expected: FAIL, `takeInput` is not exported.

- [ ] **Step 3: Implement `takeInput`**, then rewire:
  - `StreetScene` builds `sim = useMemo(() => new StreetSimulation(data, ground), [data, ground])`, registers `{ landing, reset, eye }` with `setStreet`, and steps with `useFrame((_, delta) => sim.tick(useTour.getState().mode, delta, takeInput()), -1)`. The negative priority runs it before `CameraRig`'s frame callback without taking over rendering (in R3F only positive priorities do). Props get `sim.trees`.
  - `CameraRig` street branch: `if (street) lookAt(c, street.eye())`. The descent still lerps to `street.landing()` and calls `street.reset()` on landing.
  - `People` and `Scooters` lose their model `step` calls and their `visitor` / `people` / `scooters` props.

- [ ] **Step 4: Run unit tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Check in the real app** (bug-free wiring is only visible in a browser). Run `npm run dev`, scroll to the tower chapter, Explore, Walk. Hold W: the view moves forward at eye height with no stutter; drag: the view turns; people walk and part round you; scooters ride and stop at crossings; Escape: rise to the tower stop. Re-enter: people are not back at their spawn spots.

- [ ] **Step 6: Commit**

```bash
git add src/street src/scene/CameraRig.tsx src/debug/testHook.ts tests/unit/input.test.ts
git commit -m "refactor: the street scene ticks the simulation; people and scooters only draw"
```

---

### Task 3: Slim the street e2e tests to wiring checks

**Files:**
- Modify: `e2e/streetLife.spec.ts`
- Modify: `e2e/walk.spec.ts`
- Modify: `e2e/helpers.ts` only if a helper becomes unused

**Interfaces:**
- Consumes: the `street` probe from Task 2 (`visitor`, `place`, `people`, `scooters`), the existing `castRay` probe.

Fate of each street e2e test whose behaviour moved to Task 1:

| File | Test | Fate |
|---|---|---|
| streetLife | people walk around the visitor | replaced by `people and scooters move on the street` |
| streetLife | scooters ride the roads | replaced by `people and scooters move on the street` |
| streetLife | people are visible from the landing spot | deleted (module: landing test) |
| streetLife | the visitor cannot walk through a person | deleted (module) |
| streetLife | everything on the street compiles and draws | kept |
| walk | the landing spot is open ground | deleted (module; `street.spec` still checks landing at eye height) |
| walk | a building wall stops the visitor | deleted (module) |
| walk | the walk area edge stops the visitor | deleted (module) |
| walk | a tree trunk stops the visitor | deleted (module) |
| walk | W walks forward; the camera keeps eye height | kept (keys wiring, camera order) |
| walk | dragging the mouse turns the view right | kept |
| walk | hint, thumbstick, desktop no stick, key held while leaving, window blur | kept |

All of `street.spec.ts`, `streetLoad.spec.ts`, `streetScene.spec.ts` are unchanged.

- [ ] **Step 1: Write `people and scooters move on the street`** in `e2e/streetLife.spec.ts`: after `enterStreet`, snapshot `people()` and `scooters()`; `expect.poll` (20 s) until at least one person moved > 0.3 m and at least one scooter moved > 3 m.

- [ ] **Step 2: Write `people are drawn where they stand`**: take a standing person (`!moving`) within 60 m of the landing spot; `place` the visitor 3 m south of them facing north; on the next frame, `castRay` from `[p.x, ground + 1.2, p.z + 3]` along `[0, 0, -1]` hits a name of `street-people`. This is the only check that the renderer reads the simulation's people.

- [ ] **Step 3: Delete the tests marked deleted or replaced** in the table, and the now-unused `blocked` helper, `readFileSync`, `XinyiData` and `WALK_AREA` imports in `walk.spec.ts`.

- [ ] **Step 4: Run the street e2e files**

Run: `npm run build:e2e && npx playwright test e2e/streetLife.spec.ts e2e/walk.spec.ts e2e/street.spec.ts`
Expected: all pass on both projects (desktop and mobile).

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npx playwright test`
Expected: all pass. Note the total Playwright time against the last CI run's per-shard time in the commit message body.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test: street behaviour lives in module tests; e2e keeps the wiring"
```

Then commit the spec and `CONTEXT.md` if still untracked:

```bash
git add CONTEXT.md docs/superpowers/specs/2026-10-28-street-simulation-design.md docs/superpowers/plans/2026-10-28-street-simulation.md
git commit -m "docs: street simulation design, plan and domain terms"
```
