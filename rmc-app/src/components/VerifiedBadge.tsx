import { BadgeCheck, Clock, XCircle, FileEdit } from 'lucide-react';

export type KycStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

const STYLES: Record<KycStatus, { color: string; bg: string; icon: typeof BadgeCheck; label: string }> = {
  draft:     { color: 'var(--muted)', bg: 'var(--glass-1)', icon: FileEdit, label: 'Draft' },
  submitted: { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 12%, transparent)', icon: Clock, label: 'Under Review' },
  approved:  { color: 'var(--green)', bg: 'rgba(34,197,94,.12)', icon: BadgeCheck, label: 'Verified' },
  rejected:  { color: 'var(--red)', bg: 'rgba(239,68,68,.12)', icon: XCircle, label: 'Rejected' },
};

// Small pill showing a KYC verification status. `status` undefined/null means
// no KYC profile exists yet — render nothing unless showEmpty is set.
export default function VerifiedBadge({ status, showEmpty = false, size = 12 }: {
  status?: string | null;
  showEmpty?: boolean;
  size?: number;
}) {
  const s = STYLES[status as KycStatus];
  if (!s) {
    if (!showEmpty) return null;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
        fontSize: size - 1, fontWeight: 600, color: 'var(--muted)', background: 'var(--glass-1)',
      }}>
        No KYC
      </span>
    );
  }
  const Icon = s.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
      fontSize: size - 1, fontWeight: 700, color: s.color, background: s.bg,
    }}>
      <Icon size={size} /> {s.label}
    </span>
  );
}
