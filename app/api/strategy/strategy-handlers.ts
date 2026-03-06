import { createServerClient as createAdminClient } from '@/lib/supabase/client';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import { logger } from '@/lib/logger';
import {
  createStrategyAgent,
  type StrategyStreamEvent,
  type StrategyOutput,
  type Finding,
  type AgentMode,
  type Artifact,
} from '@/agents/strategy';
import { incrementTokenUsage } from '@/lib/limits';
import { activeSessions, type StrategyAttachment } from './strategy-types';
import {
  createSessionInDB,
  updateSessionPhase,
  storeProblemData,
  getProblemData,
  storeIntakeMessages,
  getIntakeMessages,
  storeFinding,
  storeResultAndUsage,
  addUserContext,
  storeEvent,
  getSessionFromDB,
} from './strategy-db';
import { randomUUID } from 'crypto';

const log = logger('StrategyAPI');

/**
 * Start a new strategy session
 */
async function handleStart(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  isAdmin: boolean,
  attachments?: StrategyAttachment[],
  mode?: AgentMode
): Promise<Response> {
  // Use UUID for session ID to match database constraints
  const sessionId = randomUUID();

  // Create session in database first
  let dbId: string;
  try {
    dbId = await createSessionInDB(supabase, userId, sessionId, attachments, mode);
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Failed to create session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

    // Store findings in database as they're discovered
    if (event.type === 'finding_discovered' && event.data?.finding) {
      storeFinding(supabase, dbId, event.data.finding as Finding).catch((err) => {
        log.error('Failed to store finding', err);
      });
    }

    // Update progress in database periodically
    if (event.type === 'agent_complete') {
      untypedFrom(supabase, 'strategy_sessions')
        .update({
          completed_agents: event.data?.completedAgents || 0,
          total_cost: event.data?.cost || 0,
        })
        .eq('session_id', sessionId)
        .then(() => {})
        .catch((err: unknown) =>
          log.error('strategy session update failed', err instanceof Error ? err : undefined)
        );
    }
  };

  // Get API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create strategy agent with mode-specific prompts
  const agent = createStrategyAgent(
    apiKey,
    {
      userId,
      sessionId,
      isAdmin,
      mode: mode || 'strategy',
      attachments: attachments?.map((a) => ({
        name: a.name,
        type: a.type,
        content: a.content,
      })),
    },
    onStream
  );

  // Store in active sessions map
  activeSessions.set(sessionId, {
    agent,
    dbId,
    started: Date.now(),
    phase: 'intake',
  });

  // Start intake in background
  (async () => {
    try {
      const intakeMessage = await agent.startIntake();

      // Save initial message to DB for serverless session restoration
      const messages = agent.getIntakeMessages();
      await storeIntakeMessages(supabase, sessionId, messages);

      await writer.write(
        encoder.encode(
          `event: intake_start\ndata: ${JSON.stringify({
            type: 'intake_start',
            message: intakeMessage,
            timestamp: Date.now(),
            data: { sessionId, attachmentCount: attachments?.length || 0 },
          })}\n\n`
        )
      );
    } catch (_error) {
      await updateSessionPhase(supabase, sessionId, 'error');

      await writer.write(
        encoder.encode(
          `event: error\ndata: ${JSON.stringify({
            type: 'error',
            message: 'Strategy processing failed',
            timestamp: Date.now(),
          })}\n\n`
        )
      );
    } finally {
      await writer.close();
    }
  })();

  log.info('Strategy session started', {
    sessionId,
    dbId,
    userId,
    attachmentCount: attachments?.length || 0,
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Session-Id': sessionId,
      'Access-Control-Expose-Headers': 'X-Session-Id',
    },
  });
}

/**
 * Process intake input
 */
