import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// SSE isn't relevant to the duplicate-warning behaviour — stub it inert.
vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({ status: 'connected' as const, reconnect: () => {}, subscribe: () => () => {} }),
}));

// LocationPicker pulls in Leaflet (unhappy in jsdom). Replace it with a button
// that drops a fixed pin, which is all the debounced near-duplicate check needs
// to fire: moving the pin updates form.latitude/longitude.
vi.mock('@/components/LocationPicker', () => ({
  default: ({ onChange }: { onChange: (p: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: 19.07, lng: 72.87 })}>drop-pin</button>
  ),
}));

// Mock the api module but keep the real ApiError so error handling is realistic.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import Plants from '@/pages/Plants';
import { api } from '@/lib/api';

type Nearby = { id: number; name: string; city: string | null; distanceKm: number };

function makePlant(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 99, name: 'Existing RMC', legalName: null, gstNo: null, email: null,
    address: null, city: 'Mumbai', contactNumber: null,
    latitude: '19.0700000', longitude: '72.8700000',
    plantStatus: 'pending', isActive: true, locationVerified: false, verified: false,
    deliveryRadiusKm: 25, grades: [], openTime: '06:00', closeTime: '20:00', ownerCount: 0,
    ...over,
  };
}

// Wire api.get: /plants and /plants/invites are list loads; /plants/nearby is
// the duplicate lookup whose behaviour each test controls via `nearby`.
function mockApi(opts: { plants?: unknown[]; nearby?: () => Promise<Nearby[]> } = {}) {
  const nearby = opts.nearby ?? (() => Promise.resolve([]));
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/plants/nearby')) return nearby() as never;
    if (path === '/plants') return Promise.resolve((opts.plants ?? []) as never);
    if (path === '/plants/invites') return Promise.resolve([] as never);
    return Promise.resolve([] as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Plants — inline duplicate-plant warning', () => {
  it('shows the warning card (name, city, distance) after the debounced lookup', async () => {
    const u = userEvent.setup();
    mockApi({ nearby: () => Promise.resolve([{ id: 5, name: 'Acme RMC', city: 'Pune', distanceKm: 0.12 }]) });
    render(<Plants />);

    await u.click(await screen.findByRole('button', { name: /Add Plant/i }));
    await u.click(screen.getByText('drop-pin'));

    // Debounced (500ms) lookup against /plants/nearby with the 0.3km radius.
    const dismiss = await screen.findByLabelText('Dismiss warning', {}, { timeout: 3000 });
    const card = dismiss.closest('div')!;
    expect(card).toHaveTextContent('Another verified plant');
    expect(card).toHaveTextContent('Acme RMC');
    expect(card).toHaveTextContent('Pune');
    expect(card).toHaveTextContent('0.12 km');

    const nearbyCall = vi.mocked(api.get).mock.calls.find(([p]) => (p as string).startsWith('/plants/nearby'));
    expect(nearbyCall?.[0]).toContain('radius=0.3');
  });

  it('lets the user dismiss the warning', async () => {
    const u = userEvent.setup();
    mockApi({ nearby: () => Promise.resolve([{ id: 5, name: 'Acme RMC', city: 'Pune', distanceKm: 0.12 }]) });
    render(<Plants />);

    await u.click(await screen.findByRole('button', { name: /Add Plant/i }));
    await u.click(screen.getByText('drop-pin'));

    const dismiss = await screen.findByLabelText('Dismiss warning', {}, { timeout: 3000 });
    await u.click(dismiss);
    expect(screen.queryByLabelText('Dismiss warning')).not.toBeInTheDocument();
    expect(screen.queryByText('Another verified plant', { exact: false })).not.toBeInTheDocument();
  });

  it('excludes the plant being edited from its own near-duplicate results', async () => {
    const u = userEvent.setup();
    // The only nearby hit is the edited plant itself (id 99) — it must be filtered
    // out so a plant never flags itself.
    mockApi({
      plants: [makePlant({ id: 99 })],
      nearby: () => Promise.resolve([{ id: 99, name: 'Existing RMC', city: 'Mumbai', distanceKm: 0.0 }]),
    });
    const { container } = render(<Plants />);

    // Open the edit form for the existing plant (pencil icon button).
    await screen.findByText('Existing RMC');
    const pencil = container.querySelector('.lucide-pencil')!.closest('button')!;
    await u.click(pencil);

    // The form opens with the plant's coords already set, so the lookup fires
    // immediately. Wait for it, then confirm no warning surfaced.
    await waitFor(
      () => expect(vi.mocked(api.get).mock.calls.some(([p]) => (p as string).startsWith('/plants/nearby'))).toBe(true),
      { timeout: 3000 },
    );
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByLabelText('Dismiss warning')).not.toBeInTheDocument();
  });

  it('shows no warning when the lookup returns nothing', async () => {
    const u = userEvent.setup();
    mockApi({ nearby: () => Promise.resolve([]) });
    render(<Plants />);

    await u.click(await screen.findByRole('button', { name: /Add Plant/i }));
    await u.click(screen.getByText('drop-pin'));

    await waitFor(
      () => expect(vi.mocked(api.get).mock.calls.some(([p]) => (p as string).startsWith('/plants/nearby'))).toBe(true),
      { timeout: 3000 },
    );
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByLabelText('Dismiss warning')).not.toBeInTheDocument();
  });

  it('never blocks the form when the lookup fails', async () => {
    const u = userEvent.setup();
    mockApi({ nearby: () => Promise.reject(new Error('boom')) });
    vi.mocked(api.post).mockResolvedValue({ id: 1 } as never);
    render(<Plants />);

    await u.click(await screen.findByRole('button', { name: /Add Plant/i }));
    await u.click(screen.getByText('drop-pin'));

    // A rejected lookup must never surface a warning…
    await waitFor(
      () => expect(vi.mocked(api.get).mock.calls.some(([p]) => (p as string).startsWith('/plants/nearby'))).toBe(true),
      { timeout: 3000 },
    );
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByLabelText('Dismiss warning')).not.toBeInTheDocument();

    // …and the form still saves normally (name + dropped pin satisfy validation).
    const nameInput = screen.getAllByRole('textbox')[0];
    await u.type(nameInput, 'Brand New Plant');
    // Exact (case-sensitive) match hits only the form's submit button ("Add
    // plant"), not the page header's "Add Plant" trigger.
    await u.click(screen.getByRole('button', { name: 'Add plant' }));

    await waitFor(() => expect(vi.mocked(api.post)).toHaveBeenCalledWith('/plants', expect.objectContaining({ name: 'Brand New Plant' })));
  });
});
