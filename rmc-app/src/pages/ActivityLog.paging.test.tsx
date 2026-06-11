import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so the component's
// error handling behaves exactly as in prod.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import ActivityLog from '@/pages/ActivityLog';
import { api } from '@/lib/api';

const PAGE_SIZE = 100;

const FACETS = {
  actions: ['password_reset', 'role_change'],
  actors: [{ id: 1, name: 'Anita Admin' }],
};

// Build N fake audit rows starting from a given offset so each page is distinct.
function makeRows(offset: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: offset + i + 1,
    actorId: 1,
    actorName: 'Anita Admin',
    action: 'password_reset',
    targetUserId: 2,
    targetUserEmail: `user${offset + i + 1}@aakruti.com`,
    detail: 'Reset password',
    emailSent: true,
    createdAt: '2026-06-01T10:00:00.000Z',
  }));
}

// Every /audit-logs query the page issues, so a test can assert the offset and
// filter params that drive page navigation.
let auditCalls: string[] = [];

// total controls how many pages exist; the mock slices rows per requested offset.
function mockApi(total: number) {
  auditCalls = [];
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/audit-logs/facets') return FACETS as never;
    if (path.startsWith('/audit-logs')) {
      auditCalls.push(path);
      const qs = new URLSearchParams(path.split('?')[1] ?? '');
      const offset = Number(qs.get('offset') ?? '0');
      const remaining = Math.max(0, total - offset);
      const count = Math.min(PAGE_SIZE, remaining);
      return { rows: makeRows(offset, count), total, hasMore: offset + count < total } as never;
    }
    return [] as never;
  });
}

function offsetsRequested() {
  return auditCalls.map(p => Number(new URLSearchParams(p.split('?')[1] ?? '').get('offset')));
}

function lastOffset() {
  const o = offsetsRequested();
  return o[o.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ActivityLog — total count', () => {
  it('shows the exact total and the "Showing A–B of N" range for a single page', async () => {
    mockApi(5);
    render(<ActivityLog />);

    // The header sentence carries the exact total.
    expect(await screen.findByText(/·\s*5 entries/)).toBeInTheDocument();

    // The footer range covers the whole (single-page) result set.
    await waitFor(() => {
      const showing = screen
        .getByText(/Showing/)
        .textContent?.replace(/\s+/g, ' ')
        .trim();
      expect(showing).toBe('Showing 1–5 of 5');
    });

    // A single page never renders the pager controls.
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
  });

  it('uses the singular "entry" when exactly one row exists', async () => {
    mockApi(1);
    render(<ActivityLog />);
    expect(await screen.findByText(/·\s*1 entry/)).toBeInTheDocument();
  });
});

describe('ActivityLog — page navigation', () => {
  it('advances and rewinds pages with Next/Prev, requesting the right offset', async () => {
    const user = userEvent.setup();
    mockApi(250); // 3 pages of 100
    render(<ActivityLog />);

    // First load: offset 0, page 1 of 3.
    await waitFor(() => expect(lastOffset()).toBe(0));
    await waitFor(() =>
      expect(screen.getByText(/Page/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 1 of 3'),
    );
    expect(screen.getByLabelText('Previous page')).toBeDisabled();

    // Next → offset 100, page 2.
    await user.click(screen.getByLabelText('Next page'));
    await waitFor(() => expect(lastOffset()).toBe(PAGE_SIZE));
    await waitFor(() =>
      expect(screen.getByText(/Page/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 2 of 3'),
    );
    expect(
      screen.getByText(/Showing/).textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('Showing 101–200 of 250');

    // Next → offset 200, page 3, Next now disabled (last page).
    await user.click(screen.getByLabelText('Next page'));
    await waitFor(() => expect(lastOffset()).toBe(PAGE_SIZE * 2));
    await waitFor(() =>
      expect(screen.getByText(/Page/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 3 of 3'),
    );
    expect(screen.getByLabelText('Next page')).toBeDisabled();

    // Prev → back to offset 100, page 2.
    await user.click(screen.getByLabelText('Previous page'));
    await waitFor(() => expect(lastOffset()).toBe(PAGE_SIZE));
    await waitFor(() =>
      expect(screen.getByText(/Page/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 2 of 3'),
    );
  });

  it('jumps to a specific page and clamps an out-of-range page to the last one', async () => {
    const user = userEvent.setup();
    mockApi(250);
    render(<ActivityLog />);
    await waitFor(() => expect(lastOffset()).toBe(0));

    const jump = screen.getByRole('spinbutton');

    // Jump to page 3 → offset 200.
    await user.clear(jump);
    await user.type(jump, '3');
    await user.click(screen.getByText('Go'));
    await waitFor(() => expect(lastOffset()).toBe(PAGE_SIZE * 2));
    await waitFor(() =>
      expect(screen.getByText(/Page/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 3 of 3'),
    );

    // Jump past the end → clamped to the last page (still page 3, offset 200).
    await user.clear(jump);
    await user.type(jump, '99');
    await user.click(screen.getByText('Go'));
    await waitFor(() =>
      expect(screen.getByText(/Page/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 3 of 3'),
    );
    expect(lastOffset()).toBe(PAGE_SIZE * 2);
  });
});

describe('ActivityLog — filtering resets paging', () => {
  it('returns to page 1 (offset 0) when a filter changes after navigating away', async () => {
    const user = userEvent.setup();
    mockApi(250);
    render(<ActivityLog />);
    await waitFor(() => expect(lastOffset()).toBe(0));

    // Move to page 2 first.
    await user.click(screen.getByLabelText('Next page'));
    await waitFor(() => expect(lastOffset()).toBe(PAGE_SIZE));

    // Change the action filter; this must reset back to the first page.
    const actionSelect = (await screen.findByRole('option', { name: 'Password Reset' })).closest(
      'select',
    )!;
    auditCalls = [];
    await user.selectOptions(actionSelect, 'password_reset');

    await waitFor(() => {
      expect(auditCalls.length).toBeGreaterThan(0);
      // The newest request carries the filter and is back at offset 0.
      const last = auditCalls[auditCalls.length - 1];
      expect(last).toContain('action=password_reset');
      expect(new URLSearchParams(last.split('?')[1]).get('offset')).toBe('0');
    });
    await waitFor(() =>
      expect(screen.getByText(/Page/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 1 of 3'),
    );
  });
});
