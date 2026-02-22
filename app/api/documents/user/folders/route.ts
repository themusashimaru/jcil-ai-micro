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

import { NextRequest, NextResponse } from 'next/server';
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
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }

    return NextResponse.json({ folders });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { name, parentFolderId, color, icon } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
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
      return NextResponse.json({
        error: `Folder limit reached (${folderLimit}). Upgrade your plan for more folders.`
      }, { status: 403 });
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
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 });
      }
      log.error('Error creating folder', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { id, name, color, icon, parentFolderId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const db = createDbClient();

    // Verify ownership first
    const { data: existing } = await db
      .from('user_document_folders')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
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
        return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 });
      }
      log.error('Error updating folder', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const db = createDbClient();

    // Verify ownership first
    const { data: existing } = await db
      .from('user_document_folders')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Move documents in this folder to root (folder_id = null)
    await db
      .from('user_documents')
      .update({ folder_id: null })
      .eq('folder_id', id);

    // Move subfolders to root
    await db
      .from('user_document_folders')
      .update({ parent_folder_id: null })
      .eq('parent_folder_id', id);

    // Delete the folder
    const { error } = await db
      .from('user_document_folders')
      .delete()
      .eq('id', id);

    if (error) {
      log.error('Error deleting folder', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
