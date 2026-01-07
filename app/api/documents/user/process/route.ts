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

export const runtime = 'nodejs';
export const maxDuration = 120;

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
        console.error('[Process] PDF parsing error:', error);
        throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    case 'docx':
    case 'doc':
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value };
      } catch (error) {
        console.error('[Process] DOCX parsing error:', error);
        throw new Error('Failed to parse Word document');
      }

    case 'xlsx':
    case 'xls':
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let text = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          text += `\n=== Sheet: ${sheetName} ===\n${csv}\n`;
        }
        return { text };
      } catch (error) {
        console.error('[Process] Excel parsing error:', error);
        throw new Error('Failed to parse Excel file');
      }

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

export async function POST(request: NextRequest) {
  try {
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
      console.error('[Process] Document not found:', docError);
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Update status to processing
    await supabase
      .from('user_documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

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
      console.log(`[Process] Document ${documentId}: ${chunks.length} chunks created`);

      // Delete existing chunks (in case of re-processing)
      await supabase
        .from('user_document_chunks')
        .delete()
        .eq('document_id', documentId);

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
        const { error: insertError } = await supabase
          .from('user_document_chunks')
          .insert(batch);

        if (insertError) {
          console.error('[Process] Chunk insert error:', insertError);
          throw new Error('Failed to insert chunks');
        }
      }

      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

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

      console.log(`[Process] Document ${documentId}: Processing complete`);

      return NextResponse.json({
        success: true,
        chunks: chunks.length,
        wordCount,
        pageCount,
      });
    } catch (processingError) {
      console.error('[Process] Processing error:', processingError);

      await supabase
        .from('user_documents')
        .update({
          status: 'error',
          error_message: processingError instanceof Error ? processingError.message : 'Processing failed',
        })
        .eq('id', documentId);

      return NextResponse.json({
        error: processingError instanceof Error ? processingError.message : 'Processing failed'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Process] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
