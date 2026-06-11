import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Handler = (data: unknown) => void;
const handlers = new Map<string, Set<Handler>>();
function emit(event: string, data: unknown) {
  act(() => { handlers.get(event)?.forEach(h => h(data)); });
}

vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({
    status: 'connected' as const,
    reconnect: () => {},
    subscribe: (event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => { handlers.get(event)?.delete(handler); };
    },
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import MyOrders from '@/pages/MyOrders';
import { api, type Challan, type LivePosition } from '@/lib/api';

const dispatched: Challan = {
  id: 7, challanNo: 'CH-7007', clientId: 5, grade: 'M25', quantity: '8.00',
  pumpRequired: false, status: 'dispatched', createdAt: '2026-06-11T06:00:00.000Z',
  dispatchTime: '2026-06-11T07:00:00.000Z', vehicleNo: 'GJ01AB1234', driverName: 'Ravi',
};
const delivered: Challan = {
  id: 9, challanNo: 'CH-9009', clientId: 5, grade: 'M30', quantity: '6.00',
  pumpRequired: false, status: 'delivered', createdAt: '2026-06-11T05:00:00.000Z',
  dispatchTime: '2026-06-11T05:30:00.000Z', vehicleNo: 'GJ01XX9999', hasProofPhoto: true,
};

function mockList(challans: Challan[]) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/me/orders') return Promise.resolve([] as never);
    if (path === '/me/challans') return Promise.resolve(challans as never);
    if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
    return Promise.resolve([] as never);
  });
}

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
});

describe('MyOrders delivery tracking', () => {
  it('shows live distance and ETA when a vehicle.position event arrives', async () => {
    mockList([dispatched]);
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /Challans/i }));
    expect(await screen.findByText(/Live Deliveries/i)).toBeInTheDocument();

    const pos: LivePosition = {
      challanId: 7, challanNo: 'CH-7007', vehicleNo: 'GJ01AB1234',
      lat: 23.0, lng: 72.5, accuracy: 5, speed: 10, heading: 90,
      distanceM: 3000, status: 'dispatched',
    } as LivePosition;
    emit('vehicle.position', pos);

    // 3000 m -> "3.0 km away"; 3000 / 10 m/s / 60 = 5 min -> "ETA ~5 min".
    expect(await screen.findByText(/3\.0 km away/i)).toBeInTheDocument();
    expect(screen.getByText(/ETA ~5 min/i)).toBeInTheDocument();
  });

  it('opens the proof modal and fetches the customer-scoped challan detail', async () => {
    mockList([delivered]);
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /Challans/i }));

    vi.mocked(api.get).mockResolvedValueOnce(
      { ...delivered, proofPhotos: ['https://signed.example/proof-1.jpg'] } as never,
    );
    await user.click(await screen.findByRole('button', { name: /Photo/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/me/challans/9');
    });
    const img = await screen.findByAltText(/Delivery proof 1/i);
    expect(img).toHaveAttribute('src', 'https://signed.example/proof-1.jpg');
  });
});
