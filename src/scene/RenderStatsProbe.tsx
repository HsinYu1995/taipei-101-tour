import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { registerProbe } from '../debug/testHook';
import type { Rect } from '../street/types';

function nameOf(o: Object3D | null): string {
  for (; o; o = o.parent) if (o.name) return o.name;
  return '';
}

/** Raycasts ignore `visible`; the probe should not see what is not drawn. */
function visible(o: Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function emissiveOf(o: Object3D) {
  const m = (o as Mesh).material as MeshStandardMaterial | undefined;
  if (!m || Array.isArray(m) || !m.emissive) return 0;
  const { r, g, b } = m.emissive;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) * (m.emissiveIntensity ?? 1);
}

/** True where a mesh's fragments are discarded (the terrain under the street walk), which raycasts cannot see. */
function inHole(o: Object3D, p: Vector3) {
  const hole = o.userData.hole as Rect | null | undefined;
  return !!hole && p.x > hole.x0 && p.x < hole.x1 && p.z > hole.z0 && p.z < hole.z1;
}

/** Registers the renderStats and castRay probes for e2e tests; renders nothing. */
export function RenderStatsProbe() {
  const { gl, scene } = useThree();
  const last = useRef({ calls: 0, triangles: 0, programs: 0 });

  // gl.info resets when a render starts, so at the start of a frame it still holds the previous frame's counts.
  // (A positive useFrame priority would take over rendering, so this stays at the default.)
  useFrame(() => {
    last.current = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, programs: gl.info.programs?.length ?? 0 };
  });

  useEffect(() => registerProbe('renderStats', () => ({ ...last.current })), []);

  useEffect(() => {
    const ray = new Raycaster();
    return registerProbe('castRay', (origin, dir) => {
      ray.set(new Vector3(...origin), new Vector3(...dir).normalize());
      const hit = ray.intersectObject(scene, true).find((h) => visible(h.object) && !inHole(h.object, h.point));
      return hit ? { point: [hit.point.x, hit.point.y, hit.point.z], name: nameOf(hit.object), emissive: emissiveOf(hit.object) } : null;
    });
  }, [scene]);

  return null;
}
