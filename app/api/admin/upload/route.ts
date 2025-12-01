/**
 * ADMIN UPLOAD API
 * Handles file uploads for logos, favicons, and animated logos using base64 encoding
 * Supports images (PNG, JPEG, ICO, GIF) and videos (MP4, WebM) for animated logos
 * (Vercel-compatible - no filesystem writes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valid file types for upload
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file') as File;

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

    // Convert file to base64 data URL
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
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
