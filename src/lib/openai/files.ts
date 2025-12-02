/**
 * OpenAI Files API
 *
 * Upload files for use with GPT-4o (PDFs, CSVs, DOCXs)
 * Endpoint: /v1/files
 */

import { httpWithTimeout } from '../http';

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return key;
}

export type FilePurpose = 'assistants' | 'fine-tune' | 'vision' | 'batch';

export interface UploadedFile {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

/**
 * Upload a file to OpenAI
 *
 * @param file - File buffer
 * @param filename - Original filename
 * @param purpose - Purpose of the file (assistants, fine-tune, vision, batch)
 */
export async function uploadFile(
  file: Buffer,
  filename: string,
  purpose: FilePurpose = 'assistants'
): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', new Blob([file]), filename);
  formData.append('purpose', purpose);

  const response = await httpWithTimeout(`${OPENAI_BASE_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
    timeoutMs: 60_000, // 60s for large files
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI file upload failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Get file metadata
 */
export async function getFile(fileId: string): Promise<UploadedFile> {
  const response = await httpWithTimeout(`${OPENAI_BASE_URL}/files/${fileId}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI get file failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<{ id: string; deleted: boolean }> {
  const response = await httpWithTimeout(`${OPENAI_BASE_URL}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI delete file failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * List all files
 */
export async function listFiles(purpose?: FilePurpose): Promise<{ data: UploadedFile[] }> {
  const url = new URL(`${OPENAI_BASE_URL}/files`);
  if (purpose) {
    url.searchParams.set('purpose', purpose);
  }

  const response = await httpWithTimeout(url.toString(), {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI list files failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Retrieve file content
 */
export async function getFileContent(fileId: string): Promise<Buffer> {
  const response = await httpWithTimeout(`${OPENAI_BASE_URL}/files/${fileId}/content`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI get file content failed (${response.status}): ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Validate file MIME type and signature
 */
export function validateFileType(
  buffer: Buffer,
  filename: string
): { valid: boolean; mimeType: string | null; error?: string } {
  // PDF signature: %PDF
  if (buffer.slice(0, 4).toString() === '%PDF') {
    return { valid: true, mimeType: 'application/pdf' };
  }

  // DOCX signature: PK (ZIP archive)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    if (filename.endsWith('.docx')) {
      return { valid: true, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    if (filename.endsWith('.xlsx')) {
      return { valid: true, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    return { valid: true, mimeType: 'application/zip' };
  }

  // CSV (text-based, check extension)
  if (filename.endsWith('.csv')) {
    return { valid: true, mimeType: 'text/csv' };
  }

  // PNG signature
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { valid: true, mimeType: 'image/png' };
  }

  // JPEG signature
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  // Unknown type
  return {
    valid: false,
    mimeType: null,
    error: 'Unsupported file type. Supported: PDF, DOCX, XLSX, CSV, PNG, JPEG',
  };
}
