import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const ADMIN = {
  id: 1,
  name: 'Anita Admin',
  email: 'anita@aakruti.com',
  role: 'admin',
  isActive: true,
  linkedClientId: null,
  linkedDriverId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  auditCount: 0,
};

// Capture every /audit-logs query string the page issues so a test can assert
// the free-text `q` param is forwarded once the search box changes.
let auditCalls: string[] = [];

function mockApi() {
  auditCalls = [];
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/audit-logs/facets') return { actions: [], actors: [] } as never;
    if (path.startsWith('/audit-logs')) {
      auditCalls.push(path);
      return { rows: [], hasMore: false } as never;
    }
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return {} as never;
    if (path === '/users/authority-emails') return { emails: [] } as never;
    if (path === '/users?deleted=true') return [] as never;
    if (path === '/users') return [ADMIN] as never;
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
  mockApi();
});

describe('Users activity log — free-text search filter', () => {
  it('forwards the typed query as the q param to /audit-logs', async () => {
    const user = userEvent.setup();
    renderUsers();

    const input = await screen.findByLabelText('Search activity log');
    auditCalls = [];
    await user.type(input, 'anita@aakruti.com');

    await waitFor(() => {
      expect(auditCalls.some(p => p.includes('q=anita%40aakruti.com'))).toBe(true);
    });
  });

  it('drops the q param again when Clear Filters is clicked', async () => {
    const user = userEvent.setup();
    renderUsers();

    const input = await screen.findByLabelText('Search activity log');
    await user.type(input, 'lockout');
    await waitFor(() => expect(auditCalls.some(p => p.includes('q=lockout'))).toBe(true));

    const clear = await screen.findByText('Clear Filters');
    auditCalls = [];
    await user.click(clear);

    await waitFor(() => {
      expect(auditCalls.length).toBeGreaterThan(0);
      expect(auditCalls.every(p => !p.includes('q='))).toBe(true);
    });
    expect((input as HTMLInputElement).value).toBe('');
  });
});
