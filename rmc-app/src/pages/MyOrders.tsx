import { useState, useEffect } from 'react';
import { api, type Order, type Challan, type LedgerEntry } from '@/lib/api';
import { ClipboardList, Truck, Package, AlertCircle, TrendingUp, TrendingDown, Receipt, Plus, X } from 'lucide-react';

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

  useEffect(() => {
    Promise.all([
      api.get<Order[]>('/me/orders'),
      api.get<Challan[]>('/me/challans'),
      api.get<LedgerData>('/me/ledger'),
    ])
      .then(([o, c, l]) => { setOrders(o); setChallans(c); setLedger(l); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
                  {['Order No', 'Grade', 'Qty (m³)', 'Delivery Date', 'Site', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)' }}>{h}</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : tab === 'challans' ? (
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
                  {['Challan No', 'Grade', 'Qty (m³)', 'Vehicle', 'Driver', 'Dispatch Time', 'Status'].map(h => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
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
