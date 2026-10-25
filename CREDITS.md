# Credits

## Data

- **Terrain:** 2025 edition 20 m grid digital terrain model (DTM) for Taiwan, Ministry of the Interior (內政部), [data.gov.tw/dataset/176927](https://data.gov.tw/dataset/176927). Released under the [Open Government Data License, version 1](https://data.gov.tw/license). Baked into `src/scene/terrain/taipei-dtm.bin` by `scripts/bake-terrain.ts`, which averages the 20 m points onto a 200 m grid.
- **Taipei 101 site and tower footprint:** © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). The complex outline (way 1159328965), tower footprint (way 198637969, used to place and orient the tower) and mall height (way 64566862) are in `src/scene/tower/podium.ts`.
- **Xinyi street walk:** buildings, building parts, roads, footways, crossings, skybridges, trees and lamps around Taipei 101, © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Baked by `scripts/bake-xinyi.ts` into `src/street/xinyi.json`; that derived database is available under the ODbL in this repository.
