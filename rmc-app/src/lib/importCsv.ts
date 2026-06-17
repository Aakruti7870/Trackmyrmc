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

// Mirrors the server's CSV parser so skipped-row numbers line up exactly with
// the original file (quoted fields, escaped quotes, \r\n all handled the same).
export function parseImportCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // ignore; the paired \n closes the row
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
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
  const grid = parseImportCsv(csv).filter(r => r.some(cell => cell.trim() !== ''));
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
