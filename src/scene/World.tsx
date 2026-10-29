import { Suspense, lazy } from 'react';
import { PlaceErrorBoundary } from '../ui/PlaceErrorBoundary';
import { useTour } from '../tour/store';
import { Basin } from './greybox/Basin';
import { DamperChamber } from './greybox/DamperChamber';
import { Tower } from './tower/Tower';
import { Atmosphere } from './lighting/Atmosphere';
import { HotspotProjector } from './HotspotProjector';
import { RenderStatsProbe } from './RenderStatsProbe';

const StreetScene = lazy(() => import('../street/StreetScene'));

export function World() {
  const streetWanted = useTour((s) => s.streetWanted);
  return (
    <>
      <Atmosphere />
      <pointLight position={[0, 392, 0]} intensity={400} distance={40} />
      <Basin />
      <Tower />
      <DamperChamber />
      {streetWanted && (
        <PlaceErrorBoundary place="street">
          <Suspense fallback={null}>
            <StreetScene />
          </Suspense>
        </PlaceErrorBoundary>
      )}
      <HotspotProjector />
      <RenderStatsProbe />
    </>
  );
}
