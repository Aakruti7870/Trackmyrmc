import { useState, useEffect, useRef } from 'react';
import { Plus, Search, ShieldCheck, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import SkippedAccountsPanel, { type SkippedAccountItem } from '@/components/SkippedAccountsPanel';
import {
  ROLES, ROLE_LABEL, inputStyle, PURGE_KEPT_ADMIN_REASON,
  emptyForm, formatDate, accountLabel,
  type SkippedRestoreItem, type UserRecord, type AuditEntry, type AuditPage,
  type LinkOption, type Role, type LockoutInfo, type FormData,
  ACTION_LABEL,
} from './users/shared';
import UserTable from './users/UserTable';
import ActivityLogPanel from './users/ActivityLogPanel';
import UserFormModal from './users/UserFormModal';
import ConfirmDialog from './users/ConfirmDialog';
import ReassignLinkModal from './users/ReassignLinkModal';

export default function Users() {
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

  // Export handlers lazily import ./usersAuditExport so the heavy xlsx / jspdf
  // build code stays out of this page's static module graph (faster loads/tests).
  async function exportAuditCsv() {
    if (auditLog.length === 0) return;
    const { exportAuditCsv: run } = await import('./usersAuditExport');
    run(auditExportRows(), exportFilename('csv'));
  }

  async function exportAuditXlsx() {
    if (auditLog.length === 0) return;
    const { exportAuditXlsx: run } = await import('./usersAuditExport');
    await run(auditExportRows(), {
      filename: exportFilename('xlsx'),
      title: `Activity Log — ${exportScopeLabel()}`,
    });
  }

  async function exportAuditPdf() {
    if (auditLog.length === 0) return;
    const { exportAuditPdf: run } = await import('./usersAuditExport');
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} style={{ color: 'var(--gold)' }} />
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>User Management</h2>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            {showDeleted
              ? `${users.length} deleted ${users.length === 1 ? 'account' : 'accounts'}`
              : `${users.filter(u => u.isActive).length} active · ${users.length} total accounts`}
          </p>
          {!showDeleted && unlinkedCount > 0 && (
            <p title="Client/driver logins with no linked record — these users see an empty dashboard until linked." style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, margin: '6px 0 0',
              padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: 'rgba(245,158,11,.13)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)',
            }}>
              <AlertTriangle size={13} /> {unlinkedCount} unlinked {unlinkedCount === 1 ? 'account' : 'accounts'}
            </p>
          )}
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,var(--gold),#e6a817)', color: '#111827',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          <Plus size={15} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
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
        <button
          onClick={() => { setShowDeleted(s => !s); setSelectedIds(new Set()); }}
          title={showDeleted ? 'Show active accounts' : 'Show deleted accounts'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            background: showDeleted ? 'rgba(239,68,68,.14)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${showDeleted ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.1)'}`,
            color: showDeleted ? '#ef4444' : 'var(--muted)',
          }}
        >
          <Trash2 size={13} />
          {showDeleted ? 'Showing Deleted' : `Deleted${deletedCount ? ` (${deletedCount})` : ''}`}
        </button>
        {showDeleted && users.length > 0 && (
          <button
            onClick={() => setRestoreAllOpen(true)}
            title={selectedIds.size > 0 ? 'Restore the selected accounts' : 'Restore every account in the trash'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', color: 'var(--green)',
            }}
          >
            <RotateCcw size={13} />
            {selectedIds.size > 0 ? `Restore Selected (${selectedIds.size})` : `Restore All (${users.length})`}
          </button>
        )}
        {showDeleted && users.length > 0 && (
          <button
            onClick={() => setPurgeAllOpen(true)}
            title="Permanently delete every account in the trash"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff',
            }}
          >
            <Trash2 size={13} /> Empty Trash ({users.length})
          </button>
        )}
        {showDeleted && selectedIds.size > 0 && (
          <button
            onClick={() => setPurgeSelectedOpen(true)}
            title="Permanently delete the selected accounts"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'rgba(239,68,68,.14)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444',
            }}
          >
            <Trash2 size={13} /> Delete selected forever ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Table */}
      <UserTable
        users={filtered}
        showDeleted={showDeleted}
        selectedIds={selectedIds}
        toggleSelectOne={toggleSelectOne}
        toggleSelectAll={toggleSelectAll}
        clientOptions={clientOptions}
        driverOptions={driverOptions}
        lockoutStatus={lockoutStatus}
        now={now}
        historyUserId={historyUser?.id ?? null}
        restoringId={restoringId}
        unlocking={unlocking}
        resendingId={resendingId}
        onRestore={restore}
        onViewHistory={viewHistory}
        onPurge={setPurgeTarget}
        onUnlock={unlock}
        onEdit={openEdit}
        onResendNotification={resendNotification}
        onResendWelcome={resendWelcome}
        onDelete={setDeleteTarget}
        onToggleActive={toggleActive}
      />

      {/* Audit Log */}
      <ActivityLogPanel
        historyUserName={historyUser?.name ?? null}
        auditLog={auditLog}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        actorFilter={actorFilter}
        setActorFilter={setActorFilter}
        actorOptions={actorOptions}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        qFilter={qFilter}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        onClearFilters={clearAuditFilters}
        onClearHistory={clearHistory}
        exportMenuOpen={exportMenuOpen}
        setExportMenuOpen={setExportMenuOpen}
        exportMenuRef={exportMenuRef}
        onExportCsv={exportAuditCsv}
        onExportXlsx={exportAuditXlsx}
        onExportPdf={exportAuditPdf}
      />

      {/* Modal */}
      {modal && (
        <UserFormModal
          modal={modal}
          form={form}
          setForm={setForm}
          editingName={editing?.name}
          error={error}
          saving={saving}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          autoOpenLink={autoOpenLink}
          clientOptions={clientOptions}
          driverOptions={driverOptions}
          authorityEmails={authorityEmails}
          softDeletedMatch={softDeletedMatch}
          onClose={() => setModal(null)}
          onSave={save}
          onRestoreFromCreate={restoreFromCreate}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          icon={<AlertTriangle size={18} />}
          title="Delete Account"
          confirmIcon={<Trash2 size={14} />}
          confirmLabel="Delete Account"
          busyLabel="Deleting…"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          maxWidth={420}
        >
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
            Are you sure you want to delete <strong>{deleteTarget.name}</strong> ({deleteTarget.email})?
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            The account will be removed and can no longer log in. Their activity history stays in the
            audit log for record-keeping.
          </p>
        </ConfirmDialog>
      )}

      {/* Permanent delete confirmation modal */}
      {purgeTarget && (
        <ConfirmDialog
          tone="danger"
          icon={<AlertTriangle size={18} />}
          title="Permanently Delete Account"
          confirmIcon={<Trash2 size={14} />}
          confirmLabel="Delete Forever"
          busyLabel="Deleting…"
          busy={purging}
          onConfirm={confirmPurge}
          onCancel={() => setPurgeTarget(null)}
        >
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
            Permanently delete <strong>{purgeTarget.name}</strong> ({purgeTarget.email})?
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            This <strong style={{ color: 'var(--red)' }}>cannot be undone</strong>. The account record will be erased and
            can no longer be restored. The email <strong>{purgeTarget.email}</strong> will be freed for a brand-new
            account. The activity log keeps a record of this removal.
          </p>
        </ConfirmDialog>
      )}

      {/* Bulk-restore confirmation modal */}
      {restoreAllOpen && (
        <ConfirmDialog
          tone="success"
          icon={<RotateCcw size={18} />}
          title={selectedIds.size > 0 ? 'Restore Selected' : 'Restore All'}
          confirmIcon={<RotateCcw size={14} />}
          confirmLabel="Restore"
          busyLabel="Restoring…"
          busy={restoringAll}
          onConfirm={confirmRestoreAll}
          onCancel={() => setRestoreAllOpen(false)}
        >
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
            Restore <strong>{selectedIds.size > 0 ? selectedIds.size : users.length}</strong> deleted{' '}
            {(selectedIds.size > 0 ? selectedIds.size : users.length) === 1 ? 'account' : 'accounts'}?
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            Each account is reactivated and the change is recorded in the activity log. Any account whose linked
            client or driver is already taken by an active account is skipped — the rest are still restored.
          </p>
        </ConfirmDialog>
      )}

      {/* Skipped-restore results modal */}
      {skippedRestore && skippedRestore.length > 0 && (
        <SkippedAccountsPanel
          items={skippedRestore}
          heading={`${skippedRestore.length} ${skippedRestore.length === 1 ? 'Account' : 'Accounts'} Skipped`}
          description="These accounts could not be restored because their linked client or driver is already taken by an active account. Restore without the link to clear it, or unlink the active account elsewhere and retry."
          onCopyEmails={() => copyEmails(skippedRestore)}
          onClose={() => setSkippedRestore(null)}
          onRetry={retryRestore}
          retryingId={retryingRestoreId}
          onResolve={restoreWithoutLink}
          resolvingId={resolvingRestoreId}
          onUnlink={unlinkConflict}
          unlinkingId={unlinkingConflictId}
          onReassign={openReassign}
          reassigningId={reassigningRestoreId}
        />
      )}

      {/* Reassign-link picker modal (for a skipped restore) */}
      {reassignItem && (
        <ReassignLinkModal
          item={reassignItem}
          type={reassignType}
          options={reassignOptions}
          targetId={reassignTargetId}
          onTargetChange={setReassignTargetId}
          busy={reassigningRestoreId === reassignItem.id}
          onConfirm={confirmReassign}
          onCancel={() => setReassignItem(null)}
        />
      )}

      {/* Skipped-purge results modal */}
      {skippedPurge && skippedPurge.length > 0 && (
        <SkippedAccountsPanel
          items={skippedPurge}
          heading={`${skippedPurge.length} Admin ${skippedPurge.length === 1 ? 'Account' : 'Accounts'} Skipped`}
          description="These admin accounts were left in the trash to keep at least one admin alive. Create or restore another admin, then delete each one forever right here."
          onCopyEmails={() => copyEmails(skippedPurge)}
          onClose={() => setSkippedPurge(null)}
          onRetry={retryPurge}
          retryingId={retryingPurgeId}
          retryLabel="Delete forever"
          retryingLabel="Deleting…"
          retryTone="danger"
        />
      )}

      {/* Empty-trash (bulk purge) confirmation modal */}
      {purgeAllOpen && (
        <ConfirmDialog
          tone="danger"
          icon={<AlertTriangle size={18} />}
          title="Empty Trash"
          confirmIcon={<Trash2 size={14} />}
          confirmLabel="Empty Trash"
          busyLabel="Emptying…"
          busy={purgingAll}
          onConfirm={confirmPurgeAll}
          onCancel={() => setPurgeAllOpen(false)}
        >
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
            Permanently delete all <strong>{users.length}</strong> deleted {users.length === 1 ? 'account' : 'accounts'}?
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            This <strong style={{ color: 'var(--red)' }}>cannot be undone</strong>. Every record in the trash is erased
            and their emails are freed for new accounts. Any admin account that would leave the system without another
            admin is kept and skipped. The activity log keeps a record of each removal.
          </p>
        </ConfirmDialog>
      )}

      {/* Delete-selected (partial purge) confirmation modal */}
      {purgeSelectedOpen && (
        <ConfirmDialog
          tone="danger"
          icon={<AlertTriangle size={18} />}
          title="Delete Selected Forever"
          confirmIcon={<Trash2 size={14} />}
          confirmLabel="Delete selected forever"
          busyLabel="Deleting…"
          busy={purgingSelected}
          onConfirm={confirmPurgeSelected}
          onCancel={() => setPurgeSelectedOpen(false)}
        >
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
            Permanently delete the <strong>{selectedIds.size}</strong> selected {selectedIds.size === 1 ? 'account' : 'accounts'}?
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            This <strong style={{ color: 'var(--red)' }}>cannot be undone</strong>. The selected records are erased
            and their emails are freed for new accounts. Any admin account that would leave the system without another
            admin is kept and skipped. The activity log keeps a record of each removal.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
