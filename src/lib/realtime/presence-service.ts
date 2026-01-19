/**
 * PRESENCE SERVICE - DATABASE-BACKED PRESENCE TRACKING
 *
 * Provides:
 * - Persistent presence storage in Supabase
 * - Integration with WebSocket server
 * - Cleanup of stale entries
 * - Session presence queries
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getWebSocketServer } from './websocket-server';
import { getCollaborationManager } from '@/lib/collaboration/collaboration-manager';
import { logger } from '@/lib/logger';

const log = logger('PresenceService');

// ============================================================================
// TYPES
// ============================================================================

export interface PresenceData {
  userId: string;
  userName: string;
  userEmail?: string;
  clientId: string;
  color?: string;
  cursorLine?: number;
  cursorColumn?: number;
  cursorPosition?: number;
  selectionStartLine?: number;
  selectionEndLine?: number;
  selectionStart?: number;
  selectionEnd?: number;
  status: 'active' | 'idle' | 'away';
  isTyping?: boolean;
  lastActivity?: Date;
}

export interface SessionPresence {
  sessionId: string;
  users: PresenceData[];
}

// ============================================================================
// PRESENCE SERVICE
// ============================================================================

class PresenceService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  /**
   * Initialize the presence service
   * Sets up WebSocket bridge and cleanup interval
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Set up WebSocket server bridge
    this.setupWebSocketBridge();

    // Set up collaboration manager bridge
    this.setupCollaborationBridge();

    // Start cleanup interval (every 2 minutes)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupStalePresence().catch((err) => {
          log.error('Presence cleanup failed', err);
        });
      },
      2 * 60 * 1000
    );

    this.initialized = true;
    log.info('Presence service initialized');
  }

  /**
   * Bridge WebSocket events to presence database
   */
  private setupWebSocketBridge(): void {
    const wsServer = getWebSocketServer();

    // When a client joins a session
    wsServer.on('join:session', async (client, message) => {
      const { sessionId } = message.payload as { sessionId: string };

      await this.upsertPresence(sessionId, {
        userId: client.userId,
        userName: client.userName,
        clientId: client.id,
        status: 'active',
      });

      // Broadcast to other clients in session
      const presence = await this.getSessionPresence(sessionId);
      wsServer.broadcastToSession(
        sessionId,
        {
          type: 'presence:list',
          payload: { users: presence },
          timestamp: Date.now(),
        },
        client.id
      );
    });

    // When presence is updated
    wsServer.on('presence:update', async (client, message) => {
      if (!client.sessionId) return;

      const payload = message.payload as Partial<PresenceData>;

      await this.upsertPresence(client.sessionId, {
        userId: client.userId,
        userName: client.userName,
        clientId: client.id,
        status: payload.status || 'active',
        cursorLine: payload.cursorLine,
        cursorColumn: payload.cursorColumn,
        cursorPosition: payload.cursorPosition,
        selectionStartLine: payload.selectionStartLine,
        selectionEndLine: payload.selectionEndLine,
        isTyping: payload.isTyping,
      });
    });

    // When a client disconnects
    wsServer.on('user:left', async (client) => {
      if (client.sessionId) {
        await this.removePresence(client.sessionId, client.userId);
      }
    });
  }

  /**
   * Bridge collaboration manager events to presence
   */
  private setupCollaborationBridge(): void {
    const collabManager = getCollaborationManager();

    // When cursor updates come through collaboration
    collabManager.on('cursor', async (event) => {
      const { sessionId, userId, payload } = event;
      const cursor = payload as { position: number; selection?: { start: number; end: number } };

      // Get session to find user info
      const session = collabManager.getSession(sessionId);
      if (!session) return;

      const user = session.users.get(userId);
      if (!user) return;

      await this.upsertPresence(sessionId, {
        userId,
        userName: user.name,
        clientId: `collab-${userId}`,
        status: 'active',
        cursorPosition: cursor.position,
        selectionStart: cursor.selection?.start,
        selectionEnd: cursor.selection?.end,
      });
    });
  }

  /**
   * Upsert presence for a user in a session
   * Note: RPC functions created in migration 20260119_add_presence_table.sql
   */
  async upsertPresence(sessionId: string, data: PresenceData): Promise<void> {
    try {
      const supabase = createServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySupabase = supabase as any;

      const { error } = await anySupabase.rpc('upsert_code_lab_presence', {
        p_session_id: sessionId,
        p_user_id: data.userId,
        p_user_name: data.userName,
        p_user_email: data.userEmail || null,
        p_client_id: data.clientId,
        p_color: data.color || null,
        p_cursor_line: data.cursorLine || null,
        p_cursor_column: data.cursorColumn || null,
        p_cursor_position: data.cursorPosition || null,
        p_selection_start_line: data.selectionStartLine || null,
        p_selection_end_line: data.selectionEndLine || null,
        p_selection_start: data.selectionStart || null,
        p_selection_end: data.selectionEnd || null,
        p_status: data.status,
        p_is_typing: data.isTyping || false,
      });

      if (error) {
        log.error('Failed to upsert presence', { error, sessionId, userId: data.userId });
      }
    } catch (error) {
      log.error('Presence upsert error', error as Error);
    }
  }

  /**
   * Remove presence for a user from a session
   */
  async removePresence(sessionId: string, userId: string): Promise<void> {
    try {
      const supabase = createServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySupabase = supabase as any;

      const { error } = await anySupabase.rpc('remove_code_lab_presence', {
        p_session_id: sessionId,
        p_user_id: userId,
      });

      if (error) {
        log.error('Failed to remove presence', { error, sessionId, userId });
      }
    } catch (error) {
      log.error('Presence removal error', error as Error);
    }
  }

  /**
   * Get all presence entries for a session
   */
  async getSessionPresence(sessionId: string): Promise<PresenceData[]> {
    try {
      const supabase = createServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySupabase = supabase as any;

      const { data, error } = await anySupabase.rpc('get_session_presence', {
        p_session_id: sessionId,
      });

      if (error) {
        log.error('Failed to get session presence', { error, sessionId });
        return [];
      }

      return (data || []).map(
        (row: {
          user_id: string;
          user_name: string;
          user_email?: string;
          client_id: string;
          color?: string;
          cursor_line?: number;
          cursor_column?: number;
          cursor_position?: number;
          selection_start_line?: number;
          selection_end_line?: number;
          status: string;
          is_typing?: boolean;
          last_activity?: string;
        }) => ({
          userId: row.user_id,
          userName: row.user_name,
          userEmail: row.user_email,
          clientId: row.client_id,
          color: row.color,
          cursorLine: row.cursor_line,
          cursorColumn: row.cursor_column,
          cursorPosition: row.cursor_position,
          selectionStartLine: row.selection_start_line,
          selectionEndLine: row.selection_end_line,
          status: row.status as 'active' | 'idle' | 'away',
          isTyping: row.is_typing,
          lastActivity: row.last_activity ? new Date(row.last_activity) : undefined,
        })
      );
    } catch (error) {
      log.error('Get session presence error', error as Error);
      return [];
    }
  }

  /**
   * Cleanup stale presence entries
   */
  async cleanupStalePresence(): Promise<number> {
    try {
      const supabase = createServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySupabase = supabase as any;

      const { data, error } = await anySupabase.rpc('cleanup_stale_code_lab_presence');

      if (error) {
        log.error('Presence cleanup RPC error', { error });
        return 0;
      }

      const deleted = data as number;
      if (deleted > 0) {
        log.info('Cleaned up stale presence entries', { deleted });
      }

      return deleted;
    } catch (error) {
      log.error('Presence cleanup error', error as Error);
      return 0;
    }
  }

  /**
   * Broadcast presence update to all connected clients in a session
   */
  broadcastPresenceUpdate(sessionId: string, data: PresenceData, excludeClientId?: string): void {
    const wsServer = getWebSocketServer();

    wsServer.broadcastToSession(
      sessionId,
      {
        type: 'presence:updated',
        payload: data,
        timestamp: Date.now(),
      },
      excludeClientId
    );
  }

  /**
   * Get active user count for a session
   */
  async getActiveUserCount(sessionId: string): Promise<number> {
    const presence = await this.getSessionPresence(sessionId);
    return presence.filter((p) => p.status === 'active').length;
  }

  /**
   * Shutdown the presence service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.initialized = false;
    log.info('Presence service shutdown');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let presenceServiceInstance: PresenceService | null = null;

export function getPresenceService(): PresenceService {
  if (!presenceServiceInstance) {
    presenceServiceInstance = new PresenceService();
  }
  return presenceServiceInstance;
}

export async function initializePresenceService(): Promise<PresenceService> {
  const service = getPresenceService();
  await service.initialize();
  return service;
}
