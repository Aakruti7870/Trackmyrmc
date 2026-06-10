import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth-provider';
import { api } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

function Probe() {
  const { user } = useAuth();
  return <div data-testid="who">{user ? `${user.id}:${user.role}` : 'anon'}</div>;
}

// Render and flush the provider's async session verification (the /auth/me
// call) inside act(...) so the initial state settles before assertions and
// no "not wrapped in act" warnings leak out.
async function renderProbe() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  return result;
}

function setSession(id: number, role: string) {
  localStorage.setItem('rmc_token', `token-${id}`);
  localStorage.setItem('rmc_user', JSON.stringify({ id, name: `User ${id}`, email: `u${id}@x.com`, role }));
}

function fireStorage(key: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });
}

beforeEach(() => {
  localStorage.clear();
  // /auth/me echoes back whatever session is currently cached, so the
  // optimistic user is confirmed rather than dropped.
  vi.mocked(api.get).mockImplementation(async () => {
    const stored = localStorage.getItem('rmc_user');
    if (!stored) throw new Error('Unauthorized');
    return JSON.parse(stored);
  });
});

describe('AuthProvider cross-tab sync', () => {
  it('logs out other tabs when the session is cleared elsewhere', async () => {
    setSession(1, 'admin');
    await renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    // Another tab logs out: removes both keys, firing a storage event per key.
    localStorage.removeItem('rmc_token');
    localStorage.removeItem('rmc_user');
    fireStorage('rmc_user');

    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });

  it('switches to the new account when a different user logs in elsewhere', async () => {
    setSession(1, 'admin');
    await renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    // Another tab logs in as a different user.
    setSession(2, 'driver');
    fireStorage('rmc_user');

    expect(screen.getByTestId('who')).toHaveTextContent('2:driver');
  });

  it('reacts to a token-only removal in another tab', async () => {
    setSession(1, 'admin');
    await renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    localStorage.removeItem('rmc_token');
    fireStorage('rmc_token');

    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });

  it('logs out when storage is cleared entirely (key === null)', async () => {
    setSession(1, 'admin');
    await renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    localStorage.clear();
    fireStorage(null);

    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });
});
