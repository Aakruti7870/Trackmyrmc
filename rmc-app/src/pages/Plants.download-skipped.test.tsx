import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SSE isn't relevant to the import flow — stub it so subscribe() is a no-op.
vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({ status: 'connected' as const, reconnect: () => {}, subscribe: () => () => {} }),
}));

// LocationPicker pulls in Leaflet (unhappy in jsdom) and isn't used here.
vi.mock('@/components/LocationPicker', () => ({
  default: () => <div data-testid="loc-picker" />,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import Plants from '@/pages/Plants';
import { api } from '@/lib/api';
import type { ImportResult } from '@/lib/importCsv';

function mockBaseApi() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/plants') return Promise.resolve([] as never);
    if (path === '/plants/invites') return Promise.resolve([] as never);
    return Promise.resolve([] as never);
  });
}

async function openImportPanel(u: ReturnType<typeof userEvent.setup>): Promise<HTMLInputElement> {
  await u.click(await screen.findByRole('button', { name: /Import CSV/i }));
  const heading = await screen.findByText(/Bulk-import plants from CSV/i);
  const panel = heading.closest('div')!.parentElement as HTMLElement;
  const input = panel.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input;
}

// Drive an import end-to-end: pick a file, post returns the given result, and the
// raw CSV text becomes whatever the file holds (read via file.text()).
async function importFile(u: ReturnType<typeof userEvent.setup>, csv: string, result: ImportResult) {
  vi.mocked(api.post).mockResolvedValue(result as never);
  const input = await openImportPanel(u);
  await u.upload(input, new File([csv], 'plants.csv', { type: 'text/csv' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/plants/import', { csv: expect.any(String) }));
}

// Capture the Blob handed to URL.createObjectURL (and neutralise the anchor
// click + revoke) so a button click can be inspected without a real download.
let lastBlob: Blob | null = null;
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockBaseApi();
  lastBlob = null;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((b: Blob) => { lastBlob = b; return 'blob:mock'; }),
    revokeObjectURL: vi.fn(),
  });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  clickSpy.mockRestore();
});

describe('Plants — Download skipped rows button', () => {
  it('appears when at least one row was skipped', async () => {
    const u = userEvent.setup();
    render(<Plants />);
    await importFile(u, 'name,latitude,longitude\nFoo,1,2\nBar,,4\n', {
      created: 1,
      skipped: 1,
      results: [
        { row: 2, name: 'Foo', status: 'created' },
        { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
      ],
    });

    expect(await screen.findByRole('button', { name: /Download skipped rows/i })).toBeInTheDocument();
  });

  it('is hidden when nothing was skipped', async () => {
    const u = userEvent.setup();
    render(<Plants />);
    await importFile(u, 'name,latitude,longitude\nFoo,1,2\n', {
      created: 1,
      skipped: 0,
      results: [{ row: 2, name: 'Foo', status: 'created' }],
    });

    // The summary renders (so we know the import finished) but no download button.
    expect(await screen.findByText('1 created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download skipped rows/i })).not.toBeInTheDocument();
  });

  it('downloads a CSV of just the skipped rows when clicked', async () => {
    const u = userEvent.setup();
    render(<Plants />);
    await importFile(u, 'name,latitude,longitude\nFoo,1,2\nBar,,4\nBaz,5,6\n', {
      created: 2,
      skipped: 1,
      results: [
        { row: 2, name: 'Foo', status: 'created' },
        { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
        { row: 4, name: 'Baz', status: 'created' },
      ],
    });

    await u.click(await screen.findByRole('button', { name: /Download skipped rows/i }));

    expect(clickSpy).toHaveBeenCalled();
    expect(lastBlob).not.toBeNull();
    const text = await lastBlob!.text();
    const lines = text.replace(/\r\n$/, '').split('\r\n');
    expect(lines).toEqual([
      'name,latitude,longitude,reason',
      'Bar,,4,missing latitude',
    ]);
  });
});
