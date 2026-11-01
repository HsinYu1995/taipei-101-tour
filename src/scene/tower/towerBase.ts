import { footprint } from './loft';
import { GRID_ROTATION } from './podium';
import { SECTIONS } from './towerProfile';

const cos = Math.cos(GRID_ROTATION);
const sin = Math.sin(GRID_ROTATION);

/** The tower's ground footprint in world (x, z), turned like the Tower group (rotation.y = GRID_ROTATION). */
export const TOWER_BASE: [number, number][] = footprint(SECTIONS[0].half0).map(([x, z]): [number, number] => [
  x * cos + z * sin,
  -x * sin + z * cos,
]);
