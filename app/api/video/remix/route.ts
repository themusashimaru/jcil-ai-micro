/**
 * VIDEO REMIX - EXTEND/CONTINUE A VIDEO
 *
 * POST /api/video/remix
 *
 * Creates a new video based on an existing completed video.
 * Great for extending scenes or making targeted adjustments
 * while maintaining continuity from the original.
 *
 * ADMIN ONLY for now (testing phase).
 *
 * Request body:
 * - video_id: string (required) - ID of the completed video to remix
 * - prompt: string (required) - Description of the continuation/change
 * - model: 'sora-2' | 'sora-2-pro' (optional, default: 'sora-2-pro')
 * - size: string (optional, default: '1280x720')
 * - seconds: number (optional, 1-20, default: 20)
 *
 * Response:
 * - job_id: string - Use this to poll status
 * - status: 'queued' | 'in_progress'
 * - remixed_from: string - The source video ID
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
    console.error('[Video Remix] Auth error:', error);
  }

  // ADMIN ONLY for now
  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        error: 'Video remix is currently available to administrators only.',
        code: 'admin_only',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body
  let body: {
    video_id?: string;
    prompt?: string;
    model?: VideoModel;
    size?: VideoSize;
    seconds?: number;
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
  if (!body.video_id || typeof body.video_id !== 'string' || body.video_id.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'video_id is required (ID of the video to remix)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate prompt
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'prompt is required (describe the continuation or change)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const videoId = body.video_id.trim();
  const prompt = body.prompt.trim();

  // Validate model (default to pro for audio support)
  const validModels: VideoModel[] = ['sora-2', 'sora-2-pro'];
  const model = body.model && validModels.includes(body.model) ? body.model : 'sora-2-pro';

  // Validate size
  const validSizes: VideoSize[] = ['1920x1080', '1080x1920', '1280x720', '720x1280', '1080x1080'];
  const size = body.size && validSizes.includes(body.size) ? body.size : '1280x720';

  // Validate seconds (default to max for video production)
  const seconds = typeof body.seconds === 'number'
    ? Math.max(1, Math.min(20, Math.floor(body.seconds)))
    : 20;

  // Audio defaults to true for sora-2-pro
  const audio = typeof body.audio === 'boolean' ? body.audio : (model === 'sora-2-pro');

  console.log(`[Video Remix] Admin ${userId} remixing ${videoId}: model=${model}, size=${size}, seconds=${seconds}, audio=${audio}`);

  // Create the remix job
  const result = await remixVideo({
    videoId,
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

  // Return the job info
  return new Response(
    JSON.stringify({
      job_id: result.job.id,
      status: result.job.status,
      progress: result.job.progress,
      model: result.job.model,
      size: result.job.size,
      seconds: result.job.seconds,
      created_at: result.job.createdAt,
      remixed_from: videoId,
    }),
    {
      status: 202, // Accepted - job is processing
      headers: {
        'Content-Type': 'application/json',
        'X-Video-Job-Id': result.job.id,
      },
    }
  );
}
