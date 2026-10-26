import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { P } from './types';

type Ground = (x: number, z: number) => number;

/** Street trees: a 3 m trunk under a canopy 2.2 to 3.2 m in radius, tinted between two greens. */
const TREE = { trunk: 3, canopy: [2.2, 3.2], tints: [new Color('#6f8f5a'), new Color('#86a46a')] };
/** Street lamps: a 6 m pole with a head. */
const LAMP = { height: 6 };

/** Stable 0..1 jitter from a position, so trees vary in size without changing between visits. */
const jitter = ([x, z]: P) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Instances standing on the ground at each point, each turned at random; `place` sets anything more. */
function useInstances(points: P[], ground: Ground, place?: (o: Object3D, p: P, mesh: InstancedMesh, i: number) => void) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const o = new Object3D();
    points.forEach((p, i) => {
      o.position.set(p[0], ground(p[0], p[1]), p[1]);
      o.rotation.set(0, jitter(p) * Math.PI * 2, 0);
      o.scale.set(1, 1, 1);
      place?.(o, p, mesh, i);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [points, ground, place]);
  return ref;
}

function useOwned<T extends { dispose(): void }>(make: () => T) {
  const value = useMemo(make, []);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

function Trees({ points, ground }: { points: P[]; ground: Ground }) {
  const trunk = useOwned(() => new CylinderGeometry(0.15, 0.2, TREE.trunk, 6).translate(0, TREE.trunk / 2, 0));
  // A unit canopy, scaled per tree and lifted so it sits on the trunk whatever its size.
  const canopy = useOwned(() => new IcosahedronGeometry(1, 0).translate(0, 0.8, 0));
  const bark = useOwned(() => new MeshStandardMaterial({ color: '#6b5440', roughness: 1 }));
  const leaves = useOwned(() => new MeshStandardMaterial({ roughness: 1, flatShading: true }));
  const crown = useMemo(() => {
    const color = new Color();
    return (o: Object3D, p: P, mesh: InstancedMesh, i: number) => {
      const t = jitter([p[1], p[0]]);
      const r = TREE.canopy[0] + jitter(p) * (TREE.canopy[1] - TREE.canopy[0]);
      o.position.y += TREE.trunk;
      o.scale.set(r, r, r);
      mesh.setColorAt(i, color.copy(TREE.tints[0]).lerp(TREE.tints[1], t));
    };
  }, []);
  const trunks = useInstances(points, ground);
  const canopies = useInstances(points, ground, crown);
  return (
    <group name="street-trees">
      <instancedMesh ref={trunks} args={[trunk, bark, points.length]} />
      <instancedMesh ref={canopies} args={[canopy, leaves, points.length]} />
    </group>
  );
}

function Lamps({ points, ground }: { points: P[]; ground: Ground }) {
  const geometry = useOwned(() => {
    const pole = new CylinderGeometry(0.07, 0.1, LAMP.height, 6).translate(0, LAMP.height / 2, 0);
    const head = new ConeGeometry(0.35, 0.4, 6).translate(0, LAMP.height, 0);
    const merged = mergeGeometries([pole, head])!;
    pole.dispose();
    head.dispose();
    return merged;
  });
  const material = useOwned(() => new MeshStandardMaterial({ color: '#4a4f54', roughness: 0.6, metalness: 0.4 }));
  const ref = useInstances(points, ground);
  return <instancedMesh name="street-lamps" ref={ref} args={[geometry, material, points.length]} />;
}

/** Street furniture: trees (OSM's plus the park fill) and OSM lamps. Trunks block the visitor (see StreetScene). */
export function Props({ trees, lamps, ground }: { trees: P[]; lamps: P[]; ground: Ground }) {
  return (
    <>
      <Trees points={trees} ground={ground} />
      <Lamps points={lamps} ground={ground} />
    </>
  );
}
