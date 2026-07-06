import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Clock, Navigation2, FileText, Printer, ArrowLeft, Boxes } from 'lucide-react';
import { api, type Challan, type Order, type BatchRecord } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';

/* Daily production target per shift (m³) — used to score the shift. */
const SHIFT_TARGET_M3 = 50;

type Shift = { name: string; start: Date; end: Date };

/* Returns the absolute start/end datetimes of the shift containing `now`.
   The night shift spans midnight (22:00 → 06:00 next day), so boundaries are
   real Date objects rather than hour-of-day numbers. */
function shiftBounds(now: Date): Shift {
  const h = now.getHours();
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const at = (addDays: number, hour: number) => {
    const d = new Date(day); d.setDate(d.getDate() + addDays); d.setHours(hour, 0, 0, 0); return d;
  };
  if (h >= 6 && h < 14) return { name: 'Morning Shift', start: at(0, 6), end: at(0, 14) };
  if (h >= 14 && h < 22) return { name: 'Afternoon Shift', start: at(0, 14), end: at(0, 22) };
  if (h >= 22) return { name: 'Night Shift', start: at(0, 22), end: at(1, 6) };
  return { name: 'Night Shift', start: at(-1, 22), end: at(0, 6) };
}

const fmtClock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

const GRADE_DOT: Record<string, string> = {
  M40: '#a78bfa', M35: 'var(--green)', M30: 'var(--blue)', M25: 'var(--gold)', M20: 'var(--orange)',
};

