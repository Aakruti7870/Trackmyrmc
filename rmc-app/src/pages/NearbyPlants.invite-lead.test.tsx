import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// react-leaflet is heavy and unhappy in jsdom (it expects a real layout/canvas),
// and NearbyPlants imports it at module load. The "Request this plant" flow lives
// entirely in the list view, so stub the map primitives out to harmless markup.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: () => {}, getZoom: () => 12, fitBounds: () => {} }),
}));

// Capture wouter navigation so the logged-out redirect is observable.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('wouter', () => ({ useLocation: () => ['/nearby', navigateMock] }));

// Mock the api module but keep the real ApiError so error surfacing is realistic.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import NearbyPlants, { type DiscoveredPlant } from '@/pages/NearbyPlants';
import { api, ApiError, type User } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';

const LEAD: DiscoveredPlant = {
  placeId: 'place-123',
  name: 'Sunrise Concrete Works',
  address: '12 Industrial Rd, Pune',
  latitude: 18.55,
  longitude: 73.9,
  contactNumber: '+91 90000 00000',
  openNow: true,
  distanceKm: 6.2,
  source: 'discovered',
};

const CUSTOMER: User = {
  id: 7, name: 'Ravi Customer', email: 'ravi@site.com', role: 'customer',
} as User;

function mockReads() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    // No onboarded partner plants nearby — only a live-discovered lead.
    if (path.startsWith('/plants/nearby')) return Promise.resolve([] as never);
    if (path.startsWith('/plants/discover')) return Promise.resolve([LEAD] as never);
    return Promise.resolve([] as never);
  });
}

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

function renderPage(user: User | null) {
  const ctx: AuthCtx = {
    user,
    loading: false,
    login: async () => {},
    logout: () => {},
    updateUser: () => {},
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
  mockReads();
});

describe('NearbyPlants — Request this plant (lead invite)', () => {
  it('posts to /plants/invite and shows the done state for a logged-in customer', async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);
    const u = userEvent.setup();
    renderPage(CUSTOMER);

    // The discovered lead renders with its request CTA once discovery resolves.
    const btn = await screen.findByRole('button', { name: /request this plant/i });
    await u.click(btn);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/plants/invite', {
        placeId: LEAD.placeId,
        name: LEAD.name,
        address: LEAD.address,
        latitude: LEAD.latitude,
        longitude: LEAD.longitude,
        contactNumber: LEAD.contactNumber,
      }),
    );

    // The button flips to the confirmed "done" state.
    expect(await screen.findByText(/we've recorded your request/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request this plant/i })).not.toBeInTheDocument();
  });

  it('shows an inline error and keeps the button when the invite fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError('Could not send your request.', 500, {}));
    const u = userEvent.setup();
    renderPage(CUSTOMER);

    const btn = await screen.findByRole('button', { name: /request this plant/i });
    await u.click(btn);

    expect(await screen.findByText('Could not send your request.')).toBeInTheDocument();
    // The CTA stays available so the customer can retry.
    expect(screen.getByRole('button', { name: /request this plant/i })).toBeInTheDocument();
  });

  it('routes a logged-out visitor to /register instead of posting', async () => {
    const u = userEvent.setup();
    renderPage(null);

    const btn = await screen.findByRole('button', { name: /request this plant/i });
    await u.click(btn);

    expect(navigateMock).toHaveBeenCalledWith('/register');
    expect(api.post).not.toHaveBeenCalled();
  });
});
