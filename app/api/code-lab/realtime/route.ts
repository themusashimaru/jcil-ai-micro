/**
 * CODE LAB REALTIME API - SSE FALLBACK FOR SERVERLESS
 *
 * Provides Server-Sent Events (SSE) as a fallback for real-time updates
 * when WebSocket is not available (serverless environments).
 *
 * Features:
 * - Session presence updates
 * - Collaboration events
 * - Heartbeat/keepalive
 * - Graceful reconnection support
 */

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import {
  getCollaborationManager,
  type CollaborationEvent,
} from '@/lib/collaboration/collaboration-manager';
import { getDebugEventBroadcaster, type DebugEvent } from '@/lib/debugger/debug-event-broadcaster';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';

const log = logger('RealtimeAPI');

// ============================================================================
// CONSTANTS - HIGH-001 FIX: Memory leak prevention
// ============================================================================

/** Heartbeat interval in ms */
const HEARTBEAT_INTERVAL_MS = 30000;

/** Connection idle timeout in ms (5 minutes) */
const CONNECTION_IDLE_TIMEOUT_MS = 300000;

/** Max connection age in ms (1 hour) */
const MAX_CONNECTION_AGE_MS = 3600000;

/** Stale connection cleanup interval in ms (1 minute) */
const CLEANUP_INTERVAL_MS = 60000;

/** Max connections per user */
const MAX_CONNECTIONS_PER_USER = 5;

/** Singleton TextEncoder for performance */
const textEncoder = new TextEncoder();

// Event types
type SSEEvent =
  | { type: 'connected'; payload: { clientId: string; userId: string; sessionId?: string } }
  | { type: 'presence:update'; payload: PresenceUpdate }
  | { type: 'collaboration:operation'; payload: unknown }
  | { type: 'collaboration:cursor'; payload: unknown }
  | { type: 'collaboration:presence'; payload: unknown }
  | { type: 'user:joined'; payload: { userId: string; userName: string } }
  | { type: 'user:left'; payload: { userId: string } }
  | { type: 'heartbeat'; payload: { timestamp: number } }
  | { type: 'error'; payload: { message: string; code: string } }
  // Debug events
  | { type: 'debug:initialized'; payload: unknown }
  | { type: 'debug:connected'; payload: unknown }
  | { type: 'debug:disconnected'; payload: unknown }
  | { type: 'debug:output'; payload: { category: string; output: string } }
  | { type: 'debug:stopped'; payload: { reason: string; threadId: number } }
  | { type: 'debug:continued'; payload: { threadId: number } }
  | { type: 'debug:breakpoint'; payload: unknown }
  | { type: 'debug:terminated'; payload: unknown }
  | { type: 'debug:exited'; payload: { exitCode: number } }
  | { type: 'debug:process'; payload: unknown }
  | { type: 'debug:thread'; payload: unknown }
  | { type: 'debug:loadedSource'; payload: unknown }
  | { type: 'debug:error'; payload: { message: string } };

interface PresenceUpdate {
  userId: string;
  userName: string;
  cursorPosition?: { line: number; column: number };
  selection?: { startLine: number; endLine: number };
  status: 'active' | 'idle' | 'away';
  isTyping?: boolean;
}

// Active SSE connections (in-memory for single server)
interface SSEConnection {
  controller: ReadableStreamDefaultController;
  userId: string;
  sessionId?: string;
  lastActivity: number;
  createdAt: number;
  cleanup: () => void; // HIGH-001: Cleanup function for listeners
  cleaned: boolean; // Guard against double-cleanup
}

const activeConnections = new Map<string, SSEConnection>();

