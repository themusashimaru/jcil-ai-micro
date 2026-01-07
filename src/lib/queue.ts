/**
 * REQUEST QUEUE SYSTEM
 *
 * Manages concurrent AI API requests to prevent rate limiting.
 * Uses Redis for distributed state (works across serverless instances).
 *
 * Features:
 * - Configurable max concurrent requests
 * - Automatic queue with timeout
 * - Graceful "server busy" responses when overloaded
 */

import { redis } from './redis/client';

// Configuration
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.QUEUE_MAX_CONCURRENT || '50', 10);
const QUEUE_TIMEOUT_MS = parseInt(process.env.QUEUE_TIMEOUT_MS || '30000', 10); // 30 seconds
const REQUEST_TTL_SECONDS = 120; // Auto-expire stuck requests after 2 minutes

// Redis keys
const ACTIVE_REQUESTS_KEY = 'queue:active';

/**
 * In-memory fallback for when Redis is not available
 * WARNING: This does NOT work correctly in serverless environments!
 * Each invocation gets a fresh process with reset memory.
 */
let inMemoryActiveCount = 0;
const inMemoryQueue: Array<{
  resolve: (value: boolean) => void;
  timeout: NodeJS.Timeout;
}> = [];
let warnedAboutFallback = false;

/**
 * Acquire a slot in the queue
 * Returns true if slot acquired, false if queue is full/timeout
 */
export async function acquireSlot(requestId: string): Promise<boolean> {
  if (redis) {
    return acquireSlotRedis(requestId);
  }
  return acquireSlotMemory();
}

/**
 * Release a slot back to the queue
 */
export async function releaseSlot(requestId: string): Promise<void> {
  if (redis) {
    await releaseSlotRedis(requestId);
  } else {
    releaseSlotMemory();
  }
}

/**
 * Get current queue status
 */
export async function getQueueStatus(): Promise<{
  activeRequests: number;
  maxConcurrent: number;
  available: number;
}> {
  let activeRequests = 0;

  if (redis) {
    try {
      activeRequests = await redis.scard(ACTIVE_REQUESTS_KEY);
    } catch (error) {
      console.warn('[Queue] Error getting status:', error);
    }
  } else {
    activeRequests = inMemoryActiveCount;
  }

  return {
    activeRequests,
    maxConcurrent: MAX_CONCURRENT_REQUESTS,
    available: Math.max(0, MAX_CONCURRENT_REQUESTS - activeRequests),
  };
}

// ========================================
// REDIS IMPLEMENTATION
// ========================================

async function acquireSlotRedis(requestId: string): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < QUEUE_TIMEOUT_MS) {
    try {
      // Check current count
      const currentCount = await redis!.scard(ACTIVE_REQUESTS_KEY);

      if (currentCount < MAX_CONCURRENT_REQUESTS) {
        // Try to add our request
        const added = await redis!.sadd(ACTIVE_REQUESTS_KEY, requestId);

        if (added) {
          // Set expiry on the request ID to prevent stuck slots
          // Use a separate key for TTL tracking
          await redis!.set(`queue:req:${requestId}`, '1', { ex: REQUEST_TTL_SECONDS });

          console.log(`[Queue] Slot acquired: ${requestId} (${currentCount + 1}/${MAX_CONCURRENT_REQUESTS})`);
          return true;
        }
      }

      // Queue is full, wait a bit and retry
      await sleep(100 + Math.random() * 100); // 100-200ms jitter

    } catch (error) {
      console.warn('[Queue] Error acquiring slot:', error);
      // On Redis error, allow the request through
      return true;
    }
  }

  console.warn(`[Queue] Timeout waiting for slot: ${requestId}`);
  return false;
}

async function releaseSlotRedis(requestId: string): Promise<void> {
  try {
    await redis!.srem(ACTIVE_REQUESTS_KEY, requestId);
    await redis!.del(`queue:req:${requestId}`);

    const remaining = await redis!.scard(ACTIVE_REQUESTS_KEY);
    console.log(`[Queue] Slot released: ${requestId} (${remaining}/${MAX_CONCURRENT_REQUESTS})`);
  } catch (error) {
    console.warn('[Queue] Error releasing slot:', error);
  }
}

// ========================================
// IN-MEMORY FALLBACK
// ========================================

function acquireSlotMemory(): Promise<boolean> {
  // Warn once about in-memory fallback in serverless
  if (!warnedAboutFallback && process.env.VERCEL) {
    warnedAboutFallback = true;
    console.warn('[Queue] WARNING: Using in-memory queue in serverless environment. Configure UPSTASH_REDIS for proper rate limiting.');
  }

  return new Promise((resolve) => {
    if (inMemoryActiveCount < MAX_CONCURRENT_REQUESTS) {
      inMemoryActiveCount++;
      console.log(`[Queue] Slot acquired (memory): ${inMemoryActiveCount}/${MAX_CONCURRENT_REQUESTS}`);
      resolve(true);
      return;
    }

    // Add to wait queue with timeout
    const timeout = setTimeout(() => {
      const index = inMemoryQueue.findIndex(item => item.resolve === resolve);
      if (index !== -1) {
        inMemoryQueue.splice(index, 1);
      }
      console.warn('[Queue] Timeout waiting for slot (memory)');
      resolve(false);
    }, QUEUE_TIMEOUT_MS);

    inMemoryQueue.push({ resolve, timeout });
  });
}

function releaseSlotMemory(): void {
  inMemoryActiveCount = Math.max(0, inMemoryActiveCount - 1);
  console.log(`[Queue] Slot released (memory): ${inMemoryActiveCount}/${MAX_CONCURRENT_REQUESTS}`);

  // Process next in queue
  if (inMemoryQueue.length > 0 && inMemoryActiveCount < MAX_CONCURRENT_REQUESTS) {
    const next = inMemoryQueue.shift();
    if (next) {
      clearTimeout(next.timeout);
      inMemoryActiveCount++;
      next.resolve(true);
    }
  }
}

// ========================================
// UTILITIES
// ========================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Cleanup stale requests (call periodically or on startup)
 * Removes requests that have been active longer than TTL
 */
export async function cleanupStaleRequests(): Promise<number> {
  if (!redis) return 0;

  try {
    const activeRequests = await redis.smembers(ACTIVE_REQUESTS_KEY);
    let cleaned = 0;

    for (const requestId of activeRequests) {
      const exists = await redis.exists(`queue:req:${requestId}`);
      if (!exists) {
        // TTL expired, remove from active set
        await redis.srem(ACTIVE_REQUESTS_KEY, requestId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Queue] Cleaned up ${cleaned} stale requests`);
    }

    return cleaned;
  } catch (error) {
    console.warn('[Queue] Error cleaning up stale requests:', error);
    return 0;
  }
}

/**
 * Wrapper to execute a function with queue management
 */
export async function withQueue<T>(
  fn: () => Promise<T>,
  options?: { requestId?: string }
): Promise<T> {
  const requestId = options?.requestId || generateRequestId();

  const acquired = await acquireSlot(requestId);

  if (!acquired) {
    throw new QueueFullError('Server is busy. Please try again in a moment.');
  }

  try {
    return await fn();
  } finally {
    await releaseSlot(requestId);
  }
}

/**
 * Custom error for queue full condition
 */
export class QueueFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueFullError';
  }
}
