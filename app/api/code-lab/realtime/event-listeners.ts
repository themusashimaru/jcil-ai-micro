import {
  getCollaborationManager,
  type CollaborationEvent,
} from '@/lib/collaboration/collaboration-manager';
import { getDebugEventBroadcaster, type DebugEvent } from '@/lib/debugger/debug-event-broadcaster';
import { logger } from '@/lib/logger';
import { activeConnections, sendSSEEvent, type SSEEvent } from './sse-connections';

const log = logger('RealtimeAPI');

/**
 * Set up collaboration event listeners
 * HIGH-001: Returns cleanup function to prevent memory leaks
 */
export function setupCollaborationListeners(
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
export function setupDebugListeners(
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
