import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AmbientLight, DirectionalLight, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { registerProbe } from '../debug/testHook';
import { useHeightField } from '../scene/terrain/Terrain';
import { groundAt } from '../street/groundAt';
import { useTour } from '../tour/store';
import { phaseOf, type PlaceApi } from '../walk/api';
import { clearInput, inputFor } from '../walk/input';
import { useMallTenants } from './data';
import { Floor } from './FloorScene';
import { CHARACTER, FLOOR_Y, visibleFloors } from './floors';
import { MallPeople } from './MallPeople';
import { MallSimulation } from './simulation';
import { FLOOR_IDS, type FloorId } from './types';

/** The mall stands on the ground just inside 101's south door. */
const DOOR: [number, number] = [0, 44];
/** Where the key light comes from, relative to what it lights. */
const KEY_FROM: [number, number, number] = [30, 80, 45];

/** A floor change's black, drawn over everything in clip space. */
function makeFadeMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: { opacity: { value: 0 } },
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, opacity); }`,
  });
}

/** The 101 mall, B1 to 5F: loaded lazily the first time the visitor walks in through the south entrance. */
export default function MallScene() {
  const field = useHeightField();
  const tenants = useMallTenants();
  const base = useMemo(() => groundAt(field)(...DOOR), [field]);
  const sim = useMemo(() => new MallSimulation(tenants, base), [tenants, base]);
  const inside = useTour((s) => phaseOf(s, 'mall') !== 'paused');
  const floors = useRef<Partial<Record<FloorId, Group>>>({});
  const ambient = useRef<AmbientLight>(null);
  const key = useRef<DirectionalLight>(null);
  const fade = useRef<Mesh>(null);
  const fadeMaterial = useMemo(makeFadeMaterial, []);
  const fadeGeometry = useMemo(() => new PlaneGeometry(2, 2), []);
  useEffect(
    () => () => {
      fadeMaterial.dispose();
      fadeGeometry.dispose();
    },
    [fadeMaterial, fadeGeometry],
  );

  const api = useMemo<PlaceApi>(
    () => ({
      landing: () => sim.landing(),
      reset: () => {
        sim.reset();
        clearInput();
      },
      eye: () => sim.eye(),
      // The street's south door is the only way in, and it opens on MALL_ENTRY.
      arrive: () => {
        sim.reset();
        clearInput();
      },
    }),
    [sim],
  );

  useEffect(() => {
    useTour.getState().setPlace('mall', api);
    return () => useTour.getState().setPlace('mall', null);
  }, [api]);

  // Before CameraRig reads the eye pose, as on the street. The lights stay in the scene at zero outside the
  // mall, so walking in and out never changes the light count every material is compiled for.
  useFrame((_, delta) => {
    const phase = phaseOf(useTour.getState(), 'mall');
    sim.tick(phase, delta, inputFor(phase));
    const floor = sim.floor();
    const shown = visibleFloors(floor);
    for (const f of FLOOR_IDS) floors.current[f]!.visible = shown.includes(f);
    const light = CHARACTER[floor].light;
    const on = phase !== 'paused';
    ambient.current!.color.set(light.ambient);
    ambient.current!.intensity = on ? light.ambientIntensity : 0;
    key.current!.color.set(light.key);
    key.current!.intensity = on ? light.keyIntensity : 0;
    fadeMaterial.uniforms.opacity.value = sim.fade();
    fade.current!.visible = sim.fade() > 0;
  }, -1);

  useEffect(
    () =>
      registerProbe('mall', {
        visitor: () => sim.visitor(),
        place: ({ x, z, yaw, pitch }) => sim.place(x, z, yaw, pitch),
        floor: () => sim.floor(),
        goTo: (floor) => sim.goTo(floor),
        changing: () => sim.changing(),
        blocked: (x, z) => sim.blocked(x, z),
        eyeY: () => sim.eye().position[1],
        people: () => sim.people(sim.floor()).map(({ x, z, moving }) => ({ x, z, moving })),
        shopfront: (name) => {
          const front = sim.plans[sim.floor()].shopfronts.find((s) => s.tenant.name === name);
          return front ? { a: front.a, b: front.b } : null;
        },
        voidCentre: () => {
          const ring = sim.plans['3F'].void;
          return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
        },
      }),
    [sim],
  );

  return (
    <>
      <ambientLight ref={ambient} intensity={0} />
      <directionalLight ref={key} intensity={0} position={KEY_FROM} />
      <group visible={inside}>
        {FLOOR_IDS.map((f) => (
          <group key={f} ref={(g) => void (floors.current[f] = g ?? undefined)}>
            <Floor plan={sim.plans[f]} base={base} />
            <MallPeople plan={sim.plans[f]} crowd={sim.people(f)} y={base + FLOOR_Y[f]} />
          </group>
        ))}
        <mesh
          ref={fade}
          name="mall-fade"
          geometry={fadeGeometry}
          material={fadeMaterial}
          visible={false}
          frustumCulled={false}
          renderOrder={1000}
          raycast={() => {}}
        />
      </group>
    </>
  );
}
