import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { Agent } from './crowd';
import { HIP, makePersonGeometry, SHOULDER } from './person';

type Ground = (x: number, z: number) => number;

const SHIRTS = ['#6d7f99', '#a05a4f', '#d9d4c7', '#3f5a4a', '#8a7a5c', '#4b4f63', '#b98b5e', '#7b6f8f', '#c7b9a3', '#5d7d86', '#2f3438', '#9b9b93'];
const TROUSERS = ['#2c3340', '#3d3a36', '#58534b', '#1f2226', '#6a6f78', '#4a4038'];
/** Instance sizes vary this much either side of 1. */
const SIZE_SPREAD = 0.06;
/** Limb swing in radians at full amplitude. */
const SWING = 0.5;

/** Stable 0..1 per person, from their index. */
const pick = (i: number, salt: number) => {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** The person material: per-instance shirt (instanceColor), trousers (aTrousers) and limb swing (aSwing). */
export function makePersonMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute float part;
        attribute float paint;
        attribute vec3 aTrousers;
        attribute vec2 aSwing;`,
      )
      // Skin, hair and shoes keep their own colour; shirts and trousers come per instance.
      .replace(
        '#include <color_vertex>',
        /* glsl */ `vColor = vec4(paint < 0.5 ? color : paint < 1.5 ? instanceColor : aTrousers, 1.0);`,
      )
      // Legs swing about the hip and arms about the shoulder, each in opposition to its pair.
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        if (part > 0.5) {
          float a = sin(aSwing.x) * ${SWING.toFixed(2)} * aSwing.y;
          float side = (part < 1.5 || part > 3.5) ? 1.0 : -1.0;
          float angle = a * side;
          float pivot = part < 2.5 ? ${HIP.toFixed(2)} : ${SHOULDER.toFixed(2)};
          float y = transformed.y - pivot;
          float z = transformed.z;
          transformed.y = pivot + y * cos(angle) - z * sin(angle);
          transformed.z = y * sin(angle) + z * cos(angle);
        }`,
      );
  };
  return material;
}

/** Someone who never moves: standing at (x, z) facing `heading`, `drop` metres lower when seated. */
export interface Still {
  x: number;
  z: number;
  heading: number;
  drop: number;
}

const NO_ONE: readonly Still[] = [];

/**
 * The crowd, drawn as one instanced mesh where the simulation has put them, with the people who never move
 * (`still`) after them.
 */
export function People({
  people,
  ground,
  name = 'street-people',
  still = NO_ONE,
}: {
  people: readonly Agent[];
  ground: Ground;
  name?: string;
  still?: readonly Still[];
}) {
  const ref = useRef<InstancedMesh>(null);
  const count = people.length + still.length;
  const geometry = useMemo(makePersonGeometry, []);
  const material = useMemo(makePersonMaterial, []);
  const swing = useMemo(() => new InstancedBufferAttribute(new Float32Array(count * 2), 2), [count]);
  const o = useMemo(() => new Object3D(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useLayoutEffect(() => {
    const mesh = ref.current!;
    const color = new Color();
    const trousers = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, color.set(SHIRTS[Math.floor(pick(i, 1) * SHIRTS.length)]));
      color.set(TROUSERS[Math.floor(pick(i, 2) * TROUSERS.length)]).toArray(trousers, i * 3);
    }
    mesh.instanceColor!.needsUpdate = true;
    // Per-instance attributes live on the geometry, which only this mesh uses.
    geometry.setAttribute('aTrousers', new InstancedBufferAttribute(trousers, 3));
    geometry.setAttribute('aSwing', swing);
    mesh.count = count;
    still.forEach((s, k) => {
      const i = people.length + k;
      o.position.set(s.x, ground(s.x, s.z) - s.drop, s.z);
      o.rotation.set(0, s.heading, 0);
      o.scale.setScalar(1 + (pick(i, 3) * 2 - 1) * SIZE_SPREAD);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
  }, [count, geometry, swing, people.length, still, ground, o]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const mesh = ref.current!;
    people.forEach((a, i) => {
      const size = 1 + (pick(i, 3) * 2 - 1) * SIZE_SPREAD;
      o.position.set(a.x, ground(a.x, a.z), a.z);
      o.rotation.set(0, a.heading, 0);
      o.scale.setScalar(size);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      // Ease the swing in and out as people stop and start.
      const amplitude = swing.getY(i) + ((a.moving ? 1 : 0) - swing.getY(i)) * Math.min(1, dt * 6);
      swing.setXY(i, a.phase, amplitude);
    });
    mesh.instanceMatrix.needsUpdate = true;
    swing.needsUpdate = true;
    mesh.computeBoundingSphere();
  });

  return <instancedMesh ref={ref} name={name} args={[geometry, material, count]} />;
}
