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

const log = logger('RealtimeAPI');

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
const activeConnections = new Map<
  string,
  {
    controller: ReadableStreamDefaultController;
    userId: string;
    sessionId?: string;
    lastActivity: number;
  }
>();

// Client ID counter
let clientIdCounter = 0;

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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || undefined;

    // Generate client ID
    const clientId = `sse-${++clientIdCounter}-${Date.now()}`;

    log.info('SSE connection requested', { clientId, userId: user.id, sessionId });

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Store connection
        activeConnections.set(clientId, {
          controller,
          userId: user.id,
          sessionId,
          lastActivity: Date.now(),
        });

        // Send connected event
        sendSSEEvent(controller, {
          type: 'connected',
          payload: { clientId, userId: user.id, sessionId },
        });

        // If session provided, set up collaboration and debug listeners
        if (sessionId) {
          setupCollaborationListeners(clientId, sessionId, controller);
          setupDebugListeners(clientId, sessionId, controller);
        }

        // Set up heartbeat
        const heartbeatInterval = setInterval(() => {
          const conn = activeConnections.get(clientId);
          if (!conn) {
            clearInterval(heartbeatInterval);
            return;
          }

          try {
            sendSSEEvent(controller, {
              type: 'heartbeat',
              payload: { timestamp: Date.now() },
            });
          } catch {
            // Connection closed
            clearInterval(heartbeatInterval);
            activeConnections.delete(clientId);
          }
        }, 30000); // 30 second heartbeat

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          log.info('SSE connection closed', { clientId, userId: user.id });
          clearInterval(heartbeatInterval);
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
  controller.enqueue(new TextEncoder().encode(data));
}

function broadcastToSession(sessionId: string, event: SSEEvent, excludeClientId?: string): number {
  let sent = 0;

  for (const [clientId, conn] of activeConnections) {
    if (conn.sessionId === sessionId && clientId !== excludeClientId) {
      try {
        sendSSEEvent(conn.controller, event);
        sent++;
      } catch {
        // Connection dead, remove it
        activeConnections.delete(clientId);
      }
    }
  }

  return sent;
}

function setupCollaborationListeners(
  clientId: string,
  sessionId: string,
  controller: ReadableStreamDefaultController
): void {
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
      activeConnections.delete(clientId);
      manager.off('broadcast', handleBroadcast);
    }
  };

  manager.on('broadcast', handleBroadcast);
}

/**
 * Set up debug event listeners for a connected client
 * Forwards debug events from the broadcaster to the SSE client
 */
function setupDebugListeners(
  clientId: string,
  sessionId: string,
  controller: ReadableStreamDefaultController
): void {
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
      activeConnections.delete(clientId);
      broadcaster.off('debug:broadcast', handleDebugBroadcast);
    }
  };

  broadcaster.on('debug:broadcast', handleDebugBroadcast);

  log.debug('Debug listeners set up', { clientId, sessionId });
}
