import { useEffect, useState } from 'react';
import { X, UserPlus, Check, Loader2, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { GlassPanel, PrimaryButton, GhostButton, Badge } from './ui';
import { mix } from './tokens';

// Roles the owner-provisioning endpoint accepts (mirrors server OWNER_ROLES).
const OWNER_ROLES: { value: string; label: string }[] = [
  { value: 'plant_owner', label: 'Plant Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'plant_operator', label: 'Plant Operator' },
  { value: 'driver', label: 'Driver' },
];

interface PlantLite { id: number; name: string; plantCode?: string | null; city?: string | null }

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, fontSize: 13.5,
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontFamily: 'inherit',
};
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', marginBottom: 5, display: 'block', letterSpacing: 0.2 };

export default function InviteDialog({ accent, onClose }: { accent: string; onClose: () => void }) {
  const [plants, setPlants] = useState<PlantLite[]>([]);
  const [plantId, setPlantId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('plant_owner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ msg: string; inviteUrl?: string } | null>(null);

  useEffect(() => {
    api.get<PlantLite[]>('/plants')
      .then(rows => setPlants(Array.isArray(rows) ? rows : []))
      .catch(() => setPlants([]));
  }, []);

  const submit = async () => {
    setError(null);
    if (!plantId) { setError('Choose a plant to invite this person to.'); return; }
    if (!name.trim() || !email.trim()) { setError('Name and email are required.'); return; }
    setBusy(true);
    try {
      // No password → the account is provisioned as a passwordless invite; the
      // server emails/WhatsApps a one-time login link.
      const res = await api.post<{ inviteUrl?: string; user?: { email: string } }>(
        `/plants/${plantId}/owner`,
        { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, role },
      );
      setDone({
        msg: `Invitation sent to ${email.trim()}. They will receive a one-time login link.`,
        inviteUrl: res?.inviteUrl,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Send invitation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center', padding: 16,
        background: 'rgba(3,10,9,.6)', backdropFilter: 'blur(4px)',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px, 100%)', maxHeight: '90dvh', overflowY: 'auto' }}>
        <GlassPanel accent={accent} style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: mix(accent, 18), color: accent, border: `1px solid ${mix(accent, 36)}`,
            }}><UserPlus size={20} /></div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>Invite to a plant</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Plant owners &amp; team members</p>
            </div>
            <button onClick={onClose} aria-label="Close" style={{
              width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)',
            }}><X size={18} /></button>
          </div>

          {done ? (
            <div style={{ textAlign: 'center', padding: '10px 4px' }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px',
                background: mix('var(--green)', 18), color: 'var(--green)', border: '1px solid ' + mix('var(--green)', 40),
              }}><Check size={26} /></div>
              <p style={{ fontSize: 13.5, color: 'var(--text)', margin: '0 0 14px' }}>{done.msg}</p>
              {done.inviteUrl && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(done.inviteUrl!).catch(() => {}); }}
                  style={{ ...field, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', cursor: 'pointer', width: 'auto', margin: '0 auto 14px' }}
                >
                  <Copy size={14} /> Copy invite link
                </button>
              )}
              <PrimaryButton accent={accent} onClick={onClose} style={{ width: '100%' }}>Done</PrimaryButton>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Plant</label>
                <select value={plantId} onChange={e => setPlantId(e.target.value ? Number(e.target.value) : '')} style={field}>
                  <option value="">Select a plant…</option>
                  {plants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.plantCode ? ` (${p.plantCode})` : ''}{p.city ? ` — ${p.city}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Role</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {OWNER_ROLES.map(r => {
                    const on = role === r.value;
                    return (
                      <button key={r.value} onClick={() => setRole(r.value)} style={{
                        padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        background: on ? mix(accent, 18) : 'var(--surface)',
                        color: on ? accent : 'var(--muted)',
                        border: `1px solid ${on ? mix(accent, 40) : 'var(--line)'}`,
                      }}>{r.label}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={label}>Full name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Patil" style={field} />
              </div>
              <div>
                <label style={label}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" style={field} />
              </div>
              <div>
                <label style={label}>Phone <span style={{ fontWeight: 600, opacity: 0.7 }}>(optional — WhatsApp login code)</span></label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 …" style={field} />
              </div>

              {error && (
                <div style={{
                  fontSize: 12.5, color: 'var(--red)', padding: '9px 11px', borderRadius: 9,
                  background: mix('var(--red)', 10), border: '1px solid ' + mix('var(--red)', 30),
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <PrimaryButton accent={accent} onClick={submit} disabled={busy} style={{ flex: 1 }}>
                  {busy ? <><Loader2 size={15} className="cc-spin" /> Sending…</> : <><UserPlus size={15} /> Send invitation</>}
                </PrimaryButton>
                <GhostButton accent={accent} onClick={onClose}>Cancel</GhostButton>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Badge color={accent}>Passwordless one-time login link</Badge>
              </div>
            </div>
          )}
        </GlassPanel>
        <style>{`.cc-spin{animation:ccSpin 1s linear infinite}@keyframes ccSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
