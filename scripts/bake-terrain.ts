/**
 * Bakes the Ministry of the Interior 20 m DTM (2025 edition) into the low-poly grid the basin renders.
 *
 *   npm run bake:terrain
 *
 * Downloads the per-county archives into .cache/dtm (once), box-filters every 20 m point that falls inside
 * the grid into its nearest grid cell, and writes src/scene/terrain/taipei-dtm.bin. Cells with no data are
 * open sea and get height 0. Source index: https://data.gov.tw/dataset/176927 (Open Government Data License v1).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { GRID, GRID_COUNT, TAIPEI_101 } from '../src/scene/terrain/grid.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'dtm');
const OUT = join(ROOT, 'src', 'scene', 'terrain', 'taipei-dtm.bin');

const PRODUCT = 'https://www.tgos.tw/MDE/VirtualDir_TC/Product';
// Every county the grid touches: Taipei, New Taipei, Keelung (north-east), Taoyuan (west), Yilan (south-east corner).
const SOURCES = [
  { id: 'taipei', path: '60e634ea-7c59-47a4-a967-ac33694e0d05/分幅_臺北市20MDEM(2025).zip' },
  { id: 'new-taipei', path: '9574dbb5-ca32-4ea3-aaf7-a9f582b9357b/分幅_新北市20MDEM(2025).zip' },
  { id: 'keelung', path: '2313548d-ccaa-4539-81a3-13f5a0e94dbd/分幅_基隆市20MDEM(2025).zip' },
  { id: 'taoyuan', path: 'ba0fcc26-f82e-4345-bfc4-4785574d9014/分幅_桃園市20MDEM(2025).zip' },
  { id: 'yilan', path: 'fd54d8f2-ad3b-4afe-b30d-cf86ad845cae/分幅_宜蘭縣20MDEM(2025).zip' },
];

async function fetchArchive(id: string, path: string) {
  const file = join(CACHE, `${id}.zip`);
  if (!existsSync(file)) {
    console.log(`downloading ${id}`);
    const res = await fetch(encodeURI(`${PRODUCT}/${path}`));
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(file);
}

const west = TAIPEI_101.e - GRID.half;
const north = TAIPEI_101.n + GRID.half;
const sum = new Float64Array(GRID_COUNT * GRID_COUNT);
const count = new Uint32Array(GRID_COUNT * GRID_COUNT);

/** Adds one sheet's "E N H" lines to the grid cells they fall in. */
function accumulate(text: string) {
  let used = 0;
  for (const line of text.split('\n')) {
    const [e, n, h] = line.trim().split(/\s+/).map(Number);
    if (!Number.isFinite(h)) continue;
    const i = Math.round((e - west) / GRID.spacing);
    const j = Math.round((north - n) / GRID.spacing);
    if (i < 0 || j < 0 || i >= GRID_COUNT || j >= GRID_COUNT) continue;
    sum[j * GRID_COUNT + i] += h;
    count[j * GRID_COUNT + i]++;
    used++;
  }
  return used;
}

mkdirSync(CACHE, { recursive: true });
for (const { id, path } of SOURCES) {
  const files = unzipSync(await fetchArchive(id, path), { filter: (f) => f.name.endsWith('.grd') });
  let used = 0;
  for (const data of Object.values(files)) used += accumulate(new TextDecoder().decode(data));
  console.log(`${id}: ${Object.keys(files).length} sheets, ${used} points inside the grid`);
}

const out = new Uint16Array(GRID_COUNT * GRID_COUNT);
let empty = 0;
for (let k = 0; k < out.length; k++) {
  if (count[k] === 0) empty++;
  // Below-sea-level points (river beds, reclaimed land) clamp to 0.
  out[k] = count[k] ? Math.round(Math.max(sum[k] / count[k], 0) * 10) : 0;
}
writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${GRID_COUNT}x${GRID_COUNT}, ${empty} cells without data (sea)`);
