import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, X, Search, ShieldCheck, UserCog, Eye, EyeOff, ClipboardList, CheckCircle, XCircle, Send, LockOpen, Mail, History, Trash2, AlertTriangle, RotateCcw, Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import SearchableSelect from '@/components/SearchableSelect';
import SkippedAccountsPanel, { type SkippedAccountItem } from '@/components/SkippedAccountsPanel';

type SkippedRestoreItem = {
  id: number;
  email: string;
  reason: string;
  conflictUserId?: number;
  conflictUserName?: string;
  conflictLinkType?: 'client' | 'driver';
};

// Shown under each kept admin in the skipped-purge panel so the admin knows why
// the delete was blocked and how the inline "Delete forever" retry will unblock.
const PURGE_KEPT_ADMIN_REASON =
  'Kept so the system always has at least one admin. Once another admin account is active, delete it forever here.';

type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
  createdAt: string;
  deletedAt: string | null;
  auditCount: number;
};

type AuditEntry = {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  targetUserId: number | null;
  targetUserEmail: string | null;
  detail: string | null;
  emailSent: boolean | null;
  createdAt: string;
};

type AuditPage = {
  rows: AuditEntry[];
  hasMore: boolean;
};

type LinkOption = { id: number; name: string };

const ROLES = ['authority', 'admin', 'dispatcher', 'plant_operator', 'client', 'driver'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  authority: 'Authority',
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  plant_operator: 'Plant Operator',
  client: 'Client',
  driver: 'Driver',
};

const ROLE_COLOR: Record<Role, string> = {
  authority: '#e879f9',
  admin: 'var(--gold)',
  dispatcher: 'var(--blue)',
  plant_operator: 'var(--green)',
  client: '#a78bfa',
  driver: '#f97316',
};

const ACTION_LABEL: Record<string, string> = {
  password_reset: 'Password Reset',
  password_reset_email: 'Password-Reset Email',
  welcome_email: 'Welcome Email',
  lockout_cleared: 'Lockout Cleared',
  name_change: 'Name Changed',
  role_change: 'Role Changed',
  account_activated: 'Account Activated',
  account_deactivated: 'Account Deactivated',
  client_link_change: 'Client Link Changed',
  driver_link_change: 'Driver Link Changed',
  'user.created': 'Account Created',
  'user.deleted': 'Account Deleted',
  'user.restored': 'Account Restored',
  'user.purged': 'Account Purged',
};

const ACTION_COLOR: Record<string, string> = {
  password_reset: '#38bdf8',
  password_reset_email: '#38bdf8',
  welcome_email: '#a78bfa',
  lockout_cleared: '#22c55e',
  name_change: '#a78bfa',
  role_change: '#f7c948',
  account_activated: '#22c55e',
  account_deactivated: '#ef4444',
  client_link_change: '#38bdf8',
  driver_link_change: '#f97316',
  'user.created': '#22c55e',
  'user.deleted': '#ef4444',
  'user.restored': '#22c55e',
  'user.purged': '#ef4444',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px',
};

type LockoutInfo = { locked: boolean; lockedUntil: number | null };

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

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Format a remaining-time span (ms) as mm:ss, clamped at zero. */
function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Human-readable label for an audit account reference (actor or target). */
function accountLabel(id: number | null, label: string | null) {
  const text = label?.trim();
  if (!text) return '[deleted]';
  return id === null ? `${text} (deleted)` : text;
}

const AUDIT_EXPORT_HEADERS = ['Timestamp', 'Action', 'Details', 'Target Account', 'Performed By', 'Email Sent'] as const;

const deletedTagStyle: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
  background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)',
  textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
};

/**
 * Render an audit-log account reference (actor or target). The FK may be null
 * because the account was deleted (ON DELETE SET NULL), but the human-readable
 * label is preserved at write time. Show the preserved label plus a "deleted"
 * tag, or "[deleted]" when no label was captured.
 */
