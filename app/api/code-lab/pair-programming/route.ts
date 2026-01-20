/**
 * PAIR PROGRAMMING API - REAL CLAUDE-POWERED SUGGESTIONS
 *
 * This endpoint connects the UI to the real AIPairProgrammer backend.
 * No mocks, no placeholders - real Claude API calls for real-time coding assistance.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPairProgrammer,
  CodeEdit,
  PairProgrammerContext,
  PairProgrammerSuggestion,
} from '@/lib/pair-programmer';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { rateLimiters } from '@/lib/security/rate-limit';

const log = logger('PairProgrammingAPI');

// SECURITY FIX: Use centralized rate limiting instead of in-memory Map
// The centralized system is Redis-backed and works across multiple server instances

// Convert backend suggestions to UI format
function convertSuggestion(suggestion: PairProgrammerSuggestion): {
  type: 'completion' | 'refactor' | 'bug' | 'docs' | 'test' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  code?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  confidence: number;
} {
  // Map backend types to UI types
  const typeMap: Record<string, 'completion' | 'refactor' | 'bug' | 'docs' | 'test' | 'security'> =
    {
      completion: 'completion',
      fix: 'bug',
      refactor: 'refactor',
      explain: 'docs',
      warning: 'bug',
      optimization: 'refactor',
    };

  // Determine priority based on type and confidence
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (suggestion.type === 'fix' || suggestion.type === 'warning') {
    priority = suggestion.confidence > 0.9 ? 'critical' : 'high';
  } else if (suggestion.confidence > 0.9) {
    priority = 'high';
  } else if (suggestion.confidence < 0.75) {
    priority = 'low';
  }

  return {
    type: typeMap[suggestion.type] || 'completion',
    priority,
    title: suggestion.content.slice(0, 100),
    description: suggestion.reasoning || suggestion.content,
    code: suggestion.code,
    line: suggestion.insertAt?.line || suggestion.replaceRange?.startLine,
    column: suggestion.insertAt?.column,
    endLine: suggestion.replaceRange?.endLine,
    confidence: suggestion.confidence,
  };
}

/**
 * POST /api/code-lab/pair-programming
 *
 * Actions:
 * - edit: Process a code edit and get suggestions
 * - open: Get suggestions when opening a file
 * - complete: Get inline completion at cursor
 * - analyze: Get proactive analysis of current code
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    // SECURITY FIX: Use centralized rate limiting (Redis-backed)
    const rateLimitResult = await rateLimiters.codeLabEdit(auth.user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please slow down.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } }
      );
    }

    const body = await request.json();
    const { action, context, edit } = body as {
      action: 'edit' | 'open' | 'complete' | 'analyze';
      context?: PairProgrammerContext;
      edit?: CodeEdit;
    };

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const pairProgrammer = getPairProgrammer();

    switch (action) {
      case 'edit': {
        if (!edit || !context) {
          return NextResponse.json({ error: 'Missing edit or context' }, { status: 400 });
        }

        log.info('Processing code edit', { file: context.currentFile, line: edit.startLine });

        const suggestions = await pairProgrammer.onEdit(edit, context);
        const convertedSuggestions = suggestions.map(convertSuggestion);

        return NextResponse.json({
          success: true,
          suggestions: convertedSuggestions,
          timestamp: Date.now(),
        });
      }

      case 'open': {
        if (!context) {
          return NextResponse.json({ error: 'Missing context' }, { status: 400 });
        }

        log.info('Processing file open', { file: context.currentFile });

        const suggestions = await pairProgrammer.onFileOpen(context);
        const convertedSuggestions = suggestions.map(convertSuggestion);

        return NextResponse.json({
          success: true,
          suggestions: convertedSuggestions,
          timestamp: Date.now(),
        });
      }

      case 'complete': {
        if (!context) {
          return NextResponse.json({ error: 'Missing context' }, { status: 400 });
        }

        log.info('Generating completion', {
          file: context.currentFile,
          line: context.cursorLine,
        });

        const completion = await pairProgrammer.getCompletion(context, 'automatic');

        return NextResponse.json({
          success: true,
          completion,
          timestamp: Date.now(),
        });
      }

      case 'analyze': {
        if (!context) {
          return NextResponse.json({ error: 'Missing context' }, { status: 400 });
        }

        log.info('Running proactive analysis', { file: context.currentFile });

        // Get both file-level and edit-based suggestions
        const fileSuggestions = await pairProgrammer.onFileOpen(context);
        const convertedSuggestions = fileSuggestions.map(convertSuggestion);

        return NextResponse.json({
          success: true,
          suggestions: convertedSuggestions,
          timestamp: Date.now(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    log.error('Pair programming error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/code-lab/pair-programming
 *
 * Health check and capability info
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    capabilities: ['edit', 'open', 'complete', 'analyze'],
    model: 'claude-sonnet-4-20250514',
    rateLimit: {
      limit: 60, // Centralized rate limit: 60 requests per minute
      window: '1 minute',
    },
  });
}
