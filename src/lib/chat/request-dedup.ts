/**
 * REQUEST DEDUPLICATION
 *
 * Prevents duplicate requests from rapid user actions (double-clicks, etc.)
 * Uses a short-lived cache to track recent requests.
 */

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** How long to consider a request a duplicate (ms) */
const DEDUP_WINDOW_MS = 2000;

/** How often to clean up expired entries (ms) */
const CLEANUP_INTERVAL_MS = 30000;

/** Maximum entries before forced cleanup */
const MAX_ENTRIES = 10000;

// ============================================================================
// STORAGE
// ============================================================================

interface DedupEntry {
  hash: string;
  timestamp: number;
  userId: string;
}

const recentRequests = new Map<string, DedupEntry>();
let lastCleanup = Date.now();

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Generate a hash for a request based on user ID and message content
 */
function generateRequestHash(userId: string, content: string): string {
  // Use first 500 chars of content to balance uniqueness and performance
  const normalizedContent = content.trim().toLowerCase().substring(0, 500);
  return crypto
    .createHash('sha256')
    .update(`${userId}:${normalizedContent}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Clean up expired entries to prevent memory leaks
 */
function cleanupExpiredEntries(force: boolean = false): void {
  const now = Date.now();

  // Only cleanup periodically unless forced
  if (!force && now - lastCleanup < CLEANUP_INTERVAL_MS && recentRequests.size < MAX_ENTRIES) {
    return;
  }

  lastCleanup = now;
  let cleanedCount = 0;

  for (const [key, entry] of recentRequests.entries()) {
    if (now - entry.timestamp > DEDUP_WINDOW_MS) {
      recentRequests.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.debug(`[RequestDedup] Cleaned ${cleanedCount} expired entries, ${recentRequests.size} remaining`);
  }
}

/**
 * Check if a request is a duplicate
 * Returns true if this is a duplicate request within the dedup window
 */
export function isDuplicateRequest(userId: string, content: string): boolean {
  // Periodic cleanup
  cleanupExpiredEntries();

  const hash = generateRequestHash(userId, content);
  const key = `${userId}:${hash}`;
  const now = Date.now();

  const existing = recentRequests.get(key);

  if (existing && now - existing.timestamp < DEDUP_WINDOW_MS) {
    // This is a duplicate
    console.debug(`[RequestDedup] Duplicate request detected for user ${userId.substring(0, 8)}...`);
    return true;
  }

  // Track this request
  recentRequests.set(key, {
    hash,
    timestamp: now,
    userId,
  });

  return false;
}

/**
 * Manually clear a request from the dedup cache
 * Use this if you want to allow a retry
 */
export function clearRequest(userId: string, content: string): void {
  const hash = generateRequestHash(userId, content);
  const key = `${userId}:${hash}`;
  recentRequests.delete(key);
}

/**
 * Get current dedup cache stats (for monitoring)
 */
export function getDedupStats(): { size: number; oldestAge: number } {
  const now = Date.now();
  let oldestAge = 0;

  for (const entry of recentRequests.values()) {
    const age = now - entry.timestamp;
    if (age > oldestAge) {
      oldestAge = age;
    }
  }

  return {
    size: recentRequests.size,
    oldestAge,
  };
}
