import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { type SkippedAccountItem } from '@/components/SkippedAccountsPanel';
import {
  PURGE_KEPT_ADMIN_REASON,
  type SkippedRestoreItem, type UserRecord, type LinkOption,
} from './shared';

type UseUserTrashDeps = {
  // Re-fetch the whole page's data after a successful mutation.
  reloadAll: () => void;
  // Drop the inspected user's activity log if its account was just removed.
  clearHistory: () => void;
  // Id of the user currently inspected in the activity log (or null).
  historyUserId: number | null;
  // The currently visible (filtered) user rows — drives select-all.
  filtered: UserRecord[];
  // Link option lists used to build the reassign picker.
  clientOptions: LinkOption[];
  driverOptions: LinkOption[];
};

// Owns the trash workflows: row selection, bulk restore / purge, single
// restore / purge, the skipped-account result panels, and the reassign-link
// flow that resolves a blocked restore.
export function useUserTrash({
  reloadAll, clearHistory, historyUserId, filtered, clientOptions, driverOptions,
}: UseUserTrashDeps) {
  const { showToast } = useToast();
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

  async function restore(u: UserRecord) {
    setRestoringId(u.id);
    try {
      await api.post(`/users/${u.id}/restore`, {});
      showToast(`${u.name}'s account has been restored.`, 'success');
      reloadAll();
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
      reloadAll();
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
      reloadAll();
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
      reloadAll();
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
      if (historyUserId === purgeTarget.id) clearHistory();
      setPurgeTarget(null);
      reloadAll();
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
      if (historyUserId === item.id) clearHistory();
      setSkippedPurge(prev => {
        const next = (prev ?? []).filter(p => p.id !== item.id);
        return next.length > 0 ? next : null;
      });
      reloadAll();
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
      reloadAll();
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
      reloadAll();
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
      reloadAll();
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

  return {
    selectedIds, setSelectedIds, toggleSelectOne, toggleSelectAll,
    restoreAllOpen, setRestoreAllOpen, restoringAll, confirmRestoreAll,
    purgeAllOpen, setPurgeAllOpen, purgingAll, confirmPurgeAll,
    purgeSelectedOpen, setPurgeSelectedOpen, purgingSelected, confirmPurgeSelected,
    restore, restoringId,
    purgeTarget, setPurgeTarget, purging, confirmPurge,
    skippedRestore, setSkippedRestore, copyEmails,
    retryRestore, retryingRestoreId, restoreWithoutLink, resolvingRestoreId,
    unlinkConflict, unlinkingConflictId, openReassign, reassigningRestoreId,
    reassignItem, setReassignItem, reassignType, reassignOptions,
    reassignTargetId, setReassignTargetId, confirmReassign,
    skippedPurge, setSkippedPurge, retryPurge, retryingPurgeId,
  };
}
