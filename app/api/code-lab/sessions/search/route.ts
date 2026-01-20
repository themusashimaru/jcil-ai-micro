/**
 * CODE LAB GLOBAL SEARCH API
 *
 * Claude Code parity - Search across all sessions:
 * - POST: Full-text search across all user's sessions
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';

const log = logger('CodeLabSearch');

// SECURITY: Max query length to prevent resource exhaustion
const MAX_QUERY_LENGTH = 500;
const MAX_LIMIT = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  role: string;
  content: string;
  createdAt: string;
  matchContext: string[];
}

/**
 * POST - Search across all sessions
 */
export async function POST(request: NextRequest) {
  // SECURITY FIX: Add CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimiters.codeLabEdit(user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } }
      );
    }

    const body = await request.json();
    const { query, role, limit: requestedLimit = 100, sessionIds } = body;

    // SECURITY FIX: Validate query length and limit bounds
    if (!query || typeof query !== 'string' || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters', code: 'QUERY_TOO_SHORT' },
        { status: 400 }
      );
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        {
          error: `Search query must be at most ${MAX_QUERY_LENGTH} characters`,
          code: 'QUERY_TOO_LONG',
        },
        { status: 400 }
      );
    }

    // Clamp limit to safe range
    const limit = Math.min(Math.max(1, parseInt(String(requestedLimit)) || 100), MAX_LIMIT);

    // First, get user's sessions
    let sessionsQuery = (supabase.from('code_lab_sessions') as AnySupabase)
      .select('id, title')
      .eq('user_id', user.id);

    // Filter to specific sessions if provided
    if (sessionIds && Array.isArray(sessionIds) && sessionIds.length > 0) {
      sessionsQuery = sessionsQuery.in('id', sessionIds);
    }

    const { data: sessions } = await sessionsQuery;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        query,
        results: [],
        total: 0,
        sessionsSearched: 0,
      });
    }

    // Create a map for quick session title lookup
    const sessionMap = new Map(sessions.map((s: { id: string; title: string }) => [s.id, s.title]));
    const sessionIdList = sessions.map((s: { id: string }) => s.id);

    // Search messages across all user's sessions
    let messagesQuery = (supabase.from('code_lab_messages') as AnySupabase)
      .select('id, session_id, role, content, created_at')
      .in('session_id', sessionIdList)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by role if specified
    if (role && ['user', 'assistant', 'system'].includes(role)) {
      messagesQuery = messagesQuery.eq('role', role);
    }

    const { data: messages, error } = await messagesQuery;

    if (error) {
      log.error('[CodeLab Search] Error:', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Format results with context
    const results: SearchResult[] = (messages || []).map(
      (m: {
        id: string;
        session_id: string;
        role: string;
        content: string;
        created_at: string;
      }) => ({
        sessionId: m.session_id,
        sessionTitle: sessionMap.get(m.session_id) || 'Unknown Session',
        messageId: m.id,
        role: m.role,
        content: m.content.length > 500 ? m.content.slice(0, 500) + '...' : m.content,
        createdAt: m.created_at,
        matchContext: extractMatchContext(m.content, query),
      })
    );

    // Group by session for summary
    const sessionCounts = new Map<string, number>();
    results.forEach((r) => {
      sessionCounts.set(r.sessionId, (sessionCounts.get(r.sessionId) || 0) + 1);
    });

    return NextResponse.json({
      query,
      results,
      total: results.length,
      sessionsSearched: sessions.length,
      sessionsWithMatches: sessionCounts.size,
      breakdown: Array.from(sessionCounts.entries()).map(([id, count]) => ({
        sessionId: id,
        sessionTitle: sessionMap.get(id),
        matchCount: count,
      })),
    });
  } catch (error) {
    log.error('[CodeLab Search] Error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * Extract context around search matches
 */
function extractMatchContext(content: string, query: string, contextChars: number = 80): string[] {
  const contexts: string[] = [];
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let pos = 0;
  while (pos < content.length) {
    const matchIndex = lowerContent.indexOf(lowerQuery, pos);
    if (matchIndex === -1) break;

    const start = Math.max(0, matchIndex - contextChars);
    const end = Math.min(content.length, matchIndex + query.length + contextChars);

    let context = content.slice(start, end);
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';

    contexts.push(context);
    pos = matchIndex + query.length;

    // Limit to 2 contexts per message
    if (contexts.length >= 2) break;
  }

  return contexts;
}
