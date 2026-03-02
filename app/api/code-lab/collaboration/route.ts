/**
 * COLLABORATION API - REAL-TIME COLLABORATIVE EDITING
 *
 * Provides REST API for collaboration operations:
 * - Create/join/leave sessions
 * - Apply operations
 * - Update cursors
 * - Sync state
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import {
  getCollaborationManager,
  CollaborationSession,
} from '@/lib/collaboration/collaboration-manager';
import { CRDTOperation } from '@/lib/collaboration/crdt-document';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('CollaborationAPI');

/**
 * POST /api/code-lab/collaboration
 *
 * Collaboration actions: create, join, leave, operation, cursor, sync
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    // Auth check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    // Rate limiting
    const rateLimit = await rateLimiters.codeLabEdit(auth.user!.id);
    if (!rateLimit.allowed) {
      return errors.rateLimited(rateLimit.retryAfter);
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
          return errors.badRequest('Missing documentId');
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

        return successResponse({
          success: true,
          session: serializeSession(session),
        });
      }

      case 'join': {
        const { sessionId } = params as { sessionId: string };

        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        log.info('Joining collaboration session', {
          userId: auth.user.id,
          sessionId,
        });

        const result = await manager.joinSession(
          sessionId,
          auth.user.id,
          auth.user.email || 'Anonymous'
        );

        if (!result) {
          return errors.notFound('Session');
        }

        return successResponse({
          success: true,
          session: serializeSession(result.session),
          users: result.users,
          content: result.content,
        });
      }

      case 'leave': {
        const { sessionId } = params as { sessionId: string };

        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        manager.leaveSession(sessionId, auth.user.id);

        return successResponse({ success: true });
      }

      case 'operation': {
        const { sessionId, operation } = params as {
          sessionId: string;
          operation: CRDTOperation;
        };

        if (!sessionId || !operation) {
          return errors.badRequest('Missing sessionId or operation');
        }

        const applied = manager.applyOperation(sessionId, auth.user.id, operation);

        return successResponse({
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
          return errors.badRequest('Missing sessionId or position');
        }

        manager.updateCursor(sessionId, auth.user.id, position, selection);

        return successResponse({ success: true });
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
          return errors.badRequest('Missing sessionId or state');
        }

        manager.syncDocument(sessionId, auth.user.id, state);

        return successResponse({ success: true });
      }

      default:
        return errors.badRequest(`Unknown action: ${action}`);
    }
  } catch (error) {
    log.error('Collaboration API error', error as Error);
    return errors.serverError('Collaboration operation failed');
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
        return errors.notFound('Session');
      }

      return successResponse({
        session: serializeSession(session),
      });
    }

    if (documentId) {
      // Get all sessions for document
      const sessions = manager.getDocumentSessions(documentId);
      return successResponse({
        sessions: sessions.map(serializeSession),
      });
    }

    // Get all sessions for user
    const sessions = manager.getUserSessions(auth.user.id);
    return successResponse({
      sessions: sessions.map(serializeSession),
    });
  } catch (error) {
    log.error('Collaboration API error', error as Error);
    return errors.serverError('Failed to get collaboration info');
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
