import { BadgeCheck, Clock, XCircle, FileEdit, AlertTriangle } from 'lucide-react';

// Covers both the eKYC (DigiLocker) statuses returned by /api/kyc/status and
// the document-based KYC profile statuses used in staff review views.
type AnyKycStatus =
  // eKYC / DigiLocker
  | 'not_started' | 'unverified' | 'pending' | 'verified' | 'failed'
  // document KYC profile
  | 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'
  | 'suspended' | 'expired' | 'revoked';

type Style = { color: string; bg: string; icon: typeof BadgeCheck; label: string };

const STYLES: Partial<Record<AnyKycStatus, Style>> = {
  // ── Not started ────────────────────────────────────────────────────────────
  not_started:  { color: 'var(--muted)', bg: 'var(--glass-1)',                                     icon: FileEdit,      label: 'Not Started' },
  unverified:   { color: 'var(--muted)', bg: 'var(--glass-1)',                                     icon: FileEdit,      label: 'Not Started' },
  draft:        { color: 'var(--muted)', bg: 'var(--glass-1)',                                     icon: FileEdit,      label: 'Not Started' },
  // ── Pending ────────────────────────────────────────────────────────────────
  pending:      { color: 'var(--gold)',  bg: 'color-mix(in srgb,var(--gold) 12%,transparent)',    icon: Clock,         label: 'Verification Pending' },
  submitted:    { color: 'var(--gold)',  bg: 'color-mix(in srgb,var(--gold) 12%,transparent)',    icon: Clock,         label: 'Verification Pending' },
  under_review: { color: 'var(--gold)',  bg: 'color-mix(in srgb,var(--gold) 12%,transparent)',    icon: Clock,         label: 'Under Review' },
  // ── Verified ───────────────────────────────────────────────────────────────
  verified:     { color: 'var(--green)', bg: 'rgba(34,197,94,.12)',                                icon: BadgeCheck,    label: 'KYC Verified' },
  approved:     { color: 'var(--green)', bg: 'rgba(34,197,94,.12)',                                icon: BadgeCheck,    label: 'KYC Verified' },
  // ── Failed / rejected ──────────────────────────────────────────────────────
  failed:       { color: 'var(--red)',   bg: 'rgba(239,68,68,.12)',                                icon: XCircle,       label: 'Verification Failed' },
  rejected:     { color: 'var(--orange)',bg: 'rgba(245,158,11,.12)',                               icon: AlertTriangle, label: 'Requires Attention' },
  suspended:    { color: 'var(--red)',   bg: 'rgba(239,68,68,.12)',                                icon: XCircle,       label: 'Suspended' },
  expired:      { color: 'var(--muted)', bg: 'var(--glass-1)',                                     icon: Clock,         label: 'Expired' },
  revoked:      { color: 'var(--red)',   bg: 'rgba(239,68,68,.12)',                                icon: XCircle,       label: 'Revoked' },
};

// Small pill showing a KYC verification status.
// `status` undefined / null → render nothing unless showEmpty is set.
export default function VerifiedBadge({
  status,
  showEmpty = false,
  size = 12,
}: {
  status?: string | null;
  showEmpty?: boolean;
  size?: number;
}) {
  const s = STYLES[status as AnyKycStatus];

  if (!s) {
    if (!showEmpty) return null;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
        borderRadius: 999, fontSize: size - 1, fontWeight: 600,
        color: 'var(--muted)', background: 'var(--glass-1)',
      }}>
        Not Started
      </span>
    );
  }

  const Icon = s.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      borderRadius: 999, fontSize: size - 1, fontWeight: 700,
      color: s.color, background: s.bg,
    }}>
      <Icon size={size} /> {s.label}
    </span>
  );
}
