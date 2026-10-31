import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Color, DirectionalLight, Fog, HemisphereLight, Mesh, ShaderMaterial } from 'three';
import { registerProbe } from '../../debug/testHook';
import { useTour } from '../../tour/store';
import { phaseOf } from '../../walk/api';
import { lightingAt, sunDirection } from './timeOfDay';

const SUN_DISTANCE = 20000;
const SKY_RADIUS = 50000;

/** Vertical gradient from the horizon colour to the top colour by view elevation; drawn behind everything. */
function makeSkyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new Color() }, horizon: { value: new Color() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = max(normalize(vDir).y, 0.0);
        gl_FragColor = vec4(mix(horizon, top, pow(h, 0.6)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Fog this far off draws nothing: inside the mall, with no recompile of every fogged material. */
const NO_FOG = 1e9;

/**
 * Sky, sun, ambient and fog for the current scroll progress (never accumulated time, so reloads match). Inside the
 * mall all four are off, and the mall lights itself; the lights stay in the scene at zero.
 */
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const sky = useRef<Mesh>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const skyMaterial = useMemo(makeSkyMaterial, []);
  const fog = useMemo(() => new Fog('#ffffff', 1, 2), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);
  useEffect(() => () => skyMaterial.dispose(), [skyMaterial]);

  useFrame(({ camera }) => {
    const tour = useTour.getState();
    const outdoors = phaseOf(tour, 'mall') === 'paused';
    const l = lightingAt(tour.progress);
    const [x, y, z] = sunDirection(l);
    sun.current!.position.set(x * SUN_DISTANCE, y * SUN_DISTANCE, z * SUN_DISTANCE);
    sun.current!.color.set(l.sunColor);
    sun.current!.intensity = outdoors ? l.sunIntensity : 0;
    hemi.current!.color.set(l.skyTop);
    hemi.current!.groundColor.set(l.ground);
    hemi.current!.intensity = outdoors ? l.hemiIntensity : 0;
    fog.color.set(l.fogColor);
    fog.near = outdoors ? l.fogNear : NO_FOG;
    fog.far = outdoors ? l.fogFar : 2 * NO_FOG;
    skyMaterial.uniforms.top.value.set(l.skyTop);
    skyMaterial.uniforms.horizon.value.set(l.skyHorizon);
    // The dome follows the camera so the horizon stays at eye level wherever the tour goes.
    sky.current!.position.copy(camera.position);
    sky.current!.visible = outdoors;
  });

  useEffect(
    () =>
      registerProbe('atmosphere', () => {
        const d = sun.current!.position.clone().normalize();
        return { fogColor: `#${fog.color.getHexString()}`, sunDirection: [d.x, d.y, d.z] };
      }),
    [fog],
  );

  return (
    <>
      {/* Not raycastable: probes and pointer picks should never hit the backdrop. */}
      <mesh ref={sky} name="sky" material={skyMaterial} renderOrder={-1} frustumCulled={false} raycast={() => {}}>
        <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      </mesh>
      <directionalLight ref={sun} />
      <hemisphereLight ref={hemi} />
    </>
  );
}
