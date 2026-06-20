import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { ToastContext, type Toast, type ToastType } from './toast';

let _counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Track every pending auto-dismiss timer so we can cancel them on unmount.
  // Otherwise a toast fired right before unmount leaves a 4s timer that fires
  // into a torn-down tree (setState-after-unmount), which crashes the jsdom
  // environment in tests as "window is not defined".
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_counter;
    setToasts(prev => [...prev, { id, message, type }]);
    const handle = setTimeout(() => {
      timers.current.delete(handle);
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
    timers.current.add(handle);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts, dismiss }}>
      {children}
      <ToastOverlay toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastOverlay({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} data-toast-type={t.type} style={{
          background: t.type === 'error' ? 'rgba(239,68,68,.15)' : t.type === 'success' ? 'color-mix(in srgb, var(--green) 16%, transparent)' : 'var(--menu-bg)',
          border: `1px solid ${t.type === 'error' ? '#ef444444' : t.type === 'success' ? 'color-mix(in srgb, var(--green) 40%, transparent)' : 'var(--line)'}`,
          borderRadius: 12, padding: '12px 16px',
          color: t.type === 'error' ? '#fca5a5' : t.type === 'success' ? 'var(--green)' : 'var(--text)',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(var(--shadow-rgb),.4)',
          backdropFilter: 'blur(8px)',
          maxWidth: 340,
          pointerEvents: 'all',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'slideInToast .2s ease',
        }}>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', opacity: .6, fontSize: 16, lineHeight: 1, padding: 0,
          }}>×</button>
        </div>
      ))}
      <style>{`@keyframes slideInToast{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </div>
  );
}
