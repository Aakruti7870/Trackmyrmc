import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// A logged-in client so Layout uses customer-friendly notification copy.
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Acme', email: 'client@test.com', role: 'client' },
    logout: () => {},
  }),
}));

import Layout from '@/components/Layout';
import { ToastProvider } from '@/lib/toast-provider';
import { ThemeProvider } from '@/lib/theme-providers';

function renderLayout() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <Layout><div>content</div></Layout>
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => { handlers.clear(); });

describe('Layout customer-friendly notifications', () => {
  it('says a delivery is on the way when a challan is created', () => {
    renderLayout();
    emit('challan.created', { challanNo: 'CH-1001' });
    expect(screen.getByText(/Delivery CH-1001 is on the way/i)).toBeInTheDocument();
  });

  it('says a delivery has arrived when a challan is delivered', () => {
    renderLayout();
    emit('challan.updated', { challanNo: 'CH-2002', status: 'delivered' });
    expect(screen.getByText(/Delivery CH-2002 has arrived/i)).toBeInTheDocument();
  });
});
