/**
 * USER DOCUMENTS API
 *
 * File management for user's document storage
 *
 * GET - List user's documents
 * POST - Upload new document
 * PUT - Rename/move document
 * DELETE - Delete document
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

const log = logger('DocumentsFiles');

// Service role client for storage operations (bypasses RLS)
function createStorageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Allowed file types
const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    let query = supabase
      .from('user_documents')
      .select(
        `
        *,
        folder:user_document_folders(id, name, color)
      `
      )
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (folderId === 'null' || folderId === '') {
      query = query.is('folder_id', null);
    } else if (folderId) {
      query = query.eq('folder_id', folderId);
    }

    const { data: documents, error } = await query;

    if (error) {
      log.error('Error fetching documents', error instanceof Error ? error : { error });
      return errors.serverError('Failed to fetch documents');
    }

    // Get user's stats for quota display
    const { data: stats } = await supabase.rpc('get_user_document_stats', {
      p_user_id: auth.user.id,
    });

    return successResponse({
      documents,
      stats: stats?.[0] || {
        total_documents: 0,
        total_folders: 0,
        total_size_bytes: 0,
        total_chunks: 0,
      },
    });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderId = formData.get('folderId') as string | null;
    const customName = formData.get('name') as string | null;

    if (!file) {
      return errors.badRequest('No file provided');
    }

    // Validate file type
    const fileType = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES];
    if (!fileType) {
      return errors.badRequest('Invalid file type. Allowed: PDF, DOCX, XLSX, TXT, CSV');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return errors.badRequest('File too large. Maximum size is 10MB');
    }

    // Check document limit based on tier (we'll add tier check later)
    const { count } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id);

    // Default limit - will be adjusted by tier
    const documentLimit = 30;
    if (count && count >= documentLimit) {
      return errors.forbidden(
        `Document limit reached (${documentLimit}). Upgrade your plan for more storage.`
      );
    }

    // Create document record first to get ID
    const documentId = crypto.randomUUID();
    const storagePath = `${auth.user.id}/${documentId}/${file.name}`;
    const displayName = customName?.trim() || file.name.replace(/\.[^/.]+$/, '');

    // Use service role client for storage (bypasses RLS)
    const storageClient = createStorageClient();

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await storageClient.storage
      .from('user-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      log.error('Upload error', { error: uploadError ?? 'Unknown error' });
      return errors.serverError('Failed to upload file');
    }

    // Create document record (use service role to bypass RLS for insert too)
    const { data: document, error: insertError } = await storageClient
      .from('user_documents')
      .insert({
        id: documentId,
        user_id: auth.user.id,
        folder_id: folderId || null,
        name: displayName,
        original_filename: file.name,
        file_type: fileType,
        mime_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file
      await storageClient.storage.from('user-documents').remove([storagePath]);
      log.error('Insert error', { error: insertError ?? 'Unknown error' });
      return errors.serverError('Failed to create document record');
    }

    // Note: Processing is triggered by the client after upload completes
    // This ensures proper error handling and UI feedback

    return successResponse({ document }, 201);
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const body = await request.json();
    const { id, name, folderId } = body;

    if (!id) {
      return errors.badRequest('Document ID is required');
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (folderId !== undefined) updateData.folder_id = folderId || null;

    const { data: document, error } = await supabase
      .from('user_documents')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) {
      log.error('Update error', error instanceof Error ? error : { error });
      return errors.serverError('Failed to update document');
    }

    return successResponse({ document });
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
      return errors.badRequest('Document ID is required');
    }

    // Use service role client for storage and deletes
    const storageClient = createStorageClient();

    // Get document to find storage path
    const { data: document } = await storageClient
      .from('user_documents')
      .select('storage_path, user_id')
      .eq('id', id)
      .single();

    // Verify ownership
    if (!document || document.user_id !== auth.user.id) {
      return errors.notFound('Document');
    }

    if (document?.storage_path) {
      // Delete from storage
      await storageClient.storage.from('user-documents').remove([document.storage_path]);
    }

    // Delete chunks (cascade should handle this, but be explicit)
    await storageClient.from('user_document_chunks').delete().eq('document_id', id);

    // Delete document record
    const { error } = await storageClient.from('user_documents').delete().eq('id', id);

    if (error) {
      log.error('Delete error', error instanceof Error ? error : { error });
      return errors.serverError('Failed to delete document');
    }

    return successResponse({ success: true });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}
