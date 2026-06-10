import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Handler = (data: unknown) => void;

const handlers = new Map<string, Set<Handler>>();

function emit(event: string, data: unknown) {
  act(() => {
    handlers.get(event)?.forEach(h => h(data));
  });
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

import Layout from '@/components/Layout';
import { ToastProvider } from '@/lib/toast-provider';
import { AuthProvider } from '@/lib/auth-provider';
import { ThemeProvider } from '@/lib/theme-providers';

function renderLayout() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Layout><div>content</div></Layout>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  handlers.clear();
});

describe('Layout live status-change toasts', () => {
  it('shows an info toast when a challan.created event arrives', () => {
    renderLayout();
    emit('challan.created', { challanNo: 'CH-1001' });
    expect(screen.getByText(/New challan CH-1001 created/i)).toBeInTheDocument();
  });

  it('shows a success toast when a challan.updated event is delivered', () => {
    renderLayout();
    emit('challan.updated', { challanNo: 'CH-2002', status: 'delivered' });
    expect(screen.getByText(/CH-2002 marked Delivered/i)).toBeInTheDocument();
  });

  it('does not show a toast for a non-delivered challan.updated event', () => {
    renderLayout();
    emit('challan.updated', { challanNo: 'CH-3003', status: 'in_transit' });
    expect(screen.queryByText(/CH-3003/)).not.toBeInTheDocument();
  });

  it('removes its SSE handlers when Layout unmounts', () => {
    const { unmount } = renderLayout();

    expect(handlers.get('challan.created')?.size ?? 0).toBeGreaterThan(0);
    expect(handlers.get('challan.updated')?.size ?? 0).toBeGreaterThan(0);

    unmount();

    expect(handlers.get('challan.created')?.size ?? 0).toBe(0);
    expect(handlers.get('challan.updated')?.size ?? 0).toBe(0);
  });

  it('does not show a toast after unmount when events are emitted', () => {
    const { unmount } = renderLayout();
    unmount();

    emit('challan.created', { challanNo: 'CH-4004' });
    emit('challan.updated', { challanNo: 'CH-5005', status: 'delivered' });

    expect(screen.queryByText(/CH-4004/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CH-5005/)).not.toBeInTheDocument();
  });
});
