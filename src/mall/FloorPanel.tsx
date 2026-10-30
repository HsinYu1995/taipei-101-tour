import { en } from '../content/en';
import type { PlaceId } from '../tour/machine';
import { useTour } from '../tour/store';
import { useMall } from './store';
import { FLOOR_IDS, type FloorId } from './types';

/** Top to bottom, as a lift's buttons read. */
const BUTTONS = [...FLOOR_IDS].reverse();

/** Ways out of the mall from the panel, each offered on its floor once a floor change has ended. */
const EXITS: readonly { floor: FloorId; label: string; to: PlaceId | 'damper' }[] = [
  // The trip up starts at the 5F ticket hall, as in the building.
  { floor: '5F', label: en.ui.lift, to: 'damper' },
];

/** The floor panel: the only way between the mall's floors, and from 5F the lift up the tower. */
export function FloorPanel() {
  const shown = useTour((s) => s.mode === 'walking' && s.place === 'mall');
  const floor = useMall((s) => s.floor);
  const changing = useMall((s) => s.changing);
  if (!shown) return null;
  return (
    <nav className="floor-panel" data-testid="floor-panel" aria-label={en.ui.floors}>
      {BUTTONS.map((f) => (
        <button key={f} data-testid={`floor-${f}`} aria-pressed={f === floor} onClick={() => useMall.getState().goTo(f)}>
          {f}
        </button>
      ))}
      {!changing &&
        EXITS.filter((e) => e.floor === floor).map((e) => (
          <button
            key={e.to}
            className="floor-exit"
            data-testid="floor-lift"
            onClick={() => useTour.getState().dispatch({ type: 'cross', to: e.to })}
          >
            {e.label}
          </button>
        ))}
    </nav>
  );
}
