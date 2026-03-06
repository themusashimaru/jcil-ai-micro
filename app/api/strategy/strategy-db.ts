import { createServerClient as createAdminClient } from '@/lib/supabase/client';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import { logger } from '@/lib/logger';
import { trackTokenUsage } from '@/lib/usage/track';
import {
  type StrategyStreamEvent,
  type StrategyOutput,
  type Finding,
  type AgentMode,
} from '@/agents/strategy';
import type { SessionPhase, StrategyAttachment } from './strategy-types';
import { randomUUID } from 'crypto';

const log = logger('StrategyAPI');

/**
 * Create a new session in the database
 * Note: Using 'as any' because strategy_sessions table was added after type generation
 * Run `npx supabase gen types` to regenerate types if needed
 */
async function createSessionInDB(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  sessionId: string,
  attachments?: StrategyAttachment[],
  mode?: AgentMode
): Promise<string> {
  // Generate a UUID for the primary key as well
  const id = randomUUID();

  const { data, error } = await untypedFrom(supabase, 'strategy_sessions')
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  phase: SessionPhase,
  additionalData?: Record<string, unknown>
): Promise<void> {
  const updateData: Record<string, unknown> = { phase, ...additionalData };

  if (phase === 'complete' || phase === 'cancelled' || phase === 'error') {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await untypedFrom(supabase, 'strategy_sessions')
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  problemSummary: string,
  problemData: unknown
): Promise<void> {
  const { error } = await untypedFrom(supabase, 'strategy_sessions')
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<unknown | null> {
  const { data, error } = await untypedFrom(supabase, 'strategy_sessions')
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  const { error } = await untypedFrom(supabase, 'strategy_sessions')
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }> | null> {
  const { data, error } = await untypedFrom(supabase, 'strategy_sessions')
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
  supabase: ReturnType<typeof createAdminClient>,
  dbSessionId: string,
  finding: Finding
): Promise<void> {
  const { error } = await untypedFrom(supabase, 'strategy_findings').insert({
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  dbSessionId: string,
  userId: string,
  result: StrategyOutput
): Promise<void> {
  // Update session with result
  const { error: sessionError } = await untypedFrom(supabase, 'strategy_sessions')
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
  const { error: usageError } = await untypedFrom(supabase, 'strategy_usage').insert({
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
        modelName: 'claude-sonnet-4-6',
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  message: string
): Promise<void> {
  // Get current context
  const { data: session } = await untypedFrom(supabase, 'strategy_sessions')
    .select('user_context')
    .eq('session_id', sessionId)
    .single();

  const currentContext = (session?.user_context as string[]) || [];
  currentContext.push(message);

  const { error } = await untypedFrom(supabase, 'strategy_sessions')
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
  supabase: ReturnType<typeof createAdminClient>,
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

  const { error } = await untypedFrom(supabase, 'strategy_events').insert({
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
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<StrategyStreamEvent[]> {
  const { data, error } = await untypedFrom(supabase, 'strategy_events')
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
  supabase: ReturnType<typeof createAdminClient>,
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
  const { data, error } = await untypedFrom(supabase, 'strategy_sessions')
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

/**
 * Get user's subscription tier for token quota enforcement
 */
async function getUserPlanKey(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single();
  return data?.subscription_tier || 'free';
}

export {
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
  getStoredEvents,
  getSessionFromDB,
  isUserAdmin,
  getUserPlanKey,
};
