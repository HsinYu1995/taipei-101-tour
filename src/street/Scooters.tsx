import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePersonMaterial } from './People';
import { HIP, makePersonGeometry, PART } from './person';
import type { Scooter } from './traffic';

type Ground = (x: number, z: number) => number;

/** Scooter paint, Taipei-street muted; trims and wheels keep their own colour. */
const PAINTS = ['#e8e4dc', '#9fb3c8', '#c94c3f', '#3b4a5a', '#d9c27a', '#7c8c6e', '#f2f2ee', '#555b61'];
const SHIRTS = ['#6d7f99', '#a05a4f', '#d9d4c7', '#3f5a4a', '#8a7a5c', '#4b4f63'];
const TROUSERS = ['#2c3340', '#3d3a36', '#1f2226', '#6a6f78'];
/** The rider's hips sit on the seat, this high. */
const SEAT = 0.72;

const pick = (i: number, salt: number) => {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** A low-poly scooter facing -z: body, floorboard, steering column, handlebar, seat and two wheels. */
function makeScooterGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const add = (g: BufferGeometry, colour: Color) => {
    const flat = g.toNonIndexed();
    g.dispose();
    const n = flat.attributes.position.count;
    flat.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n }, () => [colour.r, colour.g, colour.b]).flat(), 3));
    flat.deleteAttribute('uv');
    parts.push(flat);
  };
  const paint = new Color('#ffffff');
  const dark = new Color('#26282b');
  const seat = new Color('#3a2f2a');
  add(new BoxGeometry(0.34, 0.12, 0.8).translate(0, 0.28, -0.05), paint); // floorboard
  add(new BoxGeometry(0.36, 0.36, 0.55).translate(0, 0.5, 0.4), paint); // rear body under the seat
  add(new BoxGeometry(0.3, 0.1, 0.6).translate(0, 0.73, 0.35), seat); // seat
  add(new BoxGeometry(0.3, 0.55, 0.16).translate(0, 0.55, -0.5), paint); // front shield
  add(new BoxGeometry(0.06, 0.4, 0.06).translate(0, 0.98, -0.52), dark); // steering column
  add(new BoxGeometry(0.62, 0.05, 0.05).translate(0, 1.18, -0.5), dark); // handlebar
  for (const z of [-0.62, 0.6]) add(new CylinderGeometry(0.24, 0.24, 0.12, 8).rotateZ(Math.PI / 2).translate(0, 0.24, z), dark);
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** The person geometry sat down: legs swung forward from the hip, hips lowered onto the seat, hands to the bars. */
function makeRiderGeometry(): BufferGeometry {
  const g = makePersonGeometry();
  const position = g.attributes.position;
  const part = g.attributes.part;
  // Positive angles swing a limb forward (toward -z): feet to the floorboard, hands to the handlebar.
  const legs = 0.95;
  const arms = 1.3;
  for (let i = 0; i < position.count; i++) {
    const p = part.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);
    const swing = (pivot: number, angle: number) => {
      const dy = y - pivot;
      y = pivot + dy * Math.cos(angle) - z * Math.sin(angle);
      z = dy * Math.sin(angle) + z * Math.cos(angle);
    };
    if (p === PART.leftLeg || p === PART.rightLeg) swing(HIP, legs);
    if (p === PART.leftArm || p === PART.rightArm) swing(1.45, arms);
    position.setY(i, y - HIP + SEAT);
    position.setZ(i, z + 0.3);
  }
  g.computeBoundingSphere();
  return g;
}

/** The traffic, drawn as scooters and riders (one instanced mesh each) where the street simulation has put them. */
export function Scooters({ scooters, ground }: { scooters: readonly Scooter[]; ground: Ground }) {
  const bikes = useRef<InstancedMesh>(null);
  const riders = useRef<InstancedMesh>(null);
  const count = scooters.length;
  const scooterGeometry = useMemo(makeScooterGeometry, []);
  const riderGeometry = useMemo(makeRiderGeometry, []);
  const scooterMaterial = useMemo(() => new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5 }), []);
  const riderMaterial = useMemo(makePersonMaterial, []);
  useEffect(
    () => () => {
      scooterGeometry.dispose();
      riderGeometry.dispose();
      scooterMaterial.dispose();
      riderMaterial.dispose();
    },
    [scooterGeometry, riderGeometry, scooterMaterial, riderMaterial],
  );

  useLayoutEffect(() => {
    const color = new Color();
    const trousers = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      bikes.current!.setColorAt(i, color.set(PAINTS[Math.floor(pick(i, 4) * PAINTS.length)]));
      riders.current!.setColorAt(i, color.set(SHIRTS[Math.floor(pick(i, 5) * SHIRTS.length)]));
      color.set(TROUSERS[Math.floor(pick(i, 6) * TROUSERS.length)]).toArray(trousers, i * 3);
    }
    bikes.current!.instanceColor!.needsUpdate = true;
    riders.current!.instanceColor!.needsUpdate = true;
    riderGeometry.setAttribute('aTrousers', new InstancedBufferAttribute(trousers, 3));
    // Riders sit still: no limb swing.
    riderGeometry.setAttribute('aSwing', new InstancedBufferAttribute(new Float32Array(count * 2), 2));
  }, [count, riderGeometry]);

  const o = useMemo(() => new Object3D(), []);
  useFrame(() => {
    scooters.forEach((s, i) => {
      o.position.set(s.x, ground(s.x, s.z), s.z);
      o.rotation.set(0, s.heading, 0);
      o.updateMatrix();
      bikes.current!.setMatrixAt(i, o.matrix);
      riders.current!.setMatrixAt(i, o.matrix);
    });
    for (const mesh of [bikes.current!, riders.current!]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  });

  return (
    <group name="street-scooters">
      <instancedMesh ref={bikes} args={[scooterGeometry, scooterMaterial, count]} />
      <instancedMesh ref={riders} args={[riderGeometry, riderMaterial, count]} />
    </group>
  );
}
