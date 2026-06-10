import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import MyTrips from '@/pages/MyTrips';
import { api, type Challan, type PositionUpdateResult } from '@/lib/api';

function makeChallan(over: Partial<Challan> = {}): Challan {
  return {
    id: 1,
    challanNo: 'CH-001',
    clientId: 5,
    grade: 'M25',
    quantity: '8.00',
    pumpRequired: false,
    status: 'dispatched',
    createdAt: '2026-06-10T06:00:00.000Z',
    dispatchTime: '2026-06-10T07:00:00.000Z',
    clientName: 'Skyline Builders',
    vehicleNo: 'GJ01AB1234',
    siteName: 'Sector 7 Site',
    siteLat: '23.0225',
    siteLng: '72.5714',
    ...over,
  };
}

function mockTrips(rows: Challan[]) {
  vi.mocked(api.get).mockResolvedValue(rows as never);
}

function posResult(over: Partial<PositionUpdateResult> = {}): PositionUpdateResult {
  return { ok: true, distanceM: 12, delivered: false, withinRadius: true, inRadiusCount: 1, ...over };
}

// Capture the geolocation success callback so the test can deterministically
// feed a GPS fix and drive the auto-delivery polling without real timers.
let geoSuccess: ((pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) | null = null;
const watchPosition = vi.fn();
const clearWatch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  geoSuccess = null;
  watchPosition.mockImplementation((success: typeof geoSuccess) => {
    geoSuccess = success;
    return 7;
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch },
    configurable: true,
  });
});

afterEach(() => {
  delete (navigator as unknown as { geolocation?: unknown }).geolocation;
});

async function startTracking(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Start tracking/i }));
}

async function sendFix(lat = 23.0225, lng = 72.5714, accuracy = 8) {
  await act(async () => {
    geoSuccess?.({ coords: { latitude: lat, longitude: lng, accuracy } });
    await Promise.resolve();
  });
}

describe('MyTrips live GPS auto-delivery', () => {
  it('auto-completes the trip and shows a confirmation when the server reports delivered', async () => {
    mockTrips([makeChallan({ id: 42, challanNo: 'CH-042' })]);
    vi.mocked(api.post).mockResolvedValue(
      posResult({ delivered: true, distanceM: 10, inRadiusCount: 3 }) as never,
    );
    const user = userEvent.setup();
    render(<MyTrips />);

    await startTracking(user);
    expect(watchPosition).toHaveBeenCalledTimes(1);

    await sendFix();

    // Position was posted for the active trip.
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/positions',
        expect.objectContaining({ challanId: 42 }),
      );
    });

    // Confirmation message surfaces and the card flips to delivered.
    expect(await screen.findByText(/CH-042 auto-delivered on arrival/i)).toBeInTheDocument();
    expect(screen.getByText('delivered')).toBeInTheDocument();
    expect(screen.queryByText('dispatched')).not.toBeInTheDocument();
  });

  it('stops tracking automatically once no active trips remain', async () => {
    mockTrips([makeChallan({ id: 55, challanNo: 'CH-055' })]);
    vi.mocked(api.post).mockResolvedValue(
      posResult({ delivered: true, distanceM: 5, inRadiusCount: 3 }) as never,
    );
    const user = userEvent.setup();
    render(<MyTrips />);

    await startTracking(user);
    expect(await screen.findByRole('button', { name: /Stop tracking/i })).toBeInTheDocument();

    await sendFix();

    // The last active trip is delivered → tracking shuts itself off and the
    // geolocation watch is released.
    expect(await screen.findByRole('button', { name: /Start tracking/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Stop tracking/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(clearWatch).toHaveBeenCalledWith(7);
    });
  });
});
