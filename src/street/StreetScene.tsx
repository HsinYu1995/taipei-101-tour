import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { registerProbe } from '../debug/testHook';
import { useHeightField } from '../scene/terrain/Terrain';
import { useTour } from '../tour/store';
import { isWalkMode, phaseOf, type PlaceApi } from '../walk/api';
import { clearInput, takeInput } from '../walk/input';
import { People } from './People';
import { Scooters } from './Scooters';
import { Buildings } from './Buildings';
import { Ground } from './Ground';
import { groundAt } from './groundAt';
import { useXinyi } from './data';
import { Props } from './Props';
import { StreetSimulation } from './simulation';

export { default as WalkHud } from '../walk/WalkHud';

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
      // The only other place is the mall, whose door is 101's south entrance.
      arrive: () => {
        sim.arrive();
        clearInput();
      },
    }),
    [sim],
  );

  useEffect(() => {
    useTour.getState().setPlace('street', api);
    return () => useTour.getState().setPlace('street', null);
  }, [api]);

  // Once per frame, before CameraRig reads the eye pose (a negative priority runs earlier without taking over
  // rendering). The walk's phase decides what moves; walking into 101's south entrance crosses to the mall.
  useFrame((_, delta) => {
    const tour = useTour.getState();
    const phase = phaseOf(tour, 'street');
    sim.tick(phase, delta, takeInput());
    if (phase === 'walking' && sim.atEntrance() && !tour.mallFailed) tour.dispatch({ type: 'cross', to: 'mall' });
  }, -1);

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
