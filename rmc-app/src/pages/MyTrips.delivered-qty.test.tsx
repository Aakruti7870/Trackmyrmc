import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import MyTrips from '@/pages/MyTrips';
import { api, type Challan } from '@/lib/api';

function makeChallan(over: Partial<Challan> = {}): Challan {
  return {
    id: 1,
    challanNo: 'CH-001',
    clientId: 5,
    grade: 'M25',
    quantity: '8.00',
    pumpRequired: false,
    status: 'dispatched',
    createdAt: '2026-06-10T06:00:00.000Z',
    dispatchTime: '2026-06-10T07:00:00.000Z',
    clientName: 'Skyline Builders',
    vehicleNo: 'GJ01AB1234',
    ...over,
  };
}

function mockTrips(rows: Challan[]) {
  vi.mocked(api.get).mockResolvedValue(rows as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

async function openProofForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Mark as Delivered/i }));
}

describe('MyTrips proof-of-delivery delivered quantity', () => {
  it('defaults the delivered-quantity field to the planned quantity', async () => {
    mockTrips([makeChallan({ quantity: '8.00' })]);
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);

    const qty = screen.getByPlaceholderText(/^Planned:/i) as HTMLInputElement;
    expect(qty).toHaveValue(8);
  });

  it('sends the edited delivered quantity to the API on confirmation', async () => {
    mockTrips([makeChallan({ id: 7, quantity: '8.00' })]);
    vi.mocked(api.put).mockResolvedValue(
      makeChallan({ id: 7, status: 'delivered', deliveredQuantity: '7.50' }) as never,
    );
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);

    const qty = screen.getByPlaceholderText(/^Planned:/i);
    await user.clear(qty);
    await user.type(qty, '7.5');

    await user.click(screen.getByRole('button', { name: /Confirm Delivery/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/challans/7',
        expect.objectContaining({ status: 'delivered', deliveredQuantity: '7.5' }),
      );
    });
  });

  it('omits delivered quantity from the payload when the field is cleared', async () => {
    mockTrips([makeChallan({ id: 9, quantity: '8.00' })]);
    vi.mocked(api.put).mockResolvedValue(
      makeChallan({ id: 9, status: 'delivered' }) as never,
    );
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);

    const qty = screen.getByPlaceholderText(/^Planned:/i);
    await user.clear(qty);

    await user.click(screen.getByRole('button', { name: /Confirm Delivery/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(api.put).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('deliveredQuantity');
  });

  it('shows the recorded delivered volume on a delivered card', async () => {
    mockTrips([
      makeChallan({
        id: 3,
        status: 'delivered',
        quantity: '8.00',
        deliveredQuantity: '7.50',
        deliveryTime: '2026-06-10T08:00:00.000Z',
      }),
    ]);
    render(<MyTrips />);

    expect(await screen.findByText(/Delivered 7\.5 m³/i)).toBeInTheDocument();
  });
});
