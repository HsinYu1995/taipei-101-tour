import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { TRANSITION_MS, isWalkMode } from '../walk/api';
import { useStreetGestures } from '../walk/gestures';
import { CHAPTERS } from '../tour/chapters';
import type { Mode } from '../tour/machine';
import { easeInOutCubic, lerpPose, orbitLerpPose, poseAt } from '../tour/path';
import { useTour } from '../tour/store';
import type { ExploreBounds, Pose, Vec3 } from '../tour/types';

const RETURN_MS = 600;
/** A mouse drag must travel this far before it counts as exploring, so plain clicks stay in tour mode. */
const DRAG_THRESHOLD_PX = 4;
/** Near plane at eye level: the visitor can stand 0.3 m from a wall. */
const NEAR = { walk: 0.1, default: 0.5 };
const { ACTION } = CameraControlsImpl;
const UNBOUNDED: ExploreBounds = { minDistance: 0, maxDistance: Infinity, azimuthRange: Infinity, minPolar: 0, maxPolar: Math.PI };

const position = new Vector3();
const target = new Vector3();
const toVec3 = (v: Vector3): Vec3 => [v.x, v.y, v.z];

function lookAt(c: CameraControlsImpl, pose: Pose) {
  c.setLookAt(...pose.position, ...pose.target, false);
  c.update(0);
}

function applyBounds(c: CameraControlsImpl, pose: Pose, b: ExploreBounds) {
  c.minDistance = b.minDistance;
  c.maxDistance = b.maxDistance;
  c.minPolarAngle = b.minPolar;
  c.maxPolarAngle = b.maxPolar;
  if (!Number.isFinite(b.azimuthRange)) {
    c.minAzimuthAngle = -Infinity;
    c.maxAzimuthAngle = Infinity;
    return;
  }
  // Centre the range on the stop's azimuth, unwrapped to the same turn as the controls' current azimuth.
  const [px, , pz] = pose.position;
  const [tx, , tz] = pose.target;
  const stopAzimuth = Math.atan2(px - tx, pz - tz);
  const centre = stopAzimuth + 2 * Math.PI * Math.round((c.azimuthAngle - stopAzimuth) / (2 * Math.PI));
  c.minAzimuthAngle = centre - b.azimuthRange;
  c.maxAzimuthAngle = centre + b.azimuthRange;
}

/**
 * Owns the camera. Tour mode follows the scroll path; at a stop a left-mouse drag (or the Explore button)
 * hands the camera to bounded CameraControls; leaving explore blends back to the path.
 * Touch never enters explore implicitly: on phones a swipe must always scroll, and the Explore button is the way in.
 */
