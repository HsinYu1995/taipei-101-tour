# 101 mall walk - design

Status: agreed with the owner 2026-10-28, builder-checked. Next step: implementation plan (superpowers:writing-plans).

## Why

The street walk ends at 101's walls. The owner wants visitors to walk on into the 101 shopping mall and ride between its floors, each floor looking like the real one: an upscale mall with restaurants, cafes and luxury shops. "Close enough" is fine: real shops on the right floors, a believable layout, not a survey.

## Goals

- Walk in from the street walk through 101's entrance and walk around the mall floors B1, 1F, 2F, 3F, 4F and 5F at eye level, with the same controls as the street.
- Each floor carries its real tenants (official list, below) and its own character. The owner's picture: each floor is a large lounge with a cafe or small stage in the middle.
- An on-screen floor panel moves the visitor between floors, and its Damper button hands over to the existing damper chapter.

## Anti-goals

- **Floors that look alike.** The owner's one named worry. Each floor must be recognisable at a glance from its centrepiece, light, materials and how busy it is.
- **Copied brand logos.** Brand names are fine; logo artwork and monograms are not.

## Non-goals

- Going inside shops; anything to do on a floor beyond walking and looking (the owner will add features later, together with the exterior).
- A walk-in elevator car with buttons, and rideable escalators (later, maybe).
- 6F (only a gym), the office floors, a walkable damper floor.
- Exact shop positions or a surveyed floor plan (none is public: no official plans, no OSM indoor data).

## The floors

Mall floors share one real shape: shops round the edge of the podium's real outline, curved balcony galleries round a central atrium open through 1F to 4F, escalators crossing the void (reference: the official 3F floor banner photo). B1 has no atrium (low ceiling); 5F sits at the top of the atrium under a skylight.

**Escalators are scenery (owner, 2026-10-28):** drawn, maybe animated, but not walkable; the floor panel is the only way between floors. Each floor is a flat walk area like the street. Rideable escalators may come later.

**The atrium shows the other floors (owner, 2026-10-28):** from a gallery the visitor sees the floors above and below across the void, with their shopfronts and shoppers. Other floors are drawn at lower detail so the whole mall in view stays within the performance budget, and each floor's character must read from across the atrium too.

Characters, as agreed on the owner's mockup (`.superpowers/brainstorm/1344-1793181136/content/floor-characters-v2.html`):

| Floor | Centrepiece | Mood | Crowd | Real tenants (examples) |
|---|---|---|---|---|
| B1 | food hall, long shared tables, people seated eating | warm, busy, loud | packed | 33-stall food court, Din Tai Fung, Starbucks, souvenirs, Nike, Lululemon, Aesop |
| 1F | arrival lobby, beauty counters as islands | bright daylight | moderate | Rolex, Omega, IWC, Chanel Beauty, Dior Beauty, Jo Malone, Apple Taipei 101 |
| 2F | small exhibition stage at the atrium edge | dim, spotlit vitrines, hushed | nearly empty | Patek Philippe, Harry Winston, Tiffany, Vacheron Constantin, Issey Miyake |
| 3F | seating lounge, sofas and planters by the atrium rail | warm gold, marble, quiet | light | Cartier, Van Cleef & Arpels, Chopard, Fendi, Celine, Bottega Veneta |
| 4F | cafe terrace with tables over the atrium, people seated | pastel, chatter | moderate | Louis Vuitton, Dior, Gucci, Burberry, Ladurée, Cova, Chuyu |
| 5F | observatory ticket hall, queue lines | cool blue, skylight | moderate, queuing | observatory ticketing, Fujin Tree, ABC Cooking Studio |

Crowd levels are relative; the builder sets numbers within the performance budget.

## Shops and signs

