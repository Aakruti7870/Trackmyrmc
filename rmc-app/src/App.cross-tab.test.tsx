import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, useLocation } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';

// The SSE channel and the sidebar chrome are irrelevant to routing; stub them
// so the test exercises only the App routing tree (ProtectedRoutes /
// GuardedRoute / LoginRoute) and the cross-tab auth sync.
vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({ status: 'connected' as const, reconnect: () => {}, subscribe: () => () => {} }),
}));

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

// Page leaves are replaced with name stubs so assertions key off which route
// actually renders, without each page's own data fetching getting in the way.
function stub(name: string) {
  return { default: () => <div data-testid={`page-${name}`}>{name}</div> };
}
vi.mock('@/pages/Orders', () => stub('orders'));
vi.mock('@/pages/MyTrips', () => stub('my-trips'));
vi.mock('@/pages/Dashboard', () => stub('dashboard'));
vi.mock('@/pages/Login', () => stub('login'));
vi.mock('@/pages/Landing', () => stub('landing'));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

import App from '@/App';
import { api } from '@/lib/api';

function LocationProbe() {
  const [location] = useLocation();
  return <div data-testid="location">{location}</div>;
}

async function renderAppAt(path: string) {
  const { hook } = memoryLocation({ path });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Router hook={hook}>
        <App />
        <LocationProbe />
      </Router>
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
  vi.clearAllMocks();
  // /auth/me echoes back whatever session is cached so the optimistic user is
  // confirmed; everything else resolves empty so a page stub never matters.
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/auth/me') {
      const stored = localStorage.getItem('rmc_user');
      if (!stored) throw new Error('Unauthorized');
      return JSON.parse(stored);
    }
    return [] as never;
  });
});

describe('App cross-tab auth routing', () => {
  it('renders a protected route for a logged-in user', async () => {
    setSession(1, 'admin');
    await renderAppAt('/orders');

    expect(screen.getByTestId('page-orders')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/orders');
  });

  it('redirects an open protected tab to /login when the session is cleared elsewhere', async () => {
    setSession(1, 'admin');
    await renderAppAt('/orders');
    expect(screen.getByTestId('page-orders')).toBeInTheDocument();

    // Another tab logs out: removes both keys, firing a storage event.
    localStorage.removeItem('rmc_token');
    localStorage.removeItem('rmc_user');
    fireStorage('rmc_user');

    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(screen.getByTestId('page-login')).toBeInTheDocument();
    expect(screen.queryByTestId('page-orders')).not.toBeInTheDocument();
  });

  it('re-gates routes by the new role when a different account logs in elsewhere', async () => {
    setSession(1, 'admin');
    await renderAppAt('/orders');
    expect(screen.getByTestId('page-orders')).toBeInTheDocument();

    // Another tab logs in as a driver, who cannot access /orders. The route
    // must redirect to the driver's default path.
    setSession(2, 'driver');
    fireStorage('rmc_user');

    expect(screen.getByTestId('location')).toHaveTextContent('/my-trips');
    expect(screen.getByTestId('page-my-trips')).toBeInTheDocument();
    expect(screen.queryByTestId('page-orders')).not.toBeInTheDocument();
  });
});
