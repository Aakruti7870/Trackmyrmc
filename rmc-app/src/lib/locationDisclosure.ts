/**
 * Location Prominent Disclosure — Google Play Policy Compliance
 *
 * Google Play requires a prominent in-app disclosure before requesting
 * ACCESS_BACKGROUND_LOCATION or any location permission when the app
 * declares background location in its manifest.
 *
 * This module provides a simple event bridge so that:
 *  - <LocationDisclosureModal /> registers itself as the handler.
 *  - Any code that needs location can call requestLocationDisclosure()
 *    and await the user's response before calling the native API.
 */

const STORAGE_KEY = 'rmc_location_disclosure_v1';

type ResolveHandler = (accepted: boolean) => void;
type ShowHandler = (resolve: ResolveHandler) => void;

let _showHandler: ShowHandler | null = null;

/** Returns true if the user has previously accepted the location disclosure. */
export function isLocationDisclosureAccepted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Permanently records the user's acceptance in localStorage. */
export function markLocationDisclosureAccepted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch { /* quota exceeded or private mode — safe to ignore */ }
}

/**
 * Called once by <LocationDisclosureModal> on mount.
 * Returns a cleanup function that deregisters the handler.
 */
export function registerDisclosureModal(fn: ShowHandler): () => void {
  _showHandler = fn;
  return () => {
    if (_showHandler === fn) _showHandler = null;
  };
}

/**
 * Request user acknowledgement before accessing device location.
 *
 * - Already accepted  → resolves immediately with `true`.
 * - Modal mounted     → shows the disclosure; resolves when the user responds.
 * - No modal mounted  → resolves with `true` (fail-open so web/test flows
 *   continue normally — the browser or OS will still show its own dialog).
 */
export function requestLocationDisclosure(): Promise<boolean> {
  if (isLocationDisclosureAccepted()) return Promise.resolve(true);
  if (!_showHandler) {
    // No modal registered (web browser, test, or early call) — proceed and let
    // the platform's own permission UI handle the consent.
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    _showHandler!(resolve);
  });
}
