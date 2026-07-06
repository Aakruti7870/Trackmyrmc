import { useSyncExternalStore } from 'react';

// Which renderer the map screens should use. We start on the free
// OpenStreetMap/Leaflet stack; when the bootstrap config carries a Google
// Maps browser key we load the Maps JavaScript API and flip every map to
// Google. Any load/auth failure falls straight back to Leaflet so the app
// never shows a broken map.
export type MapEngine = 'leaflet' | 'loading' | 'google';

let engine: MapEngine = 'leaflet';
let mapId = 'DEMO_MAP_ID';
let configured = false;
const listeners = new Set<() => void>();

function setEngine(next: MapEngine) {
  if (engine === next) return;
  engine = next;
  listeners.forEach(l => l());
}

export function getMapEngine(): MapEngine {
  return engine;
}

export function getGoogleMapId(): string {
  return mapId;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useMapEngine(): MapEngine {
  return useSyncExternalStore(subscribe, getMapEngine, getMapEngine);
}

declare global {
  interface Window {
    __onGoogleMapsReady?: () => void;
    gm_authFailure?: () => void;
    google?: typeof google;
  }
}

/**
 * Called once with the bootstrap config. A missing/empty key keeps the free
 * Leaflet maps. With a key we inject the Maps JS script; on success every
 * compat map renders Google, on failure (network, invalid key, API not
 * enabled) we quietly return to Leaflet.
 */
export function configureGoogleMaps(key?: string | null, mapIdOpt?: string | null) {
  if (configured) return;
  configured = true;
  if (!key) return;
  if (mapIdOpt) mapId = mapIdOpt;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  setEngine('loading');

  // Google calls this (even after a successful script load) when the key is
  // rejected — wrong referrer, Maps JS API not enabled, billing off, etc.
  window.gm_authFailure = () => {
    console.warn('[maps] Google Maps auth failed — falling back to OpenStreetMap.');
    setEngine('leaflet');
  };

  window.__onGoogleMapsReady = () => {
    if (window.google?.maps) setEngine('google');
    else setEngine('leaflet');
  };

  const script = document.createElement('script');
  const params = new URLSearchParams({
    key,
    v: 'weekly',
    libraries: 'marker,places',
    loading: 'async',
    callback: '__onGoogleMapsReady',
  });
  script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
  script.async = true;
  script.onerror = () => {
    console.warn('[maps] Google Maps script failed to load — falling back to OpenStreetMap.');
    setEngine('leaflet');
  };
  document.head.appendChild(script);
}

/** Test-only: reset the module state between test cases. */
export function __resetMapEngineForTests() {
  engine = 'leaflet';
  mapId = 'DEMO_MAP_ID';
  configured = false;
}
