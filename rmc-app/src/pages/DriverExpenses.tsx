import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { compressImage, uploadImageToStorage } from '@/lib/imageUpload';
import { useToast } from '@/lib/toast';
import {
  Wallet, Camera, X, Trash2, Clock, CheckCircle, AlertCircle, Plus, IndianRupee, Receipt,
} from 'lucide-react';

const CATEGORIES = ['fuel', 'toll', 'food', 'repair', 'parking', 'loading', 'other'] as const;
type Category = typeof CATEGORIES[number];

interface Expense {
  id: number;
  category: string;
  amount: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reimbursementStatus: 'pending' | 'reimbursed';
  reviewerRemark: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  expenseAt: string;
  createdAt: string;
  hasReceipt: boolean;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending:  { color: 'var(--gold)',  bg: 'color-mix(in srgb, var(--gold) 12%, transparent)', icon: Clock,       label: 'Pending' },
  approved: { color: 'var(--green)', bg: 'rgba(34,197,94,.12)',  icon: CheckCircle, label: 'Approved' },
  rejected: { color: 'var(--red)',   bg: 'rgba(239,68,68,.12)',  icon: AlertCircle, label: 'Rejected' },
};

const CAT_LABEL: Record<Category, string> = {
  fuel: 'Fuel', toll: 'Toll', food: 'Food', repair: 'Repair',
  parking: 'Parking', loading: 'Loading', other: 'Other',
};

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DriverExpenses() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<Category>('fuel');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);

  const load = useCallback(() => {
    return api.get<Expense[]>('/expenses/mine')
      .then(setRows)
      .catch(() => showToast('Could not load your expenses', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function onPickReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setReceipt(await compressImage(file));
    } catch {
      showToast('Could not read that photo', 'error');
    }
  }

  function reset() {
    setCategory('fuel'); setAmount(''); setDescription(''); setReceipt(null);
  }

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      let receiptPath: string | undefined;
      if (receipt) receiptPath = await uploadImageToStorage(receipt, '/expenses/upload-url');

      let gpsLat: number | undefined;
      let gpsLng: number | undefined;
      if (navigator.geolocation) {
        const { requestLocationDisclosure } = await import('@/lib/locationDisclosure');
        const ok = await requestLocationDisclosure();
        if (ok) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => { gpsLat = pos.coords.latitude; gpsLng = pos.coords.longitude; resolve(); },
              () => resolve(),
              { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 },
            );
          });
        }
      }

      await api.post('/expenses', {
        category, amount: amt, description: description.trim() || undefined,
        receiptPhoto: receiptPath, gpsLat, gpsLng,
      });
      showToast('Expense submitted', 'success');
      reset(); setShowForm(false); load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not submit expense', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/expenses/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      showToast('Expense deleted', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete', 'error');
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
            background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)',
          }}>
            <Wallet size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>My Expenses</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Submit and track your claims</div>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={btnPrimary}>
            <Plus size={16} /> New expense
          </button>
        )}
      </div>

      {showForm && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>New expense</div>
            <button onClick={() => { reset(); setShowForm(false); }} style={iconBtn}><X size={18} /></button>
          </div>

          <label style={label}>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: category === c ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'var(--chip-bg)',
                border: category === c ? '1px solid color-mix(in srgb, var(--gold) 55%, transparent)' : '1px solid var(--line)',
                color: category === c ? 'var(--gold)' : 'var(--muted)',
              }}>{CAT_LABEL[c]}</button>
            ))}
          </div>

          <label style={label}>Amount (₹)</label>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <IndianRupee size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
            <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" style={{ ...input, paddingLeft: 34 }} />
          </div>

          <label style={label}>Note (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="What was this for?" style={{ ...input, marginBottom: 14, resize: 'vertical' }} />

          <label style={label}>Receipt (optional)</label>
          {receipt ? (
            <div style={{ position: 'relative', marginBottom: 14, width: 'fit-content' }}>
              <img src={receipt} alt="Receipt" style={{ maxWidth: 160, borderRadius: 10, border: '1px solid var(--line)' }} />
              <button onClick={() => setReceipt(null)} style={{ ...iconBtn, position: 'absolute', top: 4, right: 4, background: 'var(--red)', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <label style={{ ...btnGhost, marginBottom: 14, display: 'inline-flex', cursor: 'pointer' }}>
              <Camera size={16} /> Add receipt photo
              <input type="file" accept="image/*" capture="environment" onChange={onPickReceipt} style={{ display: 'none' }} />
            </label>
          )}

          <button onClick={submit} disabled={saving} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Submitting…' : 'Submit expense'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>
          <Receipt size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>No expenses yet</div>
          <div style={{ fontSize: 13 }}>Tap “New expense” to submit your first claim.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(r => {
            const st = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
            const StIcon = st.icon;
            return (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 17 }}>₹{Number(r.amount).toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{CAT_LABEL[r.category as Category] || r.category}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{fmtDate(r.expenseAt)}</div>
                    {r.description && <div style={{ fontSize: 13, marginTop: 6 }}>{r.description}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg }}>
                      <StIcon size={13} /> {st.label}
                    </span>
                    {r.status === 'approved' && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: r.reimbursementStatus === 'reimbursed' ? 'var(--green)' : 'var(--gold)' }}>
                        {r.reimbursementStatus === 'reimbursed' ? 'Reimbursed' : 'Awaiting reimbursement'}
                      </span>
                    )}
                  </div>
                </div>
                {r.reviewerRemark && (
                  <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--chip-bg)', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--muted)' }}>{r.reviewedByName || 'Reviewer'}: </span>{r.reviewerRemark}
                  </div>
                )}
                {r.status === 'pending' && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => remove(r.id)} style={{ ...btnGhost, color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 16, marginBottom: 12,
};
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 };
const input: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12,
  background: 'var(--gold)', color: '#04231c', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8,
  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer',
};
