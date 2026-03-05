/**
 * ANTHROPIC FILES API SERVICE
 *
 * Provides persistent file storage via Anthropic's Files API.
 * Files can be uploaded once and referenced across multiple API calls.
 *
 * Features:
 * - Upload files (PDF, XLSX, DOCX, images, text) for reuse across conversations
 * - Download previously uploaded files
 * - List and manage uploaded files
 * - File metadata retrieval
 *
 * Beta header: anthropic-beta: files-api-2025-04-14
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('AnthropicFiles');

// Lazy-initialize to avoid build-time errors
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    // Use the first available API key
    const apiKey = process.env.ANTHROPIC_API_KEY_1 || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('No Anthropic API key configured for Files API');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ============================================================================
// TYPES
// ============================================================================

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface FileUploadOptions {
  /** Purpose of the upload (for organizational tracking) */
  purpose?: string;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Upload a file to Anthropic's Files API for reuse across conversations
 *
 * @param fileBuffer - File data as Buffer
 * @param filename - Original filename
 * @param mimeType - MIME type of the file
 * @returns Uploaded file metadata
 */
export async function uploadFile(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadedFile> {
  const client = getClient();

  // Convert Buffer to a File-like object for the SDK
  const uint8 = new Uint8Array(fileBuffer);
  const file = new File([uint8], filename, { type: mimeType });

  const result = await client.beta.files.upload({
    file,
  });

  log.info('File uploaded to Anthropic', {
    fileId: result.id,
    filename: result.filename,
    sizeBytes: result.size_bytes,
  });

  return {
    id: result.id,
    filename: result.filename,
    mimeType: mimeType,
    sizeBytes: result.size_bytes,
    createdAt: result.created_at,
  };
}

/**
 * Download a file from Anthropic's Files API
 *
 * @param fileId - Anthropic file ID
 * @returns File data as Buffer
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const client = getClient();

  const response = await client.beta.files.download(fileId);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

/**
 * Get metadata for an uploaded file
 *
 * @param fileId - Anthropic file ID
 * @returns File metadata
 */
export async function getFileMetadata(fileId: string): Promise<UploadedFile> {
  const client = getClient();

  const result = await client.beta.files.retrieveMetadata(fileId);

  return {
    id: result.id,
    filename: result.filename,
    mimeType: result.mime_type,
    sizeBytes: result.size_bytes,
    createdAt: result.created_at,
  };
}

/**
 * List all uploaded files
 *
 * @returns Array of file metadata
 */
export async function listFiles(): Promise<UploadedFile[]> {
  const client = getClient();
  const files: UploadedFile[] = [];

  for await (const file of client.beta.files.list()) {
    files.push({
      id: file.id,
      filename: file.filename,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
    });
  }

  return files;
}

/**
 * Delete a file from Anthropic's Files API
 *
 * @param fileId - Anthropic file ID
 */
export async function deleteFile(fileId: string): Promise<void> {
  const client = getClient();

  await client.beta.files.delete(fileId);

  log.info('File deleted from Anthropic', { fileId });
}

/**
 * Create a file content block for use in messages.
 * This allows referencing an uploaded file in a conversation
 * without re-sending the full content.
 *
 * @param fileId - Anthropic file ID
 * @returns Content block for use in API messages
 */
export function createFileContentBlock(fileId: string) {
  return {
    type: 'document' as const,
    source: {
      type: 'file' as const,
      file_id: fileId,
    },
  };
}
