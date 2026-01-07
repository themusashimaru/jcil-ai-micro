/**
 * SINGLE FOLDER API
 * PATCH - Update folder (name, color, position)
 * DELETE - Delete folder (moves chats to unfiled)
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';

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
 * PATCH /api/folders/[id]
 * Update a folder's name, color, or position
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id } = await params;
    const supabase = await getSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, position } = body;

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      const trimmedName = name?.trim();
      if (!trimmedName) {
        return NextResponse.json({ error: 'Folder name cannot be empty' }, { status: 400 });
      }
      if (trimmedName.length > 50) {
        return NextResponse.json({ error: 'Folder name must be 50 characters or less' }, { status: 400 });
      }
      updates.name = trimmedName;
    }

    if (color !== undefined) {
      updates.color = color || null;
    }

    if (position !== undefined && typeof position === 'number') {
      updates.position = position;
    }

    // Update folder (RLS ensures user owns it)
    const { data: folder, error: updateError } = await supabase
      .from('chat_folders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'A folder with this name already exists' },
          { status: 400 }
        );
      }
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      console.error('[Folders API] Error updating folder:', updateError);
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error('[Folders API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/folders/[id]
 * Delete a folder (conversations are moved to unfiled)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id } = await params;
    const supabase = await getSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the folder (ON DELETE SET NULL will unfiled conversations automatically)
    const { error: deleteError } = await supabase
      .from('chat_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[Folders API] Error deleting folder:', deleteError);
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Folders API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
