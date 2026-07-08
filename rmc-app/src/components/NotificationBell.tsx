import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useNotificationFeed, type AppNotification } from '@/lib/notifications';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const storageKey = user ? `rmc_notifications_${user.id}` : 'rmc_notifications';
  const { notifications, unreadCount, markAllRead, clearAll } = useNotificationFeed(isClient, storageKey);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function toggle() {
    setOpen(o => {
      const next = !o;
      if (next && unreadCount > 0) markAllRead();
      return next;
    });
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        title="Notifications"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
          background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)',
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 999, background: 'var(--red)', color: '#fff', fontSize: 9.5, fontWeight: 800,
            display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px var(--bg)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, maxWidth: '86vw', zIndex: 200,
          background: 'var(--menu-bg)', border: '1px solid var(--line)', borderRadius: 14,
          boxShadow: '0 24px 60px rgba(var(--shadow-rgb),.5)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Notifications</span>
            {notifications.length > 0 && (
              <button onClick={clearAll} title="Clear all" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 11.5, fontWeight: 700,
              }}>
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '34px 16px', color: 'var(--muted)' }}>
                <Bell size={26} style={{ opacity: .35, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 12.5 }}>No notifications yet</div>
              </div>
            ) : notifications.map((n: AppNotification) => (
              <div key={n.id} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
                <span style={{
                  marginTop: 5, width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: n.type === 'success' ? 'var(--green)' : 'var(--blue)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>{n.message}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{timeAgo(n.ts)}</div>
                </div>
              </div>
            ))}
          </div>
          {notifications.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderTop: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11 }}>
              <Check size={12} /> Up to date
            </div>
          )}
        </div>
      )}
    </div>
  );
}
