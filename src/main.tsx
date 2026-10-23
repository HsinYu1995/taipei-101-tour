import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installPoseCapture } from './debug/poseCapture';
import { installTestHook } from './debug/testHook';
import './styles.css';

installTestHook();
installPoseCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
