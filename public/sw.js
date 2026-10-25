/* STFU service worker: offline shell, runtime caching and push notifications. */

const CACHE = 'stfu-shell-v1'
const BASE = self.registration.scope
const LOCAL = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname)
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png']

const absolute = (path) => new URL(path, BASE).toString()

self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (LOCAL) return
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL.map(absolute)))
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

async function freshShell(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      await cache.put(absolute('index.html'), response.clone())
    }
    return response
  } catch {
    const cached = (await cache.match(absolute('index.html'))) || (await cache.match(absolute('')))
    return cached || Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) await cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (LOCAL) return

  if (request.mode === 'navigate') {
    event.respondWith(freshShell(request))
    return
  }

  if (/\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg|ico|json)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
})

self.addEventListener('push', (event) => {
  let payload = { title: 'STFU', body: 'Something new in the circle.', url: '', tag: 'stfu' }

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload = { ...payload, body: event.data.text() }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'STFU', {
      body: payload.body || 'Something new in the circle.',
      icon: absolute('icons/icon-192.png'),
      badge: absolute('icons/badge-96.png'),
      tag: payload.tag || 'stfu',
      data: { url: payload.url ? new URL(payload.url, BASE).toString() : BASE },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || BASE

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(BASE)) {
          await client.focus()
          try {
            await client.navigate(target)
          } catch {
            // Cross-document navigation can be refused; focusing is still useful.
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
