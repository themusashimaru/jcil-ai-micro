/**
 * DEEP STRATEGY AGENT API
 *
 * Production-ready streaming API for the Deep Strategy Agent.
 * Uses Supabase for session persistence across server restarts.
 * Available to all users with real-time event streaming.
 *
 * Endpoints:
 * - POST /api/strategy - Start strategy session or process intake
 * - DELETE /api/strategy - Cancel current strategy
 * - GET /api/strategy - Get session status or list sessions
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createServerClient as createAdminClient } from '@/lib/supabase/client';
import { validateCSRF } from '@/lib/security/csrf';
import { safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';
import {
  createStrategyAgent,
  getSessionArtifacts,
  type StrategyStreamEvent,
  type StrategyOutput,
  type Finding,
  type AgentMode,
  type Artifact,
} from '@/agents/strategy';
import { trackTokenUsage } from '@/lib/usage/track';

const log = logger('StrategyAPI');

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes max (matches strategy limit)

// =============================================================================
// TYPES
// =============================================================================

type SessionPhase = 'intake' | 'executing' | 'complete' | 'cancelled' | 'error';

interface StrategyAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

interface ActiveSession {
  agent: ReturnType<typeof createStrategyAgent>;
  dbId: string; // UUID from database
  started: number;
  phase: SessionPhase;
}

// =============================================================================
// ACTIVE SESSIONS (In-memory for running agents)
// Database provides persistence; this Map holds live agent instances
// =============================================================================

const activeSessions = new Map<string, ActiveSession>();

// =============================================================================
// DATABASE HELPERS
// =============================================================================

/**
 * Create a new session in the database
 * Note: Using 'as any' because strategy_sessions table was added after type generation
 * Run `npx supabase gen types` to regenerate types if needed
 */
async function createSessionInDB(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string,
  attachments?: StrategyAttachment[],
  mode?: AgentMode
): Promise<string> {
  // Generate a UUID for the primary key as well
  const id = randomUUID();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('strategy_sessions')
    .insert({
      id, // Explicit UUID for primary key
      session_id: sessionId,
      user_id: userId,
      phase: 'intake',
      mode: mode || 'strategy',
      attachments:
        attachments?.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          size: a.size,
        })) || [],
    })
    .select('id')
    .single();

  if (error) {
    log.error('Failed to create session in database', {
      error,
      sessionId,
      userId,
      id,
    });
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data.id;
}

/**
 * Update session phase in the database
 */
async function updateSessionPhase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  phase: SessionPhase,
  additionalData?: Record<string, unknown>
): Promise<void> {
  const updateData: Record<string, unknown> = { phase, ...additionalData };

  if (phase === 'complete' || phase === 'cancelled' || phase === 'error') {
    updateData.completed_at = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('strategy_sessions')
    .update(updateData)
    .eq('session_id', sessionId);

  if (error) {
    log.error('Failed to update session phase', { sessionId, phase, error });
  }
}

/**
 * Store problem data after intake
 */
async function storeProblemData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  problemSummary: string,
  problemData: unknown
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('strategy_sessions')
    .update({
      problem_summary: problemSummary,
      problem_data: problemData,
    })
    .eq('session_id', sessionId);

  if (error) {
    log.error('Failed to store problem data', { sessionId, error });
  }
}

/**
 * Get problem data from database (for session restoration before execution)
 */
async function getProblemData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<unknown | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('strategy_sessions')
    .select('problem_data')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.problem_data || null;
}

/**
 * Store intake messages for session restoration
 * This allows us to restore the agent on a different serverless instance
 */
async function storeIntakeMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('strategy_sessions')
    .update({ intake_messages: messages })
    .eq('session_id', sessionId);

  if (error) {
    log.error('Failed to store intake messages', { sessionId, error });
  }
}

/**
 * Get intake messages from database
 */
async function getIntakeMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }> | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('strategy_sessions')
    .select('intake_messages')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.intake_messages || [];
}

/**
 * Store a finding in the database
 */
async function storeFinding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dbSessionId: string,
  finding: Finding
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('strategy_findings').insert({
    session_id: dbSessionId,
    title: finding.title,
    content: finding.content,
    source_url: finding.sources?.[0]?.url || null,
    agent_name: finding.agentName,
    confidence: finding.confidence,
    category: finding.type,
  });

  if (error) {
    log.error('Failed to store finding', { dbSessionId, error });
  }
}

/**
 * Store final result and usage
 */
