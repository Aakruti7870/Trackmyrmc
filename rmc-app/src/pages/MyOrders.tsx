import { useState, useEffect } from 'react';
import { api, type Order, type Challan } from '@/lib/api';
import { ClipboardList, Truck, Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  pending:     { color: '#f7c948', bg: 'rgba(247,201,72,.13)',  label: 'Pending' },
  in_progress: { color: '#38bdf8', bg: 'rgba(56,189,248,.13)',  label: 'In Progress' },
  completed:   { color: '#22c55e', bg: 'rgba(34,197,94,.13)',   label: 'Completed' },
  cancelled:   { color: '#ef4444', bg: 'rgba(239,68,68,.13)',   label: 'Cancelled' },
  dispatched:  { color: '#38bdf8', bg: 'rgba(56,189,248,.13)',  label: 'Dispatched' },
  delivered:   { color: '#22c55e', bg: 'rgba(34,197,94,.13)',   label: 'Delivered' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || { color: '#9fb0c7', bg: 'rgba(159,176,199,.13)', label: status };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
      textTransform: 'capitalize', letterSpacing: '.3px',
    }}>{s.label}</span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16, padding: 20,
      boxShadow: '0 8px 32px rgba(0,0,0,.3)',
      ...style,
    }}>{children}</div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [tab, setTab] = useState<'orders' | 'challans'>('orders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Order[]>('/me/orders'),
      api.get<Challan[]>('/me/challans'),
    ])
      .then(([o, c]) => { setOrders(o); setChallans(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalQty = (items: { quantity: string }[]) =>
    items.reduce((s, i) => s + parseFloat(i.quantity || '0'), 0).toFixed(1);

  const kpis = [
    { label: 'Total Orders', value: orders.length, icon: ClipboardList, color: '#38bdf8' },
    { label: 'Active Orders', value: orders.filter(o => o.status === 'pending' || o.status === 'in_progress').length, icon: AlertCircle, color: '#f7c948' },
    { label: 'Total Dispatched', value: challans.filter(c => c.status === 'dispatched' || c.status === 'delivered').length, icon: Truck, color: '#22c55e' },
    { label: "Volume (m³)", value: totalQty(challans.filter(c => c.status === 'delivered')), icon: Package, color: '#a78bfa' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#eef5ff', margin: 0, letterSpacing: '-.3px' }}>
          My Orders & Deliveries
        </h1>
        <p style={{ color: '#9fb0c7', fontSize: 13, margin: '6px 0 0' }}>
          Track your concrete orders and delivery challans
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
        {kpis.map(k => (
          <Card key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: k.color + '18', border: `1px solid ${k.color}30`,
              display: 'grid', placeItems: 'center',
            }}>
              <k.icon size={18} color={k.color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#eef5ff', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#9fb0c7', marginTop: 3 }}>{k.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {(['orders', 'challans'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 22px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all .18s',
            background: tab === t ? 'linear-gradient(135deg,#1d2d47,#152239)' : 'transparent',
            color: tab === t ? '#eef5ff' : '#9fb0c7',
            boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,.25)' : 'none',
          }}>
            {t === 'orders' ? `Orders (${orders.length})` : `Challans (${challans.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9fb0c7' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>{error}</div>
      ) : tab === 'orders' ? (
        <Card>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9fb0c7' }}>
              <ClipboardList size={32} style={{ opacity: .4, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              No orders found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Order No', 'Grade', 'Qty (m³)', 'Delivery Date', 'Site', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #263449' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', fontSize: 13 }}>{o.orderNo}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: 'rgba(56,189,248,.12)', color: '#38bdf8', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{o.grade}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#eef5ff', fontWeight: 700 }}>{parseFloat(o.quantity).toFixed(1)}</td>
                    <td style={{ padding: '12px 14px', color: '#9fb0c7', fontSize: 12 }}>{o.deliveryDate || '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#9fb0c7', fontSize: 12 }}>{o.siteName || '—'}</td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card>
          {challans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9fb0c7' }}>
              <Truck size={32} style={{ opacity: .4, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              No challans found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Challan No', 'Grade', 'Qty (m³)', 'Vehicle', 'Driver', 'Dispatch Time', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #263449' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challans.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#22c55e', fontSize: 13 }}>{c.challanNo}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: 'rgba(56,189,248,.12)', color: '#38bdf8', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{c.grade}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#eef5ff', fontWeight: 700 }}>{parseFloat(c.quantity).toFixed(1)}</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#9fb0c7', fontSize: 12 }}>{c.vehicleNo || '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#9fb0c7', fontSize: 12 }}>{c.driverName || '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#9fb0c7', fontSize: 12 }}>
                      {c.dispatchTime ? new Date(c.dispatchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
