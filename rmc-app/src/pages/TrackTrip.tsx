import { useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { Truck, MapPin, Clock, PackageCheck, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import LiveDeliveryMap, { type DeliveryMarker } from '@/components/LiveDeliveryMap';
import { PLATFORM_NAME } from '@/lib/brand';

interface TrackPayload {
  challanNo: string | null;
  status: string;
  grade: string | null;
  quantity: string | null;
  vehicleNo: string | null;
  plantName: string | null;
  plant: { lat: number; lng: number } | null;
  site: { name: string | null; city: string | null; lat: number | null; lng: number | null };
  dispatchTime: string | null;
  deliveryTime: string | null;
  siteArrivalTime: string | null;
  live: {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    distanceM: number | null;
    updatedAt: string;
  } | null;
  freshness: {
    level: 'fresh' | 'warning' | 'critical' | 'expired' | string;
    remainingMin: number | null;
    willMakeIt: boolean | null;
  } | null;
  generatedAt: string;
}

// Turn the raw freshness result into a human countdown line for the public page.
function freshnessLine(f: TrackPayload['freshness']): string | null {
  if (!f) return null;
  if (f.level === 'expired') return 'Pour-by window has passed — please confirm with the plant.';
  if (f.remainingMin == null) return null;
  const mins = Math.max(0, Math.round(f.remainingMin));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const left = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `Best poured within ${left}`;
}

const STATUS_LABEL: Record<string, string> = {
  dispatched: 'On the way',
  delivered: 'Delivered',
  pending: 'Preparing',
  cancelled: 'Cancelled',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function TrackTrip() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    if (!token) return;

    const load = () => {
      api
        .get<TrackPayload>(`/track/${token}`)
        .then((res) => {
          if (!alive) return;
          setData(res);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (!alive) return;
          const msg =
            err instanceof ApiError && err.status === 404
              ? 'This tracking link is invalid or has expired.'
              : 'Could not load tracking info. Please try again.';
          setError(msg);
          setLoading(false);
        });
    };

    load();
    // Refresh the live fix periodically while the page is open.
    timer.current = setInterval(load, 15000);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [token]);

  const markers: DeliveryMarker[] = [];
  if (data) {
    markers.push({
      challanId: 0,
      challanNo: data.challanNo,
      vehicleNo: data.vehicleNo,
      truck: data.live ? { lat: data.live.lat, lng: data.live.lng } : null,
      site:
        data.site.lat != null && data.site.lng != null
          ? { lat: data.site.lat, lng: data.site.lng, name: data.site.name }
          : null,
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
            background: 'var(--gold)', color: '#fff',
          }}>
            <Truck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{PLATFORM_NAME}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Live delivery tracking</div>
          </div>
        </div>

        {token && loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading tracking…</div>
        )}

        {(!token || (!loading && error)) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 20, borderRadius: 14,
            background: 'color-mix(in srgb, #ef4444 12%, var(--surface))',
            border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)', color: 'var(--text)',
          }}>
            <AlertTriangle size={20} color="#ef4444" />
            <span style={{ fontSize: 14 }}>{error || 'This tracking link is invalid.'}</span>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div style={{
              borderRadius: 16, padding: 18, marginBottom: 16,
              background: 'var(--surface)', border: '1px solid var(--line)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{data.challanNo || 'Delivery'}</div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 700,
                  background: data.status === 'delivered'
                    ? 'color-mix(in srgb, #22c55e 18%, transparent)'
                    : 'color-mix(in srgb, var(--gold) 18%, transparent)',
                  color: data.status === 'delivered' ? '#16a34a' : 'var(--gold)',
                }}>
                  {data.status === 'delivered' ? <PackageCheck size={14} /> : <Truck size={14} />}
                  {STATUS_LABEL[data.status] || data.status}
                </span>
              </div>

              {data.status === 'dispatched' && freshnessLine(data.freshness) && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10,
                  marginBottom: 12, fontSize: 13, fontWeight: 600,
                  background: 'color-mix(in srgb, var(--gold) 10%, transparent)', color: 'var(--text)',
                }}>
                  <Clock size={15} color="var(--gold)" />
                  {freshnessLine(data.freshness)}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Grade" value={data.grade} />
                <Field label="Quantity" value={data.quantity ? `${data.quantity} m³` : null} />
                <Field label="Vehicle" value={data.vehicleNo} />
                <Field label="From plant" value={data.plantName} />
                <Field
                  label="Destination"
                  value={[data.site.name, data.site.city].filter(Boolean).join(', ') || null}
                />
                <Field label="Dispatched" value={fmtTime(data.dispatchTime)} />
                {data.status === 'delivered' && (
                  <Field label="Delivered" value={fmtTime(data.deliveryTime)} />
                )}
              </div>
            </div>

            {markers.some((m) => m.truck || m.site) ? (
              <LiveDeliveryMap markers={markers} />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 16, borderRadius: 14,
                background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 13,
              }}>
                <MapPin size={16} />
                {data.status === 'delivered'
                  ? 'This delivery has been completed.'
                  : 'Live location will appear once the mixer is on the road.'}
              </div>
            )}

            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
              Updated {fmtTime(data.live?.updatedAt || data.generatedAt)} · refreshes automatically
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}
