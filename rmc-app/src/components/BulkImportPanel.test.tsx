import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BulkImportPanel from './BulkImportPanel';
import type { ImportResult } from '@/lib/importCsv';

// Render the panel in isolation with a stub onImport so each test fully
// controls the per-row result the panel reacts to. No page, api, SSE or
// Leaflet involvement — this locks in the component's own contract.
function renderPanel(onImport: (csv: string) => Promise<ImportResult>) {
  return render(
    <BulkImportPanel
      title="Bulk-import plants from CSV"
      description="Upload a CSV to create plant leads."
      onImport={onImport}
    />,
  );
}

// The primary drop target's hidden file input is the first file input; the
// inline re-upload target's input (only present after a skip) is the second.
function fileInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
}

function csvFile(content = 'name,latitude,longitude\nFoo,1,2\n', name = 'plants.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

describe('BulkImportPanel — re-upload flow', () => {
  it('shows the inline re-upload target after an import that skipped rows', async () => {
    const onImport = vi.fn<(csv: string) => Promise<ImportResult>>().mockResolvedValue({
      created: 1,
      skipped: 1,
      results: [
        { row: 2, name: 'Foo', status: 'created' },
        { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
      ],
    });

    const u = userEvent.setup();
    const { container } = renderPanel(onImport);

    await u.upload(fileInputs(container)[0], csvFile());

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));

    // The summary renders and the inline re-upload drop target appears because
    // at least one row was skipped.
    expect(await screen.findByText('1 created')).toBeInTheDocument();
    expect(
      screen.getByText(/Fixed the skipped rows\? Drop the corrected CSV here to re-import/i),
    ).toBeInTheDocument();
    // No "previously-skipped" banner yet — this was a first import, not a retry.
    expect(screen.queryByText(/previously-skipped/i)).not.toBeInTheDocument();
  });

  it('renders the previously-skipped success banner with correct counts after a corrected re-upload', async () => {
    const onImport = vi
      .fn<(csv: string) => Promise<ImportResult>>()
      // First import: 1 created, 2 skipped.
      .mockResolvedValueOnce({
        created: 1,
        skipped: 2,
        results: [
          { row: 2, name: 'Foo', status: 'created' },
          { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
          { row: 4, name: 'Baz', status: 'skipped', reason: 'missing longitude' },
        ],
      })
      // Corrected re-upload: both previously-skipped rows now created.
      .mockResolvedValueOnce({
        created: 2,
        skipped: 0,
        results: [
          { row: 2, name: 'Bar', status: 'created' },
          { row: 3, name: 'Baz', status: 'created' },
        ],
      });

    const u = userEvent.setup();
    const { container } = renderPanel(onImport);

    await u.upload(fileInputs(container)[0], csvFile());
    expect(await screen.findByText('2 skipped')).toBeInTheDocument();

    // The re-upload input is the second file input, present only after a skip.
    const reuploadInput = fileInputs(container)[1];
    expect(reuploadInput).toBeTruthy();
    await u.upload(reuploadInput, csvFile('name,latitude,longitude\nBar,3,4\nBaz,5,6\n', 'fixed.csv'));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2));

    // The banner reports how many of the previously-skipped rows now succeeded.
    const banner = await screen.findByText(/Re-import complete/i);
    expect(banner).toHaveTextContent(
      'Re-import complete — 2 of 2 previously-skipped rows now imported successfully.',
    );

    // With nothing skipped after the retry, the re-upload target disappears and
    // its file input is gone, leaving only the primary drop target's input.
    expect(
      screen.queryByText(/Fixed the skipped rows\? Drop the corrected CSV here to re-import/i),
    ).not.toBeInTheDocument();
    expect(fileInputs(container)).toHaveLength(1);
  });

  it('reports rows that are still skipped after a partial re-upload fix', async () => {
    const onImport = vi
      .fn<(csv: string) => Promise<ImportResult>>()
      .mockResolvedValueOnce({
        created: 0,
        skipped: 2,
        results: [
          { row: 2, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
          { row: 3, name: 'Baz', status: 'skipped', reason: 'missing longitude' },
        ],
      })
      // Re-upload: only one of the two previously-skipped rows is fixed.
      .mockResolvedValueOnce({
        created: 1,
        skipped: 1,
        results: [
          { row: 2, name: 'Bar', status: 'created' },
          { row: 3, name: 'Baz', status: 'skipped', reason: 'missing longitude' },
        ],
      });

    const u = userEvent.setup();
    const { container } = renderPanel(onImport);

    await u.upload(fileInputs(container)[0], csvFile());
    expect(await screen.findByText('2 skipped')).toBeInTheDocument();

    await u.upload(fileInputs(container)[1], csvFile('name,latitude,longitude\nBar,3,4\nBaz,5,\n', 'fixed.csv'));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2));

    const banner = await screen.findByText(/Re-import complete/i);
    expect(banner).toHaveTextContent(
      'Re-import complete — 1 of 2 previously-skipped rows now imported successfully, 1 still skipped.',
    );
  });

  it('hides the re-upload target once nothing is skipped', async () => {
    const onImport = vi.fn<(csv: string) => Promise<ImportResult>>().mockResolvedValue({
      created: 1,
      skipped: 0,
      results: [{ row: 2, name: 'Foo', status: 'created' }],
    });

    const u = userEvent.setup();
    const { container } = renderPanel(onImport);

    await u.upload(fileInputs(container)[0], csvFile());

    // The import finished (summary present) but, with nothing skipped, neither
    // the re-upload drop target nor its file input is rendered.
    expect(await screen.findByText('1 created')).toBeInTheDocument();
    expect(
      screen.queryByText(/Fixed the skipped rows\? Drop the corrected CSV here to re-import/i),
    ).not.toBeInTheDocument();
    expect(fileInputs(container)).toHaveLength(1);
  });
});
