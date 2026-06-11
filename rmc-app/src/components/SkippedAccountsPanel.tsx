import type { ReactNode } from 'react';
import { AlertTriangle, Copy, X, Mail, RotateCcw, Unlink, Trash2 } from 'lucide-react';

export type SkippedAccountItem = {
  id: number;
  email: string;
  reason?: string;
  conflictUserId?: number;
  conflictUserName?: string;
  conflictLinkType?: 'client' | 'driver';
};

export default function SkippedAccountsPanel({
  items,
  heading,
  description,
  onCopyEmails,
  onClose,
  onRetry,
  retryingId,
  retryLabel = 'Retry restore',
  retryingLabel = 'Retrying…',
  retryTone = 'positive',
  onResolve,
  resolvingId,
  onUnlink,
  unlinkingId,
}: {
  items: SkippedAccountItem[];
  heading: ReactNode;
  description: ReactNode;
  onCopyEmails: () => void;
  onClose: () => void;
  onRetry?: (item: SkippedAccountItem) => void;
  retryingId?: number | null;
  retryLabel?: string;
  retryingLabel?: string;
  retryTone?: 'positive' | 'danger';
  onResolve?: (item: SkippedAccountItem) => void;
  resolvingId?: number | null;
  onUnlink?: (item: SkippedAccountItem) => void;
  unlinkingId?: number | null;
}) {
  const hasActions = Boolean(onRetry || onResolve || onUnlink);
  const retryColors = retryTone === 'danger'
    ? { bg: 'rgba(239,68,68,.12)', color: 'var(--red)', border: 'rgba(239,68,68,.3)' }
    : { bg: 'rgba(34,197,94,.12)', color: 'var(--green)', border: 'rgba(34,197,94,.3)' };
  const RetryIcon = retryTone === 'danger' ? Trash2 : RotateCcw;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(145deg,var(--panel),var(--bg))',
        border: '1px solid rgba(245,158,11,.3)', borderRadius: 18,
        width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)',
              display: 'grid', placeItems: 'center', color: '#f59e0b',
            }}>
              <AlertTriangle size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              {heading}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onCopyEmails}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: 'rgba(245,158,11,.12)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,.3)', cursor: 'pointer',
              }}
            >
              <Copy size={13} />
              Copy emails
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          {description}
        </p>
        <div style={{ overflowY: 'auto', display: 'grid', gap: 10 }}>
          {items.map(item => (
            <div key={item.id} style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)',
            }}>
              {hasActions ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text)', minWidth: 0 }}>
                      <Mail size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                      {onResolve && (
                        <button
                          onClick={() => onResolve(item)}
                          disabled={resolvingId === item.id || retryingId === item.id}
                          title="Restore this account with its linked client/driver cleared"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            background: 'rgba(245,158,11,.14)', color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,.35)',
                            cursor: resolvingId === item.id || retryingId === item.id ? 'default' : 'pointer',
                            opacity: resolvingId === item.id || retryingId === item.id ? 0.6 : 1,
                          }}
                        >
                          <Unlink size={13} />
                          {resolvingId === item.id ? 'Restoring…' : 'Restore without link'}
                        </button>
                      )}
                      {onRetry && (
                        <button
                          onClick={() => onRetry(item)}
                          disabled={retryingId === item.id || resolvingId === item.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            background: retryColors.bg, color: retryColors.color,
                            border: `1px solid ${retryColors.border}`,
                            cursor: retryingId === item.id || resolvingId === item.id ? 'default' : 'pointer',
                            opacity: retryingId === item.id || resolvingId === item.id ? 0.6 : 1,
                          }}
                        >
                          <RetryIcon size={13} />
                          {retryingId === item.id ? retryingLabel : retryLabel}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ margin: '5px 0 0 20px', fontSize: 12.5, color: '#9fb0c7', lineHeight: 1.45 }}>
                    {item.reason}
                  </div>
                  {onUnlink && item.conflictUserId != null && item.conflictLinkType && (
                    <div style={{ margin: '8px 0 0 20px' }}>
                      <button
                        onClick={() => onUnlink(item)}
                        disabled={unlinkingId === item.id || retryingId === item.id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: 'rgba(56,189,248,.12)', color: 'var(--blue)',
                          border: '1px solid rgba(56,189,248,.3)',
                          cursor: (unlinkingId === item.id || retryingId === item.id) ? 'default' : 'pointer',
                          opacity: (unlinkingId === item.id || retryingId === item.id) ? 0.6 : 1,
                        }}
                      >
                        <Unlink size={13} />
                        {unlinkingId === item.id
                          ? 'Unlinking…'
                          : `Unlink ${item.conflictUserName ?? 'conflicting account'} & restore`}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                  <Mail size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  {item.email}
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{
          marginTop: 18, padding: '10px', width: '100%',
          background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 10, color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          Done
        </button>
      </div>
    </div>
  );
}
