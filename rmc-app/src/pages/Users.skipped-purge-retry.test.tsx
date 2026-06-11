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

const deleted: DeletedUser[] = [
  {
    id: 11, name: 'Asha Patel', email: 'asha@x.com', role: 'dispatcher', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: '2026-02-01T00:00:00.000Z', auditCount: 0,
  },
  {
    id: 12, name: 'Bharat Shah', email: 'bharat@x.com', role: 'admin', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-02-02T00:00:00.000Z', auditCount: 0,
  },
  {
    id: 13, name: 'Chetan Rao', email: 'chetan@x.com', role: 'admin', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-03T00:00:00.000Z',
    deletedAt: '2026-02-03T00:00:00.000Z', auditCount: 0,
  },
];

const skippedAdmins = [
  { id: 12, email: 'bharat@x.com' },
  { id: 13, email: 'chetan@x.com' },
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

function getResultsModal() {
  const heading = screen.getByRole('heading', { name: /Admin Accounts? Skipped/i });
  return heading.closest('div[style]')!.parentElement!.parentElement as HTMLElement;
}

async function openSkippedPurgePanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Empty Trash \(3\)/ }));
  const confirmHeading = await screen.findByRole('heading', { name: 'Empty Trash' });
  const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
  await user.click(within(confirmModal).getByRole('button', { name: /Empty Trash/ }));
  await screen.findByRole('heading', { name: '2 Admin Accounts Skipped' });
}

describe('Users skipped-purge inline Delete forever retry', () => {
  it('shows guidance and a Delete forever action for each kept admin', async () => {
    vi.mocked(api.delete).mockResolvedValue({ purged: 1, skipped: 2, skippedAdmins } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);
    await openSkippedPurgePanel(user);

    const panel = getResultsModal();
    expect(
      within(panel).getAllByText(/Once another admin account is active/i).length,
    ).toBe(2);
    expect(within(panel).getAllByRole('button', { name: 'Delete forever' })).toHaveLength(2);
  });

  it('retries the permanent delete and drops the row when it succeeds', async () => {
    vi.mocked(api.delete).mockImplementation(async (path: string) => {
      if (path === '/users/purge-all') return { purged: 1, skipped: 2, skippedAdmins } as never;
      if (path === '/users/12/permanent') return {} as never;
      return {} as never;
    });
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);
    await openSkippedPurgePanel(user);

    const panel = getResultsModal();
    // The first kept admin's row carries the first Delete forever button.
    await user.click(within(panel).getAllByRole('button', { name: 'Delete forever' })[0]);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/12/permanent');
    });

    // The panel narrows to one kept admin once the first is purged.
    await screen.findByRole('heading', { name: '1 Admin Account Skipped' });
    const narrowed = getResultsModal();
    expect(within(narrowed).queryByText('bharat@x.com')).not.toBeInTheDocument();
    expect(within(narrowed).getByText('chetan@x.com')).toBeInTheDocument();
  });

  it('keeps the row and surfaces the error when it is still the last admin', async () => {
    vi.mocked(api.delete).mockImplementation(async (path: string) => {
      if (path === '/users/purge-all') return { purged: 1, skipped: 2, skippedAdmins } as never;
      if (path === '/users/12/permanent') throw new Error('Cannot permanently delete the last admin account.');
      return {} as never;
    });
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);
    await openSkippedPurgePanel(user);

    const panel = getResultsModal();
    await user.click(within(panel).getAllByRole('button', { name: 'Delete forever' })[0]);

    expect(
      await screen.findByText('Cannot permanently delete the last admin account.'),
    ).toBeInTheDocument();
    // Both kept admins remain in the panel.
    expect(screen.getByRole('heading', { name: '2 Admin Accounts Skipped' })).toBeInTheDocument();
    expect(within(getResultsModal()).getByText('bharat@x.com')).toBeInTheDocument();
  });
});
