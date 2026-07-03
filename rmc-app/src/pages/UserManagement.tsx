import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Factory, MapPin, Users, UserRound, ArrowLeft, Search, Plus, X,
  Eye, Pencil, PauseCircle, PlayCircle, Trash2, KeyRound, Send, RotateCcw,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { ROLE_LABEL, ROLE_COLOR, type Role } from './users/shared';

// ---------------------------------------------------------------------------
// Plant-wise User Management: plant cards → per-plant user list with the full
// account lifecycle. Backed by /api/user-management (authority sees all plants;
// a plant_owner / plant-scoped admin only their own).
// ---------------------------------------------------------------------------

type PlantCard = {
  id: number;
  name: string;
  plantCode: string | null;
  city: string | null;
  address: string | null;
  status: 'active' | 'suspended';
  staffCount: number;
  customerCount: number;
};

type PlantUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  suspensionReason: string | null;
  createdAt: string;
  deletedAt: string | null;
};

// Roles creatable through this console, ordered for the pickers.
const MANAGED_ROLES = [
  'plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator',
  'accountant', 'quality_engineer', 'fleet_manager', 'store_manager',
  'driver', 'client',
] as const;

// Client-side mirror of the server hierarchy (the server re-checks everything).
function creatableRoles(actorRole: string): string[] {
  if (actorRole === 'authority') return [...MANAGED_ROLES];
  if (actorRole === 'plant_owner') return MANAGED_ROLES.filter(r => r !== 'plant_owner');
  return MANAGED_ROLES.filter(r => r !== 'plant_owner' && r !== 'admin');
}

const card: React.CSSProperties = {
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border)',
  borderRadius: 14,
  padding: 16,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--glass-2)',
  border: '1px solid var(--glass-border)',
  borderRadius: 10,
  color: 'var(--text)',
  padding: '9px 12px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
};

