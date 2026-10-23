import { useFrame } from '@react-three/fiber';
import { poseAt } from '../tour/path';
import { useTour } from '../tour/store';

/** Drives the camera from scroll progress. */
export function CameraRig() {
  useFrame(({ camera }) => {
    const { progress, setCamera } = useTour.getState();
    const pose = poseAt(progress);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    setCamera(pose);
  });
  return null;
}
