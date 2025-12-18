/**
 * IMAGE JOB STATUS API
 *
 * GET /api/image-jobs/[jobId] - Get job status and result
 * DELETE /api/image-jobs/[jobId] - Delete job (cleanup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getImageJob, deleteImageJob } from '@/lib/image-generation/jobs';

export const dynamic = 'force-dynamic';

/**
 * GET - Get image job status
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = await getImageJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found', status: 'not_found' },
        { status: 404 }
      );
    }

    // Return job status
    if (job.status === 'completed' && job.result) {
      // Build data URL for completed job
      const imageUrl = `data:${job.result.mimeType};base64,${job.result.imageData}`;

      return NextResponse.json({
        id: job.id,
        status: job.status,
        type: job.type,
        model: job.model,
        content: job.result.content,
        imageUrl,
        createdAt: job.createdAt,
        completedAt: job.updatedAt,
      });
    } else if (job.status === 'failed') {
      return NextResponse.json({
        id: job.id,
        status: job.status,
        type: job.type,
        error: job.error,
        createdAt: job.createdAt,
      });
    } else {
      // pending or processing
      return NextResponse.json({
        id: job.id,
        status: job.status,
        type: job.type,
        model: job.model,
        createdAt: job.createdAt,
      });
    }
  } catch (error) {
    console.error('[ImageJobs API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a job
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    await deleteImageJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ImageJobs API] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
