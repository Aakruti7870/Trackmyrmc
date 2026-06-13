import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  X, TrendingUp, Boxes, Clock, Radio, CarFront, IndianRupee, Truck, ClipboardList, Pause, Play,
} from 'lucide-react';
import { api, type DashboardKPIs, type Challan, type Order } from '@/lib/api';
import LiveGPSTracker from '@/components/LiveGPSTracker';
import { useSSE } from '@/lib/useSSE';

/* Big-screen control-room view: fullscreen, auto-rotating live scenes for a wall display. */
const SCENES = ['Operations Overview', 'Live Fleet', 'Dispatch Queue'];
const ROTATE_MS = 12000;

export default function Kiosk() {
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [online, setOnline] = useState(0);
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(new Date());
  const { subscribe } = useSSE();

  const reload = useCallback(() => {
    Promise.all([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Challan[]>('/challans'),
      api.get<Order[]>('/orders'),
    ]).then(([k, c, o]) => {
      setKpis(k);
      setOnline(c.filter(x => x.status === 'dispatched').length);
      setChallans(c.slice(0, 10));
      setOrders(o.filter(x => x.status === 'pending' || x.status === 'in_progress').slice(0, 8));
    }).catch(() => {});
  }, []);

  useEffect(() => { reload(); const t = setInterval(reload, 20000); return () => clearInterval(t); }, [reload]);
  useEffect(() => {
    const u1 = subscribe('challan.created', reload);
    const u2 = subscribe('challan.updated', reload);
    return () => { u1(); u2(); };
  }, [subscribe, reload]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // auto-rotate scenes (unless paused)
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setScene(s => (s + 1) % SCENES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused]);

  // Esc exits the kiosk
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate('/'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const fmtRs = (n: number) => (n ?? 0) >= 100000 ? `₹${((n ?? 0) / 100000).toFixed(1)}L` : `₹${(n ?? 0).toLocaleString('en-IN')}`;
  const statusColor = (s: string) => ({
    pending: 'var(--gold)', in_progress: 'var(--blue)', completed: 'var(--green)',
    cancelled: 'var(--red)', dispatched: 'var(--blue)', delivered: 'var(--green)',
  }[s] || 'var(--muted)');
  const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  const tiles = kpis ? [
    { label: 'Today Dispatch', value: `${Number(kpis.todayDispatch).toFixed(1)} m³`, sub: `${kpis.todayChallans} challans`, icon: TrendingUp, color: 'var(--green)' },
    { label: 'Today Production', value: `${Number(kpis.todayProduction).toFixed(1)} m³`, sub: `${kpis.todayBatches} batches`, icon: Boxes, color: 'var(--blue)' },
    { label: 'Active Orders', value: String(kpis.activeOrders), sub: `${kpis.pendingOrders} pending`, icon: Clock, color: 'var(--gold)' },
    { label: 'In Transit', value: String(online), sub: 'mixers on road', icon: Radio, color: 'var(--blue)' },
    { label: 'Fleet Active', value: `${kpis.activeVehicles}/${kpis.totalVehicles}`, sub: `${kpis.maintenanceVehicles} maintenance`, icon: CarFront, color: 'var(--orange)' },
    { label: 'Outstanding', value: fmtRs(Number(kpis.outstandingAmount)), sub: 'receivables', icon: IndianRupee, color: 'var(--red)' },
  ] : [];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      {/* ===== Header ===== */}
      <header style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 26px', borderBottom: '1px solid var(--line)', background: 'linear-gradient(180deg, var(--panel), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(145deg,var(--gold-hi),var(--gold-mid) 42%,var(--gold-dark))', display: 'grid', placeItems: 'center', fontWeight: 900, color: '#111827', fontSize: 13 }}>RMC</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '.5px' }}>CONCRETE KING</div>
            <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, letterSpacing: '2px' }}>CONTROL ROOM</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 26%, transparent)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 12px var(--green)', animation: 'kioskPulse 1.8s ease-in-out infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', letterSpacing: '.4px' }}>PLANT ONLINE</span>
          </div>
          <div style={{ textAlign: 'right', minWidth: 96 }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          </div>
          <button onClick={() => setPaused(p => !p)} title={paused ? 'Resume rotation' : 'Pause rotation'}
            style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', color: 'var(--text)' }}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button onClick={() => navigate('/')} title="Exit (Esc)"
            style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'color-mix(in srgb, var(--red) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 28%, transparent)', color: 'var(--red)' }}>
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ===== Scene title ===== */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px 6px' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 2.4vw, 34px)', fontWeight: 900, letterSpacing: '-.5px' }}>{SCENES[scene]}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {SCENES.map((s, i) => (
            <button key={s} onClick={() => setScene(i)} title={s}
              style={{ width: i === scene ? 28 : 10, height: 10, borderRadius: 999, cursor: 'pointer', border: 'none', padding: 0, background: i === scene ? 'var(--gold)' : 'rgba(255,255,255,.18)', transition: 'all .3s ease' }} />
          ))}
        </div>
      </div>

      {/* ===== Scene body ===== */}
      <main style={{ flex: 1, minHeight: 0, padding: '10px 26px 26px', overflow: 'hidden' }}>
        {/* Scene 0: Operations Overview */}
        {scene === 0 && (
          <div style={{ height: '100%', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 18 }}>
            {tiles.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="glass-card" style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: `color-mix(in srgb, ${color} 14%, transparent)`, display: 'grid', placeItems: 'center' }}>
                    <Icon size={22} style={{ color }} />
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
                </div>
                <div>
                  <div style={{ fontSize: 'clamp(34px, 4.4vw, 64px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>{value}</div>
                  <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 8 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Scene 1: Live Fleet */}
        {scene === 1 && (
          <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 16 }}>
            <div className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}><Radio size={18} style={{ color: 'var(--blue)' }} /> Live Fleet Movement</h3>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue)' }}>{online} mixer{online === 1 ? '' : 's'} in transit</span>
              </div>
              <div className="track-strip cc-scan">
                <div className="track-mixer"><span className="cab" /><span className="drum" /></div>
                <div className="track-mixer" style={{ animationDelay: '2.4s' }}><span className="cab" /><span className="drum" /></div>
                <div className="track-mixer" style={{ animationDelay: '4.8s' }}><span className="cab" /><span className="drum" /></div>
              </div>
            </div>
            <div style={{ minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
              <div style={{ flex: 1 }}><LiveGPSTracker /></div>
            </div>
          </div>
        )}

        {/* Scene 2: Dispatch Queue */}
        {scene === 2 && (
          <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {/* Dispatch queue */}
            <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}><ClipboardList size={18} style={{ color: 'var(--gold)' }} /> Dispatch Queue</h3>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map(o => (
                  <div key={o.id} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontWeight: 800, fontSize: 16, fontFamily: 'monospace', color: 'var(--gold)' }}>{o.orderNo}</span>
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: statusColor(o.status), background: `color-mix(in srgb, ${statusColor(o.status)} 14%, transparent)` }}>{statusLabel(o.status)}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{o.clientName}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{o.grade} · {o.quantity} m³{o.pumpRequired ? ' · Pump' : ''}</div>
                  </div>
                ))}
                {orders.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Queue is clear</div>}
              </div>
            </div>

            {/* Recent challans */}
            <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}><Truck size={18} style={{ color: 'var(--green)' }} /> Recent Dispatch</h3>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {challans.map(ch => (
                  <div key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'monospace', color: 'var(--gold)' }}>#{ch.challanNo}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{(ch.clientName || '—')} · {ch.vehicleNo || 'TM'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: statusColor(ch.status), background: `color-mix(in srgb, ${statusColor(ch.status)} 14%, transparent)` }}>{statusLabel(ch.status)}</span>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{ch.grade} · {ch.quantity} m³</div>
                    </div>
                  </div>
                ))}
                {challans.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No challans yet</div>}
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes kioskPulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--green) 50%, transparent); } 50% { box-shadow: 0 0 0 6px transparent; } }`}</style>
    </div>
  );
}
