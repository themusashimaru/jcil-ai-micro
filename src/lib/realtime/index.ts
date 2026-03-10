/**
 * REAL-TIME MODULE EXPORTS
 *
 * Provides WebSocket infrastructure for:
 * - Real-time collaboration
 * - Presence tracking
 * - Live updates
 * - Debugger events
 *
 * NOTE: This index exports only CLIENT-SAFE modules.
 * For server-only modules, import directly:
 * - import { getWebSocketServer } from '@/lib/realtime/websocket-server'
 * - import { getPresenceService } from '@/lib/realtime/presence-service'
 */

// Client-side hooks (safe to use in components)
export {
  useWebSocket,
  usePresence,
  type UseWebSocketOptions,
  type UseWebSocketReturn,
  type ConnectionState,
  type SessionMember,
} from './useWebSocket';

// Re-export types only (no runtime imports)
export type {
  WebSocketClient,
  WebSocketMessage,
  PresenceInfo,
  MessageHandler,
} from './websocket-server';

export type { PresenceData, SessionPresence } from './presence-service';
