/**
 * FILE UPLOAD API - Upload files to Anthropic Files API
 *
 * PURPOSE:
 * - Accept file uploads from the frontend
 * - Upload to Anthropic's Files API for persistent storage
 * - Return file ID for use in conversations
 *
 * USAGE:
 * POST /api/files/upload (multipart/form-data)
 * Body: { file: File }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/server-auth';
import { uploadFile } from '@/lib/anthropic/files';
import { logger } from '@/lib/logger';

const log = logger('FileUploadAPI');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 30MB max file size
const MAX_FILE_SIZE = 30 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `File type "${file.type}" not supported. Allowed types: PDF, XLSX, DOCX, PPTX, CSV, TXT, and images.`,
        },
        { status: 400 }
      );
    }

    // Upload to Anthropic Files API
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFile(buffer, file.name, file.type);

    log.info('File uploaded successfully', {
      userId: session.user.id,
      fileId: result.id,
      filename: result.filename,
      sizeBytes: result.sizeBytes,
    });

    return NextResponse.json({
      fileId: result.id,
      filename: result.filename,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    });
  } catch (error) {
    log.error('File upload failed', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
