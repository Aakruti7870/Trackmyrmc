import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// react-leaflet needs a real layout/canvas; NearbyPlants imports it at module
// load, so stub the map primitives. These tests exercise the remembered-location
// bootstrap (localStorage), not the map.
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
import { api, type User } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';

const PLANT: NearbyPlant = {
  id: 1, name: 'CoreMix Pune', address: '5 Plant Rd', city: 'Pune',
  contactNumber: '+91 90000 11111', latitude: 18.55, longitude: 73.9,
  deliveryRadiusKm: 20, grades: ['M25'], openTime: '08:00', closeTime: '20:00',
  openNow: true, distanceKm: 4.1,
};

const CUSTOMER = { id: 7, name: 'Ravi', email: 'ravi@site.com', role: 'customer' } as User;

const getCurrentPosition = vi.fn((success: PositionCallback) =>
  success({ coords: { latitude: 18.52, longitude: 73.85 } } as GeolocationPosition),
);

function mockGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
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
  localStorage.clear();
  mockGeolocation();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/plants/nearby')) return Promise.resolve([PLANT] as never);
    return Promise.resolve([] as never);
  });
});

describe('NearbyPlants — remembering location & radius', () => {
  it('prompts for GPS on a first visit (nothing saved)', async () => {
    renderPage();

    expect(await screen.findByText('CoreMix Pune')).toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalled();
    // Default radius is shown for a fresh visitor.
    expect(screen.getByText(/within 100 km of your site/i)).toBeInTheDocument();
  });

  it('persists the confirmed location and radius after loading', async () => {
    renderPage();
    await screen.findByText('CoreMix Pune');

    await waitFor(() => expect(localStorage.getItem('rmc_nearby_location')).toBeTruthy());
    const saved = JSON.parse(localStorage.getItem('rmc_nearby_location')!);
    expect(saved).toMatchObject({ lat: 18.52, lng: 73.85, radius: 100 });
  });

  it('loads the remembered location instantly without re-prompting for GPS', async () => {
    localStorage.setItem('rmc_nearby_location', JSON.stringify({ lat: 19.07, lng: 72.87, radius: 150 }));
    renderPage();

    expect(await screen.findByText('CoreMix Pune')).toBeInTheDocument();
    // Returning visitor is NOT re-prompted for location.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    // The remembered radius drives the header copy and the backend query.
    expect(screen.getByText(/within 150 km of your site/i)).toBeInTheDocument();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(
      expect.stringContaining('/plants/nearby?lat=19.07&lng=72.87&radius=150'),
    );
  });

  it('ignores a stale radius that is no longer offered, keeping the saved coords', async () => {
    localStorage.setItem('rmc_nearby_location', JSON.stringify({ lat: 19.07, lng: 72.87, radius: 999 }));
    renderPage();

    expect(await screen.findByText('CoreMix Pune')).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    // Bad radius falls back to the default, coords still honoured.
    expect(screen.getByText(/within 100 km of your site/i)).toBeInTheDocument();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(
      expect.stringContaining('/plants/nearby?lat=19.07&lng=72.87&radius=100'),
    );
  });

  it('falls back to the GPS prompt when the saved value is corrupt', async () => {
    localStorage.setItem('rmc_nearby_location', '{not json');
    renderPage();

    expect(await screen.findByText('CoreMix Pune')).toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalled();
  });
});
