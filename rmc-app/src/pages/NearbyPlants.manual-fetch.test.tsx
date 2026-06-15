import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// react-leaflet is unhappy in jsdom; NearbyPlants imports it at module load,
// so stub the map primitives. This test exercises the manual-fallback wiring
// (handleManualChange), not the map.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: () => {}, getZoom: () => 12, fitBounds: () => {} }),
}));

vi.mock('wouter', () => ({ useLocation: () => ['/nearby', vi.fn()] }));

// Replace the picker with a tiny stub that fires onChange when clicked, so we
// can assert that selecting any manual location triggers the nearby fetch
// without rendering the real (map-bound) picker.
vi.mock('@/components/LocationPicker', () => ({
  default: ({ onChange }: { onChange: (p: { lat: number; lng: number }) => void }) => (
    <button onClick={() => onChange({ lat: 19.1, lng: 72.9 })}>pick-manual-location</button>
  ),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import NearbyPlants from '@/pages/NearbyPlants';
import { api, type User } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';

const CUSTOMER = { id: 7, name: 'Ravi', email: 'ravi@site.com', role: 'customer' } as User;

// Force the geolocation prompt to fail so the page drops into the manual
// fallback (geoerror) phase where the LocationPicker is shown.
function denyGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback) =>
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError),
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
  denyGeolocation();
});

describe('NearbyPlants — manual location auto-fetches nearby plants', () => {
  it('fetches nearby plants immediately when a manual location is picked', async () => {
    vi.mocked(api.get).mockResolvedValue([] as never);
    const u = userEvent.setup();
    renderPage();

    // The page lands in the manual fallback after geolocation is denied.
    await screen.findByText(/enter site address manually/i);
    // No nearby fetch has happened yet — geolocation never resolved.
    expect(vi.mocked(api.get).mock.calls.some(c => String(c[0]).startsWith('/plants/nearby'))).toBe(false);

    // Picking a location triggers the fetch with no extra button press.
    await u.click(screen.getByText('pick-manual-location'));

    await waitFor(() =>
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(
        expect.stringMatching(/^\/plants\/nearby\?lat=19\.1&lng=72\.9/),
      ),
    );
  });
});
