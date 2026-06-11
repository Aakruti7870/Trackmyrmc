import type { Challan } from '@/lib/api';

// Builds a one-page delivery receipt for a single challan, client-side, with
// jsPDF + autoTable and downloads it directly (no print dialog) — mirroring the
// lazy-import export pattern in usersAuditExport.ts so the heavy pdf deps stay
// out of the main bundle.
export async function downloadDeliveryReceipt(c: Challan): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const marginX = 40;

  // Header band — plant identity.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(27, 36, 51); // #1b2433
  doc.text('Aakruti Infra RMC Plant', marginX, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Karanjade, Panvel · Navi Mumbai · JNPT Corridor', marginX, 64);

  doc.setDrawColor(208, 213, 221); // #d0d5dd
  doc.setLineWidth(1);
  doc.line(marginX, 76, 555, 76);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(27, 36, 51);
  doc.text('Delivery Receipt', marginX, 100);

  const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(136, 136, 136);
  doc.text(`Generated ${generated}`, marginX, 116);

  const fmtTime = (v?: string) =>
    v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const qty = (v?: string | null) => (v != null && v !== '' ? `${parseFloat(v).toFixed(2)} m³` : '—');

  const rows: [string, string][] = [
    ['Challan No', c.challanNo],
    ['Status', c.status.charAt(0).toUpperCase() + c.status.slice(1)],
    ['Customer', c.clientName || '—'],
    ['Site', c.siteName || '—'],
    ['Concrete Grade', c.grade],
    ['Ordered Quantity', qty(c.quantity)],
    ['Delivered Quantity', qty(c.deliveredQuantity ?? c.quantity)],
    ['Concrete Pump', c.pumpRequired ? 'Yes' : 'No'],
    ['Vehicle', c.vehicleNo || '—'],
    ['Driver', c.driverName || '—'],
    ['Dispatch Time', fmtTime(c.dispatchTime)],
    ['Delivery Time', fmtTime(c.deliveryTime)],
  ];

  autoTable(doc, {
    startY: 132,
    margin: { left: marginX, right: marginX },
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 7,
      textColor: [27, 36, 51],
      lineColor: [208, 213, 221],
      lineWidth: 0.5,
      valign: 'middle',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 150, fillColor: [247, 249, 252] },
      1: { cellWidth: 'auto' },
    },
  });

  // Footer note.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 132;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'This is a system-generated delivery receipt and does not require a signature.',
    marginX,
    finalY + 24,
  );

  doc.save(`receipt-${c.challanNo}.pdf`);
}
