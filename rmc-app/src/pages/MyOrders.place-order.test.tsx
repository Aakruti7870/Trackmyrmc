import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import MyOrders from '@/pages/MyOrders';
import { api, type Order } from '@/lib/api';

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderNo: 'ORD-001',
    clientId: 5,
    grade: 'M25',
    quantity: '12.00',
    pumpRequired: false,
    status: 'pending',
    createdAt: '2026-06-10T06:00:00.000Z',
    ...over,
  } as Order;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/me/orders') return Promise.resolve([] as never);
    if (path === '/me/challans') return Promise.resolve([] as never);
    return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
  });
});

describe('MyOrders place order', () => {
  it('submits the form to /me/orders and shows the new order in the list', async () => {
    const created = makeOrder({ id: 99, orderNo: 'ORD-007', grade: 'M30', quantity: '8.00' });
    vi.mocked(api.post).mockResolvedValue(created as never);

    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));

    const dialog = await screen.findByRole('heading', { name: /place new order/i });
    expect(dialog).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 'M30');
    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '8');

    const submitBtns = screen.getAllByRole("button", { name: /place order/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/me/orders', expect.objectContaining({
        grade: 'M30',
        quantity: '8',
      }));
    });

    expect(await screen.findByText('ORD-007')).toBeInTheDocument();
  });

  it('blocks submission and shows an error when grade is missing', async () => {
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '5');
    const submitBtns = screen.getAllByRole("button", { name: /place order/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    expect(await screen.findByText(/select a concrete grade/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
