/**
 * DEBUG API - REAL DEBUGGING ENDPOINTS
 *
 * Provides REST API for debug operations:
 * - Start/stop debug sessions
 * - Set breakpoints
 * - Step controls
 * - Variable inspection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDebugManager } from '@/lib/debugger/debug-manager';
import { DebugConfiguration, Source } from '@/lib/debugger/debug-adapter';
import { logger } from '@/lib/logger';

const log = logger('DebugAPI');

/**
 * POST /api/code-lab/debug
 *
 * Debug actions: start, stop, setBreakpoints, continue, stepOver, stepInto, stepOut, pause
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        const workspaceId = (params.workspaceId as string) || session.user.id;

        if (!config || !config.type || !config.program) {
          return NextResponse.json(
            { error: 'Invalid debug configuration. Required: type, program' },
            { status: 400 }
          );
        }

        log.info('Starting debug session', { userId: session.user.id, type: config.type });

        const debugSession = await debugManager.startSession(
          session.user.id,
          workspaceId,
          config
        );

        return NextResponse.json({
          success: true,
          session: debugSession,
        });
      }

      case 'stop': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        await debugManager.stopSession(sessionId);

        return NextResponse.json({ success: true });
      }

      case 'setBreakpoints': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const source = params.source as Source;
        const breakpoints = params.breakpoints as Array<{
          line: number;
          column?: number;
          condition?: string;
        }>;

        if (!source || !breakpoints) {
          return NextResponse.json(
            { error: 'Missing source or breakpoints' },
            { status: 400 }
          );
        }

        const verified = await debugManager.setBreakpoints(sessionId, source, breakpoints);

        return NextResponse.json({
          success: true,
          breakpoints: verified,
        });
      }

      case 'continue': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.continue(sessionId, threadId);

        return NextResponse.json({ success: true });
      }

      case 'stepOver': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.stepOver(sessionId, threadId);

        return NextResponse.json({ success: true });
      }

      case 'stepInto': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.stepInto(sessionId, threadId);

        return NextResponse.json({ success: true });
      }

      case 'stepOut': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.stepOut(sessionId, threadId);

        return NextResponse.json({ success: true });
      }

      case 'pause': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const threadId = (params.threadId as number) || 1;
        await debugManager.pause(sessionId, threadId);

        return NextResponse.json({ success: true });
      }

      case 'getThreads': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const threads = await debugManager.getThreads(sessionId);

        return NextResponse.json({ success: true, threads });
      }

      case 'getStackTrace': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
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

        return NextResponse.json({ success: true, stackFrames });
      }

      case 'getScopes': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const frameId = params.frameId as number;
        if (frameId === undefined) {
          return NextResponse.json({ error: 'Missing frameId' }, { status: 400 });
        }

        const scopes = await debugManager.getScopes(sessionId, frameId);

        return NextResponse.json({ success: true, scopes });
      }

      case 'getVariables': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const variablesReference = params.variablesReference as number;
        if (variablesReference === undefined) {
          return NextResponse.json({ error: 'Missing variablesReference' }, { status: 400 });
        }

        const variables = await debugManager.getVariables(sessionId, variablesReference);

        return NextResponse.json({ success: true, variables });
      }

      case 'evaluate': {
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const expression = params.expression as string;
        if (!expression) {
          return NextResponse.json({ error: 'Missing expression' }, { status: 400 });
        }

        const frameId = params.frameId as number | undefined;
        const context = params.context as 'watch' | 'repl' | 'hover' | undefined;

        const result = await debugManager.evaluate(sessionId, expression, frameId, context);

        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    log.error('Debug API error', error as Error);
    return NextResponse.json(
      { error: 'Debug operation failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/code-lab/debug
 *
 * Get debug session info or list sessions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const workspaceId = searchParams.get('workspaceId');

    const debugManager = getDebugManager();

    if (sessionId) {
      // Get specific session
      const debugSession = debugManager.getSession(sessionId);
      if (!debugSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({ session: debugSession });
    }

    if (workspaceId) {
      // Get all sessions for workspace
      const sessions = debugManager.getWorkspaceSessions(workspaceId);
      return NextResponse.json({ sessions });
    }

    // Get all sessions for user
    const sessions = debugManager.getUserSessions(session.user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    log.error('Debug API error', error as Error);
    return NextResponse.json(
      { error: 'Failed to get debug sessions' },
      { status: 500 }
    );
  }
}
