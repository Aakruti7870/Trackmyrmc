import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import Reports from '@/pages/Reports';
import { api } from '@/lib/api';

// Every report endpoint returns an empty array so each tab falls back to its
// "no data" empty state. Trip-timing/fuel return shaped-but-empty payloads.
function mockEmptyReports() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/reports/variance-tolerance')) return Promise.resolve({ abs: 0.1, pct: 0 } as never);
    if (path.startsWith('/reports/trip-timing')) return Promise.resolve({ freeMin: 45, ratePerHour: null, rows: [] } as never);
    if (path.startsWith('/reports/fuel-reconciliation')) return Promise.resolve({ rows: [] } as never);
    return Promise.resolve([] as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Reports empty states render per tab when endpoints return no rows', () => {
  it('shows the client-wise empty state on the default tab', async () => {
    mockEmptyReports();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    expect(screen.getByText('No data for this period')).toBeInTheDocument();
  });

  it('shows the grade-wise empty state after switching to the grade tab', async () => {
    mockEmptyReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Grade Wise'));

    expect(await screen.findByText('Grade-wise Production')).toBeInTheDocument();
    expect(screen.getByText('No data for this period')).toBeInTheDocument();
  });

  it('shows the dispatch empty state after switching to the dispatch tab', async () => {
    mockEmptyReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Dispatch'));

    expect(await screen.findByText('Daily Dispatch Trend')).toBeInTheDocument();
    expect(screen.getByText('No dispatch data for this period')).toBeInTheDocument();
  });

  it('shows the production empty state after switching to the production tab', async () => {
    mockEmptyReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Production'));

    expect(await screen.findByText('Daily Production')).toBeInTheDocument();
    expect(screen.getByText('No production data for this period')).toBeInTheDocument();
  });
});
