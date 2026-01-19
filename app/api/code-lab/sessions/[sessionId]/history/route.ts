/**
 * CODE LAB SESSION HISTORY API
 *
 * Claude Code parity - Session history operations:
 * - GET: Export session as markdown
 * - POST: Search through session messages
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';

const log = logger('CodeLabHistory');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  type?: string;
}

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  repo_owner?: string;
  repo_name?: string;
  repo_branch?: string;
}

/**
 * GET - Export session as markdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify session belongs to user
    const { data: session } = (await (supabase.from('code_lab_sessions') as AnySupabase)
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()) as { data: Session | null };

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get all messages
    const { data: messages } = (await (supabase.from('code_lab_messages') as AnySupabase)
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })) as { data: Message[] | null };

    // Check export format
    const format = request.nextUrl.searchParams.get('format') || 'markdown';

    if (format === 'json') {
      // Return raw JSON
      return NextResponse.json({
        session: {
          id: session.id,
          title: session.title,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          repo: session.repo_owner
            ? {
                owner: session.repo_owner,
                name: session.repo_name,
                branch: session.repo_branch,
              }
            : null,
        },
        messages: messages || [],
        exportedAt: new Date().toISOString(),
      });
    }

    // Generate markdown export
    const markdown = generateMarkdownExport(session, messages || []);

    // Return as downloadable file
    const filename = `${session.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${sessionId.slice(0, 8)}.md`;

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    log.error('[CodeLab History] Export error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to export session' }, { status: 500 });
  }
}

/**
 * POST - Search through session messages
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, role, limit = 50 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Search query required' }, { status: 400 });
    }

    // Verify session belongs to user
    const { data: session } = await (supabase.from('code_lab_sessions') as AnySupabase)
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Search messages with ILIKE for case-insensitive search
    let messageQuery = (supabase.from('code_lab_messages') as AnySupabase)
      .select('*')
      .eq('session_id', sessionId)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: true })
      .limit(limit);

    // Filter by role if specified
    if (role && ['user', 'assistant', 'system'].includes(role)) {
      messageQuery = messageQuery.eq('role', role);
    }

    const { data: messages, error } = await messageQuery;

    if (error) {
      log.error('[CodeLab History] Search error:', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Highlight search matches in content
    const highlightedMessages = (messages || []).map((m: Message) => ({
      id: m.id,
      sessionId: m.session_id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      type: m.type,
      // Add match context
      matchContext: extractMatchContext(m.content, query),
    }));

    return NextResponse.json({
      query,
      results: highlightedMessages,
      total: highlightedMessages.length,
    });
  } catch (error) {
    log.error('[CodeLab History] Search error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * Generate markdown export of session
 */
function generateMarkdownExport(session: Session, messages: Message[]): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${session.title}`);
  lines.push('');
  lines.push(`**Session ID:** \`${session.id}\``);
  lines.push(`**Created:** ${new Date(session.created_at).toLocaleString()}`);
  lines.push(`**Last Updated:** ${new Date(session.updated_at).toLocaleString()}`);

  if (session.repo_owner) {
    lines.push(
      `**Repository:** ${session.repo_owner}/${session.repo_name} (${session.repo_branch})`
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Messages
  for (const message of messages) {
    const timestamp = new Date(message.created_at).toLocaleTimeString();
    const roleLabel =
      message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Claude' : 'System';
    const roleEmoji = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';

    lines.push(`## ${roleEmoji} ${roleLabel} (${timestamp})`);
    lines.push('');
    lines.push(message.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Footer
  lines.push(`*Exported from Code Lab on ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

/**
 * Extract context around search matches
 */
function extractMatchContext(content: string, query: string, contextChars: number = 100): string[] {
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

    // Limit to 3 contexts per message
    if (contexts.length >= 3) break;
  }

  return contexts;
}
