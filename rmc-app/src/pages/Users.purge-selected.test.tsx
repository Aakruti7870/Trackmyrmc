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
    id: 12, name: 'Bharat Shah', email: 'bharat@x.com', role: 'plant_operator', isActive: false,
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
  // The deleted rows must be on screen before we interact with the selection UI.
  await screen.findByText('Asha Patel');
}

async function openAndConfirmPurgeSelected(user: ReturnType<typeof userEvent.setup>, count: number) {
  // The toolbar button (lowercase, with the selection count) opens the modal.
  await user.click(screen.getByRole('button', { name: new RegExp(`Delete selected forever \\(${count}\\)`) }));
  // Scope to the modal so we click its confirm button, not the toolbar one.
  const modalHeading = await screen.findByRole('heading', { name: 'Delete Selected Forever' });
  const modal = modalHeading.closest('div[style]')!.parentElement as HTMLElement;
  await user.click(within(modal).getByRole('button', { name: /Delete selected forever/ }));
}

describe('Users delete-selected (partial purge) UI', () => {
  it('purges only the checkbox-selected accounts and clears the selection', async () => {
    vi.mocked(api.delete).mockResolvedValue({ purged: 2, skipped: 0, skippedAdmins: [] } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // With nothing selected there is no "Delete selected forever" toolbar button.
    expect(screen.queryByRole('button', { name: /Delete selected forever/ })).not.toBeInTheDocument();

    // Select two of the three deleted accounts.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Bharat Shah' }));

    // The toolbar button now reflects the selection count.
    expect(screen.getByRole('button', { name: /Delete selected forever \(2\)/ })).toBeInTheDocument();

    await openAndConfirmPurgeSelected(user, 2);

    // The purge-all endpoint is hit with only the selected ids.
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all', { ids: [11, 12] });
    });

    // The success toast reports the number of accounts removed.
    expect(await screen.findByText('2 accounts permanently deleted.')).toBeInTheDocument();

    // After the purge the confirmation modal closes.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete Selected Forever' })).not.toBeInTheDocument();
    });

    // The selection clears — the toolbar button disappears and no checkbox stays checked.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Delete selected forever/ })).not.toBeInTheDocument();
    });
    screen.getAllByRole('checkbox').forEach(cb => {
      expect(cb).not.toBeChecked();
    });
  });

  it('surfaces the skip messaging and lists the kept admin account', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      purged: 1,
      skipped: 1,
      skippedAdmins: [{ id: 13, email: 'chetan@x.com' }],
    } as never);
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Select the dispatcher and the admin — the admin must be skipped.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Chetan Rao' }));

    await openAndConfirmPurgeSelected(user, 2);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all', { ids: [11, 13] });
    });

    // The skip toast points the admin to the results panel.
    expect(
      await screen.findByText(
        '1 account permanently deleted. 1 admin account was skipped — see details below.',
      ),
    ).toBeInTheDocument();

    // The results modal lists the skipped admin by email (scope to the modal
    // panel since the same email also appears in the deleted-users table).
    const resultsHeading = await screen.findByRole('heading', { name: '1 Admin Account Skipped' });
    const resultsModal = resultsHeading.closest('div[style]')!.parentElement!.parentElement as HTMLElement;
    expect(within(resultsModal).getByText('chetan@x.com')).toBeInTheDocument();
  });

  it('cancels without calling the purge-all API', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    await user.click(screen.getByRole('button', { name: /Delete selected forever \(1\)/ }));
    const modalHeading = await screen.findByRole('heading', { name: 'Delete Selected Forever' });
    const modal = modalHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: /Cancel/ }));

    // The modal closes and no destructive call was made.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete Selected Forever' })).not.toBeInTheDocument();
    });
    expect(api.delete).not.toHaveBeenCalled();

    // The selection is preserved after cancelling.
    expect(screen.getByRole('button', { name: /Delete selected forever \(1\)/ })).toBeInTheDocument();
  });
});
