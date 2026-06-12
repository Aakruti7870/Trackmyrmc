import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Challan, type PositionUpdateResult, type FreshnessConfig } from '@/lib/api';
import { Truck, MapPin, CheckCircle, Clock, Package, AlertCircle, CalendarDays, Navigation, Satellite, AlertTriangle, Camera, X, Map as MapIcon, Timer, LogOut } from 'lucide-react';
import FreshnessCountdown from '@/components/FreshnessCountdown';
import { computeTripTiming, formatDuration } from '@/lib/tripTiming';

// A challan is still being GPS-tracked while it is dispatched (heading to site)
// or has arrived but not yet been released (waiting for the truck to leave).
function needsTracking(c: Challan): boolean {
  return c.status === 'dispatched' || (c.siteArrivalTime != null && c.siteReleaseTime == null);
}

function fmtTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Resize/compress an image file to a small JPEG data URL so proof photos stay
// well under the server's upload limit while remaining legible for billing.
function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Converts a base64 image data URL (the compressed preview) into a Blob so the
// raw bytes can be PUT straight to object storage, instead of inflating them
// back into a JSON payload routed through the API.
function dataURLToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:(.*?)(;base64)?$/.exec(head)?.[1] || 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Uploads each compressed proof photo directly to object storage via a presigned
// URL and returns the resulting /objects/... entity paths to send on delivery.
async function uploadProofPhotos(dataUrls: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (const dataUrl of dataUrls) {
    const blob = dataURLToBlob(dataUrl);
    const { uploadURL, objectPath } = await api.post<{ uploadURL: string; objectPath: string }>(
      '/challans/proof-upload-url',
      { contentType: blob.type },
    );
    const res = await fetch(uploadURL, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': blob.type },
    });
    if (!res.ok) throw new Error('Could not upload the delivery photo. Please try again.');
    paths.push(objectPath);
  }
  return paths;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  pending:    { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 10%, transparent)',  icon: Clock },
  dispatched: { color: 'var(--blue)', bg: 'rgba(56,189,248,.1)', icon: Truck },
  delivered:  { color: 'var(--green)', bg: 'rgba(34,197,94,.1)',  icon: CheckCircle },
  cancelled:  { color: 'var(--red)', bg: 'rgba(239,68,68,.1)',  icon: AlertCircle },
};

const POST_INTERVAL_MS = 10000;
const GEOFENCE_RADIUS_M = 150;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

const MAX_PROOF_PHOTOS = 8;

