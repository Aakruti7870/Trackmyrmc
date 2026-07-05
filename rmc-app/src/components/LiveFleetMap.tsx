import { useCallback, useEffect, useState } from 'react';
import { Truck, Gauge, Clock, User, Navigation, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';
import LiveDeliveryMap, { type DeliveryMarker } from '@/components/LiveDeliveryMap';

// One in-transit transit mixer, as returned by GET /api/live-fleet-map. The
// backend already scopes this to the caller's plant (Super Admin sees all).
interface FleetTruck {
  challanId: number;
  challanNo: string | null;
  plantId: number | null;
  plantName: string | null;
  vehicleNo: string | null;
  driverName: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  updatedAt: string | null;
  siteName: string | null;
  siteLat: number | null;
  siteLng: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  reached_site: 'Reached Site',
  unloading: 'Unloading',
  delivered: 'Delivered',
};

const STATUS_COLOR: Record<string, string> = {
  dispatched: 'var(--blue)',
  in_transit: 'var(--blue)',
  reached_site: 'var(--gold)',
  unloading: 'var(--gold)',
  delivered: 'var(--green)',
};

function label(s: string): string {
  return STATUS_LABEL[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function relTime(iso: string | null): string {
  if (!iso) return 'No GPS yet';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleString('en-IN');
}

// Prefer live directions truck → site; fall back to just the truck's location.
function gmapsUrl(t: FleetTruck): string | null {
  if (t.lat == null || t.lng == null) return null;
  if (t.siteLat != null && t.siteLng != null) {
    return `https://www.google.com/maps/dir/?api=1&origin=${t.lat},${t.lng}&destination=${t.siteLat},${t.siteLng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`;
}

export default function LiveFleetMap() {
  const [trucks, setTrucks] = useState<FleetTruck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { subscribe } = useSSE();

  const reload = useCallback(() => {
    api.get<FleetTruck[]>('/live-fleet-map')
      .then(d => setTrucks(Array.isArray(d) ? d : []))
      .catch(() => { /* leave last-known list on transient errors */ })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Live GPS pushes + a slow poll to pick up newly dispatched / delivered loads.
  useEffect(() => {
    const unsub1 = subscribe('vehicle.position', () => { reload(); });
    const unsub2 = subscribe('challan.updated', () => { reload(); });
    const unsub3 = subscribe('reconnect', () => { reload(); });
    const iv = window.setInterval(reload, 30000);
    return () => { unsub1(); unsub2(); unsub3(); window.clearInterval(iv); };
  }, [subscribe, reload]);

  const markers: DeliveryMarker[] = trucks.map(t => ({
    challanId: t.challanId,
    challanNo: t.challanNo,
    vehicleNo: t.vehicleNo,
    truck: t.lat != null && t.lng != null ? { lat: t.lat, lng: t.lng } : null,
    site: t.siteLat != null && t.siteLng != null ? { lat: t.siteLat, lng: t.siteLng, name: t.siteName } : null,
  }));

  const withGps = trucks.filter(t => t.lat != null && t.lng != null).length;

  return (
    <div className="glass-card" style={{ padding: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(56,189,248,.22), rgba(56,189,248,.08))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)',
          }}>
            <Truck size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Live Fleet Google Map</h3>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Transit mixers on the road — live GPS, driver &amp; status</div>
          </div>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: 'rgba(56,189,248,.12)', color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block' }} /> {trucks.length} in transit
        </span>
      </div>

      {markers.some(m => m.truck || m.site) ? (
        <LiveDeliveryMap markers={markers} height={420} bare={false} />
      ) : (
        <div style={{
          borderRadius: 12, border: '1px dashed var(--line)', padding: '28px 12px',
          textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 14,
        }}>
          {loaded
            ? withGps === 0 && trucks.length > 0
              ? 'Trucks are dispatched but haven’t sent a GPS fix yet.'
              : 'No transit mixers on the road right now.'
            : 'Loading live fleet…'}
        </div>
      )}

      {trucks.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {trucks.map(t => {
            const url = gmapsUrl(t);
            const color = STATUS_COLOR[t.status] ?? 'var(--muted)';
            return (
              <div key={t.challanId} style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '10px 12px', borderRadius: 12,
                background: 'var(--chip-bg)', border: '1px solid var(--line)',
              }}>
                <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <Truck size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.vehicleNo || `#${t.challanNo ?? t.challanId}`}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '.3px', flexShrink: 0,
                      padding: '2px 8px', borderRadius: 999, color,
                      background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    }}>{label(t.status)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, fontSize: 11.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={12} /> {t.driverName || '—'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Gauge size={12} /> {t.speed != null ? `${Math.round(t.speed)} km/h` : '—'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {relTime(t.updatedAt)}</span>
                    {t.siteName && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}><MapPin size={12} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.siteName}</span></span>}
                  </div>
                </div>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    padding: '8px 12px', borderRadius: 10, textDecoration: 'none',
                    fontSize: 12, fontWeight: 800, color: '#fff',
                    background: 'linear-gradient(135deg,#0284c7,var(--blue))',
                  }}>
                    <Navigation size={13} /> Open in Google Maps
                  </a>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>Awaiting GPS</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
