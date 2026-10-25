import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Object3D, Raycaster, Vector3 } from 'three';
import { registerProbe } from '../debug/testHook';

function nameOf(o: Object3D | null): string {
  for (; o; o = o.parent) if (o.name) return o.name;
  return '';
}

/** Registers the renderStats and castRay probes for e2e tests; renders nothing. */
export function RenderStatsProbe() {
  const { gl, scene } = useThree();
  const last = useRef({ calls: 0, triangles: 0 });

  // gl.info resets when a render starts, so at the start of a frame it still holds the previous frame's counts.
  // (A positive useFrame priority would take over rendering, so this stays at the default.)
  useFrame(() => {
    last.current = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
  });

  useEffect(() => registerProbe('renderStats', () => ({ ...last.current })), []);

  useEffect(() => {
    const ray = new Raycaster();
    return registerProbe('castRay', (origin, dir) => {
      ray.set(new Vector3(...origin), new Vector3(...dir).normalize());
      const hit = ray.intersectObject(scene, true)[0];
      return hit ? { point: [hit.point.x, hit.point.y, hit.point.z], name: nameOf(hit.object) } : null;
    });
  }, [scene]);

  return null;
}
