import { useEffect, type CSSProperties, type ReactNode } from 'react';
import {
  MapContainer as RLMapContainer,
  TileLayer as RLTileLayer,
  Marker as RLMarker,
  Popup as RLPopup,
  Polyline as RLPolyline,
  useMap as useLeafletMap,
  useMapEvents as useLeafletMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LeafletEventHandlerFnMap } from 'leaflet';
import { useMapEngine } from '@/lib/mapEngine';
import { MapHandleContext, useMapHandle, type CompatMapHandle } from './handle';
import {
  GoogleMapContainer,
  GoogleMarker,
  GooglePolyline,
  GoogleClickCapture,
  type GoogleMarkerProps,
  type GooglePolylineProps,
} from './google';
import { useGoogleMap } from './googleContext';

// Drop-in replacements for the react-leaflet primitives this app uses.
// They render Google Maps when the Maps JS API is configured & loaded, and
// the free OpenStreetMap/Leaflet stack otherwise. Screens import from here
// instead of 'react-leaflet' and otherwise keep their existing markup.

// Note: useMapHandle / CompatMapHandle live in './handle' — import them from
// '@/components/map/handle' (react-refresh forbids non-component exports here).

export interface MapContainerProps {
  center: [number, number];
  zoom: number;
  style?: CSSProperties;
  scrollWheelZoom?: boolean;
  dragging?: boolean;
  touchZoom?: boolean;
  doubleClickZoom?: boolean;
  children?: ReactNode;
}

// Bridges the live Leaflet map into the renderer-agnostic handle so shared
// helper components (FitBounds, GestureGate, Recenter) work on both engines.
function LeafletBridge({ children }: { children?: ReactNode }) {
  const map = useLeafletMap();
  const handle: CompatMapHandle = {
    setView(pos, zoom) { map.setView(pos, zoom ?? map.getZoom()); },
    getZoom() { return map.getZoom(); },
    fitBounds(points, opts) {
      if (points.length === 0) return;
      const pad = opts?.padding ?? 40;
      map.fitBounds(L.latLngBounds(points), { padding: [pad, pad], maxZoom: opts?.maxZoom });
    },
    setInteractive(on) {
      // Some handles are absent in jsdom/test stubs — guard each one.
      const m = map as Partial<L.Map>;
      const toggles = [m.dragging, m.touchZoom, m.scrollWheelZoom, m.doubleClickZoom, m.boxZoom];
      for (const t of toggles) {
        if (on) t?.enable?.(); else t?.disable?.();
      }
      const container = m.getContainer?.();
      if (container) container.style.touchAction = on ? '' : 'pan-y';
    },
    getContainer() {
      return (map as Partial<L.Map>).getContainer?.() ?? null;
    },
  };
  return <MapHandleContext.Provider value={handle}>{children}</MapHandleContext.Provider>;
}

export function MapContainer({ children, ...props }: MapContainerProps) {
  const engine = useMapEngine();
  if (engine === 'google') {
    return <GoogleMapContainer {...props}>{children}</GoogleMapContainer>;
  }
  if (engine === 'loading') {
    // The Maps JS script is still loading — hold layout, avoid mounting
    // Leaflet only to tear it down a moment later.
    return <div style={{ background: 'var(--chip-bg, #eee)', ...props.style }} aria-label="Loading map" />;
  }
  return (
    <RLMapContainer {...props}>
      <LeafletBridge>{children}</LeafletBridge>
    </RLMapContainer>
  );
}

export function TileLayer(props: { url: string; attribution?: string }) {
  const gmap = useGoogleMap();
  if (gmap) return null; // Google draws its own tiles
  return <RLTileLayer {...props} />;
}

export interface MarkerProps extends GoogleMarkerProps { children?: ReactNode }

export function Marker({ children, ...props }: MarkerProps) {
  const gmap = useGoogleMap();
  if (gmap) return <GoogleMarker {...props}>{children}</GoogleMarker>;
  return (
    <RLMarker
      position={props.position}
      icon={props.icon}
      draggable={props.draggable}
      eventHandlers={props.eventHandlers as LeafletEventHandlerFnMap | undefined}
    >
      {children}
    </RLMarker>
  );
}

export function Popup({ children }: { children?: ReactNode }) {
  const gmap = useGoogleMap();
  // On Google, the parent Marker portals this content into an InfoWindow.
  if (gmap) return <>{children}</>;
  return <RLPopup>{children}</RLPopup>;
}

export function Polyline(props: GooglePolylineProps) {
  const gmap = useGoogleMap();
  if (gmap) return <GooglePolyline {...props} />;
  return <RLPolyline positions={props.positions} pathOptions={props.pathOptions} />;
}

// Map-click capture (pin drop). Engine-specific because the hooks differ.
function LeafletClickCapture({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useLeafletMapEvents({
    click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

export function MapClickCapture({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  const gmap = useGoogleMap();
  if (gmap) return <GoogleClickCapture onPick={onPick} />;
  return <LeafletClickCapture onPick={onPick} />;
}

// Refits the view to the given points whenever they change. Shared by the
// live-tracking, nearby-plants and supplier maps.
export function FitBounds({ points, maxZoom = 16, singleZoom = 14 }: {
  points: [number, number][];
  maxZoom?: number;
  singleZoom?: number;
}) {
  const handle = useMapHandle();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      handle.setView(points[0], Math.max(handle.getZoom(), singleZoom));
      return;
    }
    handle.fitBounds(points, { padding: 40, maxZoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points), maxZoom, singleZoom]);
  return null;
}
