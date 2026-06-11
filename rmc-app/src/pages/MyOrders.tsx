import { useState, useEffect, useCallback } from 'react';
import { api, type Order, type Challan, type LedgerEntry, type LivePosition, type Site, type RecurringOrder, type FreshnessConfig } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';
import FreshnessCountdown from '@/components/FreshnessCountdown';
import { ClipboardList, Truck, Package, AlertCircle, TrendingUp, TrendingDown, Receipt, Plus, X, Navigation, MapPin, CheckCircle2, Camera, Image as ImageIcon, RotateCcw, Ban, FileText, Repeat, Pause, Play, Pencil, Trash2, CalendarClock } from 'lucide-react';
import { downloadDeliveryReceipt } from '@/pages/deliveryReceipt';
import SitePicker from '@/components/SitePicker';
import LiveDeliveryMap, { type DeliveryMarker } from '@/components/LiveDeliveryMap';

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60'];

interface OrderForm {
  grade: string;
  quantity: string;
  deliveryDate: string;
  deliveryTime: string;
  pumpRequired: boolean;
  notes: string;
  siteId: string;
}

const EMPTY_FORM: OrderForm = {
  grade: '', quantity: '', deliveryDate: '', deliveryTime: '', pumpRequired: false, notes: '', siteId: '',
};

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface RecurringForm {
  grade: string;
  quantity: string;
  frequency: 'weekly' | 'monthly';
  anchor: number;
  deliveryTime: string;
  pumpRequired: boolean;
  notes: string;
  siteId: string;
}

const EMPTY_RECURRING: RecurringForm = {
  grade: '', quantity: '', frequency: 'weekly', anchor: 1, deliveryTime: '', pumpRequired: false, notes: '', siteId: '',
};

