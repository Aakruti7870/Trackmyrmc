import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn() } };
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
    if (path.startsWith('/audit-logs')) return { rows: [], hasMore: false } as never;
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

  it('shows the skipped-restore results and retries a skipped row, dropping it on success', async () => {
    const user = userEvent.setup();
    // Restore All reports one skipped account whose link is taken.
    vi.mocked(api.post).mockResolvedValueOnce({
      restored: 2, skipped: 1,
      skippedDetails: [{ id: 13, email: 'chetan@x.com', reason: 'This driver is already linked to another account (Someone). Each driver can be linked to only one user.' }],
    } as never);
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Restore All \(3\)/ }));
    const confirmModal = (await screen.findByRole('heading', { name: 'Restore All' })).closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Restore$/ }));

    // The skipped-results modal lists the skipped account with its reason.
    await screen.findByRole('heading', { name: /1 Account Skipped/i });
    const skippedModal = screen.getByText(/These accounts could not be restored/i).parentElement as HTMLElement;
    expect(within(skippedModal).getByText('chetan@x.com')).toBeInTheDocument();
    expect(within(skippedModal).getByText(/already linked/i)).toBeInTheDocument();

    // The conflict is now resolved — the retry succeeds.
    vi.mocked(api.post).mockResolvedValueOnce({ id: 13, deletedAt: null } as never);
    await user.click(within(skippedModal).getByRole('button', { name: /Retry restore/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/13/restore', {});
    });
    // The row was the only one, so the whole modal closes.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Account Skipped/i })).not.toBeInTheDocument();
    });
  });

  it('restores a skipped row without its link and drops it from the list', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({
      restored: 2, skipped: 1,
      skippedDetails: [{ id: 13, email: 'chetan@x.com', reason: 'This driver is already linked to another account (Someone). Each driver can be linked to only one user.' }],
    } as never);
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Restore All \(3\)/ }));
    const confirmModal = (await screen.findByRole('heading', { name: 'Restore All' })).closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Restore$/ }));

    await screen.findByRole('heading', { name: /1 Account Skipped/i });
    const skippedModal = screen.getByText(/These accounts could not be restored/i).parentElement as HTMLElement;

    // "Restore without link" clears the conflicting link server-side and succeeds.
    vi.mocked(api.post).mockResolvedValueOnce({ id: 13, deletedAt: null } as never);
    await user.click(within(skippedModal).getByRole('button', { name: /Restore without link/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/13/restore', { clearLink: true });
    });
    // It was the only skipped row, so the whole modal closes after success.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Account Skipped/i })).not.toBeInTheDocument();
    });
  });

  it('keeps the row and shows the error when restore-without-link fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({
      restored: 0, skipped: 1,
      skippedDetails: [{ id: 13, email: 'chetan@x.com', reason: 'This driver is already linked to another account (Someone). Each driver can be linked to only one user.' }],
    } as never);
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Restore All \(3\)/ }));
    const confirmModal = (await screen.findByRole('heading', { name: 'Restore All' })).closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Restore$/ }));

    await screen.findByRole('heading', { name: /1 Account Skipped/i });
    const skippedModal = screen.getByText(/These accounts could not be restored/i).parentElement as HTMLElement;

    vi.mocked(api.post).mockRejectedValueOnce(new Error('Deleted account not found'));
    await user.click(within(skippedModal).getByRole('button', { name: /Restore without link/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/13/restore', { clearLink: true });
    });
    // The row stays so the admin can try again; its reason reflects the failure.
    expect(await screen.findByRole('heading', { name: /1 Account Skipped/i })).toBeInTheDocument();
    expect(within(skippedModal).getByText('chetan@x.com')).toBeInTheDocument();
    expect(within(skippedModal).getByText(/Deleted account not found/i)).toBeInTheDocument();
  });

  it('unlinks the conflicting account and retries, dropping the row on success', async () => {
    const user = userEvent.setup();
    // Restore All reports one skipped account whose driver link is taken by user #99.
    vi.mocked(api.post).mockResolvedValueOnce({
      restored: 2, skipped: 1,
      skippedDetails: [{
        id: 13, email: 'chetan@x.com',
        reason: 'This driver is already linked to another account (Deepa). Each driver can be linked to only one user.',
        conflictUserId: 99, conflictUserName: 'Deepa', conflictLinkType: 'driver',
      }],
    } as never);
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Restore All \(3\)/ }));
    const confirmModal = (await screen.findByRole('heading', { name: 'Restore All' })).closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Restore$/ }));

    await screen.findByRole('heading', { name: /1 Account Skipped/i });
    const skippedModal = screen.getByText(/These accounts could not be restored/i).parentElement as HTMLElement;

    // Unlinking the conflicting account succeeds, and the follow-up retry then succeeds.
    vi.mocked(api.put).mockResolvedValueOnce({ id: 99 } as never);
    vi.mocked(api.post).mockResolvedValueOnce({ id: 13, deletedAt: null } as never);
    await user.click(within(skippedModal).getByRole('button', { name: /Unlink Deepa & restore/i }));

    // The conflicting account is unlinked from its driver, then the restore retries.
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/users/99', { linkedDriverId: null });
    });
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/13/restore', {});
    });
    // The row was the only one, so the whole modal closes.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Account Skipped/i })).not.toBeInTheDocument();
    });
  });

  it('keeps a skipped row and updates its reason when the retry still conflicts', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({
      restored: 0, skipped: 1,
      skippedDetails: [{ id: 13, email: 'chetan@x.com', reason: 'This driver is already linked to another account (Someone). Each driver can be linked to only one user.' }],
    } as never);
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Restore All \(3\)/ }));
    const confirmModal = (await screen.findByRole('heading', { name: 'Restore All' })).closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Restore$/ }));

    await screen.findByRole('heading', { name: /1 Account Skipped/i });
    const skippedModal = screen.getByText(/These accounts could not be restored/i).parentElement as HTMLElement;

    // The retry still hits the conflict (rejects with the 409 message).
    vi.mocked(api.post).mockRejectedValueOnce(new Error('This driver is already linked to another account (Someone). Each driver can be linked to only one user.'));
    await user.click(within(skippedModal).getByRole('button', { name: /Retry restore/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/13/restore', {});
    });
    // The row stays in the still-open modal so the admin can try again later.
    expect(await screen.findByRole('heading', { name: /1 Account Skipped/i })).toBeInTheDocument();
    expect(within(skippedModal).getByText('chetan@x.com')).toBeInTheDocument();
  });

  it('lists every skipped account and dismisses the results modal via the X button', async () => {
    const user = userEvent.setup();
    // Restore All partially succeeds: two accounts are skipped with distinct reasons.
    vi.mocked(api.post).mockResolvedValue({
      restored: 1, skipped: 2,
      skippedDetails: [
        { id: 12, email: 'bharat@x.com', reason: 'This client is already linked to another account (Someone). Each client can be linked to only one user.' },
        { id: 13, email: 'chetan@x.com', reason: 'This driver is already linked to another account (Someone). Each driver can be linked to only one user.' },
      ],
    } as never);
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Restore All \(3\)/ }));
    const confirmModal = (await screen.findByRole('heading', { name: 'Restore All' })).closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Restore$/ }));

    // The skipped-results modal opens with the plural count and lists each email + reason.
    await screen.findByRole('heading', { name: /2 Accounts Skipped/i });
    const skippedModal = screen.getByText(/These accounts could not be restored/i).parentElement as HTMLElement;
    expect(within(skippedModal).getByText('bharat@x.com')).toBeInTheDocument();
    expect(within(skippedModal).getByText(/client is already linked/i)).toBeInTheDocument();
    expect(within(skippedModal).getByText('chetan@x.com')).toBeInTheDocument();
    expect(within(skippedModal).getByText(/driver is already linked/i)).toBeInTheDocument();

    // The header X button (the only button with no text label) closes the modal.
    const closeBtn = within(skippedModal).getAllByRole('button').find(b => (b.textContent ?? '').trim() === '')!;
    expect(closeBtn).toBeTruthy();
    await user.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Accounts? Skipped/i })).not.toBeInTheDocument();
    });
  });

  it('dismisses the skipped-results modal via the Done button', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({
      restored: 1, skipped: 2,
      skippedDetails: [
        { id: 12, email: 'bharat@x.com', reason: 'This client is already linked to another account (Someone). Each client can be linked to only one user.' },
        { id: 13, email: 'chetan@x.com', reason: 'This driver is already linked to another account (Someone). Each driver can be linked to only one user.' },
      ],
    } as never);
    renderUsers();
    await enterDeletedView(user);

    await user.click(screen.getByRole('button', { name: /Restore All \(3\)/ }));
    const confirmModal = (await screen.findByRole('heading', { name: 'Restore All' })).closest('div[style]')!.parentElement as HTMLElement;
    await user.click(within(confirmModal).getByRole('button', { name: /Restore$/ }));

    await screen.findByRole('heading', { name: /2 Accounts Skipped/i });
    const skippedModal = screen.getByText(/These accounts could not be restored/i).parentElement as HTMLElement;

    // The footer "Done" button closes the modal.
    await user.click(within(skippedModal).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Accounts? Skipped/i })).not.toBeInTheDocument();
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
