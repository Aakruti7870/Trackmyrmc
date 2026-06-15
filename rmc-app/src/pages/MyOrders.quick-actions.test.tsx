import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

vi.mock('@/pages/deliveryReceipt', () => ({
  downloadDeliveryReceipt: vi.fn().mockResolvedValue(undefined),
}));

import MyOrders from '@/pages/MyOrders';
import { api, type Order, type Challan } from '@/lib/api';
import { downloadDeliveryReceipt } from '@/pages/deliveryReceipt';

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderNo: 'ORD-001',
    clientId: 5,
    grade: 'M25',
    quantity: '12.00',
    pumpRequired: true,
    notes: 'Near gate',
    status: 'pending',
    createdAt: '2026-06-10T06:00:00.000Z',
    ...over,
  } as Order;
}

function makeChallan(over: Partial<Challan> = {}): Challan {
  return {
    id: 10,
    challanNo: 'CH-001',
    clientId: 5,
    grade: 'M25',
    quantity: '12.00',
    pumpRequired: false,
    status: 'delivered',
    createdAt: '2026-06-10T06:00:00.000Z',
    ...over,
  } as Challan;
}

function mockLists(orders: Order[], challans: Challan[]) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/me/orders') return Promise.resolve(orders as never);
    if (path === '/me/challans') return Promise.resolve(challans as never);
    // Only the ledger/config endpoints return objects; every other endpoint
    // MyOrders loads (sites, recurring, positions/mine) is an array, so default
    // unhandled paths to [] or the page's `.filter`/`for…of` loops throw.
    if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
    if (path === '/positions/freshness-config' || path === '/me/idle-config') return Promise.resolve({} as never);
    return Promise.resolve([] as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MyOrders quick actions', () => {
  it('reorder pre-fills the order modal (incl. the plant) from a past order', async () => {
    mockLists([makeOrder({ grade: 'M30', quantity: '8.00', plantId: 42, plantName: 'Riverside RMC' })], []);
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /^orders \(/i }));
    await user.click(await screen.findByRole('button', { name: /reorder/i }));

    await screen.findByRole('heading', { name: /place new order/i });
    const gradeSelect = screen.getAllByRole('combobox').find(
      c => within(c).queryByRole('option', { name: /select grade/i }),
    )!;
    expect(gradeSelect).toHaveValue('M30');
    expect(screen.getByPlaceholderText(/e\.g\. 10/i)).toHaveValue(8);

    // The previous order's plant carries over so the customer can submit in one
    // tap — this is the bug fix (reorder used to drop the plant).
    const plantSelect = screen.getAllByRole('combobox').find(
      c => within(c).queryByRole('option', { name: /select a plant/i }),
    )!;
    expect(plantSelect).toHaveValue('42');
    expect(screen.getByText(/from riverside rmc/i)).toBeInTheDocument();
  });

  it('reorder lets the customer submit in one tap without a plant error', async () => {
    mockLists([makeOrder({ id: 5, grade: 'M30', quantity: '8.00', plantId: 42, plantName: 'Riverside RMC' })], []);
    vi.mocked(api.post).mockResolvedValue(
      makeOrder({ id: 99, orderNo: 'ORD-099', grade: 'M30', quantity: '8.00', plantId: 42 }) as never,
    );
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /^orders \(/i }));
    await user.click(await screen.findByRole('button', { name: /reorder/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    const submitBtns = screen.getAllByRole('button', { name: /place order/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/me/orders', expect.objectContaining({
        plantId: 42, grade: 'M30', quantity: '8',
      }));
    });
    expect(screen.queryByText(/please choose a plant/i)).not.toBeInTheDocument();
  });

  it('cancel calls PATCH and flips the order to cancelled', async () => {
    mockLists([makeOrder({ id: 7, orderNo: 'ORD-007', status: 'pending' })], []);
    vi.mocked(api.patch).mockResolvedValue(
      makeOrder({ id: 7, orderNo: 'ORD-007', status: 'cancelled' }) as never,
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /^orders \(/i }));
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/me/orders/7/cancel', {});
    });
    expect(await screen.findByText(/cancelled/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('does not cancel when the user dismisses the confirm', async () => {
    mockLists([makeOrder({ id: 7, status: 'pending' })], []);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /^orders \(/i }));
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }));
    expect(api.patch).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('receipt button downloads a PDF for a delivered challan', async () => {
    mockLists([], [makeChallan({ id: 10, challanNo: 'CH-001', status: 'delivered' })]);
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /challans/i }));
    await user.click(await screen.findByRole('button', { name: /receipt/i }));

    await waitFor(() => {
      expect(downloadDeliveryReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ challanNo: 'CH-001' }),
        expect.anything(),
      );
    });
  });
});
