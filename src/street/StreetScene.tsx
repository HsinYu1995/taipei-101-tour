import { useEffect, useMemo } from 'react';
import { useHeightField } from '../scene/terrain/Terrain';
import { useTour } from '../tour/store';
import { EYE_HEIGHT, LANDING, eyePose, type StreetApi } from './api';
import { Ground } from './Ground';
import { groundAt } from './groundAt';

/** The Xinyi street walk: loaded lazily the first time the visitor explores the tower chapter. */
export default function StreetScene() {
  const field = useHeightField();
  const ground = useMemo(() => groundAt(field), [field]);
  const api = useMemo<StreetApi>(() => {
    const landing = () => eyePose(LANDING.x, ground(LANDING.x, LANDING.z) + EYE_HEIGHT, LANDING.z, LANDING.yaw, LANDING.pitch);
    return { landing, reset: () => {}, step: () => landing() };
  }, [ground]);

  useEffect(() => {
    useTour.getState().setStreet(api);
    return () => useTour.getState().setStreet(null);
  }, [api]);

  return <Ground ground={ground} />;
}
