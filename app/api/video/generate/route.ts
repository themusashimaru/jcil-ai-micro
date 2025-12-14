/**
 * VIDEO GENERATION - START JOB
 *
 * POST /api/video/generate
 *
 * Starts a new Sora video generation job.
 * ADMIN ONLY for now (testing phase).
 *
 * Supports multi-segment videos for durations > 20 seconds.
 * Frontend handles chaining via polling to avoid Vercel timeouts.
 *
 * Request body:
 * - prompt: string (required) - Description of the video
 * - model: 'sora-2' | 'sora-2-pro' (optional, default: 'sora-2-pro')
 * - size: string (optional, default: '1280x720')
 * - seconds: number (optional, default: 20, max per segment: 20)
 * - total_seconds: number (optional) - Total video duration, triggers multi-segment
 *
 * Response:
 * - job_id: string - Use this to poll status
 * - status: 'queued' | 'in_progress'
 * - progress: number (0-100)
 * - model, size, seconds: this segment's settings
 * - segment: { current: 1, total: N, seconds_remaining: X } - for multi-segment videos
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  createVideoJob,
  VideoModel,
  VideoSize,
  isVideoGenerationAvailable,
} from '@/lib/openai/video';

export async function POST(request: NextRequest) {
  // Check if video generation is available
  if (!isVideoGenerationAvailable()) {
    return new Response(
      JSON.stringify({
        error: 'Video generation is not configured. OPENAI_API_KEY is required.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
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
    console.error('[Video Generate] Auth error:', error);
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

  // Parse request body
  let body: {
    prompt?: string;
    model?: VideoModel;
    size?: VideoSize;
    seconds?: number;
    total_seconds?: number; // For multi-segment videos > 20s
    audio?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate prompt
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Prompt is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prompt = body.prompt.trim();

  // Validate model (default to pro for audio support)
  const validModels: VideoModel[] = ['sora-2', 'sora-2-pro'];
  const model = body.model && validModels.includes(body.model) ? body.model : 'sora-2-pro';

  // Validate size
  const validSizes: VideoSize[] = ['1920x1080', '1080x1920', '1280x720', '720x1280', '1080x1080'];
  const size = body.size && validSizes.includes(body.size) ? body.size : '1280x720';

  // Handle multi-segment videos
  // API only accepts 4, 8, or 12 seconds per segment
  const MAX_SEGMENT_SECONDS = 12;
  const totalSeconds = typeof body.total_seconds === 'number' && body.total_seconds > 0
    ? Math.floor(body.total_seconds)
    : null;

  // Calculate segment info
  const totalSegments = totalSeconds ? Math.ceil(totalSeconds / MAX_SEGMENT_SECONDS) : 1;
  const isMultiSegment = totalSegments > 1;

  // Snap to valid API values (4, 8, or 12)
  const snapToValidSeconds = (s: number): number => {
    if (s <= 4) return 4;
    if (s <= 8) return 8;
    return 12;
  };

  // First segment seconds (or single video seconds)
  const seconds = isMultiSegment
    ? MAX_SEGMENT_SECONDS // First segment is always max (12s)
    : typeof body.seconds === 'number'
      ? snapToValidSeconds(body.seconds)
      : MAX_SEGMENT_SECONDS;

  // Audio defaults to true for sora-2-pro
  const audio = typeof body.audio === 'boolean' ? body.audio : (model === 'sora-2-pro');

  console.log(`[Video Generate] Admin ${userId} starting video: model=${model}, size=${size}, seconds=${seconds}, audio=${audio}${isMultiSegment ? `, total=${totalSeconds}s (${totalSegments} segments)` : ''}`);

  // Create the video job
  const result = await createVideoJob({
    prompt,
    model,
    size,
    seconds,
    audio,
    userId: userId || undefined,
  });

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: result.error,
        code: result.code,
        retryable: result.retryable,
      }),
      {
        status: result.code === 'content_policy_violation' ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Build response with segment info for multi-segment videos
  const responseData: Record<string, unknown> = {
    job_id: result.job.id,
    status: result.job.status,
    progress: result.job.progress,
    model: result.job.model,
    size: result.job.size,
    seconds: result.job.seconds,
    created_at: result.job.createdAt,
    prompt, // Include prompt for continuation
  };

  // Add segment info for multi-segment videos
  if (isMultiSegment && totalSeconds) {
    responseData.segment = {
      current: 1,
      total: totalSegments,
      total_seconds: totalSeconds,
      seconds_remaining: totalSeconds - seconds,
    };
  }

  // Return the job info
  return new Response(
    JSON.stringify(responseData),
    {
      status: 202, // Accepted - job is processing
      headers: {
        'Content-Type': 'application/json',
        'X-Video-Job-Id': result.job.id,
      },
    }
  );
}
