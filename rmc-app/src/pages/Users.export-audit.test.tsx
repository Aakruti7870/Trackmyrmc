import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as XLSX from '@e965/xlsx';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

// jsPDF attaches its methods to each instance (not the prototype), so it can't
// be spied on directly. Replace the module with a light stand-in that records
// the text() lines and the save() filename for the PDF-export assertions.
const pdfCapture = vi.hoisted(() => ({ textCalls: [] as unknown[][], savedName: '' }));

vi.mock('jspdf', () => {
  class FakeJsPDF {
    setTextColor() { return this; }
    setFont() { return this; }
    setFontSize() { return this; }
    text(...args: unknown[]) { pdfCapture.textCalls.push(args); return this; }
    save(name?: string) { pdfCapture.savedName = name ?? ''; return this; }
  }
  return { default: FakeJsPDF };
});

vi.mock('jspdf-autotable', () => ({ default: () => {} }));

import Users from '@/pages/Users';
import { ToastProvider } from '@/lib/toast-provider';
import { api } from '@/lib/api';

type AuditEntry = {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  targetUserId: number | null;
  targetUserEmail: string | null;
  detail: string | null;
  emailSent: boolean | null;
  createdAt: string;
};

// One entry per emailSent variant, plus a detail containing a comma and quotes
// so the CSV-escaping path is exercised.
const auditRows: AuditEntry[] = [
  {
    id: 1, actorId: 5, actorName: 'Admin One', action: 'user.created',
    targetUserId: 11, targetUserEmail: 'asha@x.com',
    detail: 'Created account, role "dispatcher"', emailSent: true,
    createdAt: '2026-02-01T10:30:00.000Z',
  },
  {
    id: 2, actorId: 5, actorName: 'Admin One', action: 'password_reset',
    targetUserId: 12, targetUserEmail: 'bharat@x.com',
    detail: 'Manual reset', emailSent: false,
    createdAt: '2026-02-02T08:15:00.000Z',
  },
];

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
  createdAt: string;
  deletedAt: string | null;
  auditCount: number;
};

// A single account whose activity an admin can drill into. Its email contains an
// '@' so the sanitised filename context (asha-x.com) can be asserted.
const ashaUser: UserRow = {
  id: 11, name: 'Asha Rao', email: 'asha@x.com', role: 'dispatcher',
  isActive: true, linkedClientId: null, linkedDriverId: null,
  createdAt: '2026-01-01T00:00:00.000Z', deletedAt: null, auditCount: 2,
};

function mockGet(opts: { users?: UserRow[]; audit?: AuditEntry[] } = {}) {
  const users = opts.users ?? [];
  const audit = opts.audit ?? auditRows;
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/audit-logs')) return { rows: audit, hasMore: false } as never;
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return {} as never;
    if (path === '/users/authority-emails') return { emails: [] } as never;
    if (path === '/users?deleted=true') return [] as never;
    if (path === '/users') return users as never;
    return [] as never;
  });
}

// Click the per-user "View activity history" button so historyUser is set and
// the activity log (and its export) is scoped to that single account.
async function enterUserHistory(user: ReturnType<typeof userEvent.setup>) {
  const historyBtn = await screen.findByTitle(/View activity history/i);
  await user.click(historyBtn);
}

function renderUsers() {
  return render(
    <ToastProvider>
      <Users />
    </ToastProvider>
  );
}

// Capture the blob + filename handed to the hidden-anchor download path.
let createdBlobs: Blob[] = [];
let downloadName = '';
let clickSpy: ReturnType<typeof vi.spyOn>;
const realCreateObjectURL = URL.createObjectURL;
const realRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  vi.clearAllMocks();
  mockGet();
  // jsdom doesn't implement scrollIntoView, which viewHistory() calls when an
  // admin drills into a single person's activity.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  createdBlobs = [];
  downloadName = '';
  pdfCapture.textCalls = [];
  pdfCapture.savedName = '';
  URL.createObjectURL = vi.fn((blob: Blob) => {
    createdBlobs.push(blob);
    return 'blob:mock-url';
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  // Intercept the synthetic anchor click so jsdom doesn't try to navigate, and
  // record the download filename that was set just before the click fired.
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadName = this.download;
  });
});

