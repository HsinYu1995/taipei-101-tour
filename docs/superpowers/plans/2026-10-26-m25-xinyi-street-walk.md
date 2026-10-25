# M2.5 Xinyi Street Walk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the tower chapter's explore mode, zooming all the way in (or pressing **Walk the street**) lowers the camera to eye height on the sidewalk below Taipei 101. From there the visitor walks freely around a ~700 m square of real Xinyi streets, among pedestrians and scooters, and zooms back out to the tour.

**Architecture:**
- **Data:** a build-time script bakes OpenStreetMap buildings, roads, footways, skybridges and trees into `src/street/xinyi.json`.
- **Main chunk:** the tour gains three modes (`descending`, `street`, `ascending`). `CameraRig` keeps sole ownership of the camera. It blends down and up, and in `street` mode it asks a registered `StreetApi` for the eye pose each frame.
- **Lazy chunks:** everything street-specific (scene, walker, crowd, traffic, HUD) lives in lazily loaded chunks. They are first requested when the visitor enters the tower chapter's explore mode.

**Tech Stack:** as M2 (Vite 8, React 19, TypeScript 7 with `erasableSyntaxOnly`, three 0.186, R3F 9, drei 10, zustand 5, Vitest, Playwright). Node 24 runs `scripts/*.ts` directly (no parameter properties, `.ts` import extensions). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-xinyi-street-walk-design.md` (with `docs/spec.md` for site-wide rules).

## Global Constraints

- Flat low-poly style; no photorealism, no shop signage, no brand logos.
- All user-facing strings live in `src/content/en.ts`. Never use em dashes in copy, docs or comments; use plain dashes.
- Street code is lazy: nothing under `src/street/` except `api.ts`, `types.ts` and `gestures.ts` may be imported from the main chunk. The lazy chunk is first requested on entering the tower chapter's explore mode, never on first load.
- The whole street scene, including data, must be under 1.5 MB gzipped.
- Budgets at street level are the site's: under 200 draw calls and under 300k triangles per frame. Pedestrians and repeated props are instanced or merged.
- Every data source must allow public redistribution and be credited on the page and in `CREDITS.md`. OSM is ODbL: the baked `src/street/xinyi.json` is a derived database and is published under ODbL in this public repo.
- Motion: no head bob, no fast swings. The descent and ascent each take `TRANSITION_MS = 1500` with `easeInOutCubic`. With `prefers-reduced-motion: reduce` the street walk is not offered.
- Breaking the tour is failure. The tour, explore, hotspot, light, tower, terrain and budget suites must pass unchanged.
- World axes: east +x, north -z, y = metres relative to the ground at 101. The origin is the OSM tower centroid (`TAIPEI_101` in `src/scene/terrain/grid.ts`). World x = E - 306996.97, z = -(N - 2769625.6), via `toTwd97`.
- Commits carry no AI attribution trailer.

**Spec erratum (ruled here, recorded in the design doc by Task 7):**
- The design's boundary guess put Xinyi Rd on the north. OSM shows Xinyi Rd sec 5 runs about 80 m **south** of 101 (carriageways at z 78 and 91), Songshou Rd at z ≈ -245, Songgao Rd at z ≈ -605, Keelung Rd at x ≈ -350, Songzhi Rd at x ≈ 62 and Songren Rd at x ≈ 360.
- The walkable square keeps the design's intent (about 700 m, the landmarks inside, bounded by main roads). It is now:
  - west: Keelung Rd;
  - east: Songren Rd;
  - south: Xinyi Rd;
  - north: Songgao Rd.
- SKM A9 and A11 sit between Songshou and Songgao Rds and A8 south of Songgao Rd, all inside the walk. A4 sits just north of Songgao Rd, visible across the road. Vieshow A16 sits at x 165..204, z -229..-138.

## Review Focus

1. **Viewport resize or phone rotation while walking:** the visitor stays in `street` mode. After leaving, the tour resumes at the same tower stop with the same progress. Test in Task 2.
2. **Reload while walking:** the page comes back in tour mode at the tower stop, the page can scroll, and nothing is stuck hidden. Test in Task 2.
3. **Leaving mid-transition:** Escape during the descent, or Back during the ascent, never leaves the tour stuck in a street mode. It ends in `tour` at the tower stop pose. Test in Task 2.
4. **Keys held across leaving and re-entering:** a key held while pressing Escape, or across a window blur, must not keep the visitor walking on the next visit. Test in Task 3.
5. **The street chunk fails to load:** the descent must not hang. The tour returns to `tour` mode at the tower stop, the page scrolls again, and the Walk button is no longer offered. Test in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/bake-xinyi.ts` | Fetch OSM tiles into `.cache/osm/`, project, simplify, classify, write `src/street/xinyi.json` |
| `src/street/types.ts` | `P`, `Rect`, `XinyiData` and its parts, `LandmarkId` (type-only, main-chunk safe) |
| `src/street/api.ts` | Main-chunk constants (`WALK_AREA`, `SCENE_AREA`, `LANDING`, `EYE_HEIGHT`, `TRANSITION_MS`), `StreetApi`, `isStreetMode`, `canWalk`, `landingPose` |
| `src/street/gestures.ts` | `useStreetGestures`: wheel and pinch entry from tower explore, wheel and pinch exit from street (main chunk) |
| `src/street/StreetScene.tsx` | Lazy R3F root: loads data, builds colliders, owns the `Walker`, registers `StreetApi`, mounts the scene parts |
| `src/street/StreetHud.tsx` | Lazy DOM: landing hint, touch thumbstick, keyboard, mouse and touch look input |
| `src/street/input.ts` | Shared input state written by the HUD and read by the walker |
| `src/street/collide.ts` | `Colliders`: circle against polygons and circles, with wall sliding and bounds |
| `src/street/walker.ts` | `Walker`: yaw, pitch, movement, collision, ground following; returns the eye pose |
| `src/street/ground.ts` | `groundAt(field)`, street ground grid geometry, draped strip and polygon helpers |
| `src/street/Ground.tsx` | Paving, roads, crosswalks, grass and plazas |
| `src/street/buildings.ts` | `extrude(shape)`: walls with metre UVs plus roof cap, merged per material |
| `src/street/landmarks.ts` | Landmark palettes and features (Vieshow screen face) |
| `src/street/Buildings.tsx` | Generic buildings, landmarks, skybridges |
| `src/street/Props.tsx` | Trees and street lamps (instanced) |
| `src/street/crowd.ts`, `src/street/person.ts`, `src/street/Crowd.tsx` | Footway graph and pedestrian sim, procedural person geometry, instanced render with a limb-swing shader |
| `src/street/traffic.ts`, `src/street/Traffic.tsx` | Road graph, scooter sim, instanced render |
| Modified | `src/tour/machine.ts`, `src/tour/store.ts`, `src/scene/CameraRig.tsx`, `src/scene/World.tsx`, `src/ui/Overlay.tsx`, `src/ui/HotspotButton.tsx`, `src/scene/terrain/Terrain.tsx`, `src/scene/city/City.tsx`, `src/debug/testHook.ts`, `src/content/en.ts`, `src/styles.css`, `package.json`, `CREDITS.md`, `docs/spec.md`, the design doc |

---

### Task 1: Bake Xinyi from OpenStreetMap

**Files:**
- Create: `scripts/bake-xinyi.ts`, `src/street/xinyi.json`, `src/street/types.ts`, `src/street/api.ts` (constants only in this task)
- Modify: `package.json` (`"bake:xinyi": "node scripts/bake-xinyi.ts"`), `CREDITS.md`
- Test: `tests/unit/xinyiData.test.ts`

**Interfaces:**
- Consumes: `toTwd97(lat, lon)` from `src/geo/twd97.ts`; `PODIUM` from `src/scene/tower/podium.ts`.
- Produces, in `src/street/types.ts`:

```ts
export type P = [number, number]; // world x, z
export interface Rect { x0: number; x1: number; z0: number; z1: number }
export type LandmarkId = 'vieshow' | 'skm-a4' | 'skm-a8' | 'skm-a9' | 'skm-a11';
export interface BuildingShape {
  id: string;            // 'w<osm id>' or 'r<osm id>'
  outer: P[];            // CCW in (x, z), not closed (first != last)
  holes: P[][];
  base: number;          // metres above local ground
  height: number;        // top, metres above local ground; > base
  roof: boolean;         // building=roof canopy: render, never collide
  landmark?: LandmarkId;
  colour?: string;       // #rrggbb from building:colour / building:part colour when parseable
}
export interface Road { kind: 'major' | 'minor' | 'service'; width: number; oneway: boolean; points: P[] }
export interface Area { kind: 'plaza' | 'grass'; outer: P[] }
export interface XinyiData {
  source: { bbox: [number, number, number, number]; fetched: string };
  buildings: BuildingShape[];
  roads: Road[];
  crossings: P[][];
  footways: P[][];       // walkable lines for pedestrians: footways, sidewalks, crossings, pedestrian ways
  areas: Area[];
  skybridges: P[][];
  trees: P[];
  lamps: P[];
}
```

