import { X, Link2 } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import type { SkippedAccountItem } from '@/components/SkippedAccountsPanel';
import type { LinkOption } from './shared';

// Reassign-link picker for a skipped restore: pick a free client/driver to link
// the account to, then restore it with that new link.
export default function ReassignLinkModal({
  item,
  type,
  options,
  targetId,
  onTargetChange,
  busy,
  onConfirm,
  onCancel,
}: {
  item: SkippedAccountItem;
  type: 'client' | 'driver';
  options: LinkOption[];
  targetId: number | null;
  onTargetChange: (id: number | null) => void;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 130,
      background: 'var(--overlay)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(145deg,var(--panel),var(--bg))',
        border: '1px solid rgba(167,139,250,.3)', borderRadius: 18,
        width: '100%', maxWidth: 440, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.25)',
              display: 'grid', placeItems: 'center', color: '#a78bfa',
            }}>
              <Link2 size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Reassign {type} link</h3>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          Pick a free {type} to link <strong style={{ color: 'var(--text)' }}>{item.email}</strong> to.
          The account is restored with the new link and the change is recorded in the activity log.
        </p>
        <SearchableSelect
          value={targetId}
          onChange={onTargetChange}
          options={options}
          placeholder={`Select a ${type}…`}
          emptyLabel={`No free ${type}s available`}
          noneLabel={`— Select a ${type} —`}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1, padding: '10px', background: 'var(--chip-bg)',
              border: '1px solid var(--line)', borderRadius: 10,
              color: 'var(--muted)', fontWeight: 600, fontSize: 13,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={targetId == null || busy}
            style={{
              flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', border: 'none', borderRadius: 10,
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: (targetId == null || busy) ? 'not-allowed' : 'pointer',
              opacity: (targetId == null || busy) ? 0.6 : 1,
            }}
          >
            <Link2 size={14} /> {busy ? 'Reassigning…' : 'Reassign & restore'}
          </button>
        </div>
      </div>
    </div>
  );
}
