// YA Toolkit service worker: only shows push notifications (and the app-icon
// badge) and opens the right page when one is tapped. It does no caching and never touches
// network requests, so the app loads exactly as it does without it.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() } }
  const title = data.title || 'YA Toolkit'
  // App-icon badge: the count of guests waiting on this leader, sent with the push.
  const badge = Number.isInteger(data.badge) && 'setAppBadge' in self.navigator
    ? (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {})
    : Promise.resolve()
  event.waitUntil(Promise.all([badge, self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/people' },
  })]))
})

// Tap → open (or focus) the app on that guest.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/people', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of windows) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus()
        if ('navigate' in w) return w.navigate(url)
        return
      }
    }
    return self.clients.openWindow(url)
  })())
})
