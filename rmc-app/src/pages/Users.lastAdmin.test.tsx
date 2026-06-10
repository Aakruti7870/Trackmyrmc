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
import { api, ApiError } from '@/lib/api';
import { ToastProvider } from '@/lib/toast-provider';

const SOFT_DELETE_ERROR = 'Cannot delete the last remaining admin account.';
const PURGE_ERROR = 'Cannot permanently delete the last admin account.';

const ADMIN = {
  id: 1,
  name: 'Rajesh Kumar',
  email: 'admin@aakruti.com',
  role: 'admin',
  isActive: true,
  linkedClientId: null,
  linkedDriverId: null,
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  deletedAt: null as string | null,
  auditCount: 0,
};

const ADMIN_DELETED = {
  ...ADMIN,
  isActive: false,
  deletedAt: new Date('2026-06-10T00:00:00Z').toISOString(),
};

// The Users page fans out several reads on mount (and again when the
// deleted-filter toggles). Resolve each by path so the single seeded admin is
// the only account in both the active and the deleted listings.
function mockReads() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/users') return [ADMIN] as never;
    if (path === '/users?deleted=true') return [ADMIN_DELETED] as never;
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
  mockReads();
});

describe('Users page — last-admin removal is refused', () => {
  it('soft-delete: surfaces the guard error toast and keeps the admin listed', async () => {
    const user = userEvent.setup();
    // The server guard rejects with HTTP 400; the api layer turns that into an
    // ApiError whose message the UI is expected to surface as a toast.
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError(SOFT_DELETE_ERROR, 400, { error: SOFT_DELETE_ERROR }),
    );

    renderUsers();

    // The lone admin is listed in the active view.
    expect(await screen.findByText('admin@aakruti.com')).toBeInTheDocument();

    // Open the delete-confirmation modal for the admin and confirm.
    await user.click(screen.getByTitle('Delete user'));
    const dialog = await screen.findByRole('heading', { name: 'Delete Account' });
    const modal = dialog.closest('div')!.parentElement!;
    await user.click(within(modal).getByRole('button', { name: /Delete Account/i }));

    // The attempt hit the soft-delete endpoint...
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/1'));
    // ...and was refused with the guard's error surfaced as a toast.
    expect(await screen.findByText(SOFT_DELETE_ERROR)).toBeInTheDocument();
    // The admin was never removed from the listing.
    expect(screen.getAllByText('admin@aakruti.com').length).toBeGreaterThan(0);
    expect(api.delete).toHaveBeenCalledTimes(1);
  });

  it('Delete Forever: surfaces the guard error toast and keeps the admin in the trash', async () => {
    const user = userEvent.setup();
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError(PURGE_ERROR, 400, { error: PURGE_ERROR }),
    );

    renderUsers();

    // Switch to the deleted (trash) view where "Delete Forever" lives.
    expect(await screen.findByText('admin@aakruti.com')).toBeInTheDocument();
    await user.click(screen.getByTitle('Show deleted accounts'));

    // The soft-deleted admin appears with a permanent-delete action.
    const rowPurgeBtn = await screen.findByTitle('Permanently delete account (frees the email)');
    await user.click(rowPurgeBtn);

    // Confirm in the permanent-delete modal.
    const dialog = await screen.findByRole('heading', { name: 'Permanently Delete Account' });
    const modal = dialog.closest('div')!.parentElement!;
    await user.click(within(modal).getByRole('button', { name: /Delete Forever/i }));

    // The attempt hit the permanent-delete endpoint and was refused.
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/1/permanent'));
    expect(await screen.findByText(PURGE_ERROR)).toBeInTheDocument();
    // The admin still sits in the trash — nothing was purged.
    expect(screen.getAllByText('admin@aakruti.com').length).toBeGreaterThan(0);
    expect(api.delete).toHaveBeenCalledTimes(1);
  });
});
