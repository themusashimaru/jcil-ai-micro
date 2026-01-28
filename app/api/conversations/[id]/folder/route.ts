/**
 * CONVERSATION FOLDER API
 * PATCH - Move conversation to a folder (or remove from folder)
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('ConversationFolderAPI');

export const dynamic = 'force-dynamic';

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/conversations/[id]/folder
 * Move conversation to a folder or remove from folder
 * Body: { folder_id: string | null }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id } = await params;
    const supabase = await getSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(`folder:${user.id}`, rateLimits.standard);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const body = await request.json();
    const { folder_id } = body;

    // If folder_id is provided, verify user owns the folder
    if (folder_id) {
      const { data: folder, error: folderError } = await supabase
        .from('chat_folders')
        .select('id')
        .eq('id', folder_id)
        .eq('user_id', user.id)
        .single();

      if (folderError || !folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
    }

    // Update conversation's folder
    const { data: conversation, error: updateError } = await supabase
      .from('conversations')
      .update({
        folder_id: folder_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, folder_id')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      log.error('[Conversation Folder API] Error:', { error: updateError ?? 'Unknown error' });
      return NextResponse.json({ error: 'Failed to move conversation' }, { status: 500 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    log.error('[Conversation Folder API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