afterEach(() => {
  clickSpy.mockRestore();
  URL.createObjectURL = realCreateObjectURL;
  URL.revokeObjectURL = realRevokeObjectURL;
});

async function openExportMenu(user: ReturnType<typeof userEvent.setup>) {
  // The Export button only renders once the audit log has loaded entries.
  const exportBtn = await screen.findByRole('button', { name: /Export/i });
  await user.click(exportBtn);
  return screen.getByRole('menu');
}

describe('Users activity-log export menu', () => {
  it('renders the three export options when the menu opens', async () => {
    const user = userEvent.setup();
    renderUsers();
    const menu = await openExportMenu(user);

    expect(within(menu).getByRole('menuitem', { name: /CSV \(\.csv\)/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Excel \(\.xlsx\)/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /PDF \(\.pdf\)/ })).toBeInTheDocument();
  });

  it('exports a CSV blob with headers, escaped cells and a dated filename', async () => {
    const user = userEvent.setup();
    renderUsers();
    const menu = await openExportMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: /CSV \(\.csv\)/ }));

    await waitFor(() => expect(createdBlobs.length).toBe(1));
    const blob = createdBlobs[0];
    expect(blob.type).toContain('text/csv');

    // The blob is prefixed with a UTF-8 BOM (EF BB BF) so Excel opens it as
    // UTF-8 — assert on the raw bytes since text() decoding strips the BOM.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = await blob.text();
    // Header row.
    expect(text).toContain('Timestamp,Action,Details,Target Account,Performed By,Email Sent');
    // Action labels are humanised; both rows are present.
    expect(text).toContain('Account Created');
    expect(text).toContain('Password Reset');
    // A value containing a comma + quotes is wrapped and the quotes doubled.
    expect(text).toContain('"Created account, role ""dispatcher"""');
    // emailSent maps to Sent / Not sent.
    expect(text).toContain('Sent');
    expect(text).toContain('Not sent');

    expect(downloadName).toMatch(/^activity-log-all-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('exports an .xlsx workbook whose timestamp column holds real Date values', async () => {
    const user = userEvent.setup();
    renderUsers();
    const menu = await openExportMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: /Excel \(\.xlsx\)/ }));

    await waitFor(() => expect(createdBlobs.length).toBe(1));
    const blob = createdBlobs[0];
    expect(blob.type).toContain('spreadsheetml.sheet');
    expect(downloadName).toMatch(/^activity-log-all-\d{4}-\d{2}-\d{2}\.xlsx$/);

    // Parse the generated workbook back and inspect the timestamp column.
    const buf = await blob.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Header row is intact.
    expect(ws['A1'].v).toBe('Timestamp');
    expect(ws['B1'].v).toBe('Action');

    // The first data cell in the timestamp column is a Date, not a string.
    const tsCell = ws['A2'];
    expect(tsCell.t).toBe('d');
    expect(tsCell.v).toBeInstanceOf(Date);
    expect((tsCell.v as Date).toISOString()).toBe('2026-02-01T10:30:00.000Z');

    // The action column carries the humanised label.
    expect(ws['B2'].v).toBe('Account Created');
    expect(wb.SheetNames[0]).toBe('Activity Log');
  });

  it('exports a PDF directly via jsPDF without opening a print window', async () => {
    // The PDF path now builds the file client-side with jsPDF and downloads it
    // straight away (no new window / print dialog), so window.open must stay
    // untouched and no download blob is produced.
    const openSpy = vi.spyOn(window, 'open');

    const user = userEvent.setup();
    renderUsers();
    const menu = await openExportMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: /PDF \(\.pdf\)/ }));

    await waitFor(() => expect(pdfCapture.savedName).not.toBe(''));
    // Dated, all-users filename matching the CSV/Excel one-click flow.
    expect(pdfCapture.savedName).toMatch(/^activity-log-all-\d{4}-\d{2}-\d{2}\.pdf$/);

    const textValues = pdfCapture.textCalls.map(c => c[0]);
    expect(textValues).toContain('Activity Log');
    expect(textValues).toContain('Scope: All users');

    expect(openSpy).not.toHaveBeenCalled();
    expect(createdBlobs.length).toBe(0);

    openSpy.mockRestore();
  });

  it('writes a generated entry-count summary line into the PDF', async () => {
    const user = userEvent.setup();
    renderUsers();
    const menu = await openExportMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: /PDF \(\.pdf\)/ }));

    await waitFor(() => expect(pdfCapture.savedName).not.toBe(''));
    // The two seeded rows are summarised (pluralised) with a generated-at stamp.
    const textValues = pdfCapture.textCalls.map(c => String(c[0]));
    expect(textValues.some(t => /^2 entries · Generated /.test(t))).toBe(true);
  });
});

