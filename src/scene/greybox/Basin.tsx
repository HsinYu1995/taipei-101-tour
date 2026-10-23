import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';

const BLOCK_COUNT = 400;

/** Deterministic pseudo-random sequence so the greybox city is stable across loads. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const MOUNTAINS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const radius = i % 2 ? 9000 : 14000;
  const height = 400 + ((i * 7) % 12) * 63;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, height };
});

function City() {
  const ref = useRef<InstancedMesh>(null);
  const blocks = useMemo(() => {
    const rand = seeded(101);
    return Array.from({ length: BLOCK_COUNT }, () => {
      const r = 150 + rand() * 2850;
      const a = rand() * Math.PI * 2;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 10 + rand() * 110, w: 30 + rand() * 50 };
    });
  }, []);

  useLayoutEffect(() => {
    const o = new Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.x, b.h / 2, b.z);
      o.scale.set(b.w, b.h, b.w);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [blocks]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BLOCK_COUNT]}>
      <boxGeometry />
      <meshStandardMaterial color="#9a9a9a" flatShading />
    </instancedMesh>
  );
}

export function Basin() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[30000, 30000]} />
        <meshStandardMaterial color="#7d8a74" />
      </mesh>
      {MOUNTAINS.map((m, i) => (
        <mesh key={i} position={[m.x, m.height / 2, m.z]}>
          <coneGeometry args={[2500, m.height, 6]} />
          <meshStandardMaterial color="#5f7357" flatShading />
        </mesh>
      ))}
      <City />
    </group>
  );
}
