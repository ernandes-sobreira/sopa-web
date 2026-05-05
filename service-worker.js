// ══════════════════════════════════════════
// SOPA Service Worker — PWA
// ══════════════════════════════════════════

const CACHE_NAME = 'sopa-v44';
const CACHE_STATIC = 'sopa-static-v44';

// Arquivos para cache offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './sopa-aluno.html',
  './perfil.html',
  './projeto.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Playfair+Display:wght@700;800&display=swap',
  'https://d3js.org/d3.v7.min.js',
];

// ── INSTALL: cache static assets ──
self.addEventListener('install', event => {
  console.log('[SW] Installing SOPA...');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => {
          // Skip cross-origin fonts for now to avoid CORS issues
          return !url.includes('fonts.googleapis');
        }));
      })
      .then(() => self.skipWaiting())
      .catch(err => console.log('[SW] Cache install error:', err))
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating SOPA...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and API calls
  if(event.request.method !== 'GET') return;
  if(url.hostname === 'api.anthropic.com') return;
  if(url.hostname === 'firestore.googleapis.com') return;
  if(url.hostname === 'gmailmcp.googleapis.com') return;
  if(url.hostname === 'api.semanticscholar.org') return;
  if(url.hostname === 'chart.googleapis.com') return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if(cached){
          // Serve from cache + update in background (stale-while-revalidate)
          const networkUpdate = fetch(event.request)
            .then(response => {
              if(response.ok){
                caches.open(CACHE_STATIC)
                  .then(cache => cache.put(event.request, response.clone()));
              }
              return response;
            }).catch(() => {});
          return cached;
        }

        // Not in cache — fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache successful responses for same-origin files
            if(response.ok && url.origin === self.location.origin){
              caches.open(CACHE_STATIC)
                .then(cache => cache.put(event.request, response.clone()));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if(event.request.mode === 'navigate'){
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ── PUSH NOTIFICATIONS (future) ──
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SOPA', {
      body: data.body || 'Nova notificação',
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
