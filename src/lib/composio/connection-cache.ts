/**
 * COMPOSIO CONNECTION CACHE
 * =========================
 *
 * Local caching layer for Composio connections to prevent connections
 * from appearing "dropped" when the Composio API is slow or returns stale data.
 *
 * Strategy:
 * 1. Check local cache first
 * 2. If cache is fresh (< CACHE_TTL), return cached data
 * 3. If cache is stale, try to refresh from Composio API
 * 4. If Composio API fails, return cached data (with stale indicator)
 * 5. Save successful API responses to local cache
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { ConnectedAccount, ConnectionStatus } from './types';

const log = logger('ComposioConnectionCache');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Cache TTL in milliseconds (5 minutes)
// Connections will be refreshed from Composio API after this period
// Reduced from 10 minutes to detect disconnections faster
const CACHE_TTL_MS = 5 * 60 * 1000;

// Maximum retries for Composio API calls
const MAX_RETRIES = 3;

// Retry delay base (exponential backoff)
const RETRY_DELAY_MS = 1000;

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

// Server-side Supabase client for cache operations
// Uses service role key to bypass RLS when needed
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    log.warn('Supabase credentials not configured for connection cache');
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// CACHE TYPES
// ============================================================================

interface CachedConnection {
  id: string;
  user_id: string;
  connection_id: string;
  toolkit: string;
  status: ConnectionStatus;
  connected_at: string | null;
  last_verified_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached connections for a user
 * Returns null if cache is not available
 */
export async function getCachedConnections(userId: string): Promise<ConnectedAccount[] | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('composio_connection_cache')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['connected', 'pending']); // Only return active connections

    if (error) {
      log.error('Failed to get cached connections', { userId, error: error.message });
      return null;
    }

    if (!data || data.length === 0) {
      log.debug('No cached connections found', { userId });
      return null;
    }

    log.debug('Retrieved cached connections', {
      userId,
      count: data.length,
      connections: data.map((c) => ({ toolkit: c.toolkit, status: c.status })),
    });

    return data.map(mapCachedToConnectedAccount);
  } catch (error) {
    log.error('Error getting cached connections', { userId, error });
    return null;
  }
}

/**
 * Check if cache is fresh (within TTL)
 */
export async function isCacheFresh(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  try {
    const cutoffTime = new Date(Date.now() - CACHE_TTL_MS).toISOString();

    const { data, error } = await supabase
      .from('composio_connection_cache')
      .select('last_verified_at')
      .eq('user_id', userId)
      .gt('last_verified_at', cutoffTime)
      .limit(1);

    if (error) {
      log.error('Failed to check cache freshness', { userId, error: error.message });
      return false;
    }

    const isFresh = data && data.length > 0;
    log.debug('Cache freshness check', { userId, isFresh, cutoffTime });
    return isFresh;
  } catch (error) {
    log.error('Error checking cache freshness', { userId, error });
    return false;
  }
}

/**
 * Save connections to local cache
 * This is called after successfully fetching from Composio API
 */
