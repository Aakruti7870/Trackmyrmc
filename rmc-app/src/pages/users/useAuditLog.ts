import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  formatDate, accountLabel,
  type UserRecord, type AuditEntry, type AuditPage,
  ACTION_LABEL,
} from './shared';

// Owns the activity-log: which user is being inspected, the filter inputs,
// the fetched audit rows + actor facets, and the CSV / Excel / PDF export menu.
// `reload` re-fetches the facets and the current view's rows, and is composed
// into the page-wide reload after any mutation.
export function useAuditLog() {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [historyUser, setHistoryUser] = useState<UserRecord | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState<string>('');
  const [qFilter, setQFilter] = useState<string>('');
  const [actorOptions, setActorOptions] = useState<{ id: number | null; name: string | null; deleted?: boolean }[]>([]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const loadAudit = useCallback((userId: number | null) => {
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
  }, [actionFilter, actorFilter, qFilter, fromDate, toDate]);

  const loadFacets = useCallback(() => {
    api.get<{ actors: { id: number | null; name: string | null; deleted?: boolean }[] }>('/audit-logs/facets')
      .then(f => setActorOptions(f.actors ?? [])).catch(() => {});
  }, []);

  // Re-fetch the actor facets and the current view's audit rows. Called by the
  // page-wide reload after any mutation that may change the log or its actors.
  const reload = useCallback(() => {
    loadFacets();
    loadAudit(historyUser?.id ?? null);
  }, [loadFacets, loadAudit, historyUser?.id]);

  // Load the actor facets once on mount.
  useEffect(() => { loadFacets(); }, [loadFacets]);

  // Debounce the free-text search box into the committed `qFilter` so the audit
  // log isn't re-fetched on every keystroke — only ~300ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setQFilter(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Re-fetch the audit log when the inspected user or any filter changes (and on
  // mount). loadAudit closes over the filter state via useCallback deps.
  useEffect(() => { loadAudit(historyUser?.id ?? null); }, [loadAudit, historyUser?.id]);

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

  return {
    historyUser, auditLog,
    actionFilter, setActionFilter, actorFilter, setActorFilter, actorOptions,
    searchInput, setSearchInput, qFilter, fromDate, setFromDate, toDate, setToDate,
    clearAuditFilters, clearHistory, viewHistory,
    exportMenuOpen, setExportMenuOpen, exportMenuRef,
    exportAuditCsv, exportAuditXlsx, exportAuditPdf,
    reload,
  };
}
