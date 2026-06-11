import { useState, useEffect, useCallback } from 'react';
import { api, type Order, type Challan, type LedgerEntry, type LivePosition } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';
import { ClipboardList, Truck, Package, AlertCircle, TrendingUp, TrendingDown, Receipt, Plus, X, Navigation, MapPin, CheckCircle2, Camera, Image as ImageIcon, RotateCcw, Ban, FileText } from 'lucide-react';
import { downloadDeliveryReceipt } from '@/pages/deliveryReceipt';

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60'];

interface OrderForm {
  grade: string;
  quantity: string;
  deliveryDate: string;
  deliveryTime: string;
  pumpRequired: boolean;
  notes: string;
}

const EMPTY_FORM: OrderForm = {
  grade: '', quantity: '', deliveryDate: '', deliveryTime: '', pumpRequired: false, notes: '',
};

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  pending:     { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 13%, transparent)',  label: 'Pending' },
  in_progress: { color: 'var(--blue)', bg: 'rgba(56,189,248,.13)',  label: 'In Progress' },
  completed:   { color: 'var(--green)', bg: 'rgba(34,197,94,.13)',   label: 'Completed' },
  cancelled:   { color: 'var(--red)', bg: 'rgba(239,68,68,.13)',   label: 'Cancelled' },
  dispatched:  { color: 'var(--blue)', bg: 'rgba(56,189,248,.13)',  label: 'Dispatched' },
  delivered:   { color: 'var(--green)', bg: 'rgba(34,197,94,.13)',   label: 'Delivered' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || { color: 'var(--muted)', bg: 'rgba(159,176,199,.13)', label: status };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`,
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

interface LedgerData {
  entries: (LedgerEntry & { runningBalance: number })[];
  outstanding: number;
  creditLimit: number;
}

function formatDistance(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m)) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// Rough ETA from current straight-line distance and reported speed (m/s).
// Shown as an estimate ("~") only — it is not a delivery promise.
function formatEta(distanceM: number | null | undefined, speed: number | null | undefined): string | null {
  if (distanceM == null || speed == null || !Number.isFinite(distanceM) || !Number.isFinite(speed)) return null;
  if (speed < 0.5) return null; // truck not moving meaningfully
  const mins = distanceM / speed / 60;
  if (!Number.isFinite(mins) || mins <= 0) return null;
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `~${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const mm = Math.round(mins % 60);
  return `~${h} h ${mm} min`;
}

const TIMELINE_STEPS = ['Pending', 'Dispatched', 'On the way', 'Delivered'] as const;

// Maps a challan status (+ whether a live GPS fix exists) to the active step.
function activeStep(status: string, hasLive: boolean): number {
  if (status === 'delivered') return 3;
  if (status === 'dispatched') return hasLive ? 2 : 1;
  if (status === 'cancelled') return 1;
  return 0;
}

function LiveTimeline({ status, hasLive }: { status: string; hasLive: boolean }) {
  const step = activeStep(status, hasLive);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 12 }}>
      {TIMELINE_STEPS.map((label, i) => {
        const done = i <= step;
        const isLast = i === TIMELINE_STEPS.length - 1;
        const color = i === 3 ? 'var(--green)' : 'var(--blue)';
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: done ? color : 'rgba(255,255,255,.06)',
                border: `1px solid ${done ? color : 'var(--line)'}`,
                boxShadow: done && i === step ? `0 0 0 4px color-mix(in srgb, ${color} 22%, transparent)` : 'none',
              }}>
                {done ? <CheckCircle2 size={11} color="#08111f" /> : <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)' }} />}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: done ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, height: 2, margin: '0 4px', marginBottom: 16, background: i < step ? color : 'var(--line)', borderRadius: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [ledger, setLedger] = useState<LedgerData>({ entries: [], outstanding: 0, creditLimit: 0 });
  const [tab, setTab] = useState<'orders' | 'challans' | 'ledger'>('orders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [livePositions, setLivePositions] = useState<Record<number, LivePosition>>({});
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [proof, setProof] = useState<{ open: boolean; loading: boolean; challanNo: string; photos: string[]; error: string }>(
    { open: false, loading: false, challanNo: '', photos: [], error: '' },
  );
  const { subscribe } = useSSE();

  const reloadAll = useCallback(() => {
    Promise.all([
      api.get<Order[]>('/me/orders'),
      api.get<Challan[]>('/me/challans'),
      api.get<LedgerData>('/me/ledger'),
    ])
      .then(([o, c, l]) => { setOrders(o); setChallans(c); setLedger(l); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Live tracking + freshness. The GPS feed and order/challan events are already
  // scoped server-side to this client, so we just reflect them in place.
  useEffect(() => {
    const unsubPos = subscribe('vehicle.position', (data: unknown) => {
      const p = data as LivePosition;
      if (!p?.challanId) return;
      setLivePositions(prev => ({ ...prev, [p.challanId]: p }));
    });
    const unsubCreated = subscribe('challan.created', () => reloadAll());
    const unsubUpdated = subscribe('challan.updated', (data: unknown) => {
      const c = data as Partial<Challan>;
      if (!c?.id) return;
      setChallans(prev => prev.map(x => x.id === c.id ? { ...x, ...c } as Challan : x));
      if (c.status === 'delivered') {
        setLivePositions(prev => { const next = { ...prev }; delete next[c.id!]; return next; });
      }
    });
    const unsubOrder = subscribe('order.updated', (data: unknown) => {
      const o = data as Partial<Order>;
      if (!o?.id) return;
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...o } as Order : x));
    });
    const unsubReconnect = subscribe('reconnect', () => reloadAll());
    return () => { unsubPos(); unsubCreated(); unsubUpdated(); unsubOrder(); unsubReconnect(); };
  }, [subscribe, reloadAll]);

  async function viewProof(c: Challan) {
    setProof({ open: true, loading: true, challanNo: c.challanNo, photos: [], error: '' });
    try {
      const detail = await api.get<Challan>(`/me/challans/${c.id}`);
      setProof({ open: true, loading: false, challanNo: c.challanNo, photos: detail.proofPhotos ?? [], error: '' });
    } catch (e) {
      setProof({ open: true, loading: false, challanNo: c.challanNo, photos: [], error: e instanceof Error ? e.message : 'Could not load photo' });
    }
  }

  // One-tap reorder: pre-fill the Place Order modal from a past order. The
  // delivery date/time are intentionally left blank so the customer picks a
  // fresh slot rather than re-submitting an old date.
  function reorder(o: Order) {
    setForm({
      grade: o.grade,
      quantity: parseFloat(o.quantity).toString(),
      deliveryDate: '',
      deliveryTime: '',
      pumpRequired: !!o.pumpRequired,
      notes: o.notes ?? '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function cancelOrder(o: Order) {
    if (!window.confirm(`Cancel order ${o.orderNo}? This cannot be undone.`)) return;
    setActionError('');
    setCancelingId(o.id);
    try {
      const updated = await api.patch<Order>(`/me/orders/${o.id}/cancel`, {});
      setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not cancel the order.');
    } finally {
      setCancelingId(null);
    }
  }

  async function downloadReceipt(c: Challan) {
    setActionError('');
    setReceiptId(c.id);
    try {
      await downloadDeliveryReceipt(c);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate the receipt.');
    } finally {
      setReceiptId(null);
    }
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.grade) { setFormError('Please select a concrete grade.'); return; }
    if (!(Number(form.quantity) > 0)) { setFormError('Please enter a quantity greater than zero.'); return; }
    setSaving(true);
    try {
      const created = await api.post<Order>('/me/orders', {
        grade: form.grade,
        quantity: form.quantity,
        pumpRequired: form.pumpRequired,
        deliveryDate: form.deliveryDate || undefined,
        deliveryTime: form.deliveryTime || undefined,
        notes: form.notes || undefined,
      });
      setOrders(prev => [created, ...prev]);
      setModalOpen(false);
      setTab('orders');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not place the order.');
    } finally {
      setSaving(false);
    }
  }

  const totalQty = (items: { quantity: string }[]) =>
    items.reduce((s, i) => s + parseFloat(i.quantity || '0'), 0).toFixed(1);

  const kpis = [
    { label: 'Total Orders', value: orders.length, icon: ClipboardList, color: 'var(--blue)' },
    { label: 'Active Orders', value: orders.filter(o => o.status === 'pending' || o.status === 'in_progress').length, icon: AlertCircle, color: 'var(--gold)' },
    { label: 'Total Dispatched', value: challans.filter(c => c.status === 'dispatched' || c.status === 'delivered').length, icon: Truck, color: 'var(--green)' },
    { label: 'Volume Delivered', value: `${totalQty(challans.filter(c => c.status === 'delivered'))} m³`, icon: Package, color: '#a78bfa' },
  ];

  const tabs: { key: 'orders' | 'challans' | 'ledger'; label: string; count: number | null }[] = [
    { key: 'orders',   label: 'Orders',   count: orders.length },
    { key: 'challans', label: 'Challans', count: challans.length },
    { key: 'ledger',   label: 'Ledger',   count: ledger.entries.length },
  ];

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>
            My Orders & Deliveries
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
            Track your concrete orders, delivery challans, and billing ledger
          </p>
        </div>
        <button onClick={openModal} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px',
          borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800,
          background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
          color: '#111827', boxShadow: '0 10px 26px color-mix(in srgb, var(--gold) 20%, transparent)',
          whiteSpace: 'nowrap',
        }}>
          <Plus size={17} /> Place Order
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
        {kpis.map(k => (
          <Card key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: `color-mix(in srgb, ${k.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${k.color} 19%, transparent)`,
              display: 'grid', placeItems: 'center',
            }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{k.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Outstanding + Credit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Outstanding Amount</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: ledger.outstanding > 0 ? 'var(--red)' : 'var(--green)' }}>
            {fmt(ledger.outstanding)}
          </div>
        </Card>
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Credit Limit</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{fmt(ledger.creditLimit)}</div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all .18s',
            background: tab === t.key ? 'linear-gradient(135deg,var(--surface),var(--panel2))' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--muted)',
            boxShadow: tab === t.key ? '0 2px 8px rgba(0,0,0,.25)' : 'none',
          }}>
            {t.label} ({t.count ?? 0})
          </button>
        ))}
      </div>

      {actionError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', color: 'var(--red)',
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
        }}>
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, display: 'inline-flex' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{error}</div>
      ) : tab === 'orders' ? (
        <Card>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              <ClipboardList size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
              No orders found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Order No', 'Grade', 'Qty (m³)', 'Delivery Date', 'Site', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue)', fontSize: 13 }}>{o.orderNo}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{o.grade}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text)', fontWeight: 700 }}>{parseFloat(o.quantity).toFixed(1)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>{o.deliveryDate || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>{o.siteName || '—'}</td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={o.status} /></td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => reorder(o)} title="Reorder" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, background: 'color-mix(in srgb, var(--gold) 14%, transparent)',
                          color: 'var(--gold)', border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', borderRadius: 7,
                          padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}>
                          <RotateCcw size={13} /> Reorder
                        </button>
                        {o.status === 'pending' && (
                          <button onClick={() => cancelOrder(o)} disabled={cancelingId === o.id} title="Cancel order" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,.12)',
                            color: 'var(--red)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 7,
                            padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: cancelingId === o.id ? 'wait' : 'pointer',
                            opacity: cancelingId === o.id ? 0.6 : 1,
                          }}>
                            <Ban size={13} /> {cancelingId === o.id ? 'Canceling…' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : tab === 'challans' ? (
       <>
        {challans.filter(c => c.status === 'dispatched').length > 0 && (
          <Card style={{ marginBottom: 16, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Navigation size={15} style={{ color: 'var(--green)' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Live Deliveries</h3>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--green) 25%, transparent)' }} />
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
              Tracking your in-transit trucks in real time. Distance &amp; ETA are estimates.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              {challans.filter(c => c.status === 'dispatched').map(c => {
                const live = livePositions[c.id];
                const dist = formatDistance(live?.distanceM);
                const eta = formatEta(live?.distanceM, live?.speed);
                return (
                  <div key={c.id} style={{
                    border: '1px solid var(--line)', borderRadius: 13, padding: '14px 16px',
                    background: 'rgba(255,255,255,.02)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--green)', fontSize: 13 }}>{c.challanNo}</span>
                        <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '2px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{c.grade}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{parseFloat(c.quantity).toFixed(1)} m³</span>
                        {c.vehicleNo && <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>{c.vehicleNo}</span>}
                        {c.driverName && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {c.driverName}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {dist && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--blue)', background: 'rgba(56,189,248,.1)', padding: '4px 10px', borderRadius: 8 }}>
                            <MapPin size={12} /> {dist} away
                          </span>
                        )}
                        {eta && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'rgba(34,197,94,.1)', padding: '4px 10px', borderRadius: 8 }}>
                            <Navigation size={12} /> ETA {eta}
                          </span>
                        )}
                        {!live && (
                          <span style={{ fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>Awaiting GPS…</span>
                        )}
                      </div>
                    </div>
                    <LiveTimeline status={c.status} hasLive={!!live} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <Card>
          {challans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              <Truck size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
              No challans found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Challan No', 'Grade', 'Qty (m³)', 'Vehicle', 'Driver', 'Dispatch Time', 'Status', 'Proof', 'Receipt'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challans.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>{c.challanNo}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{c.grade}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text)', fontWeight: 700 }}>{parseFloat(c.quantity).toFixed(1)}</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--muted)', fontSize: 12 }}>{c.vehicleNo || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>{c.driverName || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>
                      {c.dispatchTime ? new Date(c.dispatchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: '12px 14px' }}>
                      {c.hasProofPhoto ? (
                        <button onClick={() => viewProof(c)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                          background: 'rgba(56,189,248,.1)', color: 'var(--blue)', border: '1px solid color-mix(in srgb, var(--blue) 35%, transparent)',
                          padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        }}>
                          <Camera size={13} /> Photo
                        </button>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {c.status === 'delivered' ? (
                        <button onClick={() => downloadReceipt(c)} disabled={receiptId === c.id} title="Download receipt" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, cursor: receiptId === c.id ? 'wait' : 'pointer',
                          background: 'color-mix(in srgb, var(--green) 12%, transparent)', color: 'var(--green)',
                          border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)',
                          padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          opacity: receiptId === c.id ? 0.6 : 1,
                        }}>
                          <FileText size={13} /> {receiptId === c.id ? 'Preparing…' : 'Receipt'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
       </>
      ) : (
        /* Ledger tab */
        <Card>
          {ledger.entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              <Receipt size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
              No ledger entries found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Debit' || h === 'Credit' || h === 'Balance' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }}>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(e.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text)', fontSize: 13 }}>{e.description}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: 'var(--muted)', fontSize: 11 }}>{e.referenceNo || '—'}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', color: e.type === 'debit' ? 'var(--red)' : 'var(--muted)', fontWeight: e.type === 'debit' ? 700 : 400 }}>
                      {e.type === 'debit' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <TrendingUp size={12} />
                          {fmt(parseFloat(e.amount))}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', color: e.type === 'credit' ? 'var(--green)' : 'var(--muted)', fontWeight: e.type === 'credit' ? 700 : 400 }}>
                      {e.type === 'credit' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <TrendingDown size={12} />
                          {fmt(parseFloat(e.amount))}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: e.runningBalance > 0 ? 'var(--red)' : 'var(--green)', fontSize: 13 }}>
                      {fmt(Math.abs(e.runningBalance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Place Order modal */}
      {modalOpen && (
        <div
          onClick={() => !saving && setModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={submitOrder}
            style={{
              width: '100%', maxWidth: 500,
              background: 'linear-gradient(135deg,rgba(15,28,54,.98),rgba(8,17,31,.98))',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,.5)', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Place New Order</h3>
              <button type="button" onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Concrete Grade</label>
                <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle}>
                  <option value="">Select grade…</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Quantity (m³)</label>
                <input type="number" min="0" step="0.5" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 10" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Delivery Date</label>
                <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Delivery Time</label>
                <input type="time" value={form.deliveryTime} onChange={e => setForm(f => ({ ...f, deliveryTime: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Notes / Site details (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Delivery site address, special instructions…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>
              <input type="checkbox" checked={form.pumpRequired} onChange={e => setForm(f => ({ ...f, pumpRequired: e.target.checked }))} />
              Concrete pump required
            </label>

            {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginTop: 16 }}>
                <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                <span style={{ color: 'var(--red)', fontSize: 13 }}>{formError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button type="button" onClick={() => !saving && setModalOpen(false)} style={{
                flex: 1, padding: '11px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'var(--text)',
              }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{
                flex: 1, padding: '11px', borderRadius: 11, border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800, color: '#111827',
                background: saving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              }}>
                {saving ? 'Placing…' : 'Place Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Proof-of-delivery photo modal */}
      {proof.open && (
        <div
          onClick={() => setProof(p => ({ ...p, open: false }))}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560,
              background: 'linear-gradient(135deg,rgba(15,28,54,.98),rgba(8,17,31,.98))',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,.5)', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 9 }}>
                <ImageIcon size={18} style={{ color: 'var(--blue)' }} />
                Delivery Proof · <span style={{ fontFamily: 'monospace', color: 'var(--green)' }}>{proof.challanNo}</span>
              </h3>
              <button type="button" onClick={() => setProof(p => ({ ...p, open: false }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {proof.loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading photo…</div>
            ) : proof.error ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '12px 14px' }}>
                <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                <span style={{ color: 'var(--red)', fontSize: 13 }}>{proof.error}</span>
              </div>
            ) : proof.photos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                <ImageIcon size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
                No proof photo available
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {proof.photos.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                    <img src={src} alt={`Delivery proof ${i + 1}`} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', display: 'block' }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