const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', minWidth: 120 };

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  border: '1px solid var(--glass-border)', borderRadius: 10,
  background: 'var(--glass-2)', color: 'var(--text)',
  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
};

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 10px',
      color: active ? 'var(--green)' : 'var(--red)',
      background: active ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
      border: `1px solid ${active ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {label ?? (active ? 'Active' : 'Suspended')}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLOR[role as Role] ?? 'var(--muted)';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 10px',
      color, background: 'color-mix(in srgb, currentColor 12%, transparent)',
      border: '1px solid color-mix(in srgb, currentColor 35%, transparent)',
    }}>
      {ROLE_LABEL[role as Role] ?? role}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...card, background: 'var(--card-bg, var(--bg))', width: '100%', maxWidth: 440,
          maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ ...btn, padding: 6 }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 4, display: 'block' };

export default function UserManagement() {
  const { user: me } = useAuth();
  const { showToast } = useToast();

  // null = not yet loaded (loading indicator); [] = loaded but empty. Using the
  // null sentinel keeps the loaders as pure promise-chains, so the effects below
  // never call setState synchronously (react-hooks/set-state-in-effect).
  const [plants, setPlants] = useState<PlantCard[] | null>(null);
  const [selected, setSelected] = useState<PlantCard | null>(null);
  const loadingPlants = plants === null;

  // Plant-level filters
  const [plantSearch, setPlantSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // User-level state
  const [usersLive, setUsersLive] = useState<PlantUser[] | null>(null);
  const [usersDeleted, setUsersDeleted] = useState<PlantUser[] | null>(null);
  const loadingUsers = usersLive === null || usersDeleted === null;
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // Modals
  const [viewing, setViewing] = useState<PlantUser | null>(null);
  const [editing, setEditing] = useState<PlantUser | null>(null);
  const [suspending, setSuspending] = useState<PlantUser | null>(null);
  const [deleting, setDeleting] = useState<PlantUser | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadPlants = useCallback(() => {
    api.get<PlantCard[]>('/user-management/plants')
      .then(rows => {
        setPlants(rows);
        // Keep the drilled-in card's counts fresh after mutations.
        setSelected(prev => prev ? rows.find(p => p.id === prev.id) ?? prev : prev);
      })
      .catch(() => {
        setPlants(prev => prev ?? []);
        showToast('Failed to load plants.', 'error');
      });
  }, [showToast]);

  useEffect(loadPlants, [loadPlants]);

  // Guards against a slow response for a previously selected plant landing
  // after the user has already drilled into a different one.
  const usersRequestRef = useRef(0);
  const loadUsers = useCallback((plantId: number) => {
    const requestId = ++usersRequestRef.current;
    Promise.all([
      api.get<PlantUser[]>(`/user-management/plants/${plantId}/users`),
      api.get<PlantUser[]>(`/user-management/plants/${plantId}/users?deleted=true`),
    ])
      .then(([live, deleted]) => {
        if (usersRequestRef.current !== requestId) return;
        setUsersLive(live);
        setUsersDeleted(deleted);
      })
      .catch(() => {
        if (usersRequestRef.current !== requestId) return;
        setUsersLive(prev => prev ?? []);
        setUsersDeleted(prev => prev ?? []);
        showToast('Failed to load users.', 'error');
      });
  }, [showToast]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId != null) loadUsers(selectedId);
  }, [selectedId, loadUsers]);

  const reload = useCallback(() => {
    loadPlants();
    if (selected) loadUsers(selected.id);
  }, [loadPlants, loadUsers, selected]);

  const cities = useMemo(
    () => Array.from(new Set((plants ?? []).map(p => p.city).filter((c): c is string => !!c))).sort(),
    [plants],
  );

  const filteredPlants = useMemo(() => {
    const q = plantSearch.trim().toLowerCase();
    return (plants ?? []).filter(p => {
      if (cityFilter !== 'all' && p.city !== cityFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q)
        || (p.plantCode ?? '').toLowerCase().includes(q)
        || (p.city ?? '').toLowerCase().includes(q);
    });
  }, [plants, plantSearch, cityFilter, statusFilter]);

  const shownUsers = useMemo(() => {
    const src = (tab === 'active' ? usersLive : usersDeleted) ?? [];
    const q = userSearch.trim().toLowerCase();
    return src.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (tab === 'active' && userStatusFilter !== 'all') {
        if (userStatusFilter === 'active' && !u.isActive) return false;
        if (userStatusFilter === 'suspended' && u.isActive) return false;
      }
      if (!q) return true;
      return u.name.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q)
        || (u.phone ?? '').toLowerCase().includes(q)
        || (ROLE_LABEL[u.role as Role] ?? u.role).toLowerCase().includes(q);
    });
  }, [tab, usersLive, usersDeleted, userSearch, roleFilter, userStatusFilter]);

  async function run(action: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await action();
      showToast(okMsg, 'success');
      reload();
      return true;
    } catch (err) {
      const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong.';
      showToast(msg, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend(u: PlantUser, reason?: string) {
    const ok = await run(
      () => api.put(`/user-management/users/${u.id}`, u.isActive
        ? { isActive: false, suspensionReason: reason || undefined }
        : { isActive: true }),
      u.isActive ? `${u.name} suspended.` : `${u.name} resumed.`,
    );
    if (ok) setSuspending(null);
  }

  async function resetPassword(u: PlantUser) {
    await run(() => api.post(`/user-management/users/${u.id}/reset-password`, {}), `Reset instructions sent to ${u.email}.`);
  }

  async function sendInvite(u: PlantUser) {
    setBusy(true);
    try {
      const res = await api.post<{ emailSent: boolean; inviteUrl?: string }>(`/user-management/users/${u.id}/send-invite`, {});
      if (res.emailSent) {
        showToast(`Invitation link emailed to ${u.email}.`, 'success');
      } else if (res.inviteUrl) {
        await navigator.clipboard?.writeText(res.inviteUrl).catch(() => {});
        showToast('Email is not configured — the invitation link was copied to your clipboard.', 'info');
      } else {
        showToast('Could not send the invitation link.', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send the invitation link.', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------ render

  if (!selected) {
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)', flex: '1 1 auto' }}>Plant User Management</h2>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
            <input
              value={plantSearch}
              onChange={e => setPlantSearch(e.target.value)}
              placeholder="Search plant, ID or city…"
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={selectStyle} aria-label="City filter">
            <option value="all">All cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {loadingPlants ? (
          <div style={{ color: 'var(--muted)', padding: 30, textAlign: 'center' }}>Loading plants…</div>
        ) : filteredPlants.length === 0 ? (
          <div style={{ ...card, color: 'var(--muted)', textAlign: 'center', padding: 34 }}>No plants match.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {filteredPlants.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setSelected(p); setTab('active'); setUserSearch(''); setRoleFilter('all'); setUserStatusFilter('all');
                  setUsersLive(null); setUsersDeleted(null);
                }}
                style={{ ...card, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: 10, flex: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)',
                    }}>
                      <Factory size={18} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.plantCode || `#${p.id}`}</div>
                    </div>
                  </div>
                  <StatusBadge active={p.status === 'active'} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <MapPin size={13} /> {p.city || p.address || '—'}
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Users size={14} style={{ color: 'var(--gold)' }} /> {p.staffCount} staff
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <UserRound size={14} style={{ color: 'var(--blue)' }} /> {p.customerCount} customers
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------- per-plant drill-in

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <button onClick={() => setSelected(null)} style={btn}><ArrowLeft size={15} /> Plants</button>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.name}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {selected.plantCode || `#${selected.id}`}{selected.city ? ` · ${selected.city}` : ''} · {selected.staffCount} staff · {selected.customerCount} customers
          </div>
        </div>
        <StatusBadge active={selected.status === 'active'} />
        <button onClick={() => setAdding(true)} style={{ ...btn, background: 'var(--gold)', color: '#fff', borderColor: 'transparent' }}>
          <Plus size={15} /> Add User
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
          <input
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            placeholder="Search name, email, mobile or role…"
            style={{ ...inputStyle, paddingLeft: 30 }}
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={selectStyle} aria-label="Role filter">
          <option value="all">All roles</option>
          {MANAGED_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r as Role] ?? r}</option>)}
        </select>
        {tab === 'active' && (
          <select value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value)} style={selectStyle} aria-label="User status filter">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['active', 'deleted'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...btn,
              background: tab === t ? 'var(--gold)' : 'var(--glass-2)',
              color: tab === t ? '#fff' : 'var(--text)',
              borderColor: tab === t ? 'transparent' : 'var(--glass-border)',
            }}
          >
            {t === 'active' ? `Users (${usersLive?.length ?? 0})` : `Deleted (${usersDeleted?.length ?? 0})`}
          </button>
        ))}
      </div>

      {loadingUsers ? (
        <div style={{ color: 'var(--muted)', padding: 30, textAlign: 'center' }}>Loading users…</div>
      ) : shownUsers.length === 0 ? (
        <div style={{ ...card, color: 'var(--muted)', textAlign: 'center', padding: 34 }}>
          {tab === 'deleted' ? 'No deleted users.' : 'No users match.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
          {shownUsers.map(u => (
            <div key={u.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.phone || 'No mobile'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flex: 'none' }}>
                  <RoleBadge role={u.role} />
                  {tab === 'active'
                    ? <StatusBadge active={u.isActive} />
                    : <StatusBadge active={false} label="Deleted" />}
                </div>
              </div>
              {!u.isActive && u.suspensionReason && tab === 'active' && (
                <div style={{ fontSize: 11, color: 'var(--red)' }}>Reason: {u.suspensionReason}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                {tab === 'active' ? (
                  <>
                    <button title="View" onClick={() => setViewing(u)} style={{ ...btn, padding: '6px 9px' }}><Eye size={14} /></button>
                    <button title="Edit" onClick={() => setEditing(u)} style={{ ...btn, padding: '6px 9px' }}><Pencil size={14} /></button>
                    {u.isActive ? (
                      <button title="Suspend" disabled={busy} onClick={() => setSuspending(u)} style={{ ...btn, padding: '6px 9px', color: 'var(--red)' }}><PauseCircle size={14} /></button>
                    ) : (
                      <button title="Resume" disabled={busy} onClick={() => toggleSuspend(u)} style={{ ...btn, padding: '6px 9px', color: 'var(--green)' }}><PlayCircle size={14} /></button>
                    )}
                    <button title="Reset password" disabled={busy} onClick={() => resetPassword(u)} style={{ ...btn, padding: '6px 9px' }}><KeyRound size={14} /></button>
                    <button title="Send invitation link" disabled={busy} onClick={() => sendInvite(u)} style={{ ...btn, padding: '6px 9px' }}><Send size={14} /></button>
                    <button title="Delete" disabled={busy} onClick={() => setDeleting(u)} style={{ ...btn, padding: '6px 9px', color: 'var(--red)' }}><Trash2 size={14} /></button>
                  </>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => run(() => api.post(`/user-management/users/${u.id}/restore`, {}), `${u.name} restored.`)}
                    style={{ ...btn, color: 'var(--green)' }}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <Modal title="User details" onClose={() => setViewing(null)}>
          <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text)' }}>
            <div><span style={fieldLabel}>Name</span>{viewing.name}</div>
            <div><span style={fieldLabel}>Email</span>{viewing.email}</div>
            <div><span style={fieldLabel}>Mobile</span>{viewing.phone || '—'}</div>
            <div><span style={fieldLabel}>Role</span><RoleBadge role={viewing.role} /></div>
            <div><span style={fieldLabel}>Status</span><StatusBadge active={viewing.isActive} /></div>
            {!viewing.isActive && viewing.suspensionReason && (
              <div><span style={fieldLabel}>Suspension reason</span>{viewing.suspensionReason}</div>
            )}
            <div><span style={fieldLabel}>Plant</span>{selected.name} ({selected.plantCode || `#${selected.id}`})</div>
            <div><span style={fieldLabel}>Created</span>{new Date(viewing.createdAt).toLocaleString()}</div>
          </div>
        </Modal>
      )}

      {suspending && (
        <SuspendModal
          user={suspending}
          busy={busy}
          onClose={() => setSuspending(null)}
          onConfirm={reason => toggleSuspend(suspending, reason)}
        />
      )}

      {deleting && (
        <Modal title="Delete user?" onClose={() => setDeleting(null)}>
          <p style={{ fontSize: 13, color: 'var(--text)', marginTop: 0 }}>
            <strong>{deleting.name}</strong> will be moved to the Deleted tab. You can restore the account later.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleting(null)} style={btn}>Cancel</button>
            <button
              disabled={busy}
              onClick={async () => {
                const ok = await run(() => api.delete(`/user-management/users/${deleting.id}`), `${deleting.name} moved to Deleted.`);
                if (ok) setDeleting(null);
              }}
              style={{ ...btn, background: 'var(--red)', color: '#fff', borderColor: 'transparent' }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <EditModal
          user={editing}
          actorRole={me?.role ?? ''}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async payload => {
            const ok = await run(() => api.put(`/user-management/users/${editing.id}`, payload), 'User updated.');
            if (ok) setEditing(null);
          }}
        />
      )}

      {adding && (
        <AddModal
          actorRole={me?.role ?? ''}
          busy={busy}
          onClose={() => setAdding(false)}
          onSave={async payload => {
            setBusy(true);
            try {
              const res = await api.post<{ emailSent: boolean; inviteUrl?: string }>(`/user-management/plants/${selected.id}/users`, payload);
              if (res.emailSent) {
                showToast('User added — invitation link emailed.', 'success');
              } else if (res.inviteUrl) {
                await navigator.clipboard?.writeText(res.inviteUrl).catch(() => {});
                showToast('User added. Email is not configured — the invitation link was copied to your clipboard.', 'info');
              } else {
                showToast('User added.', 'success');
              }
              setAdding(false);
              reload();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Failed to add user.', 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function SuspendModal({ user, busy, onClose, onConfirm }: {
  user: PlantUser; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Suspend ${user.name}?`} onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
        They will not be able to sign in until resumed. You can add an optional reason (shown to them at login).
      </p>
      <label style={fieldLabel}>Reason (optional)</label>
      <input value={reason} onChange={e => setReason(e.target.value)} style={inputStyle} placeholder="e.g. Payment overdue" />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={btn}>Cancel</button>
        <button disabled={busy} onClick={() => onConfirm(reason)} style={{ ...btn, background: 'var(--red)', color: '#fff', borderColor: 'transparent' }}>
          Suspend
        </button>
      </div>
    </Modal>
  );
}

function EditModal({ user, actorRole, busy, onClose, onSave }: {
  user: PlantUser; actorRole: string; busy: boolean; onClose: () => void;
  onSave: (payload: { name: string; phone: string | null; role: string }) => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState(user.role);
  const roles = creatableRoles(actorRole);
  // Always allow keeping the current role even if the actor could not mint it.
  const roleOptions = roles.includes(user.role) ? roles : [user.role, ...roles];
  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>Mobile</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="Optional" />
        </div>
        <div>
          <label style={fieldLabel}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
            {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABEL[r as Role] ?? r}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn}>Cancel</button>
          <button
            disabled={busy || !name.trim()}
            onClick={() => onSave({ name: name.trim(), phone: phone.trim() || null, role })}
            style={{ ...btn, background: 'var(--gold)', color: '#fff', borderColor: 'transparent' }}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddModal({ actorRole, busy, onClose, onSave }: {
  actorRole: string; busy: boolean; onClose: () => void;
  onSave: (payload: { name: string; email: string; phone?: string; role: string }) => void;
}) {
  const roles = creatableRoles(actorRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(roles[0] ?? 'dispatcher');
  const canSave = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email);
  return (
    <Modal title="Add user" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} type="email" />
        </div>
        <div>
          <label style={fieldLabel}>Mobile (optional)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
            {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r as Role] ?? r}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
          The new user receives an invitation link by email to set up their access.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn}>Cancel</button>
          <button
            disabled={busy || !canSave}
            onClick={() => onSave({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, role })}
            style={{ ...btn, background: 'var(--gold)', color: '#fff', borderColor: 'transparent' }}
          >
            Add user
          </button>
        </div>
      </div>
    </Modal>
  );
}
