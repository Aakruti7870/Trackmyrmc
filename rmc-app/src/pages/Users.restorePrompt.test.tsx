import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so the component's
// `instanceof ApiError` check and `e.data.code` branch behave as in prod.
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

// The soft-deleted account whose email an admin tries to reuse. Mirrors the
// `email_soft_deleted` conflict raised by server/src/routes/users.ts.
const DELETED_ID = 7;
const DELETED_NAME = 'Sunita Rao';
const REUSED_EMAIL = 'sunita@aakruti.com';
const CONFLICT_MESSAGE =
  'An account with this email was deleted. Restore it instead of creating a new one.';

function mockReads() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/users') return [] as never;
    if (path === '/users?deleted=true') return [] as never;
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

describe('Users page — restore prompt when reusing a deleted email', () => {
  it('surfaces the inline restore prompt on an email_soft_deleted conflict and restores on click', async () => {
    const user = userEvent.setup();
    mockReads();
    // Creating with the reused email is rejected with the soft-deleted conflict;
    // the follow-up restore call succeeds.
    vi.mocked(api.post).mockImplementation(async (path: string) => {
      if (path === '/users') {
        throw new ApiError(CONFLICT_MESSAGE, 409, {
          error: CONFLICT_MESSAGE,
          code: 'email_soft_deleted',
          deletedUserId: DELETED_ID,
          deletedUserName: DELETED_NAME,
        });
      }
      if (path === `/users/${DELETED_ID}/restore`) return {} as never;
      return {} as never;
    });

    renderUsers();

    // Open the create modal.
    await user.click(await screen.findByRole('button', { name: /Add User/i }));
    const heading = await screen.findByRole('heading', { name: 'Add New User' });
    const modal = heading.closest('div')!.parentElement!.parentElement!;

    // Fill in name + the conflicting email and submit. The default role is a
    // passwordless staff account (signs in with a one-time code), so the create
    // form has no password field — only the Super Admin (authority) role does.
    await user.type(within(modal).getByPlaceholderText('e.g. Rajesh Kumar'), 'Sunita Rao');
    await user.type(within(modal).getByPlaceholderText('user@example.com'), REUSED_EMAIL);
    await user.click(within(modal).getByRole('button', { name: 'Create Account' }));

    // The create attempt hit POST /users...
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({
      email: REUSED_EMAIL,
    })));

    // ...the conflict message is shown inline with a one-click restore button.
    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
    const restoreButton = await screen.findByRole('button', {
      name: `Restore ${DELETED_NAME}'s account`,
    });

    // Clicking it restores the soft-deleted account...
    await user.click(restoreButton);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/users/${DELETED_ID}/restore`, {}),
    );
    // ...and surfaces a success toast.
    expect(
      await screen.findByText(`${DELETED_NAME}'s account has been restored.`),
    ).toBeInTheDocument();

    expect(api.post).toHaveBeenCalledTimes(2);
  });
});
