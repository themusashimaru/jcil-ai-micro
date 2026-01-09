/**
 * JOB STATUS API
 *
 * Get status of a specific queued job.
 * Used for polling job completion in async processing.
 */

import { NextResponse } from 'next/server';
import { getChatJob } from '@/lib/queue/bull-queue';
import { logger } from '@/lib/logger';

const log = logger('JobStatus');

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  }

  try {
    const job = await getChatJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found', jobId }, { status: 404 });
    }

    const state = await job.getState();
    const progress = job.progress as number | object;

    const response: {
      jobId: string;
      state: string;
      progress: number | object;
      result?: unknown;
      error?: string;
      createdAt?: number;
      processedAt?: number;
      finishedAt?: number;
    } = {
      jobId: job.id!,
      state,
      progress,
    };

    // Add timing information
    if (job.timestamp) {
      response.createdAt = job.timestamp;
    }
    if (job.processedOn) {
      response.processedAt = job.processedOn;
    }
    if (job.finishedOn) {
      response.finishedAt = job.finishedOn;
    }

    // Add result if completed
    if (state === 'completed') {
      response.result = job.returnvalue;
    }

    // Add error if failed
    if (state === 'failed') {
      response.error = job.failedReason;
    }

    return NextResponse.json(response);
  } catch (error) {
    log.error('Failed to get job status', error as Error, { jobId });
    return NextResponse.json(
      { error: 'Failed to get job status', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Cancel a job
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  }

  try {
    const job = await getChatJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found', jobId }, { status: 404 });
    }

    const state = await job.getState();

    // Can only cancel waiting or delayed jobs
    if (state !== 'waiting' && state !== 'delayed') {
      return NextResponse.json(
        { error: 'Cannot cancel job in current state', state },
        { status: 400 }
      );
    }

    await job.remove();

    log.info('Job cancelled', { jobId });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job cancelled',
    });
  } catch (error) {
    log.error('Failed to cancel job', error as Error, { jobId });
    return NextResponse.json(
      { error: 'Failed to cancel job', message: (error as Error).message },
      { status: 500 }
    );
  }
}
