import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, X, Printer, Check, Truck, StickyNote, Camera, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { Link } from 'wouter';
import { api, type Challan, type Order, type Vehicle, type Driver, type Client, type Site, type IdleConfig } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';
import { useVarianceTolerance, isWithinTolerance } from '@/lib/variance';
import { computeTripTiming, formatDuration } from '@/lib/tripTiming';

const GRADES = ['M10','M15','M20','M25','M30','M35','M40','M45','M50','M55','M60'];

export default function Dispatch() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<{
    orderId: string; clientId: string; siteId: string; vehicleId: string;
    driverId: string; grade: string; quantity: string; pumpRequired: boolean; notes: string;
  }>({ orderId: '', clientId: '', siteId: '', vehicleId: '', driverId: '', grade: '', quantity: '', pumpRequired: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoView, setPhotoView] = useState<{ challanNo: string; srcs: string[]; loading: boolean } | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [photoZoom, setPhotoZoom] = useState(false);
  const touchRef = useRef<{ x: number; y: number; t: number; multi: boolean } | null>(null);
  const swipedRef = useRef(false);
  const lastTapRef = useRef(0);

  const [idleConfig, setIdleConfig] = useState<IdleConfig | undefined>(undefined);

  const tolerance = useVarianceTolerance();
  const { subscribe } = useSSE();

  // Idle config (admin-only, best-effort) drives the billable-idle figure shown
  // in the trip-timing column; falls back to the default free window otherwise.
  useEffect(() => {
    let cancelled = false;
    api.get<IdleConfig>('/admin/idle-settings')
      .then(cfg => { if (!cancelled) setIdleConfig({ freeMin: cfg.freeMin, ratePerHour: cfg.ratePerHour }); })
      .catch(() => { /* non-admin or unavailable — use defaults */ });
    return () => { cancelled = true; };
  }, []);

  async function viewProof(ch: Challan) {
    setPhotoIdx(0);
    setPhotoZoom(false);
    setPhotoView({ challanNo: ch.challanNo, srcs: [], loading: true });
    try {
      const full = await api.get<Challan>(`/challans/${ch.id}`);
      setPhotoView({ challanNo: ch.challanNo, srcs: full.proofPhotos ?? [], loading: false });
    } catch {
      setPhotoView({ challanNo: ch.challanNo, srcs: [], loading: false });
    }
  }

  const load = useCallback(() => { api.get<Challan[]>('/challans').then(setChallans); }, []);

  const loadAll = useCallback(() => {
    load();
    api.get<Order[]>('/orders').then(o => setOrders(o.filter(x => x.status === 'pending' || x.status === 'in_progress')));
    api.get<Vehicle[]>('/vehicles').then(v => setVehicles(v.filter(x => x.status === 'active')));
    api.get<Driver[]>('/drivers').then(d => setDrivers(d.filter(x => x.isActive)));
    api.get<Client[]>('/clients').then(setClients);
  }, [load]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const unsub1 = subscribe('challan.created', () => { load(); });
    const unsub2 = subscribe('challan.updated', (data: unknown) => {
      const updated = data as Challan;
      setChallans(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    });
    const unsub3 = subscribe('reconnect', () => { loadAll(); });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [subscribe, load, loadAll]);

  useEffect(() => {
    if (!photoView || photoView.loading || photoView.srcs.length <= 1) return;
    const n = photoView.srcs.length;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setPhotoIdx(i => (i + 1) % n);
      else if (e.key === 'ArrowLeft') setPhotoIdx(i => (i - 1 + n) % n);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoView]);

  async function loadSites(clientId: string) {
    if (!clientId) return setSites([]);
    setSites(await api.get<Site[]>(`/clients/${clientId}/sites`));
  }

  function openModal(order?: Order) {
    if (order) {
      setForm({ orderId: String(order.id), clientId: String(order.clientId), siteId: order.siteId ? String(order.siteId) : '', vehicleId: '', driverId: '', grade: order.grade, quantity: order.quantity, pumpRequired: order.pumpRequired, notes: '' });
      loadSites(String(order.clientId));
    } else {
      setForm({ orderId: '', clientId: '', siteId: '', vehicleId: '', driverId: '', grade: '', quantity: '', pumpRequired: false, notes: '' });
      setSites([]);
    }
    setModal(true); setError('');
  }

  async function save() {
    setSaving(true); setError('');
    try {
      await api.post('/challans', {
        orderId: form.orderId ? +form.orderId : null,
        clientId: +form.clientId,
        siteId: form.siteId ? +form.siteId : null,
        vehicleId: form.vehicleId ? +form.vehicleId : null,
        driverId: form.driverId ? +form.driverId : null,
        grade: form.grade, quantity: +form.quantity,
        pumpRequired: form.pumpRequired, notes: form.notes,
      });
      api.get<Order[]>('/orders').then(o => setOrders(o.filter(x => x.status === 'pending' || x.status === 'in_progress')));
      setModal(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function markDelivered(ch: Challan) {
    await api.put(`/challans/${ch.id}`, { status: 'delivered' });
  }

  const filtered = challans.filter(ch => {
    const matchSearch = ch.challanNo.toLowerCase().includes(search.toLowerCase()) ||
      (ch.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
      (ch.vehicleNo || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || ch.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function variance(ch: Challan): number | null {
    if (ch.deliveredQuantity == null) return null;
    return parseFloat(ch.deliveredQuantity) - parseFloat(ch.quantity);
  }

  const statusColor = (s: string) => ({ pending: 'var(--gold)', dispatched: 'var(--blue)', delivered: 'var(--green)', cancelled: 'var(--red)' }[s] || 'var(--muted)');
  const statusBg = (s: string) => ({ pending: 'color-mix(in srgb, var(--gold) 12%, transparent)', dispatched: 'rgba(56,189,248,.12)', delivered: 'rgba(34,197,94,.12)', cancelled: 'rgba(239,68,68,.12)' }[s] || 'rgba(159,176,199,.12)');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'var(--chip-bg)', border: '1px solid var(--line)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Dispatch</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>{challans.filter(c => c.status === 'dispatched').length} on road · {challans.length} total challans</p>
        </div>
        <button onClick={() => openModal()} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,#86efac,var(--green) 48%,var(--green-dark))',
          color: '#052e16', fontWeight: 800, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
        }}><Plus size={15} /> Create Challan</button>
      </div>

      {/* Active orders ready to dispatch */}
      {orders.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Pending Orders — Ready to Dispatch</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {orders.slice(0, 5).map(o => (
              <div key={o.id} style={{
                padding: '10px 14px', background: 'color-mix(in srgb, var(--gold) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)',
                borderRadius: 10, cursor: 'pointer', minWidth: 180,
              }} onClick={() => openModal(o)}>
                <div style={{ fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace', fontSize: 12 }}>{o.orderNo}</div>
                <div style={{ fontSize: 12, fontWeight: 600, margin: '3px 0' }}>{o.clientName}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.grade} · {o.quantity} m³ {o.pumpRequired ? '· Pump' : ''}</div>
                <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4, fontWeight: 700 }}>→ Create Challan</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ color: 'var(--muted)', position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search challans…"
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                {['Challan', 'Client', 'Vehicle', 'Driver', 'Grade', 'Planned', 'Delivered', 'Dispatch Time', 'Trip Timing', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ch => (
                <tr key={ch.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '11px 14px', color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>
                    #{ch.challanNo}
                    {ch.notes && (
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 5, maxWidth: 220,
                        color: 'var(--muted)', fontFamily: 'inherit', fontWeight: 500, fontSize: 11, whiteSpace: 'normal',
                      }}>
                        <StickyNote size={11} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
                        <span>{ch.notes}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '11px 14px', fontWeight: 600 }}>{ch.clientName}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Truck size={11} style={{ color: 'var(--blue)' }} />
                      {ch.vehicleNo || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--muted)' }}>{ch.driverName || '—'}</td>
                  <td style={{ padding: '11px 14px' }}><span style={{ padding: '2px 8px', background: 'rgba(56,189,248,.12)', color: 'var(--blue)', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{ch.grade}</span></td>
                  <td style={{ padding: '11px 14px', fontWeight: 700 }}>{ch.quantity} m³</td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: ch.deliveredQuantity != null ? 'var(--green)' : 'var(--muted)' }}>
                    {ch.deliveredQuantity != null ? `${parseFloat(ch.deliveredQuantity).toFixed(1)} m³` : '—'}
                    {(() => {
                      const v = variance(ch);
                      if (v == null || isWithinTolerance(v, parseFloat(ch.quantity), tolerance)) return null;
                      const over = v > 0;
                      return (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', marginLeft: 6,
                          padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                          color: over ? 'var(--blue)' : 'var(--red)',
                          background: over ? 'rgba(56,189,248,.14)' : 'rgba(239,68,68,.14)',
                        }} title={over ? 'Over-delivered vs planned' : 'Short delivery vs planned'}>
                          {over ? '+' : '−'}{Math.abs(v).toFixed(1)}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>
                    {ch.dispatchTime ? new Date(ch.dispatchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const t = computeTripTiming(ch, idleConfig);
                      if (t.travelMin == null && t.siteMin == null) return '—';
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {t.travelMin != null && <div>Travel <span style={{ color: 'var(--text)', fontWeight: 700 }}>{formatDuration(t.travelMin)}</span></div>}
                          {t.siteMin != null && <div>Site <span style={{ color: 'var(--text)', fontWeight: 700 }}>{formatDuration(t.siteMin)}</span></div>}
                          {t.billableIdleMin != null && t.billableIdleMin > 0 && (
                            <div style={{ color: 'var(--gold)', fontWeight: 700 }}>
                              Idle {formatDuration(t.billableIdleMin)}{t.idleCharge != null ? ` · ₹${t.idleCharge.toLocaleString('en-IN')}` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: statusColor(ch.status), background: statusBg(ch.status) }}>
                      {ch.status.charAt(0).toUpperCase() + ch.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ch.status === 'dispatched' && (
                        <button onClick={() => markDelivered(ch)} style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                          background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)',
                          borderRadius: 7, cursor: 'pointer', color: 'var(--green)', fontSize: 11, fontWeight: 700,
                        }}><Check size={11} /> Delivered</button>
                      )}
                      {ch.hasProofPhoto && (
                        <button onClick={() => viewProof(ch)} title="View proof of delivery" style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                          background: 'color-mix(in srgb, var(--gold) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 28%, transparent)',
                          borderRadius: 7, cursor: 'pointer', color: 'var(--gold)', fontSize: 11, fontWeight: 700,
                        }}><Camera size={11} /> Photo</button>
                      )}
                      <Link href={`/challans/${ch.id}/print`}>
                        <button style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                          background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)',
                          borderRadius: 7, cursor: 'pointer', color: 'var(--blue)', fontSize: 11, fontWeight: 700,
                        }}><Printer size={11} /> Print</button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>No challans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Challan Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Create Challan</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {form.orderId && (
                <div style={{ gridColumn: '1/-1', padding: '8px 12px', background: 'color-mix(in srgb, var(--gold) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 15%, transparent)', borderRadius: 8, fontSize: 12, color: 'var(--gold)' }}>
                  Creating challan for Order #{orders.find(o => String(o.id) === form.orderId)?.orderNo}
                </div>
              )}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Client *</label>
                <select value={form.clientId} onChange={e => { setForm(f => ({ ...f, clientId: e.target.value, siteId: '' })); loadSites(e.target.value); }} style={inputStyle}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {sites.length > 0 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Delivery Site</label>
                  <select value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))} style={inputStyle}>
                    <option value="">No specific site</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Grade *</label>
                <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Quantity (m³) *</label>
                <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Vehicle</label>
                <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} style={inputStyle}>
                  <option value="">Select vehicle…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo} ({v.capacity} m³)</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Driver</label>
                <select value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} style={inputStyle}>
                  <option value="">Select driver…</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="pump" checked={form.pumpRequired} onChange={e => setForm(f => ({ ...f, pumpRequired: e.target.checked }))} />
                <label htmlFor="pump" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Pump Required</label>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: 10, background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#86efac,var(--green) 48%,var(--green-dark))', color: '#052e16', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Creating…' : 'Dispatch Challan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof-of-delivery photo viewer */}
      {photoView && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.82)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setPhotoView(null)}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Camera size={16} style={{ color: 'var(--gold)' }} /> Proof of Delivery — #{photoView.challanNo}
              </h3>
              <button onClick={() => setPhotoView(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            {photoView.loading ? (
              <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>Loading photos…</div>
            ) : photoView.srcs.length > 0 ? (
              (() => {
                const n = photoView.srcs.length;
                const cur = Math.min(photoIdx, n - 1);
                const go = (d: number) => { setPhotoZoom(false); setPhotoIdx((cur + d + n) % n); };
                const onTouchStart = (e: React.TouchEvent) => {
                  swipedRef.current = false;
                  const t = e.touches[0];
                  touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), multi: e.touches.length > 1 };
                };
                const onTouchMove = (e: React.TouchEvent) => {
                  if (e.touches.length > 1 && touchRef.current) touchRef.current.multi = true;
                };
                const onTouchEnd = (e: React.TouchEvent) => {
                  const start = touchRef.current;
                  touchRef.current = null;
                  if (!start || start.multi) return;
                  const end = e.changedTouches[0];
                  const dx = end.clientX - start.x;
                  const dy = end.clientY - start.y;
                  const dt = Date.now() - start.t;
                  if (n > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    swipedRef.current = true;
                    go(dx < 0 ? 1 : -1);
                    return;
                  }
                  if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 300) {
                    const now = Date.now();
                    if (now - lastTapRef.current < 300) {
                      swipedRef.current = true;
                      setPhotoZoom(z => !z);
                      lastTapRef.current = 0;
                    } else {
                      lastTapRef.current = now;
                    }
                  }
                };
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {n > 1 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Photo {cur + 1} of {n}</div>
                    )}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={photoView.srcs[cur]} alt={`Proof of delivery ${cur + 1} for ${photoView.challanNo}`}
                        onClick={() => { if (swipedRef.current) { swipedRef.current = false; return; } setPhotoZoom(z => !z); }}
                        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
                        style={{ width: '100%', borderRadius: 10, display: 'block', cursor: 'zoom-in', maxHeight: photoZoom ? 'none' : '60vh', objectFit: 'contain', touchAction: 'pan-y pinch-zoom', userSelect: 'none' }} />
                      {!photoZoom && (
                        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(var(--shadow-rgb),.55)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#fff', pointerEvents: 'none' }}>
                          <ZoomIn size={13} /> Click to zoom
                        </div>
                      )}
                      {n > 1 && (
                        <>
                          <button onClick={() => go(-1)} aria-label="Previous photo"
                            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(var(--shadow-rgb),.6)', border: '1px solid var(--line)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                            <ChevronLeft size={20} />
                          </button>
                          <button onClick={() => go(1)} aria-label="Next photo"
                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(var(--shadow-rgb),.6)', border: '1px solid var(--line)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                            <ChevronRight size={20} />
                          </button>
                        </>
                      )}
                    </div>
                    {n > 1 && (
                      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {photoView.srcs.map((src, i) => (
                          <button key={i} onClick={() => { setPhotoZoom(false); setPhotoIdx(i); }} aria-label={`View photo ${i + 1}`}
                            style={{ flex: '0 0 auto', padding: 0, background: 'none', border: i === cur ? '2px solid var(--gold)' : '2px solid transparent', borderRadius: 8, cursor: 'pointer', lineHeight: 0 }}>
                            <img src={src} alt={`Thumbnail ${i + 1}`}
                              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, opacity: i === cur ? 1 : 0.6, display: 'block' }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>No photo available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
