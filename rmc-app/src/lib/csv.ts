// RFC-4180-style CSV parser for plant imports. Pure, dependency-free, and
// browser-safe so the React app can bundle it directly. This is a verbatim
// mirror of server/src/lib/csv.ts (the runtime authority for imports) — the
// frontend keeps its own copy so rmc-app builds standalone (e.g. the Capacitor
// Android export, which ships without the server/ tree). The two MUST stay
// byte-for-byte identical so skipped-row numbers line up with the original file.
export function parseCsv(text: string): string[][] {
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
  // Flush a trailing field/row when the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