- Also produces, in `src/street/api.ts`:

```ts
export const WALK_AREA: Rect = { x0: -345, x1: 360, z0: -605, z1: 80 };
export const SCENE_AREA: Rect = { x0: -560, x1: 575, z0: -820, z1: 300 };
```

- [ ] **Step 1: Write the failing test** `tests/unit/xinyiData.test.ts`. It loads `src/street/xinyi.json` with `readFileSync`. Write the point-in-polygon and centroid helpers in the test file, as `generateCity.test.ts` does.

```ts
test('all five landmarks are present with real massing', () => {
  for (const id of ['vieshow', 'skm-a4', 'skm-a8', 'skm-a9', 'skm-a11'] as const) {
    const parts = data.buildings.filter((b) => b.landmark === id);
    expect(parts.length, id).toBeGreaterThan(0);
    const top = Math.max(...parts.map((b) => b.height));
    expect(top, id).toBeGreaterThanOrEqual(15);
    expect(top, id).toBeLessThanOrEqual(60);
  }
});
test('Vieshow stands where OSM puts it', () => {
  const [cx, cz] = centroid(data.buildings.filter((b) => b.landmark === 'vieshow').flatMap((b) => b.outer));
  expect(cx).toBeGreaterThan(165); expect(cx).toBeLessThan(204);
  expect(cz).toBeGreaterThan(-229); expect(cz).toBeLessThan(-138);
});
test('the 101 complex is left to the procedural tower and podium', () => {
  for (const b of data.buildings) expect(inside(centroid(b.outer), PODIUM.outline), b.id).toBe(false);
});
test('no underground or inverted buildings', () => {
  for (const b of data.buildings) { expect(b.base).toBeGreaterThanOrEqual(0); expect(b.height).toBeGreaterThan(b.base); }
});
test('everything lies within the scene area', () => {
  const pad = 60;
  for (const [x, z] of data.buildings.flatMap((b) => b.outer)) {
    expect(x).toBeGreaterThan(SCENE_AREA.x0 - pad); expect(x).toBeLessThan(SCENE_AREA.x1 + pad);
    expect(z).toBeGreaterThan(SCENE_AREA.z0 - pad); expect(z).toBeLessThan(SCENE_AREA.z1 + pad);
  }
});
test('the scene is populated', () => {
  expect(data.buildings.length).toBeGreaterThan(600);
  expect(data.skybridges.length).toBeGreaterThanOrEqual(10);
  expect(data.trees.length).toBeGreaterThanOrEqual(80);
  expect(data.crossings.length).toBeGreaterThanOrEqual(100);
  const footwayMetres = data.footways.reduce((sum, w) => sum + length(w), 0);
  expect(footwayMetres).toBeGreaterThan(15000);
});
test('roads include the four boundary roads', () => {
  // A road vertex near each boundary line of the walk area.
  const near = (f: (p: P) => boolean) => data.roads.some((r) => r.points.some(f));
  expect(near(([x, z]) => Math.abs(x - WALK_AREA.x0) < 25 && z < 0)).toBe(true);   // Keelung
  expect(near(([x, z]) => Math.abs(x - WALK_AREA.x1) < 25 && z < 0)).toBe(true);   // Songren
  expect(near(([x, z]) => Math.abs(z - WALK_AREA.z0) < 25 && x > 0)).toBe(true);   // Songgao
  expect(near(([x, z]) => Math.abs(z - WALK_AREA.z1) < 25 && x < 0)).toBe(true);   // Xinyi
});
test('the baked file stays small', () => {
  expect(statSync('src/street/xinyi.json').size).toBeLessThan(1_000_000);
});
```

- [ ] **Step 2: Run it and watch it fail.** Run `npx vitest run tests/unit/xinyiData.test.ts`. Expected: FAIL, with the file not found.

- [ ] **Step 3: Write `scripts/bake-xinyi.ts`.** Rules the implementer cannot derive:
  - **Fetch:**
    - bbox (W, S, E, N) = `[121.5590, 25.0300, 121.5710, 25.0412]`, fetched as two tiles split at lat 25.0356, each from `https://api.openstreetmap.org/api/0.6/map.json?bbox=...`.
    - Send header `User-Agent: taipei-101-tour/0.1 (build script)`.
    - Cache to `.cache/osm/xinyi-<s|n>.json` and reuse the cache when present. Merge elements by `type+id`.
    - Write `source.fetched` from the response's `timestamp` when present, else today's date.
  - **Project:** each node goes through `toTwd97` to world x/z, rounded to 0.1 m. Rings are made CCW in (x, z) with the closing duplicate dropped.
  - **Simplify:** Douglas-Peucker at 0.4 m on building rings, 1 m on road, footway and skybridge lines.
  - **Buildings:**
    - Ways or multipolygon relations tagged `building` (outer ways joined into rings by shared end nodes, inner rings become `holes`), plus ways tagged `building:part`.
    - Skip `layer < 0`, `location=underground`, `building=construction`, and anything whose centroid is inside `PODIUM.outline`.
    - A `building` whose outline contains the centroid of any kept `building:part` is replaced by its parts. Parts inherit its `landmark`.
    - Keep only shapes whose centroid is inside `SCENE_AREA`.
  - **Heights** (`LEVEL = 3.5` m):
    - `height` = parsed `height` tag, else `building:levels × LEVEL`, else the default levels below × LEVEL.
    - `base` = parsed `min_height`, else `building:min_level × LEVEL`, else 0.
    - Default levels by `building` value: house 2, residential 4, apartments 8, commercial 6, office 8, retail 3, school 4, roof 1, everything else 4. A `building:part` without levels gets 1.
    - `building=roof`: `roof: true`, `base = max(base, height - 0.5)`.
  - **Landmarks by OSM id:** `r18356791` vieshow, `w274647897` skm-a4, `w274647896` skm-a8, `w269773067` skm-a9, `w391309615` skm-a11.
  - **Colour:** `building:colour` or `colour` when it is `#rgb`/`#rrggbb` or a CSS colour name three's `Color` knows; otherwise omit.
  - **Roads:**
    - `highway` in trunk, trunk_link, primary, secondary, tertiary, unclassified, residential, service, busway. Not `tunnel`, not `layer < 0`, not `area=yes`.
    - `kind`: major for trunk/primary/secondary, minor for tertiary/unclassified/residential/busway, service for service.
    - `width` = `width` tag, else `lanes × 3.3`, else major 10, minor 8, service 4.5.
    - `oneway` = `oneway` is yes or 1. Reverse the points for `-1`.
  - **Crossings:** ways with `footway=crossing`.
  - **Footways:** `highway` in footway, pedestrian, path, living_street, ways not tagged `bridge`, `tunnel`, `indoor` or `layer != 0`.
  - **Areas:** `highway=pedestrian` + `area=yes`, and `place=square`, become plaza. `landuse=grass`, `leisure=park` and `leisure=garden` become grass.
  - **Skybridges:** `highway=footway` + `bridge=yes` + `layer >= 1`.
  - **Trees and lamps:** `natural=tree` and `highway=street_lamp` nodes.
  - **Output:** sorted by id for a stable diff, written with `JSON.stringify` (no indentation).

- [ ] **Step 4: Run the bake** with `npm run bake:xinyi`. Expected: it prints counts per category and writes `src/street/xinyi.json`. If an OSM tile request is refused for too many nodes, split that tile in two again; record a Ruling.

- [ ] **Step 5: Run the test and watch it pass.** Run `npx vitest run tests/unit/xinyiData.test.ts`. Expected: PASS, 8/8. If a landmark test fails, look at the OSM tags before changing a threshold; any threshold change is a Ruling.

- [ ] **Step 6: Credits.** In `CREDITS.md` add a bullet:
  - "Xinyi street walk: buildings, building parts, roads, footways, crossings, skybridges, trees and lamps, © OpenStreetMap contributors (ODbL), baked by `scripts/bake-xinyi.ts` into `src/street/xinyi.json`."
  - Add that this derived database is available under the ODbL in this repository.

  The on-page OSM credit already exists.

