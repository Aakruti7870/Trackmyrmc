import { useState, useEffect } from 'react';
import { Plus, Edit2, X, Search, ShieldCheck, UserCog, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';

type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
  createdAt: string;
};

type LinkOption = { id: number; name: string };

const ROLES = ['admin', 'dispatcher', 'plant_operator', 'client', 'driver'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  plant_operator: 'Plant Operator',
  client: 'Client',
  driver: 'Driver',
};

const ROLE_COLOR: Record<Role, string> = {
  admin: '#f7c948',
  dispatcher: '#38bdf8',
  plant_operator: '#22c55e',
  client: '#a78bfa',
  driver: '#f97316',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, color: '#eef5ff', fontSize: 13, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#9fb0c7', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px',
};

type FormData = {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
};

const emptyForm = (): FormData => ({
  name: '', email: '', password: '', role: 'dispatcher',
  isActive: true, linkedClientId: null, linkedDriverId: null,
});

export default function Users() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientOptions, setClientOptions] = useState<LinkOption[]>([]);
  const [driverOptions, setDriverOptions] = useState<LinkOption[]>([]);

  function load() {
    api.get<UserRecord[]>('/users').then(setUsers).catch(() => {});
    api.get<LinkOption[]>('/users/clients-list').then(setClientOptions).catch(() => {});
    api.get<LinkOption[]>('/users/drivers-list').then(setDriverOptions).catch(() => {});
  }
  useEffect(load, []);

  function openCreate() {
    setForm(emptyForm());
    setEditing(null);
    setError('');
    setShowPassword(false);
    setModal('create');
  }

  function openEdit(u: UserRecord) {
    setForm({
      name: u.name, email: u.email, password: '',
      role: u.role as Role, isActive: u.isActive,
      linkedClientId: u.linkedClientId, linkedDriverId: u.linkedDriverId,
    });
    setEditing(u);
    setError('');
    setShowPassword(false);
    setModal('edit');
  }

  async function save() {
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        if (!form.password || form.password.length < 6) {
          setError('Password must be at least 6 characters'); setSaving(false); return;
        }
        await api.post('/users', {
          name: form.name, email: form.email, password: form.password,
          role: form.role, linkedClientId: form.linkedClientId, linkedDriverId: form.linkedDriverId,
        });
      } else {
        if (form.password && form.password.length < 6) {
          setError('New password must be at least 6 characters'); setSaving(false); return;
        }
        const payload: Record<string, unknown> = {
          name: form.name, role: form.role, isActive: form.isActive,
          linkedClientId: form.linkedClientId, linkedDriverId: form.linkedDriverId,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing!.id}`, payload);
      }
      load(); setModal(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  async function toggleActive(u: UserRecord) {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch {}
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const needsClientLink = form.role === 'client';
  const needsDriverLink = form.role === 'driver';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} color="#f7c948" />
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>User Management</h2>
          </div>
          <p style={{ margin: '4px 0 0', color: '#9fb0c7', fontSize: 13 }}>
            {users.filter(u => u.isActive).length} active · {users.length} total accounts
          </p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,#f7c948,#e6a817)', color: '#111827',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          <Plus size={15} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9fb0c7' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <select
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
        >
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
        border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.15)' }}>
              {['User', 'Email', 'Role', 'Status', 'Linked To', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9fb0c7' }}>No users found</td>
              </tr>
            )}
            {filtered.map(u => {
              const roleColor = ROLE_COLOR[u.role as Role] || '#9fb0c7';
              const linked = u.linkedClientId
                ? `Client #${u.linkedClientId} — ${clientOptions.find(c => c.id === u.linkedClientId)?.name ?? '…'}`
                : u.linkedDriverId
                ? `Driver #${u.linkedDriverId} — ${driverOptions.find(d => d.id === u.linkedDriverId)?.name ?? '…'}`
                : '—';
              return (
                <tr key={u.id} style={{
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  background: u.isActive ? 'transparent' : 'rgba(239,68,68,.03)',
                  opacity: u.isActive ? 1 : 0.65,
                }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: roleColor + '20', border: `1px solid ${roleColor}35`,
                        display: 'grid', placeItems: 'center',
                        fontSize: 12, fontWeight: 800, color: roleColor,
                      }}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: '#eef5ff' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#9fb0c7' }}>{u.email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: roleColor + '20', color: roleColor, border: `1px solid ${roleColor}35`,
                    }}>
                      {ROLE_LABEL[u.role as Role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => toggleActive(u)}
                      style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: u.isActive ? '#22c55e20' : '#ef444420',
                        color: u.isActive ? '#22c55e' : '#ef4444',
                        border: `1px solid ${u.isActive ? '#22c55e35' : '#ef444435'}`,
                      }}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#9fb0c7', fontSize: 12 }}>{linked}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => openEdit(u)} style={{
                      background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 7, color: '#9fb0c7', cursor: 'pointer', padding: '5px 8px',
                    }}>
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,#0d1930,#081422)',
            border: '1px solid rgba(255,255,255,.1)', borderRadius: 18,
            width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24,
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCog size={18} color="#f7c948" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {modal === 'create' ? 'Add New User' : `Edit — ${editing?.name}`}
                </h3>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#9fb0c7', cursor: 'pointer' }}>
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

              {/* Password — required on create, optional on edit */}
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
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9fb0c7', cursor: 'pointer', padding: 2 }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {modal === 'edit' && (
                  <span style={{ fontSize: 11, color: '#9fb0c7', marginTop: 4, display: 'block' }}>
                    Leave blank to keep current password. Must be at least 6 characters if changed.
                  </span>
                )}
              </label>

              {/* Role */}
              <label>
                <span style={labelStyle}>Role</span>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({
                    ...f, role: e.target.value as Role,
                    linkedClientId: null, linkedDriverId: null,
                  }))}
                  style={inputStyle}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </label>

              {/* Linked Client — shown for client role */}
              {needsClientLink && (
                <label>
                  <span style={labelStyle}>Linked Client Account</span>
                  <select
                    value={form.linkedClientId ?? ''}
                    onChange={e => setForm(f => ({ ...f, linkedClientId: e.target.value ? parseInt(e.target.value) : null }))}
                    style={inputStyle}
                  >
                    <option value="">— None —</option>
                    {clientOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: '#9fb0c7', marginTop: 4, display: 'block' }}>
                    Links this login to a client record so "My Orders" shows their data.
                  </span>
                </label>
              )}

              {/* Linked Driver — shown for driver role */}
              {needsDriverLink && (
                <label>
                  <span style={labelStyle}>Linked Driver Record</span>
                  <select
                    value={form.linkedDriverId ?? ''}
                    onChange={e => setForm(f => ({ ...f, linkedDriverId: e.target.value ? parseInt(e.target.value) : null }))}
                    style={inputStyle}
                  >
                    <option value="">— None —</option>
                    {driverOptions.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: '#9fb0c7', marginTop: 4, display: 'block' }}>
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
                      background: form.isActive ? '#22c55e' : 'rgba(255,255,255,.12)',
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#eef5ff' }}>
                      {form.isActive ? 'Account Active' : 'Account Deactivated'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9fb0c7' }}>
                      Deactivated accounts cannot log in but their data is preserved.
                    </div>
                  </div>
                </label>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModal(null)} style={{
                  flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                  color: '#9fb0c7', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving} style={{
                  flex: 2, padding: '10px', background: 'linear-gradient(135deg,#f7c948,#e6a817)',
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
      )}
    </div>
  );
}
