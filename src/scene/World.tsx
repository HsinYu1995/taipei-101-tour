import { Basin } from './greybox/Basin';
import { DamperChamber } from './greybox/DamperChamber';
import { Tower } from './greybox/Tower';

export function World() {
  return (
    <>
      <color attach="background" args={['#cdd6dc']} />
      <fog attach="fog" args={['#cdd6dc', 8000, 30000]} />
      <hemisphereLight args={['#ffffff', '#5f7357', 0.9]} />
      <directionalLight position={[3000, 6000, 2000]} intensity={1.6} />
      <pointLight position={[0, 392, 0]} intensity={400} distance={40} />
      <Basin />
      <Tower />
      <DamperChamber />
    </>
  );
}
