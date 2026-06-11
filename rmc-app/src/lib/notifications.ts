import { useCallback, useEffect, useState } from 'react';
import { useSSE } from '@/lib/useSSE';

export interface AppNotification {
  id: string;
  message: string;
  type: 'info' | 'success';
  ts: number;
  read: boolean;
}

// Build a human notification from a raw SSE event, or null if the event should
// not surface. Shared by the toast layer and the persisted feed so both show the
// exact same wording.
export function formatNotification(
  event: 'challan.created' | 'challan.updated' | 'order.updated' | 'order.created',
  data: unknown,
  isClient: boolean,
): { message: string; type: 'info' | 'success' } | null {
  const d = data as { challanNo?: string; orderNo?: string; status?: string };
  if (event === 'challan.created') {
    if (!d?.challanNo) return null;
    return { message: isClient ? `Delivery ${d.challanNo} is on the way` : `New challan ${d.challanNo} created`, type: 'info' };
  }
  if (event === 'challan.updated') {
    if (!d?.challanNo || d.status !== 'delivered') return null;
    return { message: isClient ? `Delivery ${d.challanNo} has arrived` : `${d.challanNo} marked Delivered`, type: 'success' };
  }
  if (event === 'order.created') {
    if (!d?.orderNo) return null;
    return { message: `Order ${d.orderNo} placed`, type: 'info' };
  }
  if (event === 'order.updated') {
    if (!d?.orderNo || !d.status) return null;
    const label = d.status.replace(/[_-]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
    return { message: `Order ${d.orderNo} now ${label}`, type: d.status === 'completed' ? 'success' : 'info' };
  }
  return null;
}

const MAX_ITEMS = 50;

// A persistent notification feed fed by the live SSE stream. Keeps the most
// recent events (capped) in localStorage per user so the bell history survives
// navigation and reloads.
export function useNotificationFeed(isClient: boolean, storageKey: string) {
  const { subscribe } = useSSE();
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as AppNotification[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(notifications)); } catch { /* quota */ }
  }, [notifications, storageKey]);

  useEffect(() => {
    const add = (event: 'challan.created' | 'challan.updated' | 'order.updated', data: unknown) => {
      const n = formatNotification(event, data, isClient);
      if (!n) return;
      setNotifications(prev => [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message: n.message, type: n.type, ts: Date.now(), read: false },
        ...prev,
      ].slice(0, MAX_ITEMS));
    };
    const a = subscribe('challan.created', d => add('challan.created', d));
    const b = subscribe('challan.updated', d => add('challan.updated', d));
    const c = subscribe('order.updated', d => add('order.updated', d));
    return () => { a(); b(); c(); };
  }, [subscribe, isClient]);

  const unreadCount = notifications.reduce((s, n) => s + (n.read ? 0 : 1), 0);
  const markAllRead = useCallback(() => setNotifications(prev => prev.map(n => n.read ? n : { ...n, read: true })), []);
  const clearAll = useCallback(() => setNotifications([]), []);

  return { notifications, unreadCount, markAllRead, clearAll };
}