- [ ] **Step 7: Commit.**

```bash
git add scripts/bake-xinyi.ts src/street/xinyi.json src/street/types.ts src/street/api.ts tests/unit/xinyiData.test.ts package.json CREDITS.md
git commit -m "feat: bake Xinyi buildings, roads and footways from OpenStreetMap"
```

---

### Task 2: Street mode lifecycle (enter, land, leave)

The visitor can get into and out of street mode with the camera blends. The lazy scene loads in this task, but only as street paving with a visitor who stands still at the landing spot.

**Files:**
- Modify: `src/tour/machine.ts`, `src/tour/store.ts`, `src/scene/CameraRig.tsx`, `src/scene/World.tsx`, `src/ui/Overlay.tsx`, `src/ui/HotspotButton.tsx`, `src/scene/terrain/Terrain.tsx`, `src/content/en.ts`, `src/styles.css`, `src/street/api.ts`
- Create: `src/street/gestures.ts`, `src/street/StreetScene.tsx`, `src/street/ground.ts`, `src/street/Ground.tsx` (paving grid only in this task)
- Test: `tests/unit/machine.test.ts` (extend), `e2e/street.spec.ts`, `e2e/streetLoad.spec.ts`

**Interfaces:**
- **`machine.ts`:**
  - `Mode = 'tour' | 'explore' | 'returning' | 'descending' | 'street' | 'ascending'`.
  - New events: `{ type: 'streetEnter' } | { type: 'landed' } | { type: 'streetExit' } | { type: 'ascended' }`.
- **`api.ts`** adds:

```ts
export const EYE_HEIGHT = 1.6;
export const TRANSITION_MS = 1500;
/** On the Xinyi Rd sidewalk south of 101, facing the tower. yaw 0 looks north (-z); +yaw turns left (toward -x). */
export const LANDING = { x: -20, z: 58, yaw: -0.33, pitch: 0.36 };
export const STREET_CHAPTER: ChapterId = 'tower';
export interface StreetApi {
  /** Eye pose at the landing spot, on the ground. */
  landing(): Pose;
  /** Put the visitor back at the landing spot and clear held input. */
  reset(): void;
  /** Advance the visitor by dt seconds of input; returns the eye pose. */
  step(dt: number): Pose;
}
export const isStreetMode = (m: Mode) => m === 'descending' || m === 'street' || m === 'ascending';
/** The walk is not offered with reduced motion, or after the street chunk failed to load. */
export function canWalk(): boolean;
/** yaw/pitch to a camera target 10 m ahead. */
export function eyePose(x: number, y: number, z: number, yaw: number, pitch: number): Pose;
```

- **`store.ts`** adds:
  - `street: StreetApi | null`, set by the lazy scene on mount and cleared on unmount;
  - `streetWanted: boolean`, sticky, true once `mode === 'explore'` at the tower stop;
  - `streetFailed: boolean`.

  Setters: `setStreet(api)`, `setStreetFailed()`.
- **`ground.ts`:** `groundAt(field: HeightField): (x: number, z: number) => number`, returning `field.heightAt(x, z)`. Every street mesh and the walker use this one function.
- **`Terrain.tsx`:** takes a `hole: Rect | null` prop. Its material discards fragments with world x/z inside the hole (an `onBeforeCompile` with a `uniform vec4 uHole` and a world-position varying). `Basin` passes `SCENE_AREA` once `useTour((s) => s.street !== null)`, else `null`.

- [ ] **Step 1: Write the failing reducer tests** (extend `tests/unit/machine.test.ts`; helpers as in the file, tower is chapter 1):

```ts
const exploring = (i: number) => tourReducer(at(stopCenter(i)), { type: 'exploreStart' });
test('streetEnter from tower explore descends and closes the hotspot', () => {
  let s = tourReducer(at(stopCenter(1)), { type: 'openHotspot', id: CHAPTERS[1].hotspot.id });
  s = tourReducer(tourReducer(s, { type: 'exploreStart' }), { type: 'streetEnter' });
  expect(s.mode).toBe('descending'); expect(s.activeHotspot).toBeNull();
});
test('streetEnter elsewhere is ignored', () => {
  expect(tourReducer(exploring(0), { type: 'streetEnter' }).mode).toBe('explore');
  expect(tourReducer(at(stopCenter(1)), { type: 'streetEnter' }).mode).toBe('tour');
});
test('landed, streetExit, ascended walk the cycle back to tour', () => {
  let s = tourReducer(exploring(1), { type: 'streetEnter' });
  s = tourReducer(s, { type: 'landed' }); expect(s.mode).toBe('street');
  s = tourReducer(s, { type: 'streetExit' }); expect(s.mode).toBe('ascending');
  s = tourReducer(s, { type: 'ascended' }); expect(s.mode).toBe('tour');
});
test('streetExit during the descent ascends', () => {
  expect(tourReducer(tourReducer(exploring(1), { type: 'streetEnter' }), { type: 'streetExit' }).mode).toBe('ascending');
});
test('scroll, explore and hotspot events are ignored in street modes', () => {
  for (const mode of ['descending', 'street', 'ascending'] as const) {
    const s = { ...exploring(1), mode };
    expect(tourReducer(s, { type: 'scroll', progress: stopCenter(3) })).toBe(s);
    expect(tourReducer(s, { type: 'exploreEnd' })).toBe(s);
    expect(tourReducer(s, { type: 'openHotspot', id: CHAPTERS[1].hotspot.id })).toBe(s);
  }
});
```

- [ ] **Step 2: Run them and watch them fail.** Run `npx vitest run tests/unit/machine.test.ts`. Expected: the new tests FAIL; the old ones still pass.

- [ ] **Step 3: Implement the reducer changes.** Then rerun Step 2's command. Expected: PASS.

- [ ] **Step 4: Write the failing e2e** `e2e/street.spec.ts`.
  - **Helpers:**
    - `enterTowerExplore(page)`: scroll to `stopCenter(1)` and click `explore-button`.
    - `waitMode(page, mode, timeout = 15_000)`.
  - **Timing:** on SwiftShader, blends need generous timeouts, as in `expectBackOnPath`.