async function handleInput(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string | undefined,
  input: string | undefined,
  userId: string,
  isAdmin: boolean
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

  // Check active session first
  let session = activeSessions.get(sessionId);

  // If not in memory, check database and try to restore
  if (!session) {
    const dbSession = await getSessionFromDB(supabase, sessionId);
    if (!dbSession) {
      return new Response(JSON.stringify({ error: 'Session not found or expired' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify user owns this session
    if (dbSession.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Session exists in DB but not in memory - only intake phase can be restored
    if (dbSession.phase !== 'intake') {
      return new Response(
        JSON.stringify({ error: `Cannot process input during ${dbSession.phase} phase` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Try to restore the session
    log.info('Restoring session from database', { sessionId });

    // Get the API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get intake messages from DB
    const intakeMessages = await getIntakeMessages(supabase, sessionId);

    // Create a new agent and restore its state with the correct mode from DB
    const agent = createStrategyAgent(apiKey, {
      userId,
      sessionId,
      isAdmin,
      mode: dbSession.mode || 'strategy',
    });

    // Restore the intake messages if we have them
    if (intakeMessages && intakeMessages.length > 0) {
      agent.restoreIntakeMessages(intakeMessages);
      log.info('Restored intake messages', { sessionId, messageCount: intakeMessages.length });
    }

    // Store the restored session back in memory
    session = {
      agent,
      phase: 'intake',
      dbId: dbSession.id,
      started: new Date(dbSession.started_at).getTime(),
    };
    activeSessions.set(sessionId, session);
    log.info('Session restored to memory', { sessionId });
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

    // Save intake messages to DB for serverless session restoration
    const messages = session.agent.getIntakeMessages();
    await storeIntakeMessages(supabase, sessionId, messages);

    // If intake is complete, store the problem data
    if (result.isComplete) {
      const problem = session.agent.getProblem?.();
      if (problem) {
        await storeProblemData(
          supabase,
          sessionId,
          problem.synthesizedProblem?.summary || '',
          problem
        );
      }
    }

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
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Add context during execution
 */
async function handleContext(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string | undefined,
  message: string | undefined
): Promise<Response> {
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message required' }), {
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

  if (session.phase !== 'executing') {
    return new Response(
      JSON.stringify({ error: `Cannot add context during ${session.phase} phase` }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Add context to the running strategy (may trigger steering)
    const result = await session.agent.addContext(message);

    // Store in database
    await addUserContext(supabase, sessionId, message);

    log.info('Context added to strategy', {
      sessionId,
      messageLength: message.length,
      steeringApplied: result.steeringApplied,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: result.steeringApplied ? result.steeringResponse : 'Context added successfully',
        sessionId,
        steeringApplied: result.steeringApplied,
        steeringAction: result.command?.action,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    log.error('Add context error', error as Error);
    return new Response(
      JSON.stringify({
        error: 'Failed to add context',
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
async function handleExecute(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  sessionId: string | undefined,
  isAdmin: boolean = false,
  userPlanKey: string = 'free'
): Promise<Response> {
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let session = activeSessions.get(sessionId);

  // If not in memory, restore from database (serverless cold start recovery)
  if (!session) {
    const dbSession = await getSessionFromDB(supabase, sessionId);
    if (!dbSession) {
      return new Response(JSON.stringify({ error: 'Session not found or expired' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (dbSession.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (dbSession.phase !== 'intake') {
      return new Response(
        JSON.stringify({ error: `Cannot execute during ${dbSession.phase} phase` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Restore session
    log.info('Restoring session for execution', { sessionId });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const intakeMessages = await getIntakeMessages(supabase, sessionId);
    const agent = createStrategyAgent(apiKey, {
      userId,
      sessionId,
      isAdmin,
      mode: dbSession.mode || 'strategy',
    });

    if (intakeMessages && intakeMessages.length > 0) {
      agent.restoreIntakeMessages(intakeMessages);
      log.info('Restored intake messages for execution', {
        sessionId,
        messageCount: intakeMessages.length,
      });
    }

    // Restore problem data if available (stored as UserProblem in DB)
    const problemData = await getProblemData(supabase, sessionId);
    if (problemData) {
      agent.restoreProblem(problemData as Parameters<typeof agent.restoreProblem>[0]);
    }

    session = {
      agent,
      phase: 'intake',
      dbId: dbSession.id,
      started: new Date(dbSession.started_at).getTime(),
    };
    activeSessions.set(sessionId, session);
    log.info('Session restored for execution', { sessionId });
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

  // CRITICAL: Update the agent's stream callback to write to the NEW stream
  // The original callback from handleStart pointed to a now-closed stream
  const onExecuteStream = (event: StrategyStreamEvent) => {
    const data = JSON.stringify(event);
    writer.write(encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`)).catch(() => {
      // Writer closed, ignore
    });

    // Store event in database for reconnect replay
    storeEvent(supabase, sessionId!, event).catch(() => {
      // Silent fail - table might not exist
    });

    // Store findings in database as they're discovered
    if (event.type === 'finding_discovered' && event.data?.finding) {
      storeFinding(supabase, session.dbId, event.data.finding as Finding).catch((err) => {
        log.error('Failed to store finding', err);
      });
    }
  };

  session.agent.setStreamCallback(onExecuteStream);

  // Update session phase
  session.phase = 'executing';
  await updateSessionPhase(supabase, sessionId, 'executing');

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

      // Execute the strategy
      const result: StrategyOutput = await session.agent.executeStrategy();

      // Store result and usage in database
      await storeResultAndUsage(supabase, sessionId, session.dbId, userId, result);

      // Increment token quota so agent usage counts against monthly limit
      const totalAgentTokens =
        (result.metadata.modelUsage?.opus?.tokens || 0) +
        (result.metadata.modelUsage?.sonnet?.tokens || 0) +
        (result.metadata.modelUsage?.haiku?.tokens || 0);
      if (totalAgentTokens > 0) {
        incrementTokenUsage(userId, userPlanKey, totalAgentTokens).catch((err) => {
          log.error('Failed to increment token usage for strategy', err);
        });
      }

      // Collect artifacts generated during synthesis
      const artifacts = session.agent.getArtifacts();

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
              tokensUsed: totalAgentTokens,
              agents: result.metadata.totalAgents,
              searches: result.metadata.totalSearches,
              artifacts: artifacts.map((a: Artifact) => ({
                id: a.id,
                type: a.type,
                title: a.title,
                fileName: a.fileName,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
              })),
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
      session.phase = 'error';
      await updateSessionPhase(supabase, sessionId, 'error');

      await writer.write(
        encoder.encode(
          `event: error\ndata: ${JSON.stringify({
            type: 'error',
            message: 'Strategy processing failed',
            timestamp: Date.now(),
            data: { sessionId },
          })}\n\n`
        )
      );

      log.error('Strategy execution failed', { sessionId, error });
    } finally {
      // Clean up active session after completion
      // Keep in memory briefly for status checks, then remove
      setTimeout(() => {
        activeSessions.delete(sessionId);
      }, 60000); // Keep for 1 minute after completion

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

export { handleStart, handleInput, handleContext, handleExecute };
