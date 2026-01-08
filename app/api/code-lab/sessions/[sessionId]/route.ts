/**
 * CODE LAB SESSION DETAIL API
 *
 * Single session operations:
 * - GET: Get session details
 * - PATCH: Update session (rename, set repo)
 * - DELETE: Delete session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';

const log = logger('CodeLabSessionDetail');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: session, error } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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
        messageCount: session.message_count || 0,
        hasSummary: session.has_summary || false,
        linesAdded: session.lines_added || 0,
        linesRemoved: session.lines_removed || 0,
        filesChanged: session.files_changed || 0,
      }
    });
  } catch (error) {
    log.error('[CodeLab API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updates.title = body.title;
    }

    // Handle repo object -> separate columns
    if (body.repo !== undefined) {
      if (body.repo) {
        updates.repo_owner = body.repo.owner;
        updates.repo_name = body.repo.name;
        updates.repo_branch = body.repo.branch || 'main';
      } else {
        // Clear repo fields if repo is null
        updates.repo_owner = null;
        updates.repo_name = null;
        updates.repo_branch = null;
      }
    }

    const { data: session, error } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      log.error('[CodeLab API] Error updating session:', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
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
        messageCount: session.message_count || 0,
        hasSummary: session.has_summary || false,
        linesAdded: session.lines_added || 0,
        linesRemoved: session.lines_removed || 0,
        filesChanged: session.files_changed || 0,
      }
    });
  } catch (error) {
    log.error('[CodeLab API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete messages first
    await (supabase
      .from('code_lab_messages') as AnySupabase)
      .delete()
      .eq('session_id', sessionId);

    // Delete session
    const { error } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      log.error('[CodeLab API] Error deleting session:', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[CodeLab API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
