import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as XLSX from 'xlsx';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

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

function mockGet() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/audit-logs')) return { rows: auditRows, hasMore: false } as never;
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return {} as never;
    if (path === '/users?deleted=true') return [] as never;
    if (path === '/users') return [] as never;
    return [] as never;
  });
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
  createdBlobs = [];
  downloadName = '';
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
    expect(within(menu).getByRole('menuitem', { name: /PDF \(print\)/ })).toBeInTheDocument();
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

  it('exports a PDF by opening a print window with the rendered table', async () => {
    const writes: string[] = [];
    const fakeWin = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => writes.push(html)),
        close: vi.fn(),
      },
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin as unknown as Window);

    const user = userEvent.setup();
    renderUsers();
    const menu = await openExportMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: /PDF \(print\)/ }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(fakeWin.document.write).toHaveBeenCalledTimes(1);
    const html = writes[0];
    expect(html).toContain('<h1>Activity Log</h1>');
    expect(html).toContain('Account Created');
    expect(html).toContain('window.print()');
    // No download blob is produced for the PDF path.
    expect(createdBlobs.length).toBe(0);

    openSpy.mockRestore();
  });

  it('shows a pop-up-blocked toast when the PDF window cannot open', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const user = userEvent.setup();
    renderUsers();
    const menu = await openExportMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: /PDF \(print\)/ }));

    expect(
      await screen.findByText('Allow pop-ups to export the activity log as PDF.'),
    ).toBeInTheDocument();

    openSpy.mockRestore();
  });
});
