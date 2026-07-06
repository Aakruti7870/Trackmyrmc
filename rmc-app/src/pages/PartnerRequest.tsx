import { useState } from 'react';
import { useLocation } from 'wouter';
import { api } from '@/lib/api';
import { Building2, User, Phone, Mail, MapPin, FileText, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/brand';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px 11px 38px',
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6,
};

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>{icon}</span>
        {children}
      </div>
    </div>
  );
}

export default function PartnerRequest() {
  const [, setLoc] = useLocation();
  const [ownerName, setOwnerName] = useState('');
  const [plantName, setPlantName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/plants/partner-request', {
        ownerName, plantName, phone,
        email: email || undefined,
        city: city || undefined,
        address: address || undefined,
        note: note || undefined,
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit your request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))', fontFamily: 'var(--font-app)',
    }}>
      <div style={{
        width: '100%', maxWidth: 540,
        background: 'linear-gradient(135deg, var(--glass-1), var(--glass-2))',
        border: '1px solid var(--glass-border)',
        borderRadius: 20, padding: '32px 32px 36px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 30px 70px -30px rgba(var(--shadow-rgb),.28)',
      }}>
        <button onClick={() => setLoc('/')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--muted)', fontSize: 13, fontWeight: 600,
        }}>
          <ArrowLeft size={15} /> Back to home
        </button>

        <button onClick={() => setLoc('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 24px color-mix(in srgb, var(--gold) 30%, transparent)',
            }}>
              <Building2 size={22} color="#111" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>{PLATFORM_NAME}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>{PLATFORM_TAGLINE}</div>
            </div>
          </div>
        </button>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
              background: 'color-mix(in srgb, var(--green) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--green) 32%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <CheckCircle2 size={28} style={{ color: 'var(--green)' }} />
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Request received</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
              Thanks! Our team will review your plant details and reach out to verify
              and set up your account. This usually takes 1–2 working days.
            </p>
            <button onClick={() => setLoc('/')} style={{
              padding: '11px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              color: '#111827', fontWeight: 800, fontSize: 14,
            }}>
              Back to home
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Register your plant</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              Own an RMC plant? Tell us about it. Our team verifies every plant before
              it goes live, so customers only ever see approved partners.
            </p>

            <form onSubmit={handleSubmit}>
              <Field icon={<User size={15} style={{ color: 'var(--muted)' }} />} label="Your Name">
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner / contact person" required style={inputStyle} />
              </Field>

              <Field icon={<Building2 size={15} style={{ color: 'var(--muted)' }} />} label="Plant / Company Name">
                <input type="text" value={plantName} onChange={e => setPlantName(e.target.value)} placeholder="Your RMC plant or firm" required style={inputStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field icon={<Phone size={15} style={{ color: 'var(--muted)' }} />} label="Phone">
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number" required style={inputStyle} />
                </Field>
                <Field icon={<Mail size={15} style={{ color: 'var(--muted)' }} />} label="Email (optional)">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@plant.com" style={inputStyle} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field icon={<MapPin size={15} style={{ color: 'var(--muted)' }} />} label="City (optional)">
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={inputStyle} />
                </Field>
                <Field icon={<MapPin size={15} style={{ color: 'var(--muted)' }} />} label="Address (optional)">
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Plant location" style={inputStyle} />
                </Field>
              </div>

              <Field icon={<FileText size={15} style={{ color: 'var(--muted)' }} />} label="Anything else? (optional)">
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Capacity, grades, etc." style={inputStyle} />
              </Field>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                }}>
                  <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                  <span style={{ color: 'var(--red)', fontSize: 13 }}>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: loading ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                color: '#111827', fontWeight: 800, fontSize: 15,
                boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 20%, transparent)',
                cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
                transition: 'all .15s',
              }}>
                {loading ? 'Submitting...' : 'Submit for review →'}
              </button>
            </form>

            <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              Already a partner?{' '}
              <button type="button" onClick={() => setLoc('/login?staff=1')} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'underline',
              }}>
                Staff sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
