/// <reference lib="webworker" />

/**
 * The service worker. Renki's only one.
 *
 * A push message is delivered HERE, not to any page — that is the whole reason
 * a service worker is required for notifications, and why push cannot work
 * without one no matter how the permission prompt goes.
 *
 * Deliberately NOT a caching/offline worker. Offline support is a separate
 * feature with its own failure modes (stale bundles being the classic), and a
 * PWA can be installed and receive push without it.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // A malformed payload must still show SOMETHING. A push that arrives and
    // renders nothing is worse than one that never arrives: on Chrome, a
    // `userVisibleOnly` subscription that handles a push without showing a
    // notification eventually has its permission revoked.
    payload = { title: 'Renki', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Renki', {
      body: payload.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Collapses older notifications about the same thing, so six people
      // accepting one group invite produce one notification, not six.
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url: payload.url ?? '/rides' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = event.notification.data?.url ?? '/rides';

  // Focus an open Renki tab rather than opening a second one. Someone who
  // already has the app open and taps a notification expects to be taken to it,
  // not handed a duplicate.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ('focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
