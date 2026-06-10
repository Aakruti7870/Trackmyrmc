import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface Toast { id: number; message: string; type: 'error' | 'info' }

interface ToastCtx {
  showToast: (message: string, type?: 'error' | 'info') => void;
  toasts: Toast[];
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastCtx>({
  showToast: () => {},
  toasts: [],
  dismiss: () => {},
});

let _counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'error' | 'info' = 'info') => {
    const id = ++_counter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
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
        <div key={t.id} style={{
          background: t.type === 'error' ? 'rgba(239,68,68,.15)' : 'rgba(38,52,73,.95)',
          border: `1px solid ${t.type === 'error' ? '#ef444444' : '#263449'}`,
          borderRadius: 12, padding: '12px 16px',
          color: t.type === 'error' ? '#fca5a5' : '#eef5ff',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
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

export function useToast() {
  return useContext(ToastContext);
}
