// Activity-log export helpers, kept in a standalone module that Users.tsx loads
// lazily (dynamic import) only when an admin actually exports. This keeps the
// heavy `xlsx` / `jspdf` / `jspdf-autotable` dependencies — and this ~200-line
// build logic — out of Users.tsx's static module graph, so the page (imported
// by many test files) transforms and loads far faster.

export const AUDIT_EXPORT_HEADERS = [
  'Timestamp', 'Action', 'Details', 'Target Account', 'Performed By', 'Email Sent',
] as const;

// One pre-formatted activity-log entry, built by the caller (Users.tsx) so this
// module stays free of React/component state and depends only on plain data.
export type AuditExportRow = {
  timestamp: Date;
  timestampText: string;
  action: string;
  detail: string;
  target: string;
  performedBy: string;
  emailSent: string;
};

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

export function exportAuditCsv(rows: AuditExportRow[], filename: string) {
  if (rows.length === 0) return;
  const escape = (value: string) => {
    const needsQuote = /[",\r\n]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needsQuote ? `"${escaped}"` : escaped;
  };
  const cells = rows.map(r => [
    r.timestampText, r.action, r.detail, r.target, r.performedBy, r.emailSent,
  ]);
  const csv = [[...AUDIT_EXPORT_HEADERS], ...cells]
    .map(row => row.map(cell => escape(String(cell))).join(','))
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

// Native .xlsx export. The timestamp column carries real Date values (rendered
// with a date/time number format) so spreadsheet apps treat it as a date, and
// the header row is bolded with sized columns and a filter dropdown.
export async function exportAuditXlsx(
  rows: AuditExportRow[],
  opts: { filename: string; title: string },
) {
  if (rows.length === 0) return;
  const XLSX = await import('xlsx');
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
    Title: opts.title,
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    opts.filename,
  );
}

// Real .pdf export: build the file client-side with jsPDF + autoTable and
// download it directly (no new window or print dialog), matching the CSV/Excel
// one-click flow. Layout mirrors the former print view — title, scope, active
// filters, gold styled header, zebra rows — so the file stays self-describing.
export async function exportAuditPdf(
  rows: AuditExportRow[],
  opts: { filename: string; scopeLabel: string; filterBits: string[] },
) {
  if (rows.length === 0) return;
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const { scopeLabel, filterBits, filename } = opts;
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
  doc.text(`Scope: ${scopeLabel}`, marginX, 54);

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

  doc.save(filename);
}
