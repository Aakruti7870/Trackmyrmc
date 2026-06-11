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

const FACET_ACTORS = [
  { id: 1, name: 'Anita Admin', deleted: false },
  { id: 7, name: 'Bhavesh Boss', deleted: false },
  // A departed admin: account deleted (id nulled) but the name is preserved.
  { id: null, name: 'Departed Admin', deleted: true },
];

// Capture every /audit-logs query string the page issues so a test can assert
// the actorId param is forwarded once the actor filter changes.
let auditCalls: string[] = [];

function mockApi() {
  auditCalls = [];
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/audit-logs/facets') return { actions: [], actors: FACET_ACTORS } as never;
    if (path.startsWith('/audit-logs')) {
      auditCalls.push(path);
      return { rows: [], hasMore: false } as never;
    }
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return {} as never;
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

describe('Users activity log — actor (performed-by) filter', () => {
  it('populates the actor dropdown from /audit-logs/facets', async () => {
    renderUsers();

    const select = (await screen.findByRole('option', { name: 'All Actors' })).closest('select')!;
    expect(select).toBeInTheDocument();
    // The default "all actors" option plus one option per distinct facet actor.
    await waitFor(() => expect(screen.getByRole('option', { name: 'Bhavesh Boss' })).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Anita Admin' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All Actors' })).toBeInTheDocument();
  });

  it('forwards the chosen actorId to /audit-logs when an actor is selected', async () => {
    const user = userEvent.setup();
    renderUsers();

    const select = (await screen.findByRole('option', { name: 'All Actors' })).closest('select')!;
    await waitFor(() => expect(screen.getByRole('option', { name: 'Bhavesh Boss' })).toBeInTheDocument());

    auditCalls = [];
    await user.selectOptions(select, '7');

    await waitFor(() => {
      expect(auditCalls.some(p => p.includes('actorId=7'))).toBe(true);
    });
  });

  it('shows deleted actors in the dropdown with a "(deleted)" label', async () => {
    renderUsers();
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Departed Admin (deleted)' })).toBeInTheDocument());
  });

  it('forwards a deleted actor by name (actorName, not actorId)', async () => {
    const user = userEvent.setup();
    renderUsers();

    const select = (await screen.findByRole('option', { name: 'All Actors' })).closest('select')!;
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Departed Admin (deleted)' })).toBeInTheDocument());

    auditCalls = [];
    await user.selectOptions(select, 'name:Departed Admin');

    await waitFor(() => {
      expect(auditCalls.some(p => p.includes('actorName=Departed+Admin'))).toBe(true);
      expect(auditCalls.every(p => !p.includes('actorId='))).toBe(true);
    });
  });

  it('drops the actorId param again when the filter is cleared', async () => {
    const user = userEvent.setup();
    renderUsers();

    const select = (await screen.findByRole('option', { name: 'All Actors' })).closest('select')!;
    await waitFor(() => expect(screen.getByRole('option', { name: 'Bhavesh Boss' })).toBeInTheDocument());

    await user.selectOptions(select, '7');
    await waitFor(() => expect(auditCalls.some(p => p.includes('actorId=7'))).toBe(true));

    const clear = await screen.findByText('Clear Filters');
    auditCalls = [];
    await user.click(clear);

    await waitFor(() => {
      expect(auditCalls.length).toBeGreaterThan(0);
      expect(auditCalls.every(p => !p.includes('actorId='))).toBe(true);
    });
  });
});