```ts
test('walk button lands at eye height on the landing spot', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  const { camera } = await getTour(page);
  const ground = await page.evaluate(([x, z]) => window.__tour!.probes.groundAt!(x, z), [LANDING.x, LANDING.z]);
  expect(camera.position[0]).toBeCloseTo(LANDING.x, 0);
  expect(camera.position[2]).toBeCloseTo(LANDING.z, 0);
  expect(camera.position[1] - ground!).toBeCloseTo(EYE_HEIGHT, 0);
  // Looking toward the tower: the camera target is north of the camera and above eye level.
  expect(camera.target[2]).toBeLessThan(camera.position[2]);
  expect(camera.target[1]).toBeGreaterThan(camera.position[1]);
});
test('zooming in at the minimum distance descends (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterTowerExplore(page);
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await expect.poll(async () => { await page.mouse.wheel(0, -400); return (await getTour(page)).mode; },
    { timeout: 20_000 }).toMatch(/descending|street/);
});
test('pinching out at the minimum distance descends (touch)', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await enterTowerExplore(page);
  // Pinch in until the dolly sits at minDistance, then pinch out past it.
  await expect.poll(async () => { await touchPinch(page, +160); return (await getTour(page)).mode; },
    { timeout: 20_000 }).toMatch(/descending|street/);
});
test('pinching in while walking rises to the tower stop (touch)', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  await touchPinch(page, -160);
  await waitMode(page, 'tour');
  expectNearPose((await getTour(page)).camera, CHAPTERS[1].stop);
});
test('the loading indicator shows while the street is still downloading', async ({ page }) => {
  await page.route(//assets/(Street|xinyi)/, async (r) => { await new Promise((f) => setTimeout(f, 3000)); await r.continue(); });
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await expect(page.getByTestId('street-loading')).toBeVisible();
  await waitMode(page, 'street', 25_000);
  await expect(page.getByTestId('street-loading')).toBeHidden();
});
for (const how of ['back', 'escape', 'wheel'] as const) {
  test(`leaving by ${how} rises to the tower stop and the page scrolls again`, async ({ page, isMobile }) => {
    test.skip(how === 'wheel' && isMobile);
    await enterTowerExplore(page);
    const before = (await getTour(page)).progress;
    await page.getByTestId('walk-street-button').click();
    await waitMode(page, 'street');
    if (how === 'back') await page.getByTestId('back-to-tour-button').click();
    if (how === 'escape') await page.keyboard.press('Escape');
    if (how === 'wheel') await page.mouse.wheel(0, 400);
    await waitMode(page, 'tour');
    const s = await getTour(page);
    expect(s.progress).toBeCloseTo(before, 6);
    expectNearPose(s.camera, CHAPTERS[1].stop);
    const y = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y + 100);
  });
}
test('the page does not scroll and the hotspot is hidden while walking', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('PageDown');
  await page.mouse.wheel(0, -200); // wheel up must not re-trigger anything either
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  await expect(page.getByTestId(`hotspot-${CHAPTERS[1].hotspot.id}`)).toHaveCount(0);
  await expect(page.getByTestId('chapter-caption')).toBeHidden();
});
test('walk is only offered in the tower chapter', async ({ page }) => {
  await scrollToProgress(page, stopCenter(0));
  await page.getByTestId('explore-button').click();
  await expect(page.getByTestId('walk-street-button')).toHaveCount(0);
});
test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the walk is not offered and zooming in stays in explore', async ({ page, isMobile }) => {
    await enterTowerExplore(page);
    await expect(page.getByTestId('walk-street-button')).toHaveCount(0);
    if (!isMobile) { for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -400); await nextFrames(page); }
    expect((await getTour(page)).mode).toBe('explore');
  });
});
// Review Focus 1
test('resizing while walking stays in street and keeps progress', async ({ page }) => {
  await enterTowerExplore(page);
  const before = (await getTour(page)).progress;
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await nextFrames(page);
  expect((await getTour(page)).mode).toBe('street');
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  expect((await getTour(page)).progress).toBeCloseTo(before, 6);
});
// Review Focus 2
test('reloading while walking comes back in tour at the tower stop', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  await page.reload();
  await page.waitForFunction(() => window.__tour !== undefined);
  const s = await getTour(page);
  expect(s.mode).toBe('tour');
  expect(s.segment).toMatchObject({ kind: 'stop', chapterIndex: 1 });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
});
// Review Focus 3
test('escape during the descent and back during the ascent both end in tour', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'descending');
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  expectNearPose((await getTour(page)).camera, CHAPTERS[1].stop);
  await page.getByTestId('explore-button').click();
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  await page.keyboard.press('Escape');
  await waitMode(page, 'ascending');
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
});
```

  `touchPinch(page, spreadPx)` goes in `e2e/helpers.ts`. It sends a two-finger CDP touch gesture centred on the viewport, with the fingers moving apart by `spreadPx` (negative brings them together) over 20 steps, like `touchSwipeUp`.

  **`e2e/streetLoad.spec.ts`:**

```ts
const STREET = /\/assets\/(Street|xinyi)[^/]*\.(js|json)$/;
test('first load and a full tour without explore never fetch the street', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await openTour(page);
  for (let i = 0; i < 4; i++) await scrollToProgress(page, stopCenter(i));
  expect(urls.filter((u) => STREET.test(u))).toEqual([]);
});
test('entering tower explore fetches the street', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await openTour(page);
  await enterTowerExplore(page);
  await expect.poll(() => urls.some((u) => STREET.test(u))).toBe(true);
});
// Review Focus 5
test('a failed street download returns to the tour and withdraws the walk', async ({ page }) => {
  await page.route(STREET, (r) => r.abort());
  await openTour(page);
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'tour', 20_000);
  await page.getByTestId('explore-button').click();
  await expect(page.getByTestId('walk-street-button')).toHaveCount(0);
});
test('the street chunks stay under 1.5 MB gzipped', async ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one build, checked once');
  const files = readdirSync('dist/assets').filter((f) => /^(Street|xinyi)/.test(f));
  expect(files.length).toBeGreaterThan(0);
  const gz = files.reduce((n, f) => n + gzipSync(readFileSync(`dist/assets/${f}`)).length, 0);
  expect(gz).toBeLessThan(1.5 * 1024 * 1024);
});
```

  Share the helpers `enterTowerExplore` and `waitMode` through `e2e/helpers.ts`.

- [ ] **Step 5: Run the e2e and watch it fail.** Run `npx playwright test e2e/street.spec.ts e2e/streetLoad.spec.ts`. Expected: FAIL, because `walk-street-button` is never found. Kill any preview server on 4173 first.

- [ ] **Step 6: Implement.** Decisions the tests do not pin:
  - **Lazy mounts:**
    - `World` renders `<StreetErrorBoundary><Suspense fallback={null}><StreetScene/></Suspense></StreetErrorBoundary>` once `streetWanted`.
    - `StreetScene` comes from `React.lazy(() => import('../street/StreetScene'))`.
    - The boundary's error handler calls `setStreetFailed()` and dispatches `streetExit` when in a street mode. It is a small class component in `World.tsx`.
    - `Overlay` lazily mounts `StreetHud` the same way (it arrives in Task 3; in this task an empty placeholder module `StreetHud.tsx` returning `null` is fine).
  - **`streetWanted`:** set in the store's `dispatch` wrapper or a `useEffect` in `Overlay` the first time `mode === 'explore'` at the chapter whose id is `STREET_CHAPTER`.
  - **`StreetScene` in this task:**
    - Reads the height field with `useHeightField()`.
    - Renders `<Ground/>`: a paving grid over `SCENE_AREA` at 10 m spacing, vertices at `groundAt(x, z)`, colour `#cfc9bd`, named `street-ground`.
    - Registers a `StreetApi` whose `step` returns `landing()`.
    - Calls `setStreet(api)` in an effect and `setStreet(null)` on unmount.
  - **`CameraRig`:**
    - `descending`: hold the current pose while `street` is null; otherwise capture the from-pose on the first ready frame and blend with `lerpPose(from, street.landing(), easeInOutCubic(t))` over `TRANSITION_MS`. At `t = 1` call `street.reset()` and dispatch `landed`.
    - `street`: `lookAt(c, street.step(min(dt, 0.1)))`.
    - `ascending`: capture the from-pose and blend to `poseAt(progress)` the same way. At `t = 1` dispatch `ascended`. If `street` is null during `descending` because loading failed, the boundary's `streetExit` takes over.
    - Controls stay disabled in street modes, and `touch-action` is `none` in them.
    - Set `camera.near = 0.1` while in a street mode and `0.5` otherwise, calling `updateProjectionMatrix()` on change.
  - **`useStreetGestures(el)`,** called from `CameraRig`:
    - In `explore` at the street chapter with `canWalk()`, a wheel with `deltaY < 0` while `c.distance <= minDistance + 1` dispatches `streetEnter`.
    - A two-touch spread growing by more than 60 px while at `minDistance + 1` dispatches `streetEnter`.
    - In `street`, a wheel with `deltaY > 0` dispatches `streetExit`. A two-touch pinch shrinking by more than 60 px also dispatches `streetExit`, but only when neither touch started on `[data-testid=street-stick]`.
    - Listeners are passive observers in the capture phase; they never `preventDefault`.
  - **`Overlay`:**
    - `walk-street-button` ("Walk the street") sits beside Back in explore at the street chapter when `canWalk()`. It dispatches `streetEnter`.
    - In `descending` and `street`, `back-to-tour-button` dispatches `streetExit`.
    - Escape dispatches `streetExit` in `descending`, `street` and `ascending`. During `ascending` this is a no-op by the reducer, which is fine; the test only needs `tour` eventually.
    - While in a street mode, set `document.documentElement.style.overflow = 'hidden'` and hide the caption. Restore both on leaving.
    - `street-loading` ("Loading the street...") shows while `descending && street === null`.
  - **`HotspotButton`** returns null in street modes.
  - **`canWalk()`** = `!matchMedia('(prefers-reduced-motion: reduce)').matches && !useTour.getState().streetFailed`.
  - **`en.ts`:** `ui.walkStreet: 'Walk the street'` and `ui.streetLoading: 'Loading the street...'`.

- [ ] **Step 7: Run the new suites and watch them pass.** Run `npx playwright test e2e/street.spec.ts e2e/streetLoad.spec.ts`. Expected: all pass on desktop and mobile; the skips are the ones written into the tests.

- [ ] **Step 8: Run the whole suite** with `npm run typecheck && npm test && npm run e2e`. Expected: all green. The existing suites pass unchanged.

- [ ] **Step 9: Commit.**

```bash
git add -A src e2e tests
git commit -m "feat: street mode - descend from tower explore to the Xinyi sidewalk and rise back"
```

---

### Task 3: Walking

