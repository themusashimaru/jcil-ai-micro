/**
 * COLLABORATION API - REAL-TIME COLLABORATIVE EDITING
 *
 * Provides REST API for collaboration operations:
 * - Create/join/leave sessions
 * - Apply operations
 * - Update cursors
 * - Sync state
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import {
  getCollaborationManager,
  CollaborationSession,
} from '@/lib/collaboration/collaboration-manager';
import { CRDTOperation } from '@/lib/collaboration/crdt-document';
import { logger } from '@/lib/logger';

const log = logger('CollaborationAPI');

/**
 * POST /api/code-lab/collaboration
 *
 * Collaboration actions: create, join, leave, operation, cursor, sync
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await request.json();
    const { action, ...params } = body as {
      action: string;
      [key: string]: unknown;
    };

    const manager = getCollaborationManager();

    switch (action) {
      case 'create': {
        const { documentId, initialContent } = params as {
          documentId: string;
          initialContent?: string;
        };

        if (!documentId) {
          return NextResponse.json(
            { error: 'Missing documentId' },
            { status: 400 }
          );
        }

        log.info('Creating collaboration session', {
          userId: auth.user.id,
          documentId,
        });

        const session = manager.createSession(
          documentId,
          auth.user.id,
          auth.user.email || 'Anonymous',
          initialContent || ''
        );

        return NextResponse.json({
          success: true,
          session: serializeSession(session),
        });
      }

      case 'join': {
        const { sessionId } = params as { sessionId: string };

        if (!sessionId) {
          return NextResponse.json(
            { error: 'Missing sessionId' },
            { status: 400 }
          );
        }

        log.info('Joining collaboration session', {
          userId: auth.user.id,
          sessionId,
        });

        const result = manager.joinSession(
          sessionId,
          auth.user.id,
          auth.user.email || 'Anonymous'
        );

        if (!result) {
          return NextResponse.json(
            { error: 'Session not found or inactive' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          session: serializeSession(result.session),
          users: result.users,
          content: result.content,
        });
      }

      case 'leave': {
        const { sessionId } = params as { sessionId: string };

        if (!sessionId) {
          return NextResponse.json(
            { error: 'Missing sessionId' },
            { status: 400 }
          );
        }

        manager.leaveSession(sessionId, auth.user.id);

        return NextResponse.json({ success: true });
      }

      case 'operation': {
        const { sessionId, operation } = params as {
          sessionId: string;
          operation: CRDTOperation;
        };

        if (!sessionId || !operation) {
          return NextResponse.json(
            { error: 'Missing sessionId or operation' },
            { status: 400 }
          );
        }

        const applied = manager.applyOperation(sessionId, auth.user.id, operation);

        return NextResponse.json({
          success: applied,
          message: applied ? 'Operation applied' : 'Operation rejected',
        });
      }

      case 'cursor': {
        const { sessionId, position, selection } = params as {
          sessionId: string;
          position: number;
          selection?: { start: number; end: number };
        };

        if (!sessionId || position === undefined) {
          return NextResponse.json(
            { error: 'Missing sessionId or position' },
            { status: 400 }
          );
        }

        manager.updateCursor(sessionId, auth.user.id, position, selection);

        return NextResponse.json({ success: true });
      }

      case 'sync': {
        const { sessionId, state } = params as {
          sessionId: string;
          state: {
            content: string;
            operations: CRDTOperation[];
            vectorClock: Record<string, number>;
            version: number;
          };
        };

        if (!sessionId || !state) {
          return NextResponse.json(
            { error: 'Missing sessionId or state' },
            { status: 400 }
          );
        }

        manager.syncDocument(sessionId, auth.user.id, state);

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    log.error('Collaboration API error', error as Error);
    return NextResponse.json(
      { error: 'Collaboration operation failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/code-lab/collaboration
 *
 * Get collaboration session info
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check (GET - no CSRF needed)
    const auth = await requireUser();
    if (!auth.authorized) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const documentId = searchParams.get('documentId');

    const manager = getCollaborationManager();

    if (sessionId) {
      // Get specific session
      const session = manager.getSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({
        session: serializeSession(session),
      });
    }

    if (documentId) {
      // Get all sessions for document
      const sessions = manager.getDocumentSessions(documentId);
      return NextResponse.json({
        sessions: sessions.map(serializeSession),
      });
    }

    // Get all sessions for user
    const sessions = manager.getUserSessions(auth.user.id);
    return NextResponse.json({
      sessions: sessions.map(serializeSession),
    });
  } catch (error) {
    log.error('Collaboration API error', error as Error);
    return NextResponse.json(
      { error: 'Failed to get collaboration info' },
      { status: 500 }
    );
  }
}

// Helper to serialize session for JSON response
function serializeSession(session: CollaborationSession): Record<string, unknown> {
  return {
    id: session.id,
    documentId: session.documentId,
    ownerId: session.ownerId,
    createdAt: session.createdAt.toISOString(),
    users: Array.from(session.users.values()).map((user) => ({
      id: user.id,
      name: user.name,
      color: user.color,
      joinedAt: user.joinedAt.toISOString(),
      lastActivity: user.lastActivity.toISOString(),
      cursor: user.cursor,
      isTyping: user.isTyping,
    })),
    isActive: session.isActive,
  };
}
