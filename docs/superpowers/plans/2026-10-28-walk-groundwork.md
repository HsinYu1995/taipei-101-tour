# Walk Groundwork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the street walk's hard-coded "street" lifecycle into a general walk with places, so the mall can plug in next, while the street behaves exactly as today.

**Architecture:** The tour state gains a `place` (only `'street'` for now) and the street-named walk mode and events become walk-named. Code every place shares (input, walker, colliders, gestures, the HUD, the place API) moves from `src/street/` to `src/walk/`; the street keeps only what is about Xinyi. A place's simulation is told its **phase** (`paused`, `still`, `walking`) by one shared function, instead of reading the tour mode itself.

**Tech Stack:** TypeScript, React 19, @react-three/fiber 9, zustand, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-mall-walk-design.md` (section "Groundwork: one walk, two places"); terms in `CONTEXT.md`.

This is plan 1 of 2. Plan 2 (the mall itself) is written after this one lands, against the names it produces.

## Global Constraints

- No behaviour change for the visitor: every existing street e2e test passes with only mechanical renames.
- The street chunk still loads lazily the first time the visitor explores the tower chapter; nothing new enters the initial download.
- Domain words from `CONTEXT.md`: walk, place, visitor. Not "player", not "level".
- E2E stays slim: no new e2e tests in this plan.
- No em dashes in docs, comments or commit messages. No `Co-Authored-By` or other AI attribution in commits.

## Review Focus

1. **Leaving during the descent or ascent** - Escape mid-descent still ends in tour at the tower stop. Kept e2e `escape during the descent and during the ascent both end in tour` (Task 1).
2. **Reload while walking** - comes back in tour at the tower stop, place reset to street. Kept e2e `reloading while walking comes back in tour at the tower stop` (Task 1); place default pinned by a machine test (Task 1).
3. **The street paused while the visitor is elsewhere** - with a second place coming, the street must not tick while the walk is in another place. `phaseOf` test with `place: 'mall'` written against a widened `PlaceId` in Task 2 (cast in the test until plan 2 adds the id).
4. **A failed street download** - still withdraws the walk and returns to tour. Kept e2e `a failed street download returns to the tour and withdraws the walk` (Task 1).
5. **Bundle split** - moving shared code to `src/walk/` must not pull the walk into the initial chunk. Kept e2e `first load and a full tour without explore never fetch the street` (Task 2); its regex may need to also match the new shared chunk, see Task 2 Step 5.

---

### Task 1: Walk lifecycle in the tour state

**Files:**
- Modify: `src/tour/machine.ts`, `src/tour/store.ts`
- Modify (renames only): `src/scene/CameraRig.tsx`, `src/scene/greybox/Basin.tsx`, `src/street/api.ts`, `src/street/gestures.ts`, `src/street/StreetScene.tsx`, `src/street/StreetHud.tsx`, `src/street/simulation.ts`, `src/ui/Overlay.tsx`, `src/ui/HotspotButton.tsx`, `src/ui/StreetErrorBoundary.tsx`, `src/debug/testHook.ts` (if it names modes), `scripts/bake-xinyi.ts` (if it names modes)
- Modify (renames only): `e2e/helpers.ts`, `e2e/street.spec.ts`, `e2e/walk.spec.ts`, `tests/unit/streetSimulation.test.ts`
- Test: `tests/unit/machine.test.ts`

**Interfaces:**
- Produces, in `src/tour/machine.ts`:
  ```ts
  export type PlaceId = 'street';
  export type Mode = 'tour' | 'explore' | 'returning' | 'descending' | 'walking' | 'ascending';
  export interface TourState { progress: number; segment: Segment; mode: Mode; activeHotspot: string | null; place: PlaceId; }
  // events: 'streetEnter' -> 'walkEnter', 'streetExit' -> 'walkExit'; 'landed' and 'ascended' unchanged
  ```
  `initialState.place` is `'street'`. `walkEnter` (from tower explore) sets `place: 'street'` as well as `mode: 'descending'`. The guard "while walking only walk events apply" covers `descending | walking | ascending` exactly as before.
- Produces, in `src/tour/store.ts`: `places: Partial<Record<PlaceId, PlaceApi>>` replacing `street`, and `setPlace(id: PlaceId, api: PlaceApi | null): void` replacing `setStreet`. `streetWanted` and `streetFailed` keep their names: they are about the street chunk.
- Produces, in `src/street/api.ts` for now (moved in Task 2): `PlaceApi` (the former `StreetApi`, same three methods) and `isWalkMode(m: Mode): boolean` (the former `isStreetMode`).
- The `data-testid`s (`walk-street-button`, `back-to-tour-button`, `street-hint`, `street-stick`, `street-loading`) and the `street` test probe keep their names.

- [ ] **Step 1: Update `tests/unit/machine.test.ts`**: rename events and the `'street'` mode in the existing `describe('street modes')` cases (rename the describe to `'walk modes'`), and add:
  - `'the tour starts with the street as the walk's place'`: `initialState.place` is `'street'`.
  - `'walkEnter from tower explore puts the visitor on the street'`: after `exploreStart`, `walkEnter`: `mode` is `'descending'`, `place` is `'street'`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/unit/machine.test.ts`
Expected: FAIL (type errors surface as failures: unknown event `walkEnter`, no `place`).

- [ ] **Step 3: Rename through the code**: machine and store per Interfaces; then every caller listed under Files (`isStreetMode` -> `isWalkMode`, `mode === 'street'` -> `mode === 'walking'`, `'streetEnter'`/`'streetExit'` -> `'walkEnter'`/`'walkExit'`, `s.street` -> `s.places.street`, `setStreet(api)` -> `setPlace('street', api)`). `gestures.ts`'s dispatch type follows. Update comments that say "street mode" to "walking" where they now describe the walk generally.

- [ ] **Step 4: Unit tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS; typecheck clean (it covers `e2e/`, so any missed rename there fails here).

- [ ] **Step 5: Street e2e still green**

Run: `npm run build:e2e && npx playwright test e2e/street.spec.ts e2e/walk.spec.ts e2e/streetLife.spec.ts e2e/streetLoad.spec.ts`
Expected: all pass on both projects, same skips as before.

- [ ] **Step 6: Commit**

```bash
git add src tests e2e scripts
git commit -m "refactor: the street walk becomes the walk, with the street as its place"
```

---

### Task 2: Shared walk code moves to `src/walk/`

**Files:**
- Move: `src/street/input.ts` -> `src/walk/input.ts`; `src/street/walker.ts` -> `src/walk/walker.ts`; `src/street/collide.ts` -> `src/walk/collide.ts`; `src/street/gestures.ts` -> `src/walk/gestures.ts`; `src/street/StreetHud.tsx` -> `src/walk/WalkHud.tsx` (component renamed `WalkHud`)
- Create: `src/walk/api.ts` (from the shared half of `src/street/api.ts`)
- Modify: `src/street/api.ts` (keeps only the street half), `src/street/simulation.ts`, `src/street/StreetScene.tsx`, `src/ui/Overlay.tsx`, `src/scene/CameraRig.tsx`, `src/scene/greybox/Basin.tsx`, `src/ui/HotspotButton.tsx`, `src/ui/StreetErrorBoundary.tsx`, `src/tour/store.ts`
- Move tests: `tests/unit/walker.test.ts`, `tests/unit/collide.test.ts`, `tests/unit/input.test.ts` (imports only)
- Modify: `tests/unit/streetSimulation.test.ts`, e2e imports of `EYE_HEIGHT`
- Test: `tests/unit/walk.test.ts`

**Interfaces:**
- Consumes: `PlaceId`, `Mode` from Task 1.
- Produces, in `src/walk/api.ts`: `EYE_HEIGHT`, `TRANSITION_MS`, `eyePose`, `canWalk`, `isWalkMode`, `PlaceApi`, and
  ```ts
  /** How a place's simulation runs this frame. */
  export type Phase = 'paused' | 'still' | 'walking';
  /** paused unless the walk is in `place`; still during the descent and ascent; walking when the visitor has control. */
  export function phaseOf(state: { mode: Mode; place: PlaceId }, place: PlaceId): Phase;
  ```
- `src/street/api.ts` keeps `LANDING`, `STREET_CHAPTER`, `SCENE_AREA`, `WALK_AREA` (the last two re-exported from `areas.ts` as now).
- Produces, in `src/walk/walker.ts`: `constructor(colliders: Colliders, ground: (x: number, z: number) => number, home: Spot)` where `export interface Spot { x: number; z: number; yaw: number; pitch: number }` lives in `src/walk/api.ts`. `reset()` returns to `home`. The walker no longer imports `LANDING`; `StreetSimulation` passes it.
- `StreetSimulation.tick(phase: Phase, dt: number, input?: WalkInput)` replaces `tick(mode, ...)`: `paused` does nothing, `still` steps without input, `walking` steps with it. `StreetScene` calls `sim.tick(phaseOf(useTour.getState(), 'street'), delta, takeInput())`.
- `WalkHud` is still lazily imported by `Overlay` via `StreetScene`'s re-export for now (`export { default as WalkHud } from '../walk/WalkHud'`), so it still arrives with the street.
- `useStreetGestures` keeps its name: it is the street's way in from the tour, and the walk's way out.

- [ ] **Step 1: Write `tests/unit/walk.test.ts`**, `describe('phaseOf')`:
  - `'outside the walk every place is paused'`: for `tour`, `explore`, `returning` with place `'street'`: `phaseOf(..., 'street')` is `'paused'`.
  - `'the descent and ascent hold the place still'`: `descending`, `ascending` -> `'still'`.
  - `'walking gives the visitor control of their place only'`: `{ mode: 'walking', place: 'street' }` -> `'walking'` for `'street'`; `{ mode: 'walking', place: 'mall' as PlaceId }` -> `'paused'` for `'street'`.

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/walk.test.ts`
Expected: FAIL, cannot resolve `../../src/walk/api`.

