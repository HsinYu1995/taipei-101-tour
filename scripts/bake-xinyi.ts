/**
 * Bakes the streets around Taipei 101 from OpenStreetMap (© OpenStreetMap contributors, ODbL) into the
 * compact file the street walk renders.
 *
 *   npm run bake:xinyi
 *
 * Downloads the map data for the Xinyi bbox into .cache/osm (once, as two tiles), projects it to world x/z
 * (TWD97 metres relative to the 101 tower centroid; east +x, north -z), simplifies and classifies it, and
 * writes src/street/xinyi.json. The output is a derived database and is published under the ODbL.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Color } from 'three';
import { toTwd97 } from '../src/geo/twd97.ts';
import { TAIPEI_101 } from '../src/scene/terrain/grid.ts';
import { PODIUM } from '../src/scene/tower/podium.ts';
import { SCENE_AREA } from '../src/street/areas.ts';
import type { Area, BuildingShape, LandmarkId, P, Rect, Road, XinyiData } from '../src/street/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'osm');
const OUT = join(ROOT, 'src', 'street', 'xinyi.json');

/** West, south, east, north. Fetched as two tiles split at SPLIT_LAT to stay under the API's node limit. */
const BBOX: [number, number, number, number] = [121.559, 25.03, 121.571, 25.0412];
const SPLIT_LAT = 25.0356;
const API = 'https://api.openstreetmap.org/api/0.6/map.json';
const USER_AGENT = 'taipei-101-tour/0.1 (build script)';

const LEVEL = 3.5;
const DEFAULT_LEVELS: Record<string, number> = {
  house: 2,
  residential: 4,
  apartments: 8,
  commercial: 6,
  office: 8,
  retail: 3,
  school: 4,
  roof: 1,
};
const LANDMARKS: Record<string, LandmarkId> = {
  r18356791: 'vieshow',
  w274647897: 'skm-a4',
  w274647896: 'skm-a8',
  w269773067: 'skm-a9',
  w391309615: 'skm-a11',
};
const ROAD_KINDS: Record<string, Road['kind']> = {
  trunk: 'major',
  trunk_link: 'major',
  primary: 'major',
  secondary: 'major',
  tertiary: 'minor',
  unclassified: 'minor',
  residential: 'minor',
  busway: 'minor',
  service: 'service',
};
const ROAD_WIDTH: Record<Road['kind'], number> = { major: 10, minor: 8, service: 4.5 };
const FOOTWAYS = new Set(['footway', 'pedestrian', 'path', 'living_street']);
/** Keep lines that run out of the scene up to this far beyond it. */
const LINE_PAD = 50;

type Tags = Record<string, string>;
interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Tags }
interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Tags }
interface OsmRelation { type: 'relation'; id: number; members: { type: string; ref: number; role: string }[]; tags?: Tags }
type OsmElement = OsmNode | OsmWay | OsmRelation;

async function fetchTile(name: string, bbox: [number, number, number, number]): Promise<{ elements: OsmElement[]; timestamp?: string }> {
  const file = join(CACHE, `xinyi-${name}.json`);
  if (!existsSync(file)) {
    console.log(`downloading tile ${name}`);
    const res = await fetch(`${API}?bbox=${bbox.join(',')}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`tile ${name}: HTTP ${res.status} ${await res.text()}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const round = (v: number) => Math.round(v * 10) / 10;

function project(lat: number, lon: number): P {
  const { e, n } = toTwd97(lat, lon);
  return [round(e - TAIPEI_101.e), round(-(n - TAIPEI_101.n))];
}

const inRect = ([x, z]: P, r: Rect, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

function inside([x, z]: P, poly: P[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

const centroid = (pts: P[]): P => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** Twice the signed area in (x, z); positive is counter-clockwise in the sense of the tower's `footprint`. */
const signedArea = (ring: P[]) => ring.reduce((s, [ax, az], i) => {
  const [bx, bz] = ring[(i + 1) % ring.length];
  return s + ax * bz - bx * az;
}, 0);

function distanceToSegment([x, z]: P, [ax, az]: P, [bx, bz]: P) {
  const len2 = (bx - ax) ** 2 + (bz - az) ** 2;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len2));
  return Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az)));
}

/** Douglas-Peucker on an open polyline. */
function simplify(points: P[], tolerance: number): P[] {
  if (points.length < 3) return points;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], points[0], points[points.length - 1]);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

/** Closed ring (first == last allowed) to a simplified, counter-clockwise ring without the closing point; null if degenerate. */
function cleanRing(points: P[], tolerance: number): P[] | null {
  const open = points.length > 1 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1] ? points.slice(0, -1) : points;
  if (open.length < 3) return null;
  // Simplify as a loop: split at the point farthest from the first so both halves keep their shape.
  let far = 1;
  for (let i = 1; i < open.length; i++) {
    if (Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]) > Math.hypot(open[far][0] - open[0][0], open[far][1] - open[0][1])) far = i;
  }
  const a = simplify(open.slice(0, far + 1), tolerance);
  const b = simplify([...open.slice(far), open[0]], tolerance);
  const ring = [...a.slice(0, -1), ...b.slice(0, -1)];
  if (ring.length < 3 || Math.abs(signedArea(ring)) < 1) return null;
  return signedArea(ring) > 0 ? ring : ring.reverse();
}

