import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({
    status: 'connected' as const,
    reconnect: () => {},
    subscribe: () => () => {},
  }),
}));

import Dispatch from '@/pages/Dispatch';
import { api, type Challan } from '@/lib/api';

function makeChallan(over: Partial<Challan> = {}): Challan {
  return {
    id: 1,
    challanNo: 'CH-001',
    clientId: 5,
    grade: 'M25',
    quantity: '10.00',
    pumpRequired: false,
    status: 'delivered',
    createdAt: '2026-06-10T06:00:00.000Z',
    dispatchTime: '2026-06-10T07:00:00.000Z',
    clientName: 'Skyline Builders',
    vehicleNo: 'GJ01AB1234',
    driverName: 'Dave',
    ...over,
  };
}

// Dispatch loads /challans plus a few reference lists; route the mock by path.
function mockApi(challans: Challan[]) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/challans') return Promise.resolve(challans as never);
    return Promise.resolve([] as never);
  });
}

// Finds the delivered-quantity cell for a given challan number so badge
// assertions are scoped to a single row.
function rowFor(challanNo: string): HTMLElement {
  const cell = screen.getByText(`#${challanNo}`).closest('tr');
  if (!cell) throw new Error(`row for ${challanNo} not found`);
  return cell as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dispatch over/short variance badge', () => {
  it('shows a blue +delta badge when the delivery is over the plan beyond tolerance', async () => {
    mockApi([makeChallan({ challanNo: 'CH-001', quantity: '10.00', deliveredQuantity: '12.00' })]);
    render(<Dispatch />);

    const badge = await screen.findByTitle(/over-delivered vs planned/i);
    expect(badge.textContent).toBe('+2.0');
    expect(badge).toHaveStyle({ color: 'var(--blue)' });
  });

  it('shows a red −delta badge when the delivery is short of the plan beyond tolerance', async () => {
    mockApi([makeChallan({ challanNo: 'CH-001', quantity: '10.00', deliveredQuantity: '8.50' })]);
    render(<Dispatch />);

    const badge = await screen.findByTitle(/short delivery vs planned/i);
    // The minus is the typographic U+2212, not an ASCII hyphen.
    expect(badge.textContent).toBe('\u22121.5');
    expect(badge).toHaveStyle({ color: 'var(--red)' });
  });

  it('shows NO badge when the delta is within the 0.1 m³ tolerance', async () => {
    mockApi([makeChallan({ challanNo: 'CH-001', quantity: '10.00', deliveredQuantity: '10.05' })]);
    render(<Dispatch />);

    // Wait for the row to render, then assert no variance badge exists.
    await screen.findByText('#CH-001');
    expect(screen.queryByTitle(/vs planned/i)).not.toBeInTheDocument();
  });

  it('shows NO badge when no delivered quantity has been recorded yet', async () => {
    mockApi([makeChallan({ challanNo: 'CH-001', status: 'dispatched', deliveredQuantity: null })]);
    render(<Dispatch />);

    await screen.findByText('#CH-001');
    expect(screen.queryByTitle(/vs planned/i)).not.toBeInTheDocument();
  });

  it('renders the correct badge per row when mixing over, short and on-target deliveries', async () => {
    mockApi([
      makeChallan({ id: 1, challanNo: 'CH-OVER', quantity: '10.00', deliveredQuantity: '11.30' }),
      makeChallan({ id: 2, challanNo: 'CH-SHORT', quantity: '10.00', deliveredQuantity: '9.00' }),
      makeChallan({ id: 3, challanNo: 'CH-OK', quantity: '10.00', deliveredQuantity: '10.00' }),
    ]);
    render(<Dispatch />);

    await waitFor(() => expect(screen.getByText('#CH-OVER')).toBeInTheDocument());

    const overBadge = within(rowFor('CH-OVER')).getByTitle(/over-delivered vs planned/i);
    expect(overBadge.textContent).toBe('+1.3');
    expect(overBadge).toHaveStyle({ color: 'var(--blue)' });

    const shortBadge = within(rowFor('CH-SHORT')).getByTitle(/short delivery vs planned/i);
    expect(shortBadge.textContent).toBe('\u22121.0');
    expect(shortBadge).toHaveStyle({ color: 'var(--red)' });

    expect(within(rowFor('CH-OK')).queryByTitle(/vs planned/i)).not.toBeInTheDocument();
  });
});
