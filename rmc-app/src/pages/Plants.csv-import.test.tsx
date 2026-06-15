import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// SSE isn't relevant to the bulk-import flow under test — stub it so the
// subscribe() effect is a no-op and never opens a real stream.
vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({ status: 'connected' as const, reconnect: () => {}, subscribe: () => () => {} }),
}));

// LocationPicker pulls in Leaflet (unhappy in jsdom). Not used by the import
// panel, but the page imports it — render a stub so the page mounts cleanly.
vi.mock('@/components/LocationPicker', () => ({
  default: () => <div data-testid="loc-picker" />,
}));

// Mock the api module but keep the real ApiError so error handling is realistic.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import Plants from '@/pages/Plants';
import { api, ApiError } from '@/lib/api';

interface ImportRowResult {
  row: number;
  name: string;
  status: 'created' | 'skipped';
  reason?: string;
}
interface ImportResult {
  created: number;
  skipped: number;
  results: ImportRowResult[];
}

// The page renders nothing until /plants resolves — serve an empty plant list
// (and empty invites) so we land on the Leads tab where Import CSV lives.
function mockBaseApi() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/plants') return Promise.resolve([] as never);
    if (path === '/plants/invites') return Promise.resolve([] as never);
    return Promise.resolve([] as never);
  });
}

// Open the import panel and hand back the hidden file <input> so a test can
// drive a file selection through it, exactly like clicking "choose a file".
async function openImportPanel(u: ReturnType<typeof userEvent.setup>): Promise<HTMLInputElement> {
  // Wait for the page to finish loading (Leads tab present), then reveal panel.
  await u.click(await screen.findByRole('button', { name: /Import CSV/i }));
  const heading = await screen.findByText(/Bulk-import plants from CSV/i);
  const panel = heading.closest('div')!.parentElement as HTMLElement;
  const input = panel.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input;
}

function csvFile(name = 'plants.csv'): File {
  // Content is irrelevant — the mocked /plants/import drives the response — but
  // it must be non-empty (runImport rejects an empty file before posting).
  return new File(['name,latitude,longitude\nFoo,1,2\n'], name, { type: 'text/csv' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBaseApi();
});

describe('Plants — bulk CSV import panel', () => {
  it('renders the created/skipped summary and per-row table on success', async () => {
    const result: ImportResult = {
      created: 2,
      skipped: 1,
      results: [
        { row: 2, name: 'Sunrise RMC', status: 'created' },
        { row: 3, name: 'Granite Mix', status: 'created' },
        { row: 4, name: 'Bad Row', status: 'skipped', reason: 'missing latitude' },
      ],
    };
    vi.mocked(api.post).mockResolvedValue(result as never);

    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    await u.upload(input, csvFile());

    // The CSV is read and posted to the import endpoint.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/plants/import', { csv: expect.any(String) }));

    // Summary badges reflect the response counts.
    expect(await screen.findByText('2 created')).toBeInTheDocument();
    expect(screen.getByText('1 skipped')).toBeInTheDocument();

    // The per-row result table renders every row with its status + reason.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Sunrise RMC')).toBeInTheDocument();
    expect(within(table).getByText('Granite Mix')).toBeInTheDocument();
    expect(within(table).getByText('Bad Row')).toBeInTheDocument();
    expect(within(table).getByText('missing latitude')).toBeInTheDocument();
    expect(within(table).getAllByText('Created')).toHaveLength(2);
    expect(within(table).getByText('Skipped')).toBeInTheDocument();

    // A created result refreshes the plant list so the new leads appear.
    expect(api.get).toHaveBeenCalledWith('/plants');
  });

  it('shows the server error (e.g. missing headers) and no result table', async () => {
    vi.mocked(api.post).mockRejectedValue(
      new ApiError('CSV must include a "name", "latitude" and "longitude" column.', 400, {}),
    );

    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    await u.upload(input, csvFile());

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

    // The error surfaces inline and no summary/table is shown.
    expect(
      await screen.findByText('CSV must include a "name", "latitude" and "longitude" column.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/created$/)).not.toBeInTheDocument();
  });
});
