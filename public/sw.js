// Service Worker for Lab Ledger PWA
const CACHE_NAME = 'lab-ledger-v2';
const MAX_CACHE_ITEMS = 60;
const STATIC_ASSETS = [
  '/',
  '/logo.png',
  '/manifest.json',
];

// Only cache these content types (skip API responses, arbitrary JSON, etc.)
const CACHEABLE_TYPES = ['text/html', 'text/css', 'application/javascript', 'image/'];

function isCacheable(response) {
  const ct = response.headers.get('content-type') || '';
  return CACHEABLE_TYPES.some((type) => ct.includes(type));
}

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache (only for static assets)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip API requests, Supabase calls, and chrome-extension URLs
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses for cacheable content types
        if (response.ok && isCacheable(response)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(async (cache) => {
            cache.put(event.request, clone);
            // Evict old entries if cache grows too large
            const keys = await cache.keys();
            if (keys.length > MAX_CACHE_ITEMS) {
              await cache.delete(keys[0]);
            }
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});
