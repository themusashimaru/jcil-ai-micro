/**
 * DEBUG API - REAL DEBUGGING ENDPOINTS
 *
 * Provides REST API for debug operations:
 * - Start/stop debug sessions
 * - Set breakpoints
 * - Step controls
 * - Variable inspection
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { getDebugManager } from '@/lib/debugger/debug-manager';
import { DebugConfiguration, Source } from '@/lib/debugger/debug-adapter';
import { rateLimiters } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('DebugAPI');

/**
 * POST /api/code-lab/debug
 *
 * Debug actions: start, stop, setBreakpoints, continue, stepOver, stepInto, stepOut, pause
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check (includes CSRF protection)
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    // Rate limiting
    const rateLimitResult = await rateLimiters.codeLabDebug(auth.user.id);
    if (!rateLimitResult.allowed) {
      return errors.rateLimited(rateLimitResult.retryAfter);
    }

    const body = await request.json();
    const { action, sessionId, ...params } = body as {
      action: string;
      sessionId?: string;
      [key: string]: unknown;
    };

    const debugManager = getDebugManager();

    switch (action) {
      case 'start': {
        const config = params.config as DebugConfiguration;
        const workspaceId = (params.workspaceId as string) || auth.user.id;

        if (!config || !config.type || !config.program) {
          return errors.badRequest('Invalid debug configuration. Required: type, program');
        }

        log.info('Starting debug session', { userId: auth.user.id, type: config.type });

        const debugSession = await debugManager.startSession(auth.user.id, workspaceId, config);

        return successResponse({
          success: true,
          session: debugSession,
        });
      }

      case 'stop': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        await debugManager.stopSession(sessionId);

        return successResponse({ success: true });
      }

      case 'setBreakpoints': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const source = params.source as Source;
        const breakpoints = params.breakpoints as Array<{
          line: number;
          column?: number;
          condition?: string;
        }>;

        if (!source || !breakpoints) {
          return errors.badRequest('Missing source or breakpoints');
        }

        const verified = await debugManager.setBreakpoints(sessionId, source, breakpoints);

        return successResponse({
          success: true,
          breakpoints: verified,
        });
      }

      case 'continue': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.continue(sessionId, threadId);

        return successResponse({ success: true });
      }

      case 'stepOver': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.stepOver(sessionId, threadId);

        return successResponse({ success: true });
      }

      case 'stepInto': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.stepInto(sessionId, threadId);

        return successResponse({ success: true });
      }

      case 'stepOut': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.stepOut(sessionId, threadId);

        return successResponse({ success: true });
      }

      case 'pause': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.pause(sessionId, threadId);

        return successResponse({ success: true });
      }

      case 'getThreads': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const threads = await debugManager.getThreads(sessionId);

        return successResponse({ success: true, threads });
      }

      case 'getStackTrace': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const threadId = (params.threadId as number) || 1;
        const startFrame = params.startFrame as number | undefined;
        const levels = params.levels as number | undefined;

        const stackFrames = await debugManager.getStackTrace(
          sessionId,
          threadId,
          startFrame,
          levels
        );

        return successResponse({ success: true, stackFrames });
      }

      case 'getScopes': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const frameId = params.frameId as number;
        if (frameId === undefined) {
          return errors.badRequest('Missing frameId');
        }

        const scopes = await debugManager.getScopes(sessionId, frameId);

        return successResponse({ success: true, scopes });
      }

      case 'getVariables': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const variablesReference = params.variablesReference as number;
        if (variablesReference === undefined) {
          return errors.badRequest('Missing variablesReference');
        }

        const variables = await debugManager.getVariables(sessionId, variablesReference);

        return successResponse({ success: true, variables });
      }

      case 'evaluate': {
        if (!sessionId) {
          return errors.badRequest('Missing sessionId');
        }

        const expression = params.expression as string;
        if (!expression) {
          return errors.badRequest('Missing expression');
        }

        const frameId = params.frameId as number | undefined;
        const context = params.context as 'watch' | 'repl' | 'hover' | undefined;

        const result = await debugManager.evaluate(sessionId, expression, frameId, context);

        return successResponse({ success: true, ...result });
      }

      default:
        return errors.badRequest(`Unknown action: ${action}`);
    }
  } catch (error) {
    log.error('Debug API error', error as Error);
    return errors.serverError('Debug operation failed');
  }
}

/**
 * GET /api/code-lab/debug
 *
 * Get debug session info or list sessions
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
    const workspaceId = searchParams.get('workspaceId');

    const debugManager = getDebugManager();

    if (sessionId) {
      // Get specific session
      const debugSession = debugManager.getSession(sessionId);
      if (!debugSession) {
        return errors.sessionNotFound();
      }

      return successResponse({ session: debugSession });
    }

    if (workspaceId) {
      // Get all sessions for workspace
      const sessions = debugManager.getWorkspaceSessions(workspaceId);
      return successResponse({ sessions });
    }

    // Get all sessions for user
    const sessions = debugManager.getUserSessions(auth.user.id);
    return successResponse({ sessions });
  } catch (error) {
    log.error('Debug API error', error as Error);
    return errors.serverError('Failed to get debug sessions');
  }
}
