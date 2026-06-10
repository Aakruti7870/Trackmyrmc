import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
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

// The trash starts with two deleted accounts. `currentDeleted` is what the
// `/users?deleted=true` fetch returns and is mutated between loads so a clean
// restore can drop a row, mirroring what the real backend would report.
const baseDeleted: DeletedUser[] = [
  {
    id: 11, name: 'Asha Patel', email: 'asha@x.com', role: 'dispatcher', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: '2026-02-01T00:00:00.000Z', auditCount: 0,
  },
  {
    id: 13, name: 'Chetan Rao', email: 'chetan@x.com', role: 'driver', isActive: false,
    linkedClientId: 7, linkedDriverId: 9, createdAt: '2026-01-03T00:00:00.000Z',
    deletedAt: '2026-02-03T00:00:00.000Z', auditCount: 0,
  },
];

let currentDeleted: DeletedUser[] = [];

function mockGet() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/audit-logs')) return { rows: [], hasMore: false } as never;
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return {} as never;
    if (path === '/users?deleted=true') return currentDeleted as never;
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
  currentDeleted = baseDeleted.map(u => ({ ...u }));
  mockGet();
});

async function enterDeletedView(user: ReturnType<typeof userEvent.setup>) {
  // Wait for the initial (active) load to settle, then switch to the trash view.
  await user.click(await screen.findByRole('button', { name: /Deleted/i }));
  // The deleted rows must be on screen before we interact with the row buttons.
  await screen.findByText('Asha Patel');
}

// The per-row "Restore" button lives in the row whose name cell we locate first.
function restoreButtonForRow(name: string) {
  const row = screen.getByText(name).closest('tr') as HTMLElement;
  return within(row).getByRole('button', { name: /^Restore(ing…)?$/ });
}

describe('Users single-restore button', () => {
  it('shows the conflict reason and keeps the row when the link is already taken', async () => {
    const user = userEvent.setup();
    // The single-restore route refuses with a 409 because the driver link is held.
    const reason = 'This driver is already linked to another account (Someone). Each driver can be linked to only one user.';
    vi.mocked(api.post).mockRejectedValueOnce(new Error(reason));
    renderUsers();
    await enterDeletedView(user);

    await user.click(restoreButtonForRow('Chetan Rao'));

    // The per-row restore hits the single-restore route for that account only.
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/13/restore', {});
    });

    // The conflict reason surfaces in an error toast.
    const toast = await screen.findByText(reason);
    expect(toast.closest('[data-toast-type]')).toHaveAttribute('data-toast-type', 'error');

    // The blocked row stays in the trash, and the list was NOT refreshed
    // (a blocked restore must not trigger load()).
    expect(screen.getByText('Chetan Rao')).toBeInTheDocument();
    const deletedFetches = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/users?deleted=true').length;
    // Initial active load (1 deletedCount probe) + entering the trash view (list + count) = 3 fetches.
    expect(deletedFetches).toBe(3);
  });

  it('removes the row and refreshes the list on a clean restore', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({ id: 11, deletedAt: null } as never);
    renderUsers();
    await enterDeletedView(user);

    const before = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/users?deleted=true').length;

    // The backend would now report the account as restored, so drop it from the trash.
    currentDeleted = baseDeleted.filter(u => u.id !== 11).map(u => ({ ...u }));
    await user.click(restoreButtonForRow('Asha Patel'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/11/restore', {});
    });

    // A success toast confirms the restore.
    const toast = await screen.findByText("Asha Patel's account has been restored.");
    expect(toast.closest('[data-toast-type]')).toHaveAttribute('data-toast-type', 'success');

    // The restored row is gone and the other deleted account remains.
    await waitFor(() => {
      expect(screen.queryByText('Asha Patel')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Chetan Rao')).toBeInTheDocument();

    // load() re-fetched the deleted list after the restore.
    const after = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/users?deleted=true').length;
    expect(after).toBeGreaterThan(before);
  });
});
