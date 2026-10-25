# Xinyi Street Walk - Design

Drafted 2026-10-25. Builds on `docs/spec.md` (v1 tour) and the real terrain from M2.

## Intent

The tour shows Taipei from above. The owner's more ambitious goal is to also let the visitor **be a person in the city**: keep zooming in while exploring, and instead of stopping at a minimum distance, drop to street level and walk around the blocks at the foot of Taipei 101 in Xinyi District.

The point is to soak it in, not to complete anything. The visitor wanders freely, looks up at 101 towering overhead, passes the department stores and the cinema, sees other people around them, and zooms back out when they're done.

## Decided by the owner

- **Entry:** reaching the maximum zoom-in level while exploring takes the visitor to street level. (Owner: "act like a person when they walk through Taipei city while reaching the max zoom-in level.")
- **Where:** Xinyi, around Taipei 101.
- **How:** free wandering. No route, no destination, no goals.
- **What makes it Taipei:** Taipei 101 from the ground, the shopping malls, and the movie theatre.
- **Accepted from Claude's playback** (the owner confirmed "your guess is OK"):
  - The walkable area is a few blocks around 101's base, not the whole district.
  - The landmarks are Taipei 101 with its podium mall, Shin Kong Mitsukoshi's Xinyi stores along Songshou Road with their skybridges, and Vieshow Cinemas Xinyi.
  - The surrounding buildings come from real footprint and height data, simplified to the low-poly style.
  - Other pedestrians walk around the visitor, and scooters may move on the roads.
  - The skybridges are scenery, not walkable.
  - Flat low-poly style, matching the rest of the site.

## Goals

1. A continuous "zoom in, land on the street" transition from the tower chapter's explore mode, and a matching "zoom out, rise back to the tour" transition.
2. A walkable area of roughly 700 m x 700 m centred on Taipei 101. Its edges are the main roads around the Xinyi special district: Keelung Road (west), Songren Road (east), Xinyi Road (north) and Songzhi Road / the 101 south side (south). The visitor cannot walk out of it.
3. The three landmarks are recognisable on sight from street level, by shape, massing, colour and distinctive features, without brand logos.
4. Every other building in the area stands where it really is, with roughly its real footprint and height.
5. The street feels alive: people walk on the sidewalks and plazas, and some scooters move along the roads.
6. Works on desktop (keyboard and mouse) and phones (touch).

## Non-goals (this design)

- Entering buildings. Mall, cinema and tower interiors are out; every landmark is exterior only. *(Claude's call; the owner didn't answer whether they want interiors. Revisit after the first version.)*
- Quests, scores, collectables or a minimap.
- Talking to, clicking or bumping into the virtual people beyond not walking through them.
- Districts beyond Xinyi; streets beyond the walkable square.
- Photorealism, real shop signage, or brand logos. Consistent with `docs/spec.md` ("no Taipei 101 logo or brand marks").
- Its own time of day. The street uses the lighting of the chapter it was entered from.
- Multiplayer.

## Anti-goals (failure even if it technically works)

- **Motion sickness:** fast camera swings, head bob, or a jerky drop into the street.
- **Generic city:** if it could be any downtown, it failed. The landmarks and 101 overhead carry the identity.
- **Breaking the tour:** scrolling, explore, Escape and Back must keep working exactly as now, and a visitor who never zooms all the way in must never notice the feature exists.
- **Blowing the budget:** the street scene must not slow the first load of chapter 1 or drop the baseline phone below 30 fps.

## Experience

### Getting in

- In the **tower chapter's** explore mode, zooming in (mouse wheel, trackpad pinch, or two-finger pinch on touch) past the current minimum distance starts the descent. *(Claude's call: the tower chapter is already orbiting 101 near the ground. Basin explore stays as it is.)*
- The camera eases down over about 1.5 s to eye height (1.6 m) at a fixed landing spot on the plaza in front of 101, facing the tower. During the descent the view tilts gently from looking down to looking ahead. No cut, no loading screen; if the street assets aren't loaded yet, the descent waits at the start with a subtle indicator.
- A **Walk the street** button sits next to **Back to tour** in the tower chapter's explore mode and does the same descent, for visitors without a wheel or pinch and so the feature can be found at all. *(Claude's call.)*
- A one-line hint appears on landing showing the walk controls for the current device, and fades after a few seconds or on first movement.

### Walking

