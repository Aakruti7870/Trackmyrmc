import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import Reports from '@/pages/Reports';
import { api } from '@/lib/api';

interface ClientRow { clientName: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; totalChallans: number }
interface GradeRow { grade: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; totalChallans: number }
interface DispatchRow { date: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; count: number }
interface ProductionRow { date: string; totalQty: number; count: number; grade: string }

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

// Route the mock by report path so each test can supply just the rows it needs.
function mockReports(opts: {
  client?: ClientRow[];
  grade?: GradeRow[];
  dispatch?: DispatchRow[];
  production?: ProductionRow[];
} = {}) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/reports/variance-tolerance')) return Promise.resolve({ abs: 0.1, pct: 0 } as never);
    if (path.startsWith('/reports/client-wise')) return Promise.resolve((opts.client ?? []) as never);
    if (path.startsWith('/reports/grade-wise')) return Promise.resolve((opts.grade ?? []) as never);
    if (path.startsWith('/reports/dispatch')) return Promise.resolve((opts.dispatch ?? []) as never);
    if (path.startsWith('/reports/production')) return Promise.resolve((opts.production ?? []) as never);
    return Promise.resolve([] as never);
  });
}

// The four range-driven report endpoints, in load order.
const REPORT_PATHS = ['/reports/client-wise', '/reports/grade-wise', '/reports/dispatch', '/reports/production'] as const;

// Returns the query suffix the four endpoints were last called with, asserting
// all four agreed on the same from/to window.
function lastRangeParams(): string {
  const params: Record<string, string> = {};
  for (const call of vi.mocked(api.get).mock.calls) {
    const url = call[0] as string;
    for (const base of REPORT_PATHS) {
      if (url.startsWith(base)) params[base] = url.slice(base.length);
    }
  }
  for (const base of REPORT_PATHS) {
    expect(params[base], `expected ${base} to have been fetched`).toBeDefined();
  }
  const distinct = new Set(Object.values(params));
  expect(distinct.size, 'all four report endpoints should share one from/to window').toBe(1);
  return [...distinct][0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Reports date-range wiring', () => {
  it('loads every report with the default 7-day window on mount', async () => {
    mockReports();
    render(<Reports />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/reports/client-wise'));
    });

    const from = isoDate(new Date(Date.now() - 7 * 86400000));
    const to = isoDate(new Date());
    expect(lastRangeParams()).toBe(`?from=${from}T00:00:00&to=${to}T23:59:59`);
  });

  it('re-fetches all four reports with a single-day window for the Today preset', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Today')).toBeInTheDocument());
    await user.click(screen.getByText('Today'));

    const today = isoDate(new Date());
    await waitFor(() => {
      expect(lastRangeParams()).toBe(`?from=${today}T00:00:00&to=${today}T23:59:59`);
    });
  });

  it('re-fetches all four reports with a 7-day window for the 7 Days preset', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('7 Days')).toBeInTheDocument());
    await user.click(screen.getByText('7 Days'));

    const from = isoDate(new Date(Date.now() - 7 * 86400000));
    const to = isoDate(new Date());
    await waitFor(() => {
      expect(lastRangeParams()).toBe(`?from=${from}T00:00:00&to=${to}T23:59:59`);
    });
  });

  it('re-fetches all four reports with a 30-day window for the 30 Days preset', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('30 Days')).toBeInTheDocument());
    await user.click(screen.getByText('30 Days'));

    const from = isoDate(new Date(Date.now() - 30 * 86400000));
    const to = isoDate(new Date());
    await waitFor(() => {
      expect(lastRangeParams()).toBe(`?from=${from}T00:00:00&to=${to}T23:59:59`);
    });
  });

  it('re-fetches all four reports with a 90-day window for the 90 Days preset', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('90 Days')).toBeInTheDocument());
    await user.click(screen.getByText('90 Days'));

    const from = isoDate(new Date(Date.now() - 90 * 86400000));
    const to = isoDate(new Date());
    await waitFor(() => {
      expect(lastRangeParams()).toBe(`?from=${from}T00:00:00&to=${to}T23:59:59`);
    });
  });

  it('re-fetches all four reports when the manual from-date input changes', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const inputs = document.querySelectorAll('input[type="date"]');
    const fromInput = inputs[0] as HTMLInputElement;

    await user.clear(fromInput);
    await user.type(fromInput, '2026-01-15');

    const to = isoDate(new Date());
    await waitFor(() => {
      expect(lastRangeParams()).toBe(`?from=2026-01-15T00:00:00&to=${to}T23:59:59`);
    });
  });

  it('re-fetches all four reports when the manual to-date input changes', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const inputs = document.querySelectorAll('input[type="date"]');
    const toInput = inputs[1] as HTMLInputElement;

    await user.clear(toInput);
    await user.type(toInput, '2026-03-20');

    const from = isoDate(new Date(Date.now() - 7 * 86400000));
    await waitFor(() => {
      expect(lastRangeParams()).toBe(`?from=${from}T00:00:00&to=2026-03-20T23:59:59`);
    });
  });
});

describe('Reports tab tables match the mocked data', () => {
  it('renders the client-wise rows under its heading by default', async () => {
    mockReports({
      client: [
        { clientName: 'Acme Builders', totalQty: 50, deliveredQty: 48, plannedForDelivered: 50, variance: -2, totalChallans: 4 },
      ],
    });
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    expect(screen.getByText('Acme Builders')).toBeInTheDocument();
    expect(screen.getByText('4 trips')).toBeInTheDocument();
  });

  it('switches to the grade-wise tab and shows its heading and rows', async () => {
    mockReports({
      grade: [
        { grade: 'M30', totalQty: 80, deliveredQty: 80, plannedForDelivered: 80, variance: 0, totalChallans: 6 },
      ],
    });
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Grade Wise'));

    expect(await screen.findByText('Grade-wise Production')).toBeInTheDocument();
    expect(screen.getByText('M30')).toBeInTheDocument();
    expect(screen.getByText('6 batches')).toBeInTheDocument();
  });

  it('switches to the dispatch tab and shows its heading and table row', async () => {
    mockReports({
      dispatch: [
        { date: '2026-06-10', totalQty: 25, deliveredQty: 24, plannedForDelivered: 25, variance: -1, count: 2 },
      ],
    });
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Dispatch'));

    expect(await screen.findByText('Daily Dispatch Trend')).toBeInTheDocument();
    expect(screen.getByText('Planned (m³)')).toBeInTheDocument();
    // 24 delivered formatted to one decimal place in the table row (scoped so it
    // does not collide with the TOTAL DELIVERED summary card).
    const table = screen.getByRole('table');
    expect(within(table).getByText('24.0')).toBeInTheDocument();
  });

  it('switches to the production tab and shows its heading and table row', async () => {
    mockReports({
      production: [
        { date: '2026-06-10', grade: 'M25', totalQty: 30, count: 3 },
      ],
    });
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Production'));

    expect(await screen.findByText('Daily Production')).toBeInTheDocument();
    expect(screen.getByText('M25')).toBeInTheDocument();
    expect(screen.getByText('30.0')).toBeInTheDocument();
  });
});
