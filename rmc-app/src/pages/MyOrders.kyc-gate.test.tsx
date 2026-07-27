import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Every delivery field is mandatory before submit — fill the whole brief so
// the gate is reached via a normally-valid form, not a validation error.
async function fillRequiredDelivery(
  user: ReturnType<typeof userEvent.setup>, container: HTMLElement,
) {
  fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-07-10' } });
  fireEvent.change(container.querySelector('input[type="time"]')!, { target: { value: '09:00' } });
  await user.type(screen.getByPlaceholderText(/name at delivery site/i), 'Ravi Kumar');
  await user.type(screen.getByPlaceholderText(/phone at site/i), '9876543210');
  await user.type(screen.getByPlaceholderText(/tower b foundation/i), 'Tower B');
  await user.type(screen.getByPlaceholderText(/full delivery address/i), 'MG Road, Pune');
  const paymentSelect = screen.getAllByRole('combobox').find(
    c => within(c).queryByRole('option', { name: 'Cash' }),
  )!;
  await user.selectOptions(paymentSelect, 'Cash');
  await user.click(screen.getByRole('button', { name: /search delivery location/i }));
  await user.click(await screen.findByRole('button', { name: /use current location/i }));
  await user.click(await screen.findByRole('button', { name: /confirm delivery location/i }));
}

function gradeSelect(): HTMLElement {
  const el = screen.getAllByRole('combobox').find(
    c => within(c).queryByRole('option', { name: /select grade/i }),
  );
  if (!el) throw new Error('grade <select> not found');
  return el;
}

let mockUser: { id: number; name: string; email: string; role: string; canPlaceOrder?: boolean } = {
  id: 1, name: 'Acme Builders', email: 'client@test.com', role: 'client',
};

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn() } };
});

import MyOrders from '@/pages/MyOrders';
import { api, ApiError } from '@/lib/api';
import { readOrderDraft, saveOrderDraft, clearOrderDraft } from '@/lib/orderDraft';

beforeEach(() => {
  vi.clearAllMocks();
  clearOrderDraft();
  mockUser = { id: 1, name: 'Acme Builders', email: 'client@test.com', role: 'client' };
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 18.52, longitude: 73.85 } } as GeolocationPosition) },
  });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ display_name: 'MG Road, Pune' }),
  } as unknown as Response);
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
    if (path === '/positions/freshness-config' || path === '/me/idle-config') return Promise.resolve({} as never);
    if (path === '/plants/directory') return Promise.resolve([{ id: 3, plantCode: 'P3', name: 'Acme RMC', city: 'Pune' }] as never);
    return Promise.resolve([] as never);
  });
});

describe('MyOrders KYC order gate', () => {
  it('blocks submission, shows the verification-required card, and preserves the draft when canPlaceOrder is false', async () => {
    mockUser = { ...mockUser, canPlaceOrder: false };
    const user = userEvent.setup();
    const { container } = render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });
    await waitFor(() => expect(gradeSelect()).toBeInTheDocument());

    await user.selectOptions(gradeSelect(), 'M25');
    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '8');
    await fillRequiredDelivery(user, container);

    const submitBtns = screen.getAllByRole('button', { name: /place order/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    expect(await screen.findByText(/identity verification required/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue kyc/i })).toHaveAttribute('href', '/kyc');
    expect(api.post).not.toHaveBeenCalled();

    const draft = readOrderDraft();
    expect(draft?.grade).toBe('M25');
    expect(draft?.quantity).toBe('8');
    expect(draft?.siteName).toBe('Tower B');
  });

  it('preserves the draft when the backend rejects with CUSTOMER_KYC_REQUIRED', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError('Verification required', 403, { code: 'CUSTOMER_KYC_REQUIRED' }));
    const user = userEvent.setup();
    const { container } = render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });
    await waitFor(() => expect(gradeSelect()).toBeInTheDocument());

    await user.selectOptions(gradeSelect(), 'M30');
    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '6');
    await fillRequiredDelivery(user, container);

    const submitBtns = screen.getAllByRole('button', { name: /place order/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    expect(await screen.findByText(/identity verification required/i)).toBeInTheDocument();
    expect(readOrderDraft()?.grade).toBe('M30');
  });

  it('restores a saved draft (and shows a restored notice) when the order modal reopens', async () => {
    saveOrderDraft({
      grade: 'M35', quantity: '15', deliveryDate: '2026-07-11', deliveryTime: '10:00',
      pumpRequired: false, pumpLineLength: '', notes: '', siteId: '',
      contactPerson: 'Priya', contactNumber: '9876500000', siteName: 'Site Alpha',
      siteAddress: 'Baner, Pune', latitude: '18.5', longitude: '73.8', placeId: '',
      paymentType: 'Cash', poNumber: '', selectedPlantId: 3, selectedPlant: 'Acme RMC',
    });

    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    expect(await screen.findByText(/draft restored from before verification/i)).toBeInTheDocument();
    await waitFor(() => expect(gradeSelect()).toHaveValue('M35'));
    expect(screen.getByPlaceholderText(/tower b foundation/i)).toHaveValue('Site Alpha');
    // The draft is one-time — it must not persist for the next modal open.
    expect(readOrderDraft()).toBeNull();
  });
});
