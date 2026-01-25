/**
 * DEEP STRATEGY AGENT API
 *
 * Streaming API for the Deep Strategy Agent.
 * Admin-only access with real-time event streaming.
 *
 * Endpoints:
 * - POST /api/strategy - Start strategy session or process intake
 * - DELETE /api/strategy - Cancel current strategy
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCSRF } from '@/lib/security/csrf';
import { safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';
import {
  createStrategyAgent,
  type StrategyStreamEvent,
  type StrategyOutput,
} from '@/agents/strategy';

const log = logger('StrategyAPI');

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes max (matches strategy limit)

// Store active strategy sessions (in-memory for single instance)
// In production, use Redis or similar for multi-instance support
const activeSessions = new Map<
  string,
  {
    agent: ReturnType<typeof createStrategyAgent>;
    started: number;
    phase: 'intake' | 'executing' | 'complete' | 'cancelled';
  }
>();

/**
 * Check if user is admin
 */
async function isUserAdmin(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', userId)
    .single();

  return !!adminUser;
}

/**
 * POST - Start strategy or process intake input
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check admin status
    const isAdmin = await isUserAdmin(user.id, supabase);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({
          error: 'Admin access required',
          message: 'Deep Strategy Agent is currently in admin-only testing mode.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const jsonResult = await safeParseJSON<{
      action: 'start' | 'input' | 'execute';
      sessionId?: string;
      input?: string;
    }>(request);

    if (!jsonResult.success) {
      return new Response(JSON.stringify({ error: jsonResult.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { action, sessionId, input } = jsonResult.data;

    // Handle different actions
    switch (action) {
      case 'start':
        return handleStart(user.id, isAdmin);

      case 'input':
        return handleInput(sessionId, input);

      case 'execute':
        return handleExecute(sessionId);

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    log.error('Strategy API error', error as Error);
    return new Response(
      JSON.stringify({
        error: 'Strategy operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * DELETE - Cancel current strategy
 */
export async function DELETE(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cancel the strategy
    session.agent.cancel();
    session.phase = 'cancelled';
    activeSessions.delete(sessionId);

    log.info('Strategy session cancelled', { sessionId, userId: user.id });

    return new Response(JSON.stringify({ success: true, message: 'Strategy cancelled' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Strategy cancel error', error as Error);
    return new Response(JSON.stringify({ error: 'Failed to cancel strategy' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * Start a new strategy session
 */
async function handleStart(userId: string, isAdmin: boolean): Promise<Response> {
  const sessionId = `strategy_${userId}_${Date.now()}`;

  // Create the encoder and stream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Create callback for streaming events
  const onStream = (event: StrategyStreamEvent) => {
    const data = JSON.stringify(event);
    writer.write(encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`)).catch(() => {
      // Writer closed, ignore
    });
  };

  // Get API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create strategy agent
  const agent = createStrategyAgent(
    apiKey,
    {
      userId,
      sessionId,
      isAdmin,
    },
    onStream
  );

  // Store session
  activeSessions.set(sessionId, {
    agent,
    started: Date.now(),
    phase: 'intake',
  });

  // Start intake in background
  (async () => {
    try {
      const intakeMessage = await agent.startIntake();

      await writer.write(
        encoder.encode(
          `event: intake_start\ndata: ${JSON.stringify({
            type: 'intake_start',
            message: intakeMessage,
            timestamp: Date.now(),
            data: { sessionId },
          })}\n\n`
        )
      );
    } catch (error) {
      await writer.write(
        encoder.encode(
          `event: error\ndata: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to start intake',
            timestamp: Date.now(),
          })}\n\n`
        )
      );
    } finally {
      await writer.close();
    }
  })();

  log.info('Strategy session started', { sessionId, userId });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Session-Id': sessionId,
    },
  });
}

/**
 * Process intake input
 */
async function handleInput(
  sessionId: string | undefined,
  input: string | undefined
): Promise<Response> {
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!input) {
    return new Response(JSON.stringify({ error: 'Input required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found or expired' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.phase !== 'intake') {
    return new Response(
      JSON.stringify({ error: `Cannot process input during ${session.phase} phase` }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const result = await session.agent.processIntakeInput(input);

    return new Response(
      JSON.stringify({
        response: result.response,
        isComplete: result.isComplete,
        sessionId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    log.error('Intake input error', error as Error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process input',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Execute the full strategy
 */
async function handleExecute(sessionId: string | undefined): Promise<Response> {
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found or expired' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.phase !== 'intake') {
    return new Response(JSON.stringify({ error: `Cannot execute during ${session.phase} phase` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create streaming response for execution
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Update session phase
  session.phase = 'executing';

  // Execute strategy in background
  (async () => {
    try {
      await writer.write(
        encoder.encode(
          `event: execution_start\ndata: ${JSON.stringify({
            type: 'execution_start',
            message: 'Deploying the agent army...',
            timestamp: Date.now(),
            data: { sessionId },
          })}\n\n`
        )
      );

      // The strategy agent already has the stream callback set up
      const result: StrategyOutput = await session.agent.executeStrategy();

      // Send final result
      await writer.write(
        encoder.encode(
          `event: strategy_complete\ndata: ${JSON.stringify({
            type: 'strategy_complete',
            message: 'Strategy complete!',
            timestamp: Date.now(),
            data: {
              result,
              cost: result.metadata.totalCost,
              agents: result.metadata.totalAgents,
              searches: result.metadata.totalSearches,
            },
          })}\n\n`
        )
      );

      session.phase = 'complete';

      log.info('Strategy execution complete', {
        sessionId,
        cost: result.metadata.totalCost,
        agents: result.metadata.totalAgents,
        searches: result.metadata.totalSearches,
        executionTime: result.metadata.executionTime,
      });
    } catch (error) {
      await writer.write(
        encoder.encode(
          `event: error\ndata: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Strategy execution failed',
            timestamp: Date.now(),
            data: { sessionId },
          })}\n\n`
        )
      );

      log.error('Strategy execution failed', { sessionId, error });
    } finally {
      // Clean up session after completion
      setTimeout(() => {
        activeSessions.delete(sessionId);
      }, 60000); // Keep session for 1 minute after completion for result retrieval

      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * GET - Get session status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      // Return list of active sessions for this user
      const userSessions = Array.from(activeSessions.entries())
        .filter(([id]) => id.includes(user.id))
        .map(([id, session]) => ({
          sessionId: id,
          phase: session.phase,
          started: session.started,
          progress: session.agent.getProgress(),
        }));

      return new Response(JSON.stringify({ sessions: userSessions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        sessionId,
        phase: session.phase,
        started: session.started,
        progress: session.agent.getProgress(),
        findings: session.agent.getFindings().length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    log.error('Strategy status error', error as Error);
    return new Response(JSON.stringify({ error: 'Failed to get status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
