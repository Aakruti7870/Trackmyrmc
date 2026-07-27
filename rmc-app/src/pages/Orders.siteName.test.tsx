import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

import Orders from '@/pages/Orders';
import { api, type Order, type Client } from '@/lib/api';

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 1, orderNo: 'ORD-001', clientId: 5, grade: 'M25', quantity: '12.00',
    pumpRequired: false, status: 'pending', createdAt: '2026-06-10T06:00:00.000Z',
    clientName: 'Acme Builders',
    ...over,
  } as Order;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Orders — canonical Site Name presentation on the received-order list', () => {
  it('labels the column "Site Name" and shows the order\'s site name', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/orders') return Promise.resolve([makeOrder({ siteName: 'Tower B Foundation' })] as never);
      if (path === '/clients') return Promise.resolve([] as Client[] as never);
      return Promise.resolve([] as never);
    });

    render(<Orders />);

    expect(await screen.findByText('Site Name')).toBeInTheDocument();
    expect(await screen.findByText('Tower B Foundation')).toBeInTheDocument();
  });

  it('shows "Not provided" instead of a bare dash when the legacy order has no site name', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/orders') return Promise.resolve([makeOrder({ siteName: undefined })] as never);
      if (path === '/clients') return Promise.resolve([] as Client[] as never);
      return Promise.resolve([] as never);
    });

    render(<Orders />);

    expect(await screen.findByText('Not provided')).toBeInTheDocument();
  });
});
