import { Basin } from './greybox/Basin';
import { DamperChamber } from './greybox/DamperChamber';
import { Tower } from './tower/Tower';
import { Atmosphere } from './lighting/Atmosphere';
import { HotspotProjector } from './HotspotProjector';
import { RenderStatsProbe } from './RenderStatsProbe';

export function World() {
  return (
    <>
      <Atmosphere />
      <pointLight position={[0, 392, 0]} intensity={400} distance={40} />
      <Basin />
      <Tower />
      <DamperChamber />
      <HotspotProjector />
      <RenderStatsProbe />
    </>
  );
}
