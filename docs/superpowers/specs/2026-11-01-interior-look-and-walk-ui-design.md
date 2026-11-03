# 101 interior look and walk interface - design

Status: agreed with the owner 2026-11-01, builder-checked. Next step: implementation plan (superpowers:writing-plans).

## Why

The owner finds the inside of 101 "pretty dark and unattractive": the mall above all, and the damper room, where there is "no room for the visitors to actually walk around the damper, it feels like the visitors float adjacent to it".

Screenshots of every mall floor (desktop, 2026-11-01) show why:

- **Light.** Each floor is lit by one directional key from above plus a flat ambient. Ceilings face away from the key, so on B1, 3F and 5F the ceiling renders pure black; only the emissive light panels show. The underside of the atrium opening on 1F is black too.
- **Values.** Several palette entries are near-black: 3F floor `#2f2a24`, 3F wall `#15120f`, 2F wall `#1c1a28`, 2F ceiling `#141220`, B1 ceiling `#2d1d10`, 5F wall `#0e1d27`. 2F seen away from the atrium is a flat purple box.
- **No pools.** Shopfronts do not spill onto the floor and downlights leave no pool under them, so every surface reads as one flat tone.
- **Damper.** The damper stop is still the greybox `DamperChamber`: a grey box, the camera in mid-air at the sphere's height, nothing to stand on.

The walk's interface is also generic (teal pills, a floating hint) and says nothing about where the visitor is. The owner asked for a design pass on it at the same time.

## Goals

1. The mall reads as a bright, upscale interior in daylight hours: no surface in view renders black, and every floor's light has a source the visitor can see (downlights, coves, shopfronts, skylight).
2. Every floor keeps the character agreed in the mall walk design (`2026-10-28-mall-walk-design.md`, "The floors"); moody floors (2F, 3F) stay moody, but through lit pools and coves against mid-dark surfaces, not black.
3. The walk interface (floor panel, walk hint, crossing screens) looks like part of the building's own signage, not a layer floating on top of it.
4. The design for the damper room's look is recorded here so M3 builds it this way (below). Building it stays in M3.

## Anti-goals

- **Floors that look alike** (from the mall walk design, still the owner's worry). Lifting the darks must not wash every floor to the same cream. Each floor's hue family stays its own; only values and light change.
- **Breaking the performance budget.** Mall stays under the existing render budget (`e2e/budget.spec.ts`, under 200 draw calls) on a mid-range phone. No real-time shadows, no extra per-floor point or spot lights.
- **Template UI chrome**: all-caps labels, monospace data labels, one accent colour on near-black panels.

## Non-goals

- Building the damper room (M3, as planned; owner 2026-11-01: wait for M3).
- The tour's chapter captions, Explore / Back buttons outside the walk, hotspots, the opening screen, the no-WebGL fallback. They keep their current look for now; the shared tokens below are written so they can adopt them later.
- New mall geometry or layout, new tenants, rideable escalators.
- The street walk's scene look.

## A. The look inside the building

### Light model (all six floors)

Replace "ambient + one directional" with:

- **A hemisphere light per floor** (sky colour from the ceiling side, ground colour from the floor side), replacing the ambient. Ceilings receive the ground colour bounced up, so they are never black. It is still one light in the scene with per-floor colour and intensity set each frame, as today, so the compiled light count never changes when walking in and out.
- **The directional key stays**, per floor as today, for shape on furniture and people.
- **Painted light pools** in the floor's vertex colours, not real lights:
  - under each ceiling light panel, a soft pool on the floor below it (lighter, warmer toward the centre);
  - in front of each shopfront, a band of the shopfront's colour fading out about 2 m into the walk area;
  - round each floor's centrepiece, a pool in the floor's accent.
  The floor mesh is already vertex-coloured (`FloorScene.tsx` `Builder`), so this is a matter of subdividing the walk-area floor enough to carry the gradients. How finely is the builder's call, within the triangle budget.
- **Cove light** where a ceiling meets a wall or the atrium edge: a thin emissive strip in the `glow` mesh, so ceilings have a lit edge. On 2F and 3F this is the main source of mood.
- **Value floor**: no palette entry darker than about 18% lightness (HSL L), and every ceiling carries a lit cove edge. Ceilings may stay darker than their walls (B1's timber, 2F's dusk): what is ruled out is black, not dark. Hues stay those of the owner's mockup. (Designer's call, 2026-11-01: an earlier "ceiling at least as light as walls" rule contradicted B1's and 2F's character and was dropped.)

