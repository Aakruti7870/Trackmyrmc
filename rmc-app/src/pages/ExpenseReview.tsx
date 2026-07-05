import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import {
  Wallet, Clock, CheckCircle, AlertCircle, User, Receipt, X,
} from 'lucide-react';

type Status = 'pending' | 'approved' | 'rejected';

interface Expense {
  id: number;
  driverName: string | null;
  category: string;
  amount: string;
  description: string | null;
  status: Status;
  reimbursementStatus: 'pending' | 'reimbursed';
  reviewerRemark: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  expenseAt: string;
  createdAt: string;
  hasReceipt: boolean;
}

interface ExpenseDetail extends Expense { receiptUrl: string | null }

const STATUS_STYLES: Record<Status, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending:  { color: 'var(--gold)',  bg: 'color-mix(in srgb, var(--gold) 12%, transparent)', icon: Clock,       label: 'Pending' },
  approved: { color: 'var(--green)', bg: 'rgba(34,197,94,.12)',  icon: CheckCircle, label: 'Approved' },
  rejected: { color: 'var(--red)',   bg: 'rgba(239,68,68,.12)',  icon: AlertCircle, label: 'Rejected' },
};

const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ExpenseReview() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [active, setActive] = useState<ExpenseDetail | null>(null);
  const [remark, setRemark] = useState('');
  const [reimbursed, setReimbursed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback((f: Status | 'all') => {
    const path = f === 'all' ? '/expenses' : `/expenses?status=${f}`;
    return api.get<Expense[]>(path)
      .then(setRows)
      .catch(() => showToast('Could not load expenses', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(filter); }, [filter, load]);

  function openDetail(id: number) {
    setRemark(''); setReimbursed(false);
    api.get<ExpenseDetail>(`/expenses/${id}`)
      .then(d => setActive(d))
      .catch(() => showToast('Could not open expense', 'error'));
  }

  async function review(decision: 'approved' | 'rejected') {
    if (!active) return;
    setBusy(true);
    try {
      await api.patch(`/expenses/${active.id}/review`, {
        decision,
        reimbursed: decision === 'approved' ? reimbursed : false,
        remark: remark.trim() || undefined,
      });
      showToast(decision === 'approved' ? 'Expense approved' : 'Expense rejected', 'success');
      setActive(null);
      load(filter);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)' }}>
          <Wallet size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Expense Approvals</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Review and settle driver claims</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            background: filter === f.key ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'var(--chip-bg)',
            border: filter === f.key ? '1px solid color-mix(in srgb, var(--gold) 55%, transparent)' : '1px solid var(--line)',
            color: filter === f.key ? 'var(--gold)' : 'var(--muted)',
          }}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>No expenses in this view.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(r => {
            const st = STATUS_STYLES[r.status];
            const StIcon = st.icon;
            return (
              <button key={r.id} onClick={() => openDetail(r.id)} style={{ ...card, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 17 }}>₹{Number(r.amount).toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'capitalize' }}>{r.category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                      <User size={13} /> {r.driverName || 'Driver'} · {fmtDate(r.expenseAt)}
                      {r.hasReceipt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 4 }}><Receipt size={12} /> receipt</span>}
                    </div>
                    {r.description && <div style={{ fontSize: 13, marginTop: 6 }}>{r.description}</div>}
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg, whiteSpace: 'nowrap' }}>
                    <StIcon size={13} /> {st.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div onClick={() => setActive(null)} style={{
          position: 'fixed', inset: 0, zIndex: 60, background: 'var(--overlay)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '18px 18px 0 0',
            padding: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>₹{Number(active.amount).toLocaleString('en-IN')} · <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: 14, color: 'var(--muted)' }}>{active.category}</span></div>
              <button onClick={() => setActive(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
              <User size={13} style={{ verticalAlign: -2 }} /> {active.driverName || 'Driver'} · {fmtDate(active.expenseAt)}
            </div>
            {active.description && <div style={{ fontSize: 14, marginBottom: 12 }}>{active.description}</div>}
            {active.receiptUrl && (
              <img src={active.receiptUrl} alt="Receipt" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', marginBottom: 14 }} />
            )}

            {active.status === 'pending' ? (
              <>
                <label style={label}>Remark (optional)</label>
                <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2}
                  placeholder="Reason or note for the driver…" style={{ ...input, marginBottom: 12, resize: 'vertical' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  <input type="checkbox" checked={reimbursed} onChange={e => setReimbursed(e.target.checked)} style={{ width: 18, height: 18 }} />
                  Mark as reimbursed (paid out)
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => review('rejected')} disabled={busy} style={{ ...btnBase, flex: 1, background: 'rgba(239,68,68,.12)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)' }}>
                    <AlertCircle size={16} /> Reject
                  </button>
                  <button onClick={() => review('approved')} disabled={busy} style={{ ...btnBase, flex: 1, background: 'var(--green)', color: '#04231c', border: 'none' }}>
                    <CheckCircle size={16} /> Approve
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: STATUS_STYLES[active.status].bg, color: STATUS_STYLES[active.status].color, fontWeight: 700, fontSize: 13.5 }}>
                {STATUS_STYLES[active.status].label}
                {active.status === 'approved' && ` · ${active.reimbursementStatus === 'reimbursed' ? 'Reimbursed' : 'Not yet reimbursed'}`}
                {active.reviewedByName && <div style={{ fontWeight: 500, marginTop: 4 }}>by {active.reviewedByName}</div>}
                {active.reviewerRemark && <div style={{ fontWeight: 500, marginTop: 4, color: 'var(--text)' }}>“{active.reviewerRemark}”</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 16,
};
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 };
const input: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
};
const btnBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '13px', borderRadius: 12, fontWeight: 800, fontSize: 14.5, cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8,
  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer',
};
