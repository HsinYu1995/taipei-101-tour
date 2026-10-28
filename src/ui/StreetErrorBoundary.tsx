import { Component, type ReactNode } from 'react';
import { isWalkMode } from '../street/api';
import { useTour } from '../tour/store';

/**
 * If the street chunk fails to load, withdraw the walk and bring the visitor back up rather than leaving the
 * descent waiting forever.
 */
export class StreetErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('street walk unavailable:', error);
    const { mode, dispatch, setStreetFailed } = useTour.getState();
    setStreetFailed();
    if (isWalkMode(mode)) dispatch({ type: 'walkExit' });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
