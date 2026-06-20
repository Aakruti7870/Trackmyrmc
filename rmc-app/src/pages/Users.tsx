import { Plus, Search, ShieldCheck, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import SkippedAccountsPanel from '@/components/SkippedAccountsPanel';
import { ROLES, ROLE_LABEL, inputStyle } from './users/shared';
import { useUsersPage } from './users/useUsersPage';
import UserTable from './users/UserTable';
import ActivityLogPanel from './users/ActivityLogPanel';
import UserFormModal from './users/UserFormModal';
import ConfirmDialog from './users/ConfirmDialog';
import ReassignLinkModal from './users/ReassignLinkModal';

export default function Users() {
  const {
    users, filtered, unlinkedCount,
    search, setSearch, roleFilter, setRoleFilter,
    showDeleted, setShowDeleted, deletedCount,
    selectedIds, setSelectedIds, toggleSelectOne, toggleSelectAll,
    restoreAllOpen, setRestoreAllOpen, restoringAll, confirmRestoreAll,
    purgeAllOpen, setPurgeAllOpen, purgingAll, confirmPurgeAll,
    purgeSelectedOpen, setPurgeSelectedOpen, purgingSelected, confirmPurgeSelected,
    clientOptions, driverOptions, lockoutStatus, now,
    historyUser, restoringId, unlocking, resendingId,
    restore, viewHistory, unlock, resendNotification, resendWelcome, toggleActive,
    auditLog, actionFilter, setActionFilter, actorFilter, setActorFilter, actorOptions,
    searchInput, setSearchInput, qFilter, fromDate, setFromDate, toDate, setToDate,
    clearAuditFilters, clearHistory,
    exportMenuOpen, setExportMenuOpen, exportMenuRef,
    exportAuditCsv, exportAuditXlsx, exportAuditPdf,
    modal, setModal, form, setForm, editing, error, saving,
    showPassword, setShowPassword, autoOpenLink, authorityEmails,
    softDeletedMatch, openCreate, openEdit, save, restoreFromCreate,
    deleteTarget, setDeleteTarget, deleting, confirmDelete,
    purgeTarget, setPurgeTarget, purging, confirmPurge,
    skippedRestore, setSkippedRestore, copyEmails,
    retryRestore, retryingRestoreId, restoreWithoutLink, resolvingRestoreId,
    unlinkConflict, unlinkingConflictId, openReassign, reassigningRestoreId,
    reassignItem, setReassignItem, reassignType, reassignOptions,
    reassignTargetId, setReassignTargetId, confirmReassign,
    skippedPurge, setSkippedPurge, retryPurge, retryingPurgeId,
  } = useUsersPage();

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
            background: showDeleted ? 'rgba(239,68,68,.14)' : 'var(--chip-bg)',
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