- **Source:** the official site's data feed, `https://ws.taipei-101.com.tw/api/v1/shopping/floor/detail/brands?lang=en&floor=FLOOR_<B1|1F..5F>` (shops, with a category such as watch, boutique, cosmetic, apparel) and `https://ws.taipei-101.com.tw/api/v1/food/search?lang=en` (restaurants, with floor and category). Baked into the app by a script, like `scripts/bake-xinyi.ts`, as a dated snapshot. The app never fetches it at runtime.
- **Signs:** each shopfront shows the brand name in lettering that echoes the brand (typeface feel, colour), never the logo. Names stay in Latin script in both English and zh-Hant, as in the real mall.
- **Placement:** every tenant gets a shopfront on its real floor; positions are the builder's (believable: flagships on the long frontages, food court stalls round B1).
- **Cleaning the feed (designer's call):** one shopfront per listing per floor, so a brand listed on several floors (Cartier on 3F, 4F and 5F; Tiffany on 2F and 3F) has a front on each, as in the real mall. Non-shop listings that are real frontages (Taipei Fubon Bank on 1F) stay; anything without a frontage is dropped. Restaurants on floors outside B1-5F (the 35F and 85F-89F sky dining) are dropped. The 5F observatory ticket hall is not in the feed and is added by hand.

## Moving around

- **In:** during the street walk, walking through 101's south entrance (the podium wall facing Xinyi Rd, around x 0, z 42.8) fades the visitor into the 1F arrival lobby. A walk area edge, wall or crowd elsewhere is unchanged.
- **On a floor:** the street's controls exactly: keys / thumbstick to walk, drag to look, Shift to hurry. Walls, shopfronts, counters, tables and balustrades block like buildings do on the street. The atrium void cannot be walked into.
- **Floor panel:** always on screen while in the mall. Buttons B1, 1F, 2F, 3F, 4F, 5F, Damper; the current floor is marked. A floor button glides the visitor to that floor's elevator lobby in about a second. Damper leaves the walk and lands the visitor at the existing damper chapter's stop.
- **Damper handover (designer's call):** a short fade to black, then the page is at the damper chapter's stop in ordinary tour mode, with the walk ended. Getting back to the mall means walking in from the street again. This is the walk's third kind of exit (the others return to the street, and from the street to the tower stop).
- **Out:** Escape or zooming out (the street's own exits) returns the visitor to the street just outside the south entrance, facing out. Leaving the street then works as today.
- **Shoppers:** a crowd per floor walks the galleries as the street crowd walks the footways (yields to the visitor, stands about); seated people at B1 tables and the 4F cafe.

## Groundwork: one walk, two places

The street walk's lifecycle is hard-coded as "street" in about a dozen files (`tour/machine.ts` modes and events, `tour/store.ts`, `CameraRig`, `World`, `street/api.ts`, `gestures.ts`, `StreetHud`, `Overlay`, `HotspotButton`, `StreetErrorBoundary`, ...). Step one is to make that a general **walk**: one lifecycle (enter, walking, leave) and one set of controls, HUD and gestures, with the street and the mall as two **places** that plug into it. Each place supplies its own simulation (the street's is `StreetSimulation`; the mall gets its own with the same shape: `step`/`tick`, eye pose, landing pose, people for the renderer), its scene, and where its exits lead. The street must behave exactly as it does today after this step; its existing tests prove that.

Step two builds the mall on that.

## Constraints

- Performance (project plan): mid-range phone baseline, about 200 draw calls and 300k triangles in view; the mall loads lazily, the first time the visitor walks in, like the street; it is not in the initial download.
- Assets are all code (no Blender): procedural geometry, instancing, CC0 props at most.
- Flat low-poly style, matching the street.
- Reduced motion: the walk is not offered, as today; the mall therefore isn't either.
- Bilingual UI copy (EN default, zh-Hant; the owner reviews Chinese).
- Tests: behaviour in fast module tests on real data (the mall simulation like `tests/unit/streetSimulation.test.ts`); e2e only for wiring a browser alone can show (walking in, the floor panel, Damper handover, leaving). Keep CI e2e shards well under 20 minutes.
- Domain words: visitor, crowd, walk, place, floor, floor panel (added to `CONTEXT.md`).

## Left to the builder

Exact geometry and floor heights; where each shop sits; sign lettering per brand; crowd numbers per floor; the fade and glide timings beyond "about a second"; how the walk/place split is typed and named in code; what lighting technique gives each floor its mood; the snapshot date and how the bake script maps categories.