### Per-floor palettes (lifted)

The hue of each entry stays; lightness is lifted where it was too dark. Target values (builder may tune by eye from screenshots, keeping hue and the order light-to-dark within a floor):

| Floor | Change |
|---|---|
| B1 | ceiling `#2d1d10` -> warm timber `#6b4a2e` with lit coves; floor `#5a3b22` -> `#7a5233`; pools under the hall's lights |
| 1F | already bright; atrium underside gets cove light; shopfronts warm up from `#8d99a3` toward `#a7aeb3` |
| 2F | Retuned after the owner's review on 2026-11-03 ("still too stressful"): wall `#aaa5b2`, ceiling `#e4e1e8`, floor `#9a95a3`, shopfront `#d9d4de`, accent `#a9a3b8`, a muted dove-mauve in place of `#3a3550` / `#2c2840` / `#4a4466`; spotlit vitrines carry pools |
| 3F | floor `#2f2a24` -> marble-dark `#5a4c3c`, wall `#15120f` -> `#3d3328`, ceiling `#201b16` -> `#4a3e30` with gold coves; gold pools at the lounge |
| 4F | already light; pools at the terrace |
| 5F | wall `#0e1d27` -> `#2a4a5e`, floor `#1f3b4d` -> `#2f5266`; skylight pool over the queue |

### Shared materials across floors

So the building reads as one family without making floors alike:

