import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SSE isn't relevant to the import flow under test — stub it so the subscribe()
// effect is a no-op and never opens a real stream.
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
import { api } from '@/lib/api';

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
  await u.click(await screen.findByRole('button', { name: /Import CSV/i }));
  const heading = await screen.findByText(/Bulk-import plants from CSV/i);
  const panel = heading.closest('div')!.parentElement as HTMLElement;
  const input = panel.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input;
}

// The real file content matters here: downloadSkippedRows rebuilds the skipped
// CSV from the uploaded text, so the grid rows must line up with the row numbers
// the (mocked) server reports as skipped.
const CSV_CONTENT =
  'name,latitude,longitude\n' +
  'Good Row,1,2\n' +
  'Bad Row,,5\n';

function csvFile(name = 'plants.csv'): File {
  return new File([CSV_CONTENT], name, { type: 'text/csv' });
}

// jsdom doesn't implement object URLs — stub createObjectURL to capture the Blob
// the download builds, and spy on the anchor click to read its download name.
let capturedBlob: Blob | null = null;
let downloadedName: string | null = null;
let origCreate: typeof URL.createObjectURL;
let origRevoke: typeof URL.revokeObjectURL;
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockBaseApi();
  capturedBlob = null;
  downloadedName = null;
  origCreate = URL.createObjectURL;
  origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn((b: Blob) => { capturedBlob = b; return 'blob:mock'; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadedName = this.download;
  });
});

afterEach(() => {
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;
  clickSpy.mockRestore();
});

describe('Plants — Download skipped rows button', () => {
  it('downloads skipped-rows.csv with the skipped row content when there are skips', async () => {
    const result: ImportResult = {
      created: 1,
      skipped: 1,
      results: [
        { row: 2, name: 'Good Row', status: 'created' },
        { row: 3, name: 'Bad Row', status: 'skipped', reason: 'missing latitude' },
      ],
    };
    vi.mocked(api.post).mockResolvedValue(result as never);

    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    await u.upload(input, csvFile());

    // The summary appears once the import resolves, exposing the download button.
    expect(await screen.findByText('1 skipped')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Download skipped rows/i });

    await u.click(btn);

    // A download was triggered to the fixed filename.
    await waitFor(() => expect(downloadedName).toBe('skipped-rows.csv'));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

    // The downloaded CSV carries only the skipped row, with the original columns
    // plus a trailing "reason" column populated from the server result.
    expect(capturedBlob).toBeTruthy();
    expect(capturedBlob!.type).toMatch(/text\/csv/);
    const text = await capturedBlob!.text();
    expect(text).toBe('name,latitude,longitude,reason\r\nBad Row,,5,missing latitude\r\n');
    // The successfully-created row is never included in the skipped export.
    expect(text).not.toMatch(/Good Row/);
  });

  it('does not render the Download skipped rows button when nothing was skipped', async () => {
    const clean: ImportResult = {
      created: 2,
      skipped: 0,
      results: [
        { row: 2, name: 'Good Row', status: 'created' },
        { row: 3, name: 'Bad Row', status: 'created' },
      ],
    };
    vi.mocked(api.post).mockResolvedValue(clean as never);

    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    await u.upload(input, csvFile());

    // The summary renders, but a clean import offers no skipped-rows download.
    expect(await screen.findByText('2 created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download skipped rows/i })).not.toBeInTheDocument();
  });
});
