/**
 * REAL-TIME MODULE EXPORTS
 *
 * Provides WebSocket infrastructure for:
 * - Real-time collaboration
 * - Presence tracking
 * - Live updates
 * - Debugger events
 */

// Server-side
export {
  CodeLabWebSocketServer,
  getWebSocketServer,
  initializeWebSocketServer,
  type WebSocketClient,
  type WebSocketMessage,
  type PresenceInfo,
  type MessageHandler,
} from './websocket-server';

// Client-side
export {
  useWebSocket,
  usePresence,
  type UseWebSocketOptions,
  type UseWebSocketReturn,
  type ConnectionState,
  type SessionMember,
} from './useWebSocket';
