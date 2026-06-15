import { AlertCircle } from 'lucide-react';

// Shared presentational components for the login screen, so the legacy
// (Twilio/email) form and the Clerk-powered customer phone form render
// identically. Style constants live in loginStyles.ts to keep this file
// component-only for react-refresh.

export function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 18,
    }}>
      <AlertCircle size={14} style={{ color: 'var(--red)' }} />
      <span style={{ color: 'var(--red)', fontSize: 13 }}>{message}</span>
    </div>
  );
}

export function SubmitButton({ loading, label, icon }: { loading: boolean; label: string; icon?: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading} style={{
      width: '100%', padding: '12px', borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      background: loading ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
      color: '#111827', fontWeight: 800, fontSize: 15,
      boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 20%, transparent)',
      cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
      transition: 'all .15s',
    }}>
      {icon}{label}
    </button>
  );
}
