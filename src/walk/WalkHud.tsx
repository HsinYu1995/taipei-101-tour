import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { en } from '../content/en';
import type { PlaceId } from '../tour/machine';
import { useTour } from '../tour/store';
import { clearInput, input } from './input';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
/** How long the hint stays up if the visitor never moves. */
const HINT_MS = 6000;
const HINT_FADE_MS = 400;
/** Thumbstick: full deflection at this many pixels from the centre. */
const STICK_RANGE_PX = 50;

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

/** Each place says how to leave it: the street rises to the tour, the mall goes back to the street. */
const HINTS: Record<PlaceId, { desktop: string; touch: string }> = {
  street: { desktop: en.ui.walkHintDesktop, touch: en.ui.walkHintTouch },
  mall: { desktop: en.ui.mallHintDesktop, touch: en.ui.mallHintTouch },
};

/** Walk controls: keys, look drags, the touch thumbstick, and the landing hint. */
export default function WalkHud() {
  const walking = useTour((s) => s.mode === 'walking');
  const place = useTour((s) => s.place);
  const [hint, setHint] = useState<'shown' | 'fading' | 'gone'>('gone');
  const hideHint = useRef(() => {});

  // Hint: up on landing; fades after a while or on the first movement.
  useEffect(() => {
    if (!walking) {
      setHint('gone');
      return;
    }
    input.moved = false;
    setHint('shown');
    let fade: number | undefined;
    hideHint.current = () => {
      if (fade !== undefined) return;
      setHint('fading');
      fade = window.setTimeout(() => setHint('gone'), HINT_FADE_MS);
    };
    const timer = window.setTimeout(() => hideHint.current(), HINT_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fade);
      hideHint.current = () => {};
    };
  }, [walking]);

  // Keyboard and look drags; everything held is dropped when the walk ends or the window loses focus.
  useEffect(() => {
    if (!walking) return;
    const moved = () => {
      input.moved = true;
      hideHint.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'shift') input.keys.add(key);
      if (!MOVE_KEYS.has(key)) return;
      e.preventDefault();
      input.keys.add(key);
      moved();
    };
    const onKeyUp = (e: KeyboardEvent) => input.keys.delete(e.key.toLowerCase());

    let look: { id: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLCanvasElement) || look || (e.pointerType === 'mouse' && e.button !== 0)) return;
      look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!look || e.pointerId !== look.id) return;
      input.look.dx += e.clientX - look.x;
      input.look.dy += e.clientY - look.y;
      look.x = e.clientX;
      look.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (look && e.pointerId === look.id) look = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInput);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInput);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      clearInput();
    };
  }, [walking]);

  if (!walking) return null;
  return (
    <>
      {hint !== 'gone' && (
        <p className={`street-hint${hint === 'fading' ? ' fading' : ''}`} data-testid="street-hint">
          {isTouch() ? HINTS[place].touch : HINTS[place].desktop}
        </p>
      )}
      {isTouch() && <Thumbstick onMove={() => hideHint.current()} />}
    </>
  );
}

function Thumbstick({ onMove }: { onMove: () => void }) {
  const knob = useRef<HTMLDivElement>(null);
  const centre = useRef<{ id: number; x: number; y: number } | null>(null);

  const set = (x: number, y: number) => {
    input.stick.x = x;
    input.stick.y = y;
    if (knob.current) knob.current.style.transform = `translate(${x * STICK_RANGE_PX}px, ${y * STICK_RANGE_PX}px)`;
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (centre.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    centre.current = { id: e.pointerId, x: box.left + box.width / 2, y: box.top + box.height / 2 };
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const c = centre.current;
    if (!c || e.pointerId !== c.id) return;
    let x = (e.clientX - c.x) / STICK_RANGE_PX;
    let y = (e.clientY - c.y) / STICK_RANGE_PX;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    set(x, y);
    if (length > 0.2) {
      input.moved = true;
      onMove();
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (centre.current?.id !== e.pointerId) return;
    centre.current = null;
    set(0, 0);
  };

  return (
    <div
      className="street-stick"
      data-testid="street-stick"
      role="img"
      aria-label={en.ui.walkStick}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="street-stick-knob" ref={knob} />
    </div>
  );
}
