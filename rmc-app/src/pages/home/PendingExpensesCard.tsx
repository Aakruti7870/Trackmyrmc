import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Check, X, Wallet } from 'lucide-react';
import { SectionHead, Card, INK, MUTED, LINE, GREEN, RED, TEAL_TINT, TEAL } from './deliveryKit';

interface PendingExpense {
  id: number;
  driverName: string | null;
  category: string;
  amount: string;
  expenseAt: string;
}

// Live "one-tap" approvals surface for supervisor / accountant / admin / owner
// home screens. Approve / Reject call PATCH /expenses/:id/review directly (same
// contract as the full Expense Review page) and drop the row on success.
export default function PendingExpensesCard({ onViewAll }: { onViewAll: () => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<PendingExpense[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    api.get<PendingExpense[]>('/expenses?status=pending')
      .then(setItems)
      .catch(() => { /* silent — home stays clean if it can't load */ });
  }, []);

  async function decide(id: number, decision: 'approved' | 'rejected') {
    setBusyId(id);
    try {
      await api.patch(`/expenses/${id}/review`, {
        decision,
        reimbursed: decision === 'approved',
      });
      setItems(prev => prev.filter(e => e.id !== id));
      showToast(decision === 'approved' ? 'Expense approved' : 'Expense rejected', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) return null;
  const shown = items.slice(0, 3);

  return (
    <>
      <SectionHead
        title={`Pending Approvals (${items.length})`}
        actionLabel="Review All"
        onAction={onViewAll}
      />
      <div className="space-y-2.5">
        {shown.map(e => (
          <Card key={e.id} style={{ padding: 12 }}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: TEAL_TINT }}>
                <Wallet className="h-5 w-5" style={{ color: TEAL }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold" style={{ color: INK }}>
                    ₹{Number(e.amount).toLocaleString('en-IN')}
                  </span>
                  <span className="truncate text-[12px] capitalize" style={{ color: MUTED }}>{e.category}</span>
                </div>
                <p className="mt-0.5 truncate text-[11.5px]" style={{ color: MUTED }}>
                  {e.driverName || 'Driver'} · {new Date(e.expenseAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                disabled={busyId === e.id}
                onClick={() => decide(e.id, 'approved')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-bold text-white disabled:opacity-60"
                style={{ background: GREEN }}
              >
                <Check className="h-4 w-4" strokeWidth={3} /> Approve
              </button>
              <button
                disabled={busyId === e.id}
                onClick={() => decide(e.id, 'rejected')}
                className="flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-[13px] font-bold disabled:opacity-60"
                style={{ borderColor: LINE, color: RED }}
              >
                <X className="h-4 w-4" strokeWidth={3} /> Reject
              </button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
