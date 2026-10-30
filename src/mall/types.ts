export type FloorId = 'B1' | '1F' | '2F' | '3F' | '4F' | '5F';
export const FLOOR_IDS: readonly FloorId[] = ['B1', '1F', '2F', '3F', '4F', '5F'];

export type TenantCategory =
  | 'watch' | 'jewellery' | 'boutique' | 'beauty' | 'fashion' | 'shoes' | 'life'
  | 'culture' | 'service' | 'souvenir' | 'food-court' | 'restaurant' | 'cafe';

export interface Tenant {
  name: string;
  /** What its shop sign says: the official Latin name, or the Chinese name of a shop that has none. */
  sign: string;
  /** Its name in the feed's Chinese listing, store suffix removed; empty for what the feed does not list. */
  zh: string;
  floor: FloorId;
  category: TenantCategory;
}

export interface MallTenants {
  /** ISO date the feed was read. */
  snapshot: string;
  floors: Record<FloorId, Tenant[]>;
}
