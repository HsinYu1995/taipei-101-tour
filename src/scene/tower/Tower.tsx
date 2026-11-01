import { useEffect, useMemo } from 'react';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENTRANCE as DOOR } from '../../street/api';
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

/**
 * 101's south entrance, across the stretch of the podium's south wall the street walk crosses into the mall at.
 * Drawn in the wall's own frame: x along it, y up, z out to the street.
 */
const ENTRANCE = { x: (DOOR.x0 + DOOR.x1) / 2, z: DOOR.z0, half: (DOOR.x1 - DOOR.x0) / 2 - 0.1, doors: 5, glassTop: 3.9, transom: 2.6 };
const CANOPY = { y: 4.45, depth: 3.2, half: 6.4 };
const FRAME_COLOR = '#2f3338';
const CANOPY_COLOR = '#f0eee8';
const FASCIA_COLOR = '#9ea3a8';

/** A box spanning [x0, x1] x [y0, y1] x [z0, z1], non-indexed and painted one colour. */
function slab(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string) {
  const box = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed();
  box.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return painted(box, color);
}

function painted(geometry: BufferGeometry, color: string) {
  const { r, g, b } = new Color(color);
  const n = geometry.getAttribute('position').count;
  geometry.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n }, () => [r, g, b]).flat(), 3));
  return geometry;
}

/**
 * The entrance's glazed doors, one pane across the opening, and what frames it: jambs, head and transom, the
 * mullions between the doors and their pull handles, the threshold, and a cantilevered canopy over the pavement
 * hung from the wall on two ties. Two merged meshes: glass, and the rest in vertex colours.
 */
function entranceGeometry() {
  const { half, doors, glassTop, transom } = ENTRANCE;
  const glass = new BoxGeometry(2 * half, glassTop, 0.06);
  glass.translate(0, glassTop / 2, 0.05);

  const parts: BufferGeometry[] = [
    slab(-half - 0.35, -half, 0, glassTop + 0.35, 0, 0.25, FRAME_COLOR),
    slab(half, half + 0.35, 0, glassTop + 0.35, 0, 0.25, FRAME_COLOR),
    slab(-half - 0.35, half + 0.35, glassTop, glassTop + 0.35, 0, 0.25, FRAME_COLOR),
    slab(-half, half, transom, transom + 0.14, 0, 0.14, FRAME_COLOR),
    slab(-half - 0.35, half + 0.35, 0, 0.18, 0, 0.6, '#55585b'),
    slab(-CANOPY.half, CANOPY.half, CANOPY.y, CANOPY.y + 0.3, 0, CANOPY.depth - 0.12, CANOPY_COLOR),
    slab(-CANOPY.half, CANOPY.half, CANOPY.y - 0.1, CANOPY.y + 0.4, CANOPY.depth - 0.12, CANOPY.depth, FASCIA_COLOR),
  ];
  const bay = (2 * half) / doors;
  for (let i = 0; i < doors; i++) {
    const left = -half + i * bay;
    if (i > 0) parts.push(slab(left - 0.06, left + 0.06, 0, glassTop, 0, 0.14, FRAME_COLOR));
    // Each door bay is a pair of leaves meeting in the middle, a pull on each.
    const mid = left + bay / 2;
    for (const side of [-1, 1]) parts.push(slab(mid + side * 0.12 - 0.02, mid + side * 0.12 + 0.02, 0.9, 2.1, 0.08, 0.16, '#b9bcbf'));
  }
  for (const x of [-4.5, 4.5]) {
    // From the wall above the canopy down to its front edge.
    const from = new Vector2(0, 7.2);
    const to = new Vector2(CANOPY.depth - 0.1, CANOPY.y + 0.3);
    const tie = new CylinderGeometry(0.05, 0.05, from.distanceTo(to), 6).toNonIndexed();
    tie.rotateX(Math.atan2(to.x - from.x, to.y - from.y));
    tie.translate(x, (from.y + to.y) / 2, (from.x + to.x) / 2);
    parts.push(painted(tie, FRAME_COLOR));
  }
  return { glass, frame: mergeGeometries(parts)! };
}

/** Procedural Taipei 101: pedestal, eight flared segments, stepped crown, spire, ornaments and podium. */
export function Tower() {
  const glass = useMemo(() => makeFacadeTexture(TOWER_GLASS), []);
  const sections = useMemo(() => SECTIONS.map((s) => ({ name: s.name, geometry: loftSection(s) })), []);
  const ornaments = useMemo(ornamentGeometry, []);
  const podium = useMemo(podiumGeometry, []);
  const entrance = useMemo(entranceGeometry, []);
  useEffect(
    () => () => {
      glass.dispose();
      sections.forEach((s) => s.geometry.dispose());
      ornaments.dispose();
      podium.dispose();
      entrance.glass.dispose();
      entrance.frame.dispose();
    },
    [glass, sections, ornaments, podium, entrance],
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
      <group position={[ENTRANCE.x, 0, ENTRANCE.z]} rotation-y={GRID_ROTATION}>
        {/* Blue-grey glass lit a little by the sky it reflects, so the doors read against the warm wall. */}
        <mesh name="tower-entrance-glass" geometry={entrance.glass}>
          <meshStandardMaterial color="#5a7d92" emissive="#9cc3d9" emissiveIntensity={0.25} roughness={0.1} />
        </mesh>
        <mesh name="tower-entrance-frame" geometry={entrance.frame}>
          <meshStandardMaterial vertexColors flatShading roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
