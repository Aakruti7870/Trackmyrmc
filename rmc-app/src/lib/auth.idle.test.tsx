import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth-provider';
import { api } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

function Probe() {
  const { user } = useAuth();
  return <div data-testid="who">{user ? user.role : 'anon'}</div>;
}

async function renderProbe() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  return result;
}

function setSession(id: number, role: string) {
  localStorage.setItem('rmc_token', `token-${id}`);
  localStorage.setItem('rmc_user', JSON.stringify({ id, name: `User ${id}`, email: `u${id}@x.com`, role }));
}

const THIRTY_MIN = 30 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.mocked(api.get).mockImplementation(async () => {
    const stored = localStorage.getItem('rmc_user');
    if (!stored) throw new Error('Unauthorized');
    return JSON.parse(stored);
  });
  vi.mocked(api.post).mockResolvedValue({ token: 'fresh-token' } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthProvider idle auto-logout', () => {
  it('logs out after 30 minutes of inactivity', async () => {
    setSession(1, 'admin');
    await renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('admin');

    await act(async () => { vi.advanceTimersByTime(THIRTY_MIN); });

    expect(screen.getByTestId('who')).toHaveTextContent('anon');
    expect(localStorage.getItem('rmc_token')).toBeNull();
  });

  it('renews the token on activity and keeps an active user signed in', async () => {
    setSession(1, 'admin');
    await renderProbe();

    // Just before the idle limit, real user activity resets the window and
    // silently renews the token.
    await act(async () => { vi.advanceTimersByTime(25 * 60 * 1000); });
    await act(async () => { window.dispatchEvent(new MouseEvent('mousedown')); });
    expect(api.post).toHaveBeenCalledWith('/auth/refresh', {});

    // Another 25 minutes later (55 total, but only 25 since the reset) the user
    // is still signed in.
    await act(async () => { vi.advanceTimersByTime(25 * 60 * 1000); });
    expect(screen.getByTestId('who')).toHaveTextContent('admin');
  });
});
