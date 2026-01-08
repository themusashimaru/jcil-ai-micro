/**
 * ADMIN UPLOAD API
 * Handles file uploads for logos, favicons, and animated logos
 * Uploads to Supabase Storage for fast CDN delivery
 * Supports images (PNG, JPEG, ICO, GIF) and videos (MP4, WebM) for animated logos
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('AdminUpload');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valid file types for upload
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('type') as string; // e.g., 'main_logo', 'favicon', etc.

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type first
    const isVideo = VIDEO_TYPES.includes(file.type);
    const isImage = IMAGE_TYPES.includes(file.type);

    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, JPEG, GIF, ICO, MP4, or WebM files.' },
        { status: 400 }
      );
    }

    // Validate file size - 5MB for images, 15MB for videos
    const maxSize = isVideo ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    const maxSizeLabel = isVideo ? '15MB' : '5MB';

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size must be less than ${maxSizeLabel}` },
        { status: 400 }
      );
    }

    // Get Supabase admin client
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      // Fallback to base64 if Supabase not configured
      log.warn('[Upload] Supabase not configured, falling back to base64');
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;

      return NextResponse.json({
        success: true,
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

    // Convert file to buffer for upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage 'branding' bucket
    const { error } = await supabase.storage
      .from('branding')
      .upload(filename, buffer, {
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
          return NextResponse.json(
            { error: 'Storage not available. Please create "branding" bucket in Supabase.' },
            { status: 500 }
          );
        }

        // Retry upload
        const retryResult = await supabase.storage
          .from('branding')
          .upload(filename, buffer, {
            contentType: file.type,
            cacheControl: '31536000',
            upsert: false,
          });

        if (retryResult.error) {
          log.error('[Upload] Retry failed:', retryResult.error);
          return NextResponse.json(
            { error: 'Failed to upload file to storage' },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Failed to upload file to storage' },
          { status: 500 }
        );
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('branding')
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;

    log.info('[Upload] File uploaded successfully', { publicUrl });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      type: file.type,
      size: file.size,
      isVideo,
      storage: 'supabase', // Indicate this is a CDN URL
    });
  } catch (error) {
    log.error('Upload error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
