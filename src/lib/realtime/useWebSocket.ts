/**
 * USE WEBSOCKET HOOK - CLIENT-SIDE REAL-TIME CONNECTION
 *
 * Provides:
 * - Automatic connection management
 * - Reconnection with exponential backoff
 * - Message sending/receiving
 * - Presence updates
 * - Session management
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  senderId?: string;
  timestamp: number;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  sessionId: string;
  cursorPosition?: { line: number; column: number };
  selection?: { startLine: number; endLine: number };
  lastActivity: number;
  status: 'active' | 'idle' | 'away';
}

export interface SessionMember {
  userId: string;
  userName: string;
  clientId: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketOptions {
  url?: string;
  token: string;
  sessionId?: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export interface UseWebSocketReturn {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  clientId: string | null;

  // Session
  sessionId: string | null;
  members: SessionMember[];

  // Actions
  connect: () => void;
  disconnect: () => void;
  send: (type: string, payload: unknown) => void;
  joinSession: (sessionId: string) => void;
  leaveSession: () => void;

  // Presence
  updatePresence: (presence: Partial<PresenceInfo>) => void;
  presenceList: PresenceInfo[];

  // Message handlers
  on: (type: string, handler: (message: WebSocketMessage) => void) => () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    token,
    sessionId: initialSessionId,
    autoConnect = true,
    reconnect = true,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [presenceList, setPresenceList] = useState<PresenceInfo[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef<Map<string, Set<(message: WebSocketMessage) => void>>>(new Map());

  // ============================================================================
  // MESSAGE HANDLING (defined first to be available in connect)
  // ============================================================================

  const handleMessage = useCallback((message: WebSocketMessage) => {
    // Handle built-in message types
    switch (message.type) {
      case 'connected':
        setClientId((message.payload as { clientId: string }).clientId);
        break;

      case 'session:joined': {
        const payload = message.payload as { sessionId: string; members: SessionMember[] };
        setSessionId(payload.sessionId);
        setMembers(payload.members);
        break;
      }

      case 'session:left':
        setSessionId(null);
        setMembers([]);
        setPresenceList([]);
        break;

      case 'presence:join': {
        const member = message.payload as SessionMember;
        setMembers((prev) => [...prev.filter((m) => m.clientId !== member.clientId), member]);
        break;
      }

      case 'presence:leave': {
        const { clientId: leavingClientId } = message.payload as { clientId: string };
        setMembers((prev) => prev.filter((m) => m.clientId !== leavingClientId));
        setPresenceList((prev) =>
          prev.filter((p) => p.userId !== (message.payload as { userId: string }).userId)
        );
        break;
      }

      case 'presence:update': {
        const presence = message.payload as PresenceInfo;
        setPresenceList((prev) => {
          const existing = prev.findIndex((p) => p.userId === presence.userId);
          if (existing !== -1) {
            const updated = [...prev];
            updated[existing] = presence;
            return updated;
          }
          return [...prev, presence];
        });
        break;
      }
    }

    // Call registered handlers
    const handlers = handlersRef.current.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Call wildcard handlers
    const wildcardHandlers = handlersRef.current.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }, []);

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState('connecting');

    // Build connection URL with auth
    const wsUrl = new URL(url);
    wsUrl.searchParams.set('token', token);
    if (sessionId) {
      wsUrl.searchParams.set('sessionId', sessionId);
    }

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('connected');
      reconnectAttemptsRef.current = 0;
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
        onMessage?.(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      wsRef.current = null;
      onDisconnect?.();

      // Attempt reconnection
      if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      setConnectionState('error');
      onError?.(error);
    };
  }, [
    url,
    token,
    sessionId,
    reconnect,
    maxReconnectAttempts,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    handleMessage,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent reconnection
    wsRef.current?.close();
  }, [maxReconnectAttempts]);

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type,
          payload,
          timestamp: Date.now(),
        })
      );
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  const joinSession = useCallback(
    (newSessionId: string) => {
      send('session:join', { sessionId: newSessionId });
    },
    [send]
  );

  const leaveSession = useCallback(() => {
    send('session:leave', {});
  }, [send]);

  const updatePresence = useCallback(
    (presence: Partial<PresenceInfo>) => {
      send('presence:update', presence);
    },
    [send]
  );

  const on = useCallback((type: string, handler: (message: WebSocketMessage) => void) => {
    let handlers = handlersRef.current.get(type);
    if (!handlers) {
      handlers = new Set();
      handlersRef.current.set(type, handlers);
    }
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers?.delete(handler);
    };
  }, []);

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  useEffect(() => {
    if (autoConnect && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, token, connect, disconnect]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    clientId,

    sessionId,
    members,

    connect,
    disconnect,
    send,
    joinSession,
    leaveSession,

    updatePresence,
    presenceList,

    on,
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook for just presence tracking
 */
export function usePresence(
  token: string,
  sessionId: string
): {
  members: SessionMember[];
  presenceList: PresenceInfo[];
  updateCursor: (line: number, column: number) => void;
  updateSelection: (startLine: number, endLine: number) => void;
  updateStatus: (status: 'active' | 'idle' | 'away') => void;
} {
  const { members, presenceList, updatePresence, isConnected } = useWebSocket({
    token,
    sessionId,
  });

  const updateCursor = useCallback(
    (line: number, column: number) => {
      if (isConnected) {
        updatePresence({ cursorPosition: { line, column } });
      }
    },
    [isConnected, updatePresence]
  );

  const updateSelection = useCallback(
    (startLine: number, endLine: number) => {
      if (isConnected) {
        updatePresence({ selection: { startLine, endLine } });
      }
    },
    [isConnected, updatePresence]
  );

  const updateStatus = useCallback(
    (status: 'active' | 'idle' | 'away') => {
      if (isConnected) {
        updatePresence({ status });
      }
    },
    [isConnected, updatePresence]
  );

  return {
    members,
    presenceList,
    updateCursor,
    updateSelection,
    updateStatus,
  };
}
