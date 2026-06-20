import { useRef, useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Check, X, Download } from 'lucide-react';
import { buildSkippedRowsCsv, type ImportResult } from '@/lib/importCsv';

export interface CsvTemplate {
  /** Download filename, e.g. `plant-import-template.csv`. */
  fileName: string;
  /** Full CSV text (header + sample row), already line-ended. */
  content: string;
}

export interface BulkImportPanelProps {
  /** Panel heading, e.g. "Bulk-import plants from CSV". */
  title: string;
  /** Help text describing required/optional columns and what each row becomes. */
  description: React.ReactNode;
  /** Performs the actual upload and resolves with the per-row import result. */
  onImport: (csv: string) => Promise<ImportResult>;
  /** Called after every completed import (created + skipped counts available). */
  onImported?: (result: ImportResult) => void;
  /** Optional downloadable CSV template; the button is hidden when omitted. */
  template?: CsvTemplate;
  /** Column header for the per-row name/identity column. Defaults to "Name". */
  nameColumnLabel?: string;
  /** Filename for the "Download skipped rows" export. Defaults to "skipped-rows.csv". */
  skippedFileName?: string;
  /** Accent colour for the primary drop target + chrome. Defaults to the blue token. */
  accent?: string;
}

// Reusable bulk-CSV import surface: a primary drop target, a per-row result
// table, a "download just the skipped rows" export, and — when rows were
// skipped — an inline re-upload drop target plus a "previously-skipped now
// succeeded" summary. Self-contained: it owns all import state so any flow can
// drop it in by supplying labels, an optional template, and an onImport call.
export default function BulkImportPanel({
  title,
  description,
  onImport,
  onImported,
  template,
  nameColumnLabel = 'Name',
  skippedFileName = 'skipped-rows.csv',
  accent = 'var(--blue)',
}: BulkImportPanelProps) {
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csv, setCsv] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // When staff drop a corrected file into the inline re-upload target, we
  // remember how many rows were skipped on the prior run so the next result can
  // report how many of those previously-skipped rows now succeeded.
  const [prevSkipped, setPrevSkipped] = useState<number | null>(null);
  const [reuploadDragOver, setReuploadDragOver] = useState(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setCsv('');
    setError('');
    setFileName('');
    setDragOver(false);
    setPrevSkipped(null);
    setReuploadDragOver(false);
    if (inputRef.current) inputRef.current.value = '';
    if (reuploadInputRef.current) reuploadInputRef.current.value = '';
  }

  async function runImport(file: File, isRetry = false) {
    setError('');
    // Capture the prior skipped count before we clear the result so a corrected
    // re-upload can report how many previously-skipped rows now succeeded.
    setPrevSkipped(isRetry ? (result?.skipped ?? null) : null);
    setResult(null);
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && file.type && !/csv|text\/plain|excel|spreadsheet/.test(file.type)) {
      setError('Please choose a .csv file.');
      return;
    }
    setFileName(file.name);
    setImporting(true);
    try {
      const text = await file.text();
      if (!text.trim()) { setError('That file is empty.'); return; }
      const res = await onImport(text);
      setResult(res);
      setCsv(text);
      onImported?.(res);
    } catch (err) {
      setError((err as Error).message || 'Could not import the CSV.');
    } finally {
      setImporting(false);
      if (reuploadInputRef.current) reuploadInputRef.current.value = '';
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void runImport(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void runImport(file);
  }

  function onReuploadDrop(e: React.DragEvent) {
    e.preventDefault();
    setReuploadDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void runImport(file, true);
  }

  function onReuploadFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void runImport(file, true);
  }

  function downloadTemplate() {
    if (!template) return;
    triggerCsvDownload(template.content, template.fileName);
  }

  function downloadSkipped() {
    if (!result) return;
    const out = buildSkippedRowsCsv(csv, result);
    if (!out) return;
    triggerCsvDownload(out, skippedFileName);
  }

  return (
    <div style={{ ...softCard, marginBottom: 14, borderColor: `color-mix(in srgb, ${accent} 32%, transparent)`, background: `color-mix(in srgb, ${accent} 4%, transparent)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Upload size={15} style={{ color: accent }} />
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
        {description}
      </p>

      {template && (
        <button
          type="button"
          onClick={downloadTemplate}
          style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', fontSize: 12.5, marginBottom: 12 }}
          title="Download a sample CSV with the exact headers and one example row"
        >
          <Download size={14} /> Download CSV template
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      <div
        onClick={importing ? undefined : () => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          border: `1.5px dashed ${dragOver ? accent : 'var(--line)'}`,
          borderRadius: 12,
          padding: '26px 16px',
          textAlign: 'center',
          cursor: importing ? 'default' : 'pointer',
          background: dragOver ? `color-mix(in srgb, ${accent} 10%, transparent)` : 'rgba(255,255,255,.02)',
          transition: 'background .15s, border-color .15s',
        }}
      >
        <Upload size={22} style={{ color: dragOver ? accent : 'var(--muted)' }} />
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {importing ? 'Importing…' : 'Drag a .csv here, or click to choose a file'}
        </div>
        {fileName && !importing && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{fileName}</div>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, color: 'var(--red)', fontSize: 12.5, marginTop: 12 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          {prevSkipped !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '9px 12px', borderRadius: 10, fontSize: 12.5, color: 'var(--text)', border: '1px solid color-mix(in srgb, var(--green) 38%, transparent)', background: 'color-mix(in srgb, var(--green) 9%, transparent)' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <span>
                Re-import complete — <strong>{Math.min(result.created, prevSkipped)}</strong> of <strong>{prevSkipped}</strong> previously-skipped {prevSkipped === 1 ? 'row' : 'rows'} now imported successfully{result.skipped > 0 ? <>, <strong>{result.skipped}</strong> still skipped.</> : '.'}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <span style={badge('var(--green)')}><CheckCircle2 size={11} /> {result.created} created</span>
            <span style={badge(result.skipped > 0 ? 'var(--gold)' : 'var(--muted)')}>
              <AlertTriangle size={11} /> {result.skipped} skipped
            </span>
            {result.skipped > 0 && (
              <button
                onClick={downloadSkipped}
                style={{ ...ghostBtn, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12.5 }}
                title="Download just the skipped rows (original columns + a reason column) to fix and re-upload"
              >
                <Download size={13} /> Download skipped rows
              </button>
            )}
            <button onClick={reset} style={{ ...ghostBtn, marginLeft: result.skipped > 0 ? 0 : 'auto', padding: '6px 12px', fontSize: 12.5 }}>
              Import another
            </button>
          </div>
          <div style={{ ...softCard, padding: 0, overflow: 'hidden' }}>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--card, #0d1828)' }}>
                    <th style={importTh}>Row</th>
                    <th style={importTh}>{nameColumnLabel}</th>
                    <th style={importTh}>Status</th>
                    <th style={importTh}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={importTd}>{r.row}</td>
                      <td style={{ ...importTd, color: 'var(--text)', fontWeight: 600 }}>{r.name || '—'}</td>
                      <td style={importTd}>
                        {r.status === 'created'
                          ? <span style={badge('var(--green)')}><Check size={10} /> Created</span>
                          : <span style={badge('var(--gold)')}><X size={10} /> Skipped</span>}
                      </td>
                      <td style={{ ...importTd, color: 'var(--muted)' }}>{r.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.skipped > 0 && (
            <>
              <input
                ref={reuploadInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                style={{ display: 'none' }}
                onChange={onReuploadFileChange}
              />
              <div
                onClick={importing ? undefined : () => reuploadInputRef.current?.click()}
                onDrop={onReuploadDrop}
                onDragOver={e => { e.preventDefault(); setReuploadDragOver(true); }}
                onDragLeave={() => setReuploadDragOver(false)}
                style={{
                  marginTop: 12,
                  border: `1.5px dashed ${reuploadDragOver ? 'var(--gold)' : 'var(--line)'}`,
                  borderRadius: 12,
                  padding: '16px 14px',
                  textAlign: 'center',
                  cursor: importing ? 'default' : 'pointer',
                  background: reuploadDragOver ? 'color-mix(in srgb, var(--gold) 10%, transparent)' : 'rgba(255,255,255,.02)',
                  transition: 'background .15s, border-color .15s',
                }}
              >
                <Upload size={18} style={{ color: reuploadDragOver ? 'var(--gold)' : 'var(--muted)' }} />
                <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                  {importing ? 'Importing…' : 'Fixed the skipped rows? Drop the corrected CSV here to re-import'}
                </div>
                <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--muted)' }}>
                  Download the skipped rows above, correct them, then re-upload — no need to re-open this panel.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function triggerCsvDownload(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const importTh: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 11.5, fontWeight: 800,
  color: 'var(--muted)', letterSpacing: '0.3px', textTransform: 'uppercase',
};
const importTd: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'top', color: 'var(--muted)' };
const softCard: React.CSSProperties = { padding: 16, borderRadius: 13, border: '1px solid var(--line)', background: 'rgba(255,255,255,.02)' };
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
  background: 'rgba(255,255,255,.05)', color: 'var(--text)', border: '1px solid var(--line)',
};
function badge(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, letterSpacing: '0.3px',
    color, background: `color-mix(in srgb, ${color} 16%, transparent)`, borderRadius: 20, padding: '2px 9px',
  };
}