export function CameraRig() {
  const controls = useRef<CameraControlsImpl>(null);
  // The blend in progress (return to path, descent or ascent): where it started, when, and for which mode.
  const blend = useRef<{ mode: Mode; from: Pose; start: number } | null>(null);
  const gl = useThree((s) => s.gl);
  const mode = useTour((s) => s.mode);
  const stopIndex = useTour((s) => (s.segment.kind === 'stop' ? s.segment.chapterIndex : -1));
  const exploring = mode === 'explore';

  const setTouchAction = () => {
    // camera-controls forces touch-action:none on connect and on every `enabled` change;
    // outside explore a one-finger vertical swipe must scroll the page.
    const { mode } = useTour.getState();
    gl.domElement.style.touchAction = mode === 'explore' || isWalkMode(mode) ? 'none' : 'pan-y';
  };

  useEffect(() => {
    const c = controls.current!;
    c.enabled = exploring;
    c.mouseButtons.left = ACTION.ROTATE;
    c.mouseButtons.middle = ACTION.NONE;
    c.mouseButtons.right = ACTION.NONE;
    c.mouseButtons.wheel = exploring ? ACTION.DOLLY : ACTION.NONE;
    c.touches.one = exploring ? ACTION.TOUCH_ROTATE : ACTION.NONE;
    c.touches.two = exploring ? ACTION.TOUCH_DOLLY : ACTION.NONE;
    c.touches.three = ACTION.NONE;
    setTouchAction();

    if (exploring && stopIndex >= 0) {
      const { stop, explore } = CHAPTERS[stopIndex];
      applyBounds(c, stop, explore);
    } else {
      applyBounds(c, CHAPTERS[0].stop, UNBOUNDED);
    }
  }, [mode, exploring, stopIndex, gl]);

  // Mouse drag gate. Capture phase runs before camera-controls' own pointerdown listener, so enabling the
  // controls here lets them pick up this same drag; explore only starts once the drag passes the threshold.
  useEffect(() => {
    const el = gl.domElement;
    let pending: { x: number; y: number } | null = null;
    const release = () => {
      pending = null;
      const c = controls.current;
      if (c && useTour.getState().mode !== 'explore') {
        c.enabled = false;
        setTouchAction();
      }
    };
    const onDown = (e: PointerEvent) => {
      const { mode, segment } = useTour.getState();
      if (e.pointerType !== 'mouse' || e.button !== 0 || mode !== 'tour' || segment.kind !== 'stop') return;
      pending = { x: e.clientX, y: e.clientY };
      controls.current!.enabled = true;
      setTouchAction();
    };
    const onMove = (e: PointerEvent) => {
      if (!pending || Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_THRESHOLD_PX) return;
      pending = null;
      useTour.getState().dispatch({ type: 'exploreStart' });
    };
    el.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [gl]);

  useStreetGestures(gl.domElement, controls);

  useFrame(({ camera }) => {
    const c = controls.current;
    if (!c) return;
    const { mode, progress, place, places, dispatch, setCamera } = useTour.getState();
    const walk = places[place];

    const near = isWalkMode(mode) ? NEAR.walk : NEAR.default;
    if (camera.near !== near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }

    // The frame loop alone owns the blends: each starts on the first frame that sees its mode,
    // so it cannot depend on when React commits the mode change.
    if (blend.current?.mode !== mode) blend.current = null;
    const progressOf = (ms: number) => {
      if (!blend.current) {
        c.getPosition(position);
        c.getTarget(target);
        blend.current = { mode, from: { position: toVec3(position), target: toVec3(target) }, start: performance.now() };
      }
      return Math.min((performance.now() - blend.current.start) / ms, 1);
    };

    if (mode === 'tour') {
      lookAt(c, poseAt(progress));
    } else if (mode === 'returning') {
      const t = progressOf(RETURN_MS);
      lookAt(c, orbitLerpPose(blend.current!.from, poseAt(progress), easeInOutCubic(t)));
      if (t === 1) dispatch({ type: 'returnDone' });
    } else if (mode === 'descending') {
      // Until the place has loaded, hold still where explore left the camera.
      if (walk) {
        const t = progressOf(TRANSITION_MS);
        lookAt(c, lerpPose(blend.current!.from, walk.landing(), easeInOutCubic(t)));
        if (t === 1) {
          walk.reset();
          dispatch({ type: 'landed' });
        }
      }
    } else if (mode === 'walking' || mode === 'crossing') {
      // A crossing holds the place being left until the hand-over, then follows the place crossed to.
      if (walk) lookAt(c, walk.eye());
    } else if (mode === 'ascending') {
      const t = progressOf(TRANSITION_MS);
      lookAt(c, lerpPose(blend.current!.from, poseAt(progress), easeInOutCubic(t)));
      if (t === 1) dispatch({ type: 'ascended' });
    }
    c.getPosition(position);
    c.getTarget(target);
    setCamera({ position: toVec3(position), target: toVec3(target) });
  });

  // Attach to the canvas explicitly (drei defaults to R3F's wrapper div) so the touch-action override above
  // lands on the same element camera-controls modifies.
  return <CameraControls ref={controls} makeDefault domElement={gl.domElement} />;
}
