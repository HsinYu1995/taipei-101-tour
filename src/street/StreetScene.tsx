import { useEffect, useMemo } from 'react';
import { registerProbe } from '../debug/testHook';
import { useHeightField } from '../scene/terrain/Terrain';
import { footprint } from '../scene/tower/loft';
import { GRID_ROTATION, PODIUM } from '../scene/tower/podium';
import { SECTIONS } from '../scene/tower/towerProfile';
import { useTour } from '../tour/store';
import { isStreetMode, type StreetApi } from './api';
import { WALK_AREA } from './areas';
import { Colliders } from './collide';
import { Buildings } from './Buildings';
import { Ground } from './Ground';
import { groundAt } from './groundAt';
import { useXinyi } from './data';
import { Props } from './Props';
import { placeTrees } from './trees';
import type { P, XinyiData } from './types';
import { Walker } from './walker';

export { default as StreetHud } from './StreetHud';

/** The visitor's body radius. */
const RADIUS = 0.3;
/** Tree trunks block like posts. */
const TRUNK_RADIUS = 0.35;
/** Footprints this far outside the walk area can still be reached at its edge. */
const REACH = 10;

/** What the visitor cannot walk through: real buildings, the 101 podium, the tower base and tree trunks. */
function buildColliders(data: XinyiData, trees: P[]) {
  const near = (ring: P[]) =>
    ring.some(([x, z]) => x > WALK_AREA.x0 - REACH && x < WALK_AREA.x1 + REACH && z > WALK_AREA.z0 - REACH && z < WALK_AREA.z1 + REACH);
  const footprints = data.buildings.filter((b) => !b.roof && b.base < 2 && near(b.outer)).map((b) => b.outer);
  // The tower's ground footprint, turned like the Tower group (rotation.y = GRID_ROTATION).
  const c = Math.cos(GRID_ROTATION);
  const s = Math.sin(GRID_ROTATION);
  const tower = footprint(SECTIONS[0].half0).map(([x, z]): P => [x * c + z * s, -x * s + z * c]);
  const trunks = trees.map(([x, z]) => ({ x, z, r: TRUNK_RADIUS }));
  return new Colliders([...footprints, PODIUM.outline, tower], WALK_AREA, RADIUS, trunks);
}

/** The Xinyi street walk: loaded lazily the first time the visitor explores the tower chapter. */
export default function StreetScene() {
  const field = useHeightField();
  const data = useXinyi();
  const walking = useTour((s) => isStreetMode(s.mode));
  const ground = useMemo(() => groundAt(field), [field]);
  const trees = useMemo(() => placeTrees(data), [data]);
  const colliders = useMemo(() => buildColliders(data, trees), [data, trees]);
  const walker = useMemo(() => new Walker(colliders, ground), [colliders, ground]);
  const api = useMemo<StreetApi>(
    () => ({
      // A fresh walker stands at the landing spot.
      landing: () => new Walker(colliders, ground).pose(),
      reset: () => walker.reset(),
      step: (dt) => walker.step(dt),
    }),
    [colliders, ground, walker],
  );

  useEffect(() => {
    useTour.getState().setStreet(api);
    return () => useTour.getState().setStreet(null);
  }, [api]);

  useEffect(
    () =>
      registerProbe('street', {
        visitor: () => ({ x: walker.x, z: walker.z, yaw: walker.yaw, pitch: walker.pitch }),
        place: ({ x, z, yaw, pitch }) => walker.place(x, z, yaw, pitch),
        blocked: (x, z) => colliders.blocked([x, z]),
      }),
    [walker, colliders],
  );

  return (
    <group>
      <Ground data={data} ground={ground} detail={walking} />
      <Buildings data={data} ground={ground} />
      {/* Street-level detail: a few pixels from the tour's viewpoints, but tens of thousands of triangles. */}
      <group visible={walking}>
        <Props trees={trees} lamps={data.lamps} ground={ground} />
      </group>
    </group>
  );
}
