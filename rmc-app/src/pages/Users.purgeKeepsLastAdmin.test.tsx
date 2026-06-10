import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so the component's
// error-surfacing behaves exactly as in prod.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

import Users from '@/pages/Users';
import { ToastProvider } from '@/lib/toast-provider';
import { api } from '@/lib/api';

type DeletedUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
  createdAt: string;
  deletedAt: string;
  auditCount: number;
};

// The trash holds one dispatcher and one admin. The admin is the only admin the
// system has, so the server keeps it alive (skips it) and purges the dispatcher,
// mirroring the skip-admin guard in server/src/routes/users.ts (purge-all).
const DISPATCHER: DeletedUser = {
  id: 21, name: 'Sunita Rao', email: 'sunita@aakruti.com', role: 'dispatcher', isActive: false,
  linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-01T00:00:00.000Z',
  deletedAt: '2026-06-08T00:00:00.000Z', auditCount: 0,
};

const LAST_ADMIN: DeletedUser = {
  id: 22, name: 'Rajesh Mehta', email: 'rajesh@aakruti.com', role: 'admin', isActive: false,
  linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-02T00:00:00.000Z',
  deletedAt: '2026-06-09T00:00:00.000Z', auditCount: 0,
};

const deleted: DeletedUser[] = [DISPATCHER, LAST_ADMIN];

// The server's response when the last admin is kept: one purged, one skipped.
const KEEPS_LAST_ADMIN = {
  purged: 1,
  skipped: 1,
  skippedAdmins: [{ id: LAST_ADMIN.id, email: LAST_ADMIN.email }],
} as const;

function mockGet() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/audit-logs')) return { rows: [], hasMore: false } as never;
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return {} as never;
    if (path === '/users?deleted=true') return deleted as never;
    if (path === '/users') return [] as never;
    return [] as never;
  });
}

function renderUsers() {
  return render(
    <ToastProvider>
      <Users />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet();
});

async function enterDeletedView(user: ReturnType<typeof userEvent.setup>) {
  // Wait for the initial (active) load to settle, then switch to the trash view.
  await user.click(await screen.findByRole('button', { name: /Deleted/i }));
  // The deleted rows must be on screen before we interact with the bulk UI.
  await screen.findByText('Sunita Rao');
}

describe('Users purge keeps the last admin', () => {
  it('Empty Trash calls purge-all (no body) and the skip toast names the kept admin count', async () => {
    vi.mocked(api.delete).mockResolvedValue(KEEPS_LAST_ADMIN as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Open and confirm the Empty Trash modal (no ids = purge everything in trash).
    await user.click(screen.getByRole('button', { name: /Empty Trash \(2\)/ }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Empty Trash' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Empty Trash/ }));

    // The purge-all endpoint is hit with NO ids payload (purge everything).
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all');
    });
    expect(vi.mocked(api.delete).mock.calls[0]).toHaveLength(1);

    // Because skipped > 0, the info toast names the skipped admin count and
    // points to the details panel — confirming the last admin was kept alive.
    expect(
      await screen.findByText(
        '1 account permanently deleted. 1 admin account was skipped — see details below.',
      ),
    ).toBeInTheDocument();

    // The details panel lists the kept admin by email (scoped to the panel since
    // the same email also appears in the deleted-users table behind it).
    const resultsHeading = await screen.findByRole('heading', { name: '1 Admin Account Skipped' });
    const resultsModal = resultsHeading.closest('div[style]')!.parentElement!.parentElement as HTMLElement;
    expect(within(resultsModal).getByText('rajesh@aakruti.com')).toBeInTheDocument();
  });

  it('Delete selected forever calls purge-all with { ids } and the skip toast names the kept admin count', async () => {
    vi.mocked(api.delete).mockResolvedValue(KEEPS_LAST_ADMIN as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Select both rows: the dispatcher is purged, the last admin is kept.
    await user.click(screen.getByRole('checkbox', { name: 'Select Sunita Rao' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Rajesh Mehta' }));

    await user.click(screen.getByRole('button', { name: /Delete selected forever \(2\)/ }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Delete Selected Forever' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Delete selected forever/ }));

    // The purge-all endpoint is hit with exactly the selected ids.
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all', { ids: [21, 22] });
    });

    // Same skip messaging surfaces for the selective variant.
    expect(
      await screen.findByText(
        '1 account permanently deleted. 1 admin account was skipped — see details below.',
      ),
    ).toBeInTheDocument();

    const resultsHeading = await screen.findByRole('heading', { name: '1 Admin Account Skipped' });
    const resultsModal = resultsHeading.closest('div[style]')!.parentElement!.parentElement as HTMLElement;
    expect(within(resultsModal).getByText('rajesh@aakruti.com')).toBeInTheDocument();
  });
});