- **Desktop:** WASD or the arrow keys move; dragging with the left mouse button looks around. Moderate walking pace (about 1.4 m/s), with a held Shift for about 2x. No pointer lock, so the page never traps the mouse.
- **Touch:** a virtual thumbstick in the lower-left corner moves; dragging anywhere else looks around.
- The visitor can't pass through buildings or out of the walkable square; they slide along walls rather than stopping dead.
- Ground follows the terrain, which is flat enough here that this is mostly cosmetic.
- Scrolling the page is frozen while walking, like explore mode does now.
- No hotspots at street level in this version; an open hotspot panel closes on descent. *(Claude's call.)*
- No street-specific audio in this version; the site's audio toggle and chapter ambience behave as they do today. *(Claude's call.)*

### Getting out

- Zooming out (wheel, pinch out), the **Back to tour** button, or Escape: the camera rises back up over about 1.5 s to the tower chapter's stop pose, then normal tour control resumes. Escape closes an open hotspot panel first, as it does today.

### What's around

- **Taipei 101 from the ground:** the eight flared segments, slanted blue-green glass, the ruyi ornaments, and the podium mall at its base, at street-level detail. This is the same procedural tower M2 plans, built to hold up when seen from 1.6 m; the far views reuse a lower-detail version of it.
- **Shin Kong Mitsukoshi Xinyi:** the row of department store buildings along Songshou Road (A11, A9, A8, A4), linked by the elevated skybridges, with their real massing.
- **Vieshow Cinemas Xinyi:** the cinema complex, with its real massing and big screen-side facade.
- **Everything else:** real footprints and heights, extruded and flat-shaded, with simple window banding so towers read as towers.
- **Streets:** roads, sidewalks, crosswalks and plazas, at least where they're real. Street furniture (trees, lamps, benches) can come from CC0 low-poly packs.
- **People:** about 60-120 low-poly pedestrians at a time, walking along sidewalks and across plazas, some standing. Simple walk cycles, varied clothing colours.
- **Scooters:** a few on the roads, in traffic directions that match reality. Optional if they cost too much.

## Constraints

- Everything from `docs/spec.md` still holds: static site, no backend, flat low-poly style, all strings in the content dictionaries, e2e-first testing, performance budgets.
- **Loading:** the street scene is a lazy-loaded chunk fetched only when the visitor enters the tower chapter's explore mode, never on first load. Target under 1.5 MB gzipped for the whole street scene, including building data.
- **Performance at street level:** the same budgets as the rest of the site (under 200 draw calls, under 300k triangles on screen, 30+ fps on the baseline phone). Pedestrians and repeated props are instanced.
- **Data licensing:** every data source must allow redistribution in a public website and gets credited on the page and in `CREDITS.md`, like the terrain.
- **Reduced motion and no-WebGL:** the street walk isn't offered; the static fallback in `docs/spec.md` is unchanged.

## Building data (first task for the builder)

The walk needs real footprints and heights for the walkable square. Two candidates came out of earlier research; pick one, or combine them, in a short spike before building the scene:

| Source | Strengths | Open questions |
|---|---|---|
| NLSC national 3D building models, from 3dmaps.nlsc.gov.tw: KMZ / 3D Tiles / I3S, small areas by online request | Official, has heights for every building, nationwide | **License terms not yet confirmed.** Delivery is by email request. |
| OpenStreetMap (ODbL) | Easy to fetch via Overpass; footprints usually good | Heights are often missing (only `building:levels` or nothing). ODbL needs attribution and share-alike for the derived database. Coverage of Xinyi not yet checked (Overpass was overloaded on 2026-10-25). |

Whichever wins is baked at build time into a compact file under `src/`, like `taipei-dtm.bin`, by a script under `scripts/`, with raw downloads cached in `.cache/`.

## Testing

E2e first, as with the rest of the site:

- Zooming in at the tower stop's minimum distance lands at street level (eye height, landing spot).
- Keys move the visitor; they can't pass through a building wall or leave the walkable square.
- Zoom out, Back and Escape each return to the tower stop pose and then normal scrolling.
- The tour, explore, hotspots and scroll suites still pass unchanged.
- Touch: the thumbstick moves the visitor; a drag elsewhere turns the view.
- The street chunk isn't requested on first load.

## Left to the builder

- How street mode fits the tour state machine (`src/tour/machine.ts`), e.g. descending, walking and ascending modes alongside `explore` and `returning`.

- Exact walkable boundary polygon (within the roads named above).
- Landing spot and facing, within "the plaza in front of 101, facing the tower".
- Pedestrian behaviour model (sidewalk graphs, random walks, flow fields), as long as people stay on walkable surfaces and don't walk through each other or the visitor.
- Level of detail and how the existing basin city blocks give way to real buildings near the tower.
- Collision approach (2D footprint polygons are expected to be enough).
- Asset sources for street furniture and characters, within CC0.

## Scheduling

- **Owner's decision (2026-10-25):** finish M2 first (procedural Taipei 101, city, morning/afternoon lighting), then build the street walk as its own milestone before M3. It depends on M2's tower holding up at street level.
