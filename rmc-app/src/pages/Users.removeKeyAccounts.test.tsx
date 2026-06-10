import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so the component's
// `instanceof` checks and error-message surfacing behave exactly as in prod.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import Users from '@/pages/Users';
import { api } from '@/lib/api';
import { ToastProvider } from '@/lib/toast-provider';

type DeletedUser = {
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

const DISPATCHER_DELETED: DeletedUser = {
  id: 2,
  name: 'Sunita Rao',
  email: 'sunita@aakruti.com',
  role: 'dispatcher',
  isActive: false,
  linkedClientId: null,
  linkedDriverId: null,
  createdAt: new Date('2026-02-01T00:00:00Z').toISOString(),
  deletedAt: new Date('2026-06-09T00:00:00Z').toISOString(),
  auditCount: 3,
};

// Two soft-deleted client logins. On a bulk restore the second collides with
// the first over the same linked client, so the server restores one and skips
// the other — mirroring `findLinkConflict` in server/src/routes/users.ts.
const CLIENT_DELETED_A: DeletedUser = {
  id: 3,
  name: 'Acme Login',
  email: 'acme@aakruti.com',
  role: 'client',
  isActive: false,
  linkedClientId: 10,
  linkedDriverId: null,
  createdAt: new Date('2026-03-01T00:00:00Z').toISOString(),
  deletedAt: new Date('2026-06-08T00:00:00Z').toISOString(),
  auditCount: 1,
};

const CLIENT_DELETED_B: DeletedUser = {
  ...CLIENT_DELETED_A,
  id: 4,
  name: 'Beta Login',
  email: 'beta@aakruti.com',
  linkedClientId: 11,
  auditCount: 2,
};

const LINK_CONFLICT_REASON =
  'This client is already linked to another account (Acme Login). Each client can be linked to only one user.';

// The trash listing each test starts with; api.get resolves the deleted view
// from this so a restore can mutate it and prove the row left the trash.
let deletedList: DeletedUser[] = [];

function mockReads() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/users') return [] as never; // active view is empty
    if (path === '/users?deleted=true') return deletedList as never;
    if (path === '/users/clients-list') return [] as never;
    if (path === '/users/drivers-list') return [] as never;
    if (path.startsWith('/audit-logs')) return { rows: [], hasMore: false } as never;
    if (path === '/users/lockout-status') return {} as never;
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
});

describe('Users page — restore-from-trash flow', () => {
  it('restores a single account: calls the restore endpoint, toasts success, and clears it from the trash', async () => {
    const user = userEvent.setup();
    deletedList = [DISPATCHER_DELETED];
    mockReads();
    // Restoring empties the trash, so the follow-up reload shows no rows.
    vi.mocked(api.post).mockImplementation(async (path: string) => {
      if (path === '/users/2/restore') {
        deletedList = [];
        return {} as never;
      }
      return {} as never;
    });

    renderUsers();

    // Open the trash (deleted) view and confirm the account is there.
    await user.click(screen.getByTitle('Show deleted accounts'));
    expect(await screen.findByText('sunita@aakruti.com')).toBeInTheDocument();

    // Click the row's Restore action.
    await user.click(screen.getByTitle('Restore account'));

    // It hit the single-restore endpoint...
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/2/restore', {}));
    // ...surfaced a success toast...
    expect(await screen.findByText("Sunita Rao's account has been restored.")).toBeInTheDocument();
    // ...and the account is gone from the trash listing after the reload.
    await waitFor(() => expect(screen.queryByText('sunita@aakruti.com')).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});

describe('Users page — linked-record warning on bulk restore', () => {
  it('warns when a restore is skipped because the linked client is already taken', async () => {
    const user = userEvent.setup();
    deletedList = [CLIENT_DELETED_A, CLIENT_DELETED_B];
    mockReads();
    // The server restores the first login and skips the second with the
    // link-conflict reason instead of failing the whole batch.
    vi.mocked(api.post).mockImplementation(async (path: string) => {
      if (path === '/users/restore-all') {
        return {
          restored: 1,
          skipped: 1,
          skippedDetails: [
            { id: CLIENT_DELETED_B.id, email: CLIENT_DELETED_B.email, reason: LINK_CONFLICT_REASON },
          ],
        } as never;
      }
      return {} as never;
    });

    renderUsers();

    // Open the trash and start a bulk restore.
    await user.click(screen.getByTitle('Show deleted accounts'));
    expect(await screen.findByText('acme@aakruti.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Restore All/i }));

    // Confirm in the bulk-restore modal.
    const dialog = await screen.findByRole('heading', { name: 'Restore All' });
    const modal = dialog.closest('div')!.parentElement!;
    await user.click(within(modal).getByRole('button', { name: 'Restore' }));

    // It hit the bulk-restore endpoint...
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/restore-all', {}));
    // ...surfaced a summary toast noting some accounts were skipped...
    expect(
      await screen.findByText('1 account restored. 1 account was skipped — see details below.'),
    ).toBeInTheDocument();
    // ...and opened the skipped-results dialog spelling out the linked-record reason.
    const skippedHeading = await screen.findByRole('heading', { name: '1 Account Skipped' });
    const skippedModal = skippedHeading.closest('div')!.parentElement!.parentElement!;
    expect(within(skippedModal).getByText('beta@aakruti.com')).toBeInTheDocument();
    expect(within(skippedModal).getByText(LINK_CONFLICT_REASON)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
