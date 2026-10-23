const ROOF = 449;
const SPIRE_TOP = 508;
const SEGMENT_HEIGHT = 33.6;
const SEGMENTS = 8;
const BASE_HEIGHT = ROOF - SEGMENTS * SEGMENT_HEIGHT;

/** Greybox Taipei 101. Default FrontSide materials make it invisible from inside. */
export function Tower() {
  return (
    <group>
      <mesh position={[0, BASE_HEIGHT / 2, 0]}>
        <boxGeometry args={[60, BASE_HEIGHT, 60]} />
        <meshStandardMaterial color="#b8bcbf" flatShading />
      </mesh>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <mesh key={i} position={[0, BASE_HEIGHT + SEGMENT_HEIGHT * (i + 0.5), 0]}>
          <boxGeometry args={[46, SEGMENT_HEIGHT * 0.96, 46]} />
          <meshStandardMaterial color="#a9b4b8" flatShading />
        </mesh>
      ))}
      <mesh position={[0, (ROOF + SPIRE_TOP) / 2, 0]}>
        <cylinderGeometry args={[0.8, 1.5, SPIRE_TOP - ROOF, 6]} />
        <meshStandardMaterial color="#c9c9c9" />
      </mesh>
    </group>
  );
}
