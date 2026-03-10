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
import { createServerClient as createAdminClient } from '@/lib/supabase/client';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import { requireUser } from '@/lib/auth/user-guard';
import { safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';
import { getSessionArtifacts, type AgentMode, type Artifact } from '@/agents/strategy';
import { canMakeRequest, getTokenUsage, formatTokenCount } from '@/lib/limits';
import { activeSessions, type SessionPhase, type StrategyAttachment } from './strategy-types';
import {
  updateSessionPhase,
  getStoredEvents,
  getSessionFromDB,
  isUserAdmin,
  getUserPlanKey,
} from './strategy-db';
import { handleStart, handleInput, handleContext, handleExecute } from './strategy-handlers';

const log = logger('StrategyAPI');

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes max (matches strategy limit)

// =============================================================================
// API HANDLERS
// =============================================================================

/**
 * POST - Start strategy or process intake input
 */
export async function POST(request: NextRequest) {
  // Auth + CSRF protection for POST
  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;
  const { user } = auth;

  // Use service-role client for all DB operations (bypasses RLS)
  // Strategy tables need INSERT/UPDATE which RLS policies don't fully allow for anon users
  const supabase = createAdminClient();

  try {
    // Check admin status (for context tracking, not access control)
    // Deep Strategy Agent is now available to all users
    const isAdmin = await isUserAdmin(user.id, supabase);

    // Check token quota before allowing agent usage
    const userPlanKey = await getUserPlanKey(user.id, supabase);
    const canProceed = await canMakeRequest(user.id, userPlanKey);
    if (!canProceed) {
      const usage = await getTokenUsage(user.id, userPlanKey);
      const isFreeUser = userPlanKey === 'free';
      log.warn('Token quota exceeded for strategy agent', {
        userId: user.id,
        plan: userPlanKey,
        usage: usage.percentage,
      });
      return new Response(
        JSON.stringify({
          error: isFreeUser
            ? "You've used your free trial tokens. Upgrade your plan to use agents."
            : `You've reached your monthly token limit (${formatTokenCount(usage.used)} / ${formatTokenCount(usage.limit)}). Your limit resets next month, or upgrade for more tokens.`,
          code: 'QUOTA_EXCEEDED',
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
        return handleExecute(supabase, user.id, sessionId, isAdmin, userPlanKey);

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
  // Auth + CSRF protection for DELETE
  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;
  const { user } = auth;

  const supabase = createAdminClient();

  try {
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
  const auth = await requireUser();
  if (!auth.authorized) return auth.response;
  const { user } = auth;

  const supabase = createAdminClient();

  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      // Return list of sessions for this user from database
      const { data: sessions, error } = await untypedFrom(supabase, 'strategy_sessions')
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
