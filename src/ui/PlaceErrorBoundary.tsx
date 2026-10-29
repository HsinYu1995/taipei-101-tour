import { Component, type ReactNode } from 'react';
import type { PlaceId } from '../tour/machine';
import { isWalkMode } from '../walk/api';
import { useTour } from '../tour/store';

/**
 * If a place's chunk fails to load, withdraw it and bring the visitor somewhere they can be, rather than leaving
 * the walk waiting forever: the street rises back to the tour, the mall returns to the street outside its door.
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
      if (isWalkMode(tour.mode)) tour.dispatch({ type: 'walkExit' });
      return;
    }
    tour.setMallFailed();
    if (tour.crossingTo === 'mall' || (tour.mode === 'walking' && tour.place === 'mall')) tour.dispatch({ type: 'cross', to: 'street' });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
