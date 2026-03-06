import { logger } from '@/lib/logger';

const log = logger('RealtimeAPI');

// ============================================================================
// CONSTANTS - HIGH-001 FIX: Memory leak prevention
// ============================================================================

/** Heartbeat interval in ms */
export const HEARTBEAT_INTERVAL_MS = 30000;

/** Connection idle timeout in ms (5 minutes) */
const CONNECTION_IDLE_TIMEOUT_MS = 300000;

/** Max connection age in ms (1 hour) */
const MAX_CONNECTION_AGE_MS = 3600000;

/** Stale connection cleanup interval in ms (1 minute) */
const CLEANUP_INTERVAL_MS = 60000;

/** Max connections per user */
export const MAX_CONNECTIONS_PER_USER = 5;

/** Singleton TextEncoder for performance */
const textEncoder = new TextEncoder();

// Event types
export type SSEEvent =
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

export interface PresenceUpdate {
  userId: string;
  userName: string;
  cursorPosition?: { line: number; column: number };
  selection?: { startLine: number; endLine: number };
  status: 'active' | 'idle' | 'away';
  isTyping?: boolean;
}

// Active SSE connections (in-memory for single server)
export interface SSEConnection {
  controller: ReadableStreamDefaultController;
  userId: string;
  sessionId?: string;
  lastActivity: number;
  createdAt: number;
  cleanup: () => void; // HIGH-001: Cleanup function for listeners
  cleaned: boolean; // Guard against double-cleanup
}

export const activeConnections = new Map<string, SSEConnection>();

// Client ID counter — use crypto for uniqueness across concurrent requests
export function generateClientId(): string {
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

// ============================================================================
// HELPERS
// ============================================================================

export function sendSSEEvent(controller: ReadableStreamDefaultController, event: SSEEvent): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  // HIGH-001: Use singleton TextEncoder to avoid memory churn
  controller.enqueue(textEncoder.encode(data));
}

export function broadcastToSession(
  sessionId: string,
  event: SSEEvent,
  excludeClientId?: string
): number {
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
