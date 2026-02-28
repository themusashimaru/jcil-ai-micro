/**
 * USER DOCUMENT FOLDERS API
 *
 * CRUD operations for user's document folders
 *
 * GET - List user's folders
 * POST - Create new folder
 * PUT - Rename folder
 * DELETE - Delete folder (and move contents to root)
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

const log = logger('DocumentsFolders');

// Service role client for database operations (bypasses RLS)
function createDbClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;

    const db = createDbClient();
    const { data: folders, error } = await db
      .from('user_document_folders')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('name', { ascending: true });

    if (error) {
      log.error('Error fetching folders', error instanceof Error ? error : { error });
      return errors.serverError('Failed to fetch folders');
    }

    return successResponse({ folders });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { name, parentFolderId, color, icon } = body;

    if (!name || name.trim().length === 0) {
      return errors.badRequest('Folder name is required');
    }

    const db = createDbClient();

    // Check folder limit based on tier (we'll add tier check later)
    const { count } = await db
      .from('user_document_folders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id);

    // Default limit - will be adjusted by tier
    const folderLimit = 20;
    if (count && count >= folderLimit) {
      return errors.forbidden(
        `Folder limit reached (${folderLimit}). Upgrade your plan for more folders.`
      );
    }

    const { data: folder, error } = await db
      .from('user_document_folders')
      .insert({
        user_id: auth.user.id,
        name: name.trim(),
        parent_folder_id: parentFolderId || null,
        color: color || '#3b82f6',
        icon: icon || 'folder',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        return errors.conflict('A folder with this name already exists');
      }
      log.error('Error creating folder', error instanceof Error ? error : { error });
      return errors.serverError('Failed to create folder');
    }

    return successResponse({ folder }, 201);
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { id, name, color, icon, parentFolderId } = body;

    if (!id) {
      return errors.badRequest('Folder ID is required');
    }

    const db = createDbClient();

    // Verify ownership first
    const { data: existing } = await db
      .from('user_document_folders')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== auth.user.id) {
      return errors.notFound('Folder');
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (parentFolderId !== undefined) updateData.parent_folder_id = parentFolderId;

    const { data: folder, error } = await db
      .from('user_document_folders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return errors.conflict('A folder with this name already exists');
      }
      log.error('Error updating folder', error instanceof Error ? error : { error });
      return errors.serverError('Failed to update folder');
    }

    return successResponse({ folder });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errors.badRequest('Folder ID is required');
    }

    const db = createDbClient();

    // Verify ownership first
    const { data: existing } = await db
      .from('user_document_folders')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== auth.user.id) {
      return errors.notFound('Folder');
    }

    // Move documents in this folder to root (folder_id = null)
    await db.from('user_documents').update({ folder_id: null }).eq('folder_id', id);

    // Move subfolders to root
    await db
      .from('user_document_folders')
      .update({ parent_folder_id: null })
      .eq('parent_folder_id', id);

    // Delete the folder
    const { error } = await db.from('user_document_folders').delete().eq('id', id);

    if (error) {
      log.error('Error deleting folder', error instanceof Error ? error : { error });
      return errors.serverError('Failed to delete folder');
    }

    return successResponse({ success: true });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}