/** Splits a line into the runs of consecutive points within the scene (padded), then simplifies each. */
function clipLine(points: P[], tolerance: number): P[][] {
  const runs: P[][] = [];
  let run: P[] = [];
  for (const p of points) {
    if (inRect(p, SCENE_AREA, LINE_PAD)) run.push(p);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length >= 2).map((r) => simplify(r, tolerance));
}

/** Joins way node lists into closed rings by shared end nodes. */
function joinRings(lists: number[][]): number[][] {
  const pending = lists.map((l) => [...l]);
  const rings: number[][] = [];
  while (pending.length) {
    const ring = pending.shift()!;
    let grew = true;
    while (ring[0] !== ring.at(-1) && grew) {
      grew = false;
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i];
        const end = ring.at(-1);
        if (w[0] === end) ring.push(...w.slice(1));
        else if (w.at(-1) === end) ring.push(...w.slice(0, -1).reverse());
        else continue;
        pending.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring[0] === ring.at(-1)) rings.push(ring);
  }
  return rings;
}

const num = (v: string | undefined) => {
  const n = v === undefined ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

function parseColour(tags: Tags): string | undefined {
  const raw = (tags['building:colour'] ?? tags.colour)?.trim().toLowerCase();
  if (!raw) return undefined;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(raw) && !(raw in Color.NAMES)) return undefined;
  return `#${new Color(raw).getHexString()}`;
}

