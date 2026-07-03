import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import {
  TrendingUp, Clock, Truck, Users, IndianRupee, ArrowRight,
  ClipboardList, UserPlus, Printer, Bell, Radio, CarFront, Boxes, Monitor,
  Settings, Navigation, AlertCircle,
} from 'lucide-react';
import { api, type DashboardKPIs, type Challan, type Order } from '@/lib/api';
import PlantsMap from '@/components/PlantsMap';
import { useAuth } from '@/lib/auth';
import { useSSE } from '@/lib/useSSE';
import { canAccess } from '@/lib/permissions';

type QueueItem = { order: Order; remaining: number };

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inTransit, setInTransit] = useState<Challan[]>([]);
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>([]);
  const [onlineChallans, setOnlineChallans] = useState(0);
  const [loading, setLoading] = useState(true);

  const { subscribe } = useSSE();

  const canDispatch = user ? canAccess(user.role, '/dispatch') : false;
  const canOrders = user ? canAccess(user.role, '/orders') : false;

  const reload = useCallback(() => {
    Promise.all([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Challan[]>('/challans'),
      api.get<Order[]>('/orders'),
    ]).then(([k, c, o]) => {
      setKpis(k);

      const dispatched = c.filter(x => x.status === 'dispatched');
      setOnlineChallans(dispatched.length);
      setInTransit(dispatched.slice(0, 5));
      setChallans(c.slice(0, 8));

      const activeOrders = o.filter(x => x.status === 'pending' || x.status === 'in_progress');
      setOrders(activeOrders.slice(0, 5));

      // Volume already on the road / delivered, per order, to compute what's still owed.
      const fulfilledByOrder = new Map<number, number>();
      for (const ch of c) {
        if (!ch.orderId) continue;
        if (ch.status === 'dispatched' || ch.status === 'delivered') {
          fulfilledByOrder.set(ch.orderId, (fulfilledByOrder.get(ch.orderId) || 0) + Number(ch.quantity || 0));
        }
      }
      const queue = activeOrders
        .map(ord => ({ order: ord, remaining: Math.max(0, Number(ord.quantity || 0) - (fulfilledByOrder.get(ord.id) || 0)) }))
        .filter(q => q.remaining > 0)
        .slice(0, 4);
      setPendingQueue(queue);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const unsub1 = subscribe('challan.created', () => { reload(); });
    const unsub2 = subscribe('challan.updated', () => { reload(); });
    const unsub3 = subscribe('order.updated', () => { reload(); });
    const unsub4 = subscribe('reconnect', () => { reload(); });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [subscribe, reload]);

  const fmt = (n: number) => n?.toLocaleString('en-IN') ?? '—';
  const fmtRs = (n: number) => n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : `₹${fmt(n)}`;

  const statusColor = (s: string) => ({
    pending: 'var(--gold)', in_progress: 'var(--blue)', completed: 'var(--green)',
    cancelled: 'var(--red)', dispatched: 'var(--blue)', delivered: 'var(--green)',
  }[s] || 'var(--muted)');

  const statusBg = (s: string) => ({
    pending: 'color-mix(in srgb, var(--gold) 13%, transparent)', in_progress: 'color-mix(in srgb, var(--blue) 14%, transparent)',
    completed: 'color-mix(in srgb, var(--green) 14%, transparent)', cancelled: 'color-mix(in srgb, var(--red) 14%, transparent)',
    dispatched: 'color-mix(in srgb, var(--blue) 14%, transparent)', delivered: 'color-mix(in srgb, var(--green) 14%, transparent)',
  }[s] || 'color-mix(in srgb, var(--muted) 14%, transparent)');

  const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  /* Command-center stat cards — all values from existing dashboard KPIs + challan feed */
  const stats = kpis ? [
    { label: 'Today Dispatch', value: `${Number(kpis.todayDispatch).toFixed(1)} m³`, sub: `${kpis.todayChallans} challans`, icon: TrendingUp, color: 'var(--green)' },
    { label: 'Active Orders', value: String(kpis.activeOrders), sub: `${kpis.pendingOrders} pending`, icon: Clock, color: 'var(--gold)' },
    { label: 'Online Challans', value: String(onlineChallans), sub: 'in transit now', icon: Radio, color: 'var(--blue)' },
    { label: 'Clients', value: String(kpis.totalClients), sub: 'accounts', icon: Users, color: 'var(--gold)' },
    { label: 'Driver / TM Status', value: `${kpis.activeVehicles}/${kpis.totalVehicles}`, sub: `${kpis.maintenanceVehicles} in maintenance`, icon: CarFront, color: 'var(--orange)' },
    { label: 'Today Production', value: `${Number(kpis.todayProduction).toFixed(1)} m³`, sub: `${kpis.todayBatches} batches`, icon: Boxes, color: 'var(--blue)' },
    { label: 'Outstanding', value: fmtRs(Number(kpis.outstandingAmount)), sub: 'receivables', icon: IndianRupee, color: 'var(--red)' },
  ] : [];

  /* Quick actions route to existing pages — no new logic. Only show shortcuts
     the signed-in role is actually allowed to open (permission-aware). */
  const quickActions = [
    { label: 'New Challan', href: '/dispatch', icon: Truck, color: 'var(--green)' },
    { label: 'New Order', href: '/orders', icon: ClipboardList, color: 'var(--gold)' },
    { label: 'Add Client', href: '/clients', icon: UserPlus, color: 'var(--blue)' },
    { label: 'Print Report', href: '/reports', icon: Printer, color: 'var(--orange)' },
  ].filter(a => user && canAccess(user.role, a.href));

  /* Notification feed derived from real recent challans + active orders */
  const notifications = [
    ...challans.slice(0, 4).map(ch => ({
      id: 'c' + ch.id, color: statusColor(ch.status), Icon: Truck,
      title: `Challan #${ch.challanNo} · ${statusLabel(ch.status)}`,
      sub: `${ch.clientName || '—'} · ${ch.grade} · ${ch.quantity} m³`,
    })),
    ...orders.slice(0, 3).map(o => ({
      id: 'o' + o.id, color: statusColor(o.status), Icon: ClipboardList,
      title: `Order ${o.orderNo} · ${statusLabel(o.status)}`,
      sub: `${o.clientName} · ${o.grade} · ${o.quantity} m³`,
    })),
  ];

  return (
    <div>
      {/* ===== Command Center header: title, live status, date, plant status ===== */}
      <div className="dash-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.5px' }}>Command Center</h2>
            <LiveBadge />
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
            Welcome back, {user?.name?.split(' ')[0]} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {/* Right: Shift Report + Control Room launcher + plant status pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {user && canAccess(user.role, '/shift-report') && (
            <button
              onClick={() => navigate('/shift-report')}
              title="Open the shift handover report"
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                background: 'color-mix(in srgb, var(--blue) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--blue) 30%, transparent)',
                color: 'var(--blue)', fontSize: 12, fontWeight: 800, letterSpacing: '.3px',
              }}
            >
              <ClipboardList size={14} /> SHIFT REPORT
            </button>
          )}
          {user && canAccess(user.role, '/kiosk') && (
            <button
              onClick={() => navigate('/kiosk')}
              title="Open big-screen Control Room"
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
                color: 'var(--gold)', fontSize: 12, fontWeight: 800, letterSpacing: '.3px',
              }}
            >
              <Monitor size={14} /> CONTROL ROOM
            </button>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--green) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--green) 26%, transparent)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px var(--green)' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)', letterSpacing: '.3px' }}>PLANT ONLINE</span>
          </div>
        </div>
      </div>

      {/* ===== Needs Dispatch — exception-first action band (only shows when work is waiting) ===== */}
      {!loading && pendingQueue.length > 0 && (
        <div className="glass-card" style={{
          padding: 16, marginBottom: 16,
          border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
          boxShadow: '0 0 0 1px color-mix(in srgb, var(--gold) 8%, transparent), 0 18px 40px rgba(var(--shadow-rgb),.28)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ color: 'var(--gold)' }} /> Needs Dispatch
            </h3>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
              color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 16%, transparent)',
            }}>{pendingQueue.length} waiting</span>
          </div>
          <div className="dash-queue" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            {pendingQueue.map(({ order, remaining }) => (
              <div key={order.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: 'var(--chip-bg)', border: '1px solid var(--line)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {order.clientName || 'Order'} {order.siteName ? `· ${order.siteName}` : ''}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                    {order.grade} · ordered {order.quantity} m³ · <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{remaining} m³ left</span>
                  </div>
                </div>
                {canDispatch ? (
                  <Link href="/dispatch">
                    <button style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                      color: '#111827', background: 'linear-gradient(135deg,var(--gold-hi),var(--gold))',
                      border: '1px solid color-mix(in srgb, var(--gold) 50%, transparent)',
                    }}>
                      <Truck size={13} /> Assign Truck
                    </button>
                  </Link>
                ) : (
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--gold)',
                    padding: '6px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
                  }}>Awaiting dispatch</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Quick action buttons ===== */}
      <div className="dash-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        {quickActions.map(({ label, href, icon: Icon, color }) => (
          <Link key={label} href={href}>
            <div className="glass-card cc-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>Open <ArrowRight size={11} /></div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ===== Stat cards (glassmorphism + floating depth) ===== */}
      <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
        {loading
          ? Array(7).fill(0).map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: '18px 16px', minHeight: 96 }}>
              <div style={{ width: 80, height: 12, background: 'var(--chip-bg)', borderRadius: 6 }} />
            </div>
          ))
          : stats.map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="glass-card cc-card" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
              {/* accent glow bar (theme color) */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: .85 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: `color-mix(in srgb, ${color} 13%, transparent)`, display: 'grid', placeItems: 'center',
                }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600 }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>
            </div>
          ))
        }
      </div>

      {/* ===== Live Routing Schematic — plant → mixers in transit → active sites (real data) ===== */}
      <div className="glass-card cc-scan" style={{ padding: 18, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={14} style={{ color: 'var(--blue)' }} /> Live Routing Schematic
          </h3>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{onlineChallans} mixer{onlineChallans === 1 ? '' : 's'} in transit</span>
        </div>

        <div className="route-grid">
          {/* Plant node */}
          <div className="route-node">
            <div style={{
              width: 72, height: 72, borderRadius: 18, display: 'grid', placeItems: 'center',
              background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
              border: '2px solid color-mix(in srgb, var(--muted) 30%, transparent)',
              boxShadow: '0 18px 34px rgba(var(--shadow-rgb),.4)',
            }}>
              <Settings size={30} style={{ color: 'var(--muted)', animation: 'spin 9s linear infinite' }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.5px', color: 'var(--text)' }}>PLANT</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>OPERATIONAL</div>
            </div>
          </div>

          {/* Mixers in transit */}
          <div className="route-track">
            <div className="route-line-bg" />
            {inTransit.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5,
                padding: '18px 8px', position: 'relative', zIndex: 1,
              }}>
                No mixers in transit right now — dispatched challans appear here live.
              </div>
            ) : (
              inTransit.map((ch, i) => {
                const truck = (
                  <div className="route-truck" style={{
                    background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--blue) 38%, transparent)',
                    animationDelay: `${i * 0.25}s`, cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <Truck size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ch.vehicleNo || `#${ch.challanNo}`}
                        </span>
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: '.4px', flexShrink: 0,
                        padding: '2px 7px', borderRadius: 999,
                        color: 'var(--blue)', background: 'color-mix(in srgb, var(--blue) 16%, transparent)',
                      }}>EN ROUTE</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ch.driverName || '—'} · {ch.siteName || ch.clientName || 'Site'}
                    </div>
                  </div>
                );
                return canDispatch
                  ? <Link key={ch.id} href="/dispatch">{truck}</Link>
                  : <div key={ch.id}>{truck}</div>;
              })
            )}
          </div>

          {/* Sites node */}
          <div className="route-node">
            <div style={{
              width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center',
              background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
              border: '2px dashed color-mix(in srgb, var(--gold) 55%, transparent)',
            }}>
              <Navigation size={26} style={{ color: 'var(--gold)' }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.5px', color: 'var(--text)' }}>SITES</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)' }}>POURING</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Hero command panel: full-width plant network map ===== */}
      <div className="dash-hero" style={{ marginBottom: 16 }}>
        <PlantsMap />
      </div>

      {/* ===== Lower grid: recent dispatch + active orders + notification center ===== */}
      <div className="dash-lower" style={{ display: 'grid', gridTemplateColumns: '1.2fr .9fr .9fr', gap: 14 }}>
        {/* Recent Challans */}
        <div className="glass-card cc-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent Dispatch</h3>
            {canDispatch && (
              <Link href="/dispatch">
                <span style={{ color: 'var(--blue)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View all <ArrowRight size={12} />
                </span>
              </Link>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                  {['Challan', 'Client', 'Vehicle', 'Grade', 'Qty', 'Status'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challans.map(ch => (
                  <tr key={ch.id} style={{ borderBottom: '1px solid color-mix(in srgb, var(--line) 55%, transparent)' }}>
                    <td style={{ padding: '8px', color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>#{ch.challanNo}</td>
                    <td style={{ padding: '8px' }}>{(ch.clientName || '').split(' ')[0]}</td>
                    <td style={{ padding: '8px', color: 'var(--muted)', fontFamily: 'monospace', fontSize: 11 }}>{ch.vehicleNo || '—'}</td>
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
                  <tr><td colSpan={6} style={{ padding: '20px 8px', color: 'var(--muted)', textAlign: 'center' }}>
                    No challans yet{canDispatch && <> — <Link href="/dispatch" style={{ color: 'var(--blue)' }}>create one</Link></>}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Orders */}
        <div className="glass-card cc-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Active Orders</h3>
            {canOrders && (
              <Link href="/orders">
                <span style={{ color: 'var(--blue)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View all <ArrowRight size={12} />
                </span>
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map(o => (
              <div key={o.id} style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--chip-bg)', border: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: 'var(--gold)' }}>
                    {o.orderNo}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    color: statusColor(o.status), background: statusBg(o.status)
                  }}>{statusLabel(o.status)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{o.clientName}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {o.grade} · {o.quantity} m³ {o.pumpRequired ? '· Pump' : ''}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div style={{ padding: '20px 8px', color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
                No active orders{canOrders && <> — <Link href="/orders" style={{ color: 'var(--blue)' }}>create one</Link></>}
              </div>
            )}
          </div>
        </div>

        {/* Notification Center */}
        <div className="glass-card cc-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={15} style={{ color: 'var(--gold)' }} /> Notifications
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.map(({ id, color, Icon, title, sub }) => (
              <div key={id} style={{
                display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
                background: 'var(--chip-bg)', border: '1px solid var(--line)',
              }}>
                <div style={{
                  width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: 'grid', placeItems: 'center',
                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div style={{ padding: '20px 8px', color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>No recent activity</div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Command-center responsive grid collapses ===== */}
      <style>{`
        .route-grid {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 18px;
        }
        .route-node { display: flex; flex-direction: column; align-items: center; }
        .route-track {
          position: relative;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          min-height: 64px;
          padding: 6px 4px;
        }
        .route-line-bg {
          position: absolute; left: 0; right: 0; top: 50%;
          height: 2px; transform: translateY(-50%);
          background: repeating-linear-gradient(90deg,
            color-mix(in srgb, var(--muted) 45%, transparent) 0 10px,
            transparent 10px 22px);
          opacity: .5; z-index: 0;
        }
        .route-truck {
          position: relative; z-index: 1;
          border-radius: 12px; padding: 10px 12px;
          animation: routeFloat 4s ease-in-out infinite;
          transition: border-color .2s ease, transform .2s ease;
        }
        .route-truck:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--gold) 50%, transparent); }
        @keyframes routeFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @media (max-width: 1100px) {
          .dash-lower { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 900px) {
          .dash-actions { grid-template-columns: repeat(2,1fr) !important; }
          .route-grid { grid-template-columns: 1fr; justify-items: center; }
          .route-track { width: 100%; }
          .route-line-bg { display: none; }
        }
        @media (max-width: 760px) {
          .dash-lower { grid-template-columns: 1fr !important; }
        }
      `}</style>
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
      background: isLive ? 'color-mix(in srgb, var(--green) 12%, transparent)' : 'color-mix(in srgb, var(--gold) 10%, transparent)',
      border: `1px solid ${isLive ? 'color-mix(in srgb, var(--green) 25%, transparent)' : 'color-mix(in srgb, var(--gold) 20%, transparent)'}`,
      fontSize: 10, fontWeight: 800, letterSpacing: '.4px',
      color: isLive ? 'var(--green)' : 'var(--gold)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: isLive ? 'var(--green)' : 'var(--gold)',
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
