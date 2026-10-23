# M1 Greybox Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed greybox site where page scroll tours the camera through 4 chapters, each stop allows bounded explore with a smooth handoff back, and each chapter has one placeholder hotspot.

**Architecture:** A fixed full-screen R3F canvas sits under a tall native-scroll document. Scroll progress feeds a pure reducer (`tourReducer`) held in a zustand store; a `CameraRig` component computes the path pose from pure math (`poseAt`) each frame, or hands the camera to drei `CameraControls` in explore mode, blending back on exit. Playwright drives the production e2e build and reads state from `window.__tour`.

**Tech Stack:** Vite 8, React 19, TypeScript, three 0.186, @react-three/fiber 9, @react-three/drei 10, zustand, Vitest (pure math only), Playwright (chromium desktop + Pixel 7 emulation).

**Spec:** `docs/spec.md`

## Global Constraints

- World scale 1 unit = 1 m; Taipei 101 at origin; roof 449 m, spire top 508 m.
- No strings hardcoded in components: all copy comes from `src/content/en.ts`.
- Never use em dashes in copy, docs or commit messages.
- Commit messages carry no Co-Authored-By or AI attribution lines.
- Test hook `window.__tour` exists only when `import.meta.env.VITE_TEST_HOOK === 'true'` (set in `.env.e2e`); never in the normal production build.
- Debug pose capture (`P` key logs pose JSON) only when the URL has `?debug`.
- Explore return blend: 600 ms, ease-in-out cubic.
- Scroll layout: each chapter = travel weight `1.0` + stop weight `1.2` (units of viewport height).
- Playwright chromium launch args: `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`.

## Review Focus

1. Reload while scrolled mid-tour: the browser restores scroll; the camera must match that progress on first frame, not start at the intro pose. (Task 3 test `reload restores pose`.)
2. Fast fling scroll through a chapter while exploring: mode must not get stuck in `explore`; camera ends on the path pose for the final progress. (Task 4 test `scrolling out of a stop while exploring returns to tour`.)
3. Touch: one-finger vertical swipe over the canvas in tour mode scrolls the page. (Task 4 test `touch swipe over canvas scrolls page`, mobile project.)
4. Window resize / orientation change: progress recomputed from new scroll height; no stale segment. (Task 3 test `resize keeps progress consistent`.)
5. Keyboard: Escape exits explore and closes an open hotspot panel; hotspots are focusable buttons. (Task 4 test `escape exits explore`, Task 5 test `escape closes panel`.)

---

## File Structure

```
index.html
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, .env.e2e, .gitignore
src/main.tsx                     React root
src/App.tsx                      Canvas + Overlay + scroll listener
src/content/en.ts                All copy
src/tour/types.ts                Vec3, Pose, ExploreBounds, Chapter, Segment, ChapterId
src/tour/chapters.ts             INTRO_POSE, CHAPTERS, weights
src/tour/path.ts                 segmentAt, poseAt, lerpPose, easeInOutCubic
src/tour/machine.ts              TourState, TourEvent, initialState, tourReducer
src/tour/store.ts                useTour (zustand: state + dispatch)
src/tour/useScrollProgress.ts    window scroll/resize -> dispatch scroll
src/scene/World.tsx              lights + greybox pieces
src/scene/greybox/Basin.tsx      ground, mountain ring, instanced city
src/scene/greybox/Tower.tsx      stacked boxes + spire (FrontSide)
src/scene/greybox/DamperChamber.tsx  room (BackSide) + sphere
src/scene/CameraRig.tsx          path pose / CameraControls / return blend
src/scene/Hotspot.tsx            drei Html button
src/ui/Overlay.tsx               scroll spacer, caption, explore buttons
src/ui/HotspotPanel.tsx          dialog
src/debug/testHook.ts            window.__tour installer
src/debug/poseCapture.ts         ?debug P-key logger
tests/unit/path.test.ts, tests/unit/machine.test.ts
e2e/smoke.spec.ts, e2e/tour.spec.ts, e2e/explore.spec.ts, e2e/hotspot.spec.ts
e2e/helpers.ts                   getTour(page), scrollToProgress(page, p), stopCenter(i)
.github/workflows/ci.yml
```

---

### Task 1: Scaffold, git, test harness

