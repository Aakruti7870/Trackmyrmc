import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { TrendingUp, Package, Clock, Users, ArrowRight, Truck } from 'lucide-react';
import { orderStore, challanStore, clientStore, vehicleStore } from '@/lib/store';
import type { Challan, Order } from '@/lib/types';

export default function Dashboard() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [vehicleCount, setVehicleCount] = useState(0);

  useEffect(() => {
    setChallans(challanStore.getAll());
    setOrders(orderStore.getAll());
    setClientCount(clientStore.getAll().length);
    setVehicleCount(vehicleStore.getActive().length);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayChallans = challans.filter(c => c.date === today);
  const todayDispatch = todayChallans.reduce((s, c) => s + c.qty, 0);
  const totalDispatch = challans.reduce((s, c) => s + c.qty, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'in-progress').length;
  const recentChallans = [...challans].sort((a, b) => b.challanNo.localeCompare(a.challanNo)).slice(0, 6);
  const recentOrders = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

  const statusColor = (s: string) => ({
    pending: '#f7c948',
    'in-progress': '#38bdf8',
    completed: '#22c55e',
    cancelled: '#ef4444',
    dispatched: '#38bdf8',
    delivered: '#22c55e',
  }[s] || '#9fb0c7');

  const statusBg = (s: string) => ({
    pending: 'rgba(247,201,72,.12)',
    'in-progress': 'rgba(56,189,248,.12)',
    completed: 'rgba(34,197,94,.12)',
    cancelled: 'rgba(239,68,68,.12)',
    dispatched: 'rgba(56,189,248,.12)',
    delivered: 'rgba(34,197,94,.12)',
  }[s] || 'rgba(159,176,199,.12)');

  const metrics = [
    { label: 'Today Dispatch', value: `${todayDispatch} m³`, icon: TrendingUp, color: '#f7c948' },
    { label: 'Total Dispatch', value: `${totalDispatch.toLocaleString()} m³`, icon: Package, color: '#38bdf8' },
    { label: 'Pending Orders', value: pendingOrders.toString(), icon: Clock, color: '#f7c948' },
    { label: 'Active Vehicles', value: vehicleCount.toString(), icon: Truck, color: '#22c55e' },
    { label: 'Clients', value: clientCount.toString(), icon: Users, color: '#22c55e' },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Dashboard</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb0c7', fontSize: 14 }}>RMC Command Centre — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/orders">
            <button data-testid="button-book-order" style={{
              borderRadius: 12, padding: '10px 18px',
              background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
              color: '#111827', fontWeight: 800, fontSize: 14,
              boxShadow: '0 12px 30px rgba(255,183,3,.18),inset 0 1px 0 rgba(255,255,255,.55)'
            }}>Book Order</button>
          </Link>
          <Link href="/dispatch">
            <button data-testid="button-create-challan" style={{
              borderRadius: 12, padding: '10px 18px',
              background: 'linear-gradient(135deg,#86efac,#22c55e 48%,#15803d)',
              color: '#052e16', fontWeight: 800, fontSize: 14,
              boxShadow: '0 12px 30px rgba(34,197,94,.18)'
            }}>Create Challan</button>
          </Link>
        </div>
      </div>

      {/* Hero — 3D Plant + Copy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 16, marginBottom: 16 }} className="max-lg:!block">
        <div className="glass-card" style={{ padding: 28 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.05 }}>
            Premium 3D RMC<br />Command Centre
          </h3>
          <p style={{ color: '#9fb0c7', maxWidth: 520, lineHeight: 1.6, marginBottom: 20 }}>
            Dark navy concrete-grey golden-amber and plant-green design system. Manage orders, dispatch, clients, vehicles and batch records in one place.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/orders">
              <button style={{
                borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
                color: '#111827', boxShadow: '0 12px 30px rgba(255,183,3,.18)'
              }}>Book Order</button>
            </Link>
            <Link href="/dispatch">
              <button style={{
                borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg,#86efac,#22c55e 48%,#15803d)',
                color: '#052e16'
              }}>Create Challan</button>
            </Link>
          </div>
        </div>

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

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 14, marginBottom: 20 }} className="max-lg:!grid-cols-2">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card" style={{ padding: '20px 18px' }} data-testid={`metric-${label.toLowerCase().replace(/ /g, '-')}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: color + '18',
                display: 'grid', placeItems: 'center'
              }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{ color: '#9fb0c7', fontSize: 12, fontWeight: 600 }}>{label}</span>
            </div>
            <div className="metric-text">{value}</div>
          </div>
        ))}
      </div>

      {/* Two columns — recent dispatch + recent orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="max-lg:!block">

        {/* Recent Challans */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Recent Dispatch</h3>
            <Link href="/dispatch">
              <span style={{ color: '#38bdf8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={12} />
              </span>
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#9fb0c7', textAlign: 'left' }}>
                  {['Challan', 'Client', 'Grade', 'Qty', 'Status'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid #263449' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentChallans.map(ch => (
                  <tr key={ch.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }}>
                    <td style={{ padding: '9px 8px', color: '#f7c948', fontWeight: 700 }}>#{ch.challanNo}</td>
                    <td style={{ padding: '9px 8px' }}>{ch.clientName.split(' ')[0]}</td>
                    <td style={{ padding: '9px 8px' }}>{ch.grade}</td>
                    <td style={{ padding: '9px 8px' }}>{ch.qty} m³</td>
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        color: statusColor(ch.status), background: statusBg(ch.status)
                      }}>{ch.status}</span>
                    </td>
                  </tr>
                ))}
                {recentChallans.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '20px 8px', color: '#9fb0c7', textAlign: 'center' }}>No challans yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Active Orders</h3>
            <Link href="/orders">
              <span style={{ color: '#38bdf8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={12} />
              </span>
            </Link>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {recentOrders.map(o => (
              <div key={o.id} style={{
                background: 'rgba(38,52,73,.3)', borderRadius: 12, padding: '12px 14px',
                border: '1px solid rgba(38,52,73,.6)'
              }} data-testid={`order-card-${o.id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{o.clientName}</span>
                  <span style={{
                    padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    color: statusColor(o.status), background: statusBg(o.status)
                  }}>{o.status}</span>
                </div>
                <div style={{ color: '#9fb0c7', fontSize: 12, marginBottom: 6 }}>{o.site} · {o.grade}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      height: 4, width: 100, background: '#263449', borderRadius: 999, overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (o.dispatchedQty / o.qty) * 100)}%`,
                        background: 'linear-gradient(90deg,#22c55e,#86efac)',
                        borderRadius: 999
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#9fb0c7' }}>{o.dispatchedQty}/{o.qty} m³</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#9fb0c7' }}>{o.date}</span>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <div style={{ color: '#9fb0c7', textAlign: 'center', padding: 20 }}>No orders yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
