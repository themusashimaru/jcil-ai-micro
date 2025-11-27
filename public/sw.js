/**
 * SERVICE WORKER
 * PURPOSE: PWA offline support, cache management for JCIL.AI Chat
 *
 * CACHING STRATEGY:
 * - Static assets (CSS, JS, fonts, images): Cache-First
 * - Chat data: Network-First with offline fallback (read-only)
 * - API calls: Network-Only (no cache for streaming responses)
 *
 * OFFLINE BEHAVIOR:
 * - Recent chats cached for offline viewing (read-only mode)
 * - Static UI cached for instant loading
 * - Shows offline indicator when network unavailable
 *
 * CACHE LIMITS:
 * - Max 50 chat conversations cached
 * - Max 20MB total cache size
 * - Auto-cleanup of oldest entries when limit reached
 */

const CACHE_VERSION = 'jcil-ai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CHAT_CACHE = `${CACHE_VERSION}-chats`;
const MAX_CHAT_CACHE_ITEMS = 50;
const MAX_CACHE_SIZE_MB = 20;

// Static assets to precache
const STATIC_ASSETS = [
  '/',
  '/chat',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

/**
 * INSTALL EVENT
 * Precache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

/**
 * ACTIVATE EVENT
 * Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if ((cacheName.startsWith('jcil-ai-') || cacheName.startsWith('delta-2-')) && cacheName !== STATIC_CACHE && cacheName !== CHAT_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

/**
 * FETCH EVENT
 * Handle network requests with caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extensions and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API Routes: Network-Only (no cache for streaming/dynamic data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Chat data: Network-First with offline fallback
  if (url.pathname.startsWith('/chat')) {
    event.respondWith(networkFirstWithCache(request, CHAT_CACHE));
    return;
  }

  // Static assets: Cache-First
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|eot|ico)$/) ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Default: Network-First
  event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
});

/**
 * Cache-First Strategy
 * Try cache first, fallback to network
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    // Return cached, update cache in background
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
    }).catch(() => {
      // Ignore network errors in background update
    });
    return cached;
  }

  console.log('[SW] Cache miss, fetching:', request.url);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    // Return offline page if available
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-First Strategy
 * Try network first, fallback to cache
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      // Cache successful responses
      cache.put(request, response.clone());
      // Cleanup old cache entries
      await cleanupCache(cacheName, MAX_CHAT_CACHE_ITEMS);
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    // Return offline response
    return new Response('Offline - No cached data available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Cleanup old cache entries
 * Keep only the most recent MAX_ITEMS entries
 */
async function cleanupCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    // Delete oldest entries (FIFO)
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(
      keysToDelete.map((key) => cache.delete(key))
    );
    console.log(`[SW] Cleaned up ${keysToDelete.length} old cache entries`);
  }
}

/**
 * MESSAGE EVENT
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.claim();
      })
    );
  }
});