function describeSchedule(r: { frequency: string; anchor: number }): string {
  if (r.frequency === 'weekly') return `Every ${DOW[r.anchor] ?? '—'}`;
  const a = r.anchor;
  const suffix = a % 10 === 1 && a !== 11 ? 'st' : a % 10 === 2 && a !== 12 ? 'nd' : a % 10 === 3 && a !== 13 ? 'rd' : 'th';
  return `Monthly on the ${a}${suffix}`;
}

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
  const [sites, setSites] = useState<Site[]>([]);
  const [recurring, setRecurring] = useState<RecurringOrder[]>([]);
  const [tab, setTab] = useState<'overview' | 'orders' | 'challans' | 'ledger' | 'recurring'>('overview');
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [recEditing, setRecEditing] = useState<RecurringOrder | null>(null);
  const [recForm, setRecForm] = useState<RecurringForm>(EMPTY_RECURRING);
  const [recSaving, setRecSaving] = useState(false);
  const [recError, setRecError] = useState('');
  const [recBusyId, setRecBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [livePositions, setLivePositions] = useState<Record<number, LivePosition>>({});
  const [freshnessConfig, setFreshnessConfig] = useState<FreshnessConfig | null>(null);
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
      api.get<Site[]>('/me/sites'),
      api.get<RecurringOrder[]>('/me/recurring'),
    ])
      .then(([o, c, l, s, r]) => { setOrders(o); setChallans(c); setLedger(l); setSites(s); setRecurring(r); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const createSite = useCallback(async (payload: { name: string; address?: string; city?: string; latitude?: string; longitude?: string }) => {
    const site = await api.post<Site>('/me/sites', payload);
    setSites(prev => [site, ...prev]);
    return site;
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Working-life config so the pour-by countdown matches the plant's setting.
  // Best-effort: the chip just hides if this never loads.
  useEffect(() => {
    let cancelled = false;
    api.get<FreshnessConfig>('/positions/freshness-config')
      .then(cfg => { if (!cancelled) setFreshnessConfig(cfg); })
      .catch(() => { /* countdown is non-critical */ });
    return () => { cancelled = true; };
  }, []);

  // Seed the live map with positions already in flight, since SSE only delivers
  // *future* movements. Scoped server-side to this client. Best-effort.
  useEffect(() => {
    let cancelled = false;
    api.get<LivePosition[]>('/positions/mine')
      .then(list => {
        if (cancelled) return;
        setLivePositions(prev => {
          const next = { ...prev };
          for (const p of list) if (p?.challanId) next[p.challanId] = p;
          return next;
        });
      })
      .catch(() => { /* tracking is non-critical; ignore */ });
    return () => { cancelled = true; };
  }, []);

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
      siteId: o.siteId ? String(o.siteId) : '',
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
        siteId: form.siteId || undefined,
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

  function openRecModal(r?: RecurringOrder) {
    setRecError('');
    if (r) {
      setRecEditing(r);
      setRecForm({
        grade: r.grade,
        quantity: parseFloat(r.quantity).toString(),
        frequency: r.frequency,
        anchor: r.anchor,
        deliveryTime: r.deliveryTime ?? '',
        pumpRequired: !!r.pumpRequired,
        notes: r.notes ?? '',
        siteId: r.siteId ? String(r.siteId) : '',
      });
    } else {
      setRecEditing(null);
      setRecForm(EMPTY_RECURRING);
    }
    setRecModalOpen(true);
  }

  async function submitRecurring(e: React.FormEvent) {
    e.preventDefault();
    setRecError('');
    if (!recForm.grade) { setRecError('Please select a concrete grade.'); return; }
    if (!(Number(recForm.quantity) > 0)) { setRecError('Please enter a quantity greater than zero.'); return; }
    setRecSaving(true);
    const payload = {
      grade: recForm.grade,
      quantity: recForm.quantity,
      frequency: recForm.frequency,
      anchor: recForm.anchor,
      pumpRequired: recForm.pumpRequired,
      deliveryTime: recForm.deliveryTime || undefined,
      notes: recForm.notes || undefined,
      siteId: recForm.siteId || undefined,
    };
    try {
      if (recEditing) {
        const updated = await api.patch<RecurringOrder>(`/me/recurring/${recEditing.id}`, payload);
        setRecurring(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      } else {
        const created = await api.post<RecurringOrder>('/me/recurring', payload);
        setRecurring(prev => [created, ...prev]);
      }
      setRecModalOpen(false);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Could not save the schedule.');
    } finally {
      setRecSaving(false);
    }
  }

  async function toggleRecurring(r: RecurringOrder) {
    setRecBusyId(r.id);
    setActionError('');
    try {
      const updated = await api.patch<RecurringOrder>(`/me/recurring/${r.id}`, { active: !r.active });
      setRecurring(prev => prev.map(x => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the schedule.');
    } finally {
      setRecBusyId(null);
    }
  }

  async function deleteRecurring(r: RecurringOrder) {
    if (!window.confirm(`Delete the recurring ${r.grade} schedule? Future orders will stop.`)) return;
    setRecBusyId(r.id);
    setActionError('');
    try {
      await api.delete(`/me/recurring/${r.id}`);
      setRecurring(prev => prev.filter(x => x.id !== r.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete the schedule.');
    } finally {
      setRecBusyId(null);
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

  const tabs: { key: typeof tab; label: string; count: number | null }[] = [
    { key: 'overview',  label: 'Overview',  count: null },
    { key: 'orders',    label: 'Orders',    count: orders.length },
    { key: 'challans',  label: 'Challans',  count: challans.length },
    { key: 'ledger',    label: 'Ledger',    count: ledger.entries.length },
    { key: 'recurring', label: 'Recurring', count: recurring.length },
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
      ) : tab === 'overview' ? (
        <OverviewTab orders={orders} challans={challans} ledger={ledger} recurring={recurring} fmt={fmt} totalQty={totalQty} />
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
            {(() => {
              const markers: DeliveryMarker[] = challans
                .filter(c => c.status === 'dispatched')
                .map(c => {
                  const live = livePositions[c.id];
                  const siteLat = c.siteLat != null ? parseFloat(c.siteLat) : NaN;
                  const siteLng = c.siteLng != null ? parseFloat(c.siteLng) : NaN;
                  return {
                    challanId: c.id,
                    challanNo: c.challanNo,
                    vehicleNo: c.vehicleNo,
                    truck: live && Number.isFinite(live.lat) && Number.isFinite(live.lng) ? { lat: live.lat, lng: live.lng } : null,
                    site: Number.isFinite(siteLat) && Number.isFinite(siteLng) ? { lat: siteLat, lng: siteLng, name: c.siteName } : null,
                  };
                });
              return <LiveDeliveryMap markers={markers} />;
            })()}
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
                        <FreshnessCountdown dispatchTime={c.dispatchTime} config={freshnessConfig} variant="chip" />
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
      ) : tab === 'recurring' ? (
        <RecurringTab
          recurring={recurring}
          busyId={recBusyId}
          onNew={openRecModal}
          onEdit={r => openRecModal(r)}
          onToggle={toggleRecurring}
          onDelete={deleteRecurring}
        />
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
              <SitePicker sites={sites} value={form.siteId} onChange={id => setForm(f => ({ ...f, siteId: id }))} onCreate={createSite} />
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

      {/* Recurring schedule modal */}
      {recModalOpen && (
        <div
          onClick={() => !recSaving && setRecModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={submitRecurring}
            style={{
              width: '100%', maxWidth: 500,
              background: 'linear-gradient(135deg,rgba(15,28,54,.98),rgba(8,17,31,.98))',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,.5)', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 9 }}>
                <Repeat size={18} style={{ color: 'var(--gold)' }} />
                {recEditing ? 'Edit Recurring Order' : 'New Recurring Order'}
              </h3>
              <button type="button" onClick={() => !recSaving && setRecModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>
              We'll automatically place this order for you on the schedule below. You can pause or cancel anytime.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Concrete Grade</label>
                <select value={recForm.grade} onChange={e => setRecForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle}>
                  <option value="">Select grade…</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Quantity (m³)</label>
                <input type="number" min="0" step="0.5" value={recForm.quantity} onChange={e => setRecForm(f => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 10" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <select value={recForm.frequency} onChange={e => {
                  const frequency = e.target.value as 'weekly' | 'monthly';
                  setRecForm(f => ({ ...f, frequency, anchor: frequency === 'weekly' ? Math.min(f.anchor, 6) : Math.max(1, Math.min(f.anchor, 28)) }));
                }} style={inputStyle}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{recForm.frequency === 'weekly' ? 'Day of week' : 'Day of month'}</label>
                {recForm.frequency === 'weekly' ? (
                  <select value={recForm.anchor} onChange={e => setRecForm(f => ({ ...f, anchor: Number(e.target.value) }))} style={inputStyle}>
                    {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                ) : (
                  <select value={recForm.anchor} onChange={e => setRecForm(f => ({ ...f, anchor: Number(e.target.value) }))} style={inputStyle}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={labelStyle}>Preferred Time (optional)</label>
                <input type="time" value={recForm.deliveryTime} onChange={e => setRecForm(f => ({ ...f, deliveryTime: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <SitePicker sites={sites} value={recForm.siteId} onChange={id => setRecForm(f => ({ ...f, siteId: id }))} onCreate={createSite} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={recForm.notes} onChange={e => setRecForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Special instructions…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>
              <input type="checkbox" checked={recForm.pumpRequired} onChange={e => setRecForm(f => ({ ...f, pumpRequired: e.target.checked }))} />
              Concrete pump required
            </label>

            {recError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginTop: 16 }}>
                <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                <span style={{ color: 'var(--red)', fontSize: 13 }}>{recError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button type="button" onClick={() => !recSaving && setRecModalOpen(false)} style={{
                flex: 1, padding: '11px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'var(--text)',
              }}>
                Cancel
              </button>
              <button type="submit" disabled={recSaving} style={{
                flex: 1, padding: '11px', borderRadius: 11, border: 'none',
                cursor: recSaving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800, color: '#111827',
                background: recSaving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              }}>
                {recSaving ? 'Saving…' : recEditing ? 'Save Changes' : 'Create Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ orders, challans, ledger, recurring, fmt, totalQty }: {
  orders: Order[];
  challans: Challan[];
  ledger: LedgerData;
  recurring: RecurringOrder[];
  fmt: (n: number) => string;
  totalQty: (items: { quantity: string }[]) => string;
}) {
  const delivered = challans.filter(c => c.status === 'delivered');
  const volumeDelivered = parseFloat(totalQty(delivered));
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'in_progress').length;
  const activeRecurring = recurring.filter(r => r.active).length;

  const byGrade = new Map<string, number>();
  for (const c of delivered) byGrade.set(c.grade, (byGrade.get(c.grade) ?? 0) + parseFloat(c.quantity || '0'));
  const grades = [...byGrade.entries()].sort((a, b) => b[1] - a[1]);
  const maxGrade = grades.length ? grades[0][1] : 0;

  const creditUsed = ledger.creditLimit > 0 ? Math.min(100, (ledger.outstanding / ledger.creditLimit) * 100) : 0;

  type Activity = { id: string; when: string; label: string; sub: string; color: string };
  const activity: Activity[] = [
    ...orders.map(o => ({ id: `o${o.id}`, when: o.createdAt, label: `Order ${o.orderNo}`, sub: `${o.grade} · ${parseFloat(o.quantity).toFixed(1)} m³`, color: 'var(--gold)' })),
    ...challans.map(c => ({ id: `c${c.id}`, when: c.dispatchTime || c.createdAt, label: `Challan ${c.challanNo}`, sub: `${c.grade} · ${c.status}`, color: 'var(--green)' })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()).slice(0, 6);

  const cards = [
    { label: 'Volume Delivered', value: `${volumeDelivered.toFixed(1)} m³`, color: '#a78bfa', icon: Package },
    { label: 'Total Orders', value: orders.length, color: 'var(--gold)', icon: ClipboardList },
    { label: 'Active Orders', value: activeOrders, color: 'var(--blue)', icon: Truck },
    { label: 'Recurring Active', value: activeRecurring, color: 'var(--green)', icon: Repeat },
  ];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
        {cards.map(c => (
          <Card key={c.label} style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <c.icon size={15} style={{ color: c.color }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Receipt size={15} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Account Balance</h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Outstanding</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: ledger.outstanding > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(ledger.outstanding)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ width: `${creditUsed}%`, height: '100%', borderRadius: 6, background: creditUsed > 85 ? 'var(--red)' : creditUsed > 60 ? 'var(--gold)' : 'var(--green)', transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)' }}>
            <span>{creditUsed.toFixed(0)}% of credit used</span>
            <span>Limit {fmt(ledger.creditLimit)}</span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Package size={15} style={{ color: '#a78bfa' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Volume by Grade</h3>
          </div>
          {grades.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>No deliveries yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {grades.slice(0, 6).map(([g, q]) => (
                <div key={g}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{g}</span>
                    <span style={{ color: 'var(--muted)' }}>{q.toFixed(1)} m³</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${maxGrade ? (q / maxGrade) * 100 : 0}%`, height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#a78bfa,var(--blue))' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={15} style={{ color: 'var(--green)' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Recent Activity</h3>
        </div>
        {activity.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing yet — place your first order to get started.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {activity.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(38,52,73,.4)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.sub}</div>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {a.when ? new Date(a.when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RecurringTab({ recurring, busyId, onNew, onEdit, onToggle, onDelete }: {
  recurring: RecurringOrder[];
  busyId: number | null;
  onNew: () => void;
  onEdit: (r: RecurringOrder) => void;
  onToggle: (r: RecurringOrder) => void;
  onDelete: (r: RecurringOrder) => void;
}) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: recurring.length ? 18 : 0, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Repeat size={15} style={{ color: 'var(--gold)' }} /> Recurring Orders
          </h3>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--muted)' }}>Set it once — we place these orders for you automatically.</p>
        </div>
        <button onClick={onNew} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 11, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', whiteSpace: 'nowrap',
        }}>
          <Plus size={15} /> New Schedule
        </button>
      </div>

      {recurring.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          <CalendarClock size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
          No recurring orders yet
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {recurring.map(r => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} style={{
                border: '1px solid var(--line)', borderRadius: 13, padding: '14px 16px',
                background: 'rgba(255,255,255,.02)', opacity: r.active ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800 }}>{r.grade}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{parseFloat(r.quantity).toFixed(1)} m³</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}>
                      <CalendarClock size={12} /> {describeSchedule(r)}
                    </span>
                    {r.siteName && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}><MapPin size={11} /> {r.siteName}</span>}
                    {r.pumpRequired && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· pump</span>}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    color: r.active ? 'var(--green)' : 'var(--muted)',
                    background: r.active ? 'rgba(34,197,94,.13)' : 'rgba(159,176,199,.13)',
                  }}>{r.active ? 'Active' : 'Paused'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    Next order: <strong style={{ color: 'var(--text)' }}>{new Date(r.nextRunDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onToggle(r)} disabled={busy} title={r.active ? 'Pause' : 'Resume'} style={btnStyle(r.active ? 'var(--gold)' : 'var(--green)', busy)}>
                      {r.active ? <Pause size={13} /> : <Play size={13} />} {r.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => onEdit(r)} disabled={busy} title="Edit" style={btnStyle('var(--blue)', busy)}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => onDelete(r)} disabled={busy} title="Delete" style={btnStyle('var(--red)', busy)}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function btnStyle(color: string, busy: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'wait' : 'pointer',
    background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
    padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, opacity: busy ? 0.6 : 1,
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
