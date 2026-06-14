import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// SSE isn't relevant to the onboarding-request actions under test — stub it so
// the subscribe() effect is a no-op and doesn't try to open a real stream.
vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({ status: 'connected' as const, reconnect: () => {}, subscribe: () => () => {} }),
}));

// LocationPicker pulls in Leaflet (unhappy in jsdom). Render its current value
// instead of the map so the test can assert the coords were prefilled.
vi.mock('@/components/LocationPicker', () => ({
  default: ({ value }: { value: { lat: number; lng: number } | null }) => (
    <div data-testid="loc-picker">{value ? `${value.lat},${value.lng}` : 'no-pin'}</div>
  ),
}));

// Mock the api module but keep the real ApiError so error handling is realistic.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import Plants from '@/pages/Plants';
import { api, ApiError } from '@/lib/api';

interface PlantInvite {
  id: number;
  placeId: string;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  contactNumber: string | null;
  requestCount: number;
  status: 'pending' | 'onboarded' | 'dismissed';
  firstRequestedByName: string | null;
  lastRequestedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

const PENDING: PlantInvite = {
  id: 42,
  placeId: 'place-abc',
  name: 'Sunrise Concrete Works',
  address: '12 Industrial Rd, Pune',
  latitude: '18.5500000',
  longitude: '73.9000000',
  contactNumber: '+91 90000 00000',
  requestCount: 3,
  status: 'pending',
  firstRequestedByName: 'Ravi',
  lastRequestedByName: 'Ravi',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

// Drive the invites list off a mutable array so loadInvites() reflects any
// status change the action wrote, exactly like a real refetch from the server.
let invitesState: PlantInvite[] = [];

function mockApi() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/plants') return Promise.resolve([] as never);
    if (path === '/plants/invites') return Promise.resolve(invitesState.map(i => ({ ...i })) as never);
    return Promise.resolve([] as never);
  });
}

// Open the Onboarding-requests tab and wait for the seeded invite to render.
async function openInvitesTab(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole('button', { name: /Onboarding requests/i }));
  await screen.findByText('Sunrise Concrete Works');
}

beforeEach(() => {
  vi.clearAllMocks();
  invitesState = [{ ...PENDING }];
  mockApi();
});

describe('Plants — onboarding-request actions', () => {
  it('prefills and opens the Add-Plant form from a request', async () => {
    const u = userEvent.setup();
    render(<Plants />);
    await openInvitesTab(u);

    await u.click(screen.getByRole('button', { name: /Add as plant/i }));

    // The Add-Plant form opens (not the edit form) prefilled with the request's
    // name, address, contact and dropped map pin.
    expect(await screen.findByRole('heading', { name: 'Add Plant' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sunrise Concrete Works')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12 Industrial Rd, Pune')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+91 90000 00000')).toBeInTheDocument();
    expect(screen.getByTestId('loc-picker')).toHaveTextContent('18.55,73.9');

    // No status change is written just by opening the prefilled form.
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('dismisses a pending request and refreshes the list', async () => {
    vi.mocked(api.patch).mockImplementation(async (_path, body) => {
      const { status } = body as { status: PlantInvite['status'] };
      invitesState = invitesState.map(i => (i.id === PENDING.id ? { ...i, status } : i));
      return {} as never;
    });
    const u = userEvent.setup();
    render(<Plants />);
    await openInvitesTab(u);

    await u.click(screen.getByRole('button', { name: /Dismiss/i }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/plants/invites/${PENDING.id}`, { status: 'dismissed' }),
    );
    // The refetched list now shows the dismissed state and offers a Restore action.
    expect(await screen.findByText('DISMISSED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dismiss/i })).not.toBeInTheDocument();
  });

  it('reopens a dismissed request back to the queue', async () => {
    invitesState = [{ ...PENDING, status: 'dismissed' }];
    vi.mocked(api.patch).mockImplementation(async (_path, body) => {
      const { status } = body as { status: PlantInvite['status'] };
      invitesState = invitesState.map(i => (i.id === PENDING.id ? { ...i, status } : i));
      return {} as never;
    });
    const u = userEvent.setup();
    render(<Plants />);
    await openInvitesTab(u);

    await u.click(screen.getByRole('button', { name: /Restore/i }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/plants/invites/${PENDING.id}`, { status: 'pending' }),
    );
    expect(await screen.findByText('PENDING')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
  });

  it('marks a request onboarded and hides the onboard action', async () => {
    vi.mocked(api.patch).mockImplementation(async (_path, body) => {
      const { status } = body as { status: PlantInvite['status'] };
      invitesState = invitesState.map(i => (i.id === PENDING.id ? { ...i, status } : i));
      return {} as never;
    });
    const u = userEvent.setup();
    render(<Plants />);
    await openInvitesTab(u);

    await u.click(screen.getByRole('button', { name: /Mark onboarded/i }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/plants/invites/${PENDING.id}`, { status: 'onboarded' }),
    );
    expect(await screen.findByText('ONBOARDED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark onboarded/i })).not.toBeInTheDocument();
  });

  it('shows an inline error when the status update fails', async () => {
    vi.mocked(api.patch).mockRejectedValue(new ApiError('Could not update the request.', 500, {}));
    const u = userEvent.setup();
    render(<Plants />);
    await openInvitesTab(u);

    await u.click(screen.getByRole('button', { name: /Dismiss/i }));

    expect(await screen.findByText('Could not update the request.')).toBeInTheDocument();
    // The request stays pending and the Dismiss action remains available to retry.
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
  });
});
