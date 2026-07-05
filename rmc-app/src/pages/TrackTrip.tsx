import { useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import {
  Truck, MapPin, Clock, PackageCheck, AlertTriangle, ClipboardCheck,
  Factory, Navigation, CircleCheck, XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import LiveDeliveryMap, { type DeliveryMarker } from '@/components/LiveDeliveryMap';
import { PLATFORM_NAME } from '@/lib/brand';

interface TrackPayload {
  challanNo: string | null;
  status: string;
  tripStatus: string | null;
  closed: boolean;
  grade: string | null;
  quantity: string | null;
  vehicleNo: string | null;
  plantName: string | null;
  plantContact: string | null;
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
    etaMin: number | null;
    willMakeIt: boolean | null;
  } | null;
  generatedAt: string;
}

function fmtMins(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

function fmtDistance(m: number | null | undefined): string | null {
  if (m == null) return null;
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// The big human headline under the status icon — the "arriving in ~X" line.
function etaLine(d: TrackPayload): string {
  if (d.status === 'delivered') return `Delivered ${fmtTime(d.deliveryTime)}`;
  if (d.status === 'cancelled') return 'This trip was cancelled';
  if (d.status === 'pending') return 'Your order is being prepared at the plant';
  // dispatched — reflect the finer driver-reported trip stage when available.
  if (d.tripStatus === 'reached_site') return 'Your mixer has arrived at the site';
  if (d.tripStatus === 'unloading') return 'Concrete is being unloaded at your site';
  const eta = d.freshness?.etaMin;
  if (eta != null && eta >= 0) {
    if (eta <= 1) return 'Arriving any moment now';
    return `Arriving in about ${fmtMins(eta)}`;
  }
  const dist = fmtDistance(d.live?.distanceM);
  if (dist) return `${dist} to your site`;
  return 'On the way to your site';
}

// Headline label — refined by the driver-reported trip stage when dispatched.
function statusHeadline(d: TrackPayload): string {
  if (d.status === 'dispatched') {
    if (d.tripStatus === 'reached_site') return 'Arrived at site';
    if (d.tripStatus === 'unloading') return 'Unloading';
    return 'On the way';
  }
  return STATUS_LABEL[d.status] || d.status;
}

// Pour-by freshness chip (concrete must be poured within a window).
function freshnessLine(f: TrackPayload['freshness']): string | null {
  if (!f) return null;
  if (f.level === 'expired') return 'Pour-by window has passed — please confirm with the plant';
  if (f.remainingMin == null) return null;
  return `Best poured within ${fmtMins(f.remainingMin)}`;
}

const STATUS_LABEL: Record<string, string> = {
  dispatched: 'On the way',
  delivered: 'Delivered',
  pending: 'Preparing',
  cancelled: 'Cancelled',
};

// Map a challan status to how far along the 4-step progress bar we are.
const STEPS = [
  { key: 'confirmed', label: 'Confirmed', Icon: ClipboardCheck },
  { key: 'plant', label: 'At plant', Icon: Factory },
  { key: 'road', label: 'On the way', Icon: Truck },
  { key: 'done', label: 'Delivered', Icon: PackageCheck },
];
function currentStep(status: string): number {
  switch (status) {
    case 'delivered':
      return 3; // all steps done
    case 'dispatched':
      return 2; // on the way
    case 'pending':
      return 1; // confirmed & being batched at the plant
    default:
      return 0; // a challan exists, so at minimum it's confirmed
  }
}

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

  const isLive = data?.status === 'dispatched' && !!data.live;
  const step = data ? currentStep(data.status) : 0;
  const cancelled = data?.status === 'cancelled';
  const delivered = data?.status === 'delivered';
  const accent = delivered ? '#22c55e' : cancelled ? '#ef4444' : 'var(--gold)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '24px 16px 40px' }}>
      <style>{CK_TRACK_CSS}</style>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          {isLive && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999,
              fontSize: 11, fontWeight: 800, letterSpacing: .4,
              background: 'color-mix(in srgb, #ef4444 14%, transparent)', color: '#ef4444',
            }}>
              <span className="ck-live-dot" /> LIVE
            </span>
          )}
        </div>

        {token && loading && (
          <div className="ck-skel" style={{ height: 150, borderRadius: 18, marginBottom: 16 }} />
        )}
        {token && loading && (
          <div className="ck-skel" style={{ height: 280, borderRadius: 18 }} />
        )}

        {(!token || (!loading && error)) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 20, borderRadius: 16,
            background: 'color-mix(in srgb, #ef4444 12%, var(--surface))',
            border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)', color: 'var(--text)',
          }}>
            <AlertTriangle size={20} color="#ef4444" />
            <span style={{ fontSize: 14 }}>{error || 'This tracking link is invalid.'}</span>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* HERO — status + ETA */}
            <div style={{
              position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '22px 20px', marginBottom: 14,
              background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 16%, var(--surface)), var(--surface) 70%)`,
              border: `1px solid color-mix(in srgb, ${accent} 30%, var(--line))`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className={isLive ? 'ck-pulse' : undefined} style={{
                  position: 'relative', flexShrink: 0,
                  width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center',
                  background: accent, color: '#fff',
                  ['--ck-accent' as string]: accent,
                }}>
                  {delivered ? <PackageCheck size={28} />
                    : cancelled ? <XCircle size={28} />
                      : data.status === 'pending' ? <Factory size={26} />
                        : <Truck size={28} className="ck-truck" />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>
                    {statusHeadline(data)}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 3, fontWeight: 600 }}>
                    {etaLine(data)}
                  </div>
                </div>
              </div>

              {data.status === 'dispatched' && freshnessLine(data.freshness) && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 11,
                  marginTop: 14, fontSize: 12.5, fontWeight: 700,
                  background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
                  color: data.freshness?.level === 'expired' ? '#ef4444' : 'var(--text)',
                }}>
                  <Clock size={15} color={data.freshness?.level === 'expired' ? '#ef4444' : 'var(--gold)'} />
                  {freshnessLine(data.freshness)}
                </div>
              )}
            </div>

            {/* CLOSED NOTICE — tracking stops once the delivery is complete */}
            {data.closed && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', borderRadius: 16, marginBottom: 14,
                background: `color-mix(in srgb, ${accent} 12%, var(--surface))`,
                border: `1px solid color-mix(in srgb, ${accent} 32%, var(--line))`,
              }}>
                {delivered ? <CircleCheck size={20} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />
                  : <XCircle size={20} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />}
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {delivered
                    ? 'Delivery completed. Live tracking is now closed.'
                    : 'This trip was cancelled. Live tracking is now closed.'}
                  {data.plantContact && (
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 6 }}>
                      Questions about this delivery? Call {data.plantName || 'the plant'} at{' '}
                      <a href={`tel:${data.plantContact}`} style={{ color: 'var(--gold)', fontWeight: 800, textDecoration: 'none' }}>{data.plantContact}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROGRESS STEPPER */}
            {!cancelled && (
              <div style={{
                borderRadius: 18, padding: '20px 18px 16px', marginBottom: 14,
                background: 'var(--surface)', border: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  {STEPS.map((s, i) => {
                    const done = i < step;
                    const active = i === step;
                    const reached = done || active;
                    return (
                      <div key={s.key} style={{ flex: 1, position: 'relative', textAlign: 'center' }}>
                        {/* connector to previous node */}
                        {i > 0 && (
                          <span style={{
                            position: 'absolute', top: 17, right: '50%', width: '100%', height: 3, borderRadius: 2,
                            background: i <= step ? accent : 'var(--line)',
                          }} />
                        )}
                        <div
                          className={active ? 'ck-step-active' : undefined}
                          style={{
                            position: 'relative', zIndex: 1, width: 36, height: 36, borderRadius: '50%',
                            margin: '0 auto', display: 'grid', placeItems: 'center',
                            background: reached ? accent : 'var(--surface)',
                            border: reached ? `2px solid ${accent}` : '2px solid var(--line)',
                            color: reached ? '#fff' : 'var(--muted)',
                            ['--ck-accent' as string]: accent,
                          }}
                        >
                          {done ? <CircleCheck size={18} /> : <s.Icon size={16} />}
                        </div>
                        <div style={{
                          fontSize: 11, marginTop: 7, fontWeight: reached ? 800 : 600,
                          color: reached ? 'var(--text)' : 'var(--muted)',
                        }}>
                          {s.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LIVE MAP */}
            {markers.some((m) => m.truck || m.site) ? (
              <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <LiveDeliveryMap markers={markers} />
                {data.live?.distanceM != null && data.status === 'dispatched' && (
                  <div style={{
                    position: 'absolute', left: 12, bottom: 12, zIndex: 500,
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    fontSize: 12.5, fontWeight: 800, boxShadow: '0 4px 14px rgba(0,0,0,.18)',
                  }}>
                    <Navigation size={13} color="var(--gold)" />
                    {fmtDistance(data.live.distanceM)} away
                    {data.live.speed != null && data.live.speed > 1 && (
                      <span style={{ color: 'var(--muted)', fontWeight: 700 }}>· {Math.round(data.live.speed)} km/h</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 18, borderRadius: 18,
                background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 13,
              }}>
                <MapPin size={18} />
                {delivered
                  ? 'This delivery has been completed.'
                  : cancelled
                    ? 'This trip was cancelled.'
                    : 'Live location will appear here once the mixer hits the road.'}
              </div>
            )}

            {/* DETAILS */}
            <div style={{
              borderRadius: 18, padding: 18, marginTop: 14,
              background: 'var(--surface)', border: '1px solid var(--line)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', letterSpacing: .3, textTransform: 'uppercase' }}>
                  Delivery details
                </div>
                {data.challanNo && (
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{data.challanNo}</div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Grade" value={data.grade} />
                <Field label="Quantity" value={data.quantity ? `${data.quantity} m³` : null} />
                <Field label="Vehicle" value={data.vehicleNo} />
                <Field label="From plant" value={data.plantName} />
                <Field
                  label="Destination"
                  value={[data.site.name, data.site.city].filter(Boolean).join(', ') || null}
                />
                <Field label="Dispatched" value={fmtTime(data.dispatchTime)} />
                {delivered && <Field label="Delivered" value={fmtTime(data.deliveryTime)} />}
              </div>
            </div>

            {!data.closed && data.plantContact && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', fontWeight: 600 }}>
                Need help? Call {data.plantName || 'the plant'} at{' '}
                <a href={`tel:${data.plantContact}`} style={{ color: 'var(--gold)', fontWeight: 800, textDecoration: 'none' }}>{data.plantContact}</a>
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {isLive && <span className="ck-live-dot" style={{ background: '#22c55e' }} />}
              Updated {fmtTime(data.live?.updatedAt || data.generatedAt)}
              {data.status === 'dispatched' && ' · refreshes automatically'}
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
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value || '—'}</div>
    </div>
  );
}

const CK_TRACK_CSS = `
@keyframes ckLiveBlink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
.ck-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block; animation: ckLiveBlink 1.2s ease-in-out infinite; }
@keyframes ckPulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ck-accent) 55%, transparent); }
  70% { box-shadow: 0 0 0 14px color-mix(in srgb, var(--ck-accent) 0%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ck-accent) 0%, transparent); }
}
.ck-pulse { animation: ckPulse 2s ease-out infinite; }
.ck-step-active { animation: ckPulse 2s ease-out infinite; }
@keyframes ckTruck { 0%,100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
.ck-truck { animation: ckTruck 1.4s ease-in-out infinite; }
@keyframes ckShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
.ck-skel {
  background: linear-gradient(90deg, var(--surface) 25%, color-mix(in srgb, var(--muted) 14%, var(--surface)) 37%, var(--surface) 63%);
  background-size: 800px 100%; animation: ckShimmer 1.4s linear infinite;
  border: 1px solid var(--line);
}
@media (prefers-reduced-motion: reduce) {
  .ck-live-dot, .ck-pulse, .ck-step-active, .ck-truck, .ck-skel { animation: none; }
}
`;
