import type { ReactNode } from 'react';

// Shared confirmation dialog used by the delete / permanent-delete / empty-trash
// / delete-selected / restore-all flows on the User Management page. They all
// share the same overlay + card + icon-header + body + cancel/confirm layout, so
// keeping it in one place removes a lot of near-duplicate JSX from the page.

type Tone = 'danger' | 'success';

const TONE: Record<Tone, {
  border: string; iconBg: string; iconBorder: string; iconColor: string; gradient: string;
}> = {
  danger: {
    border: 'rgba(239,68,68,.3)',
    iconBg: 'rgba(239,68,68,.12)',
    iconBorder: 'rgba(239,68,68,.25)',
    iconColor: 'var(--red)',
    gradient: 'linear-gradient(135deg,#ef4444,#dc2626)',
  },
  success: {
    border: 'rgba(34,197,94,.3)',
    iconBg: 'rgba(34,197,94,.12)',
    iconBorder: 'rgba(34,197,94,.25)',
    iconColor: 'var(--green)',
    gradient: 'linear-gradient(135deg,#22c55e,#16a34a)',
  },
};

export default function ConfirmDialog({
  tone,
  icon,
  title,
  children,
  confirmIcon,
  confirmLabel,
  busyLabel,
  busy,
  onConfirm,
  onCancel,
  maxWidth = 440,
}: {
  tone: Tone;
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
  confirmIcon: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  maxWidth?: number;
}) {
  const t = TONE[tone];
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 110,
      background: 'var(--overlay)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(145deg,var(--panel),var(--bg))',
        border: `1px solid ${t.border}`, borderRadius: 18,
        width: '100%', maxWidth, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: t.iconBg, border: `1px solid ${t.iconBorder}`,
            display: 'grid', placeItems: 'center', color: t.iconColor,
          }}>
            {icon}
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h3>
        </div>
        {children}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={busy} style={{
            flex: 1, padding: '10px', background: 'var(--chip-bg)',
            border: '1px solid var(--line)', borderRadius: 10,
            color: 'var(--muted)', fontWeight: 600, fontSize: 13,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} style={{
            flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: t.gradient, border: 'none', borderRadius: 10,
            color: '#fff', fontWeight: 700, fontSize: 13,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
          }}>
            {confirmIcon} {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
