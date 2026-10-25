# M2 Tower, City and Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish M2: a procedural Taipei 101 detailed enough to stand under (ready for the M2.5 street walk), a low-poly instanced city across the real basin floor, and a morning-to-golden-afternoon light arc driven by scroll.

**Architecture:** Real terrain is already in (`src/scene/terrain/`, commit e0b3283). The tower is built from a pure profile module (`towerProfile.ts`: section heights and half-widths) that both the geometry and the tests read, lofted from a notched-square footprint. The city is a pure generator over the `HeightField` feeding one `InstancedMesh`. Lighting is a pure `lightingAt(progress)` keyframe function applied each frame by an `Atmosphere` component. E2e tests read the rendered scene through test-hook probes (raycasts, render stats), as the terrain tests already do.

**Tech Stack:** Vite 8, React 19, TypeScript, three 0.186, R3F 9, drei 10, zustand, Vitest (pure math), Playwright.

**Specs:** `docs/spec.md` (M2 and the visual sections), `docs/superpowers/specs/2026-10-25-xinyi-street-walk-design.md` (why the tower must hold up at 1.6 m eye height).

## Global Constraints

- 1 unit = 1 m. Taipei 101 at the origin. Roof 449 m, spire top 508 m. East is +x, north is -z, y is metres above the ground at 101.
- Flat low-poly, flat-shaded. Palette anchors: 101 blue-green glass, hazy mountain greens.
- Time-of-day arc: ch1 (`basin`) morning haze, ch2 (`tower`) golden afternoon. Chapters 3 and 4 hold the ch2 values until M3/M4 add theirs.
- No Taipei 101 logo or brand marks.
- Budgets at every stop: under 200 draw calls, under 300k triangles. Under 3 MB gzipped before chapter 1 is interactive.
- All copy in `src/content/en.ts`. Every data source is credited on the page and in `CREDITS.md`.
- Every real-world dimension in code carries a source comment (URL). Where a source disagrees with a value in this plan, the source wins; note it in the commit message.
- The view chapter camera sits at (0, 383, 24) and must stay inside the tower glass; the damper room (20 x 30 x 20 box centred at y 380) must stay inside the tower.
- No em dashes anywhere. Commit messages carry no Co-Authored-By or AI attribution lines.
- Work on branch `m2-tower-city`; merge to `main` by fast-forward after CI is green.

## Review Focus

1. **View chapter from inside the tower:** at the `view` stop the camera must see out through the glass, not the tower's own outer wall from behind or a back-facing hole. Task 3 test `view camera sits inside the glass`.
2. **Tower intersecting the city:** no city block may poke through the podium or tower. Task 4 test `no block inside the 101 site`.
3. **Taller-than-101 blocks:** a random tall block near the camera path would read as a second supertall. Task 4 test `nothing rivals 101`.
4. **Lighting jumps on fast scroll or reload mid-tour:** light comes from progress, never from accumulated time, so a reload at chapter 2 must show afternoon immediately. Task 2 test `reload mid-tour shows afternoon light`.
5. **Budget creep on phones:** the denser city plus the detailed tower must stay under budget at every stop on the mobile project too. Task 1 test `every stop stays within the render budget` (runs in both projects).

---

## File Structure

```
src/debug/testHook.ts             + probes: renderStats, castRay, atmosphere
src/scene/RenderStatsProbe.tsx    registers renderStats from gl.info (new)
src/scene/lighting/timeOfDay.ts   Lighting type, KEYFRAMES, lightingAt(progress) (new, pure)
src/scene/lighting/Atmosphere.tsx sky dome, sun, hemisphere, fog applied per frame (new)
src/scene/tower/towerProfile.ts   section table + halfWidthAt(y) (new, pure)
src/scene/tower/loft.ts           footprint(), loftSection() -> BufferGeometry (new)
src/scene/tower/facadeTexture.ts  CanvasTexture: floor bands + mullions (new)
src/scene/tower/podium.ts         podium footprint in tower-local metres, from OSM (new, data)
src/scene/tower/Tower.tsx         assembles base, segments, crown, spire, ruyi, podium (new)
src/scene/city/generateCity.ts    Block type + generateCity(field, opts) (new, pure)
src/scene/city/City.tsx           instanced blocks with instance colours (new)
src/scene/greybox/Basin.tsx       keeps Terrain; City moves out
src/scene/greybox/Tower.tsx       deleted
src/scene/World.tsx               uses Atmosphere, Tower, City
src/tour/chapters.ts              hotspot positions moved onto real surfaces
scripts/screenshots.ts            `npm run shots`: one PNG per stop into screenshots/ (new)
tests/unit/timeOfDay.test.ts, tests/unit/towerProfile.test.ts, tests/unit/generateCity.test.ts
e2e/budget.spec.ts, e2e/light.spec.ts, e2e/tower.spec.ts
```

