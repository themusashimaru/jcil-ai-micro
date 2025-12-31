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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    let query = supabase
      .from('user_documents')
      .select(`
        *,
        folder:user_document_folders(id, name, color)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (folderId === 'null' || folderId === '') {
      query = query.is('folder_id', null);
    } else if (folderId) {
      query = query.eq('folder_id', folderId);
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error('[Documents API] Error fetching documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Get user's stats for quota display
    const { data: stats } = await supabase
      .rpc('get_user_document_stats', { p_user_id: user.id });

    return NextResponse.json({
      documents,
      stats: stats?.[0] || { total_documents: 0, total_folders: 0, total_size_bytes: 0, total_chunks: 0 }
    });
  } catch (error) {
    console.error('[Documents API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderId = formData.get('folderId') as string | null;
    const customName = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileType = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES];
    if (!fileType) {
      return NextResponse.json({
        error: 'Invalid file type. Allowed: PDF, DOCX, XLSX, TXT, CSV'
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 10MB'
      }, { status: 400 });
    }

    // Check document limit based on tier (we'll add tier check later)
    const { count } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Default limit - will be adjusted by tier
    const documentLimit = 30;
    if (count && count >= documentLimit) {
      return NextResponse.json({
        error: `Document limit reached (${documentLimit}). Upgrade your plan for more storage.`
      }, { status: 403 });
    }

    // Create document record first to get ID
    const documentId = crypto.randomUUID();
    const storagePath = `${user.id}/${documentId}/${file.name}`;
    const displayName = customName?.trim() || file.name.replace(/\.[^/.]+$/, '');

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-documents')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Documents API] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Create document record
    const { data: document, error: insertError } = await supabase
      .from('user_documents')
      .insert({
        id: documentId,
        user_id: user.id,
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
      await supabase.storage.from('user-documents').remove([storagePath]);
      console.error('[Documents API] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
    }

    // Trigger async processing (chunking + embedding)
    // This will be done by a separate API call or edge function
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/documents/user/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    }).catch(err => console.error('[Documents API] Failed to trigger processing:', err));

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('[Documents API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, folderId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (folderId !== undefined) updateData.folder_id = folderId || null;

    const { data: document, error } = await supabase
      .from('user_documents')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Documents API] Update error:', error);
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error('[Documents API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Get document to find storage path
    const { data: document } = await supabase
      .from('user_documents')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (document?.storage_path) {
      // Delete from storage
      await supabase.storage.from('user-documents').remove([document.storage_path]);
    }

    // Delete chunks (cascade should handle this, but be explicit)
    await supabase
      .from('user_document_chunks')
      .delete()
      .eq('document_id', id)
      .eq('user_id', user.id);

    // Delete document record
    const { error } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Documents API] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Documents API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
