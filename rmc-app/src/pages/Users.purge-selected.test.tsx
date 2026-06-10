import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

import Users from '@/pages/Users';
import { ToastProvider } from '@/lib/toast-provider';
import { api } from '@/lib/api';

type DeletedUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
  createdAt: string;
  deletedAt: string;
  auditCount: number;
};

const deleted: DeletedUser[] = [
  {
    id: 11, name: 'Asha Patel', email: 'asha@x.com', role: 'dispatcher', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: '2026-02-01T00:00:00.000Z', auditCount: 0,
  },
  {
    id: 12, name: 'Bharat Shah', email: 'bharat@x.com', role: 'plant_operator', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-02-02T00:00:00.000Z', auditCount: 0,
  },
  {
    id: 13, name: 'Chetan Rao', email: 'chetan@x.com', role: 'driver', isActive: false,
    linkedClientId: null, linkedDriverId: null, createdAt: '2026-01-03T00:00:00.000Z',
    deletedAt: '2026-02-03T00:00:00.000Z', auditCount: 0,
  },
];

function mockGet() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/users/audit-log')) return [] as never;
    if (path === '/users/clients-list' || path === '/users/drivers-list') return [] as never;
    if (path === '/users/lockout-status') return {} as never;
    if (path === '/users?deleted=true') return deleted as never;
    if (path === '/users') return [] as never;
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
  mockGet();
  vi.mocked(api.delete).mockResolvedValue({ purged: 2, skipped: 0 } as never);
});

async function enterDeletedView(user: ReturnType<typeof userEvent.setup>) {
  // Wait for the initial (active) load to settle, then switch to the trash view.
  await user.click(await screen.findByRole('button', { name: /Deleted/i }));
  // The deleted rows must be on screen before we interact with the selection UI.
  await screen.findByText('Asha Patel');
}

function selectAllCheckbox() {
  return screen.getByRole('checkbox', { name: 'Select all deleted accounts' }) as HTMLInputElement;
}

describe('Users delete-selected (bulk purge) selection UI', () => {
  it('hides the "Delete selected forever" action until a row is selected', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // No selection → no bulk-delete action bar button.
    expect(screen.queryByRole('button', { name: /Delete selected forever/i })).not.toBeInTheDocument();

    // Selecting a row reveals the action bar button with the selection count.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    expect(screen.getByRole('button', { name: /Delete selected forever \(1\)/i })).toBeInTheDocument();

    // Deselecting hides it again.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    expect(screen.queryByRole('button', { name: /Delete selected forever/i })).not.toBeInTheDocument();
  });

  it('drives the select-all checkbox between unchecked, indeterminate, and checked states', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Nothing selected: header checkbox is unchecked and not indeterminate.
    expect(selectAllCheckbox().checked).toBe(false);
    expect(selectAllCheckbox().indeterminate).toBe(false);

    // Selecting one of three rows puts the header checkbox in the indeterminate state.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    expect(selectAllCheckbox().checked).toBe(false);
    expect(selectAllCheckbox().indeterminate).toBe(true);

    // Selecting all rows makes the header checkbox fully checked, not indeterminate.
    await user.click(screen.getByRole('checkbox', { name: 'Select Bharat Shah' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Chetan Rao' }));
    expect(selectAllCheckbox().checked).toBe(true);
    expect(selectAllCheckbox().indeterminate).toBe(false);
  });

  it('select-all toggles every row, then clears them all', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Click select-all → all three rows selected and the bulk button shows (3).
    await user.click(selectAllCheckbox());
    expect(screen.getByRole('checkbox', { name: 'Select Asha Patel' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Bharat Shah' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Chetan Rao' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Delete selected forever \(3\)/i })).toBeInTheDocument();

    // Clicking select-all again (now fully checked) clears the selection.
    await user.click(selectAllCheckbox());
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).not.toBeChecked());
    expect(screen.queryByRole('button', { name: /Delete selected forever/i })).not.toBeInTheDocument();
  });

  it('confirms the modal and purges exactly the selected ids', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // Select two of the three deleted accounts.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Chetan Rao' }));

    // Open the confirmation modal from the action bar button.
    await user.click(screen.getByRole('button', { name: /Delete selected forever \(2\)/i }));
    const modalHeading = await screen.findByRole('heading', { name: 'Delete Selected Forever' });
    const modal = modalHeading.closest('div[style]')!.parentElement as HTMLElement;

    // Confirm the purge.
    await user.click(within(modal).getByRole('button', { name: /Delete selected forever/i }));

    // The purge API receives only the selected ids.
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/purge-all', { ids: [11, 13] });
    });

    // The modal closes and the selection clears afterwards.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete Selected Forever' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Delete selected forever/i })).not.toBeInTheDocument();
    });
  });

  it('cancelling the modal keeps the selection and makes no API call', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('checkbox', { name: 'Select Bharat Shah' }));
    await user.click(screen.getByRole('button', { name: /Delete selected forever \(1\)/i }));

    const modalHeading = await screen.findByRole('heading', { name: 'Delete Selected Forever' });
    const modal = modalHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete Selected Forever' })).not.toBeInTheDocument();
    });
    expect(api.delete).not.toHaveBeenCalled();
    // Selection is preserved so the action bar button is still present.
    expect(screen.getByRole('button', { name: /Delete selected forever \(1\)/i })).toBeInTheDocument();
  });
});
