import { createContext, useContext } from 'react';

// The live google.maps.Map instance, provided by GoogleMapContainer. Null
// when rendering the Leaflet engine — compat children branch on this.
export const GoogleMapContext = createContext<google.maps.Map | null>(null);

export function useGoogleMap() {
  return useContext(GoogleMapContext);
}
