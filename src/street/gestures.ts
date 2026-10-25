import type { CameraControlsImpl } from '@react-three/drei';
import { useEffect, type RefObject } from 'react';
import { CHAPTERS } from '../tour/chapters';
import { useTour } from '../tour/store';
import { STREET_CHAPTER, canWalk } from './api';

/** A two-finger spread or pinch must change the finger distance by this much to count. */
const PINCH_PX = 60;

/**
 * Zooming past the tower chapter's closest explore distance (wheel up, or a two-finger spread) goes down to
 * the street; zooming out while walking (wheel down, or a pinch) comes back up. Passive observers only:
 * camera-controls keeps handling the same events for its own dolly.
 */
export function useStreetGestures(el: HTMLElement, controls: RefObject<CameraControlsImpl | null>) {
  useEffect(() => {
    const atClosest = () => {
      const c = controls.current;
      const { mode, segment } = useTour.getState();
      if (!c || mode !== 'explore' || segment.kind !== 'stop') return false;
      const chapter = CHAPTERS[segment.chapterIndex];
      return chapter.id === STREET_CHAPTER && canWalk() && c.distance <= chapter.explore.minDistance + 1;
    };
    const dispatch = (type: 'streetEnter' | 'streetExit') => useTour.getState().dispatch({ type });

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && atClosest()) dispatch('streetEnter');
      else if (e.deltaY > 0 && useTour.getState().mode === 'street') dispatch('streetExit');
    };

    // Touches that started on the canvas (the street thumbstick sits above it, so its touches never count).
    const touches = new Map<number, { x: number; y: number }>();
    let startSpread: number | null = null;
    const spread = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      startSpread = touches.size === 2 ? spread() : null;
    };
    const onMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (startSpread === null || touches.size !== 2) return;
      const change = spread() - startSpread;
      if (change > PINCH_PX && atClosest()) {
        startSpread = null;
        dispatch('streetEnter');
      } else if (change < -PINCH_PX && useTour.getState().mode === 'street') {
        startSpread = null;
        dispatch('streetExit');
      }
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      startSpread = null;
    };

    el.addEventListener('wheel', onWheel, { capture: true, passive: true });
    el.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true });
      el.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [el, controls]);
}
