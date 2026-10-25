/** World x, z in metres (east +x, north -z). */
export type P = [number, number];

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export type LandmarkId = 'vieshow' | 'skm-a4' | 'skm-a8' | 'skm-a9' | 'skm-a11';

export interface BuildingShape {
  /** 'w<osm id>' or 'r<osm id>'. */
  id: string;
  /** Counter-clockwise in (x, z), not closed (first != last). */
  outer: P[];
  holes: P[][];
  /** Metres above local ground. */
  base: number;
  /** Top, metres above local ground; always above `base`. */
  height: number;
  /** A building=roof canopy: rendered, never collided with. */
  roof: boolean;
  landmark?: LandmarkId;
  /** #rrggbb from the OSM colour tags, when present. */
  colour?: string;
}

export interface Road {
  kind: 'major' | 'minor' | 'service';
  width: number;
  oneway: boolean;
  points: P[];
}

export interface Area {
  kind: 'plaza' | 'grass';
  outer: P[];
}

export interface XinyiData {
  source: { bbox: [number, number, number, number]; fetched: string };
  buildings: BuildingShape[];
  roads: Road[];
  crossings: P[][];
  /** Walkable lines for pedestrians: footways, sidewalks, crossings, pedestrian ways. */
  footways: P[][];
  areas: Area[];
  skybridges: P[][];
  trees: P[];
  lamps: P[];
}
