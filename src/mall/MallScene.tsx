import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, DirectionalLight, Group, HemisphereLight, Mesh, PlaneGeometry, SRGBColorSpace, ShaderMaterial, Vector3 } from 'three';
import { registerProbe } from '../debug/testHook';
import { useHeightField } from '../scene/terrain/Terrain';
import { groundAt } from '../street/groundAt';
import { useTour } from '../tour/store';
import { phaseOf, type PlaceApi } from '../walk/api';
import { DOORS } from '../walk/doors';
import { clearInput, inputFor } from '../walk/input';
import { useMallTenants } from './data';
import { Floor } from './FloorScene';
import { CHARACTER, FLOOR_Y, visibleFloors } from './floors';
import { MallPeople } from './MallPeople';
import { MallSigns } from './SignScene';
import { MallSimulation } from './simulation';
import { useMall } from './store';
import { FLOOR_IDS, type FloorId } from './types';

/** The mall stands on the ground just inside 101's south door. */
const DOOR: [number, number] = [0, 44];
/** Where the key light comes from, relative to what it lights. */
const KEY_FROM: [number, number, number] = [30, 80, 45];

// Same module as the scene's lazy import, so the panel arrives with the mall.
export { FloorPanel } from './FloorPanel';

/** A hex colour's sRGB channels: the doors' shader writes them straight out, as the page draws the same doors. */
function srgb(hex: string) {
  const c = { r: 0, g: 0, b: 0 };
  new Color(hex).getRGB(c, SRGBColorSpace);
  return new Vector3(c.r, c.g, c.b);
}

/**
 * A floor change's lift doors (src/walk/doors.ts), drawn over everything in clip space: `closed` 0 is open, 1 shut.
 * Transparent only so it draws after the mall's transparent signs and pools; every pixel it keeps is opaque.
 */
function makeDoorMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      closed: { value: 0 },
      seam: { value: 0 },
      steel: { value: srgb(DOORS.steel) },
      edge: { value: srgb(DOORS.edge) },
    },
    vertexShader: /* glsl */ `
      varying vec2 clip;
      void main() {
        clip = position.xy;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float closed;
      uniform float seam;
      uniform vec3 steel;
      uniform vec3 edge;
      varying vec2 clip;
      void main() {
        if (clip.x > -1.0 + closed && clip.x < 1.0 - closed) discard;
        vec3 colour = mix(edge, steel, (clip.y + 1.0) * 0.5);
        if (closed > 0.999 && abs(clip.x) < seam) colour = edge;
        gl_FragColor = vec4(colour, 1.0);
      }`,
  });
}

/** The 101 mall, B1 to 5F: loaded lazily the first time the visitor walks in through the south entrance. */
export default function MallScene() {
  const field = useHeightField();
  const tenants = useMallTenants();
  const base = useMemo(() => groundAt(field)(...DOOR), [field]);
  const sim = useMemo(() => new MallSimulation(tenants, base), [tenants, base]);
  const inside = useTour((s) => phaseOf(s, 'mall') !== 'paused');
  const { gl, scene, camera } = useThree();
  const mall = useRef<Group>(null);
  const floors = useRef<Partial<Record<FloorId, Group>>>({});
  const signs = useMemo(() => new MallSigns(sim.plans, base, (f) => floors.current[f]!, gl), [sim, base, gl]);
  useEffect(() => () => signs.show([]), [signs]);
  const hemi = useRef<HemisphereLight>(null);
  const key = useRef<DirectionalLight>(null);
  const fade = useRef<Mesh>(null);
  const fadeMaterial = useMemo(makeDoorMaterial, []);
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
      // The street's south door is the only way in, and it opens on MALL_ENTRY. Still in the crossing's black, the
      // signs in view are drawn and every mall material compiled, so the fade-in never stalls on either.
      arrive: async () => {
        sim.reset();
        clearInput();
        signs.show(visibleFloors(sim.floor()));
        await gl.compileAsync(mall.current!, camera, scene);
      },
    }),
    [sim, signs, gl, camera, scene],
  );

  useEffect(() => {
    useTour.getState().setPlace('mall', api);
    return () => useTour.getState().setPlace('mall', null);
  }, [api]);

  useEffect(() => {
    useMall.setState({ floor: sim.floor(), changing: sim.changing(), goTo: (f) => sim.goTo(f) });
    return () => useMall.setState({ changing: false, goTo: () => {} });
  }, [sim]);

  // Before CameraRig reads the eye pose, as on the street. The lights stay in the scene at zero outside the
  // mall, so walking in and out never changes the light count every material is compiled for.
  useFrame((_, delta) => {
    const phase = phaseOf(useTour.getState(), 'mall');
    sim.tick(phase, delta, inputFor(phase));
    const floor = sim.floor();
    const changing = sim.changing();
    const panel = useMall.getState();
    if (panel.floor !== floor || panel.changing !== changing) useMall.setState({ floor, changing });
    const shown = visibleFloors(floor);
    for (const f of FLOOR_IDS) floors.current[f]!.visible = shown.includes(f);
    // Signs only for the floors in view, swapped in the frame a floor change's doors shut, and freed once the walk
    // is out of the mall (kept while a crossing in waits, which arrive built them for).
    const tour = useTour.getState();
    if (phase !== 'paused') signs.show(shown);
    else if (tour.mode !== 'crossing' || tour.crossingTo !== 'mall') signs.show([]);
    const light = CHARACTER[floor].light;
    const on = phase !== 'paused';
    hemi.current!.color.set(light.sky);
    hemi.current!.groundColor.set(light.ground);
    hemi.current!.intensity = on ? light.hemiIntensity : 0;
    key.current!.color.set(light.key);
    key.current!.intensity = on ? light.keyIntensity : 0;
    fadeMaterial.uniforms.closed.value = sim.fade();
    // Half the seam either side of the middle, in clip units (the drawing buffer is 2 clip units wide).
    fadeMaterial.uniforms.seam.value = DOORS.seamPx / gl.domElement.width;
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
        fade: () => sim.fade(),
        signs: () => signs.floors(),
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
    [sim, signs],
  );

  return (
    <>
      <hemisphereLight ref={hemi} intensity={0} />
      <directionalLight ref={key} intensity={0} position={KEY_FROM} />
      <group ref={mall} visible={inside}>
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
