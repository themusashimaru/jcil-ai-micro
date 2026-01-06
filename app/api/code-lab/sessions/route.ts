/**
 * CODE LAB SESSIONS API
 *
 * Handles session CRUD operations:
 * - GET: List all sessions for user
 * - POST: Create new session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// Generate UUID without external dependency
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch sessions for user
    const { data: sessions, error } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[CodeLab API] Error fetching sessions:', error);
      // Return empty array if table doesn't exist yet
      return NextResponse.json({ sessions: [] });
    }

    // Transform to expected format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedSessions = (sessions || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      // Construct repo object from separate columns
      repo: s.repo_owner ? {
        owner: s.repo_owner,
        name: s.repo_name,
        branch: s.repo_branch || 'main',
        fullName: `${s.repo_owner}/${s.repo_name}`,
      } : null,
      isActive: true,
      messageCount: s.message_count || 0,
      hasSummary: s.has_summary || false,
      linesAdded: s.lines_added || 0,
      linesRemoved: s.lines_removed || 0,
      filesChanged: s.files_changed || 0,
    }));

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('[CodeLab API] Error:', error);
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title = 'New Session', repo } = body;

    // Create session
    const sessionId = generateId();
    const now = new Date().toISOString();

    // Prepare repo fields from repo object
    const repoFields = repo ? {
      repo_owner: repo.owner,
      repo_name: repo.name,
      repo_branch: repo.branch || 'main',
    } : {};

    const { data: session, error } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .insert({
        id: sessionId,
        user_id: user.id,
        title,
        ...repoFields,
        created_at: now,
        updated_at: now,
        message_count: 0,
        has_summary: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[CodeLab API] Error creating session:', error);
      // Return a mock session if table doesn't exist
      return NextResponse.json({
        session: {
          id: sessionId,
          title,
          createdAt: now,
          updatedAt: now,
          repo,
          isActive: true,
          messageCount: 0,
          hasSummary: false,
        }
      });
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        repo: session.repo_owner ? {
          owner: session.repo_owner,
          name: session.repo_name,
          branch: session.repo_branch || 'main',
          fullName: `${session.repo_owner}/${session.repo_name}`,
        } : null,
        isActive: true,
        messageCount: 0,
        hasSummary: false,
      }
    });
  } catch (error) {
    console.error('[CodeLab API] Error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
