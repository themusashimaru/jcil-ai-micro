/**
 * JOB STREAM API
 *
 * Server-Sent Events endpoint for real-time job updates.
 * Clients can subscribe to job progress and completion.
 */

import { getChatJob, getChatQueueEvents } from '@/lib/queue/bull-queue';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

const log = logger('JobStream');

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  // SECURITY FIX: Require authentication to prevent unauthorized stream access
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { jobId } = await params;

  if (!jobId) {
    return new Response('Job ID required', { status: 400 });
  }

  // Check if job exists
  const job = await getChatJob(jobId);
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  // SECURITY FIX: Verify the authenticated user owns this job
  if (job.data.userId !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  // Get queue events
  const queueEvents = getChatQueueEvents();
  if (!queueEvents) {
    return new Response('Queue events not available', { status: 503 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial status
      const initialState = await job.getState();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'state', state: initialState, progress: job.progress })}\n\n`
        )
      );

      // If already completed or failed, close stream
      if (initialState === 'completed' || initialState === 'failed') {
        const result =
          initialState === 'completed'
            ? { type: 'completed', result: job.returnvalue }
            : { type: 'failed', error: job.failedReason };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
        controller.close();
        return;
      }

      // Set up event listeners
      const progressHandler = ({ jobId: eventJobId, data }: { jobId: string; data: unknown }) => {
        if (eventJobId === jobId) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'progress', progress: data })}\n\n`)
            );
          } catch {
            // Controller might be closed
          }
        }
      };

      const completedHandler = ({
        jobId: eventJobId,
        returnvalue,
      }: {
        jobId: string;
        returnvalue: unknown;
      }) => {
        if (eventJobId === jobId) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'completed', result: returnvalue })}\n\n`
              )
            );
            cleanup();
            controller.close();
          } catch {
            // Controller might be closed
          }
        }
      };

      const failedHandler = ({
        jobId: eventJobId,
        failedReason,
      }: {
        jobId: string;
        failedReason: string;
      }) => {
        if (eventJobId === jobId) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'failed', error: failedReason })}\n\n`)
            );
            cleanup();
            controller.close();
          } catch {
            // Controller might be closed
          }
        }
      };

      const cleanup = () => {
        queueEvents.off('progress', progressHandler);
        queueEvents.off('completed', completedHandler);
        queueEvents.off('failed', failedHandler);
      };

      // Register event listeners (using type assertion for BullMQ event handlers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queueEvents.on('progress', progressHandler as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queueEvents.on('completed', completedHandler as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queueEvents.on('failed', failedHandler as any);

      // Send keepalive every 30 seconds
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepaliveInterval);
          cleanup();
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval);
        cleanup();
        log.debug('Client disconnected from job stream', { jobId });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'timeout' })}\n\n`));
          clearInterval(keepaliveInterval);
          cleanup();
          controller.close();
        } catch {
          // Already closed
        }
      }, 300000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