async function storeResultAndUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  dbSessionId: string,
  userId: string,
  result: StrategyOutput
): Promise<void> {
  // Update session with result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: sessionError } = await (supabase as any)
    .from('strategy_sessions')
    .update({
      phase: 'complete',
      completed_at: new Date().toISOString(),
      result: result,
      total_agents: result.metadata.totalAgents,
      completed_agents: result.metadata.totalAgents,
      total_searches: result.metadata.totalSearches,
      total_cost: result.metadata.totalCost,
    })
    .eq('session_id', sessionId);

  if (sessionError) {
    log.error('Failed to store result', { sessionId, error: sessionError });
  }

  // Store usage for billing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: usageError } = await (supabase as any).from('strategy_usage').insert({
    user_id: userId,
    session_id: dbSessionId,
    opus_tokens: result.metadata.modelUsage.opus.tokens,
    sonnet_tokens: result.metadata.modelUsage.sonnet.tokens,
    haiku_tokens: result.metadata.modelUsage.haiku.tokens,
    brave_searches: result.metadata.totalSearches,
    total_cost: result.metadata.totalCost,
  });

  if (usageError) {
    log.error('Failed to store usage', { sessionId, error: usageError });
  }

  // Also track to unified usage_tracking table for billing dashboard
  const { modelUsage, totalSearches } = result.metadata;
  const trackingPromises: Promise<void>[] = [];

  if (modelUsage.opus.tokens > 0) {
    trackingPromises.push(
      trackTokenUsage({
        userId,
        modelName: 'claude-opus-4-6',
        inputTokens: modelUsage.opus.tokens,
        outputTokens: 0,
        liveSearchCalls: totalSearches,
        source: 'strategy',
        conversationId: sessionId,
      })
    );
  }
  if (modelUsage.sonnet.tokens > 0) {
    trackingPromises.push(
      trackTokenUsage({
        userId,
        modelName: 'claude-sonnet-4-6',
        inputTokens: modelUsage.sonnet.tokens,
        outputTokens: 0,
        source: 'strategy',
        conversationId: sessionId,
      })
    );
  }
  if (modelUsage.haiku.tokens > 0) {
    trackingPromises.push(
      trackTokenUsage({
        userId,
        modelName: 'claude-haiku-4-5-20251001',
        inputTokens: modelUsage.haiku.tokens,
        outputTokens: 0,
        source: 'strategy',
        conversationId: sessionId,
      })
    );
  }

  await Promise.allSettled(trackingPromises);
}

/**
 * Add user context to session
 */
async function addUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  message: string
): Promise<void> {
  // Get current context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (supabase as any)
    .from('strategy_sessions')
    .select('user_context')
    .eq('session_id', sessionId)
    .single();

  const currentContext = (session?.user_context as string[]) || [];
  currentContext.push(message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('strategy_sessions')
    .update({ user_context: currentContext })
    .eq('session_id', sessionId);

  if (error) {
    log.error('Failed to add user context', { sessionId, error });
  }
}

/**
 * Store a stream event in the database for replay on reconnect
 * Only stores tool execution events that drive the UI
 */
async function storeEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  event: StrategyStreamEvent
): Promise<void> {
  // Only store events that are useful for UI replay
  const replayableTypes = [
    'search_executing',
    'search_complete',
    'browser_visiting',
    'screenshot_captured',
    'code_executing',
    'vision_analyzing',
    'table_extracting',
    'form_filling',
    'paginating',
    'scrolling',
    'pdf_extracting',
    'comparing',
    'agent_spawned',
    'agent_complete',
    'agent_failed',
    'finding_discovered',
  ];

  if (!replayableTypes.includes(event.type)) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('strategy_events').insert({
    session_id: sessionId,
    event_type: event.type,
    message: event.message,
    event_data: event.data || {},
    created_at: new Date(event.timestamp).toISOString(),
  });

  if (error) {
    // Don't log errors for every event - just silently fail
    // This table might not exist yet
  }
}

/**
 * Get stored events for a session (for replay on reconnect)
 */
async function getStoredEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<StrategyStreamEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('strategy_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(
    (row: { event_type: string; message: string; event_data: unknown; created_at: string }) => ({
      type: row.event_type,
      message: row.message,
      timestamp: new Date(row.created_at).getTime(),
      data: row.event_data,
    })
  );
}

/**
 * Get session from database
 */
