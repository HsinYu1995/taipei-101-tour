import { Component, type ReactNode } from 'react';
import type { PlaceId } from '../tour/machine';
import { placeFailed } from '../walk/api';

/**
 * If a place's chunk fails to load, withdraw it and bring the visitor somewhere they can be (placeFailed), rather
 * than leaving the walk waiting forever.
 */
export class PlaceErrorBoundary extends Component<{ place: PlaceId; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const { place } = this.props;
    console.warn(`${place} walk unavailable:`, error);
    placeFailed(place);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
