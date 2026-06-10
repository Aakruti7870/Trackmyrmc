import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { TrendingUp, Package, Clock, Truck, Users, IndianRupee, ArrowRight, Activity } from 'lucide-react';
import { api, type DashboardKPIs, type Challan, type Order } from '@/lib/api';
import LiveGPSTracker from '@/components/LiveGPSTracker';
import { useAuth } from '@/lib/auth';
import { useSSE } from '@/lib/useSSE';

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const { subscribe } = useSSE();

  const reload = useCallback(() => {
    Promise.all([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Challan[]>('/challans'),
      api.get<Order[]>('/orders'),
    ]).then(([k, c, o]) => {
      setKpis(k);
      setChallans(c.slice(0, 8));
      setOrders(o.filter(x => x.status === 'pending' || x.status === 'in_progress').slice(0, 5));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const unsub1 = subscribe('challan.created', () => { reload(); });
    const unsub2 = subscribe('challan.updated', (data: unknown) => {
      const updated = data as Challan;
      setChallans(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      reload();
    });
    return () => { unsub1(); unsub2(); };
  }, [subscribe, reload]);

  const fmt = (n: number) => n?.toLocaleString('en-IN') ?? '—';
  const fmtRs = (n: number) => n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : `₹${fmt(n)}`;

  const statusColor = (s: string) => ({
    pending: '#f7c948', in_progress: '#38bdf8', completed: '#22c55e',
    cancelled: '#ef4444', dispatched: '#38bdf8', delivered: '#22c55e',
  }[s] || '#9fb0c7');

  const statusBg = (s: string) => ({
    pending: 'rgba(247,201,72,.12)', in_progress: 'rgba(56,189,248,.12)',
    completed: 'rgba(34,197,94,.12)', cancelled: 'rgba(239,68,68,.12)',
    dispatched: 'rgba(56,189,248,.12)', delivered: 'rgba(34,197,94,.12)',
  }[s] || 'rgba(159,176,199,.12)');

  const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  const metrics = kpis ? [
    {
      label: 'Today Production',
      value: `${Number(kpis.todayProduction).toFixed(1)} m³`,
      sub: `${kpis.todayBatches} batches`,
      icon: Activity, color: '#f7c948',
    },
    {
      label: 'Today Dispatch',
      value: `${Number(kpis.todayDispatch).toFixed(1)} m³`,
      sub: `${kpis.todayChallans} challans`,
      icon: TrendingUp, color: '#22c55e',
    },
    {
      label: 'Active Orders',
      value: String(kpis.activeOrders),
      sub: `${kpis.pendingOrders} pending`,
      icon: Clock, color: '#f7c948',
    },
    {
      label: 'Fleet Status',
      value: `${kpis.activeVehicles}/${kpis.totalVehicles}`,
      sub: `${kpis.maintenanceVehicles} in maintenance`,
      icon: Truck, color: '#22c55e',
    },
    {
      label: 'Outstanding',
      value: fmtRs(Number(kpis.outstandingAmount)),
      sub: `${kpis.totalClients} clients`,
      icon: IndianRupee, color: '#ef4444',
    },
  ] : [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Dashboard</h2>
            <LiveBadge />
          </div>
          <p style={{ margin: 0, color: '#9fb0c7', fontSize: 13 }}>
            Welcome back, {user?.name?.split(' ')[0]} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/orders">
            <button style={{
              borderRadius: 10, padding: '9px 16px',
              background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
              color: '#111827', fontWeight: 800, fontSize: 13,
              boxShadow: '0 8px 24px rgba(255,183,3,.18)', border: 'none', cursor: 'pointer',
            }}>Book Order</button>
          </Link>
          <Link href="/dispatch">
            <button style={{
              borderRadius: 10, padding: '9px 16px',
              background: 'linear-gradient(135deg,#86efac,#22c55e 48%,#15803d)',
              color: '#052e16', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer',
            }}>Create Challan</button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        {loading
          ? Array(5).fill(0).map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: '18px 16px', minHeight: 90 }}>
              <div style={{ width: 80, height: 12, background: 'rgba(255,255,255,.06)', borderRadius: 6 }} />
            </div>
          ))
          : metrics.map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="glass-card" style={{ padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: color + '18', display: 'grid', placeItems: 'center',
                }}>
                  <Icon size={14} color={color} />
                </div>
                <span style={{ color: '#9fb0c7', fontSize: 11, fontWeight: 600 }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#eef5ff', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#9fb0c7', marginTop: 4 }}>{sub}</div>
            </div>
          ))
        }
      </div>

      {/* Hero — GPS + 3D Plant */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 14, marginBottom: 16 }}>
        <LiveGPSTracker />
        <div className="plant-viewport">
          <div className="plant-stage">
            <div className="base-3d" />
            <div className="silo silo-1" />
            <div className="silo silo-2" />
            <div className="tower-3d" />
            <div className="belt-3d" />
            <div className="tm-3d" />
          </div>
          <div className="glow-line" />
        </div>
      </div>

      {/* Recent Challans + Active Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 14 }}>
        {/* Recent Challans */}
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent Dispatch</h3>
            <Link href="/dispatch">
              <span style={{ color: '#38bdf8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={12} />
              </span>
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#9fb0c7', textAlign: 'left' }}>
                  {['Challan', 'Client', 'Vehicle', 'Grade', 'Qty', 'Status'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', fontWeight: 600, borderBottom: '1px solid #263449' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challans.map(ch => (
                  <tr key={ch.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }}>
                    <td style={{ padding: '8px', color: '#f7c948', fontWeight: 700, fontFamily: 'monospace' }}>#{ch.challanNo}</td>
                    <td style={{ padding: '8px' }}>{(ch.clientName || '').split(' ')[0]}</td>
                    <td style={{ padding: '8px', color: '#9fb0c7', fontFamily: 'monospace', fontSize: 11 }}>{ch.vehicleNo || '—'}</td>
                    <td style={{ padding: '8px' }}>{ch.grade}</td>
                    <td style={{ padding: '8px' }}>{ch.quantity} m³</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                        color: statusColor(ch.status), background: statusBg(ch.status)
                      }}>{statusLabel(ch.status)}</span>
                    </td>
                  </tr>
                ))}
                {challans.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '20px 8px', color: '#9fb0c7', textAlign: 'center' }}>
                    No challans yet — <Link href="/dispatch" style={{ color: '#38bdf8' }}>create one</Link>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Orders */}
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Active Orders</h3>
            <Link href="/orders">
              <span style={{ color: '#38bdf8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={12} />
              </span>
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map(o => (
              <div key={o.id} style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: '#f7c948' }}>
                    {o.orderNo}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    color: statusColor(o.status), background: statusBg(o.status)
                  }}>{statusLabel(o.status)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{o.clientName}</div>
                <div style={{ fontSize: 11, color: '#9fb0c7' }}>
                  {o.grade} · {o.quantity} m³ {o.pumpRequired ? '· Pump' : ''}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div style={{ padding: '20px 8px', color: '#9fb0c7', textAlign: 'center', fontSize: 13 }}>
                No active orders — <Link href="/orders" style={{ color: '#38bdf8' }}>create one</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes none{}`}</style>
    </div>
  );
}

function LiveBadge() {
  const { status } = useSSE();
  const isLive = status === 'connected';
  const isReconnecting = status === 'reconnecting' || status === 'connecting';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: isLive ? 'rgba(34,197,94,.12)' : 'rgba(247,201,72,.1)',
      border: `1px solid ${isLive ? 'rgba(34,197,94,.25)' : 'rgba(247,201,72,.2)'}`,
      fontSize: 10, fontWeight: 800, letterSpacing: '.4px',
      color: isLive ? '#22c55e' : '#f7c948',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: isLive ? '#22c55e' : '#f7c948',
        display: 'inline-block',
        animation: isLive ? 'livePulse 1.8s ease-in-out infinite' : (isReconnecting ? 'liveBlink .8s step-end infinite' : 'none'),
      }} />
      {isLive ? 'LIVE' : isReconnecting ? 'RECONNECTING…' : 'OFFLINE'}
      <style>{`
        @keyframes livePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
          50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }
        @keyframes liveBlink {
          0%,100% { opacity: 1; } 50% { opacity: .3; }
        }
      `}</style>
    </div>
  );
}

const _unused = { Package, Users };
void _unused;
