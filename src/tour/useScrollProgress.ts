import { useLayoutEffect } from 'react';
import { useTour } from './store';

const STORAGE_KEY = 'tour-progress';

/** Page scroll offset at progress 1. */
export const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

function readSaved(): number {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Feeds native page scroll into the tour store.
 * Restoration is manual so the first rendered frame already matches the restored progress,
 * and progress (not pixel offset) is preserved when the page height changes on resize.
 */
export function useScrollProgress() {
  useLayoutEffect(() => {
    const dispatch = (progress: number) => useTour.getState().dispatch({ type: 'scroll', progress });
    const onScroll = () => {
      const max = maxScroll();
      dispatch(max > 0 ? window.scrollY / max : 0);
    };

    history.scrollRestoration = 'manual';
    const saved = readSaved();
    if (saved > 0) window.scrollTo(0, saved * maxScroll());
    onScroll();

    let lastHeight = document.documentElement.scrollHeight;
    const onResize = () => {
      const height = document.documentElement.scrollHeight;
      // Mobile URL-bar show/hide changes innerHeight but not a vh-based page height; leave those alone.
      if (height !== lastHeight) {
        lastHeight = height;
        window.scrollTo(0, useTour.getState().progress * maxScroll());
      }
      onScroll();
    };
    const save = () => {
      try {
        sessionStorage.setItem(STORAGE_KEY, String(useTour.getState().progress));
      } catch {
        // Storage blocked: reload simply starts from the top.
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', save);
    };
  }, []);
}
