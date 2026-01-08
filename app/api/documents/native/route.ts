/**
 * NATIVE DOCUMENT GENERATION API
 *
 * POST - Generate native documents (DOCX, XLSX) from structured JSON
 * This is the new approach: AI outputs JSON → Backend converts to actual files
 *
 * Supports:
 * - Resume → .docx (Word)
 * - Spreadsheet → .xlsx (Excel)
 * - Document → .docx (Word)
 * - Invoice → .pdf (via PDFKit)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  generateDocument,
  validateDocumentJSON,
  type DocumentData,
} from '@/lib/documents';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Get authenticated user ID from session
 */
async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
              // Cookie operations may fail
            }
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Get Supabase admin client for storage operations
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * POST - Generate a native document from JSON
 * Body: { documentData: DocumentData, filename?: string }
 * Returns: Download URL or binary file
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { documentData, filename, returnType = 'url' } = body as {
      documentData: unknown;
      filename?: string;
      returnType?: 'url' | 'binary' | 'base64';
    };

    if (!documentData) {
      return NextResponse.json(
        { error: 'Missing documentData in request body' },
        { status: 400 }
      );
    }

    // Validate document structure
    const validation = validateDocumentJSON(documentData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid document data: ${validation.error}` },
        { status: 400 }
      );
    }

    const docData = documentData as DocumentData;

    console.log('[Native Documents API] Generating document:', {
      type: docData.type,
      userId: userId.substring(0, 8) + '...',
    });

    // Generate the document
    const result = await generateDocument(docData, filename);

    console.log('[Native Documents API] Document generated:', {
      filename: result.filename,
      size: result.buffer.length,
      type: result.mimeType,
      extension: result.extension,
    });

    // Return binary if requested
    if (returnType === 'binary') {
      // Convert Buffer to Uint8Array for NextResponse
      const uint8Array = new Uint8Array(result.buffer);
      return new NextResponse(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'Content-Length': result.buffer.length.toString(),
          'X-Document-Type': docData.type,
          'X-Document-Extension': result.extension,
        },
      });
    }

    // Return base64 if requested
    if (returnType === 'base64') {
      const base64 = result.buffer.toString('base64');
      const dataUrl = `data:${result.mimeType};base64,${base64}`;
      return NextResponse.json({
        success: true,
        format: result.extension,
        title: getDocumentTitle(docData),
        filename: result.filename,
        mimeType: result.mimeType,
        dataUrl,
        storage: 'local',
      });
    }

    // Default: Upload to Supabase and return URL
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Fallback to base64 if no Supabase
      const base64 = result.buffer.toString('base64');
      const dataUrl = `data:${result.mimeType};base64,${base64}`;
      return NextResponse.json({
        success: true,
        format: result.extension,
        title: getDocumentTitle(docData),
        filename: result.filename,
        mimeType: result.mimeType,
        dataUrl,
        storage: 'fallback',
      });
    }

    // Ensure bucket exists
    try {
      await supabase.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
      });
    } catch {
      // Bucket might already exist
    }

    // Upload document
    const filePath = `${userId}/${result.filename}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, result.buffer, {
        contentType: result.mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Native Documents API] Upload error:', uploadError);
      // Fallback to base64
      const base64 = result.buffer.toString('base64');
      const dataUrl = `data:${result.mimeType};base64,${base64}`;
      return NextResponse.json({
        success: true,
        format: result.extension,
        title: getDocumentTitle(docData),
        filename: result.filename,
        mimeType: result.mimeType,
        dataUrl,
        storage: 'fallback',
      });
    }

    console.log('[Native Documents API] Uploaded to:', filePath);

    // Generate proxy URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    request.headers.get('origin') ||
                    'https://jcil.ai';

    const token = Buffer.from(JSON.stringify({
      u: userId,
      f: result.filename,
      t: result.extension,
    })).toString('base64url');

    const downloadUrl = `${baseUrl}/api/documents/download?token=${token}`;

    return NextResponse.json({
      success: true,
      format: result.extension,
      title: getDocumentTitle(docData),
      filename: result.filename,
      mimeType: result.mimeType,
      downloadUrl,
      expiresIn: '1 hour',
      storage: 'supabase',
    });

  } catch (error) {
    console.error('[Native Documents API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate document' },
      { status: 500 }
    );
  }
}

/**
 * GET - Return schema information
 */
export async function GET() {
  return NextResponse.json({
    description: 'Native Document Generation API',
    info: 'Generates real DOCX and XLSX files from structured JSON',
    endpoint: {
      method: 'POST',
      body: {
        documentData: 'DocumentData object (required)',
        filename: 'Custom filename (optional)',
        returnType: '"url" | "binary" | "base64" (default: url)',
      },
    },
    supportedTypes: {
      resume: {
        outputFormat: '.docx',
        description: 'Professional resume in Word format',
      },
      spreadsheet: {
        outputFormat: '.xlsx',
        description: 'Excel spreadsheet with formulas and formatting',
      },
      document: {
        outputFormat: '.docx',
        description: 'General Word document (letters, reports, etc.)',
      },
      invoice: {
        outputFormat: '.pdf',
        description: 'Professional invoice in PDF format',
      },
    },
  });
}

/**
 * Get document title from data
 */
function getDocumentTitle(doc: DocumentData): string {
  switch (doc.type) {
    case 'resume':
      return `${doc.name} - Resume`;
    case 'spreadsheet':
      return doc.title;
    case 'document':
      return doc.title;
    case 'invoice':
      return `Invoice ${doc.invoiceNumber}`;
    default:
      return 'Document';
  }
}
