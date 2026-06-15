import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// react-leaflet wants a real layout/canvas and is unhappy in jsdom; the picker
// imports the map primitives at module load, so stub them. These tests exercise
// the Nominatim geocoder behaviour (result list / single auto-apply / no match),
// not the map itself.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ setView: () => {}, getZoom: () => 12 }),
  useMapEvents: () => null,
}));

import LocationPicker from '@/components/LocationPicker';

function geoResult(lat: string, lon: string, display_name: string) {
  return { lat, lon, display_name };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function runSearch(term: string) {
  const u = userEvent.setup();
  await u.type(screen.getByPlaceholderText(/search address or landmark/i), term);
  await u.click(screen.getByTitle('Search'));
  return u;
}

describe('LocationPicker — geocoder result handling', () => {
  it('lists multiple matches and only applies the one the customer picks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        geoResult('18.5204', '73.8567', 'Springfield, Pune, Maharashtra'),
        geoResult('21.1458', '79.0882', 'Springfield, Nagpur, Maharashtra'),
      ],
    }));
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);

    await runSearch('Springfield');

    // Both ambiguous matches are offered; nothing is applied yet.
    const pune = await screen.findByText('Springfield, Pune, Maharashtra');
    expect(screen.getByText('Springfield, Nagpur, Maharashtra')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // Picking one applies exactly that coordinate and clears the list.
    await userEvent.setup().click(pune);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ lat: 18.5204, lng: 73.8567 });
    await waitFor(() =>
      expect(screen.queryByText('Springfield, Nagpur, Maharashtra')).not.toBeInTheDocument(),
    );
  });

  it('applies a single confident match directly without showing a list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [geoResult('19.0760', '72.8777', 'Gateway of India, Mumbai')],
    }));
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);

    await runSearch('Gateway of India');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 19.076, lng: 72.8777 }));
    // A lone hit applies straight away — no selectable list is rendered.
    expect(screen.queryByText('Gateway of India, Mumbai')).not.toBeInTheDocument();
  });

  it('shows a "No match found" note on an empty geocoder response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);

    await runSearch('asdkjhaskdjh');

    expect(await screen.findByText(/no match found/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