---

### Task 1: Render budget guard and screenshot script

Lands first so every later task is measured against the budget.

**Files:**
- Modify: `src/debug/testHook.ts` (extend `Probes`)
- Create: `src/scene/RenderStatsProbe.tsx`; mount it in `src/scene/World.tsx`
- Create: `e2e/budget.spec.ts`, `scripts/screenshots.ts`
- Modify: `package.json` (script `shots`), `.gitignore` (`screenshots`)

**Interfaces:**
- Produces: `Probes.renderStats?: () => { calls: number; triangles: number }` (last rendered frame); `Probes.castRay?: (origin: Vec3, dir: Vec3) => { point: Vec3; name: string } | null` (first hit against the whole scene, `name` is the hit object's `name`, walking up parents until one is non-empty).

- [ ] **Step 1: Write `e2e/budget.spec.ts`**

```ts
test('every stop stays within the render budget', async ({ page }) => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    await scrollToProgress(page, stopCenter(i));
    await nextFrames(page);
    const { calls, triangles } = await page.evaluate(() => window.__tour!.probes.renderStats!());
    expect(calls, CHAPTERS[i].id).toBeLessThan(200);
    expect(triangles, CHAPTERS[i].id).toBeLessThan(300_000);
  }
});
```
Wait for the terrain first with the same `waitForFunction` on `probes.groundAt` the terrain spec uses, so the counts include it.

- [ ] **Step 2: Run it, expect FAIL** (`renderStats` is undefined). `npx playwright test e2e/budget.spec.ts`

- [ ] **Step 3: Implement `RenderStatsProbe`** (reads `gl.info.render.calls` / `.triangles` in `useFrame` at priority after render, stores the last values, registers via `registerProbe`) and the `castRay` probe (a `Raycaster` over `scene` from `useThree`). Name scene objects as later tasks need them; for now name the terrain mesh `terrain`.

- [ ] **Step 4: Run, expect PASS** in both projects. Record the numbers per stop in the commit message as the baseline.

- [ ] **Step 5: Add `scripts/screenshots.ts`**: starts nothing itself; expects `npx vite preview --port 4173` of an e2e build; launches chromium with the SwiftShader args from `playwright.config.ts`, desktop 1280x800 and Pixel 7 at DPR 1, waits for the terrain probe, scrolls to each `stopCenter(i)` (copy the formula from `e2e/helpers.ts`), waits 2.5 s, writes `screenshots/<project>-<chapter>.png`. Script `"shots": "node scripts/screenshots.ts"`.

- [ ] **Step 6: Commit** `test: render budget guard and stop screenshots`

---

### Task 2: Morning-to-afternoon light

**Files:**
- Create: `src/scene/lighting/timeOfDay.ts`, `src/scene/lighting/Atmosphere.tsx`, `tests/unit/timeOfDay.test.ts`, `e2e/light.spec.ts`
- Modify: `src/scene/World.tsx` (remove `<color>`, `<fog>`, hemisphere and directional lights; mount `<Atmosphere />`; keep the damper point light), `src/debug/testHook.ts`, `src/styles.css` (`--bg` follows the morning horizon colour so the page edge matches before WebGL starts)

**Interfaces:**
- Produces:
  ```ts
  export interface Lighting {
    sunElevation: number; sunAzimuth: number;   // radians; azimuth clockwise from north
    sunColor: string; sunIntensity: number;
    skyTop: string; skyHorizon: string; ground: string; hemiIntensity: number;
    fogColor: string; fogNear: number; fogFar: number;
  }
  export const KEYFRAMES: readonly { progress: number; lighting: Lighting }[];
  export function lightingAt(progress: number): Lighting;
  ```
  `Probes.atmosphere?: () => { fogColor: string; sunDirection: Vec3 }` (fog colour as `#rrggbb`, unit vector toward the sun).
- Consumes: `stopCenter` math via `CHAPTERS`, `TRAVEL_WEIGHT`, `STOP_WEIGHT` from `src/tour/chapters.ts`.

Keyframes (starting values; tune by eye with `npm run shots`, keep the test relations):

| at | sun elev / azim | sun | sky top / horizon | ground | fog colour, near-far |
|---|---|---|---|---|---|
| progress 0 (intro) through ch1 stop end: **morning** | 18° / 105° (ESE) | `#fff0d8` x1.5 | `#a9c3d8` / `#e6ebee` | `#6f7f66` | `#dde3e7`, 5000-24000 |
| ch2 stop start onward: **golden afternoon** | 28° / 250° (WSW) | `#ffd08a` x2.0 | `#7fa6cf` / `#f2d6a8` | `#7a7458` | `#ead8b8`, 9000-34000 |

Between the two (the ch2 travel segment) every field interpolates linearly in progress (colours in linear RGB, angles along the shorter arc).

- [ ] **Step 1: Unit tests** in `timeOfDay.test.ts`: `lightingAt(0)` equals the morning keyframe; `lightingAt(1)` equals the afternoon one; at the middle of ch2 travel the sun azimuth lies strictly between 105° and 250° going through south (180°), i.e. not through north; `lightingAt` is continuous (sampling 1000 steps, no field jumps more than 2% of its range between neighbours); values below 0 or above 1 clamp.
- [ ] **Step 2: Run, expect FAIL.** `npx vitest run tests/unit/timeOfDay.test.ts`
- [ ] **Step 3: Implement `timeOfDay.ts`.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: E2e `light.spec.ts`**: `morning haze at the basin, golden light at the tower` (fog colour at `stopCenter(0)` equals `#dde3e7`, at `stopCenter(1)` equals `#ead8b8`; sun direction x > 0 in the morning (east), x < 0 in the afternoon); `reload mid-tour shows afternoon light` (scroll to `stopCenter(1)`, reload, wait for the hook, one `nextFrames`, fog colour already `#ead8b8`).
- [ ] **Step 6: Implement `Atmosphere.tsx`**: a sky dome (inverted sphere radius 50000, `ShaderMaterial` with top/horizon colour uniforms by view-direction elevation, `fog: false`, `depthWrite: false`), one `DirectionalLight` placed 20000 m from the origin along the sun direction targeting the origin, a `HemisphereLight`, and scene fog; all updated in `useFrame` from `lightingAt(useTour.getState().progress)`. Registers the `atmosphere` probe.
- [ ] **Step 7: Run unit + e2e, expect PASS**, plus `e2e/budget.spec.ts`. Run `npm run shots` and look at all four stops.
- [ ] **Step 8: Commit** `feat: morning haze to golden afternoon light along the tour`

---

### Task 3: Procedural Taipei 101

**Files:**
- Create: `src/scene/tower/towerProfile.ts`, `loft.ts`, `facadeTexture.ts`, `podium.ts`, `Tower.tsx`; `tests/unit/towerProfile.test.ts`; `e2e/tower.spec.ts`
- Delete: `src/scene/greybox/Tower.tsx`
- Modify: `src/scene/World.tsx`, `src/tour/chapters.ts` (hotspots), `CREDITS.md`, `src/content/en.ts` + `src/ui/Overlay.tsx` (credit line gains OpenStreetMap), `e2e/terrain.spec.ts` credit test

**Interfaces:**
- Produces:
  ```ts
  export interface TowerSection { name: 'base' | `segment-${1|2|3|4|5|6|7|8}` | 'crown'; y0: number; y1: number; half0: number; half1: number }
  export const SECTIONS: readonly TowerSection[];   // bottom to top, contiguous, last y1 = 449
  export const ROOF = 449; export const SPIRE_TOP = 508;
  export function halfWidthAt(y: number): number;    // outer half-width of the glass at height y; 0 above the roof
  export function footprint(half: number): [number, number][];   // notched square, counter-clockwise, in loft.ts
  export function loftSection(s: TowerSection): BufferGeometry;  // side walls + top cap, in loft.ts
  export const PODIUM: { outline: [number, number][]; height: number };   // tower-local x/z metres
  export const GRID_ROTATION: number;   // radians about +y aligning 101 (and the Xinyi street grid) with x/z, in podium.ts
  ```
  Scene object names (for `castRay`): `tower-base`, `tower-segment-N`, `tower-crown`, `tower-spire`, `tower-podium`.

The building, top to bottom (from Wikipedia "Taipei 101" and CTBUH; confirm each value and cite it in `towerProfile.ts`):

| section | floors | y range (m) | half-width | shape |
|---|---|---|---|---|
| base | 1-26 | 0-120 | 33 at ground to 25 at top | frustum tapering inward |
| segments 1-8 | 27-90, 8 floors each | 120 + 33.6k to 153.6 + 33.6k | 23 at each segment's bottom to 27.5 at its top | inverted frustums flaring outward |
| crown | 91-101 | 388.8-449 | stepped: 3 boxes of 18, 14, 10 | setbacks |
| spire | - | 449-508 | radius 1.5 to 0.4 | 8-sided cone |

- Footprint: a square whose four corners each carry a double notch (two 90° steps inward, each step 8% of the half-width), giving the 101's serrated corners.
- Facade: `facadeTexture` draws blue-green glass (`#4f8f8f` to `#6fa8a3`) with a lighter floor line every 4.2 m and vertical mullions every 2.1 m; repeat set from the section's real size so bands match floors on every face.
- Ruyi: one ornament per face at the top of the base (y ≈ 120), an extruded three-lobed cloud shape about 8 m tall, gold-tinted (`#c9a227`), standing proud of the face by 1 m.
- Podium: the Taipei 101 Mall footprint from OpenStreetMap (find the way via `https://nominatim.openstreetmap.org/search?q=Taipei+101+Mall&format=json`, fetch it from `https://api.openstreetmap.org/api/0.6/way/<id>/full`, project nodes with `toTwd97`, shift so the OSM tower footprint's centroid is the origin, and rotate by the angle that aligns the OSM tower footprint's edges with x/z; record it as `GRID_ROTATION` in `podium.ts` and apply it to the whole tower group). Height 6 floors, about 36 m. Credit "© OpenStreetMap contributors" (ODbL) on the page and in `CREDITS.md`.
- All walls single-sided `FrontSide`, so the view chapter (inside segment 8) sees out.

- [ ] **Step 1: Unit tests** in `towerProfile.test.ts`: sections are contiguous from 0 to 449; there are exactly 8 segments of 33.6 m; each segment is wider at its top than its bottom; `halfWidthAt(383) > 24 + 1` (view camera at z 24 stays inside the glass with 1 m to spare); `halfWidthAt(y) > 10 + 1` for y in 365-395 (damper room fits); `halfWidthAt(500) === 0`; `footprint(20)` has 20 vertices, is counter-clockwise (positive shoelace area), and every vertex lies within the 20 m half-width square.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `towerProfile.ts` and `loft.ts`.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: E2e `tower.spec.ts`**, each using `castRay`: `spire top is at 508 m` (ray down from (0, 600, 0) hits `tower-spire` at y within 1 m of 508); `glass sits where the profile says` (ray from (200, y, 0) toward -x hits a `tower-*` object at x within 0.5 m of `halfWidthAt(y)` for y = 60, 200, 383); `view camera sits inside the glass` (ray from the `view` stop position toward its target hits a `tower-segment-8` face beyond z 24, and a ray from (0, 383, 60) toward -z hits the same segment's outer wall, proving the camera is inside); `podium is at street level` (ray down from a point inside `PODIUM.outline` but outside the tower hits `tower-podium` at y within 1 m of its height).
- [ ] **Step 6: Implement `facadeTexture.ts`, `podium.ts`, `Tower.tsx`**; delete the greybox tower; move hotspots onto real surfaces: `basin-101` at (0, 470, 0), `tower-segments` at the face of segment 6 (z = `halfWidthAt(y)` + 1 at that segment's middle y).
- [ ] **Step 7: Run all unit and e2e tests**, including `budget.spec.ts` and the hotspot suite. Run `npm run shots`; check the tower stop, and also look up at the tower from (40, 1.6, 120) with `?debug` and the explore controls to judge the street-level read.
- [ ] **Step 8: Commit** `feat: procedural Taipei 101 with podium, ruyi and floor-banded glass`

---

### Task 4: Instanced city across the basin

**Files:**
- Create: `src/scene/city/generateCity.ts`, `src/scene/city/City.tsx`, `tests/unit/generateCity.test.ts`
- Modify: `src/scene/greybox/Basin.tsx` (drop its `City`; keep `Terrain`, render the new `City` inside the same `Suspense` with the shared `HeightField`)

**Interfaces:**
- Consumes: `HeightField` (`src/scene/terrain/grid.ts`), `PODIUM`, `GRID_ROTATION` and `footprint` from Task 3.
- Produces:
  ```ts
  export interface Block { x: number; z: number; y: number; width: number; depth: number; height: number; rotation: number; shade: number }
  export interface CityOptions { seed: number; radius: number; count: number }
  export function generateCity(field: HeightField, opts: CityOptions): Block[];
  ```

Rules: blocks only on level, dry lowland (the current Basin rules: ground under 25 m, absolute height at least 2 m, under 6 m tilt across the footprint); outside the 101 site (`PODIUM.outline` grown by 20 m, plus the tower footprint); not overlapping each other (axis-aligned check on a 50 m spatial hash is enough); `rotation` within ±4° of `GRID_ROTATION`, so streets read as a grid. Heights: mostly 12-60 m; within 1.5 km of 101 up to 200 m, rarer as they get taller; never above 250 m. Defaults `{ seed: 101, radius: 9000, count: 6000 }`. One `InstancedMesh`, box geometry, `instanceColor` from `shade` (greys and warm whites `#b9bcbe` to `#e3dfd6`), the facade texture style reused in grey.

- [ ] **Step 1: Unit tests** in `generateCity.test.ts`, against a `HeightField` built from the committed `taipei-dtm.bin` (read with `fs`): `blocks avoid hills and water` (for each block, `field.heightAt` at its corners is under 25 and absolute height at least 2); `no block inside the 101 site`; `nothing rivals 101` (every height ≤ 250); `blocks do not overlap`; `same seed, same city` (two calls deep-equal); `count is close to the request` (at least 90% of `count`).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `generateCity.ts`.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Implement `City.tsx`** and wire it into `Basin.tsx`.
- [ ] **Step 6: Run all tests**; `budget.spec.ts` must pass on both projects. If triangles exceed budget, lower `count` before anything else. Run `npm run shots` and check all stops.
- [ ] **Step 7: Commit** `feat: instanced low-poly city across the basin floor`

---

### Task 5: Poses, docs and merge

**Files:**
- Modify: `src/tour/chapters.ts` (stop poses for `basin` and `tower` retuned with `?debug` P-capture so 101 and the city compose well), `docs/spec.md` (M2 done; record the tower profile and city rules briefly), `CREDITS.md`

- [ ] **Step 1:** Retune the two stop poses; keep explore bounds valid (tower stop distance within its `minDistance`-`maxDistance`).
- [ ] **Step 2:** Full run: `npm run typecheck && npm test && npm run e2e`, all green. `npm run shots` and show the owner the eight screenshots.
- [ ] **Step 3: Commit** `docs: M2 done; retuned basin and tower stops`, push `m2-tower-city`, wait for CI green, fast-forward `main`, push.