function TripCard({ challan, onMarkDelivered, onLeftSite, tracking, liveDistanceM, freshnessConfig }: {
  challan: Challan; onMarkDelivered: (id: number, notes?: string, deliveredQuantity?: string, proofPhotos?: string[], odometerEnd?: string) => void; onLeftSite: (id: number, odometerEnd?: string) => Promise<void>; tracking: boolean; liveDistanceM?: number | null; freshnessConfig: FreshnessConfig | null;
}) {
  const s = STATUS_STYLES[challan.status] || STATUS_STYLES.pending;
  const StatusIcon = s.icon;
  const isActionable = challan.status === 'dispatched';
  const onSite = challan.siteArrivalTime != null && challan.siteReleaseTime == null;
  const timing = computeTripTiming(challan);
  const [leaving, setLeaving] = useState(false);
  const [leaveErr, setLeaveErr] = useState('');
  const [marking, setMarking] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [deliveredQty, setDeliveredQty] = useState(() => parseFloat(challan.quantity || '0').toString());
  const [odometerEnd, setOdometerEnd] = useState(() => challan.odometerEnd != null ? String(challan.odometerEnd) : '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const hasPin = challan.siteLat != null && challan.siteLng != null;

  function composeNotes(): string | undefined {
    const r = recipient.trim();
    const n = note.trim();
    if (r && n) return `Received by ${r}. ${n}`;
    if (r) return `Received by ${r}.`;
    if (n) return n;
    return undefined;
  }

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setPhotoErr(''); setPhotoBusy(true);
    try {
      const remaining = MAX_PROOF_PHOTOS - photos.length;
      if (remaining <= 0) {
        setPhotoErr(`You can attach at most ${MAX_PROOF_PHOTOS} photos`);
        return;
      }
      const picked = files.slice(0, remaining);
      const compressed = await Promise.all(picked.map(f => compressImage(f)));
      setPhotos(prev => [...prev, ...compressed].slice(0, MAX_PROOF_PHOTOS));
      if (files.length > remaining) setPhotoErr(`Only ${MAX_PROOF_PHOTOS} photos allowed — extra photos were skipped`);
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'Could not process the photo');
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleMark() {
    setMarking(true);
    setPhotoErr('');
    const qty = deliveredQty.trim();
    try {
      // Upload any photos straight to storage first, then send only their paths.
      const proofPaths = photos.length ? await uploadProofPhotos(photos) : undefined;
      const odo = odometerEnd.trim();
      await onMarkDelivered(challan.id, composeNotes(), qty === '' ? undefined : qty, proofPaths, odo === '' ? undefined : odo);
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'Could not complete the delivery');
    } finally {
      setMarking(false);
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: `1px solid color-mix(in srgb, ${s.color} 16%, transparent)`,
      borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,.28)',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 72, height: 72, borderRadius: '0 16px 0 72px',
        background: s.bg, display: 'grid', placeItems: 'center', paddingTop: 8, paddingLeft: 8,
      }}>
        <StatusIcon size={18} style={{ color: s.color }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>{challan.challanNo}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: s.color, background: s.bg, border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`, textTransform: 'capitalize' }}>
          {challan.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Grade</div>
          <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 800 }}>{challan.grade}</span>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Volume</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{parseFloat(challan.quantity).toFixed(1)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>m³</span></div>
          {challan.deliveredQuantity != null && (
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', marginTop: 2 }}>
              Delivered {parseFloat(challan.deliveredQuantity).toFixed(1)} m³
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Client</div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{challan.clientName || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Vehicle</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 700 }}>{challan.vehicleNo || '—'}</div>
        </div>
      </div>

      {challan.siteName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '7px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 8 }}>
          <MapPin size={12} style={{ color: 'var(--muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{challan.siteName}</span>
        </div>
      )}

      {isActionable && (
        <FreshnessCountdown dispatchTime={challan.dispatchTime} config={freshnessConfig} variant="banner" />
      )}

      {isActionable && hasPin && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${challan.siteLat},${challan.siteLng}&travelmode=driving`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 14,
            padding: '10px 0', borderRadius: 10, textDecoration: 'none',
            background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)',
            color: 'var(--blue)', fontSize: 13, fontWeight: 700,
          }}
        >
          <MapIcon size={15} /> Navigate to site
        </a>
      )}

      {isActionable && tracking && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, padding: '8px 11px', borderRadius: 9,
          background: liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'rgba(34,197,94,.12)' : 'rgba(56,189,248,.09)',
          border: `1px solid ${liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'rgba(56,189,248,.2)'}`,
        }}>
          <Navigation size={13} style={{ color: liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'var(--green)' : 'var(--blue)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'var(--green)' : 'var(--blue)' }}>
            {!hasPin ? 'Site has no GPS pin — mark manually'
              : liveDistanceM == null ? 'Locating…'
              : liveDistanceM <= GEOFENCE_RADIUS_M ? 'At site — auto-completing delivery…'
              : `${fmtDist(liveDistanceM)} to site`}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: isActionable || onSite ? 14 : 0 }}>
        {challan.dispatchTime && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Dispatched</div>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{fmtTime(challan.dispatchTime)}</div>
          </div>
        )}
        {challan.siteArrivalTime && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Arrived</div>
            <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>{fmtTime(challan.siteArrivalTime)}</div>
          </div>
        )}
        {challan.siteReleaseTime && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Left site</div>
            <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{fmtTime(challan.siteReleaseTime)}</div>
          </div>
        )}
        {challan.deliveryTime && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Delivered</div>
            <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{fmtTime(challan.deliveryTime)}</div>
          </div>
        )}
      </div>

      {(timing.travelMin != null || timing.siteMin != null) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: isActionable || onSite ? 14 : 0 }}>
          {timing.travelMin != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Timer size={13} style={{ color: 'var(--muted)' }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Travel</span>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{formatDuration(timing.travelMin)}</span>
            </div>
          )}
          {timing.siteMin != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} style={{ color: 'var(--muted)' }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>At site</span>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{formatDuration(timing.siteMin)}</span>
            </div>
          )}
          {timing.billableIdleMin != null && timing.billableIdleMin > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Idle</span>
              <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{formatDuration(timing.billableIdleMin)}</span>
            </div>
          )}
        </div>
      )}

      {onSite && (
        <div style={{ marginBottom: 0 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Return odometer (km, optional)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={odometerEnd}
            onChange={e => setOdometerEnd(e.target.value)}
            placeholder="Vehicle odometer reading"
            disabled={leaving}
            style={{
              width: '100%', padding: '9px 11px', borderRadius: 8, marginBottom: 10,
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
              color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
            }}
          />
          <button
            onClick={async () => {
              setLeaving(true); setLeaveErr('');
              const odo = odometerEnd.trim();
              try { await onLeftSite(challan.id, odo === '' ? undefined : odo); }
              catch (err) { setLeaveErr(err instanceof Error ? err.message : 'Could not record site release'); }
              finally { setLeaving(false); }
            }}
            disabled={leaving}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
              cursor: leaving ? 'not-allowed' : 'pointer',
              background: leaving ? 'rgba(247,201,72,.12)' : 'color-mix(in srgb, var(--gold) 14%, transparent)',
              color: 'var(--gold)', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <LogOut size={15} />
            {leaving ? 'Recording…' : 'Mark Left Site'}
          </button>
          {leaveErr && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{leaveErr}</div>}
        </div>
      )}

      {isActionable && (
        !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#16a34a,var(--green))',
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 16px rgba(34,197,94,.3)', transition: 'all .2s',
            }}
          >
            <CheckCircle size={15} />
            Mark as Delivered
          </button>
        ) : (
          <div style={{
            padding: 14, borderRadius: 12, background: 'rgba(34,197,94,.06)',
            border: '1px solid color-mix(in srgb, var(--green) 22%, transparent)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> Proof of delivery
            </div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Received by (optional)</label>
            <input
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder="Recipient name"
              disabled={marking}
              style={{
                width: '100%', padding: '9px 11px', borderRadius: 8, marginBottom: 10,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
              }}
            />
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Delivered quantity (m³)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={deliveredQty}
              onChange={e => setDeliveredQty(e.target.value)}
              placeholder={`Planned: ${parseFloat(challan.quantity || '0').toFixed(1)} m³`}
              disabled={marking}
              style={{
                width: '100%', padding: '9px 11px', borderRadius: 8, marginBottom: 10,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
              }}
            />
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Return odometer (km, optional)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={odometerEnd}
              onChange={e => setOdometerEnd(e.target.value)}
              placeholder="Vehicle odometer reading"
              disabled={marking}
              style={{
                width: '100%', padding: '9px 11px', borderRadius: 8, marginBottom: 10,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
              }}
            />
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Delivery note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. delivered full quantity, site contact verified"
              rows={2}
              disabled={marking}
              style={{
                width: '100%', padding: '9px 11px', borderRadius: 8, marginBottom: 12,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>
              Delivery photos (optional){photos.length > 0 ? ` — ${photos.length}/${MAX_PROOF_PHOTOS}` : ''}
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoPick}
              style={{ display: 'none' }}
            />
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8, marginBottom: 10 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img
                      src={p}
                      alt={`Proof of delivery ${i + 1}`}
                      style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', display: 'block' }}
                    />
                    {!marking && (
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        aria-label={`Remove photo ${i + 1}`}
                        style={{
                          position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%',
                          background: 'rgba(0,0,0,.65)', border: '1px solid rgba(255,255,255,.2)', cursor: 'pointer',
                          color: '#fff', display: 'grid', placeItems: 'center',
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {photos.length < MAX_PROOF_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={marking || photoBusy}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, marginBottom: 12,
                  cursor: marking || photoBusy ? 'not-allowed' : 'pointer',
                  background: 'rgba(56,189,248,.08)', border: '1px dashed rgba(56,189,248,.35)',
                  color: 'var(--blue)', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <Camera size={15} />
                {photoBusy ? 'Processing…' : photos.length > 0 ? 'Add another photo' : 'Take / upload photos'}
              </button>
            )}
            {photoErr && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{photoErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowForm(false); }}
                disabled={marking}
                style={{
                  flex: '0 0 auto', padding: '10px 16px', borderRadius: 9, cursor: marking ? 'not-allowed' : 'pointer',
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                  color: 'var(--muted)', fontSize: 13, fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMark}
                disabled={marking}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: marking ? 'not-allowed' : 'pointer',
                  background: marking ? 'rgba(34,197,94,.2)' : 'linear-gradient(135deg,#16a34a,var(--green))',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: marking ? 'none' : '0 4px 16px rgba(34,197,94,.3)', transition: 'all .2s',
                }}
              >
                <CheckCircle size={15} />
                {marking ? 'Confirming…' : 'Confirm Delivery'}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function GPSPanel({
  tracking, geoState, geoMsg, lastFix, nearestM, activeCount, onToggle,
}: {
  tracking: boolean;
  geoState: 'off' | 'active' | 'denied' | 'unsupported' | 'error';
  geoMsg: string;
  lastFix: { accuracy: number | null; at: number } | null;
  nearestM: number | null;
  activeCount: number;
  onToggle: () => void;
}) {
  const on = tracking && geoState === 'active';
  return (
    <div style={{
      background: on ? 'linear-gradient(135deg,rgba(34,197,94,.1),rgba(8,17,31,.9))' : 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: `1px solid ${on ? 'color-mix(in srgb, var(--green) 28%, transparent)' : 'rgba(255,255,255,.08)'}`,
      borderRadius: 16, padding: 18, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: on ? 'color-mix(in srgb, var(--green) 16%, transparent)' : 'rgba(56,189,248,.1)',
            border: `1px solid ${on ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'rgba(56,189,248,.2)'}`,
            position: 'relative',
          }}>
            <Satellite size={20} style={{ color: on ? 'var(--green)' : 'var(--blue)' }} />
            {on && <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 0 rgba(34,197,94,.5)', animation: 'rmc-pulse 1.8s infinite' }} />}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Live GPS Auto-Delivery</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {on ? 'Tracking your location — deliveries complete automatically on arrival'
                  : `Trips auto-complete when you arrive within ${GEOFENCE_RADIUS_M} m of the site`}
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={activeCount === 0 && !on}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11,
            cursor: activeCount === 0 && !on ? 'not-allowed' : 'pointer',
            background: on ? 'rgba(239,68,68,.14)' : (activeCount === 0 ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg,#16a34a,var(--green))'),
            color: on ? 'var(--red)' : (activeCount === 0 ? 'var(--muted)' : '#fff'),
            border: on ? '1px solid color-mix(in srgb, var(--red) 30%, transparent)' : '1px solid transparent',
            fontSize: 13, fontWeight: 800, transition: 'all .2s', whiteSpace: 'nowrap',
          }}
        >
          <Navigation size={15} />
          {on ? 'Stop tracking' : 'Start tracking'}
        </button>
      </div>

      {on && (
        <div style={{ display: 'flex', gap: 22, marginTop: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Nearest site</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{nearestM == null ? '—' : fmtDist(nearestM)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>GPS accuracy</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{lastFix?.accuracy != null ? `±${Math.round(lastFix.accuracy)} m` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Last fix</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
              {lastFix ? new Date(lastFix.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
            </div>
          </div>
        </div>
      )}

      {(geoState === 'denied' || geoState === 'unsupported' || geoState === 'error') && geoMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(239,68,68,.1)', border: '1px solid color-mix(in srgb, var(--red) 26%, transparent)',
          color: 'var(--red)', fontSize: 12, fontWeight: 600,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          {geoMsg}
        </div>
      )}
    </div>
  );
}

export default function MyTrips() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [freshnessConfig, setFreshnessConfig] = useState<FreshnessConfig | null>(null);
  const [filter, setFilter] = useState<'all' | 'dispatched' | 'delivered'>('all');
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const [tracking, setTracking] = useState(false);
  const [geoState, setGeoState] = useState<'off' | 'active' | 'denied' | 'unsupported' | 'error'>('off');
  const [geoMsg, setGeoMsg] = useState('');
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; accuracy: number | null; at: number } | null>(null);
  const [liveDist, setLiveDist] = useState<Record<number, number | null>>({});

  const lastFixRef = useRef<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postingRef = useRef(false);
  const challansRef = useRef<Challan[]>([]);
  useEffect(() => { challansRef.current = challans; }, [challans]);

  useEffect(() => {
    let cancelled = false;
    async function loadTrips() {
      setLoading(true);
      const url = viewAll ? '/me/trips?from=2020-01-01' : '/me/trips';
      try {
        const rows = await api.get<Challan[]>(url);
        if (!cancelled) { setChallans(rows); setLoading(false); }
      } catch (e: unknown) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Error'); setLoading(false); }
      }
    }
    loadTrips();
    return () => { cancelled = true; };
  }, [viewAll]);

  // Working-life config so the pour-by countdown matches the plant's setting.
  // Best-effort: the banner just hides if this never loads.
  useEffect(() => {
    let cancelled = false;
    api.get<FreshnessConfig>('/positions/freshness-config')
      .then(cfg => { if (!cancelled) setFreshnessConfig(cfg); })
      .catch(() => { /* countdown is non-critical */ });
    return () => { cancelled = true; };
  }, []);

  async function handleMarkDelivered(id: number, notes?: string, deliveredQuantity?: string, proofPhotos?: string[], odometerEnd?: string) {
    const updated = await api.put<Challan>(`/challans/${id}`, {
      status: 'delivered',
      ...(notes ? { notes } : {}),
      ...(deliveredQuantity !== undefined ? { deliveredQuantity } : {}),
      ...(proofPhotos && proofPhotos.length ? { proofPhotos } : {}),
      ...(odometerEnd !== undefined ? { odometerEnd } : {}),
    });
    let challanNo = '';
    setChallans(prev => prev.map(c => {
      if (c.id === id) {
        challanNo = c.challanNo;
        return { ...c, status: 'delivered', deliveryTime: updated.deliveryTime ?? new Date().toISOString(), notes: updated.notes, deliveredQuantity: updated.deliveredQuantity, odometerEnd: updated.odometerEnd ?? c.odometerEnd, hasProofPhoto: updated.hasProofPhoto ?? (proofPhotos != null && proofPhotos.length > 0) };
      }
      return c;
    }));
    setConfirmation(`${challanNo} marked as delivered`);
    window.setTimeout(() => setConfirmation(''), 4000);
  }

  // Manual site release from the trip card — stamps the release time now even if
  // the GPS hasn't yet detected the truck leaving.
  async function handleLeftSite(id: number, odometerEnd?: string) {
    const updated = await api.post<Challan>(`/challans/${id}/left-site`, {
      ...(odometerEnd !== undefined ? { odometerEnd } : {}),
    });
    let challanNo = '';
    setChallans(prev => prev.map(c => {
      if (c.id === id) {
        challanNo = c.challanNo;
        return { ...c, siteReleaseTime: updated.siteReleaseTime ?? new Date().toISOString(), odometerEnd: updated.odometerEnd ?? c.odometerEnd };
      }
      return c;
    }));
    setConfirmation(`${challanNo} — site release recorded`);
    window.setTimeout(() => setConfirmation(''), 4000);
  }

  // Push the latest fix to the server for each tracked trip — dispatched trips
  // heading to site, plus arrived-but-not-released trips waiting for departure.
  // The server runs the authoritative geofence and may auto-complete a delivery
  // (arrival) or stamp the site release (departure).
  const doPost = useCallback(async () => {
    const fix = lastFixRef.current;
    if (!fix || postingRef.current) return;
    const active = challansRef.current.filter(needsTracking);
    if (!active.length) return;
    postingRef.current = true;
    try {
      const results = await Promise.allSettled(active.map(c =>
        api.post<PositionUpdateResult>('/positions', {
          challanId: c.id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy,
        }).then(r => ({ id: c.id, no: c.challanNo, r }))
      ));
      const dist: Record<number, number | null> = {};
      const updates: Record<number, Partial<Challan>> = {};
      const deliveredNos: string[] = [];
      const releasedNos: string[] = [];
      for (const res of results) {
        if (res.status !== 'fulfilled') continue;
        const { id, no, r } = res.value;
        dist[id] = r.distanceM;
        const u: Partial<Challan> = {};
        if (r.delivered) { u.status = 'delivered'; u.deliveryTime = new Date().toISOString(); deliveredNos.push(no); }
        if (r.siteArrivalTime) u.siteArrivalTime = r.siteArrivalTime;
        if (r.siteReleaseTime) u.siteReleaseTime = r.siteReleaseTime;
        if (r.released) releasedNos.push(no);
        if (Object.keys(u).length) updates[id] = u;
      }
      setLiveDist(prev => ({ ...prev, ...dist }));
      if (Object.keys(updates).length) {
        setChallans(prev => prev.map(c => updates[c.id] ? { ...c, ...updates[c.id] } : c));
      }
      const msgs: string[] = [];
      if (deliveredNos.length) msgs.push(`${deliveredNos.join(', ')} auto-delivered on arrival`);
      if (releasedNos.length) msgs.push(`${releasedNos.join(', ')} left site`);
      if (msgs.length) {
        setConfirmation(msgs.join(' · '));
        window.setTimeout(() => setConfirmation(''), 5000);
      }
    } finally {
      postingRef.current = false;
    }
  }, []);

  // Start/stop geolocation watch + heartbeat poll while tracking is enabled.
  // GPS support and the initial geoState/geoMsg are set in the toggle handler so
  // this effect only subscribes to the external system (no synchronous setState).
  useEffect(() => {
    if (!tracking) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const f = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        };
        lastFixRef.current = f;
        setLastFix({ ...f, at: Date.now() });
        void doPost();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState('denied');
          setGeoMsg('Location permission denied. Enable location access in your browser settings to use auto-delivery.');
          setTracking(false);
        } else {
          setGeoState('error');
          setGeoMsg(err.message || 'Unable to read your location. Make sure GPS is on and try again.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    // Heartbeat: re-post the last fix even while stationary so the geofence can
    // accumulate the consecutive in-radius fixes it needs to auto-complete.
    intervalRef.current = setInterval(() => { void doPost(); }, POST_INTERVAL_MS);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      lastFixRef.current = null;
    };
  }, [tracking, doPost]);

  // Auto-stop tracking once no trips need GPS any more — i.e. nothing is en
  // route and nothing is on-site awaiting release. Adjusting state during render
  // (React's documented pattern) avoids an extra effect pass.
  if (tracking && !challans.some(needsTracking)) {
    setTracking(false);
    setGeoState('off');
    setLastFix(null);
  }

  const filtered = filter === 'all' ? challans : challans.filter(c => c.status === filter);
  const active = challans.filter(c => c.status === 'dispatched').length;
  const trackable = challans.filter(needsTracking).length;
  const delivered = challans.filter(c => c.status === 'delivered').length;
  const totalVol = challans.filter(c => c.status === 'delivered').reduce((s, c) => s + parseFloat(c.quantity || '0'), 0);

  // Nearest active site distance for the GPS panel header (prefer server value,
  // fall back to a client-side estimate from the last fix).
  const nearestM = (() => {
    const dispatched = challans.filter(c => c.status === 'dispatched');
    let best: number | null = null;
    for (const c of dispatched) {
      let d = liveDist[c.id];
      if ((d == null || d === undefined) && lastFix && c.siteLat != null && c.siteLng != null) {
        d = Math.round(haversineM(lastFix.lat, lastFix.lng, Number(c.siteLat), Number(c.siteLng)));
      }
      if (d != null && (best == null || d < best)) best = d;
    }
    return best;
  })();

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <style>{`@keyframes rmc-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>My Trips</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
            {viewAll ? 'All assigned delivery challans' : "Today's assigned delivery challans"}
          </p>
        </div>
        <button
          onClick={() => setViewAll(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: viewAll ? 'color-mix(in srgb, var(--gold) 15%, transparent)' : 'rgba(255,255,255,.06)',
            border: `1px solid ${viewAll ? '#f7c94844' : 'rgba(255,255,255,.1)'}`,
            borderRadius: 10, cursor: 'pointer', color: viewAll ? 'var(--gold)' : 'var(--muted)',
            fontSize: 12, fontWeight: 600, transition: 'all .2s',
          }}
        >
          <CalendarDays size={14} />
          {viewAll ? 'Today only' : 'View history'}
        </button>
      </div>

      {confirmation && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '12px 16px',
          background: 'rgba(34,197,94,.12)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)',
          borderRadius: 12, color: 'var(--green)', fontSize: 13, fontWeight: 700,
        }}>
          <CheckCircle size={16} />
          {confirmation}
        </div>
      )}

      <GPSPanel
        tracking={tracking}
        geoState={geoState}
        geoMsg={geoMsg}
        lastFix={lastFix}
        nearestM={nearestM}
        activeCount={trackable}
        onToggle={() => {
          if (tracking) { setTracking(false); setGeoState('off'); return; }
          if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
            setGeoState('unsupported');
            setGeoMsg('This device or browser does not support GPS location.');
            return;
          }
          setGeoState('active'); setGeoMsg(''); setTracking(true);
        }}
      />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Active Trips', value: active, color: 'var(--blue)', icon: Truck },
          { label: 'Delivered', value: delivered, color: 'var(--green)', icon: CheckCircle },
          { label: 'Volume Delivered', value: `${totalVol.toFixed(1)} m³`, color: '#a78bfa', icon: Package },
        ].map(k => (
          <div key={k.label} style={{
            background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
            border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in srgb, ${k.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${k.color} 19%, transparent)`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <k.icon size={17} style={{ color: k.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {([['all', 'All'], ['dispatched', 'Active'], ['delivered', 'Delivered']] as const).map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            background: filter === val ? 'linear-gradient(135deg,var(--surface),var(--panel2))' : 'transparent',
            color: filter === val ? 'var(--text)' : 'var(--muted)',
            boxShadow: filter === val ? '0 2px 8px rgba(0,0,0,.25)' : 'none',
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--muted)',
          background: 'rgba(15,28,54,.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
        }}>
          <Truck size={36} style={{ opacity: .3, display: 'block', margin: '0 auto 12px' }} />
          {viewAll ? 'No trips found' : 'No trips assigned for today'}
          {!viewAll && (
            <button onClick={() => setViewAll(true)} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              View trip history →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {filtered.map(c => (
            <TripCard key={c.id} challan={c} onMarkDelivered={handleMarkDelivered} onLeftSite={handleLeftSite} tracking={tracking && geoState === 'active'} liveDistanceM={liveDist[c.id]} freshnessConfig={freshnessConfig} />
          ))}
        </div>
      )}
    </div>
  );
}
