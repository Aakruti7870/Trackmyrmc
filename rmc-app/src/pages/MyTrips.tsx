import { useState, useEffect, useCallback } from 'react';
import { api, type Challan } from '@/lib/api';
import { Truck, MapPin, CheckCircle, Clock, Package, AlertCircle, CalendarDays } from 'lucide-react';

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  pending:    { color: '#f7c948', bg: 'rgba(247,201,72,.1)',  icon: Clock },
  dispatched: { color: '#38bdf8', bg: 'rgba(56,189,248,.1)', icon: Truck },
  delivered:  { color: '#22c55e', bg: 'rgba(34,197,94,.1)',  icon: CheckCircle },
  cancelled:  { color: '#ef4444', bg: 'rgba(239,68,68,.1)',  icon: AlertCircle },
};

function TripCard({ challan, onMarkDelivered }: { challan: Challan; onMarkDelivered: (id: number) => void }) {
  const s = STATUS_STYLES[challan.status] || STATUS_STYLES.pending;
  const StatusIcon = s.icon;
  const isActionable = challan.status === 'dispatched';
  const [marking, setMarking] = useState(false);

  async function handleMark() {
    setMarking(true);
    try { await onMarkDelivered(challan.id); } finally { setMarking(false); }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: `1px solid ${s.color}28`,
      borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,.28)',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 72, height: 72, borderRadius: '0 16px 0 72px',
        background: s.bg, display: 'grid', placeItems: 'center', paddingTop: 8, paddingLeft: 8,
      }}>
        <StatusIcon size={18} color={s.color} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: '#22c55e' }}>{challan.challanNo}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.color}33`, textTransform: 'capitalize' }}>
          {challan.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Grade</div>
          <span style={{ background: 'rgba(56,189,248,.12)', color: '#38bdf8', padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 800 }}>{challan.grade}</span>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Volume</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#eef5ff' }}>{parseFloat(challan.quantity).toFixed(1)} <span style={{ fontSize: 11, fontWeight: 500, color: '#9fb0c7' }}>m³</span></div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Client</div>
          <div style={{ fontSize: 13, color: '#eef5ff', fontWeight: 600 }}>{challan.clientName || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Vehicle</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#f7c948', fontWeight: 700 }}>{challan.vehicleNo || '—'}</div>
        </div>
      </div>

      {challan.siteName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '7px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 8 }}>
          <MapPin size={12} color="#9fb0c7" />
          <span style={{ fontSize: 12, color: '#9fb0c7' }}>{challan.siteName}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: isActionable ? 14 : 0 }}>
        {challan.dispatchTime && (
          <div>
            <div style={{ fontSize: 10, color: '#9fb0c7', marginBottom: 2 }}>Dispatched</div>
            <div style={{ fontSize: 12, color: '#eef5ff', fontWeight: 600 }}>
              {new Date(challan.dispatchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
        {challan.deliveryTime && (
          <div>
            <div style={{ fontSize: 10, color: '#9fb0c7', marginBottom: 2 }}>Delivered</div>
            <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
              {new Date(challan.deliveryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
      </div>

      {isActionable && (
        <button
          onClick={handleMark}
          disabled={marking}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: marking ? 'not-allowed' : 'pointer',
            background: marking ? 'rgba(34,197,94,.2)' : 'linear-gradient(135deg,#16a34a,#22c55e)',
            color: '#fff', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: marking ? 'none' : '0 4px 16px rgba(34,197,94,.3)', transition: 'all .2s',
          }}
        >
          <CheckCircle size={15} />
          {marking ? 'Marking…' : 'Mark as Delivered'}
        </button>
      )}
    </div>
  );
}

export default function MyTrips() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [filter, setFilter] = useState<'all' | 'dispatched' | 'delivered'>('all');
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback((all: boolean) => {
    setLoading(true);
    const url = all ? '/me/trips?from=2020-01-01' : '/me/trips';
    api.get<Challan[]>(url)
      .then(rows => { setChallans(rows); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(viewAll); }, [load, viewAll]);

  async function handleMarkDelivered(id: number) {
    await api.put(`/challans/${id}`, { status: 'delivered' });
    setChallans(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'delivered', deliveryTime: new Date().toISOString() } : c
    ));
  }

  const filtered = filter === 'all' ? challans : challans.filter(c => c.status === filter);
  const active = challans.filter(c => c.status === 'dispatched').length;
  const delivered = challans.filter(c => c.status === 'delivered').length;
  const totalVol = challans.filter(c => c.status === 'delivered').reduce((s, c) => s + parseFloat(c.quantity || '0'), 0);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#eef5ff', margin: 0, letterSpacing: '-.3px' }}>My Trips</h1>
          <p style={{ color: '#9fb0c7', fontSize: 13, margin: '6px 0 0' }}>
            {viewAll ? 'All assigned delivery challans' : "Today's assigned delivery challans"}
          </p>
        </div>
        <button
          onClick={() => setViewAll(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: viewAll ? 'rgba(247,201,72,.15)' : 'rgba(255,255,255,.06)',
            border: `1px solid ${viewAll ? '#f7c94844' : 'rgba(255,255,255,.1)'}`,
            borderRadius: 10, cursor: 'pointer', color: viewAll ? '#f7c948' : '#9fb0c7',
            fontSize: 12, fontWeight: 600, transition: 'all .2s',
          }}
        >
          <CalendarDays size={14} />
          {viewAll ? 'Today only' : 'View history'}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Active Trips', value: active, color: '#38bdf8', icon: Truck },
          { label: 'Delivered', value: delivered, color: '#22c55e', icon: CheckCircle },
          { label: 'Volume Delivered', value: `${totalVol.toFixed(1)} m³`, color: '#a78bfa', icon: Package },
        ].map(k => (
          <div key={k.label} style={{
            background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
            border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: k.color + '18', border: `1px solid ${k.color}30`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <k.icon size={17} color={k.color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#eef5ff' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#9fb0c7' }}>{k.label}</div>
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
            background: filter === val ? 'linear-gradient(135deg,#1d2d47,#152239)' : 'transparent',
            color: filter === val ? '#eef5ff' : '#9fb0c7',
            boxShadow: filter === val ? '0 2px 8px rgba(0,0,0,.25)' : 'none',
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9fb0c7' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#9fb0c7',
          background: 'rgba(15,28,54,.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
        }}>
          <Truck size={36} style={{ opacity: .3, display: 'block', margin: '0 auto 12px' }} />
          {viewAll ? 'No trips found' : 'No trips assigned for today'}
          {!viewAll && (
            <button onClick={() => setViewAll(true)} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              View trip history →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {filtered.map(c => (
            <TripCard key={c.id} challan={c} onMarkDelivered={handleMarkDelivered} />
          ))}
        </div>
      )}
    </div>
  );
}
