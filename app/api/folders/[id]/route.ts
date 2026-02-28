/**
 * SINGLE FOLDER API
 * PATCH - Update folder (name, color, position)
 * DELETE - Delete folder (moves chats to unfiled)
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('FolderDetailAPI');

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
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
        return errors.badRequest('Folder name cannot be empty');
      }
      if (trimmedName.length > 50) {
        return errors.badRequest('Folder name must be 50 characters or less');
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
        return errors.badRequest('A folder with this name already exists');
      }
      if (updateError.code === 'PGRST116') {
        return errors.notFound('Folder');
      }
      log.error(
        '[Folders API] Error updating folder:',
        updateError instanceof Error ? updateError : { updateError }
      );
      return errors.serverError('Failed to update folder');
    }

    return successResponse({ folder });
  } catch (error) {
    log.error('[Folders API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Delete the folder (ON DELETE SET NULL will unfiled conversations automatically)
    const { error: deleteError } = await supabase
      .from('chat_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      log.error(
        '[Folders API] Error deleting folder:',
        deleteError instanceof Error ? deleteError : { deleteError }
      );
      return errors.serverError('Failed to delete folder');
    }

    return successResponse({ success: true });
  } catch (error) {
    log.error('[Folders API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
