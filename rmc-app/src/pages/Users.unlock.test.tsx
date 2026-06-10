import { render, screen, waitFor } from '@testing-library/react';
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

const DISPATCHER = {
  id: 2,
  name: 'Sunita Rao',
  email: 'sunita@aakruti.com',
  role: 'dispatcher',
  isActive: true,
  linkedClientId: null,
  linkedDriverId: null,
  createdAt: new Date('2026-02-01T00:00:00Z').toISOString(),
  deletedAt: null as string | null,
  auditCount: 0,
};

// A lockout window far enough in the future that the "expiring soon" (<2 min)
// branch never fires, so the badge stays the plain locked variant.
const LOCKED_UNTIL = Date.now() + 60 * 60 * 1000;

// The lockout map the page seeds the locked badge from, keyed by user id and
// mirroring GET /users/lockout-status. Tests mutate this so a follow-up poll
// can prove the badge clears.
let lockoutStatus: Record<number, { locked: boolean; lockedUntil: number | null }> = {};

function mockReads() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/users') return [DISPATCHER] as never;
    if (path === '/users?deleted=true') return [] as never;
    if (path === '/users/clients-list') return [] as never;
    if (path === '/users/drivers-list') return [] as never;
    if (path.startsWith('/audit-logs')) return { rows: [], hasMore: false } as never;
    if (path === '/users/lockout-status') return lockoutStatus as never;
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

describe('Users page — unlock a locked account', () => {
  it('renders the locked badge, calls the unlock endpoint, toasts success, and clears the badge', async () => {
    const user = userEvent.setup();
    lockoutStatus = { [DISPATCHER.id]: { locked: true, lockedUntil: LOCKED_UNTIL } };
    mockReads();
    vi.mocked(api.post).mockResolvedValue({ ok: true, userId: DISPATCHER.id } as never);

    renderUsers();

    // The locked account is listed with its locked badge.
    expect(await screen.findByText('sunita@aakruti.com')).toBeInTheDocument();
    expect(await screen.findByText(/🔒 Locked/)).toBeInTheDocument();

    // Click the row's Unlock action.
    await user.click(screen.getByTitle('Unlock account'));

    // It hit the per-user unlock endpoint...
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/2/unlock', {}));
    // ...surfaced a success toast...
    expect(await screen.findByText("Sunita Rao's account has been unlocked.")).toBeInTheDocument();
    // ...and the locked badge is gone (the handler clears the lockout locally).
    await waitFor(() => expect(screen.queryByText(/🔒 Locked/)).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
