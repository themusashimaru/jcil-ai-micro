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
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Helper to create authenticated Supabase client (for auth)
async function createSupabaseClient() {
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
            // Server Component context
          }
        },
      },
    }
  );
}

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
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createDbClient();
    const { data: folders, error } = await db
      .from('user_document_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Folders API] Error fetching folders:', error);
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('[Folders API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      .eq('user_id', user.id);

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
        user_id: user.id,
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
      console.error('[Folders API] Error creating folder:', error);
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error('[Folders API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (!existing || existing.user_id !== user.id) {
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
      console.error('[Folders API] Error updating folder:', error);
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error('[Folders API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (!existing || existing.user_id !== user.id) {
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
      console.error('[Folders API] Error deleting folder:', error);
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Folders API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
