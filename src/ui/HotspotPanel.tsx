import { useEffect, useRef } from 'react';
import { en } from '../content/en';
import { useTour } from '../tour/store';

export function HotspotPanel() {
  const id = useTour((s) => s.activeHotspot);
  const dispatch = useTour((s) => s.dispatch);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (id) closeRef.current?.focus();
  }, [id]);

  if (!id) return null;
  const copy = en.hotspots[id];
  return (
    <section className="hotspot-panel" role="dialog" aria-labelledby="hotspot-title" data-testid="hotspot-panel">
      <h3 id="hotspot-title">{copy.title}</h3>
      <p>{copy.body}</p>
      <button ref={closeRef} data-testid="hotspot-close" onClick={() => dispatch({ type: 'closeHotspot' })}>
        {en.ui.close}
      </button>
    </section>
  );
}
