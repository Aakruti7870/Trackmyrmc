import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth-provider';

// These tests exercise the real api.ts request layer (no api mock) so the
// startup GET /api/auth/me path and its 401 session-clear + redirect are both
// covered. Only window.fetch is stubbed per test.

// Mirror App.tsx's ProtectedRoutes gating: loading first (so the authenticated
// UI never flashes before verification), then anon, then the protected UI.
function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div data-testid="state">loading</div>;
  if (!user) return <div data-testid="state">anon</div>;
  return <div data-testid="state">protected:{user.id}:{user.role}</div>;
}

function setSession(user: { id: number; name: string; email: string; role: string }) {
  localStorage.setItem('rmc_token', `token-${user.id}`);
  localStorage.setItem('rmc_user', JSON.stringify(user));
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const realLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  // Replace window.location with a writable stub so clearSessionAndRedirect's
  // `window.location.href = '/login'` is observable (jsdom won't navigate).
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { pathname: '/', href: '/' },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: realLocation,
  });
  vi.restoreAllMocks();
});

describe('AuthProvider startup session verification', () => {
  it('clears the session and redirects to /login when /auth/me returns 401', async () => {
    setSession({ id: 1, name: 'User 1', email: 'u1@x.com', role: 'admin' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ error: 'Token expired' }, 401));

    await act(async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );
    });

    // Verification hit the real /auth/me endpoint with the stored token.
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      })
    );
    // Session cleared by the api 401 handler.
    expect(localStorage.getItem('rmc_token')).toBeNull();
    expect(localStorage.getItem('rmc_user')).toBeNull();
    // Redirected to /login, and the protected UI never rendered.
    expect(window.location.href).toBe('/login');
    expect(screen.getByTestId('state')).toHaveTextContent('anon');
    expect(screen.queryByText(/^protected:/)).not.toBeInTheDocument();
  });

  it('stays logged in and refreshes the cached user from the /auth/me payload', async () => {
    // Cached session is stale (role driver); the server says this user is now
    // an admin, so the cache should be overwritten from the /me response.
    setSession({ id: 7, name: 'Old Name', email: 'u7@x.com', role: 'driver' });
    const fresh = { id: 7, name: 'New Name', email: 'u7@x.com', role: 'admin' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(fresh, 200));

    await act(async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId('state')).toHaveTextContent('protected:7:admin');
    // Session preserved and cache refreshed from the verified payload.
    expect(localStorage.getItem('rmc_token')).toBe('token-7');
    expect(JSON.parse(localStorage.getItem('rmc_user')!)).toEqual(fresh);
    expect(window.location.href).toBe('/');
  });

  it('keeps loading until verification resolves (no authenticated-UI flash)', async () => {
    setSession({ id: 1, name: 'User 1', email: 'u1@x.com', role: 'admin' });
    let resolveFetch!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pending as Promise<Response>);

    await act(async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );
    });

    // /auth/me is still in flight: the cached user is set optimistically but
    // loading gates the protected UI so nothing authenticated shows yet.
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    expect(screen.queryByText(/^protected:/)).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(
        jsonResponse({ id: 1, name: 'User 1', email: 'u1@x.com', role: 'admin' }, 200)
      );
      await pending;
    });

    expect(screen.getByTestId('state')).toHaveTextContent('protected:1:admin');
  });
});
