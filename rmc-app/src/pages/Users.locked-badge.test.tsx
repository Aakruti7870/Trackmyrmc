import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so the component's
// error handling behaves exactly as in prod.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import Users from '@/pages/Users';
import { api } from '@/lib/api';
import { ToastProvider } from '@/lib/toast-provider';

type LockoutInfo = { locked: boolean; lockedUntil: number | null };

const LOCKED_USER = {
  id: 1,
  name: 'Locked Larry',
  email: 'larry@aakruti.com',
  role: 'dispatcher',
  isActive: true,
  linkedClientId: null,
  linkedDriverId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  auditCount: 0,
};

// Wire up every endpoint the page loads on mount. The lockout-status response is
// supplied by the caller so each test controls the badge's time-sensitive state.
function mockApi(lockoutStatus: () => Record<number, LockoutInfo>) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/audit-logs')) return { rows: [], hasMore: false } as never;
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return lockoutStatus() as never;
    if (path === '/users?deleted=true') return [] as never;
    if (path === '/users') return [LOCKED_USER] as never;
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Users locked badge — time-sensitive transitions', () => {
  it('shows the normal "Locked" badge when the lockout has plenty of time left', async () => {
    // Ten minutes out — well above the 2-minute "expiring soon" threshold.
    const lockedUntil = Date.now() + 10 * 60_000;
    mockApi(() => ({ 1: { locked: true, lockedUntil } }));
    renderUsers();

    const badge = await screen.findByText(/🔒 Locked/);
    expect(badge).toBeInTheDocument();
    // It must NOT yet be in the amber "expiring soon" warning state.
    expect(screen.queryByText(/⏳ Unlocking soon/)).not.toBeInTheDocument();
  });

  it('switches to the "Unlocking soon" warning when under 2 minutes remain', async () => {
    // One minute left — inside the 2-minute warning window.
    const lockedUntil = Date.now() + 60_000;
    mockApi(() => ({ 1: { locked: true, lockedUntil } }));
    renderUsers();

    const warning = await screen.findByText(/⏳ Unlocking soon/);
    expect(warning).toBeInTheDocument();
    // The plain "Locked" badge should not be shown in the warning state.
    expect(screen.queryByText(/🔒 Locked/)).not.toBeInTheDocument();
  });

  it('clears the badge once the lockout window passes (poll reports unlocked)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));

    // Models the server: locked while now < lockedUntil, unlocked afterwards.
    const lockedUntil = Date.now() + 20_000;
    mockApi(() =>
      Date.now() < lockedUntil
        ? { 1: { locked: true, lockedUntil } }
        : { 1: { locked: false, lockedUntil: null } }
    );

    renderUsers();

    // Flush the on-mount loads so the first lockout-status response is applied.
    // 20s out is inside the 2-minute window, so the badge starts in its warning
    // state — confirming the lock is still surfaced before it expires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/⏳ Unlocking soon/)).toBeInTheDocument();

    // Advance past the lockout window. The 30s poll re-fetches and the server
    // now reports the account as unlocked, so the badge clears on its own.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.queryByText(/⏳ Unlocking soon/)).not.toBeInTheDocument();
    expect(screen.queryByText(/🔒 Locked/)).not.toBeInTheDocument();
  });
});
