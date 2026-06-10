import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '@/lib/auth';

function Probe() {
  const { user } = useAuth();
  return <div data-testid="who">{user ? `${user.id}:${user.role}` : 'anon'}</div>;
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
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
});

describe('AuthProvider cross-tab sync', () => {
  it('logs out other tabs when the session is cleared elsewhere', () => {
    setSession(1, 'admin');
    renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    // Another tab logs out: removes both keys, firing a storage event per key.
    localStorage.removeItem('rmc_token');
    localStorage.removeItem('rmc_user');
    fireStorage('rmc_user');

    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });

  it('switches to the new account when a different user logs in elsewhere', () => {
    setSession(1, 'admin');
    renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    // Another tab logs in as a different user.
    setSession(2, 'driver');
    fireStorage('rmc_user');

    expect(screen.getByTestId('who')).toHaveTextContent('2:driver');
  });

  it('reacts to a token-only removal in another tab', () => {
    setSession(1, 'admin');
    renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    localStorage.removeItem('rmc_token');
    fireStorage('rmc_token');

    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });

  it('logs out when storage is cleared entirely (key === null)', () => {
    setSession(1, 'admin');
    renderProbe();
    expect(screen.getByTestId('who')).toHaveTextContent('1:admin');

    localStorage.clear();
    fireStorage(null);

    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });
});
