/**
 * Bakes the tenants of Taipei 101's mall (B1 to 5F) from the official site's data feed into the dated
 * snapshot the mall walk lays its shopfronts out from.
 *
 *   npm run bake:mall
 *
 * Downloads the shop list of each floor and the restaurant list from ws.taipei-101.com.tw into .cache/mall,
 * in English and in Chinese (once; delete the folder to read the feed again), cleans the names, maps the feed's
 * categories to the mall's, signs each tenant, and writes src/mall/tenants.json. The snapshot date is the day
 * the cached English feed was read.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LATIN_SIGNED } from './latinSigned.ts';
import { FLOOR_IDS, type FloorId, type MallTenants, type Tenant, type TenantCategory } from '../src/mall/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'mall');
const OUT = join(ROOT, 'src', 'mall', 'tenants.json');

const API = 'https://ws.taipei-101.com.tw/api/v1';
type Lang = 'en' | 'zh';
const LANGS: readonly Lang[] = ['en', 'zh'];
const shopsUrl = (floor: FloorId, lang: Lang) => `${API}/shopping/floor/detail/brands?lang=${lang}&floor=FLOOR_${floor}`;
const foodUrl = (lang: Lang) => `${API}/food/search?lang=${lang}`;
/** Cache file names; the English ones keep the names they had before the Chinese feed was read too. */
const shopsFile = (floor: FloorId, lang: Lang) => (lang === 'en' ? `shop_${floor}.json` : `shop_${floor}_${lang}.json`);
const foodFile = (lang: Lang) => (lang === 'en' ? 'food.json' : `food_${lang}.json`);

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
/** Shops the feed files under a group that misdescribes them (`special` means service, `shoes` means accessories). */
const CATEGORY: Record<string, TenantCategory> = {
  'Läderach': 'souvenir',
  SWATCH: 'watch',
};
const HAND_ADDED: Tenant[] = [{ name: 'Observatory Tickets', sign: 'Observatory Tickets', zh: '', floor: '5F', category: 'service' }];
/** Chinese store-name suffixes, longest first. */
const ZH_SUFFIXES = ['台北101旗艦店', '台北101專賣店', '台北101店', '101旗艦店', '101店', '台北101', '旗艦店', '專賣店'];

interface FeedShop { id: string; name: string }
type FeedShops = Record<string, FeedShop[]>;
interface FeedFood { id: string; title: string; floor: string; category: string }

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

const HAN = /\p{Script=Han}/u;
/** Runs of Latin script in a Chinese listing, with the digits, spaces and marks inside a brand name. */
const LATIN_RUN = /\p{Script=Latin}(?:[\p{Script=Latin}\p{N}&'.\- ]*[\p{Script=Latin}\p{N}.])?/gu;
/** Latin words a Chinese listing carries that are not a brand name, lower case. */
const GENERIC = new Set(['mini', 'shabu']);

/** The feed's Chinese name, trimmed of its store-name suffix. */
function cleanZh(raw: string): string {
  let name = decodeEntities(raw).normalize('NFC').replace(/\s+/g, ' ').trim();
  const suffix = ZH_SUFFIXES.find((s) => name.endsWith(s) && name.length > s.length);
  if (suffix) name = name.slice(0, -suffix.length).trim();
  return name;
}

/**
 * What the shop's sign says, from its cleaned Chinese listing `zh`. The English feed translates names a shop does
 * not use, so the Chinese listing decides: one in Latin script only is the shop's own name, and the sign is the
 * baked name; one in Han only means the shop has no Latin name, and the sign is the Chinese; a mixed one carries
 * the brand's Latin name, which is the sign, unless its Latin is only a generic word (mini, shabu), when the sign is
 * the listing as written.
 */
function signFor(name: string, zh: string): string {
  if (LATIN_SIGNED.has(name)) return name;
  if (!zh) {
    console.warn(`no Chinese listing for "${name}"; signed with its Latin name`);
    return name;
  }
  if (!HAN.test(zh)) return name;
  const runs = zh.match(LATIN_RUN) ?? [];
  const brand = runs.filter((r) => !GENERIC.has(r.toLowerCase())).sort((a, b) => b.length - a.length)[0];
  return brand ?? zh;
}

function shopCategory(key: string, name: string): TenantCategory {
  if (CATEGORY[name]) return CATEGORY[name];
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
  const shops = {} as Record<Lang, Record<FloorId, FeedShops>>;
  const food = {} as Record<Lang, FeedFood[]>;
  for (const lang of LANGS) {
    shops[lang] = {} as Record<FloorId, FeedShops>;
    for (const floor of FLOOR_IDS) shops[lang][floor] = await cached<FeedShops>(shopsFile(floor, lang), shopsUrl(floor, lang));
    food[lang] = await cached<FeedFood[]>(foodFile(lang), foodUrl(lang));
  }
  // The two languages list the same shops under the same ids.
  const zhName = new Map<string, string>();
  for (const floor of FLOOR_IDS) for (const list of Object.values(shops.zh[floor])) for (const s of list) zhName.set(s.id, s.name);
  for (const r of food.zh) zhName.set(r.id, r.title);

  for (const floor of FLOOR_IDS) {
    for (const [key, list] of Object.entries(shops.en[floor])) {
      for (const shop of list) {
        const name = cleanName(shop.name);
        const zh = cleanZh(zhName.get(shop.id) ?? '');
        listings.push({ name, sign: signFor(name, zh), zh, floor, category: shopCategory(key, name) });
      }
    }
  }
  for (const r of food.en) {
    const floors = r.floor.split(',').map((f) => f.trim()).filter(isFloor);
    if (floors.length === 0) continue;
    const name = cleanName(r.title);
    const category = foodCategory(r.category, name);
    const zh = cleanZh(zhName.get(r.id) ?? '');
    const sign = signFor(name, zh);
    for (const floor of floors) listings.push({ name, sign, zh, floor, category });
  }
  listings.push(...HAND_ADDED);

  const floors = Object.fromEntries(FLOOR_IDS.map((f) => [f, [] as Tenant[]])) as Record<FloorId, Tenant[]>;
  for (const t of listings) {
    const onFloor = floors[t.floor];
    if (!onFloor.some((o) => o.name.toLowerCase() === t.name.toLowerCase())) onFloor.push(t);
  }

  const data: MallTenants = { snapshot: readOn([...FLOOR_IDS.map((f) => shopsFile(f, 'en')), foodFile('en')]), floors };
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote ${OUT} (snapshot ${data.snapshot}): ${FLOOR_IDS.map((f) => `${f} ${floors[f].length}`).join(', ')}`);
}

await main();
