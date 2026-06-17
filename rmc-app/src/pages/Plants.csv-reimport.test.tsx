import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// SSE isn't relevant to the inline re-upload flow under test — stub it so the
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
// drive the first (initial) import through it.
async function openImportPanel(u: ReturnType<typeof userEvent.setup>): Promise<HTMLInputElement> {
  await u.click(await screen.findByRole('button', { name: /Import CSV/i }));
  const heading = await screen.findByText(/Bulk-import plants from CSV/i);
  const panel = heading.closest('div')!.parentElement as HTMLElement;
  const input = panel.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input;
}

// Content is irrelevant — the mocked /plants/import drives the response — but it
// must be non-empty (runImport rejects an empty file before posting).
function csvFile(name = 'plants.csv'): File {
  return new File(['name,latitude,longitude\nFoo,1,2\n'], name, { type: 'text/csv' });
}

// The corrected re-upload target wires its own hidden <input>. After a result
// with skipped rows it's the second (last) file input rendered in the panel.
function reuploadInput(): HTMLInputElement {
  const inputs = document.querySelectorAll('input[type="file"]');
  return inputs[inputs.length - 1] as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBaseApi();
});

describe('Plants — inline re-import of a corrected skipped-rows file', () => {
  it('reports previously-skipped vs now-succeeded counts after a clean re-upload', async () => {
    const first: ImportResult = {
      created: 1,
      skipped: 2,
      results: [
        { row: 2, name: 'Sunrise RMC', status: 'created' },
        { row: 3, name: 'Bad Row A', status: 'skipped', reason: 'missing latitude' },
        { row: 4, name: 'Bad Row B', status: 'skipped', reason: 'missing longitude' },
      ],
    };
    const second: ImportResult = {
      created: 2,
      skipped: 0,
      results: [
        { row: 2, name: 'Bad Row A', status: 'created' },
        { row: 3, name: 'Bad Row B', status: 'created' },
      ],
    };
    vi.mocked(api.post).mockResolvedValueOnce(first as never).mockResolvedValueOnce(second as never);

    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    // First import leaves two skipped rows, which reveals the inline re-upload
    // target prompting the staff to drop a corrected file.
    await u.upload(input, csvFile());
    expect(await screen.findByText('2 skipped')).toBeInTheDocument();
    expect(screen.getByText(/Fixed the skipped rows\? Drop the corrected CSV here/i)).toBeInTheDocument();

    // Re-upload a corrected file through the inline target.
    await u.upload(reuploadInput(), csvFile('corrected.csv'));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));

    // The success banner reports both previously-skipped rows now succeeded, and
    // (since none remain) makes no "still skipped" claim.
    const banner = await screen.findByText(/Re-import complete/i);
    expect(banner.textContent).toMatch(/2\s*of\s*2\s*previously-skipped rows now imported successfully\./);
    expect(banner.textContent).not.toMatch(/still skipped/);

    // With zero remaining skipped rows the re-upload target is gone.
    expect(screen.queryByText(/Fixed the skipped rows\?/i)).not.toBeInTheDocument();
  });

  it('reports how many still failed when the corrected file fixes only some rows', async () => {
    const first: ImportResult = {
      created: 0,
      skipped: 3,
      results: [
        { row: 2, name: 'Bad A', status: 'skipped', reason: 'missing latitude' },
        { row: 3, name: 'Bad B', status: 'skipped', reason: 'missing longitude' },
        { row: 4, name: 'Bad C', status: 'skipped', reason: 'missing name' },
      ],
    };
    const second: ImportResult = {
      created: 2,
      skipped: 1,
      results: [
        { row: 2, name: 'Bad A', status: 'created' },
        { row: 3, name: 'Bad B', status: 'created' },
        { row: 4, name: 'Bad C', status: 'skipped', reason: 'missing name' },
      ],
    };
    vi.mocked(api.post).mockResolvedValueOnce(first as never).mockResolvedValueOnce(second as never);

    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    await u.upload(input, csvFile());
    expect(await screen.findByText('3 skipped')).toBeInTheDocument();

    await u.upload(reuploadInput(), csvFile('corrected.csv'));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));

    // 2 of the 3 previously-skipped rows now import, and the banner states that
    // 1 row is still skipped.
    const banner = await screen.findByText(/Re-import complete/i);
    expect(banner.textContent).toMatch(/2\s*of\s*3\s*previously-skipped rows now imported successfully/);
    expect(banner.textContent).toMatch(/1\s*still skipped/);

    // One row still fails, so the inline re-upload target stays available.
    expect(screen.getByText(/Fixed the skipped rows\?/i)).toBeInTheDocument();
  });

  it('does not show the inline re-upload target when the first import has no skipped rows', async () => {
    const clean: ImportResult = {
      created: 2,
      skipped: 0,
      results: [
        { row: 2, name: 'Sunrise RMC', status: 'created' },
        { row: 3, name: 'Granite Mix', status: 'created' },
      ],
    };
    vi.mocked(api.post).mockResolvedValue(clean as never);

    const u = userEvent.setup();
    render(<Plants />);
    const input = await openImportPanel(u);

    await u.upload(input, csvFile());

    // A clean import shows the summary but never offers the corrected re-upload
    // target, and shows no re-import banner (this wasn't a retry).
    expect(await screen.findByText('2 created')).toBeInTheDocument();
    expect(screen.queryByText(/Fixed the skipped rows\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Re-import complete/i)).not.toBeInTheDocument();
  });
});