**Files:**
- Create: `src/street/collide.ts`, `src/street/walker.ts`, `src/street/input.ts`, `src/street/StreetHud.tsx` (replacing the placeholder)
- Modify: `src/street/StreetScene.tsx`, `src/debug/testHook.ts`, `src/content/en.ts`, `src/styles.css`
- Test: `tests/unit/collide.test.ts`, `e2e/walk.spec.ts`

**Interfaces:**
- **`collide.ts`:**

```ts
export class Colliders {
  constructor(polygons: P[][], bounds: Rect, radius: number);
  /** Moves a circle from `from` toward `to`, sliding along walls and staying inside bounds and outside polygons and circles. */
  move(from: P, to: P, circles?: readonly { x: number; z: number; r: number }[]): P;
  /** True if a circle at p overlaps a polygon or lies outside the bounds. */
  blocked(p: P): boolean;
}
```

  Use a spatial hash of polygon edges with 20 m cells. Resolve by up to 3 push-out iterations along the nearest-edge normal, so motion into a wall keeps its tangential part.
- **`input.ts`:** `export const input = { keys: new Set<string>(), stick: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, moved: false }` and `clearInput()`.
- **`walker.ts`:** `export class Walker { x; z; yaw; pitch; constructor(colliders: Colliders, ground: (x: number, z: number) => number); reset(): void; step(dt: number): Pose }`.
  - It reads `input`.
  - Speed is `WALK_SPEED = 1.4` m/s, or 2x with Shift; stick magnitude scales it.
  - Look: `LOOK_RAD_PER_PX = 0.004`, with pitch clamped to [-0.6, 1.2]; dragging right turns right.
  - Collision radius 0.3 m. The eye is at `ground + EYE_HEIGHT`.
  - Look deltas are consumed each step.
- **Colliders** come from `xinyi.json` buildings with `!roof && base < 2` whose bounding box touches `WALK_AREA` grown by 10 m. Add `PODIUM.outline` and the tower's ground footprint: `footprint(27.3)` rotated by `GRID_ROTATION`, from `src/scene/tower/loft.ts` and `podium.ts`. Bounds = `WALK_AREA`.
- **`testHook.ts` `Probes`** adds:

```ts
street?: {
  visitor(): { x: number; z: number; yaw: number; pitch: number };
  place(v: { x: number; z: number; yaw?: number }): void;
  blocked(x: number, z: number): boolean;
};
```

  It is registered by `StreetScene`.

- [ ] **Step 1: Write the failing unit tests** `tests/unit/collide.test.ts`. Use a 10 m square at the origin, bounds ±50, radius 0.3.

```ts
test('walking straight into a wall stops at the wall', () => {
  const [x] = c.move([-10, 0], [-4, 0]); expect(x).toBeCloseTo(-5.3, 1);
});
test('walking diagonally into a wall slides along it', () => {
  const [x, z] = c.move([-5.3, 0], [-4.3, 1]); expect(x).toBeCloseTo(-5.3, 1); expect(z).toBeCloseTo(1, 1);
});
test('cannot leave the bounds', () => {
  const [x] = c.move([49, 20], [55, 20]); expect(x).toBeLessThanOrEqual(49.7);
});
test('a fast step cannot tunnel through a thin wall', () => {
  const thin = new Colliders([[[0, -10], [0.2, -10], [0.2, 10], [0, 10]]], bounds, 0.3);
  const [x] = thin.move([-1, 0], [3, 0]); expect(x).toBeLessThan(0);
});
test('circles block like walls', () => {
  const [x] = c.move([-20, 20], [-18, 20], [{ x: -18, z: 20, r: 0.3 }]);
  expect(Math.hypot(x + 18, 0)).toBeGreaterThanOrEqual(0.59);
});
test('blocked reports inside and outside', () => {
  expect(c.blocked([0, 0])).toBe(true); expect(c.blocked([-20, 0])).toBe(false); expect(c.blocked([60, 0])).toBe(true);
});
```

  Sub-stepping in `move` (steps of at most 0.25 m) is what makes the tunnelling test pass.

- [ ] **Step 2: Run them and watch them fail.** Run `npx vitest run tests/unit/collide.test.ts`. Expected: FAIL, with the module not found.

- [ ] **Step 3: Implement `Colliders`.** Rerun Step 2's command. Expected: 6/6 PASS.

- [ ] **Step 4: Write the failing e2e** `e2e/walk.spec.ts`. Both projects reach street mode with the Walk button, through a helper `enterStreet(page)`.

```ts
test('the landing spot is open ground', async ({ page }) => {
  await enterStreet(page);
  expect(await page.evaluate(([x, z]) => window.__tour!.probes.street!.blocked(x, z), [LANDING.x, LANDING.z])).toBe(false);
});
test('W walks forward; the camera keeps eye height', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  const a = await visitor(page);
  await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
  const b = await visitor(page);
  const moved = Math.hypot(b.x - a.x, b.z - a.z);
  expect(moved).toBeGreaterThan(0.5);
  // Forward is along the facing: yaw 0 is north (-z), +yaw turns toward -x.
  expect(((b.x - a.x) * -Math.sin(a.yaw) + (b.z - a.z) * -Math.cos(a.yaw)) / moved).toBeGreaterThan(0.95);
});
test('a building wall stops the visitor', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  // Facing the tower's south face (z 27.3 at x 0) from 4 m out.
  await place(page, { x: 0, z: 27.3 + 4, yaw: 0 });
  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  await page.waitForTimeout(4000);
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  const v = await visitor(page);
  expect(v.z).toBeGreaterThan(27.3);
  expect(await page.evaluate(([x, z]) => window.__tour!.probes.street!.blocked(x, z), [v.x, v.z])).toBe(false);
});
test('the walk area edge stops the visitor', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  await place(page, { x: -100, z: WALK_AREA.z1 - 2, yaw: Math.PI }); // facing south, 2 m from the Xinyi Rd edge
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowUp');
  expect((await visitor(page)).z).toBeLessThanOrEqual(WALK_AREA.z1);
});
test('dragging the mouse turns the view right', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  const a = await visitor(page);
  await dragAcrossCenter(page, 200);
  expect((await visitor(page)).yaw).toBeLessThan(a.yaw - 0.3);
});
test('the hint shows on landing and fades on first movement', async ({ page, isMobile }) => {
  await enterStreet(page);
  const hint = page.getByTestId('street-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(isMobile ? en.ui.walkHintTouch : en.ui.walkHintDesktop);
  if (isMobile) await stickPush(page, 0, -40, 600); else { await page.keyboard.down('w'); await page.waitForTimeout(300); await page.keyboard.up('w'); }
  await expect(hint).toBeHidden({ timeout: 5000 });
});
test('touch: the thumbstick walks and a drag elsewhere turns', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await enterStreet(page);
  await expect(page.getByTestId('street-stick')).toBeVisible();
  const a = await visitor(page);
  await stickPush(page, 0, -40, 1500);
  const b = await visitor(page);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.5);
  await touchDrag(page, { from: [0.7, 0.4], to: [0.4, 0.4] }); // right half of the screen, leftward drag
  expect((await visitor(page)).yaw).toBeGreaterThan(b.yaw + 0.2);
});
test('desktop shows no thumbstick', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  await expect(page.getByTestId('street-stick')).toHaveCount(0);
});
// Review Focus 4
test('a key held while leaving does not keep walking on the next visit', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  await page.keyboard.down('w');
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  await page.keyboard.up('w');
  await page.getByTestId('explore-button').click();
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  const a = await visitor(page); await page.waitForTimeout(1000); const b = await visitor(page);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.05);
  expect(Math.hypot(a.x - LANDING.x, a.z - LANDING.z)).toBeLessThan(0.05);
});
test('window blur releases held keys', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  await page.keyboard.down('w');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const a = await visitor(page); await page.waitForTimeout(800); const b = await visitor(page);
  await page.keyboard.up('w');
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.05);
});
```

  Add to `e2e/helpers.ts`:
  - `visitor(page)` and `place(page, v)` (wrapping the probe);
  - `stickPush(page, dx, dy, ms)`: a CDP touch held on the `street-stick` centre, offset by (dx, dy) px for `ms`;
  - `touchDrag(page, {from, to})`: one-finger CDP drag between fractions of the viewport.

  Move `dragAcrossCenter` from `explore.spec.ts` into helpers, unchanged.

- [ ] **Step 5: Run the e2e and watch it fail.** Run `npx playwright test e2e/walk.spec.ts`. Expected: FAIL, because the visitor does not move (`step` returns the landing pose).