function heights(tags: Tags, isPart: boolean) {
  const levels = num(tags['building:levels']) ?? (isPart ? 1 : (DEFAULT_LEVELS[tags.building] ?? 4));
  const height = num(tags.height) ?? levels * LEVEL;
  let base = num(tags.min_height) ?? (num(tags['building:min_level']) ?? 0) * LEVEL;
  const roof = tags.building === 'roof' || tags['building:part'] === 'roof';
  if (roof) base = Math.max(base, height - 0.5);
  return { base: round(Math.max(0, base)), height: round(Math.max(height, base + 0.5)), roof };
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const [west, south, east, north] = BBOX;
  const tiles = [await fetchTile('s', [west, south, east, SPLIT_LAT]), await fetchTile('n', [west, SPLIT_LAT, east, north])];
  const elements = new Map<string, OsmElement>();
  for (const t of tiles) for (const e of t.elements) elements.set(`${e.type}${e.id}`, e);

  const nodes = new Map<number, P>();
  const ways = new Map<number, OsmWay>();
  const relations: OsmRelation[] = [];
  for (const e of elements.values()) {
    if (e.type === 'node') nodes.set(e.id, project(e.lat, e.lon));
    else if (e.type === 'way') ways.set(e.id, e);
    else relations.push(e);
  }
  const line = (ids: number[]) => ids.map((id) => nodes.get(id)).filter((p): p is P => p !== undefined);

  // Outer and inner rings of a way or multipolygon relation.
  type Polygon = { id: string; tags: Tags; outers: P[][]; holes: P[][] };
  const polygons: Polygon[] = [];
  for (const w of ways.values()) {
    if (w.nodes.length >= 4 && w.nodes[0] === w.nodes.at(-1)) polygons.push({ id: `w${w.id}`, tags: w.tags ?? {}, outers: [line(w.nodes)], holes: [] });
  }
  for (const r of relations) {
    if (r.tags?.type !== 'multipolygon') continue;
    const members = (role: string) =>
      joinRings(r.members.filter((m) => m.type === 'way' && m.role === role && ways.has(m.ref)).map((m) => ways.get(m.ref)!.nodes)).map(line);
    polygons.push({ id: `r${r.id}`, tags: r.tags, outers: members('outer'), holes: members('inner') });
  }

  const skip = (t: Tags) => (num(t.layer) ?? 0) < 0 || t.location === 'underground' || t.building === 'construction';
  const shapesOf = (p: Polygon, isPart: boolean): BuildingShape[] => {
    const h = heights(p.tags, isPart);
    const colour = parseColour(p.tags);
    return p.outers.flatMap((o, k) => {
      const outer = cleanRing(o, 0.4);
      if (!outer) return [];
      const holes = p.holes.map((r) => cleanRing(r, 0.4)).filter((r): r is P[] => r !== null && inside(r[0], outer)).map((r) => r.reverse());
      return [{ id: p.outers.length > 1 ? `${p.id}.${k}` : p.id, outer, holes, ...h, ...(colour ? { colour } : {}) }];
    });
  };
  const notOn101 = (s: BuildingShape) => !inside(centroid(s.outer), PODIUM.outline);
  const inScene = (s: BuildingShape) => inRect(centroid(s.outer), SCENE_AREA);

  const outlines = polygons.filter((p) => p.tags.building && !skip(p.tags)).flatMap((p) => shapesOf(p, false).map((s) => ({ s, landmark: LANDMARKS[p.id] })));
  const parts = polygons.filter((p) => p.tags['building:part'] && !skip(p.tags)).flatMap((p) => shapesOf(p, true));
  const buildings: BuildingShape[] = [];
  const usedParts = new Set<BuildingShape>();
  for (const { s, landmark } of outlines) {
    if (!notOn101(s) || !inScene(s)) continue;
    const mine = parts.filter((q) => !usedParts.has(q) && notOn101(q) && inside(centroid(q.outer), s.outer));
    if (mine.length === 0) {
      buildings.push({ ...s, ...(landmark ? { landmark } : {}) });
      continue;
    }
    for (const q of mine) {
      usedParts.add(q);
      buildings.push({ ...q, ...(landmark ? { landmark } : {}), ...(!q.colour && s.colour ? { colour: s.colour } : {}) });
    }
  }
  for (const q of parts) if (!usedParts.has(q) && notOn101(q) && inScene(q)) buildings.push(q);

  const roads: Road[] = [];
  const crossings: P[][] = [];
  const footways: P[][] = [];
  const skybridges: P[][] = [];
  for (const w of ways.values()) {
    const t = w.tags ?? {};
    const layer = num(t.layer) ?? 0;
    const kind = ROAD_KINDS[t.highway];
    if (kind && !t.tunnel && layer >= 0 && t.area !== 'yes') {
      const lanes = num(t.lanes);
      const width = num(t.width) ?? (lanes ? round(lanes * 3.3) : ROAD_WIDTH[kind]);
      const points = t.oneway === '-1' ? line(w.nodes).reverse() : line(w.nodes);
      for (const run of clipLine(points, 1)) roads.push({ kind, width, oneway: t.oneway === 'yes' || t.oneway === '1' || t.oneway === '-1', points: run });
    }
    if (t.footway === 'crossing') crossings.push(...clipLine(line(w.nodes), 1));
    if (FOOTWAYS.has(t.highway) && t.area !== 'yes' && !t.bridge && !t.tunnel && !t.indoor && layer === 0) footways.push(...clipLine(line(w.nodes), 1));
    if (t.highway === 'footway' && t.bridge === 'yes' && layer >= 1) skybridges.push(...clipLine(line(w.nodes), 1));
  }

  const areas: Area[] = [];
  for (const p of polygons) {
    const t = p.tags;
    const kind: Area['kind'] | undefined =
      (t.highway === 'pedestrian' && t.area === 'yes') || t.place === 'square'
        ? 'plaza'
        : t.landuse === 'grass' || t.leisure === 'park' || t.leisure === 'garden'
          ? 'grass'
          : undefined;
    if (!kind || (num(t.layer) ?? 0) < 0) continue;
    for (const o of p.outers) {
      const outer = cleanRing(o, 0.4);
      if (outer && inRect(centroid(outer), SCENE_AREA)) areas.push({ kind, outer });
    }
  }

  const points = (key: string, value: string) =>
    [...elements.values()]
      .filter((e): e is OsmNode => e.type === 'node' && e.tags?.[key] === value)
      .map((e) => nodes.get(e.id)!)
      .filter((p) => inRect(p, SCENE_AREA));

  const byFirst = (a: P[], b: P[]) => a[0][0] - b[0][0] || a[0][1] - b[0][1];
  const data: XinyiData = {
    source: { bbox: BBOX, fetched: tiles.map((t) => t.timestamp).find(Boolean) ?? new Date().toISOString().slice(0, 10) },
    buildings: buildings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    roads: roads.sort((a, b) => byFirst(a.points, b.points)),
    crossings: crossings.sort(byFirst),
    footways: footways.sort(byFirst),
    areas: areas.sort((a, b) => byFirst(a.outer, b.outer)),
    skybridges: skybridges.sort(byFirst),
    trees: points('natural', 'tree').sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    lamps: points('highway', 'street_lamp').sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  };
  writeFileSync(OUT, JSON.stringify(data));
  const landmarks = Object.values(LANDMARKS).map((id) => `${id} ${data.buildings.filter((b) => b.landmark === id).length}`);
  console.log(
    `wrote ${OUT}: ${data.buildings.length} buildings (${landmarks.join(', ')}), ${data.roads.length} roads, ` +
      `${data.crossings.length} crossings, ${data.footways.length} footways, ${data.areas.length} areas, ` +
      `${data.skybridges.length} skybridges, ${data.trees.length} trees, ${data.lamps.length} lamps`,
  );
}

await main();
