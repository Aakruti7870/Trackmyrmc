import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// react-leaflet expects a real layout/canvas and is unhappy in jsdom; NearbyPlants
// imports it at module load, so stub the map primitives. These tests exercise the
// list-view messaging (discovery failure + radius dead-end), not the map.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: () => {}, getZoom: () => 12, fitBounds: () => {} }),
}));

vi.mock('wouter', () => ({ useLocation: () => ['/nearby', vi.fn()] }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import NearbyPlants, { type NearbyPlant } from '@/pages/NearbyPlants';
import { api, ApiError, type User } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';

const PLANT: NearbyPlant = {
  id: 1, name: 'CoreMix Pune', address: '5 Plant Rd', city: 'Pune',
  contactNumber: '+91 90000 11111', latitude: 18.55, longitude: 73.9,
  deliveryRadiusKm: 20, grades: ['M25'], openTime: '08:00', closeTime: '20:00',
  openNow: true, distanceKm: 4.1,
};

const CUSTOMER = { id: 7, name: 'Ravi', email: 'ravi@site.com', role: 'customer' } as User;

function mockGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) =>
        success({ coords: { latitude: 18.52, longitude: 73.85 } } as GeolocationPosition),
      ),
    },
  });
}

function renderPage() {
  const ctx: AuthCtx = {
    user: CUSTOMER, loading: false,
    login: async () => ({} as User), logout: () => {}, updateUser: () => {},
  };
  return render(
    <AuthContext.Provider value={ctx}>
      <NearbyPlants />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGeolocation();
});

describe('NearbyPlants — discovery failure surfacing', () => {
  it('shows a friendly message when live discovery errors, while still listing partner plants', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.startsWith('/plants/nearby')) return Promise.resolve([PLANT] as never);
      if (path.startsWith('/plants/discover')) return Promise.reject(new ApiError('boom', 502, {}));
      return Promise.resolve([] as never);
    });
    renderPage();

    // Partner plant still renders.
    expect(await screen.findByText('CoreMix Pune')).toBeInTheDocument();
    // Discovery failure is surfaced, not swallowed into an empty list.
    expect(await screen.findByText(/couldn’t search the wider map directory/i)).toBeInTheDocument();
  });

  it('shows the "not available" message when discovery is unconfigured (503)', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.startsWith('/plants/nearby')) return Promise.resolve([PLANT] as never);
      if (path.startsWith('/plants/discover')) return Promise.reject(new ApiError('nope', 503, {}));
      return Promise.resolve([] as never);
    });
    renderPage();

    expect(await screen.findByText(/live map search isn’t available right now/i)).toBeInTheDocument();
  });
});

describe('NearbyPlants — radius dead-end guidance', () => {
  it('offers to widen to the next radius when nothing is found below the max', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.startsWith('/plants/nearby')) return Promise.resolve([] as never);
      if (path.startsWith('/plants/discover')) return Promise.resolve([] as never);
      return Promise.resolve([] as never);
    });
    renderPage();

    // Default radius is 100km; the next option is 150km.
    expect(await screen.findByText(/no approved partner plants within 100 km/i)).toBeInTheDocument();
    expect(screen.getByText(/we search up to 250 km/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /widen to 150 km/i })).toBeInTheDocument();
  });

  it('explains the ceiling and hides the widen button once at the maximum radius', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.startsWith('/plants/nearby')) return Promise.resolve([] as never);
      if (path.startsWith('/plants/discover')) return Promise.resolve([] as never);
      return Promise.resolve([] as never);
    });
    const u = userEvent.setup();
    renderPage();

    // Widen from 100 -> 150 -> 250 to reach the ceiling.
    await u.click(await screen.findByRole('button', { name: /widen to 150 km/i }));
    await u.click(await screen.findByRole('button', { name: /widen to 250 km/i }));

    await waitFor(() =>
      expect(screen.getByText(/that’s the widest area we can search \(250 km\)/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /widen to/i })).not.toBeInTheDocument();
  });
});