- **Champagne gold `#C8A44D`** for thin trim only: balustrade caps, escalator side panels, and a thin edge line along the top of each sign band. The sign bands themselves keep each floor's accent, which is a main carrier of floor character. This is also the damper's gold. (Designer's call.)
- **Tower glass `#5E8C86`** (101's blue-green): the balustrade panels are painted this colour mixed toward the floor's wall, opaque, not transparent (no extra draw calls or sorting). The 5F skylight stays a bright, near-white emissive panel with a faint glass tint, so it still reads as the light source. (Designer's call.)

### The damper room (for M3; not built in this work)

M3 builds the damper chamber as the real 89F core, as in `2026-10-30-observatory-walk-design.md`. Its look:

- The visitor (tour camera at the damper stop, and later the observatory walk) stands on the 89F floor ring behind a glass rail and looks across and down into the open core at the sphere.
- The sphere: stacked steel plates in gold (`#C8A44D` family), hung on eight cable pairs, with the hydraulic dampers in a bowl below it.
- Light: up from below and down from above onto the sphere, against dark warm walls `#3A2E25`, so the gold is the brightest thing in the room. Walls never black (the value floor above applies).

## B. The walk interface

Concept: **the interface is the building's own signage.**

### Tokens

| Token | Value | Use |
|---|---|---|
| steel | `#D9D6CF` | panel plates, door panels |
| steel-edge | `#A9A59C` | plate edges, rules |
| ink | `#1D2A33` | text and button outlines (existing `--ink`) |
| gold | `#C8A44D` | "you are here": the current floor's ring, the lift button's lamp |
| glass | `#5E8C86` | focus ring, the wayfinding arrow |
| sign-ground | `#F3F0E8` at 92% | hint strip background |

The teal `--accent` `#1F6F78` goes from the walk interface. Outside the walk it stays until those surfaces get their own pass.

Type: **Atkinson Hyperlegible Next** (Google Fonts) for Latin, **Noto Sans TC** for Chinese, set in sentence case. Scale on a 1.25 ratio from a 16 px base; floor numbers 20 px semibold, floor names 13 px regular. No all-caps, no monospace.

Light and dark: the walk sits over the 3D scene, not over a page background, so the plates carry their own light surface and ink in both colour schemes. Keyboard focus is a 3 px `glass` ring, offset 2 px. Reduced motion: the lift doors (below) become a plain fade.

### Floor panel

A lift's button plate on the right, where the panel is today (same positions and breakpoints as now, including the two-abreast layout on short screens).

- Brushed steel plate (`steel`, a subtle vertical gradient, `steel-edge` border, 6 px radius: a plate, not a pill).
- One row per floor, top to bottom 5F to B1: a round button with the floor number, and beside it the floor's name in plain words: B1 Food hall, 1F Lobby, 2F Gallery, 3F Lounge, 4F Terrace, 5F Observatory tickets. (Names are designer's call; the owner may rename.) On phones the names hide and only the round buttons show.
- The current floor's button has a lit `gold` ring and gold number, as a lift's pressed button.
- "Elevator to 89F" (the owner chose this word over "Lift" on 2026-11-03) sits below a short `steel-edge` rule, as on a real panel, with a small up-arrow lamp, shown on 5F only (as now).
- Behaviour, test ids, aria labels and `aria-pressed` are unchanged.

### Walk hint

A wayfinding strip instead of the floating pill at the top:

- Bottom centre, `sign-ground` with a `steel-edge` top border; on phones it sits above the thumbstick (as now: clear of the stack of buttons).
- The hint's copy is split into separate lines in `en.ts`: how to move; (street only) a `glass` arrow glyph and the line about the mall's doors; how to leave. Wording unchanged. On phones the lines wrap within the strip. (Designer's call.)
- Same timing, fade and test id as today.

### Thumbstick

Ring in `steel` at 45% with a `steel-edge` border; knob in `ink` at 80%. Same size and behaviour.

### Crossings

- **Mall to 89F (the lift):** two `steel` door panels slide shut from the sides, meeting in the middle with a thin `steel-edge` seam, then slide open at the destination. Same duration as today's `FADE_MS` each way. Under reduced motion it is today's fade.
- **Floor changes inside the mall** (owner, 2026-11-01: "make things consistent"): the same lift doors close and reopen, instead of the cut to black. The floor change's black is drawn in the 3D scene today (`MallScene.tsx`, a clip-space quad driven by `sim.fade()`); the doors are drawn there too, by a shader on that same quad, with `sim.fade()` read as how far the doors are closed (1 = shut). The doors look identical to the lift crossing's. Under reduced motion it is today's black fade. The `fade()` probe keeps its meaning (1 when the screen is fully covered); e2e tests that check for a black screen during a floor change are updated to check for the doors' colour instead.
- **Street to mall and back:** today's fade to black, kept.
- **Loading line** ("Loading the mall..."): on the closed screen, in the hint strip's style, with the "Back to the street" button under it, as now.
- All crossing logic in `Fade.tsx` (hand-over, time-outs, turning back) is unchanged; only what is drawn changes.

### Buttons in the walk

"Back to the tour" and "Back to the street" become `steel` plates with `ink` text and a `steel-edge` border, same place and size (44 px minimum touch target).

## How it is checked

- Screenshots of every floor (both looking toward and away from the lobby's default view) and the walk interface, desktop and phone, before and after. The owner judges the look.
- An e2e check that no floor's ceiling renders black, on every floor: from the floor's lobby, look up at a solid stretch of ceiling (not the atrium opening or a light panel; the builder picks a pose per floor) and sample the rendered frame. Pass: mean relative luminance of the sampled area at least 0.06 (well above black, below the moody floors' intended darks). This is the one behaviour the owner named. (Threshold is designer's call, tunable once with before/after screenshots.)
- The existing render budget test for the mall still passes.
- Existing walk and mall e2e tests still pass (test ids and behaviour unchanged).

## Left to the builder

- Exact final colour values within the stated hue and value rules, judged from screenshots.
- How finely to subdivide floors for light pools.
- Hemisphere light intensities per floor.
- Whether the floor-panel names come from `en.ts` (they should, like other UI copy).
