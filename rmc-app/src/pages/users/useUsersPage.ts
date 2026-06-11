import { useCallback } from 'react';
import { useUsersDirectory } from './useUsersDirectory';
import { useAuditLog } from './useAuditLog';
import { useUserForm } from './useUserForm';
import { useUserTrash } from './useUserTrash';

// Composes the four focused User Management hooks into the single object that
// Users.tsx consumes. Each hook owns one cohesive concern:
//   - useUsersDirectory — the user list + filters, link options, lockout status
//   - useAuditLog       — activity-log filtering + export
//   - useUserForm       — create/edit/delete CRUD + per-row email actions
//   - useUserTrash      — trash bulk restore/purge + skipped-account reassign
// Cross-cutting glue (a single page-wide reload, history clearing) is wired here
// so the hooks stay independent and individually readable/testable.
export function useUsersPage() {
  const { reload: reloadDirectory, ...directory } = useUsersDirectory();
  const { reload: reloadAudit, ...audit } = useAuditLog();

  const historyUserId = audit.historyUser?.id ?? null;

  // The page-wide refresh used after any mutation: re-fetch the directory's
  // lists and the activity log (rows + actor facets) in one call.
  const reloadAll = useCallback(() => {
    reloadDirectory();
    reloadAudit();
  }, [reloadDirectory, reloadAudit]);

  const form = useUserForm({
    reloadAll,
    clearHistory: audit.clearHistory,
    historyUserId,
    setShowDeleted: directory.setShowDeleted,
  });

  const trash = useUserTrash({
    reloadAll,
    clearHistory: audit.clearHistory,
    historyUserId,
    filtered: directory.filtered,
    clientOptions: directory.clientOptions,
    driverOptions: directory.driverOptions,
  });

  return { ...directory, ...audit, ...form, ...trash };
}
