import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// Two admins plus a dispatcher in the trash. The dispatcher gets purged; both
// admins are kept alive (skipped) so the results panel must list them all.
const deleted: DeletedUser[] = [
  {
    id: 11, name: 'Asha Patel', email: 'asha@x.com', role: 'dispatcher', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: '2026-02-01T00:00:00.000Z', auditCount: 0,
  },
  {
    id: 12, name: 'Chetan Rao', email: 'chetan@x.com', role: 'admin', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-02-02T00:00:00.000Z', auditCount: 0,
  },
  {
    id: 13, name: 'Divya Nair', email: 'divya@x.com', role: 'admin', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-03T00:00:00.000Z',
    deletedAt: '2026-02-03T00:00:00.000Z', auditCount: 0,
  },
];

const skippedAdmins = [
  { id: 12, email: 'chetan@x.com' },
  { id: 13, email: 'divya@x.com' },
];

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
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet();
});

async function enterDeletedView(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Deleted/i }));
  await screen.findByText('Asha Patel');
}

// The skipped-admins results panel renders behind a header that names the
// skip count; scope assertions to that panel since the same emails also appear
// in the deleted-users table behind it.
async function findSkippedPanel(count: number) {
  const heading = await screen.findByRole('heading', { name: `${count} Admin Accounts Skipped` });
  return heading.closest('div[style]')!.parentElement!.parentElement as HTMLElement;
}

describe('Users skipped-admins results panel after deleting forever', () => {
  it('lists every skipped admin email after Empty Trash (confirmPurgeAll)', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      purged: 1,
      skipped: 2,
      skippedAdmins,
    } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Open and confirm the Empty Trash flow (no ids = purge everything).
    await user.click(screen.getByRole('button', { name: /Empty Trash \(3\)/ }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Empty Trash' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Empty Trash/ }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all');
    });

    // The skip toast points the admin to the results panel.
    expect(
      await screen.findByText(
        '1 account permanently deleted. 2 admin accounts were skipped — see details below.',
      ),
    ).toBeInTheDocument();

    // The results panel lists both skipped admins by email.
    const panel = await findSkippedPanel(2);
    expect(within(panel).getByText('chetan@x.com')).toBeInTheDocument();
    expect(within(panel).getByText('divya@x.com')).toBeInTheDocument();
  });

  it('lists every skipped admin email after Delete Selected Forever (confirmPurgeSelected)', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      purged: 1,
      skipped: 2,
      skippedAdmins,
    } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Select all three accounts; the two admins must be skipped.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Chetan Rao' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Divya Nair' }));

    await user.click(screen.getByRole('button', { name: /Delete selected forever \(3\)/ }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Delete Selected Forever' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Delete selected forever/ }));

    // The purge-all endpoint is hit with the selected ids.
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all', { ids: [11, 12, 13] });
    });

    expect(
      await screen.findByText(
        '1 account permanently deleted. 2 admin accounts were skipped — see details below.',
      ),
    ).toBeInTheDocument();

    const panel = await findSkippedPanel(2);
    expect(within(panel).getByText('chetan@x.com')).toBeInTheDocument();
    expect(within(panel).getByText('divya@x.com')).toBeInTheDocument();
  });

  it('dismisses the skipped-admins panel via Done', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      purged: 1,
      skipped: 2,
      skippedAdmins,
    } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Empty Trash \(3\)/ }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Empty Trash' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Empty Trash/ }));

    const panel = await findSkippedPanel(2);
    await user.click(within(panel).getByRole('button', { name: /Done/ }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '2 Admin Accounts Skipped' })).not.toBeInTheDocument();
    });
  });
});
