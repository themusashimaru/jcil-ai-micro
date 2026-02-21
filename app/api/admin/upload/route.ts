/**
 * ADMIN UPLOAD API
 * Handles file uploads for logos, favicons, and animated logos
 * Uploads to Supabase Storage for fast CDN delivery
 * Supports images (PNG, JPEG, ICO, GIF) and videos (MP4, WebM) for animated logos
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('AdminUpload');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valid file types for upload
const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

/**
 * Verify file content matches claimed MIME type via magic bytes.
 * Prevents MIME type spoofing attacks.
 */
function verifyMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  if (buffer.length < 12) return false;

  // Map of magic byte signatures
  const signatures: Array<{ mime: string[]; bytes: number[]; offset?: number }> = [
    { mime: ['image/png'], bytes: [0x89, 0x50, 0x4e, 0x47] }, // PNG: \x89PNG
    { mime: ['image/jpeg', 'image/jpg'], bytes: [0xff, 0xd8, 0xff] }, // JPEG: \xFF\xD8\xFF
    { mime: ['image/gif'], bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF: GIF8
    { mime: ['image/x-icon', 'image/vnd.microsoft.icon'], bytes: [0x00, 0x00, 0x01, 0x00] }, // ICO
    { mime: ['video/mp4'], bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // MP4: ftyp at offset 4
    { mime: ['video/webm'], bytes: [0x1a, 0x45, 0xdf, 0xa3] }, // WebM: EBML header
  ];

  for (const sig of signatures) {
    if (sig.mime.includes(claimedMime)) {
      const offset = sig.offset || 0;
      if (buffer.length < offset + sig.bytes.length) return false;
      const matches = sig.bytes.every((b, i) => buffer[offset + i] === b);
      if (matches) return true;
    }
  }

  return false;
}

// Get Supabase admin client for storage operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    // Rate limit by admin - strict for uploads
    const rateLimitResult = await checkRequestRateLimit(
      `admin:upload:${auth.user.id}`,
      rateLimits.strict
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('type') as string; // e.g., 'main_logo', 'favicon', etc.

    if (!file) {
      return errors.badRequest('No file provided');
    }

    // Validate file type first
    const isVideo = VIDEO_TYPES.includes(file.type);
    const isImage = IMAGE_TYPES.includes(file.type);

    if (!isVideo && !isImage) {
      return errors.badRequest(
        'Invalid file type. Please upload PNG, JPEG, GIF, ICO, MP4, or WebM files.'
      );
    }

    // Validate file size - 5MB for images, 15MB for videos
    const maxSize = isVideo ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    const maxSizeLabel = isVideo ? '15MB' : '5MB';

    if (file.size > maxSize) {
      return errors.badRequest(`File size must be less than ${maxSizeLabel}`);
    }

    // Read file buffer once for all operations
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // SEC-004: Verify file content matches MIME type via magic bytes
    if (!verifyMagicBytes(buffer, file.type)) {
      log.warn('[Upload] Magic byte verification failed', {
        claimedMime: file.type,
        firstBytes: Array.from(buffer.slice(0, 12))
          .map((b) => b.toString(16))
          .join(' '),
      });
      return errors.badRequest(
        'File content does not match its type. Please upload a valid image or video file.'
      );
    }

    // Get Supabase admin client
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      // Fallback to base64 if Supabase not configured
      log.warn('[Upload] Supabase not configured, falling back to base64');
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;

      return successResponse({
        url: dataUrl,
        type: file.type,
        size: file.size,
        isVideo,
      });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'png');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${fileType || 'logo'}_${timestamp}_${randomStr}.${ext}`;

    // Upload to Supabase Storage 'branding' bucket
    const { error } = await supabase.storage.from('branding').upload(filename, buffer, {
      contentType: file.type,
      cacheControl: '31536000', // Cache for 1 year (immutable filename)
      upsert: false,
    });

    if (error) {
      log.error('[Upload] Supabase Storage error:', error instanceof Error ? error : { error });

      // If bucket doesn't exist, try to create it
      if (error.message.includes('Bucket not found') || error.message.includes('bucket')) {
        // Try creating the bucket
        const { error: bucketError } = await supabase.storage.createBucket('branding', {
          public: true,
          fileSizeLimit: 15 * 1024 * 1024, // 15MB
        });

        if (bucketError && !bucketError.message.includes('already exists')) {
          log.error('[Upload] Failed to create bucket:', bucketError);
          return errors.serverError();
        }

        // Retry upload
        const retryResult = await supabase.storage.from('branding').upload(filename, buffer, {
          contentType: file.type,
          cacheControl: '31536000',
          upsert: false,
        });

        if (retryResult.error) {
          log.error('[Upload] Retry failed:', retryResult.error);
          return errors.serverError();
        }
      } else {
        return errors.serverError();
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('branding').getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;

    log.info('[Upload] File uploaded successfully', { publicUrl });

    return successResponse({
      url: publicUrl,
      type: file.type,
      size: file.size,
      isVideo,
      storage: 'supabase', // Indicate this is a CDN URL
    });
  } catch (error) {
    log.error('Upload error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
