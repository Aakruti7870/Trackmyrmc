import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { type UserRecord, type LinkOption, type LockoutInfo } from './shared';

// Owns the core user directory: the user list + top filters, the link option
// lists, the soft-deleted count, and the account-lockout status (including the
// live countdown ticker). `reload` re-fetches every list this hook owns and is
// composed into the page-wide reload after any mutation.
export function useUsersDirectory() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [clientOptions, setClientOptions] = useState<LinkOption[]>([]);
  const [driverOptions, setDriverOptions] = useState<LinkOption[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  const [lockoutStatus, setLockoutStatus] = useState<Record<number, LockoutInfo>>({});
  const [now, setNow] = useState(() => Date.now());
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [authorityEmails, setAuthorityEmails] = useState<string[]>([]);

  const reload = useCallback(() => {
    api.get<UserRecord[]>(showDeleted ? '/users?deleted=true' : '/users').then(setUsers).catch(() => {});
    api.get<UserRecord[]>('/users?deleted=true').then(d => setDeletedCount(d.length)).catch(() => {});
    api.get<LinkOption[]>('/users/clients-list').then(setClientOptions).catch(() => {});
    api.get<LinkOption[]>('/users/drivers-list').then(setDriverOptions).catch(() => {});
    api.get<Record<number, LockoutInfo>>('/users/lockout-status').then(setLockoutStatus).catch(() => {});
    api.get<{ emails: string[] }>('/users/authority-emails').then(d => setAuthorityEmails(d.emails ?? [])).catch(() => {});
  }, [showDeleted]);

  // Reload the directory's lists when the deleted-filter toggles (and on mount).
  useEffect(reload, [reload]);

  // While any account is locked, poll the lockout status so the locked badge
  // clears itself once the lockout window expires — no manual reload needed.
  const anyLocked = Object.values(lockoutStatus).some(l => l.locked);
  useEffect(() => {
    if (!anyLocked) return;
    const id = setInterval(() => {
      api.get<Record<number, LockoutInfo>>('/users/lockout-status').then(setLockoutStatus).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [anyLocked]);

  // Tick `now` every second while an account is locked so the badge can show a
  // live mm:ss countdown derived from `lockedUntil` between the 30s polls.
  useEffect(() => {
    if (!anyLocked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyLocked]);

  async function unlock(u: UserRecord) {
    setUnlocking(u.id);
    try {
      await api.post(`/users/${u.id}/unlock`, {});
      setLockoutStatus(prev => ({ ...prev, [u.id]: { locked: false, lockedUntil: null } }));
      showToast(`${u.name}'s account has been unlocked.`, 'success');
    } catch {
      showToast('Failed to unlock account.', 'error');
    } finally {
      setUnlocking(null);
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const unlinkedCount = users.filter(u =>
    (u.role === 'client' && !u.linkedClientId) ||
    (u.role === 'driver' && !u.linkedDriverId)
  ).length;

  return {
    users, filtered, unlinkedCount,
    search, setSearch, roleFilter, setRoleFilter,
    showDeleted, setShowDeleted, deletedCount,
    clientOptions, driverOptions,
    lockoutStatus, now, unlocking, unlock,
    authorityEmails,
    reload,
  };
}
