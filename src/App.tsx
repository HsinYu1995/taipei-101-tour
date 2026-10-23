import { Canvas } from '@react-three/fiber';

export function App() {
  return (
    <Canvas style={{ position: 'fixed', inset: 0 }} camera={{ position: [3, 3, 5] }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} />
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="#888" />
      </mesh>
    </Canvas>
  );
}
