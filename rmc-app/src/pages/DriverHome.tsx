import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { api, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Route, Wallet, Siren, Truck, CheckCircle, Navigation, ArrowRight, Package, User,
} from 'lucide-react';

interface Expense {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function navUrlFor(c: Challan): string | null {
  const dest = c.siteLat != null && c.siteLng != null
    ? `${c.siteLat},${c.siteLng}`
    : (c.siteAddress || c.siteName)
      ? encodeURIComponent(c.siteAddress || c.siteName || '')
      : null;
  return dest ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving` : null;
}

export default function DriverHome() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Challan[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<Challan[]>('/me/trips'),
      api.get<Expense[]>('/expenses/mine'),
    ])
      .then(([t, e]) => {
        if (t.status === 'fulfilled') setTrips(t.value);
        if (e.status === 'fulfilled') setExpenses(e.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTrips = trips.filter(c => c.status === 'dispatched' || (c.siteArrivalTime != null && c.siteReleaseTime == null));
  const deliveredToday = trips.filter(c => c.status === 'delivered').length;
  const pendingClaims = expenses.filter(e => e.status === 'pending').length;

  const firstName = (user?.name || 'Driver').split(' ')[0];
  const primary = activeTrips[0];
  const primaryNavUrl = primary ? navUrlFor(primary) : null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{greeting()},</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0 0' }}>{firstName}</h1>
        {user?.truckNo && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 12px', borderRadius: 999, background: 'var(--chip-bg)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700 }}>
            <Truck size={14} style={{ color: 'var(--gold)' }} /> {user.truckNo}
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        <Stat label="Active" value={loading ? '—' : activeTrips.length} color="var(--blue)" icon={Truck} />
        <Stat label="Delivered" value={loading ? '—' : deliveredToday} color="var(--green)" icon={CheckCircle} />
        <Stat label="Claims" value={loading ? '—' : pendingClaims} color="var(--gold)" icon={Wallet} />
      </div>

      {/* Current trip highlight */}
      {primary && (
        <div style={{ ...card, borderColor: 'color-mix(in srgb, var(--blue) 40%, transparent)', marginBottom: 18 }}>
          <Link href="/my-trips" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(56,189,248,.14)', color: 'var(--blue)' }}>
                <Package size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{activeTrips.length} active {activeTrips.length === 1 ? 'trip' : 'trips'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {primary.challanNo}{primary.siteName ? ` → ${primary.siteName}` : ''}
                </div>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--muted)' }} />
            </div>
          </Link>
          {primaryNavUrl && (
            <a
              href={primaryNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14,
                padding: '12px 0', borderRadius: 12, textDecoration: 'none',
                background: 'linear-gradient(135deg,#0284c7,var(--blue))',
                color: '#fff', fontSize: 15, fontWeight: 800,
                boxShadow: '0 4px 16px rgba(56,189,248,.3)',
              }}
            >
              <Navigation size={18} /> Start Navigation
            </a>
          )}
        </div>
      )}

      {/* Quick actions */}
      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px' }}>Quick actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Action href="/my-trips" label="My Trips" sub="Deliveries & tracking" icon={Route} color="var(--blue)" />
        <Action href="/expenses" label="Expenses" sub="Submit a claim" icon={Wallet} color="var(--gold)" />
        <Action href="/sos" label="Emergency" sub="Raise an SOS" icon={Siren} color="var(--red)" />
        <Action href="/profile" label="Profile" sub="Account & settings" icon={User} color="var(--green)" />
      </div>
    </div>
  );
}

function Stat({ label, value, color, icon: Icon }: { label: string; value: number | string; color: string; icon: React.ElementType }) {
  return (
    <div style={{ ...card, padding: 14, textAlign: 'center' }}>
      <Icon size={18} style={{ color, marginBottom: 6 }} />
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Action({ href, label, sub, icon: Icon, color }: { href: string; label: string; sub: string; icon: React.ElementType; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ ...card, padding: 16, cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${color} 14%, transparent)`, color, marginBottom: 10 }}>
          <Icon size={20} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </Link>
  );
}

const card: React.CSSProperties = {
  background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 16,
};