- [ ] **Step 3: Move the files with `git mv`, split `api.ts`, add `phaseOf` and the walker's `home`**, then fix imports everywhere (including tests and e2e). In `tests/unit/streetSimulation.test.ts` the pause test switches to phases: `tick('walking', ...)`, `tick('paused', ...)` for the three non-walk modes, `tick('still', ...)` for the descent. In `tests/unit/walker.test.ts` the helper passes `home: { x: 0, z: 0, yaw: 0, pitch: 0 }`, and add `'reset returns to its home'`: place elsewhere, `reset()`, back at home.

- [ ] **Step 4: Unit tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, including `walk.test.ts`.

- [ ] **Step 5: Bundle and street e2e**

Run: `npm run build:e2e && ls dist/assets && npx playwright test e2e/streetLoad.spec.ts e2e/street.spec.ts e2e/walk.spec.ts e2e/streetLife.spec.ts`
Expected: all pass. Check `dist/assets`: the walk code is in the street chunk or a chunk only the street imports, never in the entry chunk. If Vite emits a separate shared chunk, widen `streetLoad.spec.ts`'s `STREET` regex and its size check to include it (ledger it as a ruling) rather than letting it go unchecked.

- [ ] **Step 6: Full suite and the real app**

Run: `npm test && npm run typecheck && npx playwright test`
Expected: all pass, same skip count as before the plan (21 on the last run). Then `npm run dev`: explore the tower, Walk, walk around, drag to look, Escape; reload while walking. Same behaviour as before.

- [ ] **Step 7: Commit**

```bash
git add -A src tests e2e
git commit -m "refactor: walk code every place shares lives in src/walk"
```
