import type { RefObject } from 'react';
import {
  X, Search, ClipboardList, CheckCircle, XCircle, Download, ChevronDown,
  FileSpreadsheet, FileText,
} from 'lucide-react';
import {
  ACTION_LABEL, ACTION_COLOR, inputStyle, labelStyle, formatDate,
  type AuditEntry,
} from './shared';
import AccountRef from './AccountRef';

type ActorOption = { id: number | null; name: string | null; deleted?: boolean };

// The activity-log section: header, filters, export menu, and the entries table.
// All filter/menu state lives in the parent page and is threaded through props.
export default function ActivityLogPanel({
  historyUserName,
  auditLog,
  actionFilter,
  setActionFilter,
  actorFilter,
  setActorFilter,
  actorOptions,
  searchInput,
  setSearchInput,
  qFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  onClearFilters,
  onClearHistory,
  exportMenuOpen,
  setExportMenuOpen,
  exportMenuRef,
  onExportCsv,
  onExportXlsx,
  onExportPdf,
}: {
  historyUserName: string | null;
  auditLog: AuditEntry[];
  actionFilter: string;
  setActionFilter: (v: string) => void;
  actorFilter: string;
  setActorFilter: (v: string) => void;
  actorOptions: ActorOption[];
  searchInput: string;
  setSearchInput: (v: string) => void;
  qFilter: string;
  fromDate: string;
  setFromDate: (v: string) => void;
  toDate: string;
  setToDate: (v: string) => void;
  onClearFilters: () => void;
  onClearHistory: () => void;
  exportMenuOpen: boolean;
  setExportMenuOpen: (fn: (o: boolean) => boolean) => void;
  exportMenuRef: RefObject<HTMLDivElement | null>;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
}) {
  const hasFilters = actionFilter !== 'all' || actorFilter !== 'all' || qFilter || fromDate || toDate;
  return (
    <div id="activity-log" style={{ marginTop: 32, scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, flexWrap: 'wrap' }}>
        <ClipboardList size={18} color="#178a6e" />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          {historyUserName ? `Activity Log — ${historyUserName}` : 'Activity Log'}
        </h3>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: 'rgba(23,138,110,.12)', color: '#178a6e', border: '1px solid rgba(23,138,110,.25)',
        }}>
          {auditLog.length} {auditLog.length === 1 ? 'entry' : 'entries'}
        </span>
        {historyUserName && (
          <button
            onClick={onClearHistory}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
              padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--muted)',
            }}
          >
            <X size={12} /> Showing {historyUserName} — Show all
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
              a.deleted
                ? <option key={`name:${a.name}`} value={`name:${a.name}`}>{(a.name?.trim() || '[deleted]') + ' (deleted)'}</option>
                : <option key={a.id} value={String(a.id)}>{a.name?.trim() || `User #${a.id}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Search</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Email, detail, action…"
              aria-label="Search activity log"
              style={{ ...inputStyle, width: 'auto', minWidth: 200, paddingLeft: 32 }}
            />
          </div>
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
        {hasFilters && (
          <button
            onClick={onClearFilters}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px',
              borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--muted)',
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
              title={historyUserName ? `Export ${historyUserName}'s activity log` : 'Export the activity log'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px',
                borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: 'rgba(23,138,110,.12)', border: '1px solid rgba(23,138,110,.3)', color: '#178a6e',
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
                  background: 'var(--menu-bg)', border: '1px solid var(--line)', borderRadius: 10,
                  boxShadow: '0 12px 30px rgba(var(--shadow-rgb),.45)', overflow: 'hidden', padding: 4,
                }}
              >
                {([
                  { key: 'csv', label: 'CSV (.csv)', icon: <FileText size={14} />, fn: onExportCsv },
                  { key: 'xlsx', label: 'Excel (.xlsx)', icon: <FileSpreadsheet size={14} />, fn: onExportXlsx },
                  { key: 'pdf', label: 'PDF (.pdf)', icon: <FileText size={14} />, fn: onExportPdf },
                ] as const).map(item => (
                  <button
                    key={item.key}
                    role="menuitem"
                    onClick={() => { setExportMenuOpen(() => false); item.fn(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                      padding: '9px 11px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      background: 'transparent', border: 'none', color: 'var(--text)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--menu-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: '#178a6e', display: 'flex' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden',
      }}>
        {auditLog.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {hasFilters
              ? 'No activity matches the selected filters.'
              : historyUserName
              ? `No activity recorded for ${historyUserName} yet.`
              : 'No activity recorded yet. Account changes and password resets will appear here.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--chip-bg)' }}>
                {['Timestamp', 'Action', 'Details', 'Target Account', 'Performed By', 'Email Sent'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLog.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {formatDate(entry.createdAt)}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {(() => {
                      const c = ACTION_COLOR[entry.action] ?? 'var(--muted)';
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
                  <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{entry.detail ?? '—'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text)' }}>
                    <AccountRef id={entry.targetUserId} label={entry.targetUserEmail} />
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--muted)' }}>
                    <AccountRef id={entry.actorId} label={entry.actorName} />
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {entry.emailSent === null ? (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
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
  );
}
