import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { Rect } from '../../street/types';
import type { HeightField } from '../terrain/grid';
import { TILE_METRES, makeFacadeTexture } from '../tower/facadeTexture';
import { blockCorners, generateCity, type Block } from './generateCity';

const OPTIONS = { seed: 101, radius: 9000, count: 6000 };
const CONCRETE = { top: '#d9dcde', bottom: '#b9bec2', band: '#eceae4', mullion: '#9aa0a4' };
/** Tints multiplied over the grey facade: cool grey through to warm off-white. */
const TINTS = [new Color('#d5dbe0'), new Color('#ffffff'), new Color('#ecdfcb')];

/**
 * A box's UVs run 0..1 on every face whatever the instance's size. Rescale them by the instance's width,
 * depth and height so the facade texture's floor bands stay 4.2 m apart on every block, and give roofs a
 * single plain spot of the texture instead of stripes.
 */
function makeMaterial() {
  const material = new MeshStandardMaterial({ map: makeFacadeTexture(CONCRETE), flatShading: true, roughness: 0.9 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      /* glsl */ `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec2 metres = abs(normal.y) > 0.5
          ? vec2(${(TILE_METRES * 0.3).toFixed(2)}, ${(TILE_METRES * 0.25).toFixed(2)})
          : vec2(uv.x * (abs(normal.x) > 0.5 ? size.z : size.x), uv.y * size.y);
        vMapUv = (mapTransform * vec3(metres, 1.0)).xy;
      #endif`,
    );
  };
  return material;
}

/** True when a block's footprint bounding box reaches into `r`. */
function overlaps(b: Block, r: Rect) {
  const corners = blockCorners(b);
  const xs = corners.map((p) => p[0]);
  const zs = corners.map((p) => p[1]);
  return Math.max(...xs) > r.x0 && Math.min(...xs) < r.x1 && Math.max(...zs) > r.z0 && Math.min(...zs) < r.z1;
}

/**
 * Procedural blocks across the basin: none inside `hole`, where the street walk's real buildings stand, and
 * none further than `reach` metres from 101.
 */
export function City({ field, hole = null, reach = Infinity }: { field: HeightField; hole?: Rect | null; reach?: number }) {
  const ref = useRef<InstancedMesh>(null);
  const all = useMemo(() => generateCity(field, OPTIONS), [field]);
  const blocks = useMemo(
    () => all.filter((b) => !(hole && overlaps(b, hole)) && Math.hypot(b.x, b.z) <= reach),
    [all, hole, reach],
  );
  const material = useMemo(makeMaterial, []);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );

  useLayoutEffect(() => {
    const mesh = ref.current!;
    const o = new Object3D();
    const color = new Color();
    blocks.forEach((b, i) => {
      o.position.set(b.x, b.y + b.height / 2, b.z);
      o.rotation.set(0, b.rotation, 0);
      o.scale.set(b.width, b.height, b.depth);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      const t = b.shade * (TINTS.length - 1);
      const k = Math.min(Math.floor(t), TINTS.length - 2);
      mesh.setColorAt(i, color.copy(TINTS[k]).lerp(TINTS[k + 1], t - k));
    });
    mesh.count = blocks.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Instances span the whole basin; the default bounds come from one unit box at the origin.
    mesh.computeBoundingSphere();
  }, [blocks]);

  return (
    <instancedMesh ref={ref} name="city" args={[undefined, material, OPTIONS.count]}>
      <boxGeometry />
    </instancedMesh>
  );
}