// Client ID counter — use crypto for uniqueness across concurrent requests
function generateClientId(): string {
  return `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// HIGH-001: Start stale connection cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [clientId, conn] of activeConnections) {
      // Check for idle timeout
      const idleTime = now - conn.lastActivity;
      if (idleTime > CONNECTION_IDLE_TIMEOUT_MS) {
        log.info('Closing idle SSE connection', { clientId, idleTime });
        staleConnections.push(clientId);
        continue;
      }

      // Check for max age
      const age = now - conn.createdAt;
      if (age > MAX_CONNECTION_AGE_MS) {
        log.info('Closing aged SSE connection', { clientId, age });
        staleConnections.push(clientId);
      }
    }

    // Clean up stale connections
    for (const clientId of staleConnections) {
      const conn = activeConnections.get(clientId);
      if (conn) {
        try {
          conn.cleanup();
          conn.controller.close();
        } catch {
          // Already closed
        }
        activeConnections.delete(clientId);
      }
    }

    if (staleConnections.length > 0) {
      log.info('Cleaned up stale SSE connections', { count: staleConnections.length });
    }
  }, CLEANUP_INTERVAL_MS);

  log.info('SSE cleanup interval started');
}

// Start cleanup on module load
startCleanupInterval();

/**
 * GET /api/code-lab/realtime
 *
 * Establishes SSE connection for real-time updates
 *
 * Query params:
 * - sessionId: Optional session to join
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // HIGH-001: Check max connections per user
    let userConnectionCount = 0;
    for (const conn of activeConnections.values()) {
      if (conn.userId === user.id) {
        userConnectionCount++;
      }
    }
    if (userConnectionCount >= MAX_CONNECTIONS_PER_USER) {
      log.warn('Max connections exceeded for user', {
        userId: user.id,
        count: userConnectionCount,
      });
      return new Response(
        JSON.stringify({ error: 'Too many connections', code: 'MAX_CONNECTIONS_EXCEEDED' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || undefined;

    // Generate unique client ID (no shared counter — avoids race conditions)
    const clientId = generateClientId();

    log.info('SSE connection requested', { clientId, userId: user.id, sessionId });

    // HIGH-001: Track cleanup functions for proper resource management
    const cleanupFunctions: (() => void)[] = [];
    let heartbeatInterval: NodeJS.Timeout | null = null;

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Guard against double-cleanup (abort + cancel can both fire)
        let cleaned = false;

        // HIGH-001: Central cleanup function — idempotent
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;

          // Mark connection as cleaned
          const conn = activeConnections.get(clientId);
          if (conn) conn.cleaned = true;

          // Clear heartbeat
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
          // Run all registered cleanup functions (event listeners)
          for (const fn of cleanupFunctions) {
            try {
              fn();
            } catch {
              // Ignore cleanup errors
            }
          }
          cleanupFunctions.length = 0;
        };

        const now = Date.now();

        // Store connection with cleanup function
        activeConnections.set(clientId, {
          controller,
          userId: user.id,
          sessionId,
          lastActivity: now,
          createdAt: now,
          cleanup,
          cleaned: false,
        });

        // Send connected event
        sendSSEEvent(controller, {
          type: 'connected',
          payload: { clientId, userId: user.id, sessionId },
        });

        // If session provided, set up collaboration and debug listeners
        if (sessionId) {
          const collabCleanup = setupCollaborationListeners(clientId, sessionId, controller);
          const debugCleanup = setupDebugListeners(clientId, sessionId, controller);
          cleanupFunctions.push(collabCleanup, debugCleanup);
        }

        // Set up heartbeat
        heartbeatInterval = setInterval(() => {
          const conn = activeConnections.get(clientId);
          if (!conn) {
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
            return;
          }

          try {
            sendSSEEvent(controller, {
              type: 'heartbeat',
              payload: { timestamp: Date.now() },
            });
            // Update last activity on successful heartbeat
            conn.lastActivity = Date.now();
          } catch {
            // Connection closed - full cleanup
            cleanup();
            activeConnections.delete(clientId);
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          log.info('SSE connection closed', { clientId, userId: user.id });
          cleanup();
          activeConnections.delete(clientId);

          // Notify session if applicable
          if (sessionId) {
            broadcastToSession(
              sessionId,
              {
                type: 'user:left',
                payload: { userId: user.id },
              },
              clientId
            );
          }
        });
      },
      cancel() {
        const conn = activeConnections.get(clientId);
        if (conn) {
          conn.cleanup();
        }
        activeConnections.delete(clientId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    log.error('SSE connection error', error as Error);
    return new Response(JSON.stringify({ error: 'Failed to establish connection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/code-lab/realtime
 *
 * Send event to session (for clients that need to push updates)
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) {
    return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Auth check
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const rateLimit = await rateLimiters.codeLabEdit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { type, sessionId, payload, clientId } = body as {
      type: string;
      sessionId: string;
      payload: unknown;
      clientId?: string;
    };

    if (!type || !sessionId) {
      return new Response(JSON.stringify({ error: 'Missing type or sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Broadcast to session
    const sent = broadcastToSession(sessionId, { type, payload } as SSEEvent, clientId);

    // Also update presence in database if it's a presence update
    // Note: Presence tracking requires migration 20260119_add_presence_table.sql
    // Skip for now if presence table doesn't exist - will be handled by presence service
    if (type === 'presence:update') {
      const presencePayload = payload as PresenceUpdate;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anySupabase = supabase as any;
        await anySupabase.rpc('upsert_code_lab_presence', {
          p_session_id: sessionId,
          p_user_id: user.id,
          p_user_name: presencePayload.userName || user.email?.split('@')[0] || 'Anonymous',
          p_user_email: user.email,
          p_client_id: clientId,
          p_cursor_line: presencePayload.cursorPosition?.line,
          p_cursor_column: presencePayload.cursorPosition?.column,
          p_status: presencePayload.status || 'active',
          p_is_typing: presencePayload.isTyping || false,
        });
      } catch (rpcError) {
        // RPC may fail if migration hasn't been run yet - log but don't fail
        log.warn('Presence RPC failed (migration may not be applied)', { error: rpcError });
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('SSE POST error', error as Error);
    return new Response(JSON.stringify({ error: 'Failed to send event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function sendSSEEvent(controller: ReadableStreamDefaultController, event: SSEEvent): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  // HIGH-001: Use singleton TextEncoder to avoid memory churn
  controller.enqueue(textEncoder.encode(data));
}

function broadcastToSession(sessionId: string, event: SSEEvent, excludeClientId?: string): number {
  let sent = 0;
  const deadConnections: string[] = [];

  for (const [clientId, conn] of activeConnections) {
    if (conn.sessionId === sessionId && clientId !== excludeClientId) {
      try {
        sendSSEEvent(conn.controller, event);
        sent++;
      } catch {
        // HIGH-001: Mark connection for cleanup
        deadConnections.push(clientId);
      }
    }
  }

  // HIGH-001: Clean up dead connections outside the loop
  for (const clientId of deadConnections) {
    const conn = activeConnections.get(clientId);
    if (conn) {
      try {
        conn.cleanup();
      } catch {
        // Ignore
      }
      activeConnections.delete(clientId);
    }
  }

  return sent;
}

/**
 * Set up collaboration event listeners
 * HIGH-001: Returns cleanup function to prevent memory leaks
 */
function setupCollaborationListeners(
  clientId: string,
  sessionId: string,
  controller: ReadableStreamDefaultController
): () => void {
  const manager = getCollaborationManager();

  // Listen for collaboration broadcasts
  const handleBroadcast = (event: CollaborationEvent) => {
    if (event.sessionId !== sessionId) return;

    const conn = activeConnections.get(clientId);
    if (!conn) {
      manager.off('broadcast', handleBroadcast);
      return;
    }

    try {
      sendSSEEvent(controller, {
        type: `collaboration:${event.type}` as SSEEvent['type'],
        payload: event.payload,
      } as SSEEvent);
    } catch {
      // Connection dead
      manager.off('broadcast', handleBroadcast);
    }
  };

  manager.on('broadcast', handleBroadcast);

  // HIGH-001: Return cleanup function
  return () => {
    manager.off('broadcast', handleBroadcast);
  };
}

/**
 * Set up debug event listeners for a connected client
 * Forwards debug events from the broadcaster to the SSE client
 * HIGH-001: Returns cleanup function to prevent memory leaks
 */
function setupDebugListeners(
  clientId: string,
  sessionId: string,
  controller: ReadableStreamDefaultController
): () => void {
  const broadcaster = getDebugEventBroadcaster();

  // Listen for all debug broadcasts
  const handleDebugBroadcast = (event: DebugEvent) => {
    // Only forward events for this session
    if (event.sessionId !== sessionId) return;

    const conn = activeConnections.get(clientId);
    if (!conn) {
      broadcaster.off('debug:broadcast', handleDebugBroadcast);
      return;
    }

    try {
      sendSSEEvent(controller, {
        type: event.type,
        payload: event.payload,
      } as SSEEvent);
    } catch {
      // Connection dead
      broadcaster.off('debug:broadcast', handleDebugBroadcast);
    }
  };

  broadcaster.on('debug:broadcast', handleDebugBroadcast);

  log.debug('Debug listeners set up', { clientId, sessionId });

  // HIGH-001: Return cleanup function
  return () => {
    broadcaster.off('debug:broadcast', handleDebugBroadcast);
  };
}
