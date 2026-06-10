import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, Users, Truck, Calendar } from 'lucide-react';
import { orderStore, challanStore, clientStore, vehicleStore, batchStore } from '@/lib/store';
import type { Challan, Order } from '@/lib/types';

export default function Reports() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  useEffect(() => {
    setChallans(challanStore.getAll());
    setOrders(orderStore.getAll());
  }, []);

  const today = new Date();
  const dateFrom = (r: typeof range) => {
    if (r === 'today') return today.toISOString().slice(0, 10);
    if (r === 'week') { const d = new Date(today); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }
    if (r === 'month') { const d = new Date(today); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }
    return '2000-01-01';
  };

  const from = dateFrom(range);
  const filteredChallans = challans.filter(c => c.date >= from);
  const filteredOrders = orders.filter(o => o.date >= from);

  const totalDispatch = filteredChallans.reduce((s, c) => s + c.qty, 0);
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(o => o.status === 'completed').length;
  const deliveredChallans = filteredChallans.filter(c => c.status === 'delivered').length;

  // Grade breakdown
  const byGrade = filteredChallans.reduce<Record<string, number>>((acc, c) => {
    acc[c.grade] = (acc[c.grade] || 0) + c.qty;
    return acc;
  }, {});
  const gradeEntries = Object.entries(byGrade).sort((a, b) => b[1] - a[1]);
  const maxGrade = Math.max(...gradeEntries.map(([, v]) => v), 1);

  // Client breakdown
  const byClient = filteredChallans.reduce<Record<string, number>>((acc, c) => {
    acc[c.clientName] = (acc[c.clientName] || 0) + c.qty;
    return acc;
  }, {});
  const clientEntries = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxClient = Math.max(...clientEntries.map(([, v]) => v), 1);

  // Daily trend (last 14 days)
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const dailyData = last14.map(date => ({
    date,
    qty: challans.filter(c => c.date === date).reduce((s, c) => s + c.qty, 0),
    label: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }));
  const maxDaily = Math.max(...dailyData.map(d => d.qty), 1);

  const totalClients = clientStore.getAll().length;
  const totalVehicles = vehicleStore.getAll().length;
  const totalBatches = batchStore.getAll().length;

  const ranges: { value: typeof range; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' },
  ];

  const summaryCards = [
    { label: 'Total Dispatch', value: `${totalDispatch} m³`, icon: Package, color: '#f7c948' },
    { label: 'Orders', value: totalOrders, icon: BarChart3, color: '#38bdf8' },
    { label: 'Completed Orders', value: completedOrders, icon: TrendingUp, color: '#22c55e' },
    { label: 'Challans Issued', value: filteredChallans.length, icon: Calendar, color: '#f7c948' },
    { label: 'Delivered', value: deliveredChallans, icon: Truck, color: '#22c55e' },
    { label: 'Clients', value: totalClients, icon: Users, color: '#38bdf8' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Reports</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb0c7', fontSize: 14 }}>Production and dispatch analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              data-testid={`button-range-${r.value}`}
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: range === r.value ? 'linear-gradient(135deg,#ffe08a,#f6b818)' : '#1a2940',
                color: range === r.value ? '#111827' : '#9fb0c7',
                border: range === r.value ? 'none' : '1px solid #263449',
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }} className="max-lg:!grid-cols-2">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card" style={{ padding: '16px 14px', textAlign: 'center' }} data-testid={`report-metric-${label.toLowerCase().replace(/ /g, '-')}`}>
            <Icon size={18} color={color} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: 11, color: '#9fb0c7', fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div className="metric-text" style={{ fontSize: '1.4rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      <div className="glass-card" style={{ padding: 22, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>Daily Dispatch Trend (Last 14 Days)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {dailyData.map(({ date, qty, label }) => (
            <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} data-testid={`bar-${date}`}>
              <span style={{ fontSize: 10, color: '#9fb0c7', fontWeight: 600 }}>{qty || ''}</span>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                background: qty > 0
                  ? 'linear-gradient(180deg,#f7c948,rgba(247,201,72,.3))'
                  : 'rgba(38,52,73,.4)',
                height: `${(qty / maxDaily) * 90}px`,
                minHeight: qty > 0 ? 4 : 0,
                transition: 'height .3s ease'
              }} />
              <span style={{ fontSize: 9, color: '#9fb0c7', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grade + Client breakdown side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="max-lg:!block">
        {/* Grade breakdown */}
        <div className="glass-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Dispatch by Grade</h3>
          {gradeEntries.length === 0 && <div style={{ color: '#9fb0c7', fontSize: 13 }}>No data for this period</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            {gradeEntries.map(([grade, qty]) => (
              <div key={grade} data-testid={`grade-bar-${grade}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: '#38bdf8' }}>{grade}</span>
                  <span style={{ color: '#9fb0c7' }}>{qty} m³ ({Math.round((qty / totalDispatch) * 100)}%)</span>
                </div>
                <div style={{ height: 8, background: '#263449', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(qty / maxGrade) * 100}%`,
                    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
                    borderRadius: 999, transition: 'width .4s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Client breakdown */}
        <div className="glass-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Top Clients by Volume</h3>
          {clientEntries.length === 0 && <div style={{ color: '#9fb0c7', fontSize: 13 }}>No data for this period</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            {clientEntries.map(([client, qty]) => (
              <div key={client} data-testid={`client-bar-${client}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{client}</span>
                  <span style={{ color: '#9fb0c7' }}>{qty} m³</span>
                </div>
                <div style={{ height: 8, background: '#263449', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(qty / maxClient) * 100}%`,
                    background: 'linear-gradient(90deg,#22c55e,#16a34a)',
                    borderRadius: 999, transition: 'width .4s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fleet summary */}
      <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Fleet & Production Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, fontSize: 14 }}>
          {[
            { label: 'Total Vehicles', value: totalVehicles },
            { label: 'Active Vehicles', value: vehicleStore.getActive().length },
            { label: 'Batch Records', value: totalBatches },
            { label: 'Avg Daily Dispatch', value: `${dailyData.filter(d => d.qty > 0).length > 0 ? Math.round(dailyData.reduce((s, d) => s + d.qty, 0) / 14) : 0} m³` },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center', padding: '12px 0', borderRight: '1px solid #263449' }}>
              <div style={{ color: '#9fb0c7', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
              <div className="metric-text" style={{ fontSize: '1.5rem' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
