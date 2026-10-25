import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Color, DirectionalLight, Fog, HemisphereLight, Mesh, ShaderMaterial } from 'three';
import { registerProbe } from '../../debug/testHook';
import { useTour } from '../../tour/store';
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

/** Sky, sun, ambient and fog for the current scroll progress (never accumulated time, so reloads match). */
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
    const l = lightingAt(useTour.getState().progress);
    const [x, y, z] = sunDirection(l);
    sun.current!.position.set(x * SUN_DISTANCE, y * SUN_DISTANCE, z * SUN_DISTANCE);
    sun.current!.color.set(l.sunColor);
    sun.current!.intensity = l.sunIntensity;
    hemi.current!.color.set(l.skyTop);
    hemi.current!.groundColor.set(l.ground);
    hemi.current!.intensity = l.hemiIntensity;
    fog.color.set(l.fogColor);
    fog.near = l.fogNear;
    fog.far = l.fogFar;
    skyMaterial.uniforms.top.value.set(l.skyTop);
    skyMaterial.uniforms.horizon.value.set(l.skyHorizon);
    // The dome follows the camera so the horizon stays at eye level wherever the tour goes.
    sky.current!.position.copy(camera.position);
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