function AccountRef({ id, label }: { id: number | null; label: string | null }) {
  const text = label?.trim();
  if (!text) {
    return <span style={{ color: '#6b7a90', fontStyle: 'italic' }}>[deleted]</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {text}
      {id === null && <span style={deletedTagStyle}>deleted</span>}
    </span>
  );
}

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
  const [actorOptions, setActorOptions] = useState<{ id: number; name: string | null }[]>([]);
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [authorityEmails, setAuthorityEmails] = useState<string[]>([]);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  function loadAudit(userId: number | null) {
    const params = new URLSearchParams();
    if (userId) params.set('targetUserId', String(userId));
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (actorFilter !== 'all') params.set('actorId', actorFilter);
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
    api.get<{ actors: { id: number; name: string | null }[] }>('/audit-logs/facets')
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

  // Re-fetch the audit log when any of the activity-log filters change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAudit(historyUser?.id ?? null); }, [actionFilter, actorFilter, fromDate, toDate]);

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

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportAuditCsv() {
    if (auditLog.length === 0) return;
    const escape = (value: string) => {
      const needsQuote = /[",\r\n]/.test(value);
      const escaped = value.replace(/"/g, '""');
      return needsQuote ? `"${escaped}"` : escaped;
    };
    const rows = auditExportRows().map(r => [
      r.timestampText, r.action, r.detail, r.target, r.performedBy, r.emailSent,
    ]);
    const csv = [[...AUDIT_EXPORT_HEADERS], ...rows]
      .map(row => row.map(cell => escape(String(cell))).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, exportFilename('csv'));
  }

  // Native .xlsx export. The timestamp column carries real Date values (rendered
  // with a date/time number format) so spreadsheet apps treat it as a date, and
  // the header row is bolded with sized columns and a filter dropdown.
  function exportAuditXlsx() {
    if (auditLog.length === 0) return;
    const rows = auditExportRows();
    const aoa: (string | Date)[][] = [
      [...AUDIT_EXPORT_HEADERS],
      ...rows.map(r => [r.timestamp, r.action, r.detail, r.target, r.performedBy, r.emailSent]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');

    // Apply a date/time number format to the timestamp column (col 0).
    for (let row = 1; row <= range.e.r; row++) {
      const ref = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cell = ws[ref];
      if (cell && cell.t === 'd') cell.z = 'dd-mmm-yyyy hh:mm';
    }

    // Style + bold the header row (ignored by readers that don't support styles,
    // but honored by Excel/LibreOffice and the xlsx writer's style path).
    for (let col = 0; col <= range.e.c; col++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c: col });
      const cell = ws[ref];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: 'FF1B2433' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'FFF7C948' } },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      }
    }

    ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 44 }, { wch: 26 }, { wch: 26 }, { wch: 12 }];
    ws['!autofilter'] = { ref: ws['!ref'] ?? 'A1' };
    ws['!freeze'] = { xSplit: '0', ySplit: '1', topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `Activity Log — ${exportScopeLabel()}`,
      CreatedDate: new Date(),
    };
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerDownload(
      new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      exportFilename('xlsx'),
    );
  }

  // Real .pdf export: build the file client-side with jsPDF + autoTable and
  // download it directly (no new window or print dialog), matching the CSV/Excel
  // one-click flow. Layout mirrors the former print view — title, scope, active
  // filters, gold styled header, zebra rows — so the file stays self-describing.
  async function exportAuditPdf() {
    if (auditLog.length === 0) return;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const rows = auditExportRows();
    const filterBits: string[] = [];
    if (actionFilter !== 'all') filterBits.push(`Action: ${ACTION_LABEL[actionFilter] ?? actionFilter}`);
    if (actorFilter !== 'all') {
      const actor = actorOptions.find(a => String(a.id) === actorFilter);
      filterBits.push(`Performed By: ${actor?.name?.trim() || `User #${actorFilter}`}`);
    }
    if (fromDate) filterBits.push(`From: ${fromDate}`);
    if (toDate) filterBits.push(`To: ${toDate}`);
    const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const marginX = 28;

    doc.setTextColor(27, 36, 51); // #1b2433
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Activity Log', marginX, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(85, 85, 85); // #555
    doc.text(`Scope: ${exportScopeLabel()}`, marginX, 54);

    let cursorY = 54;
    if (filterBits.length) {
      cursorY += 15;
      doc.text(`Filters: ${filterBits.join('  ·  ')}`, marginX, cursorY);
    }

    cursorY += 14;
    doc.setFontSize(9);
    doc.setTextColor(136, 136, 136); // #888
    const entryWord = rows.length === 1 ? 'entry' : 'entries';
    doc.text(`${rows.length} ${entryWord} · Generated ${generated}`, marginX, cursorY);

    autoTable(doc, {
      startY: cursorY + 10,
      margin: { left: marginX, right: marginX },
      head: [[...AUDIT_EXPORT_HEADERS]],
      body: rows.map(r => [r.timestampText, r.action, r.detail, r.target, r.performedBy, r.emailSent]),
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 4,
        textColor: [27, 36, 51],
        lineColor: [208, 213, 221], // #d0d5dd
        lineWidth: 0.5,
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [247, 201, 72], // #f7c948
        textColor: [27, 36, 51],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [246, 248, 251] }, // #f6f8fb
      columnStyles: {
        0: { cellWidth: 95 },
        2: { cellWidth: 'auto' },
        5: { cellWidth: 55 },
      },
    });

    doc.save(exportFilename('pdf'));
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

  const needsClientLink = form.role === 'client';
  const needsDriverLink = form.role === 'driver';

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
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
        border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.15)' }}>
              {showDeleted && (
                <th style={{ padding: '11px 14px', width: 1, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    aria-label="Select all deleted accounts"
                    title="Select all"
                    checked={filtered.length > 0 && filtered.every(u => selectedIds.has(u.id))}
                    ref={el => {
                      if (el) {
                        const selectedVisible = filtered.filter(u => selectedIds.has(u.id)).length;
                        el.indeterminate = selectedVisible > 0 && selectedVisible < filtered.length;
                      }
                    }}
                    onChange={toggleSelectAll}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gold)' }}
                  />
                </th>
              )}
              {['User', 'Email', 'Role', 'Status', 'Linked To', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showDeleted ? 7 : 6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No users found</td>
              </tr>
            )}
            {filtered.map(u => {
              const roleColor = ROLE_COLOR[u.role as Role] || 'var(--muted)';
              const linked = u.linkedClientId
                ? `Client #${u.linkedClientId} — ${clientOptions.find(c => c.id === u.linkedClientId)?.name ?? '…'}`
                : u.linkedDriverId
                ? `Driver #${u.linkedDriverId} — ${driverOptions.find(d => d.id === u.linkedDriverId)?.name ?? '…'}`
                : '—';
              const isUnlinked = (u.role === 'client' && !u.linkedClientId) ||
                (u.role === 'driver' && !u.linkedDriverId);
              const lockout = lockoutStatus[u.id];
              const isLocked = lockout?.locked === true;
              const lockExpiry = lockout?.lockedUntil
                ? new Date(lockout.lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : null;
              // Warn admins when a lockout is about to lift (under ~2 min left).
              // Derived purely from lockedUntil vs. now, so the 30s poll re-render
              // moves the badge into its "expiring soon" state on its own.
              const lockMsLeft = lockout?.lockedUntil ? lockout.lockedUntil - now : 0;
              const lockExpiringSoon = isLocked && lockMsLeft > 0 && lockMsLeft <= 120000;
              const lockCountdown = isLocked && lockMsLeft > 0 ? formatCountdown(lockMsLeft) : null;
              return (
                <tr key={u.id} style={{
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  background: isLocked ? 'rgba(239,160,68,.04)' : u.isActive ? 'transparent' : 'rgba(239,68,68,.03)',
                  opacity: u.isActive ? 1 : 0.65,
                }}>
                  {showDeleted && (
                    <td style={{ padding: '12px 14px', width: 1, whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.name}`}
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelectOne(u.id)}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gold)' }}
                      />
                    </td>
                  )}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${roleColor} 21%, transparent)`,
                        display: 'grid', placeItems: 'center',
                        fontSize: 12, fontWeight: 800, color: roleColor,
                      }}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{u.email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, color: roleColor, border: `1px solid color-mix(in srgb, ${roleColor} 21%, transparent)`,
                    }}>
                      {ROLE_LABEL[u.role as Role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                      {showDeleted ? (
                        <span title={u.deletedAt ? `Deleted ${formatDate(u.deletedAt)}` : 'Deleted'} style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: '#ef444420', color: 'var(--red)', border: '1px solid #ef444435', whiteSpace: 'nowrap',
                        }}>
                          Deleted{u.deletedAt ? ` · ${formatDate(u.deletedAt)}` : ''}
                        </span>
                      ) : (
                      <button
                        onClick={() => toggleActive(u)}
                        style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          background: u.isActive ? '#22c55e20' : '#ef444420',
                          color: u.isActive ? 'var(--green)' : 'var(--red)',
                          border: `1px solid ${u.isActive ? '#22c55e35' : '#ef444435'}`,
                        }}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </button>
                      )}
                      {!showDeleted && isLocked && (
                        <span
                          title={
                            lockExpiringSoon
                              ? `Unlocking in ${lockCountdown ?? '0:00'}${lockExpiry ? ` (around ${lockExpiry})` : ''}`
                              : lockCountdown
                                ? `Unlocking in ${lockCountdown}${lockExpiry ? ` (around ${lockExpiry})` : ''}`
                                : lockExpiry ? `Locked until ${lockExpiry}` : 'Locked'
                          }
                          style={{
                            padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: lockExpiringSoon ? '#facc1520' : '#f9731620',
                            color: lockExpiringSoon ? '#facc15' : '#f97316',
                            border: `1px solid ${lockExpiringSoon ? '#facc1545' : '#f9731635'}`,
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {lockExpiringSoon
                            ? `⏳ Unlocking in ${lockCountdown ?? '0:00'}`
                            : lockCountdown
                              ? `🔒 Locked · ${lockCountdown}`
                              : `🔒 Locked${lockExpiry ? ` until ${lockExpiry}` : ''}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>
                    {isUnlinked ? (
                      <button
                        type="button"
                        onClick={() => openEdit(u, true)}
                        title={`This ${ROLE_LABEL[u.role as Role] ?? u.role} login has no ${u.role === 'client' ? 'client' : 'driver'} record linked — they will see an empty ${u.role === 'client' ? 'My Orders' : 'My Trips'} screen. Click to link a record.`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: 'rgba(245,158,11,.13)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)',
                          whiteSpace: 'nowrap', cursor: 'pointer',
                        }}
                      >
                        <AlertTriangle size={12} /> Link record
                      </button>
                    ) : linked}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {showDeleted ? (
                        <>
                          <button
                            onClick={() => restore(u)}
                            disabled={restoringId === u.id}
                            title="Restore account"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: restoringId === u.id ? 'rgba(34,197,94,.1)' : 'rgba(34,197,94,.15)',
                              border: '1px solid rgba(34,197,94,.3)',
                              borderRadius: 7, color: 'var(--green)',
                              cursor: restoringId === u.id ? 'not-allowed' : 'pointer',
                              padding: '5px 10px', fontSize: 11, fontWeight: 700,
                            }}
                          >
                            <RotateCcw size={12} />
                            {restoringId === u.id ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            onClick={() => viewHistory(u)}
                            title={`View activity history (${u.auditCount} ${u.auditCount === 1 ? 'entry' : 'entries'})`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: historyUser?.id === u.id ? 'rgba(247,201,72,.16)' : 'rgba(247,201,72,.08)',
                              border: `1px solid ${historyUser?.id === u.id ? 'rgba(247,201,72,.4)' : 'rgba(247,201,72,.18)'}`,
                              borderRadius: 7, color: 'var(--gold)', cursor: 'pointer', padding: '5px 8px', fontSize: 11, fontWeight: 700,
                            }}
                          >
                            <History size={13} />
                            {u.auditCount}
                          </button>
                          <button
                            onClick={() => setPurgeTarget(u)}
                            title="Permanently delete account (frees the email)"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
                              borderRadius: 7, color: 'var(--red)', cursor: 'pointer',
                              padding: '5px 10px', fontSize: 11, fontWeight: 700,
                            }}
                          >
                            <Trash2 size={12} /> Delete Forever
                          </button>
                        </>
                      ) : (
                      <>
                      {isLocked && (
                        <button
                          onClick={() => unlock(u)}
                          disabled={unlocking === u.id}
                          title="Unlock account"
                          style={{
                            background: unlocking === u.id ? 'rgba(249,115,22,.1)' : 'rgba(249,115,22,.15)',
                            border: '1px solid rgba(249,115,22,.3)',
                            borderRadius: 7, color: '#f97316', cursor: unlocking === u.id ? 'not-allowed' : 'pointer',
                            padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 700,
                          }}
                        >
                          <LockOpen size={12} />
                          {unlocking === u.id ? '…' : 'Unlock'}
                        </button>
                      )}
                      <button
                        onClick={() => viewHistory(u)}
                        title={`View activity history (${u.auditCount} ${u.auditCount === 1 ? 'entry' : 'entries'})`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: historyUser?.id === u.id ? 'rgba(247,201,72,.16)' : 'rgba(247,201,72,.08)',
                          border: `1px solid ${historyUser?.id === u.id ? 'rgba(247,201,72,.4)' : 'rgba(247,201,72,.18)'}`,
                          borderRadius: 7, color: 'var(--gold)', cursor: 'pointer', padding: '5px 8px', fontSize: 11, fontWeight: 700,
                        }}
                      >
                        <History size={13} />
                        {u.auditCount}
                      </button>
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit user"
                        style={{
                          background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
                          borderRadius: 7, color: 'var(--muted)', cursor: 'pointer', padding: '5px 8px',
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => resendNotification(u)}
                        title="Resend notification email"
                        style={{
                          background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)',
                          borderRadius: 7, color: 'var(--blue)', cursor: 'pointer', padding: '5px 8px',
                        }}
                      >
                        <Send size={13} />
                      </button>
                      <button
                        onClick={() => resendWelcome(u)}
                        disabled={resendingId === u.id}
                        title="Resend welcome email"
                        style={{
                          background: 'rgba(247,201,72,.1)', border: '1px solid rgba(247,201,72,.25)',
                          borderRadius: 7, color: 'var(--gold)',
                          cursor: resendingId === u.id ? 'not-allowed' : 'pointer',
                          padding: '5px 8px', opacity: resendingId === u.id ? 0.6 : 1,
                        }}
                      >
                        <Mail size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Delete user"
                        style={{
                          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
                          borderRadius: 7, color: 'var(--red)', cursor: 'pointer', padding: '5px 8px',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                      </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Audit Log */}
      <div id="activity-log" style={{ marginTop: 32, scrollMarginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, flexWrap: 'wrap' }}>
          <ClipboardList size={18} color="#f7c948" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            {historyUser ? `Activity Log — ${historyUser.name}` : 'Activity Log'}
          </h3>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(247,201,72,.12)', color: '#f7c948', border: '1px solid rgba(247,201,72,.25)',
          }}>
            {auditLog.length} {auditLog.length === 1 ? 'entry' : 'entries'}
          </span>
          {historyUser && (
            <button
              onClick={clearHistory}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', color: 'var(--muted)',
              }}
            >
              <X size={12} /> Showing {historyUser.email} — Show all
            </button>
          )}
        </div>

        {/* Activity-log filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Action Type</label>
            <select
              value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
            >
              <option value="all">All Actions</option>
              {Object.keys(ACTION_LABEL).map(a => (
                <option key={a} value={a}>{ACTION_LABEL[a]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Performed By</label>
            <select
              value={actorFilter} onChange={e => setActorFilter(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
            >
              <option value="all">All Actors</option>
              {actorOptions.map(a => (
                <option key={a.id} value={String(a.id)}>{a.name?.trim() || `User #${a.id}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>From</label>
            <input
              type="date" value={fromDate} max={toDate || undefined}
              onChange={e => setFromDate(e.target.value)}
              style={{ ...inputStyle, width: 'auto', colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input
              type="date" value={toDate} min={fromDate || undefined}
              onChange={e => setToDate(e.target.value)}
              style={{ ...inputStyle, width: 'auto', colorScheme: 'dark' }}
            />
          </div>
          {(actionFilter !== 'all' || actorFilter !== 'all' || fromDate || toDate) && (
            <button
              onClick={() => { setActionFilter('all'); setActorFilter('all'); setFromDate(''); setToDate(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px',
                borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'var(--muted)',
              }}
            >
              <X size={13} /> Clear Filters
            </button>
          )}
          {auditLog.length > 0 && (
            <div ref={exportMenuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
              <button
                onClick={() => setExportMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                title={historyUser ? `Export ${historyUser.email}'s activity log` : 'Export the activity log'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px',
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: 'rgba(247,201,72,.12)', border: '1px solid rgba(247,201,72,.3)', color: '#f7c948',
                }}
              >
                <Download size={13} /> Export
                <ChevronDown size={13} style={{ transform: exportMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {exportMenuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, minWidth: 180,
                    background: '#0e1a2e', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10,
                    boxShadow: '0 12px 30px rgba(0,0,0,.45)', overflow: 'hidden', padding: 4,
                  }}
                >
                  {([
                    { key: 'csv', label: 'CSV (.csv)', icon: <FileText size={14} />, fn: exportAuditCsv },
                    { key: 'xlsx', label: 'Excel (.xlsx)', icon: <FileSpreadsheet size={14} />, fn: exportAuditXlsx },
                    { key: 'pdf', label: 'PDF (.pdf)', icon: <FileText size={14} />, fn: exportAuditPdf },
                  ] as const).map(item => (
                    <button
                      key={item.key}
                      role="menuitem"
                      onClick={() => { setExportMenuOpen(false); item.fn(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                        padding: '9px 11px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        background: 'transparent', border: 'none', color: 'var(--text)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: '#f7c948', display: 'flex' }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          background: 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
          border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden',
        }}>
          {auditLog.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9fb0c7', fontSize: 13 }}>
              {(actionFilter !== 'all' || actorFilter !== 'all' || fromDate || toDate)
                ? 'No activity matches the selected filters.'
                : historyUser
                ? `No activity recorded for ${historyUser.name} yet.`
                : 'No activity recorded yet. Account changes and password resets will appear here.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.15)' }}>
                  {['Timestamp', 'Action', 'Details', 'Target Account', 'Performed By', 'Email Sent'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLog.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(entry.createdAt)}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {(() => {
                        const c = ACTION_COLOR[entry.action] ?? '#9fb0c7';
                        return (
                          <span style={{
                            padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: `color-mix(in srgb, ${c} 13%, transparent)`,
                            color: c, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`,
                          }}>
                            {ACTION_LABEL[entry.action] ?? entry.action}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12 }}>{entry.detail ?? '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#eef5ff' }}>
                      <AccountRef id={entry.targetUserId} label={entry.targetUserEmail} />
                    </td>
                    <td style={{ padding: '11px 14px', color: '#9fb0c7' }}>
                      <AccountRef id={entry.actorId} label={entry.actorName} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {entry.emailSent === null ? (
                        <span style={{ color: '#9fb0c7', fontSize: 12 }}>—</span>
                      ) : entry.emailSent ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
                          <CheckCircle size={13} /> Sent
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
                          <XCircle size={13} /> Not sent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(255,255,255,.1)', borderRadius: 18,
            width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24,
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCog size={18} style={{ color: 'var(--gold)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {modal === 'create' ? 'Add New User' : `Edit — ${editing?.name}`}
                </h3>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
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
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2 }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {modal === 'edit' && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
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
                      background: form.isActive ? 'var(--green)' : 'rgba(255,255,255,.12)',
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
                      onClick={restoreFromCreate}
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
                <button onClick={() => setModal(null)} style={{
                  flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                  color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving} style={{
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
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(239,68,68,.25)', borderRadius: 18,
            width: '100%', maxWidth: 420, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
                display: 'grid', placeItems: 'center', color: 'var(--red)',
              }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Delete Account</h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> ({deleteTarget.email})?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              The account will be removed and can no longer log in. Their activity history stays in the
              audit log for record-keeping.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{
                flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                color: 'var(--muted)', fontWeight: 600, fontSize: 13,
                cursor: deleting ? 'not-allowed' : 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} style={{
                flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
              }}>
                <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent delete confirmation modal */}
      {purgeTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(239,68,68,.3)', borderRadius: 18,
            width: '100%', maxWidth: 440, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
                display: 'grid', placeItems: 'center', color: 'var(--red)',
              }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Permanently Delete Account</h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              Permanently delete <strong>{purgeTarget.name}</strong> ({purgeTarget.email})?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              This <strong style={{ color: 'var(--red)' }}>cannot be undone</strong>. The account record will be erased and
              can no longer be restored. The email <strong>{purgeTarget.email}</strong> will be freed for a brand-new
              account. The activity log keeps a record of this removal.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPurgeTarget(null)} disabled={purging} style={{
                flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                color: 'var(--muted)', fontWeight: 600, fontSize: 13,
                cursor: purging ? 'not-allowed' : 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={confirmPurge} disabled={purging} style={{
                flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: purging ? 'not-allowed' : 'pointer', opacity: purging ? 0.7 : 1,
              }}>
                <Trash2 size={14} /> {purging ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk-restore confirmation modal */}
      {restoreAllOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(34,197,94,.3)', borderRadius: 18,
            width: '100%', maxWidth: 440, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)',
                display: 'grid', placeItems: 'center', color: 'var(--green)',
              }}>
                <RotateCcw size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                {selectedIds.size > 0 ? 'Restore Selected' : 'Restore All'}
              </h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              Restore <strong>{selectedIds.size > 0 ? selectedIds.size : users.length}</strong> deleted{' '}
              {(selectedIds.size > 0 ? selectedIds.size : users.length) === 1 ? 'account' : 'accounts'}?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              Each account is reactivated and the change is recorded in the activity log. Any account whose linked
              client or driver is already taken by an active account is skipped — the rest are still restored.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRestoreAllOpen(false)} disabled={restoringAll} style={{
                flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                color: 'var(--muted)', fontWeight: 600, fontSize: 13,
                cursor: restoringAll ? 'not-allowed' : 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={confirmRestoreAll} disabled={restoringAll} style={{
                flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: restoringAll ? 'not-allowed' : 'pointer', opacity: restoringAll ? 0.7 : 1,
              }}>
                <RotateCcw size={14} /> {restoringAll ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
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
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(239,68,68,.3)', borderRadius: 18,
            width: '100%', maxWidth: 440, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
                display: 'grid', placeItems: 'center', color: 'var(--red)',
              }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Empty Trash</h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              Permanently delete all <strong>{users.length}</strong> deleted {users.length === 1 ? 'account' : 'accounts'}?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              This <strong style={{ color: 'var(--red)' }}>cannot be undone</strong>. Every record in the trash is erased
              and their emails are freed for new accounts. Any admin account that would leave the system without another
              admin is kept and skipped. The activity log keeps a record of each removal.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPurgeAllOpen(false)} disabled={purgingAll} style={{
                flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                color: 'var(--muted)', fontWeight: 600, fontSize: 13,
                cursor: purgingAll ? 'not-allowed' : 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={confirmPurgeAll} disabled={purgingAll} style={{
                flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: purgingAll ? 'not-allowed' : 'pointer', opacity: purgingAll ? 0.7 : 1,
              }}>
                <Trash2 size={14} /> {purgingAll ? 'Emptying…' : 'Empty Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-selected (partial purge) confirmation modal */}
      {purgeSelectedOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(239,68,68,.3)', borderRadius: 18,
            width: '100%', maxWidth: 440, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
                display: 'grid', placeItems: 'center', color: 'var(--red)',
              }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Delete Selected Forever</h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              Permanently delete the <strong>{selectedIds.size}</strong> selected {selectedIds.size === 1 ? 'account' : 'accounts'}?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              This <strong style={{ color: 'var(--red)' }}>cannot be undone</strong>. The selected records are erased
              and their emails are freed for new accounts. Any admin account that would leave the system without another
              admin is kept and skipped. The activity log keeps a record of each removal.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPurgeSelectedOpen(false)} disabled={purgingSelected} style={{
                flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                color: 'var(--muted)', fontWeight: 600, fontSize: 13,
                cursor: purgingSelected ? 'not-allowed' : 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={confirmPurgeSelected} disabled={purgingSelected} style={{
                flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: purgingSelected ? 'not-allowed' : 'pointer', opacity: purgingSelected ? 0.7 : 1,
              }}>
                <Trash2 size={14} /> {purgingSelected ? 'Deleting…' : 'Delete selected forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
