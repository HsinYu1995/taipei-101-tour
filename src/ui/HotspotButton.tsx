import { en } from '../content/en';
import { isWalkMode } from '../street/api';
import { CHAPTERS } from '../tour/chapters';
import { useTour } from '../tour/store';
import { hotspotAnchor } from './hotspotAnchor';

/** The current stop's hotspot. HotspotProjector moves it to its world point; hidden until first placed. */
export function HotspotButton() {
  const stopIndex = useTour((s) => (s.segment.kind === 'stop' ? s.segment.chapterIndex : -1));
  const walking = useTour((s) => isWalkMode(s.mode));
  const dispatch = useTour((s) => s.dispatch);
  if (stopIndex < 0 || walking) return null;
  const { id } = CHAPTERS[stopIndex].hotspot;
  return (
    <button
      key={id}
      ref={(el) => {
        hotspotAnchor.el = el;
      }}
      className="hotspot"
      style={{ visibility: 'hidden' }}
      data-testid={`hotspot-${id}`}
      aria-label={en.hotspots[id].title}
      onClick={() => dispatch({ type: 'openHotspot', id })}
    />
  );
}
