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
  // Wait for the initial (active) load to settle, then switch to the trash view.
  await user.click(await screen.findByRole('button', { name: /Deleted/i }));
  // The deleted rows must be on screen before we interact with the bulk UI.
  await screen.findByText('Asha Patel');
}

// Scope to the skipped-purge results panel. The same emails also render in the
// deleted-users table, so every email assertion must run within this modal.
function getResultsModal() {
  const resultsHeading = screen.getByRole('heading', { name: /Admin Accounts? Skipped/i });
  return resultsHeading.closest('div[style]')!.parentElement!.parentElement as HTMLElement;
}

describe('Users skipped-purge results modal', () => {
  it('lists every skipped admin email after Empty Trash returns skippedAdmins', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      purged: 1,
      skipped: 2,
      skippedAdmins: [
        { id: 12, email: 'bharat@x.com' },
        { id: 13, email: 'chetan@x.com' },
      ],
    } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Open and confirm the Empty Trash modal.
    await user.click(screen.getByRole('button', { name: /Empty Trash \(3\)/ }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Empty Trash' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Empty Trash/ }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all');
    });

    // The results modal opens with a count and lists each skipped admin email.
    await screen.findByRole('heading', { name: '2 Admin Accounts Skipped' });
    const resultsModal = getResultsModal();
    expect(within(resultsModal).getByText('bharat@x.com')).toBeInTheDocument();
    expect(within(resultsModal).getByText('chetan@x.com')).toBeInTheDocument();
  });

  it('lists every skipped admin email after Delete Selected returns skippedAdmins', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      purged: 1,
      skipped: 2,
      skippedAdmins: [
        { id: 12, email: 'bharat@x.com' },
        { id: 13, email: 'chetan@x.com' },
      ],
    } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Select all three rows, then open and confirm the Delete Selected modal.
    await user.click(screen.getByRole('checkbox', { name: 'Select all deleted accounts' }));
    await user.click(screen.getByRole('button', { name: /Delete selected forever \(3\)/i }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Delete Selected Forever' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Delete selected forever/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all', { ids: [11, 12, 13] });
    });

    // The results modal opens and lists each skipped admin email.
    await screen.findByRole('heading', { name: '2 Admin Accounts Skipped' });
    const resultsModal = getResultsModal();
    expect(within(resultsModal).getByText('bharat@x.com')).toBeInTheDocument();
    expect(within(resultsModal).getByText('chetan@x.com')).toBeInTheDocument();
  });

  it('does not open the results modal when no admins were skipped', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      purged: 3,
      skipped: 0,
      skippedAdmins: [],
    } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Empty Trash \(3\)/ }));
    const confirmHeading = await screen.findByRole('heading', { name: 'Empty Trash' });
    const confirmModal = confirmHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Empty Trash/ }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all');
    });

    // Success toast confirms the purge ran, and no skipped-results modal renders.
    expect(await screen.findByText('3 accounts permanently deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Admin Accounts? Skipped/i })).not.toBeInTheDocument();
  });
});
