# Taipei 101 Scroll Tour - Spec (v1)

Decided 2026-10-24.

## What it is

A static website: a scroll-driven 3D tour of Taipei centered on Taipei 101. No backend and no persisted state in v1. Bilingual (English default, Traditional Chinese toggle).

## Experience

### Camera model (hybrid "tour + explore")

- Page scroll drives the camera along a guided path through 4 chapters.
- Each chapter has a **travel** segment (camera moving to the chapter) and a **stop** segment (camera parked at the chapter's pose).
- At a stop, the visitor can **explore**: bounded orbit and zoom around the stop's target. Bounds are per chapter (distance range, azimuth range around the stop's azimuth, polar range).
- Entering explore: dragging the canvas with a mouse at a stop, or pressing the "Explore" button (works on any device and is the path for touch devices).
- Leaving explore: the "Back to tour" button, Escape, or scrolling out of the stop. The camera then smoothly blends back to the path pose (about 600 ms, ease-in-out) before scroll control resumes.
- On touch devices outside explore mode, a one-finger vertical swipe anywhere (including over the canvas) scrolls the page.

### Chapters

| # | id | Content | Explore |
|---|---|---|---|
| 1 | `basin` | Wide shot of the Taipei basin ringed by mountains, 101 rising from a low-poly city | Gentle orbit around the city |
| 2 | `tower` | Climb the tower exterior | Orbit the tower; hotspots on design story (8 segments, bamboo/pagoda form, ruyi motifs) |
| 3 | `damper` | Inside the tuned mass damper chamber (floors 87-92); 660 t gold sphere, 5.5 m diameter | Orbit inside the room; drag/click to swing the damper (M3) |
| 4 | `view` | Observatory looking out; dusk turns to night, city lights and 101's nightly lighting (M4) | Look around from a fixed spot |

### Interaction

- Ambient: scene reacts to scroll and pointer (subtle parallax).
- Direct: 3-5 clickable hotspots per chapter across v1 (one placeholder each in M1). Each hotspot opens a panel with a heading and about 40 words. Escape or a close button closes it.

## Visuals and assets

- Flat low-poly, flat-shaded, gradient skies. Palette anchors: 101 blue-green glass, hazy mountain greens, damper gold.
- Time-of-day arc: ch1 morning haze, ch2 golden afternoon, ch3 warm gold interior, ch4 dusk to night with bloom.
- All assets built in code: procedural Taipei 101, mountains from a real elevation model of the Taipei basin, instanced city blocks, CC0 low-poly packs for small props. No Taipei 101 logo or brand marks.
- World scale: 1 unit = 1 m. Taipei 101 at the origin; roof at 449 m, spire top at 508 m.

## Tech

- Vite + React + TypeScript, React Three Fiber v9 + drei v10, drei `CameraControls` for explore. Hotspots are plain DOM buttons positioned each frame by projecting their world point (drei `Html` failed to render on first mount).
- Damper swing: hand-written damped spring, no physics engine.
- `@react-three/postprocessing` for bloom in ch4 only.
- State: zustand store wrapping a pure reducer (`tourReducer`).
- **Change from the grilling session:** Theatre.js is dropped. `@theatre/r3f` 0.7.2 (last release May 2024) requires R3F v8 and is incompatible with drei v10 / R3F v9. Camera poses live in a typed data file instead, authored with an in-app capture tool: with `?debug` in the URL, pressing `P` logs the current camera pose as JSON for pasting into the data file.

## Performance

- Adaptive quality tiers via drei `PerformanceMonitor` (pixel ratio, shadows, bloom).
- Baseline device: about a 3-year-old mid-range phone (iPhone 12 class). Targets: 60 fps desktop, 30+ fps baseline phone.
- Budgets: under 200 draw calls, under 300k triangles on screen, under 3 MB gzipped before chapter 1 is interactive; later chapters lazy-loaded.
- Fallback: without WebGL, or with `prefers-reduced-motion`, show a static illustrated page per chapter with the same text and no scroll-driven camera.

## Content

- All strings in dictionaries (`src/content/en.ts`, `src/content/zh-Hant.ts`), never hardcoded in components.
- Chapter: title plus 1-2 sentences. Hotspot: heading plus about 40 words.
- Every fact carries a source in the content file. The owner reviews the Chinese copy.
- Noto Sans TC, subset to the characters used.

## Audio

- Off by default; a visible sound toggle.
- Per-chapter ambient loops (100-200 KB each, lazy-loaded, crossfaded on scroll) from CC0 sources, credited in `CREDITS.md`.
- Interaction sounds synthesized with Web Audio. No music.

## Delivery

- GitHub repo; `main` is always deployable. Vercel with preview deploys per branch/PR.
- GitHub Actions: typecheck, build, Playwright e2e on every push; failure blocks deploy.
- Testing leans end to end: Playwright drives real scrolling, dragging and clicks against a production build, reading state from a test hook (`window.__tour`) enabled only in the e2e build. Unit tests only for pure math.

## Milestones

1. **M1 greybox:** all 4 chapters as grey shapes, scroll camera, explore handoff, one placeholder hotspot per chapter, deployed, e2e suite. Done when the whole tour works on the owner's phone without jank.
2. **M2 city and tower:** real-terrain mountains, instanced city, procedural 101, morning/afternoon lighting.
3. **M3 damper:** chamber interior, spring-driven swing, gold lighting.
4. **M4 view:** dusk-to-night, city lights, 101 nightly colors, bloom.
5. **M5 polish:** bilingual content with sources, audio, fallback, quality tiers, performance pass.

v1 is done when M5 meets the performance budgets on a real mid-range phone and the owner has signed off on the Chinese copy.
