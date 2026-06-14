import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Drive the live unread badge by faking the SSE channel: subscribe() registers
// into a local handler map and emit() fires a `plant.invite` event the same way
// the server stream would, all inside act() so React flushes the state update.
type Handler = (data: unknown) => void;
const handlers = new Map<string, Set<Handler>>();
function emit(event: string, data: unknown) {
  act(() => { handlers.get(event)?.forEach(h => h(data)); });
}

vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({
    status: 'connected' as const,
    reconnect: () => {},
    subscribe: (event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => { handlers.get(event)?.delete(handler); };
    },
  }),
}));

// LocationPicker pulls in Leaflet, which is unhappy in jsdom and isn't needed
// for the tab/badge behaviour under test — stub it to harmless markup.
vi.mock('@/components/LocationPicker', () => ({ default: () => null }));

// Mock the api module but keep the real ApiError so error handling is realistic.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import Plants from '@/pages/Plants';
import { api } from '@/lib/api';

function mockApi() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/plants') return Promise.resolve([] as never);
    if (path === '/plants/invites') return Promise.resolve([] as never);
    return Promise.resolve([] as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  mockApi();
});

describe('Plants — live unread badge on the Onboarding requests tab', () => {
  it('lights up the badge with the running count when requests stream in on another tab', async () => {
    render(<Plants />);

    // Wait for the page to finish loading so the tab bar renders. The default
    // tab is "Leads", so the admin is NOT looking at onboarding requests.
    await screen.findByRole('button', { name: /Onboarding requests/i });
    expect(screen.queryByTitle(/new request/i)).not.toBeInTheDocument();

    // First request streams in while away — the unread badge appears at 1.
    emit('plant.invite', { id: 1 });
    expect(await screen.findByTitle('1 new request')).toHaveTextContent('1');

    // A second one increments the running count.
    emit('plant.invite', { id: 2 });
    expect(await screen.findByTitle('2 new requests')).toHaveTextContent('2');
  });

  it('clears the badge when the Onboarding requests tab is opened', async () => {
    const u = userEvent.setup();
    render(<Plants />);

    const tabBtn = await screen.findByRole('button', { name: /Onboarding requests/i });

    emit('plant.invite', { id: 1 });
    expect(await screen.findByTitle('1 new request')).toBeInTheDocument();

    // Opening the tab acknowledges everything that arrived while away.
    await u.click(tabBtn);
    expect(screen.queryByTitle(/new request/i)).not.toBeInTheDocument();
  });

  it('does not increment the badge when already viewing the Onboarding requests tab', async () => {
    const u = userEvent.setup();
    render(<Plants />);

    const tabBtn = await screen.findByRole('button', { name: /Onboarding requests/i });
    await u.click(tabBtn);

    // A request arriving while the tab is already open is seen immediately, so
    // no unread marker should ever appear.
    emit('plant.invite', { id: 1 });
    // Flush the refetch that the event triggers so its state update settles.
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTitle(/new request/i)).not.toBeInTheDocument();
  });
});
