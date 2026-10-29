import { Component, type ReactNode } from 'react';
import type { PlaceId } from '../tour/machine';
import { useTour } from '../tour/store';

/**
 * If a place's chunk fails to load, withdraw it and bring the visitor somewhere they can be, rather than leaving
 * the walk waiting forever: losing the street ends the walk wherever it is (the mall is only reached through the
 * street), the mall returns to the street outside its door.
 */
export class PlaceErrorBoundary extends Component<{ place: PlaceId; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const { place } = this.props;
    console.warn(`${place} walk unavailable:`, error);
    const tour = useTour.getState();
    if (place === 'street') {
      tour.setStreetFailed();
      tour.dispatch({ type: 'walkAbort' });
      return;
    }
    tour.setMallFailed();
    if (tour.crossingTo === 'mall' || (tour.mode === 'walking' && tour.place === 'mall')) tour.dispatch({ type: 'cross', to: 'street' });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
