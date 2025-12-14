/**
 * VIDEO CONTINUE - CHAIN NEXT SEGMENT
 *
 * POST /api/video/continue
 *
 * Continues a multi-segment video by starting the next segment.
 * Uses remix to maintain continuity from the previous segment.
 * Called by frontend after previous segment completes.
 *
 * ADMIN ONLY for now (testing phase).
 *
 * Request body:
 * - video_id: string (required) - ID of the completed previous segment
 * - prompt: string (required) - Original prompt (for continuation)
 * - segment: { current: N, total: M, seconds_remaining: X } - from previous response
 * - model, size, audio: (optional) - inherit from previous segment
 *
 * Response:
 * - job_id: string - New segment's job ID
 * - status: 'queued' | 'in_progress'
 * - segment: { current: N+1, total: M, seconds_remaining: X-20 }
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  remixVideo,
  VideoModel,
  VideoSize,
  isVideoGenerationAvailable,
} from '@/lib/openai/video';

const MAX_SEGMENT_SECONDS = 20;

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
    console.error('[Video Continue] Auth error:', error);
  }

  // ADMIN ONLY for now
  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        error: 'Video continuation is currently available to administrators only.',
        code: 'admin_only',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body
  let body: {
    video_id?: string;
    prompt?: string;
    segment?: {
      current: number;
      total: number;
      total_seconds: number;
      seconds_remaining: number;
    };
    model?: VideoModel;
    size?: VideoSize;
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

  // Validate video_id
  if (!body.video_id || typeof body.video_id !== 'string') {
    return new Response(
      JSON.stringify({ error: 'video_id is required (ID of the completed previous segment)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate prompt
  if (!body.prompt || typeof body.prompt !== 'string') {
    return new Response(
      JSON.stringify({ error: 'prompt is required (original video prompt)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate segment info
  if (!body.segment || typeof body.segment.current !== 'number' || typeof body.segment.total !== 'number') {
    return new Response(
      JSON.stringify({ error: 'segment info is required ({ current, total, seconds_remaining })' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { video_id, prompt, segment } = body;
  const nextSegment = segment.current + 1;

  // Check if we actually need more segments
  if (nextSegment > segment.total) {
    return new Response(
      JSON.stringify({
        error: 'All segments complete',
        code: 'complete',
        message: 'Video generation is complete, no more segments needed.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Calculate this segment's duration
  const secondsRemaining = segment.seconds_remaining;
  const thisSegmentSeconds = Math.min(MAX_SEGMENT_SECONDS, secondsRemaining);
  const newSecondsRemaining = secondsRemaining - thisSegmentSeconds;

  // Validate model
  const validModels: VideoModel[] = ['sora-2', 'sora-2-pro'];
  const model = body.model && validModels.includes(body.model) ? body.model : 'sora-2-pro';

  // Validate size
  const validSizes: VideoSize[] = ['1920x1080', '1080x1920', '1280x720', '720x1280', '1080x1080'];
  const size = body.size && validSizes.includes(body.size) ? body.size : '1280x720';

  // Audio defaults to true for sora-2-pro
  const audio = typeof body.audio === 'boolean' ? body.audio : (model === 'sora-2-pro');

  console.log(`[Video Continue] Admin ${userId} continuing segment ${nextSegment}/${segment.total}: video_id=${video_id}, seconds=${thisSegmentSeconds}`);

  // Create continuation prompt that maintains scene flow
  const continuationPrompt = `Continue the scene seamlessly: ${prompt}`;

  // Use remix to continue from the previous segment
  const result = await remixVideo({
    videoId: video_id,
    prompt: continuationPrompt,
    model,
    size,
    seconds: thisSegmentSeconds,
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

  // Build response with updated segment info
  const responseData: Record<string, unknown> = {
    job_id: result.job.id,
    status: result.job.status,
    progress: result.job.progress,
    model: result.job.model,
    size: result.job.size,
    seconds: result.job.seconds,
    created_at: result.job.createdAt,
    previous_video_id: video_id,
    prompt, // Pass through for next continuation
    segment: {
      current: nextSegment,
      total: segment.total,
      total_seconds: segment.total_seconds,
      seconds_remaining: newSecondsRemaining,
    },
  };

  return new Response(
    JSON.stringify(responseData),
    {
      status: 202,
      headers: {
        'Content-Type': 'application/json',
        'X-Video-Job-Id': result.job.id,
      },
    }
  );
}
