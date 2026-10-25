import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { SCENE_AREA } from './areas';

/** Paving under the whole street scene, draped on the ground every 10 m. */
export function Ground({ ground }: { ground: (x: number, z: number) => number }) {
  const geometry = useMemo(() => {
    const { x0, x1, z0, z1 } = SCENE_AREA;
    const g = new PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / 10), Math.round((z1 - z0) / 10));
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, ground(p.getX(k), p.getZ(k)));
    g.computeVertexNormals();
    return g;
  }, [ground]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="street-ground" geometry={geometry}>
      <meshStandardMaterial color="#cfc9bd" roughness={0.95} />
    </mesh>
  );
}
