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
import { cookies } from 'next/headers';

// Helper to create authenticated Supabase client
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

export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: folders, error } = await supabase
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

    // Check folder limit based on tier (we'll add tier check later)
    const { count } = await supabase
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

    const { data: folder, error } = await supabase
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

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (parentFolderId !== undefined) updateData.parent_folder_id = parentFolderId;

    const { data: folder, error } = await supabase
      .from('user_document_folders')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
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

    // Move documents in this folder to root (folder_id = null)
    await supabase
      .from('user_documents')
      .update({ folder_id: null })
      .eq('folder_id', id)
      .eq('user_id', user.id);

    // Move subfolders to root
    await supabase
      .from('user_document_folders')
      .update({ parent_folder_id: null })
      .eq('parent_folder_id', id)
      .eq('user_id', user.id);

    // Delete the folder
    const { error } = await supabase
      .from('user_document_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

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
