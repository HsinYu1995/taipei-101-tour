import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { registerProbe } from '../debug/testHook';
import { useHeightField } from '../scene/terrain/Terrain';
import { useTour } from '../tour/store';
import { isWalkMode, type PlaceApi } from './api';
import { People } from './People';
import { Scooters } from './Scooters';
import { Buildings } from './Buildings';
import { Ground } from './Ground';
import { groundAt } from './groundAt';
import { useXinyi } from './data';
import { clearInput, takeInput } from './input';
import { Props } from './Props';
import { StreetSimulation } from './simulation';

export { default as StreetHud } from './StreetHud';

/** The Xinyi street walk: loaded lazily the first time the visitor explores the tower chapter. */
export default function StreetScene() {
  const field = useHeightField();
  const data = useXinyi();
  const walking = useTour((s) => isWalkMode(s.mode));
  const ground = useMemo(() => groundAt(field), [field]);
  const sim = useMemo(() => new StreetSimulation(data, ground), [data, ground]);
  const api = useMemo<PlaceApi>(
    () => ({
      landing: () => sim.landing(),
      reset: () => {
        sim.reset();
        clearInput();
      },
      eye: () => sim.eye(),
    }),
    [sim],
  );

  useEffect(() => {
    useTour.getState().setPlace('street', api);
    return () => useTour.getState().setPlace('street', null);
  }, [api]);

  // Once per frame, before CameraRig reads the eye pose (a negative priority runs earlier without taking over
  // rendering). The simulation itself decides what moves in which mode.
  useFrame((_, delta) => sim.tick(useTour.getState().mode, delta, takeInput()), -1);

  useEffect(
    () =>
      registerProbe('street', {
        visitor: () => sim.visitor(),
        place: ({ x, z, yaw, pitch }) => sim.place(x, z, yaw, pitch),
        people: () => sim.people.map(({ x, z, moving }) => ({ x, z, moving })),
        scooters: () => sim.scooters.map(({ x, z }) => ({ x, z })),
      }),
    [sim],
  );

  return (
    <group>
      <Ground data={data} ground={ground} detail={walking} />
      <Buildings data={data} ground={ground} />
      {/* Street-level detail: a few pixels from the tour's viewpoints, but tens of thousands of triangles. */}
      <group visible={walking}>
        <Props trees={sim.trees} lamps={data.lamps} ground={ground} />
        <People people={sim.people} ground={ground} />
        <Scooters scooters={sim.scooters} ground={ground} />
      </group>
    </group>
  );
}
