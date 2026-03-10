/**
 * REDIS PERSISTENCE FOR COLLABORATION
 *
 * Provides Redis-backed persistence for collaboration sessions.
 * Enables horizontal scaling across multiple server instances.
 *
 * Features:
 * - Session state persistence
 * - Cross-server event broadcasting via pub/sub
 * - Automatic cleanup of stale sessions
 * - Graceful fallback to in-memory when Redis unavailable
 */

import { redis, cacheGet, cacheSet, cacheDelete, isRedisAvailable } from '@/lib/redis/client';
import { logger } from '@/lib/logger';
import type { CRDTOperation, CRDTState, CursorPosition } from './crdt-document';

const log = logger('CollabRedis');

// ============================================================================
// TYPES
// ============================================================================

export interface SerializedSession {
  id: string;
  documentId: string;
  ownerId: string;
  createdAt: string;
  users: SerializedUser[];
  isActive: boolean;
}

export interface SerializedUser {
  id: string;
  name: string;
  email?: string;
  color: string;
  joinedAt: string;
  lastActivity: string;
  cursor?: CursorPosition;
  isTyping: boolean;
}

export interface CollaborationEvent {
  type: 'operation' | 'cursor' | 'join' | 'leave' | 'sync';
  sessionId: string;
  userId: string;
  payload: unknown;
  timestamp: number;
  serverId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REDIS_PREFIX = 'collab:';
const SESSION_PREFIX = `${REDIS_PREFIX}session:`;
const DOCUMENT_PREFIX = `${REDIS_PREFIX}doc:`;

/** Session TTL in seconds (24 hours) */
const SESSION_TTL_SECONDS = 86400;

/** Document state TTL in seconds (7 days) */
const DOCUMENT_TTL_SECONDS = 604800;

/** Unique server ID for pub/sub filtering */
const SERVER_ID = `server-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ============================================================================
// SESSION PERSISTENCE
// ============================================================================

/**
 * Save session to Redis
 */
export async function saveSession(session: SerializedSession): Promise<boolean> {
  if (!isRedisAvailable()) {
    log.debug('Redis not available, skipping session save');
    return false;
  }

  const key = `${SESSION_PREFIX}${session.id}`;
  const saved = await cacheSet(key, session, SESSION_TTL_SECONDS);

  if (saved) {
    log.debug('Session saved to Redis', { sessionId: session.id });
  }

  return saved;
}

/**
 * Load session from Redis
 */
export async function loadSession(sessionId: string): Promise<SerializedSession | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  const key = `${SESSION_PREFIX}${sessionId}`;
  return cacheGet<SerializedSession>(key);
}

/**
 * Delete session from Redis
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  const key = `${SESSION_PREFIX}${sessionId}`;
  return cacheDelete(key);
}

/**
 * List all active sessions (for recovery)
 */
export async function listActiveSessions(): Promise<string[]> {
  if (!redis) return [];

  try {
    const keys = await redis.keys(`${SESSION_PREFIX}*`);
    return keys.map((k) => k.replace(SESSION_PREFIX, ''));
  } catch (error) {
    log.warn('Failed to list sessions', error as Error);
    return [];
  }
}

// ============================================================================
// DOCUMENT STATE PERSISTENCE
// ============================================================================

/**
 * Save document CRDT state to Redis
 */
export async function saveDocumentState(documentId: string, state: CRDTState): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  const key = `${DOCUMENT_PREFIX}${documentId}`;
  const saved = await cacheSet(key, state, DOCUMENT_TTL_SECONDS);

  if (saved) {
    log.debug('Document state saved to Redis', {
      documentId,
      version: state.version,
      opsCount: state.operations.length,
    });
  }

  return saved;
}

/**
 * Load document CRDT state from Redis
 */
export async function loadDocumentState(documentId: string): Promise<CRDTState | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  const key = `${DOCUMENT_PREFIX}${documentId}`;
  return cacheGet<CRDTState>(key);
}

/**
 * Delete document state from Redis
 */
export async function deleteDocumentState(documentId: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  const key = `${DOCUMENT_PREFIX}${documentId}`;
  return cacheDelete(key);
}

// ============================================================================
// CROSS-SERVER EVENT BROADCASTING
// ============================================================================

type EventHandler = (event: CollaborationEvent) => void;
const eventHandlers: EventHandler[] = [];

/**
 * Publish collaboration event for cross-server sync
 *
 * NOTE: Uses list-based queue instead of pub/sub because Upstash REST API
 * doesn't support real-time pub/sub subscriptions. Events are pushed to a
 * list and polled by startEventPolling().
 */
export async function publishEvent(
  type: CollaborationEvent['type'],
  sessionId: string,
  userId: string,
  payload: unknown
): Promise<boolean> {
  if (!redis) return false;

  const event: CollaborationEvent = {
    type,
    sessionId,
    userId,
    payload,
    timestamp: Date.now(),
    serverId: SERVER_ID,
  };

  try {
    // FIXED: Use list-based queue instead of pub/sub for Upstash compatibility
    // This ensures events are actually received by the polling mechanism
    await redis.rpush(`${REDIS_PREFIX}event_queue`, JSON.stringify(event));
    log.debug('Published collaboration event to queue', { type, sessionId });
    return true;
  } catch (error) {
    log.warn('Failed to publish event', error as Error);
    return false;
  }
}

/**
 * Subscribe to collaboration events from other servers
 */
export function subscribeToEvents(handler: EventHandler): () => void {
  eventHandlers.push(handler);

  // Return unsubscribe function
  return () => {
    const index = eventHandlers.indexOf(handler);
    if (index > -1) {
      eventHandlers.splice(index, 1);
    }
  };
}

/**
 * Start listening for cross-server events
 * Note: Upstash REST API doesn't support real pub/sub,
 * so this uses polling as a fallback
 */
let pollingInterval: NodeJS.Timeout | null = null;
let lastEventTimestamp = Date.now();

export function startEventPolling(intervalMs: number = 1000): void {
  if (pollingInterval || !redis) return;

  // Store reference to avoid null check issues in async callback
  const redisClient = redis;

  pollingInterval = setInterval(async () => {
    try {
      // Use a list as event queue instead of pub/sub
      const events = await redisClient.lrange(`${REDIS_PREFIX}event_queue`, 0, 100);

      for (const eventStr of events) {
        try {
          const event = JSON.parse(eventStr as string) as CollaborationEvent;

          // Skip our own events and old events
          if (event.serverId === SERVER_ID) continue;
          if (event.timestamp <= lastEventTimestamp) continue;

          lastEventTimestamp = Math.max(lastEventTimestamp, event.timestamp);

          // Dispatch to handlers
          for (const handler of eventHandlers) {
            try {
              handler(event);
            } catch (error) {
              log.error('Event handler error', error as Error);
            }
          }
        } catch {
          // Invalid event JSON, skip
        }
      }

      // Trim old events (keep last 1000)
      await redisClient.ltrim(`${REDIS_PREFIX}event_queue`, -1000, -1);
    } catch (error) {
      log.warn('Event polling error', error as Error);
    }
  }, intervalMs);

  log.info('Started collaboration event polling', { intervalMs });
}

export function stopEventPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    log.info('Stopped collaboration event polling');
  }
}

/**
 * Push event to queue for cross-server distribution
 */
export async function pushEventToQueue(event: CollaborationEvent): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.rpush(`${REDIS_PREFIX}event_queue`, JSON.stringify(event));
    return true;
  } catch (error) {
    log.warn('Failed to push event to queue', error as Error);
    return false;
  }
}

// ============================================================================
// OPERATIONS BUFFER (for offline sync)
// ============================================================================

/**
 * Buffer operations for a user (for reconnection sync)
 */
export async function bufferOperation(
  sessionId: string,
  userId: string,
  operation: CRDTOperation
): Promise<boolean> {
  if (!redis) return false;

  const key = `${REDIS_PREFIX}ops:${sessionId}:${userId}`;

  try {
    await redis.rpush(key, JSON.stringify(operation));
    await redis.expire(key, 3600); // 1 hour TTL
    return true;
  } catch (error) {
    log.warn('Failed to buffer operation', error as Error);
    return false;
  }
}

/**
 * Get buffered operations for a user
 */
export async function getBufferedOperations(
  sessionId: string,
  userId: string
): Promise<CRDTOperation[]> {
  if (!redis) return [];

  const key = `${REDIS_PREFIX}ops:${sessionId}:${userId}`;

  try {
    const ops = await redis.lrange(key, 0, -1);
    return ops.map((op) => JSON.parse(op as string) as CRDTOperation);
  } catch (error) {
    log.warn('Failed to get buffered operations', error as Error);
    return [];
  }
}

/**
 * Clear buffered operations for a user
 */
export async function clearBufferedOperations(sessionId: string, userId: string): Promise<boolean> {
  if (!redis) return false;

  const key = `${REDIS_PREFIX}ops:${sessionId}:${userId}`;
  return cacheDelete(key);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
  available: boolean;
  latencyMs: number;
}> {
  if (!redis) {
    return { available: false, latencyMs: -1 };
  }

  const start = Date.now();
  try {
    await redis.ping();
    return { available: true, latencyMs: Date.now() - start };
  } catch {
    return { available: false, latencyMs: -1 };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { isRedisAvailable, SERVER_ID };