**Files:**
- Create: everything under "config" in the file structure, `src/main.tsx`, `src/App.tsx` (canvas with one grey box), `e2e/smoke.spec.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm run build:e2e` (`vite build --mode e2e`), `npm run preview`, `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest run), `npm run e2e` (playwright test). Playwright `webServer` runs `npm run build:e2e && npx vite preview --port 4173`.

- [ ] **Step 1:** `git init`, scaffold Vite react-ts in place, install three, @react-three/fiber, @react-three/drei, zustand; dev: @types/three, vitest, @playwright/test; `npx playwright install chromium`. `.gitignore` covers node_modules, dist, test-results, playwright-report, .vercel.
- [ ] **Step 2: Write the failing smoke test** `e2e/smoke.spec.ts`:

```ts
test('page renders a WebGL canvas without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3:** Run `npm run e2e`. Expected: FAIL (no canvas yet, Vite template page).
- [ ] **Step 4:** `App.tsx` renders a fixed full-screen `<Canvas>` with a grey box. Playwright config: projects `desktop` (Desktop Chrome) and `mobile` (Pixel 7); swiftshader args from Global Constraints.
- [ ] **Step 5:** Run `npm run e2e` and `npm run typecheck`. Expected: PASS on both projects.
- [ ] **Step 6:** Commit `docs/` plus scaffold: `chore: scaffold vite r3f project with playwright smoke test`.

### Task 2: Tour core (pure math and state)

**Files:**
- Create: `src/tour/types.ts`, `src/tour/chapters.ts`, `src/tour/path.ts`, `src/tour/machine.ts`, `tests/unit/path.test.ts`, `tests/unit/machine.test.ts`

**Interfaces:**
- Produces:
```ts
type Vec3 = readonly [number, number, number];
type ChapterId = 'basin' | 'tower' | 'damper' | 'view';
interface Pose { position: Vec3; target: Vec3 }
interface ExploreBounds { minDistance: number; maxDistance: number; azimuthRange: number /* rad, +- around stop azimuth */; minPolar: number; maxPolar: number }
interface Chapter { id: ChapterId; stop: Pose; explore: ExploreBounds; hotspot: { id: string; position: Vec3 } }
interface Segment { kind: 'travel' | 'stop'; chapterIndex: number; t: number /* 0..1 within segment */ }
const INTRO_POSE: Pose; const CHAPTERS: readonly Chapter[]; const TRAVEL_WEIGHT = 1.0; const STOP_WEIGHT = 1.2;
function segmentAt(progress: number): Segment;       // clamps progress to [0,1]
function poseAt(progress: number): Pose;             // travel: lerpPose(prevStop|INTRO, stop, easeInOutCubic(t)); stop: stop pose
function lerpPose(a: Pose, b: Pose, t: number): Pose;
function easeInOutCubic(t: number): number;
type Mode = 'tour' | 'explore' | 'returning';
interface TourState { progress: number; segment: Segment; mode: Mode; activeHotspot: string | null }
type TourEvent = { type: 'scroll'; progress: number } | { type: 'exploreStart' } | { type: 'exploreEnd' } | { type: 'returnDone' } | { type: 'openHotspot'; id: string } | { type: 'closeHotspot' };
const initialState: TourState; function tourReducer(s: TourState, e: TourEvent): TourState;
```

Chapter data (values to use; tune later with the capture tool):

| id | stop.position | stop.target | min/maxDistance | azimuthRange | min/maxPolar (rad) | hotspot.position |
|---|---|---|---|---|---|---|
| intro | [0, 6000, 9000] | [0, 0, 0] | - | - | - | - |
| basin | [2500, 1800, 4500] | [0, 200, 0] | 3000 / 9000 | 0.8 | 0.6 / 1.3 | [0, 520, 0] |
| tower | [180, 300, 260] | [0, 280, 0] | 150 / 600 | 1.2 | 0.9 / 1.9 | [0, 449, 30] |
| damper | [0, 386, 9] | [0, 380, 0] | 6 / 10 | 3.14 | 0.8 / 2.2 | [0, 380, 3] |
| view | [0, 383, 24] | [0, 383, 25] | 1 / 1 | 1.57 | 1.0 / 2.1 | [0, 300, 400] |

Reducer rules: `exploreStart` only when `mode==='tour'` and `segment.kind==='stop'`. `exploreEnd` in explore -> `returning`. `returnDone` in returning -> `tour`. `scroll` updates progress and segment; if mode is `explore` and the new segment is not the same stop, mode -> `returning`. `openHotspot` only when segment is a stop and id equals `CHAPTERS[segment.chapterIndex].hotspot.id`. `scroll` that leaves the hotspot's stop sets `activeHotspot` to null.

- [ ] **Step 1: Write failing tests.** `path.test.ts`: `segmentAt(0)` is `{kind:'travel', chapterIndex:0, t:0}`; `segmentAt(1)` is stop of chapter 3 with t=1; with total = 4 * 2.2, progress `(1.0 + 0.6)/8.8` is stop of chapter 0 at t=0.5; `segmentAt(-1)` equals `segmentAt(0)`; `poseAt(0)` equals INTRO_POSE; poseAt at any stop progress equals that stop pose; `poseAt` is continuous across every segment boundary (difference under 1e-6 at boundary +- 1e-9); `easeInOutCubic(0.5) === 0.5`. `machine.test.ts`: one test per reducer rule above, including "exploreStart during travel is ignored" and "scroll from stop 1 to travel 2 while exploring gives returning and clears hotspot".
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement the four modules.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add tour path math and state reducer`.

### Task 3: Scroll-driven camera through greybox world

**Files:**
- Create: `src/tour/store.ts`, `src/tour/useScrollProgress.ts`, `src/scene/World.tsx`, `src/scene/greybox/*.tsx`, `src/scene/CameraRig.tsx`, `src/ui/Overlay.tsx`, `src/content/en.ts`, `src/debug/testHook.ts`, `src/debug/poseCapture.ts`, `.env.e2e`, `e2e/helpers.ts`, `e2e/tour.spec.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Task 2 exports.
- Produces: `useTour` (zustand, `{ ...TourState, camera: Pose, dispatch(e: TourEvent): void, setCamera(p: Pose): void }`); `window.__tour.getState(): TourState & { camera: Pose }`; `en.chapters[id].title/body`, `en.hotspots[id].title/body`, `en.ui.explore`, `en.ui.backToTour`, `en.ui.close`; DOM test ids `chapter-caption`, `scroll-spacer`; helpers `getTour(page)`, `scrollToProgress(page, p)` (sets `window.scrollTo` then waits two animation frames), `stopCenter(i): number` (progress at middle of chapter i's stop).

Notes: scroll spacer height = `8.8 * 100vh + 100vh`. Progress = `scrollY / (scrollHeight - innerHeight)`, recomputed on resize. `CameraRig` in tour mode sets camera to `poseAt(progress)` each frame and calls `setCamera`; the camera far plane is at least 40000. Tower exterior uses `FrontSide` (invisible from inside); chamber walls use `BackSide`. Greybox: ground plane 30 km; 12 cones on a ring of radius 9-14 km, heights 400-1100 m; city as one `instancedMesh` of about 400 boxes within 3 km, heights 10-120 m; tower as base box plus 8 boxes of 33.6 m stacked to 449 m and a thin spire to 508 m; chamber box 20 x 30 x 20 centered at y 380 with a 2.75 m radius sphere at y 380. Caption shows the current chapter's title and body. The `chapter-caption` element carries `data-chapter={id}`.

- [ ] **Step 1: Write failing e2e tests** in `e2e/tour.spec.ts`:
  - `each stop shows its caption and camera pose`: for i in 0..3, `scrollToProgress(stopCenter(i))`; expect `segment` = `{kind:'stop', chapterIndex:i}`, caption `data-chapter` = `CHAPTERS[i].id`, camera position within 1% of `CHAPTERS[i].stop` distance-to-target of the stop pose.
  - `travel moves the camera between stops`: camera position at the middle of chapter 1's travel differs from both stop 0 and stop 1 poses.
  - `reload restores pose`: scroll to `stopCenter(2)`, reload, expect segment chapterIndex 2 and camera within tolerance of damper stop.
  - `resize keeps progress consistent`: at `stopCenter(1)`, set viewport 600x900, expect segment still stop of chapter 1.
- [ ] **Step 2:** Run `npx playwright test e2e/tour.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the files listed above.
- [ ] **Step 4:** Run `npm run e2e`. Expected: PASS on both projects. Then capture screenshots at the four stops and look at them to confirm each stop frames its subject (city, tower, sphere, outward view).
- [ ] **Step 5:** Commit `feat: scroll-driven camera tour through greybox chapters`.

### Task 4: Explore mode and handoff

**Files:**
- Modify: `src/scene/CameraRig.tsx`, `src/ui/Overlay.tsx`, `src/content/en.ts`
- Create: `e2e/explore.spec.ts`

**Interfaces:**
- Consumes: `useTour`, `CHAPTERS[i].explore`, `lerpPose`, `easeInOutCubic`.
- Produces: buttons with test ids `explore-button` (visible only at a stop in tour mode) and `back-to-tour-button` (visible in explore).

Notes: `CameraControls` is mounted always but `enabled` only at a stop. In tour mode its mouse left button is ROTATE (a drag fires `controlstart`, which dispatches `exploreStart`), wheel is NONE, and touch one/two are NONE so the page scrolls; the canvas style is `touch-action: pan-y`. In explore mode: wheel DOLLY, touch one ROTATE, touch two DOLLY, and canvas `touch-action: none`. On entering explore, `setLookAt` to the stop pose, and set distance/polar bounds and azimuth bounds = stop azimuth +- `azimuthRange`. In returning mode, blend from the camera pose captured at exit to `poseAt(progress)` over 600 ms with `easeInOutCubic`, then dispatch `returnDone`. Escape dispatches `exploreEnd`.

- [ ] **Step 1: Write failing e2e tests** in `e2e/explore.spec.ts`:
  - `drag at a stop enters explore within bounds` (desktop): at `stopCenter(1)`, mouse drag 300px across canvas center; expect mode `explore`, camera differs from stop pose, distance(camera.position, camera.target) within tower bounds.
  - `drag during travel does nothing` (desktop): at middle of chapter 1 travel, same drag; mode stays `tour`.
  - `explore button and back to tour return to path`: at `stopCenter(2)`, click `explore-button` (mode explore), click `back-to-tour-button`; within 2 s mode is `tour` and camera within tolerance of damper stop.
  - `escape exits explore`: enter explore, press Escape, expect mode `returning` or `tour`, then `tour` within 2 s.
  - `scrolling out of a stop while exploring returns to tour`: enter explore at `stopCenter(0)`, `scrollToProgress(stopCenter(3))`; within 2 s mode `tour` and camera within tolerance of view stop.
  - `touch swipe over canvas scrolls page` (mobile): at progress 0, run CDP `Input.synthesizeScrollGesture` at screen center with `yDistance: -600`, `gestureSourceType: 'touch'`; expect `window.scrollY` > 300.
- [ ] **Step 2:** Run `npx playwright test e2e/explore.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run e2e`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: bounded explore mode with smooth return to tour`.

### Task 5: Placeholder hotspots

**Files:**
- Create: `src/scene/Hotspot.tsx`, `src/ui/HotspotPanel.tsx`, `e2e/hotspot.spec.ts`
- Modify: `src/scene/World.tsx`, `src/ui/Overlay.tsx`, `src/content/en.ts`

**Interfaces:**
- Consumes: `CHAPTERS[i].hotspot`, `useTour`.
- Produces: hotspot buttons `data-testid="hotspot-{id}"` (rendered via drei `Html` at `hotspot.position`, only at that chapter's stop); panel `role="dialog"`, `data-testid="hotspot-panel"`, with close button `hotspot-close`.

Hotspot ids: `basin-101`, `tower-segments`, `damper-sphere`, `view-city`. Placeholder copy goes in `en.hotspots`, one heading and one sentence each.

- [ ] **Step 1: Write failing e2e tests** in `e2e/hotspot.spec.ts`:
  - `each stop has a clickable hotspot`: for each chapter, at `stopCenter(i)` the hotspot button is visible; click it; the panel shows `en.hotspots[id].title`; `activeHotspot` equals the id.
  - `hotspot hidden during travel`: at middle of chapter 2 travel, no `hotspot-*` visible.
  - `escape closes panel`: open, press Escape, panel hidden, `activeHotspot` null.
  - `scrolling away closes panel`: open at stop 0, scroll to `stopCenter(1)`, panel hidden.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Escape priority: if a panel is open, Escape closes it; otherwise it exits explore.
- [ ] **Step 4:** Run `npm run e2e`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: placeholder hotspot per chapter`.

### Task 6: CI and deploy

**Files:**
- Create: `.github/workflows/ci.yml`

Notes: workflow on push and pull_request: `npm ci`, `npx playwright install --with-deps chromium`, `npm run typecheck`, `npm test`, `npm run e2e`; upload `playwright-report` on failure. Creating the GitHub repo and linking Vercel are outward-facing: confirm repo name and visibility with the owner first.

- [ ] **Step 1:** Write workflow; confirm repo name/visibility with owner; `gh repo create` and push `main`.
- [ ] **Step 2:** Watch the run with `gh run watch`. Expected: green.
- [ ] **Step 3:** `vercel link` and connect the Git repo (framework Vite, output `dist`); enable the "require checks to pass" deploy protection or set Vercel's Ignored Build Step so failing CI blocks production.
- [ ] **Step 4:** Open the production URL; confirm the canvas renders and that `window.__tour` is undefined there.
- [ ] **Step 5:** Commit `ci: typecheck, unit and e2e on every push`, then hand the URL to the owner for the phone check (M1 done criterion).
