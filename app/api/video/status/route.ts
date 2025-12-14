/**
 * VIDEO GENERATION - CHECK STATUS
 *
 * GET /api/video/status?job_id=xxx
 *
 * Checks the status of a video generation job.
 * ADMIN ONLY for now (testing phase).
 *
 * Query params:
 * - job_id: string (required) - The video job ID from /generate
 *
 * Response:
 * - job_id: string
 * - status: 'queued' | 'in_progress' | 'completed' | 'failed'
 * - progress: number (0-100)
 * - error?: { code: string, message: string } - If failed
 * - download_url?: string - If completed, the URL to download
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getVideoStatus, isVideoGenerationAvailable } from '@/lib/openai/video';

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

  // Get job_id from query params
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('job_id');

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'job_id query parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Authenticate user
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
      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      isAdmin = userData?.is_admin === true;
    }
  } catch (error) {
    console.error('[Video Status] Auth error:', error);
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

  // Get the video status
  const job = await getVideoStatus(jobId);

  if (!job) {
    return new Response(
      JSON.stringify({
        error: 'Video job not found or status check failed',
        code: 'not_found',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build response
  const response: Record<string, unknown> = {
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    model: job.model,
    size: job.size,
    seconds: job.seconds,
    created_at: job.createdAt,
  };

  // Add error info if failed
  if (job.status === 'failed' && job.error) {
    response.error = {
      code: job.error.code,
      message: job.error.message,
    };
  }

  // Add download URL if completed
  if (job.status === 'completed') {
    response.download_url = `/api/video/download?job_id=${job.id}`;
    response.thumbnail_url = `/api/video/download?job_id=${job.id}&variant=thumbnail`;
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Cache for 5 seconds during polling to reduce load
      'Cache-Control': job.status === 'completed' || job.status === 'failed'
        ? 'private, max-age=60'
        : 'private, max-age=5',
    },
  });
}
