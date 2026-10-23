import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { CHAPTERS } from '../tour/chapters';
import { easeInOutCubic, lerpPose, poseAt } from '../tour/path';
import { useTour } from '../tour/store';
import type { ExploreBounds, Pose, Vec3 } from '../tour/types';

const RETURN_MS = 600;
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
 * Owns the camera. Tour mode follows the scroll path; at a stop a mouse drag (or the Explore button)
 * hands the camera to bounded CameraControls; leaving explore blends back to the path.
 */
export function CameraRig() {
  const controls = useRef<CameraControlsImpl>(null);
  const returning = useRef<{ from: Pose; start: number } | null>(null);
  const gl = useThree((s) => s.gl);
  const mode = useTour((s) => s.mode);
  const stopIndex = useTour((s) => (s.segment.kind === 'stop' ? s.segment.chapterIndex : -1));
  const exploring = mode === 'explore';

  useEffect(() => {
    const c = controls.current!;
    c.enabled = stopIndex >= 0 && mode !== 'returning';
    c.mouseButtons.left = ACTION.ROTATE;
    c.mouseButtons.middle = ACTION.NONE;
    c.mouseButtons.right = ACTION.NONE;
    c.mouseButtons.wheel = exploring ? ACTION.DOLLY : ACTION.NONE;
    c.touches.one = exploring ? ACTION.TOUCH_ROTATE : ACTION.NONE;
    c.touches.two = exploring ? ACTION.TOUCH_DOLLY : ACTION.NONE;
    c.touches.three = ACTION.NONE;
    // camera-controls forces touch-action:none on connect and on every `enabled` change;
    // outside explore a one-finger vertical swipe must scroll the page.
    gl.domElement.style.touchAction = exploring ? 'none' : 'pan-y';

    if (exploring && stopIndex >= 0) {
      const { stop, explore } = CHAPTERS[stopIndex];
      applyBounds(c, stop, explore);
    } else {
      applyBounds(c, CHAPTERS[0].stop, UNBOUNDED);
    }
    if (mode === 'returning') {
      c.getPosition(position);
      c.getTarget(target);
      returning.current = { from: { position: toVec3(position), target: toVec3(target) }, start: performance.now() };
    }
  }, [mode, exploring, stopIndex, gl]);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const { mode, progress, dispatch, setCamera } = useTour.getState();
    if (mode === 'tour') {
      lookAt(c, poseAt(progress));
    } else if (mode === 'returning' && returning.current) {
      const t = Math.min((performance.now() - returning.current.start) / RETURN_MS, 1);
      lookAt(c, lerpPose(returning.current.from, poseAt(progress), easeInOutCubic(t)));
      if (t === 1) {
        returning.current = null;
        dispatch({ type: 'returnDone' });
      }
    }
    c.getPosition(position);
    c.getTarget(target);
    setCamera({ position: toVec3(position), target: toVec3(target) });
  });

  const onControlStart = () => useTour.getState().dispatch({ type: 'exploreStart' });

  // Attach to the canvas explicitly (drei defaults to R3F's wrapper div) so the touch-action override above
  // lands on the same element camera-controls modifies.
  return <CameraControls ref={controls} makeDefault domElement={gl.domElement} onControlStart={onControlStart} />;
}
