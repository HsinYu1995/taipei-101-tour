import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BoxGeometry, BufferGeometry, Color, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeFacadeTexture } from '../scene/tower/facadeTexture';
import { extrude } from './extrude';
import { LANDMARKS } from './landmarks';
import type { BuildingShape, LandmarkId, P, XinyiData } from './types';

const CONCRETE = { top: '#d9dcde', bottom: '#b9bec2', band: '#eceae4', mullion: '#9aa0a4' };
/** Skybridge decks: underside 6 m above the street (the second floor), 3.2 m tall, 4 m wide. */
const SKYBRIDGE = { above: 6, height: 3.2, width: 4 };
/** The Vieshow screen cycles slowly between these. */
const SCREEN = [new Color('#5a86ff'), new Color('#b46cff')];
const SCREEN_PERIOD_S = 12;

type Ground = (x: number, z: number) => number;

function useDisposable<T extends { dispose(): void }>(make: () => T, deps: unknown[]) {
  const value = useMemo(make, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

function facadeMaterial(glass: (typeof LANDMARKS)[LandmarkId]['glass'], vertexColors: boolean) {
  return new MeshStandardMaterial({ map: makeFacadeTexture(glass), vertexColors, flatShading: true, roughness: 0.85 });
}

/** Every ordinary building as one mesh, tinted per building over a concrete facade. */
function Generic({ shapes, ground }: { shapes: BuildingShape[]; ground: Ground }) {
  const geometry = useDisposable(() => extrude(shapes, ground), [shapes, ground]);
  const material = useDisposable(() => facadeMaterial(CONCRETE, true), []);
  return <mesh name="street-buildings" geometry={geometry} material={material} />;
}

/** The big screen on a landmark's north face, centred on it, as a box standing 0.3 m proud of the wall. */
function Screen({ shapes, ground, screen }: { shapes: BuildingShape[]; ground: Ground; screen: NonNullable<(typeof LANDMARKS)[LandmarkId]['screen']> }) {
  const material = useDisposable(() => new MeshStandardMaterial({ color: '#111', emissive: SCREEN[0].clone(), emissiveIntensity: 1.6 }), []);
  const position = useMemo(() => {
    const pts = shapes.flatMap((s) => s.outer);
    const x = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
    // The northernmost wall crossing the landmark's middle.
    let north = Infinity;
    for (const { outer } of shapes) {
      outer.forEach(([ax, az], i) => {
        const [bx, bz] = outer[(i + 1) % outer.length];
        if ((ax - x) * (bx - x) > 0 || ax === bx) return;
        north = Math.min(north, az + ((x - ax) / (bx - ax)) * (bz - az));
      });
    }
    const floor = Math.min(...pts.map(([px, pz]) => ground(px, pz)));
    return new Vector3(x, floor + screen.above + screen.height / 2, north - 0.3);
  }, [shapes, ground, screen]);
  useFrame(({ clock }) => {
    const t = (Math.sin((clock.elapsedTime / SCREEN_PERIOD_S) * 2 * Math.PI) + 1) / 2;
    material.emissive.copy(SCREEN[0]).lerp(SCREEN[1], t);
  });
  return (
    <mesh position={position} material={material}>
      <boxGeometry args={[screen.width, screen.height, 0.6]} />
    </mesh>
  );
}

function Landmark({ id, shapes, ground }: { id: LandmarkId; shapes: BuildingShape[]; ground: Ground }) {
  const look = LANDMARKS[id];
  const geometry = useDisposable(() => extrude(shapes.map((s) => ({ ...s, colour: '#ffffff' })), ground), [shapes, ground]);
  const material = useDisposable(() => facadeMaterial(look.glass, false), [look]);
  return (
    <group name={`street-landmark-${id}`}>
      <mesh geometry={geometry} material={material} />
      {look.screen && <Screen shapes={shapes} ground={ground} screen={look.screen} />}
    </group>
  );
}

/** Elevated walkways as glass boxes along their OSM lines. Scenery only: not walkable, not collided with. */
function Skybridges({ lines, ground }: { lines: P[][]; ground: Ground }) {
  const geometry = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        const [ax, az] = line[i - 1];
        const [bx, bz] = line[i];
        const length = Math.hypot(bx - ax, bz - az);
        if (length < 0.5) continue;
        const floor = Math.min(ground(ax, az), ground(bx, bz));
        // Overlap the joints by half a width so bends have no gaps.
        const box = new BoxGeometry(length + SKYBRIDGE.width / 2, SKYBRIDGE.height, SKYBRIDGE.width);
        q.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax));
        m.compose(new Vector3((ax + bx) / 2, floor + SKYBRIDGE.above + SKYBRIDGE.height / 2, (az + bz) / 2), q, new Vector3(1, 1, 1));
        parts.push(box.applyMatrix4(m));
      }
    }
    const merged = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [lines, ground]);
  const material = useDisposable(
    () => new MeshStandardMaterial({ color: '#9fc1c9', transparent: true, opacity: 0.85, roughness: 0.3, flatShading: true }),
    [],
  );
  return <mesh name="street-skybridges" geometry={geometry} material={material} />;
}

/** All of Xinyi's real buildings: ordinary ones, the five landmarks, and the skybridges between them. */
export function Buildings({ data, ground }: { data: XinyiData; ground: Ground }) {
  const { generic, landmarks } = useMemo(() => {
    const generic: BuildingShape[] = [];
    const landmarks = new Map<LandmarkId, BuildingShape[]>();
    for (const b of data.buildings) {
      if (b.landmark) landmarks.set(b.landmark, [...(landmarks.get(b.landmark) ?? []), b]);
      else generic.push(b);
    }
    return { generic, landmarks: [...landmarks] };
  }, [data]);
  return (
    <group>
      <Generic shapes={generic} ground={ground} />
      {landmarks.map(([id, shapes]) => (
        <Landmark key={id} id={id} shapes={shapes} ground={ground} />
      ))}
      <Skybridges lines={data.skybridges} ground={ground} />
    </group>
  );
}
