import { renderHook, act } from '@testing-library/react';
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

import { formatNotification, useNotificationFeed } from '@/lib/notifications';

const KEY = 'test-notif-feed';

beforeEach(() => {
  handlers.clear();
  localStorage.clear();
});

describe('formatNotification', () => {
  it('uses customer copy for clients and staff copy otherwise', () => {
    expect(formatNotification('challan.created', { challanNo: 'CH-1' }, true)?.message).toMatch(/on the way/i);
    expect(formatNotification('challan.created', { challanNo: 'CH-1' }, false)?.message).toMatch(/created/i);
  });

  it('only surfaces delivered challan updates', () => {
    expect(formatNotification('challan.updated', { challanNo: 'CH-1', status: 'dispatched' }, true)).toBeNull();
    expect(formatNotification('challan.updated', { challanNo: 'CH-1', status: 'delivered' }, true)?.type).toBe('success');
  });

  it('returns null for malformed events', () => {
    expect(formatNotification('order.updated', {}, true)).toBeNull();
    expect(formatNotification('challan.created', {}, true)).toBeNull();
  });
});

describe('useNotificationFeed', () => {
  it('captures SSE events into a feed with an unread count', () => {
    const { result } = renderHook(() => useNotificationFeed(true, KEY));
    expect(result.current.notifications).toHaveLength(0);

    emit('challan.created', { challanNo: 'CH-100' });
    emit('order.updated', { orderNo: 'ORD-001', status: 'in_progress' });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.notifications[0].message).toMatch(/ORD-001/);
  });

  it('marks all as read and clears the feed', () => {
    const { result } = renderHook(() => useNotificationFeed(true, KEY));
    emit('challan.created', { challanNo: 'CH-200' });
    expect(result.current.unreadCount).toBe(1);

    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);

    act(() => result.current.clearAll());
    expect(result.current.notifications).toHaveLength(0);
  });

  it('persists the feed to localStorage and restores it', () => {
    const first = renderHook(() => useNotificationFeed(true, KEY));
    emit('challan.created', { challanNo: 'CH-300' });
    expect(first.result.current.notifications).toHaveLength(1);

    const restored = renderHook(() => useNotificationFeed(true, KEY));
    expect(restored.result.current.notifications).toHaveLength(1);
    expect(restored.result.current.notifications[0].message).toMatch(/CH-300/);
  });

  it('ignores events that do not produce a notification', () => {
    const { result } = renderHook(() => useNotificationFeed(true, KEY));
    emit('challan.updated', { challanNo: 'CH-400', status: 'dispatched' });
    expect(result.current.notifications).toHaveLength(0);
  });
});
