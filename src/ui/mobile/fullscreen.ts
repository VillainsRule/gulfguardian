/**
 * Mobile fullscreen helper.
 * Requests Fullscreen API on first user interaction (touch/click) when on mobile landscape.
 * This hides the browser address bar and navigation controls for a more immersive experience.
 */

import { isMobileDevice } from '@/ui/mobile/MobileControls';

let fullscreenRequested = false;
let listenerAttached = false;
let orientationHandlerRef: (() => void) | null = null;

function requestFullscreen(): void {
  const doc = document.documentElement as any;

  if (doc.requestFullscreen) {
    doc.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } else if (doc.webkitRequestFullscreen) {
    // Safari / older iOS
    doc.webkitRequestFullscreen();
  } else if (doc.msRequestFullscreen) {
    doc.msRequestFullscreen();
  }
}

export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement
  );
}

export function toggleFullscreen(): void {
  if (isFullscreen()) {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
  } else {
    requestFullscreen();
  }
}

/**
 * Attaches a one-shot listener that requests fullscreen on the first user gesture.
 * Must be called early (e.g. during bootstrap) so it's ready when the user taps.
 */
export function initMobileFullscreen(): void {
  if (!isMobileDevice() || listenerAttached) return;
  listenerAttached = true;

  const handler = () => {
    if (fullscreenRequested) return;
    // Only request when in landscape orientation
    if (window.innerWidth > window.innerHeight) {
      fullscreenRequested = true;
      requestFullscreen();
    }
  };

  // Request on first touch/click
  window.addEventListener('touchstart', handler, { once: true });
  window.addEventListener('click', handler, { once: true });

  // Also request on orientation change to landscape
  orientationHandlerRef = () => {
    if (window.innerWidth > window.innerHeight && !isFullscreen()) {
      fullscreenRequested = true;
      requestFullscreen();
    }
  };

  if (screen.orientation) {
    screen.orientation.addEventListener('change', orientationHandlerRef);
  }
  window.addEventListener('orientationchange', orientationHandlerRef);
}

export function cleanupMobileFullscreen(): void {
  if (!listenerAttached) return;
  if (orientationHandlerRef) {
    if (screen.orientation) {
      screen.orientation.removeEventListener('change', orientationHandlerRef);
    }
    window.removeEventListener('orientationchange', orientationHandlerRef);
  }
  orientationHandlerRef = null;
  listenerAttached = false;
}
