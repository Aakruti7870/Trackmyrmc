import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

import Clients from '@/pages/Clients';
import Drivers from '@/pages/Drivers';
import { ToastProvider } from '@/lib/toast-provider';
import { api, ApiError } from '@/lib/api';

const CLIENT_CONFLICT =
  'Cannot delete this client — it is still linked to the active login Client Login (client@test.com). Remove the login first.';
const DRIVER_CONFLICT =
  'Cannot delete this driver — it is still linked to the active login Driver Login (driver@test.com). Remove the login first.';

const client = {
  id: 1, name: 'Acme Corp', contactPerson: 'Contact', phone: '8888888888',
  email: '', gstNo: '', address: '', city: '', creditLimit: '0', outstandingAmount: '0',
};

const driver = {
  id: 1, name: 'John Driver', phone: '9999999999', licenseNo: '', licenseExpiry: null, isActive: true,
};

let confirmSpy: MockInstance;

beforeEach(() => {
  vi.clearAllMocks();
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  confirmSpy.mockRestore();
});

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('Clients page — linked-record delete guard', () => {
  it('shows the 409 message in a toast and keeps the client in the list', async () => {
    vi.mocked(api.get).mockResolvedValue([client] as never);
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError(CLIENT_CONFLICT, 409, { error: CLIENT_CONFLICT }),
    );
    const user = userEvent.setup();
    renderWithToast(<Clients />);

    const card = (await screen.findByText('Acme Corp')).closest('.glass-card') as HTMLElement;
    // Card buttons: [edit, delete, view] — the delete (Trash) icon is the second.
    const deleteBtn = within(card).getAllByRole('button')[1];
    await user.click(deleteBtn);

    // The toast surfaces the backend's 409 message.
    const toast = await screen.findByText(CLIENT_CONFLICT);
    expect(toast).toBeInTheDocument();
    // It names the SPECIFIC linked login — admins must not be left guessing.
    expect(toast).toHaveTextContent('Client Login');
    expect(toast).toHaveTextContent('client@test.com');
    // It tells the admin what to do next.
    expect(toast).toHaveTextContent(/remove the login first/i);
    // It is an error toast.
    expect(document.querySelector('[data-toast-type="error"]')).toBeInTheDocument();
    // The failed delete does NOT remove the client from the list.
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    // The list is not reloaded after a failed delete (only the initial load ran).
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clients/1'));
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('Drivers page — linked-record delete guard', () => {
  it('shows the 409 message in a toast and keeps the driver in the list', async () => {
    vi.mocked(api.get).mockResolvedValue([driver] as never);
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError(DRIVER_CONFLICT, 409, { error: DRIVER_CONFLICT }),
    );
    const user = userEvent.setup();
    renderWithToast(<Drivers />);

    const row = (await screen.findByText('John Driver')).closest('tr') as HTMLElement;
    // Row action buttons: [edit, delete] — the delete (Trash) icon is the second.
    const deleteBtn = within(row).getAllByRole('button')[1];
    await user.click(deleteBtn);

    // The toast surfaces the backend's 409 message.
    const toast = await screen.findByText(DRIVER_CONFLICT);
    expect(toast).toBeInTheDocument();
    // It names the SPECIFIC linked login — admins must not be left guessing.
    expect(toast).toHaveTextContent('Driver Login');
    expect(toast).toHaveTextContent('driver@test.com');
    // It tells the admin what to do next.
    expect(toast).toHaveTextContent(/remove the login first/i);
    expect(document.querySelector('[data-toast-type="error"]')).toBeInTheDocument();
    // The failed delete does NOT remove the driver from the list.
    expect(screen.getByText('John Driver')).toBeInTheDocument();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/drivers/1'));
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
