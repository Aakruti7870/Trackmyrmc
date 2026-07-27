import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

import ChallanPrint from '@/pages/ChallanPrint';
import { api, type Challan } from '@/lib/api';

function makeChallan(over: Partial<Challan> = {}): Challan {
  return {
    id: 1, challanNo: 'CH-001', clientId: 5, grade: 'M25', quantity: '12.00',
    pumpRequired: false, status: 'dispatched', createdAt: '2026-06-10T06:00:00.000Z',
    clientName: 'Acme Builders',
    ...over,
  } as Challan;
}

function renderAt(path: string) {
  const { hook } = memoryLocation({ path, record: true });
  return render(
    <Router hook={hook}>
      <Route path="/challans/:id/print" component={ChallanPrint} />
    </Router>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChallanPrint — canonical Site Name presentation', () => {
  it('prints a distinct "Site Name" field alongside the delivery address', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/challans/1') return Promise.resolve(makeChallan({ siteName: 'Tower B Foundation', siteAddress: 'MG Road, Pune' }) as never);
      return Promise.resolve({} as never);
    });

    renderAt('/challans/1/print');

    expect(await screen.findAllByText('Site Name')).not.toHaveLength(0);
    expect(await screen.findAllByText('Tower B Foundation')).not.toHaveLength(0);
  });

  it('falls back to "Not provided" when the legacy challan has no site name', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/challans/1') return Promise.resolve(makeChallan({ siteName: undefined, siteAddress: 'MG Road, Pune' }) as never);
      return Promise.resolve({} as never);
    });

    renderAt('/challans/1/print');

    expect(await screen.findAllByText('Not provided')).not.toHaveLength(0);
  });
});
