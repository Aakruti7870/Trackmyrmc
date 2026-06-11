import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import Reports from '@/pages/Reports';
import { api } from '@/lib/api';

// Anchor "today" so preset arithmetic is deterministic. Noon UTC keeps
// toISOString().slice(0,10) on the same calendar day the component computes.
const NOW = new Date('2026-06-11T12:00:00.000Z');
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(days: number) { return iso(new Date(NOW.getTime() - days * 86400000)); }
const TODAY = iso(NOW);

// All four report endpoints are stubbed empty; the test only inspects the
// from/to query params, not the payloads.
function mockEmptyReports() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/reports/variance-tolerance')) return Promise.resolve({ abs: 0.1, pct: 0 } as never);
    return Promise.resolve([] as never);
  });
}

// Returns the from/to range from the most recent client-wise report fetch.
function lastRange(): { from: string; to: string } {
  const calls = vi.mocked(api.get).mock.calls
    .map(c => c[0] as string)
    .filter(p => p.startsWith('/reports/client-wise'));
  const path = calls[calls.length - 1];
  if (!path) throw new Error('no client-wise report fetch recorded');
  const params = new URLSearchParams(path.slice(path.indexOf('?')));
  return { from: params.get('from') ?? '', to: params.get('to') ?? '' };
}

function presetButton(label: string): HTMLButtonElement {
  return screen.getByRole('button', { name: label }) as HTMLButtonElement;
}

// A preset chip renders with a gold background only while it is the active range.
function isActive(btn: HTMLButtonElement): boolean {
  return btn.style.background === 'var(--gold)';
}

beforeEach(() => {
  vi.clearAllMocks();
  // Fake only Date so preset arithmetic is deterministic; leave setTimeout/
  // setInterval real so testing-library's waitFor polling still advances.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mockEmptyReports();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Reports date-range presets', () => {
  it('defaults to the 7 Days preset and fetches the last week', async () => {
    render(<Reports />);
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(c => (c[0] as string).startsWith('/reports/client-wise'))).toBe(true));

    expect(lastRange()).toEqual({ from: `${daysAgo(7)}T00:00:00`, to: `${TODAY}T23:59:59` });
    expect(isActive(presetButton('7 Days'))).toBe(true);
  });

  it('clicking Today queries only the current day', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await waitFor(() => expect(lastRange().from).toBe(`${daysAgo(7)}T00:00:00`));

    await user.click(presetButton('Today'));

    await waitFor(() => expect(lastRange()).toEqual({ from: `${TODAY}T00:00:00`, to: `${TODAY}T23:59:59` }));
    expect(isActive(presetButton('Today'))).toBe(true);
    expect(isActive(presetButton('7 Days'))).toBe(false);
  });

  it('clicking 30 Days queries the last 30 days', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await waitFor(() => expect(lastRange().from).toBe(`${daysAgo(7)}T00:00:00`));

    await user.click(presetButton('30 Days'));

    await waitFor(() => expect(lastRange()).toEqual({ from: `${daysAgo(30)}T00:00:00`, to: `${TODAY}T23:59:59` }));
    expect(isActive(presetButton('30 Days'))).toBe(true);
  });

  it('clicking 90 Days queries the last 90 days', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await waitFor(() => expect(lastRange().from).toBe(`${daysAgo(7)}T00:00:00`));

    await user.click(presetButton('90 Days'));

    await waitFor(() => expect(lastRange()).toEqual({ from: `${daysAgo(90)}T00:00:00`, to: `${TODAY}T23:59:59` }));
    expect(isActive(presetButton('90 Days'))).toBe(true);
  });

  it('every preset computes the correct from/to window', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await waitFor(() => expect(lastRange().from).toBe(`${daysAgo(7)}T00:00:00`));

    const cases: Array<[string, string]> = [
      ['Today', daysAgo(0)],
      ['7 Days', daysAgo(7)],
      ['30 Days', daysAgo(30)],
      ['90 Days', daysAgo(90)],
    ];
    for (const [label, expectedFrom] of cases) {
      await user.click(presetButton(label));
      await waitFor(() => expect(lastRange()).toEqual({ from: `${expectedFrom}T00:00:00`, to: `${TODAY}T23:59:59` }));
    }
  });
});

describe('Reports custom date inputs', () => {
  function dateInputs(): HTMLInputElement[] {
    return Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
  }

  it('editing the from date deselects the active preset and refetches', async () => {
    render(<Reports />);
    await waitFor(() => expect(lastRange().from).toBe(`${daysAgo(7)}T00:00:00`));
    expect(isActive(presetButton('7 Days'))).toBe(true);

    const [fromInput] = dateInputs();
    fireEvent.change(fromInput, { target: { value: '2026-01-01' } });

    await waitFor(() => expect(lastRange()).toEqual({ from: '2026-01-01T00:00:00', to: `${TODAY}T23:59:59` }));
    // No preset chip should remain highlighted after a custom edit.
    expect(['Today', '7 Days', '30 Days', '90 Days'].some(l => isActive(presetButton(l)))).toBe(false);
  });

  it('editing the to date deselects the active preset and refetches', async () => {
    render(<Reports />);
    await waitFor(() => expect(lastRange().to).toBe(`${TODAY}T23:59:59`));

    const [, toInput] = dateInputs();
    fireEvent.change(toInput, { target: { value: '2026-06-30' } });

    await waitFor(() => expect(lastRange()).toEqual({ from: `${daysAgo(7)}T00:00:00`, to: '2026-06-30T23:59:59' }));
    expect(['Today', '7 Days', '30 Days', '90 Days'].some(l => isActive(presetButton(l)))).toBe(false);
  });
});
