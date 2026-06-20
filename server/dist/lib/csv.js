// Single source of truth: RFC-4180-style CSV parser for plant imports. This
// pure, dependency-free leaf module is imported directly by both the server
// import handler and the client skipped-rows download
// (rmc-app/src/lib/importCsv.ts re-exports it as parseImportCsv), so there is
// no second copy that could drift and row numbers always line up with the file.
export function parseCsv(text) {
    const rows = [];
    let field = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                }
                else
                    inQuotes = false;
            }
            else
                field += c;
        }
        else if (c === '"') {
            inQuotes = true;
        }
        else if (c === ',') {
            row.push(field);
            field = '';
        }
        else if (c === '\r') {
            // ignore; the paired \n closes the row
        }
        else if (c === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        }
        else {
            field += c;
        }
    }
    // Flush a trailing field/row when the file doesn't end with a newline.
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}
