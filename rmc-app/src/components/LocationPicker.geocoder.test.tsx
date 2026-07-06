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
  it('jumps to the best match immediately and lists alternatives to correct an ambiguous search', async () => {
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

    // Searching drops the pin on the best match straight away — no extra tap…
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 18.5204, lng: 73.8567 }));
    // …while still offering the ambiguous alternatives to correct with one tap.
    const nagpur = await screen.findByText('Springfield, Nagpur, Maharashtra');
    expect(screen.getByText('Springfield, Pune, Maharashtra')).toBeInTheDocument();

    // Picking a different match applies exactly that coordinate and clears the list.
    await userEvent.setup().click(nagpur);
    expect(onChange).toHaveBeenLastCalledWith({ lat: 21.1458, lng: 79.0882 });
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

describe('LocationPicker — automatic address → pin', () => {
  it('geocodes the typed delivery address and drops the pin automatically', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [geoResult('12.9716', '77.5946', 'MG Road, Bengaluru')],
    }));
    const onChange = vi.fn();
    // Mount with no address, then simulate the customer filling in the form's
    // address field — the initial address is deliberately NOT re-geocoded, only
    // subsequent changes trigger the auto-pin.
    const { rerender } = render(<LocationPicker value={null} onChange={onChange} />);
    rerender(<LocationPicker value={null} onChange={onChange} address="MG Road, Bengaluru" />);

    await waitFor(
      () => expect(onChange).toHaveBeenCalledWith({ lat: 12.9716, lng: 77.5946 }),
      { timeout: 2000 },
    );
  });

  it('stops following the address once the customer adjusts the pin manually', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [geoResult('19.0760', '72.8777', 'Gateway of India, Mumbai')],
    }));
    const onChange = vi.fn();
    const { rerender } = render(<LocationPicker value={null} onChange={onChange} />);

    // A manual search is an explicit action → it must freeze the auto-follow.
    await runSearch('Gateway');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 19.076, lng: 72.8777 }));
    onChange.mockClear();

    // Now the customer keeps editing the address text — the pin must NOT move.
    rerender(<LocationPicker value={{ lat: 19.076, lng: 72.8777 }} onChange={onChange} address="Some Other Road, Pune" />);
    await new Promise(r => setTimeout(r, 1000));
    expect(onChange).not.toHaveBeenCalled();
  });
});
