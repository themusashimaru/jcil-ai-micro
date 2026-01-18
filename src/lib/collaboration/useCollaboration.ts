/**
 * USE COLLABORATION HOOK - CLIENT-SIDE COLLABORATION
 *
 * Provides React hook for collaborative editing:
 * - Session management
 * - Real-time updates via WebSocket
 * - Cursor sync
 * - Operation broadcasting
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/lib/realtime';
import { CRDTDocument, CRDTOperation, CursorPosition } from './crdt-document';

// ============================================================================
// TYPES
// ============================================================================

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
  isTyping: boolean;
}

export interface UseCollaborationOptions {
  token: string;
  documentId: string;
  userId: string;
  userName: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onUsersChange?: (users: CollaborationUser[]) => void;
  onRemoteCursor?: (cursor: CursorPosition) => void;
}

export interface UseCollaborationReturn {
  // State
  sessionId: string | null;
  content: string;
  users: CollaborationUser[];
  cursors: CursorPosition[];
  isConnected: boolean;
  error: string | null;

  // Document operations
  insert: (position: number, text: string) => void;
  delete: (position: number, length: number) => void;
  setContent: (newContent: string) => void;

  // Cursor operations
  updateCursor: (position: number, selection?: { start: number; end: number }) => void;

  // Session operations
  createSession: () => Promise<string>;
  joinSession: (sessionId: string) => Promise<boolean>;
  leaveSession: () => Promise<void>;

  // Sync
  sync: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationReturn {
  const {
    token,
    documentId,
    userId,
    userName,
    initialContent = '',
    onContentChange,
    onUsersChange,
    onRemoteCursor,
  } = options;

  // State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [content, setContent] = useState(initialContent);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const documentRef = useRef<CRDTDocument | null>(null);

  // Initialize document
  useEffect(() => {
    documentRef.current = new CRDTDocument(documentId, userId, initialContent);

    // Listen for local changes
    documentRef.current.on('change', ({ content: newContent }) => {
      setContent(newContent);
      onContentChange?.(newContent);
    });

    // Listen for cursor updates
    documentRef.current.on('cursorsChanged', (newCursors: CursorPosition[]) => {
      setCursors(newCursors);
    });

    return () => {
      documentRef.current?.removeAllListeners();
    };
  }, [documentId, userId, initialContent, onContentChange]);

  // WebSocket for real-time events
  const { send, on, isConnected } = useWebSocket({
    token,
    autoConnect: true,
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  useEffect(() => {
    if (!isConnected || !sessionId) return;

    // Listen for remote operations
    const unsubOperation = on('collaboration:operation', (msg) => {
      const payload = msg.payload as { operation: CRDTOperation };
      if (payload.operation.userId !== userId && documentRef.current) {
        documentRef.current.applyRemoteOperation(payload.operation);
      }
    });

    // Listen for remote cursor updates
    const unsubCursor = on('collaboration:cursor', (msg) => {
      const payload = msg.payload as CursorPosition;
      if (payload.userId !== userId) {
        documentRef.current?.applyRemoteCursor(payload);
        onRemoteCursor?.(payload);
      }
    });

    // Listen for presence changes
    const unsubPresence = on('collaboration:presence', (msg) => {
      const payload = msg.payload as { users: CollaborationUser[] };
      setUsers(payload.users);
      onUsersChange?.(payload.users);
    });

    // Listen for sync events
    const unsubSync = on('collaboration:sync', (msg) => {
      const payload = msg.payload as {
        content: string;
        operations: CRDTOperation[];
        vectorClock: Record<string, number>;
        version: number;
      };
      documentRef.current?.syncWithState(payload);
    });

    return () => {
      unsubOperation();
      unsubCursor();
      unsubPresence();
      unsubSync();
    };
  }, [isConnected, sessionId, userId, on, onRemoteCursor, onUsersChange]);

  // ============================================================================
  // API CALLS
  // ============================================================================

  const callAPI = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const response = await fetch('/api/code-lab/collaboration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ...params,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API request failed');
    }

    return response.json();
  }, []);

  // ============================================================================
  // DOCUMENT OPERATIONS
  // ============================================================================

  const insert = useCallback((position: number, text: string) => {
    if (!documentRef.current) return;

    const op = documentRef.current.insert(position, text);

    // Broadcast to other users
    if (sessionId && isConnected) {
      send('collaboration:operation', { sessionId, operation: op });
    }
  }, [sessionId, isConnected, send]);

  const deleteText = useCallback((position: number, length: number) => {
    if (!documentRef.current) return;

    const op = documentRef.current.delete(position, length);

    // Broadcast to other users
    if (sessionId && isConnected) {
      send('collaboration:operation', { sessionId, operation: op });
    }
  }, [sessionId, isConnected, send]);

  const setContentDirect = useCallback((newContent: string) => {
    if (!documentRef.current) return;

    // Calculate diff and apply as operations
    const currentContent = documentRef.current.getContent();

    // Simple replacement strategy - delete all, insert new
    if (currentContent.length > 0) {
      documentRef.current.delete(0, currentContent.length);
    }
    if (newContent.length > 0) {
      documentRef.current.insert(0, newContent);
    }
  }, []);

  // ============================================================================
  // CURSOR OPERATIONS
  // ============================================================================

  const updateCursor = useCallback((
    position: number,
    selection?: { start: number; end: number }
  ) => {
    if (!documentRef.current) return;

    documentRef.current.updateCursor(position, selection);

    // Broadcast to other users
    if (sessionId && isConnected) {
      send('collaboration:cursor', {
        sessionId,
        userId,
        userName,
        position,
        selection,
      });
    }
  }, [sessionId, userId, userName, isConnected, send]);

  // ============================================================================
  // SESSION OPERATIONS
  // ============================================================================

  const createSession = useCallback(async (): Promise<string> => {
    try {
      setError(null);

      const result = await callAPI('create', {
        documentId,
        initialContent: documentRef.current?.getContent() || initialContent,
      });

      setSessionId(result.session.id);
      setUsers(result.session.users || []);

      return result.session.id;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    }
  }, [documentId, initialContent, callAPI]);

  const joinSession = useCallback(async (targetSessionId: string): Promise<boolean> => {
    try {
      setError(null);

      const result = await callAPI('join', { sessionId: targetSessionId });

      if (result.success) {
        setSessionId(targetSessionId);
        setUsers(result.users || []);

        // Sync content
        if (result.content !== undefined) {
          documentRef.current?.syncWithState({
            content: result.content,
            operations: [],
            vectorClock: {},
            version: 0,
          });
        }

        return true;
      }

      return false;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      return false;
    }
  }, [callAPI]);

  const leaveSession = useCallback(async (): Promise<void> => {
    if (!sessionId) return;

    try {
      await callAPI('leave', { sessionId });
      setSessionId(null);
      setUsers([]);
      setCursors([]);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
    }
  }, [sessionId, callAPI]);

  // ============================================================================
  // SYNC
  // ============================================================================

  const sync = useCallback(async (): Promise<void> => {
    if (!sessionId || !documentRef.current) return;

    try {
      const state = documentRef.current.getState();
      await callAPI('sync', { sessionId, state });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
    }
  }, [sessionId, callAPI]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    sessionId,
    content,
    users,
    cursors,
    isConnected,
    error,

    // Document operations
    insert,
    delete: deleteText,
    setContent: setContentDirect,

    // Cursor operations
    updateCursor,

    // Session operations
    createSession,
    joinSession,
    leaveSession,

    // Sync
    sync,
  };
}
