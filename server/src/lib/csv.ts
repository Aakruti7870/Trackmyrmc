// Canonical RFC-4180-style CSV parser for plant imports. The skipped-rows
// download in the client (rmc-app/src/lib/importCsv.ts) keeps a byte-for-byte
// mirror of this so its row numbers line up with the original file. A contract
// test (rmc-app/src/lib/csvParser.contract.test.ts) feeds shared fixtures
// through BOTH copies and fails if they ever drift apart.
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
