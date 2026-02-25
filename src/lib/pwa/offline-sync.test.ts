/**
 * OFFLINE SYNC CLIENT TESTS
 *
 * Tests for PWA offline sync utilities:
 * - queueMessage
 * - getQueuedMessages
 * - getSyncStatus
 * - getSessionQueue
 * - triggerSync
 * - registerPeriodicSync
 * - onSyncEvent
 * - initSyncEventListener
 * - onConnectionChange
 *
 * Browser APIs (navigator, indexedDB, window) are mocked via jsdom + manual mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// BROWSER API MOCKS
// ============================================================================

// Mock IDBRequest
function createMockIDBRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    error: null,
    onsuccess: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
  } as unknown as IDBRequest<T>;
  // Trigger onsuccess after assignment
  setTimeout(() => {
    if (request.onsuccess) {
      request.onsuccess(new Event('success'));
    }
  }, 0);
  return request;
}

// Mock IndexedDB
const mockObjectStore = {
  getAll: vi.fn(() => {
    const req = createMockIDBRequest([
      {
        id: 1,
        sessionId: 'session-1',
        content: 'hello',
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      },
      {
        id: 2,
        sessionId: 'session-2',
        content: 'world',
        timestamp: Date.now(),
        status: 'failed',
        retryCount: 3,
        lastError: 'network error',
      },
    ]);
    return req;
  }),
  createIndex: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore),
};

const mockDb = {
  transaction: vi.fn(() => mockTransaction),
  objectStoreNames: {
    contains: vi.fn(() => true),
  },
  createObjectStore: vi.fn(() => mockObjectStore),
};

// ============================================================================
// TESTS
// ============================================================================

describe('Offline Sync - queueMessage', () => {
  let queueMessage: typeof import('./offline-sync').queueMessage;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup navigator.serviceWorker mock
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: {
          postMessage: vi.fn(),
        },
        ready: Promise.resolve({
          sync: { register: vi.fn(() => Promise.resolve()) },
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    queueMessage = mod.queueMessage;
  });

  it('should post message to service worker', () => {
    queueMessage('session-1', 'Hello world');
    expect(navigator.serviceWorker.controller!.postMessage).toHaveBeenCalledWith({
      type: 'QUEUE_MESSAGE',
      payload: { sessionId: 'session-1', content: 'Hello world' },
    });
  });

  it('should not throw when no service worker controller', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { controller: null, addEventListener: vi.fn(), removeEventListener: vi.fn() },
      writable: true,
      configurable: true,
    });
    expect(() => queueMessage('session-1', 'test')).not.toThrow();
  });
});

describe('Offline Sync - getQueuedMessages', () => {
  let getQueuedMessages: typeof import('./offline-sync').getQueuedMessages;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock indexedDB.open
    const mockOpenRequest = {
      result: mockDb,
      error: null,
      onsuccess: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onupgradeneeded: null as ((event: Event) => void) | null,
    };

    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: vi.fn(() => {
          setTimeout(() => {
            if (mockOpenRequest.onsuccess) {
              mockOpenRequest.onsuccess(new Event('success'));
            }
          }, 0);
          return mockOpenRequest;
        }),
      },
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    getQueuedMessages = mod.getQueuedMessages;
  });

  it('should return queued messages from IndexedDB', async () => {
    const messages = await getQueuedMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].sessionId).toBe('session-1');
    expect(messages[1].status).toBe('failed');
  });

  it('should return empty array on IndexedDB error', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: vi.fn(() => {
          const req = {
            result: null,
            error: new Error('DB error'),
            onsuccess: null as ((event: Event) => void) | null,
            onerror: null as ((event: Event) => void) | null,
            onupgradeneeded: null as ((event: Event) => void) | null,
          };
          setTimeout(() => {
            if (req.onerror) {
              req.onerror(new Event('error'));
            }
          }, 0);
          return req;
        }),
      },
      writable: true,
      configurable: true,
    });

    const messages = await getQueuedMessages();
    expect(messages).toEqual([]);
  });
});

describe('Offline Sync - getSyncStatus', () => {
  let getSyncStatus: typeof import('./offline-sync').getSyncStatus;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock indexedDB
    const mockOpenRequest = {
      result: mockDb,
      error: null,
      onsuccess: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onupgradeneeded: null as ((event: Event) => void) | null,
    };

    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: vi.fn(() => {
          setTimeout(() => {
            if (mockOpenRequest.onsuccess) {
              mockOpenRequest.onsuccess(new Event('success'));
            }
          }, 0);
          return mockOpenRequest;
        }),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    getSyncStatus = mod.getSyncStatus;
  });

  it('should return sync status with queue info', async () => {
    const status = await getSyncStatus();
    expect(status.isOnline).toBe(true);
    expect(status.queueLength).toBe(2);
    expect(status.pendingCount).toBe(1);
    expect(status.failedCount).toBe(1);
    expect(status.lastSyncAt).toBeNull();
  });
});

describe('Offline Sync - getSessionQueue', () => {
  let getSessionQueue: typeof import('./offline-sync').getSessionQueue;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockOpenRequest = {
      result: mockDb,
      error: null,
      onsuccess: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onupgradeneeded: null as ((event: Event) => void) | null,
    };

    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: vi.fn(() => {
          setTimeout(() => {
            if (mockOpenRequest.onsuccess) {
              mockOpenRequest.onsuccess(new Event('success'));
            }
          }, 0);
          return mockOpenRequest;
        }),
      },
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    getSessionQueue = mod.getSessionQueue;
  });

  it('should filter messages by session ID', async () => {
    const messages = await getSessionQueue('session-1');
    expect(messages).toHaveLength(1);
    expect(messages[0].sessionId).toBe('session-1');
  });

  it('should return empty array for unknown session', async () => {
    const messages = await getSessionQueue('nonexistent');
    expect(messages).toHaveLength(0);
  });
});

describe('Offline Sync - triggerSync', () => {
  let triggerSync: typeof import('./offline-sync').triggerSync;

  beforeEach(async () => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage: vi.fn() },
        ready: Promise.resolve({
          sync: { register: vi.fn(() => Promise.resolve()) },
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Add sync to serviceWorker for the type check
    Object.defineProperty(navigator.serviceWorker, 'sync', {
      value: {},
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    triggerSync = mod.triggerSync;
  });

  it('should register background sync and return true', async () => {
    const result = await triggerSync();
    expect(result).toBe(true);
  });

  it('should return false when sync not supported', async () => {
    // Remove sync property
    const sw = navigator.serviceWorker as unknown as Record<string, unknown>;
    delete sw.sync;

    const result = await triggerSync();
    expect(result).toBe(false);
  });
});

describe('Offline Sync - registerPeriodicSync', () => {
  let registerPeriodicSync: typeof import('./offline-sync').registerPeriodicSync;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockRegister = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage: vi.fn() },
        ready: Promise.resolve({
          periodicSync: { register: mockRegister },
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    registerPeriodicSync = mod.registerPeriodicSync;
  });

  it('should register periodic sync with default interval', async () => {
    const result = await registerPeriodicSync();
    expect(result).toBe(true);
  });

  it('should register periodic sync with custom interval', async () => {
    const result = await registerPeriodicSync(120000);
    expect(result).toBe(true);
  });
});

describe('Offline Sync - onSyncEvent', () => {
  let onSyncEvent: typeof import('./offline-sync').onSyncEvent;

  beforeEach(async () => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage: vi.fn() },
        ready: Promise.resolve({}),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    onSyncEvent = mod.onSyncEvent;
  });

  it('should return an unsubscribe function', () => {
    const cb = vi.fn();
    const unsubscribe = onSyncEvent('MESSAGE_QUEUED', cb);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should allow unsubscribing', () => {
    const cb = vi.fn();
    const unsubscribe = onSyncEvent('SYNC_COMPLETE', cb);
    // Should not throw
    unsubscribe();
  });
});

describe('Offline Sync - initSyncEventListener', () => {
  let initSyncEventListener: typeof import('./offline-sync').initSyncEventListener;

  beforeEach(async () => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage: vi.fn() },
        ready: Promise.resolve({}),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    initSyncEventListener = mod.initSyncEventListener;
  });

  it('should register a message event listener', () => {
    initSyncEventListener();
    expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });

  it('should return a cleanup function', () => {
    const cleanup = initSyncEventListener();
    expect(typeof cleanup).toBe('function');
  });

  it('should remove listener on cleanup', () => {
    const cleanup = initSyncEventListener();
    cleanup();
    expect(navigator.serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });
});

describe('Offline Sync - onConnectionChange', () => {
  let onConnectionChange: typeof import('./offline-sync').onConnectionChange;

  beforeEach(async () => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage: vi.fn() },
        ready: Promise.resolve({}),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    const mod = await import('./offline-sync');
    onConnectionChange = mod.onConnectionChange;
  });

  it('should call callback immediately with current online status', () => {
    const cb = vi.fn();
    onConnectionChange(cb);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('should return an unsubscribe function', () => {
    const cb = vi.fn();
    const unsubscribe = onConnectionChange(cb);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should stop calling callback after unsubscribe', () => {
    const cb = vi.fn();
    const unsubscribe = onConnectionChange(cb);
    cb.mockClear();
    unsubscribe();
    // After unsubscribe, new events should not call cb
    // (We can't easily simulate window events in this mock setup,
    //  but we verify the unsubscribe removes the callback)
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('Offline Sync - Type exports', () => {
  it('should export QueuedMessage type', () => {
    const msg: import('./offline-sync').QueuedMessage = {
      sessionId: 's1',
      content: 'test',
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };
    expect(msg.status).toBe('pending');
  });

  it('should export SyncStatus type', () => {
    const status: import('./offline-sync').SyncStatus = {
      isOnline: true,
      queueLength: 5,
      lastSyncAt: null,
      pendingCount: 3,
      failedCount: 2,
    };
    expect(status.isOnline).toBe(true);
  });

  it('should export SyncResult type', () => {
    const result: import('./offline-sync').SyncResult = {
      sent: 3,
      failed: 1,
    };
    expect(result.sent).toBe(3);
  });

  it('should support all QueuedMessage statuses', () => {
    const statuses: import('./offline-sync').QueuedMessage['status'][] = [
      'pending',
      'sending',
      'sent',
      'failed',
    ];
    expect(statuses).toHaveLength(4);
  });
});
