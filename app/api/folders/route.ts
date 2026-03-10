/**
 * CHAT FOLDERS API
 * GET - List user's folders
 * POST - Create a new folder (max 20 per user)
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('FoldersAPI');

export const dynamic = 'force-dynamic';

const MAX_FOLDERS_PER_USER = 20;

// Predefined colors for folder selection (returned in GET response)
const FOLDER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
];

/**
 * GET /api/folders
 * List all folders for authenticated user
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;

    const { data: folders, error } = await auth.supabase
      .from('chat_folders')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('position', { ascending: true });

    if (error) {
      log.error(
        '[Folders API] Error fetching folders:',
        error instanceof Error ? error : { error }
      );
      return errors.serverError('Failed to fetch folders');
    }

    return successResponse({
      folders: folders || [],
      maxFolders: MAX_FOLDERS_PER_USER,
      availableColors: FOLDER_COLORS,
    });
  } catch (error) {
    log.error('[Folders API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}

/**
 * POST /api/folders
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { name, color } = body;

    // Validate name
    if (!name?.trim()) {
      return errors.badRequest('Folder name is required');
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return errors.badRequest('Folder name must be 50 characters or less');
    }

    // Check folder limit
    const { count } = await auth.supabase
      .from('chat_folders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id);

    if ((count || 0) >= MAX_FOLDERS_PER_USER) {
      return errors.badRequest(`Maximum ${MAX_FOLDERS_PER_USER} folders allowed`);
    }

    // Get next position
    const { data: lastFolder } = await auth.supabase
      .from('chat_folders')
      .select('position')
      .eq('user_id', auth.user.id)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (lastFolder?.position ?? -1) + 1;

    // Create folder
    const { data: folder, error: insertError } = await auth.supabase
      .from('chat_folders')
      .insert({
        user_id: auth.user.id,
        name: trimmedName,
        color: color || null,
        position: nextPosition,
      })
      .select()
      .single();

    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return errors.badRequest('A folder with this name already exists');
      }
      log.error(
        '[Folders API] Error creating folder:',
        insertError instanceof Error ? insertError : { insertError }
      );
      return errors.serverError('Failed to create folder');
    }

    return successResponse({ folder }, 201);
  } catch (error) {
    log.error('[Folders API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
