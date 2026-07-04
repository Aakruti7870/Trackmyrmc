import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

// A small, dismissible diagnostic card shown after login. It surfaces the
// resolved identity (role + the linked ids) so we can confirm at a glance that,
// e.g., an admin-added driver actually signed in as a DRIVER and picked up the
// right driver / plant / truck ids.
function roleLabel(role: string): 'DRIVER' | 'CUSTOMER' | 'STAFF' {
  if (role === 'driver') return 'DRIVER';
  if (role === 'client') return 'CUSTOMER';
  return 'STAFF';
}

export default function LoginDebugCard() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user || dismissed) return null;

  const rows: [string, string | number][] = [
    ['Logged in as', roleLabel(user.role)],
    ['User ID', user.id],
    ['Driver ID', user.linkedDriverId ?? '—'],
    ['Plant ID', user.plantId ?? '—'],
    ['Truck ID', user.truckId ?? user.truckNo ?? '—'],
  ];

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-1)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 13,
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss debug card"
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', padding: 4, lineHeight: 0,
        }}
      >
        <X size={16} />
      </button>
      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--gold)', letterSpacing: 0.5 }}>
        SESSION DEBUG
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 12, rowGap: 4 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span style={{ color: 'var(--muted)' }}>{label}:</span>
            <span style={{ fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
