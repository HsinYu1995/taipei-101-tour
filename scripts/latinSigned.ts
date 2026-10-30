/**
 * Shops with an official Latin name whose Chinese listing has none, so the bake (scripts/bake-mall.ts) would sign
 * them in Chinese; keyed by the baked name. Its own module so the sign tests can read it without running the bake.
 */
export const LATIN_SIGNED: ReadonlySet<string> = new Set([
  'Rolex', 'Tudor', 'CHANEL Watches & Fine Jewelry', 'A. Lange & Söhne', 'Taipei Fubon Bank', "McDonald's",
  'Din Tai Fung', 'KAVALAN', 'SunnyHills', 'FamilyMart', 'TAO TAO TEA', 'CHUYU', 'Fujin Tree Taiwanese Champagne',
  'Kuo Yuan Ye', 'Hsin Tung Yang',
]);
