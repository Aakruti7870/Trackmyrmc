/* Web Push handlers, imported into the Workbox-generated service worker via
 * `workbox.importScripts`. Keeps the push/notification logic in plain JS so it
 * survives precache revisioning. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {};
  }
  const title = data.title || 'CONCRETE KING';
  const options = {
    body: data.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    vibrate: [180, 90, 180],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            await client.navigate(targetUrl);
          } catch (_e) {
            /* navigation may be cross-origin or unsupported; just focus */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })(),
  );
});