async function getSessionFromDB(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<{
  id: string;
  session_id: string;
  user_id: string;
  phase: SessionPhase;
  mode: AgentMode;
  started_at: string;
  result: StrategyOutput | null;
  total_agents: number;
  completed_agents: number;
  total_searches: number;
  total_cost: number;
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('strategy_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Check if user is admin
 */
async function isUserAdmin(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<boolean> {
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', userId)
    .single();

  return !!adminUser;
}

// =============================================================================
// API HANDLERS
// =============================================================================

/**
 * POST - Start strategy or process intake input
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  // Use anon client for auth verification only
  const authClient = await createClient();
  // Use service-role client for all DB operations (bypasses RLS)
  // Strategy tables need INSERT/UPDATE which RLS policies don't fully allow for anon users
  const supabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check admin status (for context tracking, not access control)
    // Deep Strategy Agent is now available to all users
    const isAdmin = await isUserAdmin(user.id, supabase);

    // Parse request body
    const jsonResult = await safeParseJSON<{
      action: 'start' | 'input' | 'execute' | 'context';
      sessionId?: string;
      input?: string;
      message?: string;
      attachments?: StrategyAttachment[];
      mode?: AgentMode;
    }>(request);

    if (!jsonResult.success) {
      return new Response(JSON.stringify({ error: jsonResult.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { action, sessionId, input, message, attachments, mode } = jsonResult.data;

    // Handle different actions
    switch (action) {
      case 'start':
        return handleStart(supabase, user.id, isAdmin, attachments, mode);

      case 'input':
        return handleInput(supabase, sessionId, input, user.id, isAdmin);

      case 'execute':
        return handleExecute(supabase, user.id, sessionId, isAdmin);

      case 'context':
        return handleContext(supabase, sessionId, message);

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

  const authClient = await createClient();
  const supabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await authClient.auth.getUser();

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

    // Check if session exists in memory (active)
    const activeSession = activeSessions.get(sessionId);
    if (activeSession) {
      // Cancel the running agent
      activeSession.agent.cancel();
      activeSession.phase = 'cancelled';
      activeSessions.delete(sessionId);
    }

    // Update database
    await updateSessionPhase(supabase, sessionId, 'cancelled');

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

/**
 * GET - Get session status or list sessions
 */
export async function GET(request: NextRequest) {
  const authClient = await createClient();
  const supabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      // Return list of sessions for this user from database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessions, error } = await (supabase as any)
        .from('strategy_sessions')
        .select(
          'session_id, phase, started_at, total_agents, completed_agents, total_searches, total_cost'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      // Define type for session list items
      type SessionListItem = {
        session_id: string;
        phase: SessionPhase;
        started_at: string;
        total_agents: number;
        completed_agents: number;
        total_searches: number;
        total_cost: number;
      };

      // Enrich with live progress for active sessions
      const enrichedSessions = (sessions as SessionListItem[] | null)?.map((session) => {
        const active = activeSessions.get(session.session_id);
        if (active) {
          return {
            ...session,
            phase: active.phase,
            progress: active.agent.getProgress(),
            isActive: true,
          };
        }
        return { ...session, isActive: false };
      });

      return new Response(JSON.stringify({ sessions: enrichedSessions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get specific session
    const dbSession = await getSessionFromDB(supabase, sessionId);
    if (!dbSession) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check ownership
    if (dbSession.user_id !== user.id) {
      // Check if admin
      const isAdmin = await isUserAdmin(user.id, supabase);
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if client wants events for replay or artifacts
    const includeEvents = request.nextUrl.searchParams.get('includeEvents') === 'true';
    const includeArtifacts = request.nextUrl.searchParams.get('includeArtifacts') === 'true';

    // Check if session is active in memory
    const activeSession = activeSessions.get(sessionId);
    if (activeSession) {
      // Get stored events for replay if requested
      const storedEvents = includeEvents ? await getStoredEvents(supabase, sessionId) : [];

      return new Response(
        JSON.stringify({
          sessionId,
          phase: activeSession.phase,
          started: activeSession.started,
          progress: activeSession.agent.getProgress(),
          findings: activeSession.agent.getFindings().length,
          isActive: true,
          totalAgents: activeSession.agent.getProgress().agentsTotal,
          completedAgents: activeSession.agent.getProgress().agentsComplete,
          totalCost: activeSession.agent.getProgress().cost,
          events: storedEvents,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get stored events for replay if requested
    const storedEvents = includeEvents ? await getStoredEvents(supabase, sessionId) : [];

    // Get artifacts if requested
    let artifacts: Artifact[] = [];
    if (includeArtifacts) {
      try {
        artifacts = await getSessionArtifacts(sessionId);
      } catch (err) {
        log.warn('Failed to load artifacts', { sessionId, error: err });
      }
    }

    // Return from database
    return new Response(
      JSON.stringify({
        sessionId: dbSession.session_id,
        phase: dbSession.phase,
        started: dbSession.started_at,
        totalAgents: dbSession.total_agents,
        completedAgents: dbSession.completed_agents,
        totalSearches: dbSession.total_searches,
        totalCost: dbSession.total_cost,
        result: dbSession.result,
        isActive: false,
        events: storedEvents,
        artifacts: includeArtifacts
          ? artifacts.map((a) => ({
              id: a.id,
              type: a.type,
              title: a.title,
              description: a.description,
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              contentText: a.contentText,
              contentBase64: a.contentBase64,
            }))
          : undefined,
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

// =============================================================================
// ACTION HANDLERS
// =============================================================================

/**
 * Start a new strategy session
 */
async function handleStart(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('strategy_sessions')
        .update({
          completed_agents: event.data?.completedAgents || 0,
          total_cost: event.data?.cost || 0,
        })
        .eq('session_id', sessionId)
        .then(() => {})
        .catch(() => {});
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
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string | undefined,
  isAdmin: boolean = false
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agent.restoreProblem(problemData as any);
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
