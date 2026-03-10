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
import { requireUser } from '@/lib/auth/user-guard';
import { untypedRpc } from '@/lib/supabase/workspace-client';
import { logger } from '@/lib/logger';
import { rateLimiters } from '@/lib/security/rate-limit';
import {
  HEARTBEAT_INTERVAL_MS,
  MAX_CONNECTIONS_PER_USER,
  activeConnections,
  generateClientId,
  sendSSEEvent,
  broadcastToSession,
  type SSEEvent,
  type PresenceUpdate,
} from './sse-connections';
import { setupCollaborationListeners, setupDebugListeners } from './event-listeners';

const log = logger('RealtimeAPI');

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
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;
    const { user } = auth;

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
  try {
    // Auth + CSRF protection
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const { user, supabase } = auth;

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
        await untypedRpc(supabase, 'upsert_code_lab_presence', {
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
