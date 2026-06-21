import { api } from './api';

// Web Push (browser/PWA) subscription helpers. These let the customer opt in to
// order/delivery notifications that pop up even when the app is closed. Push only
// works in the production build (the service worker is disabled in dev), so the
// subscribe flow guards against a never-registering SW with a timeout.

export type PushStatus =
  | 'unsupported' // browser lacks the APIs
  | 'denied' // user blocked notifications
  | 'subscribed'
  | 'unsubscribed'
  | 'unavailable'; // server not configured / no service worker (e.g. dev)

// Convert the URL-safe base64 VAPID public key to the Uint8Array the Push API
// wants for applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'unsubscribed';
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

async function fetchVapidKey(): Promise<string | null> {
  try {
    const { key } = await api.get<{ key: string }>('/push/vapid-public-key');
    return key || null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  const key = await fetchVapidKey();
  if (!key) return 'unavailable';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed';

  // The SW only registers in the production build; bail out cleanly if it never
  // becomes ready (e.g. running in dev) instead of hanging forever.
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
  if (!reg) return 'unavailable';

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
  const json = sub.toJSON();
  await api.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  });
  return 'subscribed';
}

export async function unsubscribeFromPush(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const { endpoint } = sub;
      await sub.unsubscribe().catch(() => {});
      await api.post('/push/unsubscribe', { endpoint }).catch(() => {});
    }
  } catch {
    /* best-effort */
  }
  return 'unsubscribed';
}
