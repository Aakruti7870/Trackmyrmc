import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useSearch } from 'wouter';
import { api, type Order, type Challan, type LedgerEntry, type LivePosition, type Site, type RecurringOrder, type FreshnessConfig, type IdleConfig, type PlantDirectoryEntry } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';
import { computeTripTiming, formatDuration } from '@/lib/tripTiming';
import FreshnessCountdown from '@/components/FreshnessCountdown';
import { ClipboardList, Truck, Package, AlertCircle, TrendingUp, TrendingDown, Receipt, Plus, X, Navigation, MapPin, CheckCircle2, Camera, Image as ImageIcon, RotateCcw, Ban, FileText, Repeat, Pause, Play, Pencil, Trash2, CalendarClock, Clock, AlertTriangle, Info, Star } from 'lucide-react';
import { downloadDeliveryReceipt } from '@/pages/deliveryReceipt';
import { downloadAccountStatement } from '@/pages/accountStatement';
import SitePicker from '@/components/SitePicker';
import LocationPicker, { type LatLng } from '@/components/LocationPicker';
import LiveDeliveryMap, { type DeliveryMarker } from '@/components/LiveDeliveryMap';

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60'];

// Soft single-order volume guidance (cubic metres). Below the minimum is an
// uneconomical partial truckload; above the maximum is a large pour that usually
// needs to be scheduled/split across the day. Neither blocks the order — they
// only nudge the customer toward what a plant can realistically deliver at once.
const TYPICAL_MIN_M3 = 3;
const TYPICAL_MAX_M3 = 150;

interface OrderForm {
  grade: string;
  quantity: string;
  deliveryDate: string;
  deliveryTime: string;
  pumpRequired: boolean;
  pumpLineLength: string;
  notes: string;
  siteId: string;
  contactPerson: string;
  contactNumber: string;
  siteName: string;
  siteAddress: string;
  latitude: string;
  longitude: string;
  paymentType: string;
  poNumber: string;
  sitePhoto: string;
}

const EMPTY_FORM: OrderForm = {
  grade: '', quantity: '', deliveryDate: '', deliveryTime: '', pumpRequired: false, pumpLineLength: '',
  notes: '', siteId: '', contactPerson: '', contactNumber: '', siteName: '', siteAddress: '',
  latitude: '', longitude: '', paymentType: '', poNumber: '', sitePhoto: '',
};

const PAYMENT_TYPES = ['Cash', 'Credit', 'Advance', 'Bank Transfer', 'Cheque', 'UPI'];

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
  pending:          { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 13%, transparent)',  label: 'Pending' },
  pending_approval: { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 13%, transparent)',  label: 'Awaiting Approval' },
  approved:         { color: 'var(--green)', bg: 'rgba(34,197,94,.13)',   label: 'Approved' },
  rejected:         { color: 'var(--red)', bg: 'rgba(239,68,68,.13)',   label: 'Rejected' },
  in_progress: { color: 'var(--blue)', bg: 'rgba(56,189,248,.13)',  label: 'In Progress' },
  completed:   { color: 'var(--green)', bg: 'rgba(34,197,94,.13)',   label: 'Completed' },
  cancelled:   { color: 'var(--red)', bg: 'rgba(239,68,68,.13)',   label: 'Cancelled' },
  dispatched:  { color: 'var(--blue)', bg: 'rgba(56,189,248,.13)',  label: 'Dispatched' },
  in_transit:  { color: 'var(--blue)', bg: 'rgba(56,189,248,.13)',  label: 'In Transit' },
  reached_site:{ color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 13%, transparent)', label: 'Reached Site' },
  unloading:   { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 13%, transparent)', label: 'Unloading' },
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
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 16, padding: 20,
      boxShadow: '0 8px 32px rgba(var(--shadow-rgb),.3)',
      ...style,
    }}>{children}</div>
  );
}

