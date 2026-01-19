/**
 * USE OFFLINE SYNC HOOK
 *
 * React hook for offline message queuing and sync status.
 *
 * Features:
 * - Track online/offline status
 * - Queue messages when offline
 * - Monitor sync status
 * - Trigger manual sync
 *
 * @version 1.0.0
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  queueMessage,
  getSyncStatus,
  getSessionQueue,
  triggerSync,
  onSyncEvent,
  onConnectionChange,
  initSyncEventListener,
  type SyncStatus,
  type QueuedMessage,
  type SyncResult,
} from '@/lib/pwa/offline-sync';

// ============================================================================
// TYPES
// ============================================================================

export interface UseOfflineSyncOptions {
  sessionId?: string;
  autoSync?: boolean;
}

export interface UseOfflineSyncReturn {
  // Status
  isOnline: boolean;
  syncStatus: SyncStatus | null;
  sessionQueue: QueuedMessage[];

  // Actions
  queueMessage: (content: string) => void;
  triggerSync: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;

  // Events
  lastSyncResult: SyncResult | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
  const { sessionId, autoSync = true } = options;

  // State
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [sessionQueue, setSessionQueue] = useState<QueuedMessage[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Initialize on mount
  useEffect(() => {
    // Set initial online status
    setIsOnline(navigator.onLine);

    // Initialize service worker event listener
    const cleanupSwListener = initSyncEventListener();

    // Fetch initial status
    getSyncStatus().then(setSyncStatus);
    if (sessionId) {
      getSessionQueue(sessionId).then(setSessionQueue);
    }

    return () => {
      cleanupSwListener();
    };
  }, [sessionId]);

  // Listen for connection changes
  useEffect(() => {
    const cleanup = onConnectionChange((online) => {
      setIsOnline(online);

      // Refresh status when coming back online
      if (online) {
        getSyncStatus().then(setSyncStatus);
        if (sessionId) {
          getSessionQueue(sessionId).then(setSessionQueue);
        }
      }
    });

    return cleanup;
  }, [sessionId]);

  // Listen for sync events
  useEffect(() => {
    const cleanupQueued = onSyncEvent('MESSAGE_QUEUED', () => {
      // Refresh queue when a message is queued
      getSyncStatus().then(setSyncStatus);
      if (sessionId) {
        getSessionQueue(sessionId).then(setSessionQueue);
      }
    });

    const cleanupComplete = onSyncEvent('SYNC_COMPLETE', (data) => {
      setLastSyncResult(data as SyncResult);
      // Refresh status after sync
      getSyncStatus().then(setSyncStatus);
      if (sessionId) {
        getSessionQueue(sessionId).then(setSessionQueue);
      }
    });

    return () => {
      cleanupQueued();
      cleanupComplete();
    };
  }, [sessionId]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (autoSync && isOnline && syncStatus && syncStatus.pendingCount > 0) {
      triggerSync();
    }
  }, [autoSync, isOnline, syncStatus]);

  // Queue a message
  const queueMessageCallback = useCallback(
    (content: string) => {
      if (!sessionId) {
        console.warn('Cannot queue message without sessionId');
        return;
      }
      queueMessage(sessionId, content);
    },
    [sessionId]
  );

  // Trigger manual sync
  const triggerSyncCallback = useCallback(async () => {
    const result = await triggerSync();
    return result;
  }, []);

  // Refresh status
  const refreshStatus = useCallback(async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
    if (sessionId) {
      const queue = await getSessionQueue(sessionId);
      setSessionQueue(queue);
    }
  }, [sessionId]);

  return {
    isOnline,
    syncStatus,
    sessionQueue,
    queueMessage: queueMessageCallback,
    triggerSync: triggerSyncCallback,
    refreshStatus,
    lastSyncResult,
  };
}
