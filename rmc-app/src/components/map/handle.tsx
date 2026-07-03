import { createContext, useContext } from 'react';

// Renderer-agnostic imperative surface the map screens use: refit bounds as
// live positions change, recenter after a search, and gate touch gestures on
// mobile. Backed by the Leaflet map or the Google map depending on engine.
export interface CompatMapHandle {
  setView(pos: [number, number], zoom?: number): void;
  getZoom(): number;
  fitBounds(points: [number, number][], opts?: { padding?: number; maxZoom?: number }): void;
  setInteractive(on: boolean): void;
  getContainer(): HTMLElement | null;
}

const NOOP_HANDLE: CompatMapHandle = {
  setView() {},
  getZoom() { return 12; },
  fitBounds() {},
  setInteractive() {},
  getContainer() { return null; },
};

export const MapHandleContext = createContext<CompatMapHandle>(NOOP_HANDLE);

export function useMapHandle(): CompatMapHandle {
  return useContext(MapHandleContext);
}
