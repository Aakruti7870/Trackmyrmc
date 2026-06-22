// The import CSV parser is a pure, dependency-free leaf module vendored into
// rmc-app (src/lib/csv.ts) so the frontend builds standalone — including the
// Capacitor Android export, which ships without the server/ tree. It is a
// verbatim mirror of server/src/lib/csv.ts (the runtime authority); keep the
// two identical so skipped-row numbers line up byte-for-byte with the file.
import { parseCsv } from './csv';

export { parseCsv as parseImportCsv };

export interface ImportRowResult {
  row: number;
  name: string;
  status: 'created' | 'skipped';
  reason?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  results: ImportRowResult[];
}

function toCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsvLine(cells: string[]): string {
  return cells.map(toCsvField).join(',');
}

// Builds a CSV of just the skipped rows (original columns + a trailing "reason"),
// so staff can fix and re-upload only the problem rows. Returns null if there is
// nothing to download. Row numbers from the server are 1-based incl. the header
// and refer to the blank-line-filtered grid, so we filter the same way here.
export function buildSkippedRowsCsv(csv: string, result: ImportResult): string | null {
  const grid = parseCsv(csv).filter(r => r.some(cell => cell.trim() !== ''));
  if (grid.length === 0) return null;
  const header = grid[0];
  const lines = [toCsvLine([...header, 'reason'])];
  for (const r of result.results) {
    if (r.status !== 'skipped') continue;
    const cells = grid[r.row - 1];
    if (!cells) continue;
    lines.push(toCsvLine([...cells, r.reason || '']));
  }
  if (lines.length === 1) return null;
  return lines.join('\r\n') + '\r\n';
}
