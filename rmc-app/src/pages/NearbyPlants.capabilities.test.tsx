import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: () => {}, getZoom: () => 12, fitBounds: () => {} }),
}));

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('wouter', () => ({ useLocation: () => ['/nearby-plants', navigateMock] }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import NearbyPlants, { type NearbyPlant } from '@/pages/NearbyPlants';
import { api, type User } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';

const CUSTOMER = { id: 7, name: 'Ravi', email: 'ravi@example.com', role: 'customer' } as User;
const PLANT: NearbyPlant = {
  id: 21,
  name: 'AAKRUTI INFRA RMC PLANT',
  address: 'Karanjade',
  city: 'Panvel',
  contactNumber: null,
  latitude: 18.98,
  longitude: 73.11,
  deliveryRadiusKm: 40,
  grades: ['M25', 'M30'],
  openTime: '07:00',
  closeTime: '22:00',
  openNow: true,
  distanceKm: 4.2,
  showGlowingEffect: true,
  capabilities: {
    numberOfTransitMixers: 21,
    productionCapacityM3PerHour: '53.00',
    laboratoryAvailable: true,
    inhouseConcretePumpAvailable: true,
    supportingPlantAvailable: true,
    dieselGeneratorAvailable: true,
  },
};

function renderPage() {
  const context: AuthCtx = {
    user: CUSTOMER,
    loading: false,
    login: async () => ({} as User),
    logout: () => {},
    updateUser: () => {},
  };
  return render(<AuthContext.Provider value={context}><NearbyPlants /></AuthContext.Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: vi.fn((success: PositionCallback) => success({ coords: { latitude: 18.98, longitude: 73.11 } } as GeolocationPosition)) },
  });
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/plants/nearby')) return Promise.resolve({ plants: [PLANT], count: 1 } as never);
    return Promise.resolve([] as never);
  });
});

describe('NearbyPlants capability card', () => {
  it('shows TM, capacity and verified capability badges without adding a new paid-placement label', async () => {
    renderPage();
    expect(await screen.findByText('AAKRUTI INFRA RMC PLANT')).toBeInTheDocument();
    expect(screen.getByText('TM 21')).toBeInTheDocument();
    expect(screen.getByText('53.00 m³/hr')).toBeInTheDocument();
    expect(screen.getByText('Lab')).toBeInTheDocument();
    expect(screen.getByText('Pump')).toBeInTheDocument();
    expect(screen.getByText('Backup Plant')).toBeInTheDocument();
    expect(screen.getByText('DG')).toBeInTheDocument();
    expect(screen.queryByText(/sponsored/i)).not.toBeInTheDocument();
  });

  it('applies glow only when the backend flag is true and includes reduced-motion protection', async () => {
    const { container } = renderPage();
    await screen.findByText('AAKRUTI INFRA RMC PLANT');
    expect(container.querySelector('.np-paid-glow')).toBeTruthy();
    expect(container.textContent).toContain('@media(prefers-reduced-motion:reduce)');
  });

  it('opens the correct About Plant route', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /^About Plant$/i }));
    expect(navigateMock).toHaveBeenCalledWith('/plants/21/about');
  });

  it('hides missing capability badges instead of showing misleading zeros', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.startsWith('/plants/nearby')) return Promise.resolve({ plants: [{ ...PLANT, showGlowingEffect: false, capabilities: null }], count: 1 } as never);
      return Promise.resolve([] as never);
    });
    const { container } = renderPage();
    await screen.findByText('AAKRUTI INFRA RMC PLANT');
    expect(screen.queryByText('TM 21')).not.toBeInTheDocument();
    expect(container.querySelector('.np-paid-glow')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /^About Plant$/i })).toBeInTheDocument());
  });
});
