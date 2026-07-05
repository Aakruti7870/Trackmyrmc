import { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, CalendarClock, Clock, RefreshCw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface AttendanceRecord {
  id: number;
  checkInAt: string;
  checkOutAt: string | null;
  checkInNote: string | null;
  checkOutNote: string | null;
}

interface MyStatus {
  open: AttendanceRecord | null;
  checkedIn: boolean;
  recent: AttendanceRecord[];
}

interface ReportRow {
  id: number;
  userId: number;
  userName: string | null;
  role: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  checkInNote: string | null;
  checkOutNote: string | null;
}

const REPORT_ROLES = new Set(['admin', 'plant_owner', 'supervisor', 'authority']);

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// One-shot geolocation as a promise; resolves null if unavailable or denied so
// the caller can still record attendance and warn the user separately.
function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
  });
}

function duration(from: string, to: string | null): string {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';
  const mins = Math.round((end - start) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Attendance() {
  const { user } = useAuth();
  const canViewReport = user ? REPORT_ROLES.has(user.role) : false;

  const [status, setStatus] = useState<MyStatus | null>(null);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  const loadStatus = () => api.get<MyStatus>('/attendance/me').then(setStatus);
  const loadReport = () => api.get<ReportRow[]>('/attendance').then(setReport).catch(() => {});

  useEffect(() => {
    loadStatus().catch(() => setError('Could not load your attendance status.'));
    if (canViewReport) loadReport();
  }, [canViewReport]);

  const act = async (action: 'check-in' | 'check-out') => {
    setBusy(true);
    setError(null);
    setGpsWarning(null);
    // Best-effort one-shot fix so the shift's start/end point is recorded. If the
    // user denies location we still record attendance, but warn that live duty
    // tracking needs it.
    const coords = await getCurrentCoords();
    if (!coords) setGpsWarning('Location permission is required for active duty tracking.');
    try {
      await api.post(`/attendance/${action}`, {
        note: note.trim() || undefined,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      setNote('');
      await loadStatus();
      if (canViewReport) await loadReport();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const checkedIn = status?.checkedIn ?? false;

  const [gpsLive, setGpsLive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  // While checked in, stream the device's live GPS location to the plant so the
  // staff "live drivers" dashboard can follow the shift. Stops on check-out.
  useEffect(() => {
    if (!checkedIn) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsLive(true);
        // Throttle to at most one post every 10s to spare battery/bandwidth.
        const now = Date.now();
        if (now - lastSentRef.current < 10000) return;
        lastSentRef.current = now;
        api.post('/attendance/location', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : undefined,
          speed: Number.isFinite(pos.coords.speed ?? NaN) ? pos.coords.speed : undefined,
          heading: Number.isFinite(pos.coords.heading ?? NaN) ? pos.coords.heading : undefined,
        }).catch(() => { /* best-effort; the shift continues regardless */ });
      },
      () => { setGpsLive(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      lastSentRef.current = 0;
      setGpsLive(false);
    };
  }, [checkedIn]);

  const accent = checkedIn ? '#22c55e' : 'var(--gold)';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <style>{ATT_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <CalendarClock size={22} color="var(--gold)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Attendance</h1>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Check in when you start and check out when you finish.</div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13,
          background: 'color-mix(in srgb, #ef4444 12%, var(--surface))',
          border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
        }}>
          {error}
        </div>
      )}

      {gpsWarning && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13,
          background: 'color-mix(in srgb, #f59e0b 12%, var(--surface))',
          border: '1px solid color-mix(in srgb, #f59e0b 40%, transparent)',
          color: 'var(--text)',
        }}>
          {gpsWarning}
        </div>
      )}

      {/* My status card */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18, padding: 20, marginBottom: 24,
        background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 14%, var(--surface)), var(--surface) 70%)`,
        border: `1px solid color-mix(in srgb, ${accent} 28%, var(--line))`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            flexShrink: 0, width: 52, height: 52, borderRadius: 15, display: 'grid', placeItems: 'center',
            background: accent, color: '#fff',
          }}>
            {checkedIn ? <LogIn size={24} /> : <Clock size={24} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800 }}>
              {checkedIn ? 'You are checked in' : 'Not checked in'}
              {checkedIn && <span className="att-live-dot" />}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, fontWeight: 600 }}>
              {checkedIn && status?.open
                ? `Since ${fmt(status.open.checkInAt)} · ${duration(status.open.checkInAt, null)} on shift`
                : 'Tap check in to start your shift'}
            </div>
            {checkedIn && (
              <div style={{ fontSize: 11.5, color: gpsLive ? '#16a34a' : 'var(--muted)', marginTop: 4, fontWeight: 600 }}>
                {gpsLive ? 'Sharing live location with your plant' : 'Waiting for GPS location…'}
              </div>
            )}
          </div>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={checkedIn ? 'Check-out note (optional)' : 'Check-in note (optional)'}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 12,
            background: 'var(--panel2)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13,
          }}
        />

        {checkedIn ? (
          <button
            onClick={() => act('check-out')}
            disabled={busy}
            style={btnStyle('#ef4444', busy)}
          >
            <LogOut size={16} /> Check out
          </button>
        ) : (
          <button
            onClick={() => act('check-in')}
            disabled={busy}
            style={btnStyle('var(--gold)', busy)}
          >
            <LogIn size={16} /> Check in
          </button>
        )}
      </div>

      {/* My recent history */}
      <SectionTitle>My recent shifts</SectionTitle>
      <RecordTable
        rows={(status?.recent ?? []).map((r) => ({ ...r, userName: null, role: null, userId: 0 }))}
        showWho={false}
      />

      {/* Plant-wide report */}
      {canViewReport && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 0' }}>
            <SectionTitle>Plant attendance report</SectionTitle>
            <button
              onClick={loadReport}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          <RecordTable rows={report} showWho />
        </>
      )}
    </div>
  );
}

function btnStyle(bg: string, busy: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
    background: bg, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700,
    cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: 'var(--text)' }}>{children}</h2>;
}

function RecordTable({ rows, showWho }: { rows: ReportRow[]; showWho: boolean }) {
  if (rows.length === 0) {
    return <div style={{ padding: 18, color: 'var(--muted)', fontSize: 13 }}>No records yet.</div>;
  }
  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--panel2)', textAlign: 'left' }}>
            {showWho && <Th>Person</Th>}
            <Th>Check in</Th>
            <Th>Check out</Th>
            <Th>Duration</Th>
            <Th>Notes</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
              {showWho && (
                <Td>
                  <div style={{ fontWeight: 600 }}>{r.userName || `User #${r.userId}`}</div>
                  {r.role && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {r.role.replace('_', ' ')}
                    </div>
                  )}
                </Td>
              )}
              <Td>{fmt(r.checkInAt)}</Td>
              <Td>
                {r.checkOutAt ? fmt(r.checkOutAt) : (
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>Active</span>
                )}
              </Td>
              <Td>{duration(r.checkInAt, r.checkOutAt)}</Td>
              <Td>
                <span style={{ color: 'var(--muted)' }}>
                  {[r.checkInNote, r.checkOutNote].filter(Boolean).join(' · ') || '—'}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{children}</td>;
}

const ATT_CSS = `
@keyframes attBlink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
.att-live-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; display: inline-block; animation: attBlink 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .att-live-dot { animation: none; } }
`;
