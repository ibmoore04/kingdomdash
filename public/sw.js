/**
 * KingdomDash Service Worker (Cache-First UI + Offline Fallback + Push Notifications)
 * Version: kd-sw-v1
 */

const CACHE_NAME = 'kd-static-v1'
const DYNAMIC_CACHE = 'kd-dynamic-v1'

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/KingdomDash-emblem.png',
  '/KingdomDash-full-logo.png',
  '/KingdomDash-emblem-clean.png',
]

// ── 1. Install Event: Pre-cache core shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching completed with non-fatal asset misses:', err)
      })
    })
  )
  self.skipWaiting()
})

// ── 2. Activate Event: Clean up legacy caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// ── 3. Fetch Event: Network-First / Cache-First routing ──────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Skip non-GET requests and browser extensions
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return
  }

  // A. Supabase API & Auth requests: Network-first with offline fallback JSON
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'KingdomDash is running in offline mode. Local queue active.',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
            statusText: 'Service Unavailable (Offline)',
          }
        )
      })
    )
    return
  }

  // B. Static UI assets (scripts, styles, icons, fonts): Cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Refresh dynamic cache in background (Stale-While-Revalidate)
          fetch(req)
            .then((networkResp) => {
              if (networkResp && networkResp.status === 200) {
                caches.open(DYNAMIC_CACHE).then((cache) => cache.put(req, networkResp))
              }
            })
            .catch(() => {})
          return cached
        }

        return fetch(req)
          .then((networkResp) => {
            if (networkResp && networkResp.status === 200) {
              const respClone = networkResp.clone()
              caches.open(DYNAMIC_CACHE).then((cache) => cache.put(req, respClone))
            }
            return networkResp
          })
          .catch(() => {
            // If image request fails offline, fallback to emblem
            if (req.destination === 'image') {
              return caches.match('/KingdomDash-emblem.png')
            }
            return new Response('', { status: 404 })
          })
      })
    )
    return
  }

  // C. HTML Navigation: Network-first with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        const rootCached = await caches.match('/')
        if (rootCached) return rootCached
        return new Response('<h1>KingdomDash Offline</h1><p>Please check your internet connection.</p>', {
          headers: { 'Content-Type': 'text/html' },
        })
      })
    )
    return
  }

  // D. General fetch fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  )
})

// ── 4. Web Push Notification Handling ────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'KingdomDash Update',
    body: 'You have a new status update on your order.',
    icon: '/KingdomDash-emblem.png',
    badge: '/favicon.svg',
    url: '/dashboard',
  }

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'View Order' },
      { action: 'close', title: 'Dismiss' },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// ── 5. Notification Click Action ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'close') return

  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// ── 6. Message Listener for manual updates ───────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
