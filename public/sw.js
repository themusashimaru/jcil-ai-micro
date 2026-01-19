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

/* eslint-disable no-console */
const CACHE_VERSION = 'jcil-ai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CHAT_CACHE = `${CACHE_VERSION}-chats`;
const MAX_CHAT_CACHE_ITEMS = 50;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_CACHE_SIZE_MB = 20; // Reserved for future cache size management

// Static assets to precache
const STATIC_ASSETS = ['/', '/chat', '/manifest.json', '/icon-192.png', '/icon-512.png'];

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
    })
    // Note: We do NOT call skipWaiting() here
    // The new SW will wait until user clicks "Update Now"
    // which sends the SKIP_WAITING message
  );
});

/**
 * ACTIVATE EVENT
 * Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (
              (cacheName.startsWith('jcil-ai-') || cacheName.startsWith('delta-2-')) &&
              cacheName !== STATIC_CACHE &&
              cacheName !== CHAT_CACHE
            ) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
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
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {
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
  } catch {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    // Return offline response
    return new Response('Offline - No cached data available', {
      status: 503,
      statusText: 'Service Unavailable',
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
    await Promise.all(keysToDelete.map((key) => cache.delete(key)));
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
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        })
        .then(() => {
          return self.clients.claim();
        })
    );
  }

  // Queue message for background sync
  if (event.data && event.data.type === 'QUEUE_MESSAGE') {
    event.waitUntil(queueMessageForSync(event.data.payload));
  }
});

// ============================================================================
// BACKGROUND SYNC - Offline Message Queue
// ============================================================================

const MESSAGE_QUEUE_STORE = 'jcil-message-queue';
const DB_NAME = 'jcil-offline-db';
const DB_VERSION = 1;

/**
 * Open IndexedDB for offline storage
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create message queue store
      if (!db.objectStoreNames.contains(MESSAGE_QUEUE_STORE)) {
        const store = db.createObjectStore(MESSAGE_QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
  });
}

/**
 * Queue a message for background sync
 */
async function queueMessageForSync(payload) {
  try {
    const db = await openDB();
    const tx = db.transaction(MESSAGE_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_QUEUE_STORE);

    const queueItem = {
      ...payload,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    await new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });

    console.log('[SW] Message queued for sync:', queueItem.sessionId);

    // Register for background sync if available
    if ('sync' in self.registration) {
      await self.registration.sync.register('message-sync');
    }

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'MESSAGE_QUEUED',
        sessionId: payload.sessionId,
        queueLength: 1,
      });
    });
  } catch (error) {
    console.error('[SW] Failed to queue message:', error);
  }
}

/**
 * Get all queued messages
 */
async function getQueuedMessages() {
  try {
    const db = await openDB();
    const tx = db.transaction(MESSAGE_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(MESSAGE_QUEUE_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to get queued messages:', error);
    return [];
  }
}

/**
 * Remove a message from the queue
 */
async function removeFromQueue(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(MESSAGE_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_QUEUE_STORE);

    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });

    console.log('[SW] Message removed from queue:', id);
  } catch (error) {
    console.error('[SW] Failed to remove message from queue:', error);
  }
}

/**
 * Update message status in queue
 */
async function updateQueueItem(id, updates) {
  try {
    const db = await openDB();
    const tx = db.transaction(MESSAGE_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_QUEUE_STORE);

    const item = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (item) {
      const updated = { ...item, ...updates };
      await new Promise((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error('[SW] Failed to update queue item:', error);
  }
}

/**
 * Process the message queue - send pending messages
 */
async function processMessageQueue() {
  const messages = await getQueuedMessages();
  const pendingMessages = messages.filter((m) => m.status === 'pending');

  console.log(`[SW] Processing ${pendingMessages.length} queued messages`);

  const results = { sent: 0, failed: 0 };

  for (const message of pendingMessages) {
    try {
      // Send the message
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: message.sessionId,
          message: message.content,
          offlineQueued: true,
          queuedAt: message.timestamp,
        }),
      });

      if (response.ok) {
        await removeFromQueue(message.id);
        results.sent++;
        console.log('[SW] Queued message sent successfully:', message.id);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      results.failed++;
      const newRetryCount = (message.retryCount || 0) + 1;

      if (newRetryCount >= 3) {
        // Mark as failed after 3 retries
        await updateQueueItem(message.id, {
          status: 'failed',
          retryCount: newRetryCount,
          lastError: error.message,
        });
        console.log('[SW] Message marked as failed after retries:', message.id);
      } else {
        // Increment retry count
        await updateQueueItem(message.id, { retryCount: newRetryCount });
        console.log('[SW] Message will be retried:', message.id, `(${newRetryCount}/3)`);
      }
    }
  }

  // Notify clients of sync results
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      results,
    });
  });

  return results;
}

/**
 * BACKGROUND SYNC EVENT
 * Process queued messages when connectivity is restored
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'message-sync') {
    console.log('[SW] Background sync triggered: message-sync');
    event.waitUntil(processMessageQueue());
  }
});

/**
 * PERIODIC BACKGROUND SYNC
 * Periodically check for queued messages (when supported)
 */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'message-sync-periodic') {
    console.log('[SW] Periodic sync triggered');
    event.waitUntil(processMessageQueue());
  }
});
