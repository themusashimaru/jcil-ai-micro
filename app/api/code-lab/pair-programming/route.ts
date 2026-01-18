/**
 * PAIR PROGRAMMING API - REAL CLAUDE-POWERED SUGGESTIONS
 *
 * This endpoint connects the UI to the real AIPairProgrammer backend.
 * No mocks, no placeholders - real Claude API calls for real-time coding assistance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPairProgrammer, CodeEdit, PairProgrammerContext, PairProgrammerSuggestion } from '@/lib/pair-programmer';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

const log = logger('PairProgrammingAPI');

// Rate limiting: max 30 requests per minute per user
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(userId);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }

  if (limit.count >= RATE_LIMIT) {
    return false;
  }

  limit.count++;
  return true;
}

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
  const typeMap: Record<string, 'completion' | 'refactor' | 'bug' | 'docs' | 'test' | 'security'> = {
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

    // Rate limit check
    if (!checkRateLimit(auth.user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429 }
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
      limit: RATE_LIMIT,
      window: '1 minute',
    },
  });
}
