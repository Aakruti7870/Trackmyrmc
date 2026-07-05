import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// LiveDeliveryMap pulls in the Leaflet/Google compat layer which is unhappy in
// jsdom; stub it so these tests exercise the tracker's real data logic (polling
// /positions, ON ROAD count, empty state) rather than the map internals.
vi.mock('@/components/LiveDeliveryMap', () => ({
  default: ({ markers }: { markers: unknown[] }) => (
    <div data-testid="live-map">{markers.length} markers</div>
  ),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

import LiveGPSTracker from '@/components/LiveGPSTracker';
import { api, type LivePosition } from '@/lib/api';

function pos(over: Partial<LivePosition>): LivePosition {
  return {
    challanId: 1,
    challanNo: 'CH-1',
    vehicleNo: 'MH12AB1234',
    driverName: 'Ravi',
    siteName: 'Baner Site',
    lat: 18.55,
    lng: 73.9,
    speed: 32,
    distanceM: 4200,
    status: 'dispatched',
    ...over,
  } as unknown as LivePosition;
}

describe('LiveGPSTracker', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('renders the real map and live count when positions exist', async () => {
    vi.mocked(api.get).mockResolvedValue([
      pos({ challanId: 1, vehicleNo: 'MH12AB1234' }),
      pos({ challanId: 2, vehicleNo: 'MH14CD5678', driverName: 'Sunil' }),
    ]);

    render(<LiveGPSTracker />);

    await waitFor(() => expect(screen.getByTestId('live-map')).toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith('/positions');
    expect(screen.getByText('2 ON ROAD')).toBeInTheDocument();
    expect(screen.getByTestId('live-map')).toHaveTextContent('2 markers');
    // MH12AB1234 is auto-selected so it shows in both the list and detail footer.
    expect(screen.getAllByText('MH12AB1234').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('MH14CD5678')).toBeInTheDocument();
  });

  it('shows the empty state and no map when nothing is transmitting', async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    render(<LiveGPSTracker />);

    await waitFor(() => expect(screen.getByText('0 ON ROAD')).toBeInTheDocument());
    expect(screen.getByText('No vehicles transmitting')).toBeInTheDocument();
    expect(screen.queryByTestId('live-map')).not.toBeInTheDocument();
  });
});
