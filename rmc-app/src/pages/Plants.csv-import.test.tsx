import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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

// The drop zone is the element that wires up onDrop — the text label sits one
// level inside it, so step up to its parent to reach the element with onDrop.
function dropZone(): HTMLElement {
  return screen.getByText(/Drag a .csv here/i).parentElement as HTMLElement;
}

// fireEvent.drop won't synthesise a DataTransfer for us — hand it one carrying
// the dropped file(s) so onImportDrop can read e.dataTransfer.files[0].
function dropFile(zone: HTMLElement, file: File): void {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
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

  it('imports a CSV dropped onto the drop zone, just like picking one', async () => {
    const result: ImportResult = {
      created: 1,
      skipped: 0,
      results: [{ row: 2, name: 'Dropped RMC', status: 'created' }],
    };
    vi.mocked(api.post).mockResolvedValue(result as never);

    const u = userEvent.setup();
    render(<Plants />);
    await openImportPanel(u);

    dropFile(dropZone(), csvFile('dropped.csv'));

    // Dropping a file runs the same import as choosing one — it posts the CSV…
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/plants/import', { csv: expect.any(String) }));

    // …and renders the result summary + per-row table.
    expect(await screen.findByText('1 created')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Dropped RMC')).toBeInTheDocument();
    expect(within(table).getByText('Created')).toBeInTheDocument();
  });

  it('warns on a non-CSV file and never posts', async () => {
    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    // userEvent.upload honours the input's accept=".csv" filter and would drop a
    // non-matching file, so fire a raw change event to exercise the guard.
    const png = new File(['not a csv'], 'logo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [png] } });

    expect(await screen.findByText('Please choose a .csv file.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('warns on an empty file and never posts', async () => {
    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    // A .csv with no content passes the type guard but fails the empty check.
    const empty = new File([''], 'empty.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [empty] } });

    expect(await screen.findByText('That file is empty.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
