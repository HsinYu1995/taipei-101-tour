import { use, useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, Color, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Vector3, Vector4 } from 'three';
import { registerProbe } from '../../debug/testHook';
import dtmUrl from './taipei-dtm.bin?url';
import type { Rect } from '../../street/types';
import { GRID, GRID_COUNT, HeightField } from './grid';

let fieldPromise: Promise<HeightField> | undefined;

/** The baked terrain, fetched once; suspends until it arrives. */
export function useHeightField() {
  fieldPromise ??= fetch(dtmUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`terrain: HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((buf) => new HeightField(new Uint16Array(buf)));
  return use(fieldPromise);
}

/** Water surface, metres above sea level: covers the sea and the river beds the DTM leaves empty. */
const WATER_LEVEL = 1;
/** Heights ease down to sea level over this many metres at the grid edge, so the terrain ends in water. */
const EDGE_FADE = 3000;

/** Colour by absolute height in metres: lowland, foothills, mountainside, ridges. */
const STOPS = [
  { h: 0, color: new Color('#a3a88f') },
  { h: 80, color: new Color('#8d9c78') },
  { h: 300, color: new Color('#6f8a62') },
  { h: 800, color: new Color('#58724f') },
  { h: 1300, color: new Color('#4b6046') },
];

function colorAt(h: number, out: Color) {
  const k = STOPS.findIndex((s) => s.h > h);
  if (k === -1) return out.copy(STOPS[STOPS.length - 1].color);
  if (k === 0) return out.copy(STOPS[0].color);
  const a = STOPS[k - 1];
  const b = STOPS[k];
  return out.copy(a.color).lerp(b.color, (h - a.h) / (b.h - a.h));
}

const smoothstep = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

function buildGeometry(field: HeightField) {
  const size = 2 * GRID.half;
  const geometry = new PlaneGeometry(size, size, GRID_COUNT - 1, GRID_COUNT - 1);
  // Row 0 of the plane becomes the north edge (-z), matching the grid's row order.
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let k = 0; k < position.count; k++) {
    const x = position.getX(k);
    const z = position.getZ(k);
    const edge = GRID.half - Math.max(Math.abs(x), Math.abs(z));
    const h = field.sample(k % GRID_COUNT, Math.floor(k / GRID_COUNT)) * smoothstep(edge / EDGE_FADE);
    position.setY(k, h - field.base);
    colorAt(h, color).toArray(colors, k * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** An empty hole: x0 > x1, so no fragment is ever inside it. */
const NO_HOLE = new Vector4(1, -1, 1, -1);

/**
 * Vertex-coloured terrain whose fragments inside `uHole` (x0, x1, z0, z1 in world metres) are discarded,
 * so the street walk's own ground can replace it without z-fighting.
 */
function makeMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const uHole = { value: NO_HOLE.clone() };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHole = uHole;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vHoleXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHoleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uHole;\nvarying vec2 vHoleXZ;')
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (vHoleXZ.x > uHole.x && vHoleXZ.x < uHole.y && vHoleXZ.y > uHole.z && vHoleXZ.y < uHole.w) discard;',
      );
  };
  return { material, uHole };
}

export function Terrain({ field, hole = null }: { field: HeightField; hole?: Rect | null }) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => buildGeometry(field), [field]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const { material, uHole } = useMemo(makeMaterial, []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    if (hole) uHole.value.set(hole.x0, hole.x1, hole.z0, hole.z1);
    else uHole.value.copy(NO_HOLE);
    // Raycasts (castRay probe) skip the hole too; the GPU-side discard does not affect them.
    ref.current!.userData.hole = hole;
  }, [hole, uHole]);

  useEffect(() => {
    const ray = new Raycaster();
    const down = new Vector3(0, -1, 0);
    return registerProbe('groundAt', (x: number, z: number) => {
      ray.set(new Vector3(x, 10000, z), down);
      const hit = ray.intersectObject(ref.current!)[0];
      return hit ? hit.point.y : null;
    });
  }, []);

  return (
    <group>
      <mesh ref={ref} name="terrain" geometry={geometry} material={material} />
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_LEVEL - field.base}>
        <planeGeometry args={[200000, 200000]} />
        <meshStandardMaterial color="#7f98a6" />
      </mesh>
    </group>
  );
}
