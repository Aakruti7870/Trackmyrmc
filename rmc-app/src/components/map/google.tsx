import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import { getGoogleMapId } from '@/lib/mapEngine';
import type { CompatMapHandle } from './handle';
import { MapHandleContext } from './handle';
import { GoogleMapContext, useGoogleMap } from './googleContext';

// Google Maps implementations of the small react-leaflet surface this app
// uses. Rendered only when the Maps JavaScript API has loaded successfully.

export interface GoogleMapContainerProps {
  center: [number, number];
  zoom: number;
  style?: CSSProperties;
  scrollWheelZoom?: boolean;
  dragging?: boolean;
  touchZoom?: boolean;
  doubleClickZoom?: boolean;
  children?: ReactNode;
}

function buildHandle(map: google.maps.Map): CompatMapHandle {
  return {
    setView(pos, zoom) {
      map.setCenter({ lat: pos[0], lng: pos[1] });
      if (typeof zoom === 'number') map.setZoom(zoom);
    },
    getZoom() {
      return map.getZoom() ?? 12;
    },
    fitBounds(points, opts) {
      if (points.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
      for (const [lat, lng] of points) bounds.extend({ lat, lng });
      map.fitBounds(bounds, opts?.padding ?? 40);
      const maxZoom = opts?.maxZoom;
      if (typeof maxZoom === 'number') {
        const once = map.addListener('idle', () => {
          const z = map.getZoom();
          if (typeof z === 'number' && z > maxZoom) map.setZoom(maxZoom);
          google.maps.event.removeListener(once);
        });
      }
    },
    setInteractive(on) {
      map.setOptions({ gestureHandling: on ? 'greedy' : 'none' });
    },
    getContainer() {
      return map.getDiv();
    },
  };
}

export function GoogleMapContainer({
  center, zoom, style, dragging, touchZoom, children,
}: GoogleMapContainerProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // Initial view only — subsequent moves go through the handle, matching
  // react-leaflet's MapContainer semantics (props are not live-bound).
  const initial = useRef({ center, zoom, interactive: dragging !== false && touchZoom !== false });

  useEffect(() => {
    if (!divRef.current) return;
    const m = new google.maps.Map(divRef.current, {
      center: { lat: initial.current.center[0], lng: initial.current.center[1] },
      zoom: initial.current.zoom,
      mapId: getGoogleMapId(),
      gestureHandling: initial.current.interactive ? 'greedy' : 'none',
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: true,
      mapTypeControlOptions: { position: 3 /* TOP_RIGHT */ },
      clickableIcons: false,
    });
    setMap(m);
    return () => {
      setMap(null);
      google.maps.event.clearInstanceListeners(m);
    };
  }, []);

  const handle = useMemo(() => (map ? buildHandle(map) : null), [map]);

  // The Maps API owns the inner div's DOM entirely, so React children (which
  // only produce portals/effects, never visible DOM here) render in a hidden
  // sibling to avoid fighting Google over the same subtree.
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div ref={divRef} style={{ position: 'absolute', inset: 0 }} />
      {map && handle && (
        <GoogleMapContext.Provider value={map}>
          <MapHandleContext.Provider value={handle}>
            <div style={{ display: 'none' }}>{children}</div>
          </MapHandleContext.Provider>
        </GoogleMapContext.Provider>
      )}
    </div>
  );
}

// Translate the app's Leaflet icons (divIcon HTML pins or CDN image icons)
// into DOM content for an AdvancedMarkerElement.
function iconToContent(icon?: L.Icon | L.DivIcon): HTMLElement | undefined {
  if (!icon) return undefined;
  const opts = icon.options as Partial<L.DivIconOptions & L.IconOptions>;
  if (opts.html) {
    const wrap = document.createElement('div');
    wrap.innerHTML = String(opts.html);
    return (wrap.firstElementChild as HTMLElement) ?? wrap;
  }
  if (opts.iconUrl) {
    const img = document.createElement('img');
    img.src = opts.iconUrl;
    const size = opts.iconSize as [number, number] | undefined;
    if (size) { img.width = size[0]; img.height = size[1]; }
    img.alt = '';
    return img;
  }
  return undefined;
}

export interface GoogleMarkerProps {
  position: [number, number];
  icon?: L.Icon | L.DivIcon;
  draggable?: boolean;
  eventHandlers?: {
    click?: () => void;
    dragend?: (e: { target: { getLatLng(): { lat: number; lng: number } } }) => void;
  };
  children?: ReactNode; // <Popup> content
}

export function GoogleMarker({ position, icon, draggable, eventHandlers, children }: GoogleMarkerProps) {
  const map = useGoogleMap();
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const handlersRef = useRef(eventHandlers);
  // Popup content is rendered into this detached div via a portal below.
  const [contentDiv] = useState(() => document.createElement('div'));
  const hasPopup = !!children;
  const hasPopupRef = useRef(hasPopup);
  useEffect(() => {
    handlersRef.current = eventHandlers;
    hasPopupRef.current = hasPopup;
  });

  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: position[0], lng: position[1] },
      content: iconToContent(icon),
      gmpDraggable: !!draggable,
    });
    markerRef.current = marker;

    const listeners: google.maps.MapsEventListener[] = [];
    listeners.push(marker.addListener('click', () => {
      handlersRef.current?.click?.();
      if (!hasPopupRef.current) return;
      if (!infoRef.current) infoRef.current = new google.maps.InfoWindow();
      infoRef.current.setContent(contentDiv);
      infoRef.current.open({ map, anchor: marker });
    }));
    if (draggable) {
      listeners.push(marker.addListener('dragend', () => {
        const p = marker.position;
        if (!p) return;
        const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
        const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
        handlersRef.current?.dragend?.({ target: { getLatLng: () => ({ lat, lng }) } });
      }));
    }
    return () => {
      listeners.forEach(l => google.maps.event.removeListener(l));
      infoRef.current?.close();
      marker.map = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, draggable, icon]);

  // Follow position updates (live truck movement) without recreating.
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = { lat: position[0], lng: position[1] };
    }
  }, [position[0], position[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return hasPopup ? createPortal(<div style={{ color: '#111', fontSize: 12.5 }}>{children}</div>, contentDiv) : null;
}

export interface GooglePolylineProps {
  positions: [number, number][];
  pathOptions?: { color?: string; weight?: number; opacity?: number; dashArray?: string };
}

export function GooglePolyline({ positions, pathOptions }: GooglePolylineProps) {
  const map = useGoogleMap();

  useEffect(() => {
    if (!map) return;
    const dashed = !!pathOptions?.dashArray;
    const line = new google.maps.Polyline({
      map,
      path: positions.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: pathOptions?.color ?? '#38bdf8',
      strokeWeight: dashed ? 0 : (pathOptions?.weight ?? 2),
      strokeOpacity: dashed ? 0 : (pathOptions?.opacity ?? 1),
      ...(dashed ? {
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: pathOptions?.opacity ?? 1,
            strokeColor: pathOptions?.color ?? '#38bdf8',
            scale: (pathOptions?.weight ?? 2),
          },
          offset: '0',
          repeat: '12px',
        }],
      } : {}),
    });
    return () => { line.setMap(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(positions), JSON.stringify(pathOptions)]);

  return null;
}

export function GoogleClickCapture({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  const map = useGoogleMap();
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    if (!map) return;
    const l = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onPickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    return () => { google.maps.event.removeListener(l); };
  }, [map]);

  return null;
}
