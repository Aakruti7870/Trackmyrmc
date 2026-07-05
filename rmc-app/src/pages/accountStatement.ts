import type { LedgerEntry } from '@/lib/api';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/brand';

export interface StatementData {
  customerName: string;
  outstanding: number;
  creditLimit: number;
  entries: (LedgerEntry & { runningBalance: number })[];
  fromDate?: string;
  toDate?: string;
}

// Builds a one-page account statement (billing ledger) for the customer,
// client-side, with jsPDF + autoTable, and downloads it directly — mirroring the
// lazy-import export pattern in deliveryReceipt.ts so the heavy pdf deps stay out
// of the main bundle. The rupee figure uses "Rs." rather than the ₹ glyph, which
// the built-in helvetica font cannot render.
export async function downloadAccountStatement(data: StatementData): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const marginX = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(27, 36, 51);
  doc.text(PLATFORM_NAME, marginX, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(PLATFORM_TAGLINE, marginX, 64);

  doc.setDrawColor(208, 213, 221);
  doc.setLineWidth(1);
  doc.line(marginX, 76, 555, 76);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(27, 36, 51);
  doc.text('Account Statement', marginX, 100);

  const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(136, 136, 136);
  doc.text(`Generated ${generated}`, marginX, 116);

  let y = 138;
  const money = (n: number) =>
    `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const info: [string, string][] = [];
  if (data.customerName) info.push(['Customer', data.customerName]);
  const rangeLabel = data.fromDate || data.toDate
    ? `${data.fromDate || 'Start'} to ${data.toDate || 'Today'}`
    : 'All transactions';
  info.push(['Period', rangeLabel]);
  info.push(['Outstanding', money(data.outstanding)]);
  info.push(['Credit Limit', money(data.creditLimit)]);

  doc.setFontSize(10);
  for (const [label, value] of info) {
    doc.setTextColor(120, 120, 120);
    doc.text(`${label}:`, marginX, y);
    doc.setTextColor(27, 36, 51);
    doc.text(value, marginX + 90, y);
    y += 16;
  }

  const body = data.entries.map(e => [
    new Date(e.createdAt).toLocaleDateString('en-IN'),
    e.description,
    e.referenceNo || '-',
    e.type === 'debit' ? money(parseFloat(e.amount)) : '-',
    e.type === 'credit' ? money(parseFloat(e.amount)) : '-',
    money(Math.abs(e.runningBalance)),
  ]);

  autoTable(doc, {
    startY: y + 8,
    head: [['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']],
    body: body.length ? body : [['—', 'No transactions in this period', '—', '-', '-', '-']],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [23, 138, 110], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: marginX, right: marginX },
  });

  doc.save(`account-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
}