- [ ] **Step 6: Implement.**
  - **`StreetHud`:**
    - Shown in `street` mode only.
    - **Keyboard:** listens for `keydown`/`keyup` on window for WASD, the arrows and Shift, calling `preventDefault` on the movement keys. `input.moved = true` on the first movement.
    - **Look:** a mouse left-drag on the canvas, or a touch drag that did not start on the stick, adds to `input.look`.
    - **Clearing input:** `blur`, leaving street mode, and `reset()` call `clearInput()`.
    - **Thumbstick:** `street-stick` shows only when `matchMedia('(pointer: coarse)')`. It is a 120 px circle 24 px from the lower-left corner with a 48 px knob; vector = offset / 50 px, clamped to length 1.
    - **Hint:** `street-hint` sits top-centre. It fades out (opacity transition 400 ms, then unmounts) 6 s after landing or on `input.moved`.
  - **`StreetScene`:** builds `Colliders` and a `Walker`. The `StreetApi` delegates `step`, `reset` and `landing` to the walker, and the scene registers the `street` probe.
  - **`en.ts`:**
    - `ui.walkHintDesktop: 'WASD or arrow keys to walk, drag to look around, Shift to hurry. Scroll out or press Esc to leave.'`
    - `ui.walkHintTouch: 'Use the stick to walk and drag to look around. Pinch or tap Back to tour to leave.'`

- [ ] **Step 7: Run it and watch it pass.** Run `npx playwright test e2e/walk.spec.ts e2e/street.spec.ts`. Expected: all pass. The wall-stop tests prove the colliders include the tower footprint.

- [ ] **Step 8: Run the whole suite** with `npm run typecheck && npm test && npm run e2e`. Expected: all green.

- [ ] **Step 9: Commit.**

```bash
git add -A src e2e tests
git commit -m "feat: walk the Xinyi streets with keys, mouse, thumbstick and wall sliding"
```

---

### Task 4: The street scene (buildings, landmarks, ground, props)

**Files:**
- Create: `src/street/buildings.ts`, `src/street/landmarks.ts`, `src/street/Buildings.tsx`, `src/street/Props.tsx`
- Modify: `src/street/Ground.tsx`, `src/street/ground.ts`, `src/street/StreetScene.tsx`, `src/scene/city/City.tsx`, `src/street/collide.ts` callers (tree trunks)
- Test: `tests/unit/buildings.test.ts`, `e2e/streetScene.spec.ts`, `e2e/budget.spec.ts` (extend)

**Interfaces:**
- **`buildings.ts`:**
  - `extrude(shapes: readonly BuildingShape[], ground: (x: number, z: number) => number): BufferGeometry`. Non-indexed and merged.
  - Each shape stands from `min(ground over its outer ring) + base` to `min(ground) + height`.
  - Walls carry metre UVs (u along the perimeter, v up), and holes get inward walls. The cap is triangulated with `ShapeUtils.triangulateShape(outer, holes)` and has planar UVs.
  - A `color` attribute carries the shape's colour, or a palette tint picked by a hash of the id.
