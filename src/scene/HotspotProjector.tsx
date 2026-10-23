import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { CHAPTERS } from '../tour/chapters';
import { useTour } from '../tour/store';
import { hotspotAnchor } from '../ui/hotspotAnchor';

const ndc = new Vector3();

/** Projects the current stop's hotspot into screen space and moves the DOM button there. */
export function HotspotProjector() {
  useFrame(({ camera, size }) => {
    const el = hotspotAnchor.el;
    const { segment } = useTour.getState();
    if (!el || segment.kind !== 'stop') return;
    ndc.set(...CHAPTERS[segment.chapterIndex].hotspot.position).project(camera);
    const onScreen = ndc.z < 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
    el.style.visibility = onScreen ? 'visible' : 'hidden';
    const x = ((ndc.x + 1) / 2) * size.width;
    const y = ((1 - ndc.y) / 2) * size.height;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  });
  return null;
}
