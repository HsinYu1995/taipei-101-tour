/**
 * Hand-off between the DOM hotspot button (rendered in the page's React tree) and the
 * projector inside the canvas that positions it on screen every frame.
 */
export const hotspotAnchor: { el: HTMLElement | null } = { el: null };