export async function saveConnectionsToCache(
  userId: string,
  connections: ConnectedAccount[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    log.warn('Cannot save to cache - Supabase not configured');
    return;
  }

  try {
    const now = new Date().toISOString();

    // Prepare records for upsert
    const records = connections.map((conn) => ({
      user_id: userId,
      connection_id: conn.id,
      toolkit: conn.toolkit.toUpperCase(),
      status: conn.status,
      connected_at: conn.connectedAt || null,
      last_verified_at: now,
      metadata: conn.metadata || {},
    }));

    if (records.length > 0) {
      // Upsert connections (update if exists, insert if not)
      const { error: upsertError } = await supabase
        .from('composio_connection_cache')
        .upsert(records, {
          onConflict: 'user_id,toolkit',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        log.error('Failed to upsert connections to cache', { userId, error: upsertError.message });
        return;
      }
    }

    // Get toolkits from the new connections
    const activeToolkits = connections.map((c) => c.toolkit.toUpperCase());

    // Safety check: Before marking connections as disconnected, verify this
    // isn't a partial API response. If we previously had many connections
    // and now get very few, the API may have returned incomplete data.
    // Only mark as disconnected if we got a reasonable response.
    const { data: existingCached } = await supabase
      .from('composio_connection_cache')
      .select('toolkit')
      .eq('user_id', userId)
      .in('status', ['connected', 'pending']);

    const previousCount = existingCached?.length || 0;
    const newCount = activeToolkits.length;

    // If we had 3+ connections and the new list has less than half,
    // this is likely a partial API response - don't mark others as disconnected
    const isLikelyPartialResponse =
      previousCount >= 3 && newCount > 0 && newCount < previousCount * 0.5;

    if (isLikelyPartialResponse) {
      log.warn('Possible partial API response detected - skipping disconnection marking', {
        userId,
        previousCount,
        newCount,
        activeToolkits,
      });
    } else if (activeToolkits.length > 0) {
      // Mark any cached connections that are NOT in the new list as disconnected
      // This handles the case where a connection was removed on Composio's side
      const { error: updateError } = await supabase
        .from('composio_connection_cache')
        .update({
          status: 'disconnected',
          last_verified_at: now,
        })
        .eq('user_id', userId)
        .not('toolkit', 'in', `(${activeToolkits.join(',')})`)
        .neq('status', 'disconnected');

      if (updateError) {
        log.warn('Failed to mark stale connections as disconnected', {
          userId,
          error: updateError.message,
        });
      }
    } else {
      // No active connections returned AND we had few/none before - mark all as disconnected
      if (previousCount <= 2) {
        const { error: updateAllError } = await supabase
          .from('composio_connection_cache')
          .update({
            status: 'disconnected',
            last_verified_at: now,
          })
          .eq('user_id', userId)
          .neq('status', 'disconnected');

        if (updateAllError) {
          log.warn('Failed to mark all connections as disconnected', {
            userId,
            error: updateAllError.message,
          });
        }
      } else {
        log.warn('API returned 0 connections but user had many cached - preserving cache', {
          userId,
          previousCount,
        });
      }
    }

    log.info('Saved connections to cache', {
      userId,
      count: connections.length,
      toolkits: activeToolkits,
    });
  } catch (error) {
    log.error('Error saving connections to cache', { userId, error });
  }
}

/**
 * Save a single connection to cache
 * Called after a successful OAuth callback
 */
export async function saveSingleConnectionToCache(
  userId: string,
  connection: ConnectedAccount
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    log.warn('Cannot save to cache - Supabase not configured');
    return;
  }

  try {
    const now = new Date().toISOString();

    const { error } = await supabase.from('composio_connection_cache').upsert(
      {
        user_id: userId,
        connection_id: connection.id,
        toolkit: connection.toolkit.toUpperCase(),
        status: connection.status,
        connected_at: connection.connectedAt || now,
        last_verified_at: now,
        metadata: connection.metadata || {},
      },
      {
        onConflict: 'user_id,toolkit',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      log.error('Failed to save connection to cache', {
        userId,
        toolkit: connection.toolkit,
        error: error.message,
      });
      return;
    }

    log.info('Saved single connection to cache', {
      userId,
      toolkit: connection.toolkit,
      connectionId: connection.id,
    });
  } catch (error) {
    log.error('Error saving single connection to cache', { userId, error });
  }
}

/**
 * Remove a connection from cache
 * Called when user explicitly disconnects
 */
export async function removeConnectionFromCache(userId: string, toolkit: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('composio_connection_cache')
      .update({ status: 'disconnected', last_verified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('toolkit', toolkit.toUpperCase());

    if (error) {
      log.error('Failed to remove connection from cache', {
        userId,
        toolkit,
        error: error.message,
      });
      return;
    }

    log.info('Removed connection from cache', { userId, toolkit });
  } catch (error) {
    log.error('Error removing connection from cache', { userId, error });
  }
}

/**
 * Clear all cached connections for a user
 */
export async function clearUserCache(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('composio_connection_cache')
      .delete()
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to clear user cache', { userId, error: error.message });
      return;
    }

    log.info('Cleared user connection cache', { userId });
  } catch (error) {
    log.error('Error clearing user cache', { userId, error });
  }
}

// ============================================================================
// RETRY HELPER
// ============================================================================

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    baseDelay = RETRY_DELAY_MS,
    operationName = 'operation',
  } = options;

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      log.warn(`${operationName} failed (attempt ${attempt}/${maxRetries})`, {
        error: error instanceof Error ? error.message : error,
      });

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        log.debug(`Retrying ${operationName} in ${Math.round(delay)}ms`);
        await sleep(delay);
      }
    }
  }

  log.error(`${operationName} failed after ${maxRetries} attempts`, { lastError });
  throw lastError;
}

// ============================================================================
// HELPERS
// ============================================================================

function mapCachedToConnectedAccount(cached: CachedConnection): ConnectedAccount {
  return {
    id: cached.connection_id,
    toolkit: cached.toolkit,
    status: cached.status as ConnectionStatus,
    connectedAt: cached.connected_at || undefined,
    metadata: cached.metadata as ConnectedAccount['metadata'],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// EXPORTS
// ============================================================================

export { CACHE_TTL_MS };
