/**
 * OFFLINE SYNC CLIENT
 *
 * Client-side utilities for offline message queuing and sync.
 * Works with the service worker to queue messages when offline
 * and automatically sync when connectivity is restored.
 *
 * Features:
 * - Queue messages for background sync
 * - Get queue status
 * - Manual sync trigger
 * - Sync status notifications
 *
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedMessage {
  id?: number;
  sessionId: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  queueLength: number;
  lastSyncAt: number | null;
  pendingCount: number;
  failedCount: number;
}

export interface SyncResult {
  sent: number;
  failed: number;
}

// ============================================================================
// SERVICE WORKER COMMUNICATION
// ============================================================================

/**
 * Send a message to the service worker
 */
function sendToServiceWorker(type: string, payload?: unknown): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type, payload });
  }
}

/**
 * Queue a message for offline sync
 */
export function queueMessage(sessionId: string, content: string): void {
  sendToServiceWorker('QUEUE_MESSAGE', {
    sessionId,
    content,
  });
}

// ============================================================================
// INDEXEDDB DIRECT ACCESS (for reading queue status)
// ============================================================================

const DB_NAME = 'jcil-offline-db';
const DB_VERSION = 1;
const MESSAGE_QUEUE_STORE = 'jcil-message-queue';

/**
 * Open IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
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
 * Get all queued messages
 */
export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(MESSAGE_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(MESSAGE_QUEUE_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Get queue status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const messages = await getQueuedMessages();

  return {
    isOnline: navigator.onLine,
    queueLength: messages.length,
    lastSyncAt: null, // Could be stored in localStorage
    pendingCount: messages.filter((m) => m.status === 'pending').length,
    failedCount: messages.filter((m) => m.status === 'failed').length,
  };
}

/**
 * Get queued messages for a specific session
 */
export async function getSessionQueue(sessionId: string): Promise<QueuedMessage[]> {
  const messages = await getQueuedMessages();
  return messages.filter((m) => m.sessionId === sessionId);
}

// ============================================================================
// SYNC TRIGGERS
// ============================================================================

/**
 * Manually trigger a sync
 */
export async function triggerSync(): Promise<boolean> {
  if (
    'serviceWorker' in navigator &&
    'sync' in (navigator.serviceWorker as unknown as { sync?: unknown })
  ) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-expect-error - Background sync API typing
      await registration.sync.register('message-sync');
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Register for periodic background sync
 */
export async function registerPeriodicSync(minInterval: number = 60000): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if ('periodicSync' in registration) {
        const reg = registration as ServiceWorkerRegistration & {
          periodicSync: {
            register: (tag: string, options: { minInterval: number }) => Promise<void>;
          };
        };
        await reg.periodicSync.register('message-sync-periodic', {
          minInterval,
        });
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

type SyncEventCallback = (data: unknown) => void;
const listeners: Map<string, Set<SyncEventCallback>> = new Map();

/**
 * Subscribe to sync events
 */
export function onSyncEvent(
  event: 'MESSAGE_QUEUED' | 'SYNC_COMPLETE',
  callback: SyncEventCallback
): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(callback);

  return () => {
    listeners.get(event)?.delete(callback);
  };
}

/**
 * Initialize sync event listener from service worker
 */
export function initSyncEventListener(): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    const { type, ...data } = event.data || {};
    if (type && listeners.has(type)) {
      listeners.get(type)?.forEach((callback) => callback(data));
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}

// ============================================================================
// ONLINE/OFFLINE DETECTION
// ============================================================================

type ConnectionCallback = (isOnline: boolean) => void;
const connectionListeners: Set<ConnectionCallback> = new Set();

/**
 * Subscribe to connection status changes
 */
export function onConnectionChange(callback: ConnectionCallback): () => void {
  connectionListeners.add(callback);

  // Initial call
  callback(navigator.onLine);

  return () => {
    connectionListeners.delete(callback);
  };
}

// Set up global connection listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    connectionListeners.forEach((cb) => cb(true));
    // Auto-trigger sync when back online
    triggerSync();
  });

  window.addEventListener('offline', () => {
    connectionListeners.forEach((cb) => cb(false));
  });
}
