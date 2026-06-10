import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
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
  vi.mocked(api.post).mockResolvedValue({ restored: 2, skipped: 0, skippedDetails: [] } as never);
});

async function enterDeletedView(user: ReturnType<typeof userEvent.setup>) {
  // Wait for the initial (active) load to settle, then switch to the trash view.
  await user.click(await screen.findByRole('button', { name: /Deleted/i }));
  // The deleted rows must be on screen before we interact with the selection UI.
  await screen.findByText('Asha Patel');
}

describe('Users bulk-restore selection UI', () => {
  it('swaps the button label, confirms the modal, and restores the selected ids', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    // With nothing selected the bulk button restores everything in the trash.
    expect(screen.getByRole('button', { name: /Restore All \(3\)/ })).toBeInTheDocument();

    // Select two of the three deleted accounts.
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha Patel' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Chetan Rao' }));

    // The bulk button now reflects the selection count.
    const restoreSelected = screen.getByRole('button', { name: /Restore Selected \(2\)/ });
    expect(restoreSelected).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore All/ })).not.toBeInTheDocument();

    // Open the confirmation modal and confirm.
    await user.click(restoreSelected);
    const modalHeading = await screen.findByRole('heading', { name: 'Restore Selected' });
    const modal = modalHeading.closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: /Restore$/ }));

    // The restore-all API is called only with the selected ids.
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/restore-all', { ids: [11, 13] });
    });

    // After the action the modal closes and the selection clears.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Restore Selected' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Restore All \(3\)/ })).toBeInTheDocument();
    });
  });

  it('clears the selection when toggling out of the deleted view', async () => {
    const user = userEvent.setup();
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('checkbox', { name: 'Select Bharat Shah' }));
    expect(screen.getByRole('button', { name: /Restore Selected \(1\)/ })).toBeInTheDocument();

    // Leave the trash view (back to active accounts) — selection should reset.
    await user.click(screen.getByRole('button', { name: /Showing Deleted/i }));

    // Re-enter the trash view: the bulk button is back to "Restore All" and no
    // row checkbox is checked, proving the selection was cleared.
    await enterDeletedView(user);
    expect(screen.getByRole('button', { name: /Restore All \(3\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore Selected/ })).not.toBeInTheDocument();
    screen.getAllByRole('checkbox').forEach(cb => {
      expect(cb).not.toBeChecked();
    });
  });
});