describe('Users activity-log export scoped to a single person', () => {
  it('uses the sanitised email filename for a per-user CSV export', async () => {
    mockGet({ users: [ashaUser], audit: auditRows });
    const user = userEvent.setup();
    renderUsers();

    await enterUserHistory(user);
    const menu = await openExportMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /CSV \(\.csv\)/ }));

    await waitFor(() => expect(createdBlobs.length).toBe(1));
    // 'all' is replaced with the sanitised email of the selected account.
    expect(downloadName).toMatch(/^activity-log-asha-x\.com-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('records the selected person in the Excel filename and workbook Title', async () => {
    mockGet({ users: [ashaUser], audit: auditRows });
    const user = userEvent.setup();
    renderUsers();

    await enterUserHistory(user);
    const menu = await openExportMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /Excel \(\.xlsx\)/ }));

    await waitFor(() => expect(createdBlobs.length).toBe(1));
    expect(downloadName).toMatch(/^activity-log-asha-x\.com-\d{4}-\d{2}-\d{2}\.xlsx$/);

    // The workbook's core Title property carries the human-readable scope label.
    const buf = await createdBlobs[0].arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.Props?.Title).toBe('Activity Log — Asha Rao (asha@x.com)');
  });

  it('writes the per-user scope and filename into the PDF export', async () => {
    mockGet({ users: [ashaUser], audit: auditRows });

    const user = userEvent.setup();
    renderUsers();

    await enterUserHistory(user);
    const menu = await openExportMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /PDF \(\.pdf\)/ }));

    await waitFor(() => expect(pdfCapture.savedName).not.toBe(''));
    expect(pdfCapture.savedName).toMatch(/^activity-log-asha-x\.com-\d{4}-\d{2}-\d{2}\.pdf$/);

    // The "Scope:" caption names the selected person, not "All users".
    const scopeCalls = pdfCapture.textCalls.map(c => c[0]);
    expect(scopeCalls).toContain('Scope: Asha Rao (asha@x.com)');
    expect(scopeCalls).not.toContain('Scope: All users');
  });

  it('hides the Export button and skips export when the per-user log is empty', async () => {
    mockGet({ users: [{ ...ashaUser, auditCount: 0 }], audit: [] });
    const openSpy = vi.spyOn(window, 'open');

    const user = userEvent.setup();
    renderUsers();

    await enterUserHistory(user);

    // The empty-state message confirms we are in the per-user view with no rows.
    expect(await screen.findByText('No activity recorded for Asha Rao yet.')).toBeInTheDocument();
    // With no entries the Export trigger never renders, so nothing can be exported.
    expect(screen.queryByRole('button', { name: /Export/i })).not.toBeInTheDocument();
    expect(createdBlobs.length).toBe(0);
    expect(openSpy).not.toHaveBeenCalled();
    expect(pdfCapture.savedName).toBe('');

    openSpy.mockRestore();
  });
});
