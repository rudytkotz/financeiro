// Service worker mínimo para instalabilidade (PWA) + cache básico do app shell.
const CACHE = 'financeiro-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Nunca intercepta chamadas de API — sempre rede
  if (url.pathname.startsWith('/api')) return

  // Navegações: network-first com fallback ao shell em cache (offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    )
    return
  }

  // Assets estáticos: cache-first, atualiza em segundo plano
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone()
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return resp
        })
        .catch(() => cached)
      return cached || fetchPromise
    }),
  )
})
