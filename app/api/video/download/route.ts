/**
 * VIDEO GENERATION - DOWNLOAD
 *
 * GET /api/video/download?job_id=xxx&variant=video|thumbnail|spritesheet
 *
 * Downloads a completed video or its assets.
 * ADMIN ONLY for now (testing phase).
 *
 * Query params:
 * - job_id: string (required) - The video job ID
 * - variant: 'video' | 'thumbnail' | 'spritesheet' (optional, default: 'video')
 *
 * Response:
 * - Binary video/image data with appropriate Content-Type
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getVideoStatus,
  downloadVideo,
  logVideoCompletion,
  isVideoGenerationAvailable,
} from '@/lib/openai/video';

export async function GET(request: NextRequest) {
  // Check if video generation is available
  if (!isVideoGenerationAvailable()) {
    return new Response(
      JSON.stringify({
        error: 'Video generation is not configured.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get params from query
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('job_id');
  const variant = searchParams.get('variant') as 'video' | 'thumbnail' | 'spritesheet' || 'video';

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'job_id query parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate variant
  const validVariants = ['video', 'thumbnail', 'spritesheet'];
  if (!validVariants.includes(variant)) {
    return new Response(
      JSON.stringify({ error: 'Invalid variant. Must be video, thumbnail, or spritesheet' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Authenticate user
  let userId: string | null = null;
  let isAdmin = false;

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
              // Ignore errors in server components
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      userId = user.id;

      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      isAdmin = userData?.is_admin === true;
    }
  } catch (error) {
    console.error('[Video Download] Auth error:', error);
  }

  // ADMIN ONLY for now
  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        error: 'Video generation is currently available to administrators only.',
        code: 'admin_only',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check video status first
  const job = await getVideoStatus(jobId);

  if (!job) {
    return new Response(
      JSON.stringify({
        error: 'Video job not found',
        code: 'not_found',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (job.status !== 'completed') {
    return new Response(
      JSON.stringify({
        error: `Video is not ready for download. Current status: ${job.status}`,
        code: 'not_ready',
        status: job.status,
        progress: job.progress,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Download the video
  const startTime = Date.now();
  const result = await downloadVideo(jobId, variant);

  if (!result) {
    return new Response(
      JSON.stringify({
        error: 'Failed to download video from OpenAI',
        code: 'download_failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Log successful download (only for main video, not thumbnails)
  if (variant === 'video' && userId) {
    logVideoCompletion(userId, job, Date.now() - startTime);
  }

  // Determine filename
  const extensions: Record<string, string> = {
    video: 'mp4',
    thumbnail: 'webp',
    spritesheet: 'jpg',
  };
  const filename = `video_${jobId.slice(-8)}.${extensions[variant]}`;

  // Return the binary data
  return new Response(result.data, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Content-Length': String(result.data.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Cache for 1 hour - videos don't change once generated
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