- **Mesh names** (castRay finds them):
  - `street-buildings` (one mesh, generic facade texture as City's `CONCRETE`, vertex colours);
  - `street-landmark-<id>` (one mesh per landmark);
  - `street-skybridges`;
  - `street-ground`, `street-roads`, `street-crossings`, `street-grass`;
  - `street-trees`, `street-lamps`.
- **Landmark palettes** (Claude's estimates from photos; tune by screenshots, ruling if changed):

| id | Facade | Band / trim | Feature |
|---|---|---|---|
| vieshow | OSM `red`, darkened to `#8e2a2a` | `#2b2b2e` | Emissive "big screen" panel, 24 m x 12 m, on its north face (toward Songshou Rd), 4 m above ground, slowly cycling blue-violet gradient (`emissiveIntensity` 1.2) |
| skm-a11 | Glass `#8fb3c4` | White frame `#f2f2ee` | Floor bands every 4.5 m |
| skm-a9 | White `#eeeae2` | Glass band `#7fa3b4` | |
| skm-a8 | Warm stone `#d8c7a8` | `#b9a585` | |
| skm-a4 | Grey stone `#c9c6c0` | `#a7a39b` | |

- **Skybridges:** each polyline segment becomes a box 4 m wide, deck bottom 6.0 m and top 9.2 m above ground, in glass `#9fc1c9` at opacity 0.85. They are not colliders and not walkable.
- **Ground layers,** draped on `groundAt`. Strips are subdivided every 10 m. Each layer gets `polygonOffset`, and the offsets rise by layer: paving 0, grass +0.03, roads +0.05, crossings +0.08.
  - Roads: asphalt `#5d6064`, strips of the road's `width` with 8-sided joins.
  - Crossings: white `#e9e9e4` zebra, stripes 0.5 m wide every 1 m along the crossing line, each 4 m long across it.
  - Grass areas `#9cae7f`; plazas a lighter paving `#ddd6c8`.
- **Trees:**
  - Placed at OSM trees, plus park and garden areas filled at one per 120 m² with seed 101, up to 600 in total.
  - An instanced trunk (cylinder, 6 sides, 3 m) and an instanced canopy (icosahedron detail 0, radius 2.2-3.2 m, `#6f8f5a`-`#86a46a` tints).
  - Trunks are 0.35 m collider circles.
- **Lamps:** instanced 6 m poles at OSM lamps.
- **`City.tsx`:** once `street !== null`, drop blocks whose `blockCorners` bounding box overlaps `SCENE_AREA` and rebuild the instances.

- [ ] **Step 1: Write the failing unit tests** `tests/unit/buildings.test.ts`.

```ts
const flat = () => 0;
const box: BuildingShape = { id: 'w1', outer: [[0, 0], [10, 0], [10, 10], [0, 10]], holes: [], base: 0, height: 12, roof: false };
test('a box extrudes to walls and a cap at the right heights', () => {
  const g = extrude([box], flat); const y = g.attributes.position.array.filter((_, i) => i % 3 === 1);
  expect(Math.min(...y)).toBe(0); expect(Math.max(...y)).toBe(12);
  expect(g.attributes.position.count).toBe(4 * 6 + 2 * 3);
});
test('wall UVs are metres so floor bands line up', () => {
  const g = extrude([box], flat); const v = g.attributes.uv.array.filter((_, i) => i % 2 === 1);
  expect(Math.max(...v)).toBeCloseTo(12, 5);
});
test('walls face outward', () => { /* every wall triangle's normal points away from the box centre */ });
test('a raised part floats at its base above the lowest ground', () => {
  const g = extrude([{ ...box, base: 6, height: 9 }], (x) => x / 10);
  const y = g.attributes.position.array.filter((_, i) => i % 3 === 1);
  expect(Math.min(...y)).toBeCloseTo(6, 5); expect(Math.max(...y)).toBeCloseTo(9, 5);
});
test('holes get walls and stay open in the cap', () => {
  const ring = { ...box, holes: [[[4, 4], [4, 6], [6, 6], [6, 4]] as P[]] };
  expect(extrude([ring], flat).attributes.position.count).toBeGreaterThan(extrude([box], flat).attributes.position.count + 4 * 6 - 1);
});
```

  Write the outward-facing test in full, using the cross product of each wall triangle against the vector from the box centre.

- [ ] **Step 2: Run them and watch them fail.** Run `npx vitest run tests/unit/buildings.test.ts`. Expected: FAIL, with the module not found.

- [ ] **Step 3: Implement `extrude`.** Rerun Step 2's command. Expected: PASS.

- [ ] **Step 4: Write the failing e2e** `e2e/streetScene.spec.ts`. Use the `castRay` probe after `enterStreet`, horizontal rays from eye height (`groundAt + 1.6`) unless stated.

```ts
test('each landmark is where OSM says, seen from the street', async ({ page }) => {
  await enterStreet(page);
  const rays: [LandmarkId, Vec3, Vec3][] = [
    ['vieshow', [184, 0, -260], [0, 0, 1]],   // from Songshou Rd, looking south at its north face
    ['skm-a9', [186, 0, -230], [0, 0, -1]],   // from Songshou Rd, looking north
    ['skm-a11', [245, 0, -230], [0, 0, -1]],
    ['skm-a8', [198, 0, -605], [0, 0, 1]],    // from Songgao Rd, looking south
    ['skm-a4', [183, 0, -605], [0, 0, -1]],   // from Songgao Rd, looking north
  ];
  for (const [id, o, d] of rays) {
    const y = (await ground(page, o[0], o[2])) + 3;
    expect((await castRay(page, [o[0], y, o[2]], d))?.name, id).toBe(`street-landmark-${id}`);
  }
});
test('the Vieshow screen face glows', async ({ page }) => { /* castRay hits a mesh whose material emissive luminance > 0.2; expose it through castRay's result as `emissive: number` */ });
test('a skybridge spans overhead between Vieshow and A9', async ({ page }) => {
  await enterStreet(page);
  // OSM way 257896676 runs x 109..221, z -284..-140; look up from under its middle.
  const hit = await castRay(page, [165, (await ground(page, 165, -212)) + 1.6, -212], [0, 1, 0]);
  expect(hit?.name).toBe('street-skybridges');
  expect(hit!.point[1] - (await ground(page, 165, -212))).toBeCloseTo(6, 0);
});
test('ordinary buildings stand at their OSM footprints', async ({ page }) => {
  await enterStreet(page);
  // The Grand Hyatt (way 137077760, x -289..-151, z -222..-138, 85 m): ray west along z -180 from x -120.
  const hit = await castRay(page, [-120, 20, -180], [-1, 0, 0]);
  expect(hit?.name).toBe('street-buildings');
  expect(hit!.point[0]).toBeGreaterThan(-160); expect(hit!.point[0]).toBeLessThan(-145);
});
test('roads and crosswalks lie on the ground', async ({ page }) => {
  await enterStreet(page);
  expect((await castRay(page, [0, 50, 85], [0, -1, 0]))?.name).toBe('street-roads');  // Xinyi Rd south of 101
});
test('procedural blocks give way to real buildings in the scene area', async ({ page }) => {
  await enterStreet(page);
  for (const [x, z] of [[-200, -400], [300, -500], [-450, 200]]) {
    const hit = await castRay(page, [x, 400, z], [0, -1, 0]);
    expect(hit?.name ?? '', `${x},${z}`).not.toBe('city');
  }
});
test('terrain is hidden under the street ground', async ({ page }) => {
  await enterStreet(page);
  expect((await castRay(page, [-300, 200, 250], [0, -1, 0]))?.name).toMatch(/^street-/);
});
```

  - **Extend `castRay`:** it skips meshes with `visible=false` and returns the hit material's emissive luminance as `emissive`.
  - **The terrain hole:** `castRay` should treat terrain hits inside the active hole as misses. Implement that in the probe, since the GPU-side discard does not affect raycasts, and keep a comment there.
  - **Extend `e2e/budget.spec.ts`:** after `enterStreet`, `place` the visitor at the landing spot facing yaw 0, π/2, π and 3π/2, then at `[184, -260]` (Songshou Rd by Vieshow). Assert the same limits as the stops: under 200 calls and under 300k triangles.

- [ ] **Step 5: Run the e2e and watch it fail.** Run `npx playwright test e2e/streetScene.spec.ts e2e/budget.spec.ts`. Expected: FAIL; the landmark rays find nothing.

- [ ] **Step 6: Implement** the components named above and mount them in `StreetScene`. Add tree trunks to the colliders as circles. If the budget fails at street level, first cut triangles in the order below, then rerun:
  1. Coarser footprint simplification in the bake (0.4 → 0.8 m).
  2. Fewer park trees.
  3. Hide the procedural `City` instances beyond 3 km while in `street` mode.

  Record a Ruling for each cut.

- [ ] **Step 7: Run it and watch it pass.** Run `npx playwright test e2e/streetScene.spec.ts e2e/budget.spec.ts`. Expected: all pass.

- [ ] **Step 8: Look at it.** Run `npm run shots` with a new `street` set:
  - Add street poses to `scripts/screenshots.ts`: landing; Songshou Rd by Vieshow facing west; Songgao Rd facing A8; under a skybridge.
  - Each shot enters the street through the Walk button and `place`.
  - Open every PNG. Fix anything that reads as broken: z-fighting, floating buildings, inside-out walls, black faces.
  - Landmark palette changes are Rulings.

- [ ] **Step 9: Run the whole suite** with `npm run typecheck && npm test && npm run e2e`. Expected: all green.

- [ ] **Step 10: Commit.**

```bash
git add -A src e2e tests scripts
git commit -m "feat: real Xinyi buildings, landmarks, skybridges, streets and trees around 101"
```

---

### Task 5: Pedestrians

**Files:**
- Create: `src/street/crowd.ts`, `src/street/person.ts`, `src/street/Crowd.tsx`
- Modify: `src/street/StreetScene.tsx` (mount the crowd, pass agent circles to the walker), `src/debug/testHook.ts` (`street.people()`)
- Test: `tests/unit/crowd.test.ts`, `e2e/streetLife.spec.ts`

**Interfaces:**
- **`crowd.ts`:**

```ts
export interface Graph { nodes: P[]; edges: { a: number; b: number; length: number }[]; adjacent: number[][] }
/** Footway lines clipped to the area, joined at shared points (within 0.2 m), largest connected component only. */
export function buildGraph(lines: readonly P[][], area: Rect): Graph;
export interface Agent { x: number; z: number; heading: number; speed: number; moving: boolean; phase: number }
export class Crowd {
  constructor(graph: Graph, count: number, seed: number);
  readonly agents: readonly Agent[];
  /** Advance by dt seconds; the visitor is an obstacle everyone yields to. */
  step(dt: number, visitor: P): void;
}
```

- **Behaviour** (pinned values):
  - `count = 90`. 15% stand still, placed 2.2 m to the side of a path; the rest walk.
  - Walkers move at 1.1-1.5 m/s along edges and keep to the right at a 0.9 m lateral offset.
  - At a node, a walker picks a random adjacent edge, avoiding the one it came from unless it is a dead end.
  - **Yielding:** a walker stops while any other agent or the visitor is within 0.7 m ahead (within ±70° of its heading). After 2 s blocked, it turns around on its edge.
  - `phase` advances with distance walked, for the limb swing.
- **`person.ts`:**
  - `makePersonGeometry(): BufferGeometry`: merged low-poly boxes for legs, torso, arms and head, 1.7 m tall, about 120 triangles.
  - A `part` vertex attribute: 0 body, 1 left leg, 2 right leg, 3 left arm, 4 right arm.
  - A `color` vertex attribute for skin and hair.
- **`Crowd.tsx`:**
  - One `InstancedMesh` named `street-people`.
  - Per-instance shirt colour via `instanceColor`, and per-instance `aTrousers` (vec3) and `aSwing` (vec2: phase, amplitude 0 when standing).
  - `onBeforeCompile` rotates leg and arm vertices about the hip (y 0.9) and shoulder (y 1.45) by `sin(phase) * 0.5 * amplitude`, legs and arms in opposition.
  - Instance scale varies from 0.94 to 1.06. Shirt colours are drawn from 12 muted tones, trousers from 6.
  - The crowd steps in its own `useFrame` with `dt` clamped to 0.1, whenever the scene is mounted.

- [ ] **Step 1: Write the failing unit tests** `tests/unit/crowd.test.ts`. Use the real graph: `buildGraph(data.footways, WALK_AREA)` from `xinyi.json`.

```ts
test('the graph is one connected network of real footways', () => {
  const g = buildGraph(data.footways, WALK_AREA);
  expect(g.edges.reduce((s, e) => s + e.length, 0)).toBeGreaterThan(8000);
  // connected: BFS from node 0 reaches every node
});
test('walkers stay on the network and inside the walk area', () => {
  const crowd = new Crowd(g, 90, 1);
  for (let i = 0; i < 1800; i++) crowd.step(1 / 30, [1e6, 1e6]);
  for (const a of crowd.agents) {
    expect(a.x).toBeGreaterThanOrEqual(WALK_AREA.x0 - 3); expect(a.x).toBeLessThanOrEqual(WALK_AREA.x1 + 3);
    expect(a.z).toBeGreaterThanOrEqual(WALK_AREA.z0 - 3); expect(a.z).toBeLessThanOrEqual(WALK_AREA.z1 + 3);
    expect(distanceToGraph(g, a)).toBeLessThan(2.5);
  }
});
test('nobody walks through anybody over two minutes', () => {
  const crowd = new Crowd(g, 90, 2); let min = Infinity;
  for (let i = 0; i < 3600; i++) { crowd.step(1 / 30, [1e6, 1e6]); min = Math.min(min, minPairDistance(crowd.agents)); }
  expect(min).toBeGreaterThanOrEqual(0.4);
});
test('walkers yield to the visitor and then turn around', () => {
  // Put the visitor 0.5 m ahead of a walker on its path; after 1 s it has not moved closer; after 3 s it walks away.
});
test('about 15% stand, the rest walk, and the crowd keeps moving', () => {
  const crowd = new Crowd(g, 90, 3); crowd.step(1 / 30, [1e6, 1e6]);
  const standing = crowd.agents.filter((a) => !a.moving).length;
  expect(standing).toBeGreaterThanOrEqual(9); expect(standing).toBeLessThanOrEqual(20);
});
test('same seed, same crowd', () => { /* two crowds with seed 4 stepped 300 times have equal agents */ });
```

  Write the BFS, `distanceToGraph`, `minPairDistance` and the yield test in full in the test file.

- [ ] **Step 2: Run them and watch them fail.** Run `npx vitest run tests/unit/crowd.test.ts`. Expected: FAIL, with the module not found.

- [ ] **Step 3: Implement `buildGraph` and `Crowd`.** Rerun Step 2's command. Expected: PASS. If the 0.4 m separation fails, fix the yield rule; never loosen the threshold.

- [ ] **Step 4: Write the failing e2e** `e2e/streetLife.spec.ts`. Extend the `street` probe with `people(): { x: number; z: number; moving: boolean }[]`.

```ts
test('people walk around the visitor', async ({ page }) => {
  await enterStreet(page);
  const a = await people(page);
  expect(a.length).toBeGreaterThanOrEqual(60); expect(a.length).toBeLessThanOrEqual(120);
  await page.waitForTimeout(2000);
  const b = await people(page);
  const walked = b.filter((p, i) => Math.hypot(p.x - a[i].x, p.z - a[i].z) > 0.3).length;
  expect(walked).toBeGreaterThan(a.length / 2);
});
test('people are visible from the landing spot', async ({ page }) => {
  await enterStreet(page);
  const near = (await people(page)).filter((p) => Math.hypot(p.x - LANDING.x, p.z - LANDING.z) < 80);
  expect(near.length).toBeGreaterThan(0);
});
test('the visitor cannot walk through a person', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  const p = (await people(page)).find((q) => !q.moving)!;
  await place(page, { x: p.x, z: p.z + 3, yaw: 0 });
  await page.keyboard.down('w'); await page.waitForTimeout(3000); await page.keyboard.up('w');
  const v = await visitor(page);
  expect(Math.hypot(v.x - p.x, v.z - p.z)).toBeGreaterThanOrEqual(0.55);
});
```

  Also extend the budget test's street poses so the crowd is in view (the existing poses already include the landing spot).

- [ ] **Step 5: Run the e2e and watch it fail.** Run `npx playwright test e2e/streetLife.spec.ts`. Expected: FAIL, because `people` is undefined.

- [ ] **Step 6: Implement** `person.ts` and `Crowd.tsx`. In `StreetScene`, pass agents to `Walker` as 0.3 m circles; the walker's radius 0.3 gives the 0.6 m centre distance. Register the `people` probe.

- [ ] **Step 7: Run the tests, look at it, then run the whole suite.**
  - Run `npx playwright test e2e/streetLife.spec.ts e2e/budget.spec.ts` and `npm run shots`. Look at the landing and Songshou shots for people with visible limbs.
  - Then run `npm run typecheck && npm test && npm run e2e`.
  - Expected: all green.

- [ ] **Step 8: Commit.**

```bash
git add -A src e2e tests
git commit -m "feat: pedestrians walking the Xinyi footways"
```

---

### Task 6: Scooters

**Files:**
- Create: `src/street/traffic.ts`, `src/street/Traffic.tsx`
- Modify: `src/street/StreetScene.tsx`, `src/debug/testHook.ts` (`street.scooters()`)
- Test: `tests/unit/traffic.test.ts`, `e2e/streetLife.spec.ts` (extend)

**Interfaces:**
- **`traffic.ts`:**

```ts
export interface Lane { points: P[]; length: number; next: number[] }
/** Car roads (not service) in the scene area as directed lanes: one per oneway road, two (offset 2 m to the right of travel) per two-way road; lanes chain where an end meets a start within 1 m. */
export function buildLanes(roads: readonly Road[], area: Rect): Lane[];
export interface Scooter { x: number; z: number; heading: number; lane: number; s: number; speed: number }
export class Traffic {
  constructor(lanes: Lane[], count: number, seed: number);
  readonly scooters: readonly Scooter[];
  step(dt: number, visitor: P): void;
}
```

- **Behaviour** (pinned values):
  - `count = 24`, cruising at 8-11 m/s.
  - A scooter slows to stop within 4 m of the visitor or of another scooter ahead in its lane.
  - At a lane end it continues to a random `next` lane. With none, it respawns at the start of a random lane whose start is more than 60 m from the visitor.
- **`Traffic.tsx`:** instanced procedural scooter (body, seat, wheels) plus a rider reusing `makePersonGeometry` in a seated pose (no swing), named `street-scooters`, two draw calls.

- [ ] **Step 1: Write the failing unit tests** `tests/unit/traffic.test.ts`. Use the real roads.

```ts
test('oneway roads get one lane in the mapped direction', () => {
  // Xinyi Rd sec 5 way at z 78 (oneway, westbound or eastbound as mapped): its lane's travel direction matches the points' order.
});
test('two-way roads get a lane each way, offset to the right', () => {});
test('scooters travel with their lane and never bunch closer than 2 m', () => {
  const t = new Traffic(lanes, 24, 1); let min = Infinity;
  for (let i = 0; i < 1800; i++) { t.step(1 / 30, [1e6, 1e6]); min = Math.min(min, minSameLaneGap(t.scooters)); }
  expect(min).toBeGreaterThanOrEqual(2);
});
test('a scooter stops for the visitor standing in its lane', () => {});
test('same seed, same traffic', () => {});
```

  Write every test body in full. For the oneway test, look up the bake's road by a point it contains.

- [ ] **Step 2: Run them and watch them fail.** Run `npx vitest run tests/unit/traffic.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `buildLanes` and `Traffic`.** Rerun Step 2's command. Expected: PASS.

- [ ] **Step 4: Write the failing e2e,** extending `e2e/streetLife.spec.ts`.

```ts
test('scooters ride the roads', async ({ page }) => {
  await enterStreet(page);
  const a = await scooters(page); expect(a.length).toBe(24);
  await page.waitForTimeout(1500);
  const b = await scooters(page);
  expect(b.filter((s, i) => Math.hypot(s.x - a[i].x, s.z - a[i].z) > 3).length).toBeGreaterThan(12);
});
```

- [ ] **Step 5: Run the e2e and watch it fail.** Run `npx playwright test e2e/streetLife.spec.ts`. Expected: the new test FAILs.

- [ ] **Step 6: Implement** `Traffic.tsx`, mount it, and register the probe.

- [ ] **Step 7: Run the tests, look at it, then run the whole suite.** Run `npx playwright test e2e/streetLife.spec.ts e2e/budget.spec.ts`, then `npm run shots` and look at the shots, then `npm run typecheck && npm test && npm run e2e`. Expected: all green.

- [ ] **Step 8: Commit.**

```bash
git add -A src e2e tests
git commit -m "feat: scooters on the Xinyi roads"
```

---

### Task 7: Finish M2.5

**Files:**
- Modify: `docs/spec.md`, `docs/superpowers/specs/2026-10-25-xinyi-street-walk-design.md`, `scripts/screenshots.ts` (if not already done)

- [ ] **Step 1: Update `docs/spec.md`.** Mark M2.5 done. Add a short "Street walk" section listing:
  - the modes (`descending`, `street`, `ascending`);
  - the walk area and landing spot;
  - the data source;
  - the controls.

- [ ] **Step 2: Add an "Errata (2026-10-26)" section to the design doc.** It records:
  - the corrected boundary geography;
  - where the landmarks really sit;
  - OSM chosen over NLSC, because NLSC needs an emailed request and its license is unconfirmed while OSM covers every landmark with building parts.

- [ ] **Step 3: Final screenshots pass.** Run `npm run shots`. Look at every street and tour shot side by side with the M2 shots of the tower stop. The tour must look as before, apart from real buildings around 101 once the street has loaded.

- [ ] **Step 4: Run the whole suite** with `npm run typecheck && npm test && npm run e2e`. Expected: all green.

- [ ] **Step 5: Commit, push the branch, wait for CI, then fast-forward `main` and push.**

```bash
git add docs scripts
git commit -m "docs: M2.5 Xinyi street walk done"
```

Not covered by CI and left to a manual check on a real phone: 30 fps on the baseline phone at street level. Report it as unverified.
