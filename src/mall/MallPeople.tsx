import { useCallback, useMemo } from 'react';
import { People, type Still } from '../street/People';
import type { Agent } from '../street/crowd';
import type { FloorPlan } from './layout';

/** A seated person is the standing figure lowered onto the seat. */
const SEAT_DROP = 0.45;

/** One floor's shoppers: its walking crowd, the seated (lowered, facing their table) and the ticket queue. */
export function MallPeople({ plan, crowd, y }: { plan: FloorPlan; crowd: readonly Agent[]; y: number }) {
  const ground = useCallback(() => y, [y]);
  const still = useMemo(
    (): Still[] => [
      ...plan.seats.map(({ x, z, yaw }) => ({ x, z, heading: yaw, drop: SEAT_DROP })),
      ...plan.queue.map(({ x, z, yaw }) => ({ x, z, heading: yaw, drop: 0 })),
    ],
    [plan],
  );
  return <People name={`mall-people-${plan.floor}`} people={crowd} ground={ground} still={still} />;
}
