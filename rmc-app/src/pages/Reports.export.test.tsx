import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import Reports from '@/pages/Reports';
import { api } from '@/lib/api';

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

// Mirror the component's default range: from = 7 days ago, to = today.
const expectedFrom = isoDate(new Date(Date.now() - 7 * 86400000));
const expectedTo = isoDate(new Date());

// The export now goes through api.download(): an authenticated fetch + blob anchor
// download (works in the native Capacitor build), not window.open(). We stub fetch
// and the blob-URL helpers and assert on the fetched URL.
const makeFetchSpy = () => vi.spyOn(global, 'fetch');
let fetchSpy: ReturnType<typeof makeFetchSpy>;

function fetchedUrl(): string {
  return fetchSpy.mock.calls[0][0] as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/reports/variance-tolerance')) return Promise.resolve({ abs: 0.1, pct: 0 } as never);
    return Promise.resolve([] as never);
  });
  fetchSpy = makeFetchSpy().mockResolvedValue(
    new Response('a,b\n1,2\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
  );
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Reports CSV export', () => {
  it('exports the dispatch report for the default (non-production) tab with the active range', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Export CSV')).toBeInTheDocument());
    await user.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const url = fetchedUrl();
    expect(url).toContain('/api/reports/export?');
    expect(url).toContain('report=dispatch');
    expect(url).not.toContain('report=production');
    expect(url).toContain(`from=${expectedFrom}T00:00:00`);
    expect(url).toContain(`to=${expectedTo}T23:59:59`);
  });

  it('exports the production report when the Production tab is active', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Production')).toBeInTheDocument());
    await user.click(screen.getByText('Production'));
    await user.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const url = fetchedUrl();
    expect(url).toContain('report=production');
    expect(url).toContain(`from=${expectedFrom}T00:00:00`);
    expect(url).toContain(`to=${expectedTo}T23:59:59`);
  });

  it('still exports the dispatch report from the Dispatch tab (only Production differs)', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Dispatch'));
    await user.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchedUrl()).toContain('report=dispatch');
  });

  it('reflects a changed date range (Today preset) in the export URL', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Today')).toBeInTheDocument());
    await user.click(screen.getByText('Today'));
    await user.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const today = isoDate(new Date());
    const url = fetchedUrl();
    expect(url).toContain('report=dispatch');
    expect(url).toContain(`from=${today}T00:00:00`);
    expect(url).toContain(`to=${today}T23:59:59`);
  });
});
