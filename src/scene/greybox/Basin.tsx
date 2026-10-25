import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import type { HeightField } from '../terrain/grid';
import { Terrain, useHeightField } from '../terrain/Terrain';

const BLOCK_COUNT = 400;
/** City blocks stand only on low, dry, level ground: the basin floor, not hillsides or river beds. */
const MAX_GROUND = 25;
const MIN_ABSOLUTE = 2;
const MAX_TILT = 6;

/** Deterministic pseudo-random sequence so the greybox city is stable across loads. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function City({ field }: { field: HeightField }) {
  const ref = useRef<InstancedMesh>(null);
  const blocks = useMemo(() => {
    const rand = seeded(101);
    const result: { x: number; y: number; z: number; h: number; w: number }[] = [];
    for (let tries = 0; result.length < BLOCK_COUNT && tries < BLOCK_COUNT * 20; tries++) {
      const r = 150 + rand() * 2850;
      const a = rand() * Math.PI * 2;
      const h = 10 + rand() * 110;
      const w = 30 + rand() * 50;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const corners = [-w / 2, w / 2].flatMap((dx) => [-w / 2, w / 2].map((dz) => field.heightAt(x + dx, z + dz)));
      const low = Math.min(...corners);
      if (Math.max(...corners) - low > MAX_TILT || low > MAX_GROUND || low + field.base < MIN_ABSOLUTE) continue;
      result.push({ x, y: low, z, h, w });
    }
    return result;
  }, [field]);

  useLayoutEffect(() => {
    const o = new Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.x, b.y + b.h / 2, b.z);
      o.scale.set(b.w, b.h, b.w);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.count = blocks.length;
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [blocks]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BLOCK_COUNT]}>
      <boxGeometry />
      <meshStandardMaterial color="#9a9a9a" flatShading />
    </instancedMesh>
  );
}

function Ground() {
  const field = useHeightField();
  return (
    <>
      <Terrain field={field} />
      <City field={field} />
    </>
  );
}

export function Basin() {
  return (
    <Suspense fallback={null}>
      <Ground />
    </Suspense>
  );
}
