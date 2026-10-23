import { Canvas } from '@react-three/fiber';
import { CameraRig } from './scene/CameraRig';
import { World } from './scene/World';
import { useScrollProgress } from './tour/useScrollProgress';
import { Overlay } from './ui/Overlay';

export function App() {
  useScrollProgress();
  return (
    <>
      <Canvas
        style={{ position: 'fixed', inset: 0 }}
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.5, far: 60000 }}
        gl={{ logarithmicDepthBuffer: true }}
      >
        <CameraRig />
        <World />
      </Canvas>
      <Overlay />
    </>
  );
}
