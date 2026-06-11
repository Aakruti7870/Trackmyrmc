import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import Reports from '@/pages/Reports';
import { api } from '@/lib/api';

interface ClientRow { clientName: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; totalChallans: number }
interface GradeRow { grade: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; totalChallans: number }
interface DispatchRow { date: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; count: number }

const VARIANCE_TITLE = 'Delivered − planned (delivered challans)';

// Reports loads four report endpoints plus the variance tolerance; route the
// mock by path so each test can supply just the rows it cares about.
function mockReports(opts: {
  client?: ClientRow[];
  grade?: GradeRow[];
  dispatch?: DispatchRow[];
  production?: unknown[];
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

// Scopes variance assertions to a single client/grade row by its label cell.
function rowFor(label: string): HTMLElement {
  const cell = screen.getByText(label).closest('div');
  if (!cell) throw new Error(`row for ${label} not found`);
  return cell as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Reports variance display', () => {
  it('shows a blue +delta for an over-delivered client row', async () => {
    mockReports({
      client: [{ clientName: 'Over Co', totalQty: 12, deliveredQty: 12, plannedForDelivered: 10, variance: 2, totalChallans: 1 }],
    });
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Over Co')).toBeInTheDocument());
    const badge = within(rowFor('Over Co')).getByTitle(VARIANCE_TITLE);
    expect(badge.textContent).toBe('+2.0');
    expect(badge).toHaveStyle({ color: 'var(--blue)' });
  });

  it('shows a red −delta for a short-delivered client row', async () => {
    mockReports({
      client: [{ clientName: 'Short Co', totalQty: 10, deliveredQty: 8.5, plannedForDelivered: 10, variance: -1.5, totalChallans: 1 }],
    });
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Short Co')).toBeInTheDocument());
    const badge = within(rowFor('Short Co')).getByTitle(VARIANCE_TITLE);
    // Typographic minus U+2212, not an ASCII hyphen.
    expect(badge.textContent).toBe('\u22121.5');
    expect(badge).toHaveStyle({ color: 'var(--red)' });
  });

  it('shows a muted 0.0 for an on-target row within tolerance', async () => {
    mockReports({
      client: [{ clientName: 'OnTarget Co', totalQty: 10, deliveredQty: 10.05, plannedForDelivered: 10, variance: 0.05, totalChallans: 1 }],
    });
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('OnTarget Co')).toBeInTheDocument());
    const badge = within(rowFor('OnTarget Co')).getByTitle(VARIANCE_TITLE);
    expect(badge.textContent).toBe('0.0');
    expect(badge).toHaveStyle({ color: 'var(--muted)' });
  });

  it('shows a muted 0.0 for a row with no delivered quantity', async () => {
    mockReports({
      client: [{ clientName: 'Pending Co', totalQty: 10, deliveredQty: 0, plannedForDelivered: 0, variance: 0, totalChallans: 1 }],
    });
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Pending Co')).toBeInTheDocument());
    const badge = within(rowFor('Pending Co')).getByTitle(VARIANCE_TITLE);
    expect(badge.textContent).toBe('0.0');
    expect(badge).toHaveStyle({ color: 'var(--muted)' });
  });

  it('renders the correct variance per client row when mixing over, short and on-target', async () => {
    mockReports({
      client: [
        { clientName: 'Over Co', totalQty: 12, deliveredQty: 11.3, plannedForDelivered: 10, variance: 1.3, totalChallans: 1 },
        { clientName: 'Short Co', totalQty: 10, deliveredQty: 9, plannedForDelivered: 10, variance: -1, totalChallans: 1 },
        { clientName: 'OnTarget Co', totalQty: 10, deliveredQty: 10, plannedForDelivered: 10, variance: 0, totalChallans: 1 },
      ],
    });
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Over Co')).toBeInTheDocument());

    const over = within(rowFor('Over Co')).getByTitle(VARIANCE_TITLE);
    expect(over.textContent).toBe('+1.3');
    expect(over).toHaveStyle({ color: 'var(--blue)' });

    const short = within(rowFor('Short Co')).getByTitle(VARIANCE_TITLE);
    expect(short.textContent).toBe('\u22121.0');
    expect(short).toHaveStyle({ color: 'var(--red)' });

    const ok = within(rowFor('OnTarget Co')).getByTitle(VARIANCE_TITLE);
    expect(ok.textContent).toBe('0.0');
    expect(ok).toHaveStyle({ color: 'var(--muted)' });
  });

  it('summarises net variance from the dispatch totals as a short delivery', async () => {
    mockReports({
      dispatch: [
        { date: '2026-06-09', totalQty: 20, deliveredQty: 18, plannedForDelivered: 20, variance: -2, count: 2 },
        { date: '2026-06-10', totalQty: 15, deliveredQty: 14.5, plannedForDelivered: 15, variance: -0.5, count: 1 },
      ],
    });
    render(<Reports />);

    const netLabel = await screen.findByText('NET VARIANCE');
    const card = netLabel.parentElement;
    if (!card) throw new Error('net variance card not found');
    // 32.5 delivered − 35 planned = −2.5 m³, beyond tolerance → red short delivery.
    const value = within(card as HTMLElement).getByText('\u22122.5', { exact: false });
    expect(value).toHaveStyle({ color: 'var(--red)' });
    expect(within(card as HTMLElement).getByText('short delivery')).toBeInTheDocument();
  });
});