export default function ShiftReport() {
  const [, navigate] = useLocation();
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());
  const { subscribe } = useSSE();

  const shift = shiftBounds(now);
  const shiftStartMs = shift.start.getTime();
  const shiftEndMs = shift.end.getTime();
  const shiftSpan = shiftEndMs - shiftStartMs;
  const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - shiftStartMs) / shiftSpan) * 100));
  const currentPercent = pct(now.getTime());

  // Anchor the memo to the shift's start date so a night shift keeps one memo across midnight.
  const memoKey = `rmc_shift_memo_${shift.start.toISOString().slice(0, 10)}_${shift.name.replace(/\s+/g, '_')}`;
  const [memo, setMemo] = useState(() => localStorage.getItem(memoKey) || '');
  const [memoSavedAt, setMemoSavedAt] = useState<string | null>(null);

  const saveMemo = (value: string) => {
    setMemo(value);
    localStorage.setItem(memoKey, value);
    setMemoSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  };

  const reload = useCallback(() => {
    Promise.all([
      api.get<BatchRecord[]>('/batches'),
      api.get<Challan[]>('/challans'),
      api.get<Order[]>('/orders'),
    ]).then(([b, c, o]) => {
      setBatches(b);
      setChallans(c);
      setOrders(o);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const unsub1 = subscribe('challan.created', () => reload());
    const unsub2 = subscribe('challan.updated', () => reload());
    const unsub3 = subscribe('order.updated', () => reload());
    const unsub4 = subscribe('reconnect', () => reload());
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [subscribe, reload]);

  // Batches produced during this shift's actual datetime window.
  const shiftBatches = batches
    .map(b => ({ batch: b, time: new Date(b.createdAt) }))
    .filter(({ time }) => time.getTime() >= shiftStartMs && time.getTime() <= shiftEndMs)
    .map(({ batch, time }) => ({ batch, time, p: pct(time.getTime()) }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const produced = shiftBatches.reduce((sum, { batch }) => sum + Number(batch.quantity || 0), 0);
  const score = Math.min(100, Math.round((produced / SHIFT_TARGET_M3) * 100));

  // Mix breakdown for the shift.
  const mixCounts = shiftBatches.reduce<Record<string, number>>((acc, { batch }) => {
    acc[batch.grade] = (acc[batch.grade] || 0) + 1;
    return acc;
  }, {});
  const mixRows = Object.entries(mixCounts).sort((a, b) => b[1] - a[1]);

  const inTransit = challans.filter(c => c.status === 'dispatched').slice(0, 6);
  const pendingNext = orders.filter(o => o.status === 'pending' || o.status === 'in_progress').slice(0, 6);

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center', fontSize: 14 }}>Loading shift report…</div>;
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16,
        flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 18, marginBottom: 28,
      }}>
        <div>
          <button
            onClick={() => navigate('/')}
            className="sr-noprint"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, cursor: 'pointer',
              background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, padding: 0,
            }}
          >
            <ArrowLeft size={14} /> Back to Command Center
          </button>
          <p style={{
            margin: 0, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.18em',
            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Clock size={13} /> Shift Handover Report
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 300, color: 'var(--text)', letterSpacing: '-.5px' }}>
            {shift.name}
          </h1>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 13, color: 'var(--muted)',
            padding: '5px 12px', borderRadius: 999, background: 'var(--chip-bg)', border: '1px solid var(--line)',
          }}>
            {fmtClock(shift.start)} — {fmtClock(shift.end)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'monospace', fontSize: 12, color: 'var(--gold)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 8px var(--gold)' }} />
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} NOW
          </span>
          <button
            onClick={() => window.print()}
            className="sr-noprint"
            style={{
              display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
              padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 800,
              color: 'var(--text)', background: 'var(--chip-bg)', border: '1px solid var(--line)',
            }}
          >
            <Printer size={14} /> Print Handover
          </button>
        </div>
      </header>

      {/* Zone 1: Shift score + timeline + mix */}
      <section className="glass-card sr-card" style={{ padding: 28, marginBottom: 32, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -10, fontSize: 220, fontWeight: 800, lineHeight: 1, color: 'var(--text)', opacity: .03, pointerEvents: 'none' }}>
          {score}
        </div>
        <div className="sr-zone1" style={{ display: 'flex', gap: 44, position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
          {/* Score */}
          <div style={{ minWidth: 200 }}>
            <p style={{ margin: 0, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, fontWeight: 700 }}>Shift Score</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
              <span style={{ fontSize: 64, fontWeight: 300, color: 'var(--text)', letterSpacing: '-2px', lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: 28, fontWeight: 300, color: 'var(--muted)' }}>%</span>
            </div>
            <div style={{ height: 6, maxWidth: 160, background: 'var(--chip-bg)', borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ height: '100%', width: `${score}%`, background: 'linear-gradient(90deg,var(--gold-hi),var(--gold))', borderRadius: 999 }} />
            </div>
            <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{produced.toFixed(1)}</span> / {SHIFT_TARGET_M3} m³ target
            </p>
          </div>

          {/* Timeline */}
          <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ margin: '0 0 28px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, fontWeight: 700 }}>
              Production Timeline · {shiftBatches.length} batch{shiftBatches.length === 1 ? '' : 'es'}
            </p>
            <div style={{ position: 'relative', height: 6, background: 'var(--chip-bg)', borderRadius: 999 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${currentPercent}%`, background: 'var(--chip-bg)', borderRadius: 999 }} />
              {shiftBatches.map(({ batch, time, p }, i) => (
                <div
                  key={batch.id}
                  title={`#${i + 1} · ${fmtClock(time)} · ${batch.grade} · ${batch.quantity} m³`}
                  style={{
                    position: 'absolute', top: '50%', left: `${p}%`, width: 12, height: 12,
                    transform: 'translate(-50%,-50%)', borderRadius: '50%',
                    background: 'var(--text)', border: '2px solid var(--bg-deep)',
                    boxShadow: '0 0 8px rgba(255,255,255,.4)', zIndex: 2,
                  }}
                />
              ))}
              <div style={{ position: 'absolute', top: '50%', left: `${currentPercent}%`, width: 2, height: 24, transform: 'translate(-50%,-50%)', background: 'var(--gold)', boxShadow: '0 0 10px var(--gold)', zIndex: 1 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
              <span>{fmtClock(shift.start)}</span>
              <span>{fmtClock(shift.end)}</span>
            </div>
          </div>

          {/* Mix breakdown */}
          <div style={{ minWidth: 180, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ margin: '0 0 14px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, fontWeight: 700 }}>Mix Breakdown</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {mixRows.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>No batches yet this shift.</span>}
              {mixRows.map(([grade, count]) => (
                <div key={grade} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 10, fontSize: 13,
                  background: 'var(--chip-bg)', border: '1px solid var(--line)',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: GRADE_DOT[grade] || 'var(--muted)' }} />
                    {grade}
                  </span>
                  <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>{count} load{count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Zone 2: In transit right now */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Navigation2 size={15} style={{ color: 'var(--gold)' }} /> Right Now · In Transit
        </h2>
        {inTransit.length === 0 ? (
          <div className="glass-card" style={{ padding: 22, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
            No mixers in transit right now.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px, 100%), 1fr))', gap: 14 }}>
            {inTransit.map(ch => (
              <div key={ch.id} className="glass-card cc-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--text)', padding: '3px 8px', borderRadius: 7, background: 'var(--chip-bg)' }}>
                      #{ch.challanNo}
                    </span>
                    <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ch.siteName || ch.clientName || '—'}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--muted)' }}>{ch.grade} · {ch.quantity} m³ · {ch.driverName || '—'}</p>
                  </div>
                  <span style={{
                    flexShrink: 0, fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--gold)',
                    padding: '4px 9px', borderRadius: 7,
                    background: 'color-mix(in srgb, var(--gold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 22%, transparent)',
                  }}>EN ROUTE</span>
                </div>
                <div style={{ height: 6, background: 'var(--chip-bg)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '55%', background: 'linear-gradient(90deg, color-mix(in srgb, var(--gold) 45%, transparent), var(--gold))', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Zone 3: Handover — pending next shift + shift memo */}
      <section className="sr-zone3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <div>
          <h2 style={{ margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Boxes size={15} style={{ color: 'var(--blue)' }} /> Pending Dispatch · Next Shift
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingNext.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing waiting — all orders are dispatched.</span>}
            {pendingNext.map(o => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '12px 14px', borderRadius: 10, background: 'var(--chip-bg)', border: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--muted)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{o.orderNo}</span>
                    <span style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.clientName}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, flexShrink: 0 }}>
                  <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>{o.grade}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, width: 56, textAlign: 'right' }}>{o.quantity} m³</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={15} /> Shift Memo</span>
            {memoSavedAt && <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)' }}>SAVED {memoSavedAt}</span>}
          </h2>
          <textarea
            value={memo}
            onChange={e => saveMemo(e.target.value)}
            spellCheck={false}
            placeholder="Notes for the next shift — mixer servicing, client confirmations, pending pours…"
            style={{
              flex: 1, minHeight: 150, width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 14,
              padding: 18, color: 'var(--text)', fontSize: 13.5, lineHeight: 1.6, fontFamily: 'monospace',
              outline: 'none',
            }}
          />
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .sr-zone3 { grid-template-columns: 1fr !important; gap: 28px !important; }
          .sr-zone1 { gap: 28px !important; }
        }
        @media (max-width: 480px) {
          .sr-card { padding: 18px !important; }
          .sr-zone1 { gap: 22px !important; }
          .sr-zone1 > div { min-width: 0 !important; }
        }
        @media print {
          .sr-noprint { display: none !important; }
        }
      `}</style>
    </div>
  );
}
