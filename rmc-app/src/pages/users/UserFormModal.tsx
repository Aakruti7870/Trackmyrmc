import type { Dispatch, SetStateAction } from 'react';
import { X, UserCog, Eye, EyeOff, RotateCcw } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import {
  ROLES, ROLE_LABEL, inputStyle, labelStyle,
  type FormData, type LinkOption,
} from './shared';

// Create / edit user modal. All form state stays in the parent page; this
// component just renders the inputs and reports changes back up.
export default function UserFormModal({
  modal,
  form,
  setForm,
  editingName,
  error,
  saving,
  showPassword,
  setShowPassword,
  autoOpenLink,
  clientOptions,
  driverOptions,
  authorityEmails,
  softDeletedMatch,
  onClose,
  onSave,
  onRestoreFromCreate,
}: {
  modal: 'create' | 'edit';
  form: FormData;
  setForm: Dispatch<SetStateAction<FormData>>;
  editingName?: string;
  error: string;
  saving: boolean;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  autoOpenLink: boolean;
  clientOptions: LinkOption[];
  driverOptions: LinkOption[];
  authorityEmails: string[];
  softDeletedMatch: { id: number; name: string } | null;
  onClose: () => void;
  onSave: () => void;
  onRestoreFromCreate: () => void;
}) {
  const needsClientLink = form.role === 'client';
  const needsDriverLink = form.role === 'driver';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--overlay)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(145deg,var(--panel),var(--bg))',
        border: '1px solid var(--line)', borderRadius: 18,
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24,
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCog size={18} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
              {modal === 'create' ? 'Add New User' : `Edit — ${editingName}`}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Name */}
          <label>
            <span style={labelStyle}>Full Name</span>
            <input
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Rajesh Kumar"
              style={inputStyle}
            />
          </label>

          {/* Email — editable only on create */}
          <label>
            <span style={labelStyle}>Email</span>
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"
              type="email"
              disabled={modal === 'edit'}
              style={{ ...inputStyle, opacity: modal === 'edit' ? 0.5 : 1 }}
            />
          </label>

          {/* Phone — optional, create only. Enables WhatsApp one-time codes for
              a passwordless staff/owner account (email is the default channel). */}
          {modal === 'create' && (
            <label>
              <span style={labelStyle}>
                Phone <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--muted)' }}>(optional — enables WhatsApp codes)</span>
              </span>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. +91 98765 43210"
                type="tel"
                style={inputStyle}
              />
            </label>
          )}

          {/* Password — only the Super Admin (Authority) uses a password; every
              other role is passwordless and signs in with a one-time code. */}
          {form.role === 'authority' ? (
            <label>
              <span style={labelStyle}>
                {modal === 'create' ? 'Password' : 'New Password'}
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={modal === 'create' ? 'Min. 6 characters' : 'Leave blank to keep current password'}
                  style={{ ...inputStyle, paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2 }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                {modal === 'create'
                  ? 'Super Admin signs in with this password plus a one-time code (2FA).'
                  : 'Leave blank to keep current password. Must be at least 6 characters if changed.'}
              </span>
            </label>
          ) : modal === 'create' ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
              Passwordless account — the user signs in with a one-time code sent to their email{form.phone.trim() ? ' or WhatsApp' : ''}. No password needed.
            </div>
          ) : null}

          {/* Role */}
          <label>
            <span style={labelStyle}>Role</span>
            <select
              value={form.role}
              onChange={e => setForm(f => ({
                ...f, role: e.target.value as FormData['role'],
                linkedClientId: null, linkedDriverId: null,
              }))}
              style={inputStyle}
            >
              {ROLES
                .filter(r => r !== 'authority' || (authorityEmails ?? []).includes(form.email.trim().toLowerCase()))
                .map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
            </select>
          </label>

          {/* Linked Client — shown for client role */}
          {needsClientLink && (
            <label>
              <span style={labelStyle}>Linked Client Account</span>
              <SearchableSelect
                value={form.linkedClientId}
                onChange={id => setForm(f => ({ ...f, linkedClientId: id }))}
                options={clientOptions}
                placeholder="Select a client…"
                noneLabel="— No linked client —"
                emptyLabel="No clients found"
                autoOpen={autoOpenLink}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                Links this login to a client record so "My Orders" shows their data.
              </span>
            </label>
          )}

          {/* Linked Driver — shown for driver role */}
          {needsDriverLink && (
            <label>
              <span style={labelStyle}>Linked Driver Record</span>
              <SearchableSelect
                value={form.linkedDriverId}
                onChange={id => setForm(f => ({ ...f, linkedDriverId: id }))}
                options={driverOptions}
                placeholder="Select a driver…"
                noneLabel="— No linked driver —"
                emptyLabel="No drivers found"
                autoOpen={autoOpenLink}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                Links this login to a driver record so "My Trips" shows their assignments.
              </span>
            </label>
          )}

          {/* Active toggle — edit only */}
          {modal === 'edit' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div
                onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                style={{
                  width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
                  background: form.isActive ? 'var(--green)' : 'var(--chip-bg)',
                  position: 'relative', transition: 'background .2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: form.isActive ? 20 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left .2s',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {form.isActive ? 'Account Active' : 'Account Deactivated'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Deactivated accounts cannot log in but their data is preserved.
                </div>
              </div>
            </label>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>
              {error}
              {softDeletedMatch && (
                <button
                  onClick={onRestoreFromCreate}
                  disabled={saving}
                  style={{
                    marginTop: 10, width: '100%', padding: '9px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.35)',
                    borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 13,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RotateCcw size={14} /> Restore {softDeletedMatch.name}'s account
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px', background: 'var(--chip-bg)',
              border: '1px solid var(--line)', borderRadius: 10,
              color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              Cancel
            </button>
            <button onClick={onSave} disabled={saving} style={{
              flex: 2, padding: '10px', background: 'linear-gradient(135deg,var(--gold),#e6a817)',
              border: 'none', borderRadius: 10, color: '#111827',
              fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving…' : modal === 'create' ? 'Create Account' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
