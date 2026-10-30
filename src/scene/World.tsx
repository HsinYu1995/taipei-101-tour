import { Suspense, lazy } from 'react';
import { PlaceErrorBoundary } from '../ui/PlaceErrorBoundary';
import { useTour } from '../tour/store';
import { phaseOf } from '../walk/api';
import { Basin } from './greybox/Basin';
import { DamperChamber } from './greybox/DamperChamber';
import { Tower } from './tower/Tower';
import { Atmosphere } from './lighting/Atmosphere';
import { HotspotProjector } from './HotspotProjector';
import { RenderStatsProbe } from './RenderStatsProbe';

const StreetScene = lazy(() => import('../street/StreetScene'));
const MallScene = lazy(() => import('../mall/MallScene'));

export function World() {
  // A place given up on (its download failed or never came) is dropped, so a late arrival never mounts it.
  const streetWanted = useTour((s) => s.streetWanted && !s.streetFailed);
  const mallWanted = useTour((s) => s.mallWanted && !s.mallFailed);
  // Inside the mall the outdoor world is hidden (Atmosphere drops the sky, sun and fog itself).
  const inMall = useTour((s) => phaseOf(s, 'mall') !== 'paused');
  return (
    <>
      <Atmosphere />
      <pointLight position={[0, 392, 0]} intensity={400} distance={40} />
      <group visible={!inMall}>
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
      </group>
      {mallWanted && (
        <PlaceErrorBoundary place="mall">
          <Suspense fallback={null}>
            <MallScene />
          </Suspense>
        </PlaceErrorBoundary>
      )}
      <HotspotProjector />
      <RenderStatsProbe />
    </>
  );
}
