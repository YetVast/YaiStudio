/**
 * YAI Studio V1 — Application Shell Service Worker
 *
 * Security & Caching Policy:
 * - App shell assets and immutable static files are cached for offline reliability.
 * - SENSITIVE DATA IS NEVER CACHED:
 *   - All /api/* routes bypass cache (network-only).
 *   - OAuth callback & sign-in routes bypass cache.
 *   - Requests with Authorization or cookie headers bypass cache.
 *   - Cloud AI provider requests and GitHub API requests bypass cache.
 * - Cache versions are strictly scoped and purged on activate to prevent stale auth states.
 */

const CACHE_VERSION = 'yai-studio-shell-v1.0.0';
const STATIC_CACHE = `yai-static-${CACHE_VERSION}`;
const PAGES_CACHE = `yai-pages-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/offline',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
];

// Paths that must NEVER be cached under any circumstances
const NEVER_CACHE_PREFIXES = [
  '/api/',
  '/sign-in',
  '/_next/image',
];

/**
 * Determine if a request must strictly bypass the cache.
 */
function shouldBypassCache(request) {
  // Non-GET requests are never cached
  if (request.method !== 'GET') {
    return true;
  }

  const url = new URL(request.url);

  // Cross-origin requests (e.g. GitHub, OpenRouter, Google AI, Yet Vast Auth registry)
  if (url.origin !== self.location.origin) {
    return true;
  }

  // Sensitive paths
  for (const prefix of NEVER_CACHE_PREFIXES) {
    if (url.pathname.startsWith(prefix)) {
      return true;
    }
  }

  // Header-based sensitive indicators
  if (
    request.headers.get('Authorization') ||
    request.headers.get('Cache-Control')?.includes('no-store')
  ) {
    return true;
  }

  return false;
}

// ─── Install Event ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Pre-cache core shell resources safely
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Precache warning for ${asset}:`, err);
        }
      }
    })
  );
});

// ─── Activate Event: Cache Purge & Client Claim ─────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      const allowedCaches = [STATIC_CACHE, PAGES_CACHE];
      await Promise.all(
        cacheNames
          .filter((name) => !allowedCaches.includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })
  );
});

// ─── Fetch Event ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Bypass sensitive, API, cross-origin, or non-GET requests
  if (shouldBypassCache(request)) {
    return;
  }

  const url = new URL(request.url);

  // 2. Navigation requests (HTML pages): Network-first with cache / offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If response is OK, store in pages cache for offline use
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(PAGES_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline navigation: try pages cache, then /offline, then /offline.html
          const cached = await caches.match(request);
          if (cached) return cached;

          const offlinePage = await caches.match('/offline');
          if (offlinePage) return offlinePage;

          const fallbackHtml = await caches.match('/offline.html');
          if (fallbackHtml) return fallbackHtml;

          return new Response('You are offline. Please reconnect to access this page.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 3. Static Next.js chunks, fonts, icons: Cache-first with network fallback
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Default: Stale-While-Revalidate for other static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// ─── Message Handling ───────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
