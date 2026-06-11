import { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { type SkippedAccountItem } from '@/components/SkippedAccountsPanel';
import {
  PURGE_KEPT_ADMIN_REASON,
  emptyForm, formatDate, accountLabel,
  type SkippedRestoreItem, type UserRecord, type AuditEntry, type AuditPage,
  type LinkOption, type Role, type LockoutInfo, type FormData,
  ACTION_LABEL,
} from './shared';

// Owns all the state, effects and async handlers for the User Management page.
// Users.tsx consumes this hook and stays a thin presentational orchestrator that
// only wires the returned values into its child components.
export function useUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [autoOpenLink, setAutoOpenLink] = useState(false);
  const [clientOptions, setClientOptions] = useState<LinkOption[]>([]);
  const [driverOptions, setDriverOptions] = useState<LinkOption[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [lockoutStatus, setLockoutStatus] = useState<Record<number, LockoutInfo>>({});
  const [now, setNow] = useState(() => Date.now());
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [historyUser, setHistoryUser] = useState<UserRecord | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState<string>('');
  const [qFilter, setQFilter] = useState<string>('');
  const [actorOptions, setActorOptions] = useState<{ id: number | null; name: string | null; deleted?: boolean }[]>([]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  const [softDeletedMatch, setSoftDeletedMatch] = useState<{ id: number; name: string } | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<UserRecord | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeAllOpen, setPurgeAllOpen] = useState(false);
  const [purgingAll, setPurgingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [restoreAllOpen, setRestoreAllOpen] = useState(false);
  const [restoringAll, setRestoringAll] = useState(false);
  const [purgeSelectedOpen, setPurgeSelectedOpen] = useState(false);
  const [purgingSelected, setPurgingSelected] = useState(false);
  const [skippedRestore, setSkippedRestore] = useState<SkippedRestoreItem[] | null>(null);
  const [skippedPurge, setSkippedPurge] = useState<{ id: number; email: string; reason?: string }[] | null>(null);
  const [retryingPurgeId, setRetryingPurgeId] = useState<number | null>(null);
  const [retryingRestoreId, setRetryingRestoreId] = useState<number | null>(null);
  const [resolvingRestoreId, setResolvingRestoreId] = useState<number | null>(null);
  const [unlinkingConflictId, setUnlinkingConflictId] = useState<number | null>(null);
  const [reassignItem, setReassignItem] = useState<SkippedAccountItem | null>(null);
  const [reassignType, setReassignType] = useState<'client' | 'driver'>('client');
  const [reassignTargetId, setReassignTargetId] = useState<number | null>(null);
  const [reassignOptions, setReassignOptions] = useState<LinkOption[]>([]);
  const [reassigningRestoreId, setReassigningRestoreId] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [authorityEmails, setAuthorityEmails] = useState<string[]>([]);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  function loadAudit(userId: number | null) {
    const params = new URLSearchParams();
    if (userId) params.set('targetUserId', String(userId));
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (actorFilter !== 'all') {
      // Deleted actors have no id (the FK was nulled on delete) so they are
      // encoded as "name:<preservedName>" and targeted by name on the backend.
      if (actorFilter.startsWith('name:')) params.set('actorName', actorFilter.slice(5));
      else params.set('actorId', actorFilter);
    }
    if (qFilter) params.set('q', qFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const qs = params.toString();
    api.get<AuditPage>(`/audit-logs${qs ? `?${qs}` : ''}`).then(page => setAuditLog(page.rows)).catch(() => {});
  }

  function load() {
    api.get<UserRecord[]>(showDeleted ? '/users?deleted=true' : '/users').then(setUsers).catch(() => {});
    api.get<UserRecord[]>('/users?deleted=true').then(d => setDeletedCount(d.length)).catch(() => {});
    api.get<LinkOption[]>('/users/clients-list').then(setClientOptions).catch(() => {});
    api.get<LinkOption[]>('/users/drivers-list').then(setDriverOptions).catch(() => {});
    api.get<{ actors: { id: number | null; name: string | null; deleted?: boolean }[] }>('/audit-logs/facets')
      .then(f => setActorOptions(f.actors ?? [])).catch(() => {});
    loadAudit(historyUser?.id ?? null);
    api.get<Record<number, LockoutInfo>>('/users/lockout-status').then(setLockoutStatus).catch(() => {});
    api.get<{ emails: string[] }>('/users/authority-emails').then(d => setAuthorityEmails(d.emails ?? [])).catch(() => {});
  }
  // Reload the page's core data (and the selected user's audit log) when the
  // deleted-filter toggles or the inspected user changes. The audit-filter
  // inputs are intentionally excluded here — they are handled by the effect
  // below — so this effect's dependency list stays deliberately narrow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [showDeleted, historyUser?.id]);

  // Debounce the free-text search box into the committed `qFilter` so the audit
  // log isn't re-fetched on every keystroke — only ~300ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setQFilter(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Re-fetch the audit log when any of the activity-log filters change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAudit(historyUser?.id ?? null); }, [actionFilter, actorFilter, qFilter, fromDate, toDate]);

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

  // Close the export menu on outside click or Escape.
  useEffect(() => {
    if (!exportMenuOpen) return;
    function onPointer(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExportMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportMenuOpen]);

  function viewHistory(u: UserRecord) {
    setHistoryUser(u);
    loadAudit(u.id);
    document.getElementById('activity-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearHistory() {
    setHistoryUser(null);
    loadAudit(null);
  }

  function clearAuditFilters() {
    setActionFilter('all'); setActorFilter('all'); setSearchInput(''); setQFilter(''); setFromDate(''); setToDate('');
  }

  // Shared filename context (matches across CSV / Excel / PDF): user email + date.
  function exportFilename(ext: string) {
    const date = new Date().toISOString().slice(0, 10);
    const context = historyUser ? historyUser.email.replace(/[^a-zA-Z0-9._-]+/g, '-') : 'all';
    return `activity-log-${context}-${date}.${ext}`;
  }

  // A human-readable description of the active per-user filter, used in the
  // Excel sheet caption and PDF title so an exported file is self-describing.
  function exportScopeLabel() {
    return historyUser ? `${historyUser.name} (${historyUser.email})` : 'All users';
  }

  // Build the per-entry string cells (shared layout across all formats).
  function auditExportRows() {
    return auditLog.map(entry => ({
      timestamp: new Date(entry.createdAt),
      timestampText: formatDate(entry.createdAt),
      action: ACTION_LABEL[entry.action] ?? entry.action,
      detail: entry.detail ?? '',
      target: accountLabel(entry.targetUserId, entry.targetUserEmail),
      performedBy: accountLabel(entry.actorId, entry.actorName),
      emailSent: entry.emailSent === null ? '' : entry.emailSent ? 'Sent' : 'Not sent',
    }));
  }

  // Build the active per-user filter description used in the PDF title.
  function auditFilterBits() {
    const filterBits: string[] = [];
    if (actionFilter !== 'all') filterBits.push(`Action: ${ACTION_LABEL[actionFilter] ?? actionFilter}`);
    if (actorFilter !== 'all') {
      if (actorFilter.startsWith('name:')) {
        const name = actorFilter.slice(5).trim();
        filterBits.push(`Performed By: ${name || '[deleted]'} (deleted)`);
      } else {
        const actor = actorOptions.find(a => String(a.id) === actorFilter);
        filterBits.push(`Performed By: ${actor?.name?.trim() || `User #${actorFilter}`}`);
      }
    }
    if (qFilter) filterBits.push(`Search: "${qFilter}"`);
    if (fromDate) filterBits.push(`From: ${fromDate}`);
    if (toDate) filterBits.push(`To: ${toDate}`);
    return filterBits;
  }

  // Export handlers lazily import ../usersAuditExport so the heavy xlsx / jspdf
  // build code stays out of this page's static module graph (faster loads/tests).
  async function exportAuditCsv() {
    if (auditLog.length === 0) return;
    const { exportAuditCsv: run } = await import('../usersAuditExport');
    run(auditExportRows(), exportFilename('csv'));
  }

  async function exportAuditXlsx() {
    if (auditLog.length === 0) return;
    const { exportAuditXlsx: run } = await import('../usersAuditExport');
    await run(auditExportRows(), {
      filename: exportFilename('xlsx'),
      title: `Activity Log — ${exportScopeLabel()}`,
    });
  }

  async function exportAuditPdf() {
    if (auditLog.length === 0) return;
    const { exportAuditPdf: run } = await import('../usersAuditExport');
    await run(auditExportRows(), {
      filename: exportFilename('pdf'),
      scopeLabel: exportScopeLabel(),
      filterBits: auditFilterBits(),
    });
  }

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

  async function restore(u: UserRecord) {
    setRestoringId(u.id);
    try {
      await api.post(`/users/${u.id}/restore`, {});
      showToast(`${u.name}'s account has been restored.`, 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to restore account.', 'error');
    } finally {
      setRestoringId(null);
    }
  }

  async function retryRestore(item: SkippedAccountItem) {
    setRetryingRestoreId(item.id);
    try {
      await api.post(`/users/${item.id}/restore`, {});
      showToast(`${item.email} has been restored.`, 'success');
      setSkippedRestore(prev => {
        const next = (prev ?? []).filter(r => r.id !== item.id);
        return next.length ? next : null;
      });
      load();
    } catch (e: unknown) {
      const reason = e instanceof Error ? e.message : 'Failed to restore account.';
      setSkippedRestore(prev =>
        (prev ?? []).map(r => (r.id === item.id ? { ...r, reason } : r)),
      );
      showToast(reason, 'error');
    } finally {
      setRetryingRestoreId(null);
    }
  }

  async function restoreWithoutLink(item: SkippedAccountItem) {
    setResolvingRestoreId(item.id);
    try {
      await api.post(`/users/${item.id}/restore`, { clearLink: true });
      showToast(`${item.email} was restored with its linked client/driver cleared.`, 'success');
      setSkippedRestore(prev => {
        const next = (prev ?? []).filter(r => r.id !== item.id);
        return next.length ? next : null;
      });
      load();
    } catch (e: unknown) {
      const reason = e instanceof Error ? e.message : 'Failed to restore account.';
      setSkippedRestore(prev =>
        (prev ?? []).map(r => (r.id === item.id ? { ...r, reason } : r)),
      );
      showToast(reason, 'error');
    } finally {
      setResolvingRestoreId(null);
    }
  }

  // Unlink the active account that's blocking a skipped restore, then retry the
  // restore so the row drops off the list — closing the loop from one place.
  async function unlinkConflict(item: SkippedAccountItem) {
    if (item.conflictUserId == null || !item.conflictLinkType) return;
    setUnlinkingConflictId(item.id);
    try {
      const body = item.conflictLinkType === 'client'
        ? { linkedClientId: null }
        : { linkedDriverId: null };
      await api.put(`/users/${item.conflictUserId}`, body);
      showToast(
        `${item.conflictUserName ?? 'The conflicting account'} was unlinked from its ${item.conflictLinkType}.`,
        'success',
      );
      await retryRestore(item);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to unlink the conflicting account.', 'error');
    } finally {
      setUnlinkingConflictId(null);
    }
  }

  // Open the reassign picker for a skipped restore: offer only clients/drivers
  // (matching the conflicting link type) that aren't already taken by an active
  // account, so picking one is guaranteed to clear the conflict.
  async function openReassign(item: SkippedAccountItem) {
    const type = item.conflictLinkType;
    if (!type) return;
    let active: UserRecord[] = [];
    try {
      active = await api.get<UserRecord[]>('/users');
    } catch {
      // Fall back to the full list if active links can't be loaded; the server
      // still rejects a taken target with a clear 409.
    }
    const taken = new Set(
      active
        .map(u => (type === 'client' ? u.linkedClientId : u.linkedDriverId))
        .filter((x): x is number => x != null),
    );
    const all = type === 'client' ? clientOptions : driverOptions;
    setReassignOptions(all.filter(o => !taken.has(o.id)));
    setReassignType(type);
    setReassignTargetId(null);
    setReassignItem(item);
  }

  async function confirmReassign() {
    if (!reassignItem || reassignTargetId == null) return;
    const item = reassignItem;
    setReassigningRestoreId(item.id);
    try {
      const body = reassignType === 'client'
        ? { linkedClientId: reassignTargetId }
        : { linkedDriverId: reassignTargetId };
      await api.post(`/users/${item.id}/restore`, body);
      showToast(`${item.email} was restored with a new ${reassignType} link.`, 'success');
      setSkippedRestore(prev => {
        const next = (prev ?? []).filter(r => r.id !== item.id);
        return next.length ? next : null;
      });
      setReassignItem(null);
      load();
    } catch (e: unknown) {
      const reason = e instanceof Error ? e.message : 'Failed to reassign the link.';
      setSkippedRestore(prev =>
        (prev ?? []).map(r => (r.id === item.id ? { ...r, reason } : r)),
      );
      showToast(reason, 'error');
    } finally {
      setReassigningRestoreId(null);
    }
  }

  async function copyEmails(items: { email: string }[]) {
    const text = items.map(i => i.email).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(
        items.length === 1 ? 'Email copied to clipboard.' : `${items.length} emails copied to clipboard.`,
        'success',
      );
    } catch {
      showToast('Could not copy emails to clipboard.', 'error');
    }
  }

  async function confirmPurge() {
    if (!purgeTarget) return;
    setPurging(true);
    try {
      await api.delete(`/users/${purgeTarget.id}/permanent`);
      showToast(`${purgeTarget.name}'s account has been permanently deleted.`, 'success');
      if (historyUser?.id === purgeTarget.id) clearHistory();
      setPurgeTarget(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to permanently delete account.', 'error');
    } finally {
      setPurging(false);
    }
  }

  // Retry a permanent delete that was skipped to preserve the last admin. Once
  // another admin account exists, this succeeds and the row drops off the panel;
  // if it's still the only admin, the server's guard surfaces as a clear toast.
  async function retryPurge(item: SkippedAccountItem) {
    setRetryingPurgeId(item.id);
    try {
      await api.delete(`/users/${item.id}/permanent`);
      showToast(`${item.email} has been permanently deleted.`, 'success');
      if (historyUser?.id === item.id) clearHistory();
      setSkippedPurge(prev => {
        const next = (prev ?? []).filter(p => p.id !== item.id);
        return next.length > 0 ? next : null;
      });
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to permanently delete account.', 'error');
    } finally {
      setRetryingPurgeId(null);
    }
  }

  async function confirmPurgeAll() {
    setPurgingAll(true);
    try {
      const result = await api.delete<{ purged: number; skipped: number; skippedAdmins: { id: number; email: string }[] }>('/users/purge-all');
      if (result.purged === 0 && result.skipped === 0) {
        showToast('There were no deleted accounts to remove.', 'info');
      } else {
        const purgedMsg = `${result.purged} ${result.purged === 1 ? 'account' : 'accounts'} permanently deleted.`;
        if (result.skipped > 0) {
          showToast(
            `${purgedMsg} ${result.skipped} admin ${result.skipped === 1 ? 'account was' : 'accounts were'} skipped — see details below.`,
            'info',
          );
          setSkippedPurge(result.skippedAdmins.map(a => ({ ...a, reason: PURGE_KEPT_ADMIN_REASON })));
        } else {
          showToast(purgedMsg, 'success');
        }
      }
      clearHistory();
      setPurgeAllOpen(false);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to empty the trash.', 'error');
    } finally {
      setPurgingAll(false);
    }
  }

  async function confirmRestoreAll() {
    const ids = selectedIds.size > 0 ? [...selectedIds] : undefined;
    setRestoringAll(true);
    try {
      const result = await api.post<{ restored: number; skipped: number; skippedDetails: SkippedRestoreItem[] }>(
        '/users/restore-all',
        ids ? { ids } : {},
      );
      if (result.restored === 0 && result.skipped === 0) {
        showToast('There were no deleted accounts to restore.', 'info');
      } else if (result.skipped > 0) {
        const restoredMsg = result.restored > 0
          ? `${result.restored} ${result.restored === 1 ? 'account' : 'accounts'} restored. `
          : '';
        showToast(
          `${restoredMsg}${result.skipped} ${result.skipped === 1 ? 'account was' : 'accounts were'} skipped — see details below.`,
          'info',
        );
        setSkippedRestore(result.skippedDetails);
      } else {
        showToast(`${result.restored} ${result.restored === 1 ? 'account' : 'accounts'} restored.`, 'success');
      }
      setSelectedIds(new Set());
      setRestoreAllOpen(false);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to restore accounts.', 'error');
    } finally {
      setRestoringAll(false);
    }
  }

  async function confirmPurgeSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setPurgingSelected(true);
    try {
      const result = await api.delete<{ purged: number; skipped: number; skippedAdmins: { id: number; email: string }[] }>('/users/purge-all', { ids });
      if (result.purged === 0 && result.skipped === 0) {
        showToast('There were no deleted accounts to remove.', 'info');
      } else {
        const purgedMsg = `${result.purged} ${result.purged === 1 ? 'account' : 'accounts'} permanently deleted.`;
        if (result.skipped > 0) {
          showToast(
            `${purgedMsg} ${result.skipped} admin ${result.skipped === 1 ? 'account was' : 'accounts were'} skipped — see details below.`,
            'info',
          );
          setSkippedPurge(result.skippedAdmins.map(a => ({ ...a, reason: PURGE_KEPT_ADMIN_REASON })));
        } else {
          showToast(purgedMsg, 'success');
        }
      }
      clearHistory();
      setPurgeSelectedOpen(false);
      setSelectedIds(new Set());
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to delete the selected accounts.', 'error');
    } finally {
      setPurgingSelected(false);
    }
  }

  function toggleSelectOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(prev => {
      const allSelected = filtered.length > 0 && filtered.every(u => prev.has(u.id));
      if (allSelected) return new Set();
      return new Set(filtered.map(u => u.id));
    });
  }

  async function restoreFromCreate() {
    if (!softDeletedMatch) return;
    setSaving(true); setError('');
    try {
      await api.post(`/users/${softDeletedMatch.id}/restore`, {});
      showToast(`${softDeletedMatch.name}'s account has been restored.`, 'success');
      setSoftDeletedMatch(null);
      setModal(null);
      setShowDeleted(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to restore account.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      showToast(`${deleteTarget.name}'s account has been deleted.`, 'success');
      if (historyUser?.id === deleteTarget.id) clearHistory();
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to delete account.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setForm(emptyForm());
    setEditing(null);
    setError('');
    setSoftDeletedMatch(null);
    setShowPassword(false);
    setAutoOpenLink(false);
    setModal('create');
  }

  function openEdit(u: UserRecord, focusLink = false) {
    setForm({
      name: u.name, email: u.email, password: '',
      role: u.role as Role, isActive: u.isActive,
      linkedClientId: u.linkedClientId, linkedDriverId: u.linkedDriverId,
    });
    setEditing(u);
    setError('');
    setShowPassword(false);
    setAutoOpenLink(focusLink);
    setModal('edit');
  }

  async function save() {
    setSaving(true); setError(''); setSoftDeletedMatch(null);
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
        const result = await api.put<{ emailSent?: boolean }>(`/users/${editing!.id}`, payload);
        if (form.password) {
          if (result.emailSent) {
            showToast('Password updated — notification email sent to user.', 'info');
          } else {
            showToast('Password updated — email not sent (check SMTP config).', 'error');
          }
        }
      }
      load(); setModal(null);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.data?.code === 'email_soft_deleted') {
        setSoftDeletedMatch({
          id: Number(e.data.deletedUserId),
          name: String(e.data.deletedUserName ?? 'this account'),
        });
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'An error occurred');
      }
    } finally { setSaving(false); }
  }

  async function toggleActive(u: UserRecord) {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch {
      /* ignore — toggle failure is non-critical */
    }
  }

  async function resendNotification(u: UserRecord) {
    try {
      const result = await api.post<{ emailSent: boolean }>(`/users/${u.id}/resend-notification`, {});
      if (result.emailSent) {
        showToast(`Notification email sent to ${u.email}.`, 'success');
      } else {
        showToast('Email not sent — check SMTP configuration.', 'error');
      }
    } catch {
      showToast('Failed to resend notification.', 'error');
    }
  }

  async function resendWelcome(u: UserRecord) {
    setResendingId(u.id);
    try {
      const result = await api.post<{ emailSent?: boolean }>(`/users/${u.id}/resend-welcome`, {});
      if (result.emailSent) {
        showToast(`Welcome email re-sent to ${u.email}.`, 'info');
      } else {
        showToast('Welcome email not sent (check SMTP config).', 'error');
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to resend welcome email.', 'error');
    } finally {
      setResendingId(null);
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
    // core data + derived
    users, filtered, unlinkedCount,
    // top filters
    search, setSearch, roleFilter, setRoleFilter,
    showDeleted, setShowDeleted, deletedCount,
    // selection + bulk
    selectedIds, setSelectedIds, toggleSelectOne, toggleSelectAll,
    restoreAllOpen, setRestoreAllOpen, restoringAll, confirmRestoreAll,
    purgeAllOpen, setPurgeAllOpen, purgingAll, confirmPurgeAll,
    purgeSelectedOpen, setPurgeSelectedOpen, purgingSelected, confirmPurgeSelected,
    // link options + lockout
    clientOptions, driverOptions, lockoutStatus, now,
    // history + per-row actions
    historyUser, restoringId, unlocking, resendingId,
    restore, viewHistory, unlock, resendNotification, resendWelcome, toggleActive,
    // audit log + filters
    auditLog, actionFilter, setActionFilter, actorFilter, setActorFilter, actorOptions,
    searchInput, setSearchInput, qFilter, fromDate, setFromDate, toDate, setToDate,
    clearAuditFilters, clearHistory,
    // export menu
    exportMenuOpen, setExportMenuOpen, exportMenuRef,
    exportAuditCsv, exportAuditXlsx, exportAuditPdf,
    // create/edit modal
    modal, setModal, form, setForm, editing, error, saving,
    showPassword, setShowPassword, autoOpenLink, authorityEmails,
    softDeletedMatch, openCreate, openEdit, save, restoreFromCreate,
    // delete confirmations
    deleteTarget, setDeleteTarget, deleting, confirmDelete,
    purgeTarget, setPurgeTarget, purging, confirmPurge,
    // skipped-restore panel + reassign
    skippedRestore, setSkippedRestore, copyEmails,
    retryRestore, retryingRestoreId, restoreWithoutLink, resolvingRestoreId,
    unlinkConflict, unlinkingConflictId, openReassign, reassigningRestoreId,
    reassignItem, setReassignItem, reassignType, reassignOptions,
    reassignTargetId, setReassignTargetId, confirmReassign,
    // skipped-purge panel
    skippedPurge, setSkippedPurge, retryPurge, retryingPurgeId,
  };
}
