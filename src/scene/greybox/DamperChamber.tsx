import { BackSide } from 'three';

const CENTER_Y = 380;
const SPHERE_RADIUS = 2.75;
const CABLE_CORNERS = [
  [-1.5, -1.5],
  [-1.5, 1.5],
  [1.5, -1.5],
  [1.5, 1.5],
] as const;

/** Greybox damper room inside the tower: walls face inward, sphere hangs on four cables. */
export function DamperChamber() {
  return (
    <group position={[0, CENTER_Y, 0]}>
      <mesh>
        <boxGeometry args={[20, 30, 20]} />
        <meshStandardMaterial color="#6b6b6b" side={BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS, 16, 12]} />
        <meshStandardMaterial color="#c9a227" flatShading />
      </mesh>
      {CABLE_CORNERS.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 8.5, z]}>
          <cylinderGeometry args={[0.08, 0.08, 12]} />
          <meshStandardMaterial color="#444444" />
        </mesh>
      ))}
    </group>
  );
}
