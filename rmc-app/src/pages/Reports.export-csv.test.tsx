import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import Reports from '@/pages/Reports';
import { api } from '@/lib/api';

// Every reports endpoint falls back to an empty payload; we only care about the
// Export CSV button wiring, not the rendered data.
function mockEmptyReports() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/reports/variance-tolerance')) return Promise.resolve({ abs: 0.1, pct: 0 } as never);
    if (path.startsWith('/reports/trip-timing')) return Promise.resolve({ freeMin: 45, ratePerHour: null, rows: [] } as never);
    if (path.startsWith('/reports/fuel-reconciliation')) return Promise.resolve({ config: { reconVariancePct: 10, idleBurnLph: 2, unscheduledStopMin: 5, routeDeviationM: 300, plantLat: null, plantLng: null }, rows: [] } as never);
    if (path.startsWith('/positions/alerts')) return Promise.resolve([] as never);
    return Promise.resolve([] as never);
  });
}

// The export now goes through api.download(): an authenticated fetch + blob anchor
// download (works in the native Capacitor build), not window.open(). We stub fetch
// and the blob-URL helpers and assert on the fetched URL.
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockEmptyReports();
  fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response('a,b\n1,2\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
  );
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Read the from/to date inputs the page is currently showing so the expected
// export window stays in lockstep with the component's own default range.
function currentWindow(container: HTMLElement) {
  const dates = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
  return { from: dates[0].value, to: dates[1].value };
}

function fetchedParams() {
  const url = fetchSpy.mock.calls[0][0] as string;
  return new URL(url, 'http://localhost').searchParams;
}

describe('Reports Export CSV button', () => {
  it('exports the dispatch report with the current window on a default tab', async () => {
    const user = userEvent.setup();
    const { container } = render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    const { from, to } = currentWindow(container);

    await user.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const params = fetchedParams();
    expect(params.get('report')).toBe('dispatch');
    expect(params.get('from')).toBe(`${from}T00:00:00`);
    expect(params.get('to')).toBe(`${to}T23:59:59`);
  });

  it('exports the production report when the Production tab is active', async () => {
    const user = userEvent.setup();
    const { container } = render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Production'));
    const { from, to } = currentWindow(container);

    await user.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const params = fetchedParams();
    expect(params.get('report')).toBe('production');
    expect(params.get('from')).toBe(`${from}T00:00:00`);
    expect(params.get('to')).toBe(`${to}T23:59:59`);
  });

  it('exports the fuel-reconciliation report when the Fuel tab is active', async () => {
    const user = userEvent.setup();
    const { container } = render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Fuel'));
    const { from, to } = currentWindow(container);

    await user.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const params = fetchedParams();
    expect(params.get('report')).toBe('fuel-reconciliation');
    expect(params.get('from')).toBe(`${from}T00:00:00`);
    expect(params.get('to')).toBe(`${to}T23:59:59`);
  });
});
