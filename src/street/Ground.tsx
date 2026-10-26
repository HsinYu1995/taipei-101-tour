import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { SCENE_AREA } from './areas';
import { Drape } from './drape';
import type { XinyiData } from './types';

type Ground = (x: number, z: number) => number;

/**
 * Layers lie this far above the paving. The scene uses a logarithmic depth buffer, which makes three.js write
 * fragment depth and ignore polygonOffset, so layers separate by height instead (centimetres resolve easily
 * at street distances).
 */
const LIFT = { areas: 0.04, roads: 0.08, crossings: 0.12 };

function usePaving(ground: Ground) {
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
  return geometry;
}

function useLayer(build: (d: Drape) => void, ground: Ground, lift: number, deps: unknown[]) {
  const geometry = useMemo(() => {
    const d = new Drape();
    build(d);
    return d.build(ground, lift);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ground, lift, ...deps]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Paving under the whole street scene, with grass, plazas, roads and zebra crossings (only with `detail`) on top. */
export function Ground({ data, ground, detail }: { data: XinyiData; ground: Ground; detail: boolean }) {
  const paving = usePaving(ground);
  const grass = useLayer((d) => data.areas.filter((a) => a.kind === 'grass').forEach((a) => d.polygon(a.outer)), ground, LIFT.areas, [data]);
  const plazas = useLayer((d) => data.areas.filter((a) => a.kind === 'plaza').forEach((a) => d.polygon(a.outer)), ground, LIFT.areas, [data]);
  const roads = useLayer((d) => data.roads.forEach((r) => d.strip(r.points, r.width)), ground, LIFT.roads, [data]);
  const crossings = useLayer((d) => data.crossings.forEach((c) => d.zebra(c)), ground, LIFT.crossings, [data]);
  return (
    <group>
      <mesh name="street-ground" geometry={paving}>
        <meshStandardMaterial color="#cfc9bd" roughness={0.95} />
      </mesh>
      <mesh name="street-grass" geometry={grass}>
        <meshStandardMaterial color="#9cae7f" roughness={1} />
      </mesh>
      <mesh name="street-plazas" geometry={plazas}>
        <meshStandardMaterial color="#ddd6c8" roughness={0.95} />
      </mesh>
      <mesh name="street-roads" geometry={roads}>
        <meshStandardMaterial color="#5d6064" roughness={0.9} />
      </mesh>
      <mesh name="street-crossings" geometry={crossings} visible={detail}>
        <meshStandardMaterial color="#e9e9e4" roughness={0.8} />
      </mesh>
    </group>
  );
}
