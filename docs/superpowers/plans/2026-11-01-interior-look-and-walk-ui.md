# 101 interior look and walk interface - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 101 mall read as a bright, lit interior on every floor and restyle the walk's interface as the building's own signage (lift-plate floor panel, wayfinding hint strip, lift doors).

**Architecture:** The mall's light becomes a per-floor hemisphere light plus the existing key, with emissive cove strips added to each floor's `glow` mesh and soft light pools drawn as one additive, vertex-coloured decal mesh per floor. Palettes are lifted in `floors.ts` under a tested lightness floor. The walk UI gets its own token set in `styles.css`. Lift doors are one look drawn two ways: as DOM panels in `Fade.tsx` for the 5F-to-89F crossing, and as a clip-space shader on the mall's existing fade quad for floor changes, both reading their colours from `src/walk/doors.ts`.

**Tech Stack:** Vite, React 19, TypeScript, three 0.186 / R3F 9, zustand, Vitest (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-11-01-interior-look-and-walk-ui-design.md`

## Global Constraints

- Mall render budget unchanged: under 200 draw calls and 300k triangles at every pose in `e2e/budget.spec.ts`.
- No real-time shadows, no extra point or spot lights. The mall's lights stay in the scene at intensity 0 outside the mall (the light count every material compiles for never changes).
- No palette entry darker than HSL lightness 0.18. Hues stay those of the current `CHARACTER` palettes.
- Shared trim colours: gold `#C8A44D`, tower glass `#5E8C86`.
- Walk UI tokens: steel `#D9D6CF`, steel-edge `#A9A59C`, ink `#1D2A33`, gold `#C8A44D`, glass `#5E8C86`, sign-ground `#F3F0E8` at 92%.
- Type: Atkinson Hyperlegible Next (Latin) and Noto Sans TC (Chinese), sentence case, no all-caps, no monospace. Floor numbers 20 px semibold, floor names 13 px regular.
- Teal `--accent` `#1F6F78` stays outside the walk only.
- All copy in `src/content/en.ts`. No em dashes in copy or comments.
- Test ids, aria labels, `aria-pressed` and walk behaviour unchanged.
- The walk is never offered under reduced motion (`canWalk()` in `src/walk/api.ts`), so the lift doors need no reduced-motion fallback. (This supersedes the spec's two reduced-motion lines, which assumed otherwise.)
- Local e2e: the machine runs out of memory on full runs. Run one project at a time, `--workers=1`, one spec file at a time; ask the owner to close Chrome first.
- Commits carry no Co-Authored-By or other AI attribution line.

## Review Focus

1. **A floor change pressed mid-lift-crossing, or a crossing turned back while the doors are shut**: the doors must open again on wherever the visitor ends up, never stay drawn over a live scene. Task 8 tests the turn-back.
2. **Phone landscape (short viewport)**: the floor panel's two-abreast layout must still fit with the floor names hidden, and the hint strip must not cover the thumbstick. Task 6 and Task 7 check the mobile project's screenshot.
3. **Looking straight up through the atrium on 1F**: the laylight and the floors above are lit; the ceiling check must not sample the open atrium. Task 3 picks poses facing away from it.
4. **Additive pools stacking** where a lamp pool overlaps a shopfront band: the floor must not blow out to white. Task 4 caps decal centre values and checks the B1 screenshot, the floor with the densest lamps and shopfronts.
5. **Fonts that fail to load** (offline, blocked Google Fonts): the UI must still lay out with the system fallback. Task 5 sets fallbacks and the e2e suite runs as is.

---

### Task 1: Before screenshots of the mall

**Files:**
- Modify: `scripts/screenshots.ts`

**Interfaces:**
- Produces: `npm run shots` also writes `screenshots/<project>-mall-<floor>.png` and `screenshots/<project>-mall-<floor>-back.png` for every floor in `FLOOR_IDS`, plus `screenshots/<project>-mall-panel.png` (1F lobby with the HUD visible).

- [ ] **Step 1:** After the street poses, walk into the mall as `e2e/helpers.ts` `enterMall` does (place at `{ x: 0, z: 46, yaw: 0, pitch: 0 }`, hold `w` until `mode === 'walking' && place === 'mall'`, 90 s timeout). For each floor: `probes.mall.goTo(floor)`, wait for `floor() === f && !changing()`, wait 2500 ms, shoot `mall-<floor>`; then place the visitor at the same spot with `yaw + Math.PI`, wait 1500 ms, shoot `mall-<floor>-back`.
- [ ] **Step 2:** Run `npm run build:e2e`, serve with `npx vite preview --port 4173`, then `npm run shots`. Expected: 26 mall files across desktop and mobile, and render counts printed for each.
- [ ] **Step 3:** Copy the mall shots to `screenshots/before/` (gitignored like `screenshots/`; check `.gitignore` and add `screenshots/` if missing). They are the "before" set for the owner's review at the end.
- [ ] **Step 4: Commit**

```bash
git add scripts/screenshots.ts .gitignore
git commit -m "chore: screenshots of every mall floor, both ways"
```

### Task 2: Lifted palettes and the hemisphere light's colours

**Files:**
- Modify: `src/mall/floors.ts`
- Test: `tests/unit/mallFloors.test.ts` (create)

**Interfaces:**
- Produces:
  - `Character['light']` becomes `{ sky: string; ground: string; hemiIntensity: number; key: string; keyIntensity: number }` (replaces `ambient` / `ambientIntensity`).
  - `export const TRIM = { gold: '#C8A44D', glass: '#5E8C86' } as const;`
  - `export const MIN_LIGHTNESS = 0.18;`

- [ ] **Step 1: Write the failing tests**

```ts
test('no palette entry is darker than the value floor', () => {
  for (const f of FLOOR_IDS)
    for (const [k, hex] of Object.entries(CHARACTER[f].palette))
      expect(hsl(hex).l, `${f} ${k}`).toBeGreaterThanOrEqual(MIN_LIGHTNESS);
});

test('every floor bounces light onto its ceiling', () => {
  for (const f of FLOOR_IDS) {
    expect(CHARACTER[f].light.hemiIntensity, f).toBeGreaterThan(0);
    expect(hsl(CHARACTER[f].light.ground).l, f).toBeGreaterThanOrEqual(0.3);
  }
});
```

(`hsl` via `new Color(hex).getHSL({h:0,s:0,l:0})`.)

- [ ] **Step 2:** Run `npx vitest run tests/unit/mallFloors.test.ts`. Expected: FAIL on B1 ceiling, 2F wall and ceiling, 3F floor, wall and ceiling, 5F wall, and on `light.ground` being undefined.
- [ ] **Step 3: Lift the palettes in `CHARACTER`** to the spec's table:

| Floor | Entry | Value |
|---|---|---|
| B1 | floor | `#7a5233` |
| B1 | ceiling | `#6b4a2e` |
| 1F | shopfront | `#a7aeb3` |
| 2F | floor | `#4a4466` |
| 2F | wall | `#3a3550` |
| 2F | ceiling | `#2c2840` |
| 3F | floor | `#5a4c3c` |
| 3F | wall | `#3d3328` |
| 3F | ceiling | `#4a3e30` |
| 5F | floor | `#2f5266` |
| 5F | wall | `#2a4a5e` |

  Any other entry still under 0.18 gets its lightness raised to 0.18 at the same hue. Set each floor's light as `sky` = the old `ambient`, `ground` = `mix(old ambient, palette.floor, 0.4)` lifted to at least L 0.3, `hemiIntensity` = old `ambientIntensity + 0.4`. Keep `key` and `keyIntensity`. These are starting values: Task 3 tunes them from screenshots.
- [ ] **Step 4:** Run `npx vitest run tests/unit/mallFloors.test.ts tests/unit/mallLayout.test.ts`. Expected: PASS. (`MallScene.tsx` won't typecheck until Task 3; that's expected, so don't run `typecheck` yet.)
- [ ] **Step 5: Commit** with Task 3. These two tasks share one commit because the type change breaks `MallScene.tsx` on its own.

### Task 3: Hemisphere light and lit coves, so no ceiling renders black

**Files:**
- Modify: `src/mall/MallScene.tsx` (lights, ~lines 54-56, 128-133, 150-151)
- Modify: `src/mall/FloorScene.tsx` (`buildMeshes`, glow section)
- Test: `e2e/mall.spec.ts` (new test)

**Interfaces:**
- Consumes: `CHARACTER[f].light.{sky, ground, hemiIntensity}` from Task 2.
- Produces: `inset(ring: readonly P[], d: number): P[]` in `FloorScene.tsx`, which moves each vertex `d` metres toward the ring's inside along its corner bisector (negative = outward); uses `turning`. Task 4 uses it.

- [ ] **Step 1: Write the failing e2e test** `no floor's ceiling renders black` in `e2e/mall.spec.ts`. Enter the mall. For each floor, `goToFloor`, read the lobby pose, and place the visitor with `yaw: lobby.yaw + Math.PI` (facing away from the atrium) and `pitch: 1.1`. Screenshot the canvas only, using the same style string as `each floor looks different`. In the page, compute relative luminance (0.2126 R + 0.7152 G + 0.0722 B, sRGB-linearised) for the top half of the frame, and assert the **25th percentile ≥ 0.06** for each floor, labelled by floor. (The percentile rather than the spec's mean is deliberate: emissive lamp panels would lift a mean over a black ceiling.) Attach each screenshot to the report.
- [ ] **Step 2:** Run `npx playwright test e2e/mall.spec.ts -g "ceiling renders black" --project=desktop --workers=1`. Expected: FAIL on B1, 3F and 5F at least.
- [ ] **Step 3: Replace the mall's ambient light with a hemisphere light.** In `MallScene`, change `<ambientLight>` to `<hemisphereLight ref={hemi} intensity={0} />`. Each frame set `hemi.color` to `light.sky`, `hemi.groundColor` to `light.ground`, and the intensity to `on ? light.hemiIntensity : 0`. Keep the key light as it is.
- [ ] **Step 4: Add coves in `buildMeshes`**, painted `mix(palette.accent, '#ffffff', 0.35)` in `glow`:
  - a wall cove: `glow.band(inset(plan.area, 0.05), top - 0.3, top - 0.15)`;
  - on floors whose ceiling has the atrium cut out (`openAbove && atrium.length`), a flat ring just outside the hole: `glow.flat(inset(atrium, -0.3), top - 0.01, [atrium])`.
- [ ] **Step 5:** Run the Step 2 test again. Expected: PASS. If a floor fails, raise that floor's `hemiIntensity` or `ground` lightness in `floors.ts` and keep its hue. Re-run `npx vitest run tests/unit/mallFloors.test.ts`.
- [ ] **Step 6:** Run `npm run typecheck`, then `npx playwright test e2e/mall.spec.ts -g "each floor looks different" --project=desktop --workers=1`. Expected: both pass, so floors still differ.
- [ ] **Step 7: Commit** (with Task 2's files)

```bash
git add src/mall/floors.ts src/mall/MallScene.tsx src/mall/FloorScene.tsx tests/unit/mallFloors.test.ts e2e/mall.spec.ts
git commit -m "feat: the mall's ceilings are lit: lifted palettes, a hemisphere light and coves on every floor"
```

### Task 4: Light pools, gold trim, glass balustrade, tinted skylight

**Files:**
- Modify: `src/mall/FloorScene.tsx`
- Test: `e2e/budget.spec.ts` (existing mall test, unchanged)

**Interfaces:**
- Consumes: `TRIM` (Task 2), `inset` (Task 3).
- Produces: a fifth mesh per floor, `mall-pools-<floor>`, in `FloorMeshes` as `pools: BufferGeometry`, drawn with `MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, fog: false })`.

- [ ] **Step 1: Add a `fan(centre: P, radius: number, y: number, inner: Color, segments = 12)` method to `Builder`.** It draws triangles from the centre (painted `inner`) to the rim (painted black). With additive blending, black adds nothing, which gives a soft disc. Also add a `fade(a: P, b: P, n: P, depth: number, y: number, near: Color)` method: a quad from edge a-b, painted `near`, to the edge pushed `depth` along `n`, painted black.
- [ ] **Step 2: Build `pools`** at `y0 + 0.01`:
  - every lamp centre the lamp loop already finds: `fan(c, 2.5, ..., key * 0.22)`, where `key` is `new Color(light.key)`;
  - every shopfront: `fade(a, b, n, 2, ..., shopfront * 0.3)`, where `n` is the inward normal the shopfront loop already computes;
  - the centrepiece: the solids whose kind matches the floor's centrepiece (`food-hall` = `table`, `islands` = `island`, `stage` = `stage`, `lounge` = `sofa`, `terrace` = `cafe`, `tickets` = `lane`). Draw one `fan` at those solids' centroid, with radius = the farthest solid point from it + 2, painted `accent * 0.25`, with `segments = 24`.
  - Clamp every `inner` and `near` channel to 0.35 or less, so overlaps never reach white.
- [ ] **Step 3: Trim and glass.**
  - Balustrade rail band (`BALUSTRADE.panel` to `rail`): `TRIM.gold`.
  - Balustrade panel: `mix(TRIM.glass, palette.wall, 0.35)`.
  - Escalator side panels: `TRIM.gold`.
  - Each sign band gets a gold edge: a quad from `SIGN_BAND_TOP - 0.06` to `SIGN_BAND_TOP` at `BAND_PROUD + 0.005`, painted `TRIM.gold`.
  - The 5F skylight glow (`atrium.length && !openAbove` on 5F only): `mix('#ffffff', TRIM.glass, 0.12)`. 4F's laylight stays as it is.
- [ ] **Step 4:** Rebuild, run `npm run shots`, and look at the desktop and mobile `mall-B1`, `mall-2F-back`, `mall-3F` and `mall-5F`. Check that the pools read as soft light, that nothing blows out to white where pools overlap on B1, and that the sign bands keep each floor's accent. Tune only the multipliers named above.
- [ ] **Step 5:** Run `npx playwright test e2e/budget.spec.ts -g "mall" --project=desktop --workers=1`, then the same with `--project=mobile`. Expected: PASS under 200 calls. If a pose fails, merge `pools` into fewer draws by drawing pools only for the floor the visitor is on: set the pools mesh visible only when `f === sim.floor()` in `MallScene`'s frame loop.
- [ ] **Step 6:** Run `npx playwright test e2e/mall.spec.ts -g "ceiling renders black|each floor looks different" --project=desktop --workers=1`. Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add src/mall/FloorScene.tsx src/mall/MallScene.tsx
git commit -m "feat: light pools under the mall's lamps and shopfronts, gold trim and glass balustrades"
```

### Task 5: Walk interface tokens, type, buttons and thumbstick

**Files:**
- Modify: `index.html`, `src/styles.css`, `src/ui/Overlay.tsx`

**Interfaces:**
- Produces: CSS custom properties on `:root`: `--steel`, `--steel-edge`, `--gold`, `--glass`, `--sign-ground` (values from Global Constraints), and `--font-sign: "Atkinson Hyperlegible Next", "Noto Sans TC", system-ui, sans-serif`. Class `.controls.walking` on the controls container whenever `isWalkMode(mode)`. Tasks 6 to 8 use these.

- [ ] **Step 1:** In `index.html`, add a preconnect to `fonts.googleapis.com` and `fonts.gstatic.com`, plus one stylesheet link for `Atkinson+Hyperlegible+Next:wght@400;600` and `Noto+Sans+TC:wght@400;600` with `display=swap`.
- [ ] **Step 2:** Add the tokens. Style `.controls.walking button` as a steel plate: `--steel` background, `--ink` text, 1px `--steel-edge` border, 6px radius, `--font-sign`, at least 44px tall. Style `.street-stick`: ring `rgb(217 214 207 / 0.45)` with a `--steel-edge` border; knob `rgb(29 42 51 / 0.8)`. Every walk control's `:focus-visible` gets a 3px `--glass` outline, offset 2px. `.walk-fade-controls` buttons get the same steel style.
- [ ] **Step 3:** In `Overlay.tsx`, add `walking` to the controls' className when `walking`.
- [ ] **Step 4:** Run `npm run typecheck`, then `npx playwright test e2e/walk.spec.ts --project=desktop --workers=1` and the same with `--project=mobile`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add index.html src/styles.css src/ui/Overlay.tsx
git commit -m "feat: the walk's buttons and thumbstick in steel, set in Atkinson Hyperlegible Next"
```

### Task 6: The floor panel as a lift's button plate

**Files:**
- Modify: `src/mall/FloorPanel.tsx`, `src/content/en.ts`, `src/styles.css` (`.floor-panel` rules)
- Test: `e2e/mall.spec.ts` (existing panel and lift tests)

**Interfaces:**
- Consumes: tokens from Task 5.
- Produces: `en.ui.floorNames: Record<FloorId, string>` = `{ B1: 'Food hall', '1F': 'Lobby', '2F': 'Gallery', '3F': 'Lounge', '4F': 'Terrace', '5F': 'Observatory tickets' }`.

- [ ] **Step 1:** Each row is the existing `<button data-testid="floor-<f>">` holding the floor number, followed by a `<span className="floor-name">` with the name. The button's accessible name is unchanged (the floor number), and the name span is `aria-hidden`. The lift button sits after an `<hr className="floor-rule" />` and starts with a small up-arrow lamp (`<span className="lift-lamp" aria-hidden>▲</span>`).
- [ ] **Step 2: Style the plate**:
  - a `--steel` vertical gradient (top lighter by about 6%), a `--steel-edge` border and a 6px radius;
  - round floor buttons 44px across, with a 1px `--ink` ring and the number at 20px semibold;
  - `[aria-pressed='true']` gets a 2px `--gold` ring and gold number, on a slightly darker steel background;
  - names at 13px regular in `--ink`, left of the button, so the column of buttons stays aligned;
  - `.floor-rule` as a 1px `--steel-edge` line;
  - the lift button as a steel pill with the gold lamp;
  - `.floor-name` set to `display: none` under `max-width: 600px` and under `max-height: 520px`. All other breakpoints stay as they are.
- [ ] **Step 3:** Run `npx playwright test e2e/mall.spec.ts -g "lift|floor panel|panel" --project=desktop --workers=1`, then the same with `--project=mobile`. Expected: PASS. Run `npm run shots` and check the panel on desktop, phone portrait and a 844x390 landscape viewport (add it as a one-off check). Nothing overlaps the top buttons or the thumbstick.
- [ ] **Step 4: Commit**

```bash
git add src/mall/FloorPanel.tsx src/content/en.ts src/styles.css
git commit -m "feat: the mall's floor panel as a lift's button plate, with each floor's name"
```

### Task 7: The walk hint as a wayfinding strip

**Files:**
- Modify: `src/walk/WalkHud.tsx`, `src/content/en.ts`, `src/styles.css` (`.street-hint`)
- Test: `e2e/walk.spec.ts:46` (update the text assertion)

**Interfaces:**
- Produces: `en.ui.walkHint` and `en.ui.mallHint`, each `{ move: { desktop: string; touch: string }; doors?: string; leave: { desktop: string; touch: string } }`. Built from today's strings with the wording unchanged:
  - `move.desktop`: "WASD or arrow keys to walk, drag to look around, Shift to hurry."
  - `move.touch`: "Use the stick to walk and drag to look around."
  - `walkHint.doors`: "The mall's doors are on the south side of the tower."
  - `walkHint.leave`: "Scroll out or press Esc to leave." / "Pinch or tap Back to tour to leave."
  - `mallHint.leave`: "Scroll out or press Esc to go back to the street." / "Pinch or tap Back to the street to leave."
  - Remove the old `walkHintDesktop`, `walkHintTouch`, `mallHintDesktop` and `mallHintTouch`.

- [ ] **Step 1: Update the test** at `e2e/walk.spec.ts:46`. Expect the hint to contain each of `move`, `doors` and `leave` for the device in order, as separate lines: `await expect(hint.locator('span')).toHaveText([...])`.
- [ ] **Step 2:** Run `npx playwright test e2e/walk.spec.ts -g "hint" --project=desktop --workers=1`. Expected: FAIL.
- [ ] **Step 3: Render the lines.** The `<p data-testid="street-hint">` holds one `<span>` per line. The doors line starts with an `aria-hidden` arrow glyph `➜` in `--glass`. Restyle `.street-hint`:
  - position: bottom centre, `bottom: 24px`;
  - look: `--sign-ground` at 92% background, a 2px `--steel-edge` top border, 4px radius, `--font-sign` at 15px;
  - lines as blocks.
  On phones, set `bottom: 168px`, so the strip sits above the 120px thumbstick at `bottom: 24px` with a gap. The fade timing and the `.fading` class stay as they are.
- [ ] **Step 4:** Run the Step 2 test again with `--project=desktop`, then with `--project=mobile`. Expected: PASS. Check the mobile `street-landing` screenshot: the strip clears the stick.
- [ ] **Step 5: Commit**

```bash
git add src/walk/WalkHud.tsx src/content/en.ts src/styles.css e2e/walk.spec.ts
git commit -m "feat: the walk hint as a wayfinding strip, a line each for moving, the mall's doors and leaving"
```

### Task 8: Lift doors for the 89F lift and for floor changes

**Files:**
- Create: `src/walk/doors.ts`
- Modify: `src/walk/Fade.tsx`, `src/mall/MallScene.tsx` (`makeFadeMaterial`), `src/styles.css`
- Test: `e2e/mall.spec.ts` (the existing "lift hands over" test, plus one new assertion)

**Interfaces:**
- Produces: `export const DOORS = { steel: '#D9D6CF', edge: '#A9A59C', seamPx: 2 } as const;` in `src/walk/doors.ts`. Both drawings read from it.
- The `fade()` probe keeps its meaning: 1 when the doors are shut.

**The doors' look (both drawings):** two panels from the screen's left and right edges. When the doors are closed by an amount `t` in 0..1, the left panel covers the screen from the left edge to `t × 50%` of the width, and the right panel mirrors it. Each panel is a vertical gradient from `edge` at the bottom to `steel` at the top. At `t = 1`, a `seamPx` line in `edge` runs down the middle.

- [ ] **Step 1: Write the failing assertions** in `the lift hands over to the damper chapter's stop in tour mode`. Right after clicking `floor-lift`, `await expect(page.getByTestId('lift-doors')).toBeVisible()`. After landing at the stop, `await expect(page.getByTestId('lift-doors')).toHaveCount(0)`. Add the same check to `walking into the south entrance fades into the 1F hall`, where the street-to-mall crossing must show no doors: assert `lift-doors` has count 0 while `walk-fade` is visible.
- [ ] **Step 2:** Run `npx playwright test e2e/mall.spec.ts -g "lift hands over|south entrance fades" --project=desktop --workers=1`. Expected: FAIL on the missing `lift-doors`.
- [ ] **Step 3: DOM doors in `Fade.tsx`.**
  - When a crossing starts, record its kind once in state: `lift` if `crossingTo === 'damper' && place === 'mall'`, otherwise `fade`. Keep the kind until the stage returns to `clear`.
  - For `lift`, render `<div data-testid="lift-doors">` with two panel divs inside `walk-fade`, and drop the black background. Each panel's `transform` moves between off-screen (`translateX(∓100%)`) when the stage is `clear` or `lightening`, and `0` when `darkening` or `black`. Use a `transform` transition of `FADE_MS` and keep the container at opacity 1, so the doors animate instead of fading.
  - Colours come from `DOORS`, set as inline styles.
  - Unmount the doors at `clear`.
  - The loading line and the "Back to the street" button render above the doors, as they do over black today.
- [ ] **Step 4: Shader doors in `MallScene.tsx`.** Replace `makeFadeMaterial` with `makeDoorMaterial()`:
  - opaque, `depthTest: false`, `depthWrite: false`, `fog: false`;
  - uniforms `closed` (= `sim.fade()`), `steel` and `edge` (as `Color` from `DOORS`), and `seam` (the seam's width in clip units, `DOORS.seamPx * 2 / canvas width`, updated each frame from `gl.domElement.width`);
  - pass `position.xy` to the fragment shader as a varying;
  - `discard` outside `x < -1 + closed` and `x > 1 - closed`;
  - colour each panel `mix(edge, steel, (y + 1) / 2)`, and `edge` within `seam` of x = 0 when `closed > 0.999`.
  Keep the mesh name `mall-fade` and its visibility rule.
- [ ] **Step 5:** Run the Step 2 tests again. Expected: PASS. Then run `npx playwright test e2e/mall.spec.ts --project=desktop --workers=1` in full: the floor-change, sign and lift tests all rely on `fade()` and must still pass.
- [ ] **Step 6: Review Focus 1, the turn-back.** Add the test `turning back while the lift doors are shut opens them on the mall`. Click `floor-lift` on 5F, wait for `lift-doors` to be visible, and dispatch `walkExit` through `window.__tour.getState()` the way the existing turn-back tests reach the store. Check how `mall.spec.ts:375` turns back and reuse that route. Expect `lift-doors` to reach count 0 and `walk-fade` to have `visibility: hidden` within 5 s. Run it with `--project=desktop`. If the machine has no route to turn back from a lift crossing (the lift hands over at once when black), note that in the commit message and drop this step. In that case, the doors are already covered by the Step 1 assertion that they are gone at the stop.
- [ ] **Step 7:** Rebuild and screenshot a floor change mid-way (`goTo('3F')`, then wait until `fade() > 0.99`) on desktop and mobile. Check that the doors look the same as the DOM doors, using a frame grabbed during the lift crossing.
- [ ] **Step 8: Commit**

```bash
git add src/walk/doors.ts src/walk/Fade.tsx src/mall/MallScene.tsx src/styles.css e2e/mall.spec.ts
git commit -m "feat: lift doors close and open for the 89F lift and for every floor change"
```

### Task 9: After screenshots and the owner's review

- [ ] **Step 1:** Run `npm test` and `npm run typecheck`. Then run, one at a time with `--workers=1`, first on desktop and then on mobile: `mall.spec.ts`, `walk.spec.ts`, `budget.spec.ts`, `street.spec.ts`. Expected: all pass. Report any failure with its output.
- [ ] **Step 2:** Run `npm run shots`. Put each `screenshots/before/` mall shot beside its new counterpart in a single side-by-side page in the scratchpad, for the owner to judge. The owner judges the look; no task is done on looks until they have.
- [ ] **Step 3:** Push the branch `interior-look` and open a PR against `main`. List in its body the designer's calls the owner was asked to check: the floor names, the lifted values, gold only on trim, solid painted glass, the 25th-percentile 0.06 ceiling threshold, the split hint, and the teal kept outside the walk.

## Not in this plan

The damper room's look (spec section "The damper room") is built in M3. This plan does not touch `DamperChamber.tsx`.
