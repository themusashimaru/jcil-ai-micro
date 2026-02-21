/**
 * DOCUMENT PROCESSING API
 *
 * Processes uploaded documents:
 * 1. Downloads file from storage
 * 2. Extracts text content
 * 3. Chunks into smaller pieces
 * 4. Stores in database (no embeddings - uses keyword search)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 120;

const log = logger('DocumentsProcess');

// Service role client for database and storage operations (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Chunk settings
const CHUNK_SIZE = 500; // tokens (approximate)
const CHUNK_OVERLAP = 50; // tokens overlap between chunks

/**
 * Simple text chunking by paragraphs and sentences
 */
function chunkText(text: string, maxChunkSize: number = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    const paraTokens = Math.ceil(trimmedPara.length / 4);
    const currentTokens = Math.ceil(currentChunk.length / 4);

    if (currentTokens + paraTokens > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 2));
      currentChunk = overlapWords.join(' ') + '\n\n' + trimmedPara;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Extract text from different file types
 */
async function extractText(
  fileBuffer: ArrayBuffer,
  fileType: string,
  _mimeType: string
): Promise<{ text: string; pageCount?: number }> {
  const buffer = Buffer.from(fileBuffer);

  switch (fileType) {
    case 'txt':
    case 'csv':
      return { text: buffer.toString('utf-8') };

    case 'pdf':
      try {
        const { extractText } = await import('unpdf');
        const uint8Array = new Uint8Array(buffer);
        const result = await extractText(uint8Array, { mergePages: true });
        const textContent = Array.isArray(result.text)
          ? result.text.join('\n')
          : String(result.text || '');
        return { text: textContent, pageCount: result.totalPages };
      } catch (error) {
        log.error('PDF parsing error', error instanceof Error ? error : { error });
        throw new Error('Failed to parse PDF document');
      }

    case 'docx':
    case 'doc':
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value };
      } catch (error) {
        log.error('DOCX parsing error', error instanceof Error ? error : { error });
        throw new Error('Failed to parse Word document');
      }

    case 'xlsx':
    case 'xls':
      try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        // Convert Buffer to ArrayBuffer for ExcelJS compatibility
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        );
        await workbook.xlsx.load(arrayBuffer);

        const textParts: string[] = [];
        workbook.eachSheet((worksheet) => {
          if (!worksheet.name) return;
          textParts.push(`\n=== Sheet: ${worksheet.name} ===`);

          worksheet.eachRow((row) => {
            const values = row.values as (string | number | boolean | Date | null | undefined)[];
            const cells = values.slice(1); // ExcelJS is 1-indexed
            if (cells.length > 0) {
              const rowText = cells
                .map((cell) => {
                  if (cell === null || cell === undefined) return '';
                  if (cell instanceof Date) return cell.toISOString();
                  return String(cell);
                })
                .join(',');
              textParts.push(rowText);
            }
          });
        });

        return { text: textParts.join('\n') };
      } catch {
        throw new Error('Failed to parse Excel file');
      }

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get document record
    const { data: document, error: docError } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      log.error('Document not found', { error: docError ?? 'Unknown error' });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify document belongs to the authenticated user
    if (document.user_id !== auth.user.id) {
      log.error('Unauthorized document access attempt', { documentId, userId: auth.user.id });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Update status to processing
    await supabase.from('user_documents').update({ status: 'processing' }).eq('id', documentId);

    try {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('user-documents')
        .download(document.storage_path);

      if (downloadError || !fileData) {
        throw new Error('Failed to download file');
      }

      // Extract text content
      const fileBuffer = await fileData.arrayBuffer();
      const { text, pageCount } = await extractText(
        fileBuffer,
        document.file_type,
        document.mime_type
      );

      if (!text || text.trim().length === 0) {
        throw new Error('No text content extracted from document');
      }

      // Chunk the text
      const chunks = chunkText(text);
      log.info('Chunks created', { documentId, chunkCount: chunks.length });

      // Delete existing chunks (in case of re-processing)
      await supabase.from('user_document_chunks').delete().eq('document_id', documentId);

      // Insert chunks (no embeddings - keyword search only)
      const chunkRecords = chunks.map((content, index) => ({
        document_id: documentId,
        user_id: document.user_id,
        content,
        chunk_index: index,
        token_count: Math.ceil(content.length / 4),
      }));

      // Insert in batches
      const insertBatchSize = 50;
      for (let i = 0; i < chunkRecords.length; i += insertBatchSize) {
        const batch = chunkRecords.slice(i, i + insertBatchSize);
        const { error: insertError } = await supabase.from('user_document_chunks').insert(batch);

        if (insertError) {
          log.error('Chunk insert error', { error: insertError });
          throw new Error('Failed to insert chunks');
        }
      }

      const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

      // Update document as ready
      await supabase
        .from('user_documents')
        .update({
          status: 'ready',
          chunk_count: chunks.length,
          page_count: pageCount || null,
          word_count: wordCount,
          processed_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      log.info('Processing complete', { documentId });

      return NextResponse.json({
        success: true,
        chunks: chunks.length,
        wordCount,
        pageCount,
      });
    } catch (processingError) {
      log.error(
        'Processing error',
        processingError instanceof Error ? processingError : { processingError }
      );

      await supabase
        .from('user_documents')
        .update({
          status: 'error',
          error_message:
            processingError instanceof Error ? processingError.message : 'Processing failed',
        })
        .eq('id', documentId);

      return NextResponse.json(
        {
          error: processingError instanceof Error ? processingError.message : 'Processing failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