function SectionHeading({ icon: Icon, title, hint }: { icon: typeof Truck; title: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 2px 12px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} style={{ color: 'var(--gold)' }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{title}</h3>
      </div>
      {hint && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{hint}</span>}
    </div>
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
                background: done ? color : 'var(--chip-bg)',
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

const TAB_KEYS = ['today', 'deliveries', 'billing'] as const;
type TabKey = typeof TAB_KEYS[number];
function readTab(search: string): TabKey {
  const t = new URLSearchParams(search).get('tab');
  return (TAB_KEYS as readonly string[]).includes(t ?? '') ? (t as TabKey) : 'today';
}

// Local-day helpers for the "today" page and the Deliveries date-range filter.
function isToday(v?: string | null): boolean {
  if (!v) return false;
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
const ACTIVE_ORDER_STATUSES = ['pending', 'pending_approval', 'approved', 'in_progress'] as const;

// Statuses a customer can still cancel/reschedule (plant hasn't dispatched yet).
const CANCELLABLE_STATUSES = ['pending', 'pending_approval', 'approved'] as const;

// Customers can cancel/reschedule up to this many minutes before the scheduled
// delivery time. Kept in lockstep with the server's CANCEL_CUTOFF_MINUTES.
const CANCEL_CUTOFF_MINUTES = 20;

// Fixed picker of cancellation reasons; "Other" reveals a free-text field.
const CANCELLATION_REASONS = [
  'Change of plans',
  'Ordered by mistake',
  'Delivery no longer needed',
  'Wrong details entered',
  'Delayed at site',
  'Found another supplier',
  'Other',
] as const;

// Scheduled delivery Date from an order's date + time, or null unless BOTH are
// set. An order without a concrete date+time slot has no cutoff and stays
// cancellable (a date alone must NOT lock against midnight). Mirrors the server.
function scheduledDeliveryAt(o: Pick<Order, 'deliveryDate' | 'deliveryTime'>): Date | null {
  if (!o.deliveryDate || !o.deliveryTime) return null;
  const dt = new Date(`${o.deliveryDate}T${o.deliveryTime.slice(0, 5)}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// True once "now" is within the cutoff window before delivery (or past it).
// Mirrors the server so the UI disables cancel/reschedule before the API 409s.
function isCancelLocked(o: Pick<Order, 'deliveryDate' | 'deliveryTime'>): boolean {
  const scheduled = scheduledDeliveryAt(o);
  if (!scheduled) return false;
  return Date.now() >= scheduled.getTime() - CANCEL_CUTOFF_MINUTES * 60_000;
}

export default function MyOrders() {
  const search = useSearch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [ledger, setLedger] = useState<LedgerData>({ entries: [], outstanding: 0, creditLimit: 0 });
  const [sites, setSites] = useState<Site[]>([]);
  const [recurring, setRecurring] = useState<RecurringOrder[]>([]);
  const [tab, setTab] = useState<TabKey>(() => readTab(search));
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
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    plant?: string; grade?: string; quantity?: string;
    contactPerson?: string; contactNumber?: string; siteAddress?: string;
    deliveryDate?: string; deliveryTime?: string; siteName?: string;
    paymentType?: string; poNumber?: string; notes?: string;
    location?: string; pumpLineLength?: string;
  }>({});
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [plantDir, setPlantDir] = useState<PlantDirectoryEntry[]>([]);
  const [preferredPlantId, setPreferredPlantId] = useState<number | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const [livePositions, setLivePositions] = useState<Record<number, LivePosition>>({});
  const [freshnessConfig, setFreshnessConfig] = useState<FreshnessConfig | null>(null);
  const [idleConfig, setIdleConfig] = useState<IdleConfig | undefined>(undefined);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  // Cancel-order modal: the order being cancelled plus the picked reason.
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelOther, setCancelOther] = useState('');
  const [cancelError, setCancelError] = useState('');
  // Reschedule modal: the order plus the new date/time being chosen.
  const [reschedTarget, setReschedTarget] = useState<Order | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [reschedSaving, setReschedSaving] = useState(false);
  const [reschedError, setReschedError] = useState('');
  const [proof, setProof] = useState<{ open: boolean; loading: boolean; challanNo: string; photos: string[]; error: string }>(
    { open: false, loading: false, challanNo: '', photos: [], error: '' },
  );
  // Deliveries page: calendar date-range filter over the full challan/order history.
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  // Financial Statement page: "Request for Bill" state.
  const [billBusy, setBillBusy] = useState(false);
  const [billMsg, setBillMsg] = useState('');
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

  // Sidebar deep links to a tab (e.g. Deliveries → ?tab=challans) switch tabs
  // even when the user is already on this page (no remount). The lazy initial
  // state above covers arriving via a fresh deep link.
  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      if ((TAB_KEYS as readonly string[]).includes(t)) setTab(t as TabKey);
    };
    window.addEventListener('myorders:set-tab', handler);
    return () => window.removeEventListener('myorders:set-tab', handler);
  }, []);

  // Approved plants the customer may order from. Best-effort: if it fails the
  // selector falls back to showing only the pre-selected plant (from the
  // marketplace handoff), so ordering still works.
  useEffect(() => {
    let cancelled = false;
    api.get<PlantDirectoryEntry[]>('/plants/directory')
      .then(list => { if (!cancelled) setPlantDir(list); })
      .catch(() => { /* directory is best-effort */ });
    return () => { cancelled = true; };
  }, []);

  // The customer's explicitly pinned default plant, if any. Drives defaultPlant()
  // ahead of the last-ordered heuristic. Best-effort: a failure just leaves the
  // heuristic in charge.
  useEffect(() => {
    let cancelled = false;
    api.get<{ plantId: number | null }>('/me/preferred-plant')
      .then(r => { if (!cancelled) setPreferredPlantId(r?.plantId ?? null); })
      .catch(() => { /* pin is best-effort */ });
    return () => { cancelled = true; };
  }, []);

  // Working-life config so the pour-by countdown matches the plant's setting.
  // Best-effort: the chip just hides if this never loads.
  useEffect(() => {
    let cancelled = false;
    api.get<FreshnessConfig>('/positions/freshness-config')
      .then(cfg => { if (!cancelled) setFreshnessConfig(cfg); })
      .catch(() => { /* countdown is non-critical */ });
    return () => { cancelled = true; };
  }, []);

  // Idle config (free window + per-hour rate) so the time-at-site / idle-charge
  // figures match the plant's settings. Best-effort: if it never loads the
  // helper falls back to the built-in free window with no money charge.
  useEffect(() => {
    let cancelled = false;
    api.get<IdleConfig>('/me/idle-config')
      .then(cfg => { if (!cancelled) setIdleConfig({ freeMin: cfg.freeMin, ratePerHour: cfg.ratePerHour }); })
      .catch(() => { /* idle figures are non-critical */ });
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
    // Carry the plant the previous order was placed at so the customer can
    // re-submit in one tap — without this the modal opens with no plant and
    // submit fails with "please choose a plant".
    if (o.plantId != null) {
      setSelectedPlantId(o.plantId);
      setSelectedPlant(o.plantName ?? plantDir.find(p => p.id === o.plantId)?.name ?? null);
    } else {
      setSelectedPlantId(null);
      setSelectedPlant(null);
    }
    setEditingOrderId(null);
    setForm({
      grade: o.grade,
      quantity: parseFloat(o.quantity).toString(),
      deliveryDate: '',
      deliveryTime: '',
      pumpRequired: !!o.pumpRequired,
      pumpLineLength: o.pumpLineLength ?? '',
      notes: o.notes ?? '',
      siteId: o.siteId ? String(o.siteId) : '',
      contactPerson: o.contactPerson ?? '',
      contactNumber: o.contactNumber ?? '',
      siteName: o.siteName ?? '',
      siteAddress: o.siteAddress ?? '',
      latitude: o.latitude ?? '',
      longitude: o.longitude ?? '',
      paymentType: o.paymentType ?? '',
      poNumber: o.poNumber ?? '',
      sitePhoto: '',
    });
    setFormError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  // Edit an existing (pending/approved/rejected) order in place. Reuses the
  // order modal; submitOrder branches to PUT when editingOrderId is set.
  function editOrder(o: Order) {
    if (o.plantId != null) {
      setSelectedPlantId(o.plantId);
      setSelectedPlant(o.plantName ?? plantDir.find(p => p.id === o.plantId)?.name ?? null);
    } else {
      setSelectedPlantId(null);
      setSelectedPlant(null);
    }
    setEditingOrderId(o.id);
    setForm({
      grade: o.grade,
      quantity: parseFloat(o.quantity).toString(),
      deliveryDate: o.deliveryDate ?? '',
      deliveryTime: o.deliveryTime ?? '',
      pumpRequired: !!o.pumpRequired,
      pumpLineLength: o.pumpLineLength ?? '',
      notes: o.notes ?? '',
      siteId: o.siteId ? String(o.siteId) : '',
      contactPerson: o.contactPerson ?? '',
      contactNumber: o.contactNumber ?? '',
      siteName: o.siteName ?? '',
      siteAddress: o.siteAddress ?? '',
      latitude: o.latitude ?? '',
      longitude: o.longitude ?? '',
      paymentType: o.paymentType ?? '',
      poNumber: o.poNumber ?? '',
      sitePhoto: o.sitePhoto ?? '',
    });
    setFormError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  // Open the cancel modal (reason picker) for an order. Cancelling is a two-step
  // flow now: pick a reason, then confirm in confirmCancel().
  function cancelOrder(o: Order) {
    setCancelTarget(o);
    setCancelReason('');
    setCancelOther('');
    setCancelError('');
  }

  async function confirmCancel() {
    const o = cancelTarget;
    if (!o) return;
    const reason = cancelReason === 'Other' ? cancelOther.trim() : cancelReason;
    if (!reason) {
      setCancelError(cancelReason === 'Other' ? 'Please describe the reason.' : 'Please choose a reason.');
      return;
    }
    setCancelError('');
    setCancelingId(o.id);
    try {
      const updated = await api.patch<Order>(`/me/orders/${o.id}/cancel`, { reason });
      setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
      setCancelTarget(null);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Could not cancel the order.');
    } finally {
      setCancelingId(null);
    }
  }

  // Open the reschedule modal pre-filled with the order's current slot.
  function openReschedule(o: Order) {
    setReschedTarget(o);
    setReschedDate(o.deliveryDate ?? '');
    setReschedTime(o.deliveryTime ? o.deliveryTime.slice(0, 5) : '');
    setReschedError('');
  }

  async function confirmReschedule() {
    const o = reschedTarget;
    if (!o) return;
    if (!reschedDate) { setReschedError('Please choose a delivery date.'); return; }
    setReschedError('');
    setReschedSaving(true);
    try {
      const updated = await api.patch<Order>(`/me/orders/${o.id}/reschedule`, {
        deliveryDate: reschedDate,
        deliveryTime: reschedTime || undefined,
      });
      setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
      setReschedTarget(null);
    } catch (e) {
      setReschedError(e instanceof Error ? e.message : 'Could not reschedule the order.');
    } finally {
      setReschedSaving(false);
    }
  }

  async function downloadReceipt(c: Challan) {
    setActionError('');
    setReceiptId(c.id);
    try {
      await downloadDeliveryReceipt(c, idleConfig);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate the receipt.');
    } finally {
      setReceiptId(null);
    }
  }

  // The plant to pre-select when the customer opens a fresh order modal, in
  // priority order:
  // - their explicitly pinned default plant, if it is still orderable; otherwise
  // - the only option, when they can order from exactly one plant; otherwise
  // - the plant they most recently ordered from, if it is still orderable.
  // Orders arrive newest-first, so the first directory match wins. Returns null
  // when none of the above apply (no pin, no prior plant, or it is no longer in
  // the approved directory). Marketplace handoff and reorder set the plant
  // directly and bypass this helper, so they still take priority over the pin.
  const defaultPlant = useCallback((): PlantDirectoryEntry | null => {
    if (plantDir.length === 0) return null;
    if (preferredPlantId != null) {
      const pinned = plantDir.find(p => p.id === preferredPlantId);
      if (pinned) return pinned;
    }
    if (plantDir.length === 1) return plantDir[0];
    for (const o of orders) {
      if (o.plantId == null) continue;
      const match = plantDir.find(p => p.id === o.plantId);
      if (match) return match;
    }
    return null;
  }, [plantDir, orders, preferredPlantId]);

  // Pin (or unpin) the currently-selected plant as the customer's default.
  // Persists across sessions/devices via /me/preferred-plant. Optimistic on
  // success; surfaces a small inline error otherwise.
  async function togglePin() {
    if (selectedPlantId == null) return;
    const next = preferredPlantId === selectedPlantId ? null : selectedPlantId;
    setPinBusy(true);
    setPinError('');
    try {
      const r = await api.put<{ plantId: number | null }>('/me/preferred-plant', { plantId: next });
      setPreferredPlantId(r?.plantId ?? null);
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Could not update your default plant.');
    } finally {
      setPinBusy(false);
    }
  }

  // Guards the auto-default so it applies at most once per modal open — once the
  // customer has cleared or changed the selection we must not silently re-fill it.
  const autoPlantAppliedRef = useRef(false);

  function openModal() {
    // Pre-select the remembered/only plant so re-ordering from the same plant is
    // one tap. Falls back to blank; the effect below fills in if the directory
    // (or orders) finish loading after the modal is already open.
    autoPlantAppliedRef.current = false;
    setEditingOrderId(null);
    const def = defaultPlant();
    if (def) {
      setSelectedPlantId(def.id);
      setSelectedPlant(def.name);
      autoPlantAppliedRef.current = true;
    } else {
      setSelectedPlant(null);
      setSelectedPlantId(null);
    }
    setForm(EMPTY_FORM);
    setFormError('');
    setFieldErrors({});
    setPinError('');
    setModalOpen(true);
  }

  // Covers the case where the directory/orders finish loading after a fresh
  // modal is already open: apply the auto-default exactly once. Skipped when a
  // plant is already chosen (marketplace handoff / reorder take priority).
  // Deferred to avoid set-state-in-effect.
  useEffect(() => {
    if (!modalOpen || autoPlantAppliedRef.current || selectedPlantId != null) return;
    const def = defaultPlant();
    if (!def) return;
    autoPlantAppliedRef.current = true;
    Promise.resolve().then(() => {
      setSelectedPlantId(def.id);
      setSelectedPlant(def.name);
    });
  }, [modalOpen, selectedPlantId, defaultPlant]);

  // Handoff from the "Find Plants" marketplace: if the customer tapped Place
  // Order on a plant card, open the order modal pre-noting the chosen plant.
  useEffect(() => {
    const raw = sessionStorage.getItem('rmc_selected_plant');
    if (!raw) return;
    sessionStorage.removeItem('rmc_selected_plant');
    let picked: { id?: number; name?: string } | undefined;
    try {
      picked = JSON.parse(raw) as { id?: number; name?: string };
    } catch {
      return; // ignore malformed handoff
    }
    if (!picked?.id || !picked.name) return;
    const plantId = picked.id;
    const plantName = picked.name;
    // Defer setState out of the effect body to avoid cascading renders.
    Promise.resolve().then(() => {
      setSelectedPlant(plantName);
      setSelectedPlantId(plantId);
      setEditingOrderId(null);
      setForm(EMPTY_FORM);
      setFormError('');
      setFieldErrors({});
      setModalOpen(true);
    });
  }, []);

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const fe: typeof fieldErrors = {};
    // Every delivery detail is mandatory so the plant has a complete, actionable
    // order before it schedules the pour. PO Number is required only for credit
    // payment terms.
    const poRequired = form.paymentType === 'Credit';
    if (!selectedPlantId) fe.plant = 'Please choose a plant to order from.';
    if (!form.grade) fe.grade = 'Please select a concrete grade.';
    if (!(Number(form.quantity) > 0)) fe.quantity = 'Please enter a quantity greater than zero.';
    if (!form.deliveryDate) fe.deliveryDate = 'Please choose a delivery date.';
    if (!form.deliveryTime) fe.deliveryTime = 'Please choose a delivery time.';
    if (!form.contactPerson.trim()) fe.contactPerson = 'Please enter the site contact person.';
    if (!form.contactNumber.trim()) fe.contactNumber = 'Please enter a contact number.';
    if (!form.siteName.trim()) fe.siteName = 'Please enter the site name.';
    if (!form.siteAddress.trim()) fe.siteAddress = 'Please enter the full delivery address.';
    if (!(Number(form.latitude) && Number(form.longitude))) fe.location = 'Please pin the delivery location on the map.';
    if (!form.paymentType) fe.paymentType = 'Please select a payment type.';
    if (poRequired && !form.poNumber.trim()) fe.poNumber = 'A PO number is required for credit orders.';
    if (!form.notes.trim()) fe.notes = 'Please add notes or site details.';
    if (form.pumpRequired && !form.pumpLineLength.trim()) fe.pumpLineLength = 'Please enter the required pump line length.';
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;
    setSaving(true);
    try {
      const payload = {
        plantId: selectedPlantId,
        grade: form.grade,
        quantity: form.quantity,
        pumpRequired: form.pumpRequired,
        pumpLineLength: form.pumpRequired ? (form.pumpLineLength || undefined) : undefined,
        deliveryDate: form.deliveryDate || undefined,
        deliveryTime: form.deliveryTime || undefined,
        notes: form.notes || undefined,
        siteId: form.siteId || undefined,
        contactPerson: form.contactPerson.trim(),
        contactNumber: form.contactNumber.trim(),
        siteName: form.siteName.trim() || undefined,
        siteAddress: form.siteAddress.trim(),
        latitude: form.latitude || undefined,
        longitude: form.longitude || undefined,
        paymentType: form.paymentType || undefined,
        poNumber: form.poNumber.trim() || undefined,
        sitePhoto: form.sitePhoto || undefined,
      };
      if (editingOrderId != null) {
        const updated = await api.put<Order>(`/me/orders/${editingOrderId}`, payload);
        const picked = plantDir.find(p => p.id === (updated.plantId ?? selectedPlantId));
        setOrders(prev => prev.map(x => x.id === editingOrderId
          ? { ...updated, plantName: updated.plantName ?? picked?.name ?? selectedPlant, plantCode: updated.plantCode ?? picked?.plantCode ?? null }
          : x));
      } else {
        const created = await api.post<Order>('/me/orders', payload);
        // The POST returns plantId only; reflect the chosen plant's name/code
        // optimistically so the new row labels its plant before the next reload.
        const picked = plantDir.find(p => p.id === selectedPlantId);
        setOrders(prev => [{ ...created, plantName: created.plantName ?? picked?.name ?? selectedPlant, plantCode: created.plantCode ?? picked?.plantCode ?? null }, ...prev]);
      }
      setModalOpen(false);
      setTab('today');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not place the order.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadSitePhoto(file: File) {
    setPhotoUploading(true);
    setFormError('');
    try {
      const { uploadURL, objectPath } = await api.post<{ uploadURL: string; objectPath: string }>(
        '/me/orders/site-photo-upload-url', { contentType: file.type || 'image/jpeg' },
      );
      const put = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
      if (!put.ok) throw new Error('Upload failed');
      setForm(f => ({ ...f, sitePhoto: objectPath }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not upload the site photo.');
    } finally {
      setPhotoUploading(false);
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
    { label: 'Active Orders', value: orders.filter(o => o.status === 'pending' || o.status === 'pending_approval' || o.status === 'approved' || o.status === 'in_progress').length, icon: AlertCircle, color: 'var(--gold)' },
    { label: 'Total Dispatched', value: challans.filter(c => c.status === 'dispatched' || c.status === 'delivered').length, icon: Truck, color: 'var(--green)' },
    { label: 'Volume Delivered', value: `${totalQty(challans.filter(c => c.status === 'delivered'))} m³`, icon: Package, color: '#a78bfa' },
  ];

  const activeOrders = orders.filter(o => (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status));
  const dispatchedChallans = challans.filter(c => c.status === 'dispatched');
  const todayChallans = challans.filter(c => isToday(c.dispatchTime || c.createdAt));

  const tabs: { key: typeof tab; label: string; count: number | null }[] = [
    { key: 'today',       label: 'My Orders',           count: activeOrders.length },
    { key: 'deliveries',  label: 'Deliveries',          count: challans.length },
    { key: 'billing',     label: 'Financial Statement', count: ledger.entries.length },
  ];

  const pageMeta = tab === 'today'
    ? { title: 'My Orders', sub: 'Place orders, track today’s live deliveries and manage recurring schedules' }
    : tab === 'deliveries'
    ? { title: 'Deliveries', sub: 'Your full delivery & order history — filter by date and download challans' }
    : { title: 'Financial Statement', sub: 'Billing ledger, outstanding balance, statement download & bill requests' };

  // Deliveries date-range filter: inclusive local-day bounds over history rows.
  const inHistRange = (v?: string | null): boolean => {
    if (!histFrom && !histTo) return true;
    if (!v) return false;
    const t = new Date(v).getTime();
    if (isNaN(t)) return false;
    if (histFrom && t < new Date(`${histFrom}T00:00:00`).getTime()) return false;
    if (histTo && t > new Date(`${histTo}T23:59:59.999`).getTime()) return false;
    return true;
  };
  const historyChallans = challans.filter(c => inHistRange(c.dispatchTime || c.createdAt));
  const historyOrders = orders.filter(o => inHistRange(o.deliveryDate || o.createdAt));

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  async function handleRequestBill() {
    setBillBusy(true);
    setBillMsg('');
    try {
      await downloadAccountStatement({
        customerName: challans.find(c => c.clientName)?.clientName ?? '',
        outstanding: ledger.outstanding,
        creditLimit: ledger.creditLimit,
        entries: ledger.entries,
        fromDate: histFrom || undefined,
        toDate: histTo || undefined,
      });
      await api.post('/me/bill-request', {
        fromDate: histFrom || undefined,
        toDate: histTo || undefined,
      });
      setBillMsg('Statement downloaded and your plant has been notified.');
    } catch (err) {
      setBillMsg(err instanceof Error ? err.message : 'Could not complete the request.');
    } finally {
      setBillBusy(false);
    }
  }

  // Grades the chosen plant actually offers (from the directory), used to limit
  // the grade dropdown and softly warn if a pre-filled grade isn't on their menu.
  const selectedPlantEntry = plantDir.find(p => p.id === selectedPlantId) ?? null;
  const plantGrades = (selectedPlantEntry?.grades ?? []).filter(Boolean);
  // Order the plant's grades by the canonical scale for a tidy dropdown; if the
  // plant lists none, fall back to the full grade list so ordering still works.
  const gradeOptions = plantGrades.length
    ? [...GRADES.filter(g => plantGrades.includes(g)), ...plantGrades.filter(g => !GRADES.includes(g))]
    : GRADES;
  // A soft warning only: the customer keeps their choice, the plant confirms.
  const gradeNotOffered = !!form.grade && plantGrades.length > 0 && !plantGrades.includes(form.grade);
  // Sensible single-order volume guidance. There is no per-plant capacity field,
  // so these are soft, non-blocking hints about what a plant can realistically
  // deliver in one go — the order still submits at any positive quantity.
  const qtyNum = Number(form.quantity);
  const qtyHasValue = form.quantity !== '' && Number.isFinite(qtyNum) && qtyNum > 0;
  const qtyWarning: 'small' | 'large' | null = qtyHasValue
    ? (qtyNum < TYPICAL_MIN_M3 ? 'small' : qtyNum > TYPICAL_MAX_M3 ? 'large' : null)
    : null;

  // Active-orders table (My Orders page): pending/approved pipeline with the full
  // edit / reorder / cancel controls.
  function renderActiveOrdersTable(list: Order[]) {
    return (
      <Card>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <ClipboardList size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
            No active orders — tap “Place Order” to get started
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Order No', 'Plant', 'Grade', 'Qty (m³)', 'Delivery Date', 'Site', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue)', fontSize: 13 }}>{o.orderNo}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text)', fontSize: 12.5 }}>
                      {o.plantName || '—'}
                      {o.plantCode && <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}>{o.plantCode}</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{o.grade}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text)', fontWeight: 700 }}>{parseFloat(o.quantity).toFixed(1)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>{o.deliveryDate || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>{o.siteName || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge status={o.status} />
                      {o.status === 'rejected' && o.rejectionReason && (
                        <div style={{ marginTop: 4, color: 'var(--red)', fontSize: 11, maxWidth: 180 }}>
                          {o.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {['pending', 'pending_approval', 'approved', 'rejected'].includes(o.status) && (
                          <button onClick={() => editOrder(o)} title="Edit order" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(56,189,248,.12)',
                            color: 'var(--blue)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 7,
                            padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>
                            <Pencil size={13} /> Edit
                          </button>
                        )}
                        <button onClick={() => reorder(o)} title="Reorder" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, background: 'color-mix(in srgb, var(--gold) 14%, transparent)',
                          color: 'var(--gold)', border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', borderRadius: 7,
                          padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}>
                          <RotateCcw size={13} /> Reorder
                        </button>
                        {CANCELLABLE_STATUSES.includes(o.status as typeof CANCELLABLE_STATUSES[number]) && (() => {
                          const locked = isCancelLocked(o);
                          const lockTitle = `Locked — within ${CANCEL_CUTOFF_MINUTES} min of delivery. Contact the plant.`;
                          return (
                            <>
                              <button onClick={() => openReschedule(o)} disabled={locked} title={locked ? lockTitle : 'Reschedule delivery'} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(56,189,248,.10)',
                                color: 'var(--blue)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 7,
                                padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: locked ? 'not-allowed' : 'pointer',
                                opacity: locked ? 0.45 : 1,
                              }}>
                                <CalendarClock size={13} /> Reschedule
                              </button>
                              <button onClick={() => cancelOrder(o)} disabled={locked || cancelingId === o.id} title={locked ? lockTitle : 'Cancel order'} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,.12)',
                                color: 'var(--red)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 7,
                                padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: locked ? 'not-allowed' : cancelingId === o.id ? 'wait' : 'pointer',
                                opacity: locked || cancelingId === o.id ? (locked ? 0.45 : 0.6) : 1,
                              }}>
                                <Ban size={13} /> {cancelingId === o.id ? 'Canceling…' : 'Cancel'}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  // Read-only order-history table (Deliveries page) with a one-tap reorder.
  function renderOrdersHistoryTable(list: Order[]) {
    return (
      <Card>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <ClipboardList size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
            No orders in this date range
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Order No', 'Plant', 'Grade', 'Qty (m³)', 'Delivery Date', 'Site', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue)', fontSize: 13 }}>{o.orderNo}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text)', fontSize: 12.5 }}>
                      {o.plantName || '—'}
                      {o.plantCode && <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}>{o.plantCode}</span>}
                    </td>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  // Live-deliveries card: map + in-transit truck cards for dispatched challans.
  function renderLiveDeliveries() {
    if (dispatchedChallans.length === 0) return null;
    return (
      <Card style={{ marginBottom: 16, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Navigation size={17} style={{ color: 'var(--green)' }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Live Transit Mixer Tracking</h3>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--green) 25%, transparent)' }} />
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          Tracking your in-transit mixers in real time — route from plant to your site. Distance &amp; ETA are estimates.
        </p>
        {(() => {
          const markers: DeliveryMarker[] = dispatchedChallans.map(c => {
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
          return <LiveDeliveryMap markers={markers} height={460} />;
        })()}
        <div style={{ display: 'grid', gap: 12 }}>
          {dispatchedChallans.map(c => {
            const live = livePositions[c.id];
            const dist = formatDistance(live?.distanceM);
            const eta = formatEta(live?.distanceM, live?.speed);
            return (
              <div key={c.id} style={{
                border: '1px solid var(--line)', borderRadius: 13, padding: '14px 16px',
                background: 'var(--chip-bg)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Truck size={12} style={{ color: 'var(--gold)' }} /> {c.vehicleNo || 'Mixer'}
                  </span>
                  <span>Driver: <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{c.driverName || '—'}</strong></span>
                  <span>Status: <StatusBadge status={live?.status || c.status} /></span>
                  {live?.updatedAt && (
                    <span>Updated {new Date(live.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  )}
                </div>
                <LiveTimeline status={c.status} hasLive={!!live} />
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // Full challan history table (proof photo, receipt download, trip timing rows).
  // Shared by the My Orders "today" list and the Deliveries history list.
  function renderChallanTable(list: Challan[], emptyLabel: string) {
    return (
      <Card>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <Truck size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
            {emptyLabel}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Challan No', 'Grade', 'Qty (m³)', 'Vehicle', 'Driver', 'Dispatch Time', 'Status', 'Proof', 'Receipt'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(c => {
                  const timing = computeTripTiming(c, idleConfig);
                  const hasTiming = !!(c.siteArrivalTime || c.siteReleaseTime);
                  return (
                  <Fragment key={c.id}>
                  <tr style={{ borderBottom: hasTiming ? 'none' : '1px solid var(--line)' }}>
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
                  {hasTiming && (
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <td colSpan={9} style={{ padding: '0 14px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                          {c.siteArrivalTime && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)' }}>
                              <MapPin size={12} style={{ color: 'var(--blue)' }} /> Arrived
                              <strong style={{ color: 'var(--blue)', fontWeight: 700 }}>{new Date(c.siteArrivalTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
                            </span>
                          )}
                          {c.siteReleaseTime && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)' }}>
                              <Navigation size={12} style={{ color: 'var(--gold)' }} /> Left site
                              <strong style={{ color: 'var(--gold)', fontWeight: 700 }}>{new Date(c.siteReleaseTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
                            </span>
                          )}
                          {timing.siteMin != null && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)' }}>
                              <Clock size={12} style={{ color: 'var(--muted)' }} /> Time at site
                              <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{formatDuration(timing.siteMin)}</strong>
                            </span>
                          )}
                          {timing.billableIdleMin != null && timing.billableIdleMin > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 10%, transparent)', padding: '3px 10px', borderRadius: 8, fontWeight: 700 }}>
                              <AlertTriangle size={12} /> Idle {formatDuration(timing.billableIdleMin)}
                              {timing.idleCharge != null && <span>· ₹{timing.idleCharge.toLocaleString('en-IN')}</span>}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>
            {pageMeta.title}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
            {pageMeta.sub}
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--chip-bg)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all .18s',
            background: tab === t.key ? 'linear-gradient(135deg,var(--surface),var(--panel2))' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--muted)',
            boxShadow: tab === t.key ? '0 2px 8px rgba(var(--shadow-rgb),.25)' : 'none',
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
      ) : tab === 'today' ? (
        <>
          {renderLiveDeliveries()}
          {renderActiveOrdersTable(activeOrders)}
          <div style={{ marginTop: 20 }}>
            <SectionHeading icon={Truck} title="Today’s Challans" hint={`${todayChallans.length} dispatched today`} />
            {renderChallanTable(todayChallans, 'No challans dispatched today yet')}
          </div>
          <div style={{ marginTop: 24 }}>
            <SectionHeading icon={Repeat} title="Recurring Orders" hint="Auto-placed on your schedule" />
            <RecurringTab
              recurring={recurring}
              busyId={recBusyId}
              onNew={openRecModal}
              onEdit={r => openRecModal(r)}
              onToggle={toggleRecurring}
              onDelete={deleteRecurring}
            />
          </div>
        </>
      ) : tab === 'deliveries' ? (
        <>
          <Card style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>From</label>
                <input type="date" value={histFrom} max={histTo || undefined} onChange={e => setHistFrom(e.target.value)} style={{
                  background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px',
                  color: 'var(--text)', fontSize: 13, colorScheme: 'dark',
                }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>To</label>
                <input type="date" value={histTo} min={histFrom || undefined} onChange={e => setHistTo(e.target.value)} style={{
                  background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px',
                  color: 'var(--text)', fontSize: 13, colorScheme: 'dark',
                }} />
              </div>
              {(histFrom || histTo) && (
                <button onClick={() => { setHistFrom(''); setHistTo(''); }} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--chip-bg)', color: 'var(--muted)',
                  border: '1px solid var(--line)', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                }}>
                  <X size={13} /> Clear
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                {historyChallans.length} deliveries · {historyOrders.length} orders
              </span>
            </div>
          </Card>
          <SectionHeading icon={Truck} title="Delivery Challans" />
          {renderChallanTable(historyChallans, histFrom || histTo ? 'No deliveries in this date range' : 'No challans found')}
          <div style={{ marginTop: 24 }}>
            <SectionHeading icon={ClipboardList} title="Order History" />
            {renderOrdersHistoryTable(historyOrders)}
          </div>
        </>
      ) : (
        /* Financial Statement tab */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Card style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Outstanding Amount</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: ledger.outstanding > 0 ? 'var(--red)' : 'var(--green)' }}>
                {fmt(ledger.outstanding)}
              </div>
            </Card>
            <Card style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Credit Limit</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{fmt(ledger.creditLimit)}</div>
              {ledger.creditLimit > 0 && (
                <>
                  <div style={{ height: 6, borderRadius: 4, background: 'var(--chip-bg)', marginTop: 10, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${Math.min(100, Math.max(0, (ledger.outstanding / ledger.creditLimit) * 100))}%`,
                      background: ledger.outstanding > ledger.creditLimit ? 'var(--red)' : 'var(--gold)',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                    {fmt(Math.max(0, ledger.creditLimit - ledger.outstanding))} credit available
                  </div>
                </>
              )}
            </Card>
          </div>

          <Card style={{ marginBottom: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Need a formal bill?</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                Download your account statement and notify the plant to raise an invoice.
              </div>
              {billMsg && (
                <div style={{ fontSize: 12, color: billMsg.includes('notified') ? 'var(--green)' : 'var(--red)', marginTop: 6, fontWeight: 600 }}>
                  {billMsg}
                </div>
              )}
            </div>
            <button onClick={handleRequestBill} disabled={billBusy} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, border: 'none',
              cursor: billBusy ? 'wait' : 'pointer', fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              color: '#111827', boxShadow: '0 10px 26px color-mix(in srgb, var(--gold) 20%, transparent)',
              opacity: billBusy ? 0.7 : 1,
            }}>
              <FileText size={16} /> {billBusy ? 'Preparing…' : 'Request for Bill'}
            </button>
          </Card>

          <SectionHeading icon={Receipt} title="Challan Summary" hint="Quantities billed against your account" />
          <Card style={{ marginBottom: 16 }}>
            {challans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                <Receipt size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
                No challans yet
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Challan No', 'Qty (m³)', 'Date', 'Receiver / Site'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Qty (m³)' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {challans.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>{c.challanNo}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: 'var(--text)', fontWeight: 700 }}>{parseFloat(c.quantity).toFixed(1)}</td>
                        <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>
                          {new Date(c.dispatchTime || c.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text)', fontSize: 12.5 }}>{c.siteName || c.clientName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <SectionHeading icon={TrendingUp} title="Billing Ledger" />
          <Card>
            {ledger.entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                <Receipt size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
                No ledger entries found
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
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
                      <tr key={e.id} style={{ borderBottom: '1px solid var(--line)' }}>
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
              </div>
            )}
          </Card>
        </>
      )}

      {/* Place Order modal */}
      {modalOpen && (
        <div
          onClick={() => !saving && setModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={submitOrder}
            style={{
              width: '100%', maxWidth: 500,
              background: 'var(--surface)',
              border: '1px solid var(--line)', borderRadius: 18, padding: 24,
              boxShadow: '0 24px 60px rgba(var(--shadow-rgb),.5)', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{editingOrderId != null ? 'Update Order' : 'Place New Order'}</h3>
                {selectedPlant && (
                  <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--gold)', fontWeight: 600 }}>From {selectedPlant}</div>
                )}
              </div>
              <button type="button" onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Plant</label>
              <select
                value={selectedPlantId ?? ''}
                onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setSelectedPlantId(id);
                  setSelectedPlant(id ? (plantDir.find(p => p.id === id)?.name ?? null) : null);
                  if (id) setFieldErrors(fe => ({ ...fe, plant: undefined }));
                }}
                style={fieldErrors.plant ? inputErrorStyle : inputStyle}
              >
                <option value="">Select a plant…</option>
                {/* Keep the handoff-selected plant available even if the
                    directory is still loading or excludes it. */}
                {selectedPlantId != null && !plantDir.some(p => p.id === selectedPlantId) && selectedPlant && (
                  <option value={selectedPlantId}>{selectedPlant}</option>
                )}
                {plantDir.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ''}{p.plantCode ? ` (${p.plantCode})` : ''}</option>
                ))}
              </select>
              <FieldError msg={fieldErrors.plant} />
              {/* Pin the selected plant as the customer's default, so it
                  pre-selects next time (ahead of the last-ordered heuristic).
                  Only offered for orderable directory plants. */}
              {selectedPlantId != null && plantDir.some(p => p.id === selectedPlantId) && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={togglePin}
                    disabled={pinBusy}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', padding: 0,
                      cursor: pinBusy ? 'default' : 'pointer',
                      fontSize: 12.5, fontWeight: 600,
                      color: preferredPlantId === selectedPlantId ? 'var(--gold)' : 'var(--muted)',
                    }}
                  >
                    <Star size={14} fill={preferredPlantId === selectedPlantId ? 'var(--gold)' : 'none'} />
                    {preferredPlantId === selectedPlantId ? 'Default plant — tap to unpin' : 'Pin as my default plant'}
                  </button>
                  {pinError && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{pinError}</div>}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Concrete Grade</label>
                <select value={form.grade} onChange={e => { setForm(f => ({ ...f, grade: e.target.value })); if (e.target.value) setFieldErrors(fe => ({ ...fe, grade: undefined })); }} style={fieldErrors.grade ? inputErrorStyle : inputStyle}>
                  <option value="">Select grade…</option>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  {/* Keep a pre-filled (e.g. reordered) grade selectable even if
                      this plant no longer lists it, paired with a soft warning. */}
                  {gradeNotOffered && <option value={form.grade}>{form.grade}</option>}
                </select>
                <FieldError msg={fieldErrors.grade} />
                {!fieldErrors.grade && plantGrades.length > 0 && !gradeNotOffered && (
                  <FieldHint text={`Offered here: ${plantGrades.join(', ')}`} />
                )}
                {gradeNotOffered && (
                  <FieldHint tone="warn" text={`${selectedPlant ?? 'This plant'} may not offer ${form.grade} — they'll confirm availability.`} />
                )}
              </div>
              <div>
                <label style={labelStyle}>Quantity (m³)</label>
                <input type="number" min="0" step="0.5" value={form.quantity} onChange={e => { setForm(f => ({ ...f, quantity: e.target.value })); if (Number(e.target.value) > 0) setFieldErrors(fe => ({ ...fe, quantity: undefined })); }} placeholder="e.g. 10" style={fieldErrors.quantity ? inputErrorStyle : inputStyle} />
                <FieldError msg={fieldErrors.quantity} />
                {!fieldErrors.quantity && qtyWarning === 'small' && (
                  <FieldHint tone="warn" text={`Below ${TYPICAL_MIN_M3} m³ is a partial truckload — minimum-load charges may apply.`} />
                )}
                {!fieldErrors.quantity && qtyWarning === 'large' && (
                  <FieldHint tone="warn" text={`Over ${TYPICAL_MAX_M3} m³ is a large pour — the plant may split it across the day and will confirm scheduling.`} />
                )}
                {!fieldErrors.quantity && qtyHasValue && qtyWarning === null && (
                  <FieldHint text={`Typical single order: ${TYPICAL_MIN_M3}–${TYPICAL_MAX_M3} m³.`} />
                )}
              </div>
              <div>
                <label style={labelStyle}>Delivery Date *</label>
                <input type="date" value={form.deliveryDate} onChange={e => { setForm(f => ({ ...f, deliveryDate: e.target.value })); if (e.target.value) setFieldErrors(fe => ({ ...fe, deliveryDate: undefined })); }} style={fieldErrors.deliveryDate ? inputErrorStyle : inputStyle} />
                <FieldError msg={fieldErrors.deliveryDate} />
              </div>
              <div>
                <label style={labelStyle}>Delivery Time *</label>
                <input type="time" value={form.deliveryTime} onChange={e => { setForm(f => ({ ...f, deliveryTime: e.target.value })); if (e.target.value) setFieldErrors(fe => ({ ...fe, deliveryTime: undefined })); }} style={fieldErrors.deliveryTime ? inputErrorStyle : inputStyle} />
                <FieldError msg={fieldErrors.deliveryTime} />
              </div>
            </div>

            {/* Site contact — who the crew calls on arrival. Optional; the plant
                confirms these details when scheduling the pour. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div>
                <label style={labelStyle}>Site Contact Person *</label>
                <input value={form.contactPerson} onChange={e => { setForm(f => ({ ...f, contactPerson: e.target.value })); if (e.target.value.trim()) setFieldErrors(fe => ({ ...fe, contactPerson: undefined })); }} placeholder="Name at delivery site" style={fieldErrors.contactPerson ? inputErrorStyle : inputStyle} />
                <FieldError msg={fieldErrors.contactPerson} />
              </div>
              <div>
                <label style={labelStyle}>Contact Number *</label>
                <input value={form.contactNumber} onChange={e => { setForm(f => ({ ...f, contactNumber: e.target.value })); if (e.target.value.trim()) setFieldErrors(fe => ({ ...fe, contactNumber: undefined })); }} placeholder="Phone at site" style={fieldErrors.contactNumber ? inputErrorStyle : inputStyle} />
                <FieldError msg={fieldErrors.contactNumber} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Site Name *</label>
              <input value={form.siteName} onChange={e => { setForm(f => ({ ...f, siteName: e.target.value })); if (e.target.value.trim()) setFieldErrors(fe => ({ ...fe, siteName: undefined })); }} placeholder="e.g. Tower B Foundation" style={fieldErrors.siteName ? inputErrorStyle : inputStyle} />
              <FieldError msg={fieldErrors.siteName} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Delivery Site Address *</label>
              <textarea value={form.siteAddress} onChange={e => { setForm(f => ({ ...f, siteAddress: e.target.value })); if (e.target.value.trim()) setFieldErrors(fe => ({ ...fe, siteAddress: undefined })); }} rows={2} placeholder="Full delivery address" style={{ ...(fieldErrors.siteAddress ? inputErrorStyle : inputStyle), resize: 'vertical' }} />
              <FieldError msg={fieldErrors.siteAddress} />
            </div>

            {/* Pin the exact pour location — optional, but powers live tracking
                when provided. */}
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Pin Delivery Location on Map *</label>
              <LocationPicker
                value={Number(form.latitude) && Number(form.longitude) ? { lat: Number(form.latitude), lng: Number(form.longitude) } as LatLng : null}
                onChange={(p) => { setForm(f => ({ ...f, latitude: p ? String(p.lat) : '', longitude: p ? String(p.lng) : '' })); if (p) setFieldErrors(fe => ({ ...fe, location: undefined })); }}
              />
              <FieldError msg={fieldErrors.location} />
            </div>

            <div style={{ marginTop: 14 }}>
              <SitePicker sites={sites} value={form.siteId} onChange={id => {
                setForm(f => ({ ...f, siteId: id }));
                // Prefill address + pin from the chosen saved site for convenience.
                const s = sites.find(x => String(x.id) === id);
                if (s) setForm(f => ({
                  ...f, siteId: id,
                  siteName: f.siteName || s.name,
                  siteAddress: f.siteAddress || s.address || '',
                  latitude: (Number(s.latitude) ? String(s.latitude) : f.latitude),
                  longitude: (Number(s.longitude) ? String(s.longitude) : f.longitude),
                }));
              }} onCreate={createSite} />
            </div>

            {/* Payment + PO reference. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div>
                <label style={labelStyle}>Payment Type *</label>
                <select value={form.paymentType} onChange={e => { setForm(f => ({ ...f, paymentType: e.target.value })); setFieldErrors(fe => ({ ...fe, paymentType: e.target.value ? undefined : fe.paymentType, poNumber: e.target.value !== 'Credit' ? undefined : fe.poNumber })); }} style={fieldErrors.paymentType ? inputErrorStyle : inputStyle}>
                  <option value="">Select…</option>
                  {PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <FieldError msg={fieldErrors.paymentType} />
              </div>
              <div>
                <label style={labelStyle}>PO Number {form.paymentType === 'Credit' ? '*' : '(if required)'}</label>
                <input value={form.poNumber} onChange={e => { setForm(f => ({ ...f, poNumber: e.target.value })); if (e.target.value.trim()) setFieldErrors(fe => ({ ...fe, poNumber: undefined })); }} placeholder="Purchase order ref" style={fieldErrors.poNumber ? inputErrorStyle : inputStyle} />
                <FieldError msg={fieldErrors.poNumber} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Notes / Site details *</label>
              <textarea value={form.notes} onChange={e => { setForm(f => ({ ...f, notes: e.target.value })); if (e.target.value.trim()) setFieldErrors(fe => ({ ...fe, notes: undefined })); }} rows={3} placeholder="Special instructions…" style={{ ...(fieldErrors.notes ? inputErrorStyle : inputStyle), resize: 'vertical' }} />
              <FieldError msg={fieldErrors.notes} />
            </div>

            {/* Optional site photo — helps the plant plan access/placement. */}
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Site Photo (optional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: photoUploading ? 'wait' : 'pointer',
                  padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)',
                  border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
                }}>
                  <Camera size={15} /> {photoUploading ? 'Uploading…' : form.sitePhoto ? 'Replace photo' : 'Add photo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={photoUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadSitePhoto(f); e.target.value = ''; }} />
                </label>
                {form.sitePhoto && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--green)', fontSize: 12.5, fontWeight: 700 }}>
                    <CheckCircle2 size={14} /> Photo attached
                  </span>
                )}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>
              <input type="checkbox" checked={form.pumpRequired} onChange={e => { setForm(f => ({ ...f, pumpRequired: e.target.checked })); if (!e.target.checked) setFieldErrors(fe => ({ ...fe, pumpLineLength: undefined })); }} />
              Concrete pump required
            </label>

            {form.pumpRequired && (
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Pump Line Length (metres)</label>
                <input type="number" min="0" step="1" value={form.pumpLineLength} onChange={e => { setForm(f => ({ ...f, pumpLineLength: e.target.value })); if (e.target.value.trim()) setFieldErrors(fe => ({ ...fe, pumpLineLength: undefined })); }} placeholder="e.g. 30" style={fieldErrors.pumpLineLength ? inputErrorStyle : inputStyle} />
                <FieldError msg={fieldErrors.pumpLineLength} />
              </div>
            )}

            {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginTop: 16 }}>
                <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                <span style={{ color: 'var(--red)', fontSize: 13 }}>{formError}</span>
              </div>
            )}

            {editingOrderId == null && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', marginTop: 16 }}>
                <Info size={14} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text)' }}>Cancellation policy:</strong> You can cancel or reschedule this order free of charge up to {CANCEL_CUTOFF_MINUTES} minutes before the scheduled delivery time. After that the order is locked in and you'll need to contact the plant directly.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button type="button" onClick={() => !saving && setModalOpen(false)} style={{
                flex: 1, padding: '11px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)',
              }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{
                flex: 1, padding: '11px', borderRadius: 11, border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800, color: '#111827',
                background: saving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              }}>
                {saving ? 'Saving…' : editingOrderId != null ? 'Update Order' : 'Place Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cancel-order modal: pick a reason, then confirm. */}
      {cancelTarget && (
        <div
          onClick={() => cancelingId == null && setCancelTarget(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
            width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 24px 60px rgba(var(--shadow-rgb),.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Ban size={18} style={{ color: 'var(--red)' }} />
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Cancel order {cancelTarget.orderNo}</h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              This can't be undone. Please tell the plant why you're cancelling so they can plan around it.
            </p>

            <label style={labelStyle}>Reason for cancellation</label>
            <select
              value={cancelReason}
              onChange={e => { setCancelReason(e.target.value); setCancelError(''); }}
              style={inputStyle}
            >
              <option value="">Select a reason…</option>
              {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {cancelReason === 'Other' && (
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Please describe</label>
                <textarea
                  value={cancelOther}
                  onChange={e => { setCancelOther(e.target.value); setCancelError(''); }}
                  rows={2}
                  placeholder="Tell us a bit more…"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            )}

            {cancelError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginTop: 14 }}>
                <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                <span style={{ color: 'var(--red)', fontSize: 13 }}>{cancelError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => cancelingId == null && setCancelTarget(null)} style={{
                flex: 1, padding: '11px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)',
              }}>
                Keep order
              </button>
              <button type="button" onClick={confirmCancel} disabled={cancelingId != null} style={{
                flex: 1, padding: '11px', borderRadius: 11, border: '1px solid rgba(239,68,68,.35)',
                cursor: cancelingId != null ? 'wait' : 'pointer', fontSize: 14, fontWeight: 800,
                background: 'rgba(239,68,68,.12)', color: 'var(--red)', opacity: cancelingId != null ? 0.6 : 1,
              }}>
                {cancelingId != null ? 'Canceling…' : 'Cancel order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal: pick a new delivery date/time. */}
      {reschedTarget && (
        <div
          onClick={() => !reschedSaving && setReschedTarget(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
            width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 24px 60px rgba(var(--shadow-rgb),.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <CalendarClock size={18} style={{ color: 'var(--blue)' }} />
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Reschedule {reschedTarget.orderNo}</h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Pick a new delivery slot. If this order was already approved, the plant will re-confirm the new date.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Delivery Date</label>
                <input type="date" value={reschedDate} onChange={e => { setReschedDate(e.target.value); setReschedError(''); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Delivery Time (optional)</label>
                <input type="time" value={reschedTime} onChange={e => { setReschedTime(e.target.value); setReschedError(''); }} style={inputStyle} />
              </div>
            </div>

            {reschedError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginTop: 14 }}>
                <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                <span style={{ color: 'var(--red)', fontSize: 13 }}>{reschedError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => !reschedSaving && setReschedTarget(null)} style={{
                flex: 1, padding: '11px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)',
              }}>
                Cancel
              </button>
              <button type="button" onClick={confirmReschedule} disabled={reschedSaving} style={{
                flex: 1, padding: '11px', borderRadius: 11, border: 'none',
                cursor: reschedSaving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800, color: '#111827',
                background: reschedSaving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              }}>
                {reschedSaving ? 'Saving…' : 'Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof-of-delivery photo modal */}
      {proof.open && (
        <div
          onClick={() => setProof(p => ({ ...p, open: false }))}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560,
              background: 'var(--surface)',
              border: '1px solid var(--line)', borderRadius: 18, padding: 24,
              boxShadow: '0 24px 60px rgba(var(--shadow-rgb),.5)', maxHeight: '90vh', overflowY: 'auto',
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
            position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={submitRecurring}
            style={{
              width: '100%', maxWidth: 500,
              background: 'var(--surface)',
              border: '1px solid var(--line)', borderRadius: 18, padding: 24,
              boxShadow: '0 24px 60px rgba(var(--shadow-rgb),.5)', maxHeight: '90vh', overflowY: 'auto',
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
                background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)',
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
                background: 'var(--chip-bg)', opacity: r.active ? 1 : 0.6,
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
  width: '100%', padding: '10px 12px', background: 'var(--chip-bg)',
  border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle, border: '1px solid color-mix(in srgb, var(--red) 55%, transparent)',
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 12, color: 'var(--red)' }}>
      <AlertCircle size={12} />
      <span>{msg}</span>
    </div>
  );
}

// Non-blocking guidance under a field: a neutral muted hint, or an amber soft
// warning. Unlike FieldError it never gates submission — it only informs.
function FieldHint({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' }) {
  const color = tone === 'warn' ? 'var(--gold)' : 'var(--muted)';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 5, fontSize: 11.5, color, lineHeight: 1.35 }}>
      {tone === 'warn'
        ? <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        : <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span>{text}</span>
    </div>
  );
}
