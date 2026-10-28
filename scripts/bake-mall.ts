/**
 * Bakes the tenants of Taipei 101's mall (B1 to 5F) from the official site's data feed into the dated
 * snapshot the mall walk lays its shopfronts out from.
 *
 *   npm run bake:mall
 *
 * Downloads the shop list of each floor and the restaurant list from ws.taipei-101.com.tw into .cache/mall
 * (once; delete the folder to read the feed again), cleans the names, maps the feed's categories to the
 * mall's, and writes src/mall/tenants.json. The snapshot date is the day the cached feed was read.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOOR_IDS, type FloorId, type MallTenants, type Tenant, type TenantCategory } from '../src/mall/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'mall');
const OUT = join(ROOT, 'src', 'mall', 'tenants.json');

const API = 'https://ws.taipei-101.com.tw/api/v1';
const shopsUrl = (floor: FloorId) => `${API}/shopping/floor/detail/brands?lang=en&floor=FLOOR_${floor}`;
const FOOD_URL = `${API}/food/search?lang=en`;

const SHOP_CATEGORIES: Record<string, TenantCategory> = {
  watch: 'watch',
  boutique: 'boutique',
  cosmetic: 'beauty',
  apparel: 'fashion',
  shoes: 'shoes',
  life: 'life',
  culture: 'culture',
  special: 'service',
  food: 'souvenir',
  souvenir: 'souvenir',
};
/** In order of precedence: a listing in several takes the first. Sky Dining alone never sits on a mall floor. */
const FOOD_CATEGORIES: [string, TenantCategory][] = [
  ['Food Court', 'food-court'],
  ['Light Food', 'cafe'],
  ['Featured Restaurants', 'restaurant'],
  ['Souvenirs', 'souvenir'],
];
/** Jewellery houses; the feed files them with the watchmakers. Lower case. */
const JEWELLERY = new Set([
  'tiffany & co.', 'harry winston', 'van cleef & arpels', 'cartier', 'boucheron', 'chaumet', 'buccellati',
  'de beers', 'mikimoto', 'chopard', 'piaget', 'bvlgari', 'fred', 'chow tai fook', 'pandora', 'agete',
]);
/** Retailers the feed names after a brand ("Rolex – Dickson Watches and Jewelry"). */
const RETAILERS = ['Dickson'];
/** Store-name suffixes, longest first. */
const SUFFIXES = [' Taipei 101 store', ' Taipei 101 Store', ' Taipei 101', ' Taipei'];
const KEEP_SUFFIX = new Set(['The one at Taipei 101']);
/** Names the rules above leave unfit for a sign. */
const RENAME: Record<string, string> = {
  'CHANEL Taipei 101 Watches & Fine Jewelry Boutique': 'CHANEL Watches & Fine Jewelry',
  'CHUYU Japanese Cuisine CHUYU Teppanyaki': 'CHUYU',
  'NB GREY Image Main Store': 'NB GREY',
};
const HAND_ADDED: Tenant[] = [{ name: 'Observatory Tickets', floor: '5F', category: 'service' }];

interface FeedShop { name: string }
type FeedShops = Record<string, FeedShop[]>;
interface FeedFood { title: string; floor: string; category: string }

async function cached<T>(file: string, url: string): Promise<T> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status} ${await res.text()}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
    return String.fromCodePoint(code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10));
  });
}

function cleanName(raw: string): string {
  let name = decodeEntities(raw).normalize('NFC').replace(/\s+/g, ' ').trim();
  name = name.replace(/ \/.*$/, '');
  const dash = name.match(/^(.+?) [–-] (.+)$/);
  if (dash && RETAILERS.some((r) => dash[2].startsWith(r))) name = dash[1];
  if (!KEEP_SUFFIX.has(name)) {
    const suffix = SUFFIXES.find((s) => name.endsWith(s));
    if (suffix) name = name.slice(0, -suffix.length);
  }
  return RENAME[name] ?? name;
}

function shopCategory(key: string, name: string): TenantCategory {
  if (JEWELLERY.has(name.toLowerCase())) return 'jewellery';
  const category = SHOP_CATEGORIES[key];
  if (!category) throw new Error(`unknown shop category "${key}" (${name})`);
  return category;
}

function foodCategory(listed: string, name: string): TenantCategory {
  const listedAs = listed.split(',').map((c) => c.trim());
  const found = FOOD_CATEGORIES.find(([feed]) => listedAs.includes(feed));
  if (!found) throw new Error(`no mall category for restaurant "${name}" (${listed})`);
  return found[1];
}

const isFloor = (f: string): f is FloorId => (FLOOR_IDS as readonly string[]).includes(f);

/** Local calendar date of the oldest cached response, i.e. when the feed was read. */
function readOn(files: string[]): string {
  const t = new Date(Math.min(...files.map((f) => statSync(join(CACHE, f)).mtimeMs)));
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const listings: Tenant[] = [];
  for (const floor of FLOOR_IDS) {
    const shops = await cached<FeedShops>(`shop_${floor}.json`, shopsUrl(floor));
    for (const [key, list] of Object.entries(shops)) {
      for (const shop of list) {
        const name = cleanName(shop.name);
        listings.push({ name, floor, category: shopCategory(key, name) });
      }
    }
  }
  const food = await cached<FeedFood[]>('food.json', FOOD_URL);
  for (const r of food) {
    const floors = r.floor.split(',').map((f) => f.trim()).filter(isFloor);
    if (floors.length === 0) continue;
    const name = cleanName(r.title);
    const category = foodCategory(r.category, name);
    for (const floor of floors) listings.push({ name, floor, category });
  }
  listings.push(...HAND_ADDED);

  const floors = Object.fromEntries(FLOOR_IDS.map((f) => [f, [] as Tenant[]])) as Record<FloorId, Tenant[]>;
  for (const t of listings) {
    const onFloor = floors[t.floor];
    if (!onFloor.some((o) => o.name.toLowerCase() === t.name.toLowerCase())) onFloor.push(t);
  }

  const data: MallTenants = { snapshot: readOn([...FLOOR_IDS.map((f) => `shop_${f}.json`), 'food.json']), floors };
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote ${OUT} (snapshot ${data.snapshot}): ${FLOOR_IDS.map((f) => `${f} ${floors[f].length}`).join(', ')}`);
}

await main();
