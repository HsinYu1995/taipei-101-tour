import { useEffect, useMemo } from 'react';
import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TOWER_GLASS, makeFacadeTexture } from './facadeTexture';
import { loftSection } from './loft';
import { GRID_ROTATION, PODIUM } from './podium';
import { ROOF, SECTIONS, SPIRE_TOP, halfWidthAt } from './towerProfile';

const BASE = SECTIONS[0];
const GOLD = '#c9a227';

/** The ruyi: a three-lobed cloud head on a pointed stem, about 8.6 m tall (Wikipedia: "at least 8 m"). */
function ruyiShape() {
  const s = new Shape();
  s.moveTo(0, -4);
  s.quadraticCurveTo(-4.5, -0.5, -4, 2);
  s.quadraticCurveTo(-3.6, 4.2, -1.4, 3.4);
  s.quadraticCurveTo(0, 5.6, 1.4, 3.4);
  s.quadraticCurveTo(3.6, 4.2, 4, 2);
  s.quadraticCurveTo(4.5, -0.5, 0, -4);
  return s;
}

/**
 * One ruyi centred on each face just above the pedestal, and four coin discs on each face where the pedestal
 * meets the tower (Wikipedia: "four discs ... on each face"). Merged into one mesh: one draw call.
 */
function ornamentGeometry() {
  const parts: BufferGeometry[] = [];
  const ruyiY = BASE.y1 + 5;
  const coinY = BASE.y1 - 6;
  for (let face = 0; face < 4; face++) {
    const turn = (face * Math.PI) / 2;
    const ruyi = new ExtrudeGeometry(ruyiShape(), { depth: 1, bevelEnabled: false });
    ruyi.translate(0, ruyiY, halfWidthAt(ruyiY));
    ruyi.rotateY(turn);
    parts.push(ruyi);
    for (const x of [-9, -3, 3, 9]) {
      const coin = new CylinderGeometry(2.2, 2.2, 0.6, 16);
      coin.rotateX(Math.PI / 2);
      coin.translate(x, coinY, halfWidthAt(coinY) + 0.3);
      coin.rotateY(turn);
      parts.push(coin.toNonIndexed());
    }
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
}

/** The 101 complex's street-level outline extruded to the mall's height. */
function podiumGeometry() {
  // Shape y is world -z so that, after turning the extrusion upright, the outline lands at its world x/z.
  const shape = new Shape(PODIUM.outline.map(([x, z]) => new Vector2(x, -z)));
  const geometry = new ExtrudeGeometry(shape, { depth: PODIUM.height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Procedural Taipei 101: pedestal, eight flared segments, stepped crown, spire, ornaments and podium. */
export function Tower() {
  const glass = useMemo(() => makeFacadeTexture(TOWER_GLASS), []);
  const sections = useMemo(() => SECTIONS.map((s) => ({ name: s.name, geometry: loftSection(s) })), []);
  const ornaments = useMemo(ornamentGeometry, []);
  const podium = useMemo(podiumGeometry, []);
  useEffect(
    () => () => {
      glass.dispose();
      sections.forEach((s) => s.geometry.dispose());
      ornaments.dispose();
      podium.dispose();
    },
    [glass, sections, ornaments, podium],
  );

  return (
    <group>
      <group rotation-y={GRID_ROTATION}>
        {sections.map(({ name, geometry }) => (
          <mesh key={name} name={`tower-${name}`} geometry={geometry}>
            <meshStandardMaterial map={glass} flatShading roughness={0.5} />
          </mesh>
        ))}
        <mesh name="tower-ornaments" geometry={ornaments}>
          <meshStandardMaterial color={GOLD} flatShading roughness={0.45} />
        </mesh>
        <mesh name="tower-spire" position-y={(ROOF + SPIRE_TOP) / 2}>
          <cylinderGeometry args={[0.4, 1.5, SPIRE_TOP - ROOF, 8]} />
          <meshStandardMaterial color="#c9ccc9" flatShading />
        </mesh>
      </group>
      <mesh name="tower-podium" geometry={podium}>
        <meshStandardMaterial color="#c9c6bb" flatShading />
      </mesh>
    </group>
  );
}
