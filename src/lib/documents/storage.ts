/**
 * Document Storage
 *
 * Uploads generated documents to Supabase storage and returns
 * signed download URLs. Falls back to base64 data URLs when
 * Supabase is not available.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('DocumentStorage');

interface UploadResult {
  /** URL for downloading the file (Supabase proxy or base64 data URL) */
  url: string;
  /** 'supabase' if uploaded to storage, 'base64' if inline */
  storage: 'supabase' | 'base64';
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Upload a document buffer to Supabase storage and return a download URL.
 * Falls back to a base64 data URL if Supabase is unavailable or upload fails.
 */
export async function uploadDocument(
  userId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    log.debug('Supabase not configured, using base64 fallback');
    return toBase64Fallback(buffer, mimeType);
  }

  try {
    // Ensure bucket exists (idempotent)
    try {
      await supabase.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024, // 10 MB
      });
    } catch {
      // Bucket may already exist — this is fine
    }

    // Deduplicate filenames with timestamp
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}_${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      log.error('Supabase upload failed, falling back to base64', {
        error: uploadError.message,
      });
      return toBase64Fallback(buffer, mimeType);
    }

    log.info('Document uploaded to Supabase', { filePath, size: buffer.length });

    // Build a proxy download URL (token encodes user + filename for the download endpoint)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jcil.ai';
    const token = Buffer.from(
      JSON.stringify({ u: userId, f: `${timestamp}_${filename}`, t: filename.split('.').pop() })
    ).toString('base64url');

    return {
      url: `${baseUrl}/api/documents/download?token=${token}`,
      storage: 'supabase',
    };
  } catch (error) {
    log.error('Document upload error', error as Error);
    return toBase64Fallback(buffer, mimeType);
  }
}

function toBase64Fallback(buffer: Buffer, mimeType: string): UploadResult {
  const base64 = buffer.toString('base64');
  return {
    url: `data:${mimeType};base64,${base64}`,
    storage: 'base64',
  };
}
