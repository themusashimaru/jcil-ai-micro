/**
 * IMAGE GENERATION JOB QUEUE
 *
 * PURPOSE:
 * - Store and track image generation jobs
 * - Support async image generation with polling
 * - Clean up old jobs automatically
 */

export interface ImageJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  type: 'image' | 'slide';
  model: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  result?: {
    imageData: string;  // Base64 encoded
    mimeType: string;
    content: string;    // Response text
  };
  error?: string;
}

// In-memory storage for jobs (can be replaced with Redis later)
const jobs = new Map<string, ImageJob>();

// Job TTL - 10 minutes
const JOB_TTL_MS = 10 * 60 * 1000;

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a new image generation job
 */
export function createImageJob(options: {
  prompt: string;
  type: 'image' | 'slide';
  model: string;
  userId: string;
}): ImageJob {
  const id = generateJobId();
  const now = Date.now();

  const job: ImageJob = {
    id,
    status: 'pending',
    prompt: options.prompt,
    type: options.type,
    model: options.model,
    userId: options.userId,
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(id, job);
  console.log(`[ImageJobs] Created job ${id} for ${options.type}`);

  // Schedule cleanup of old jobs
  cleanupOldJobs();

  return job;
}

/**
 * Get a job by ID
 */
export function getImageJob(id: string): ImageJob | null {
  return jobs.get(id) || null;
}

/**
 * Update job status to processing
 */
export function markJobProcessing(id: string): void {
  const job = jobs.get(id);
  if (job) {
    job.status = 'processing';
    job.updatedAt = Date.now();
  }
}

/**
 * Mark job as completed with result
 */
export function completeImageJob(id: string, result: {
  imageData: string;
  mimeType: string;
  content: string;
}): void {
  const job = jobs.get(id);
  if (job) {
    job.status = 'completed';
    job.result = result;
    job.updatedAt = Date.now();
    console.log(`[ImageJobs] Job ${id} completed`);
  }
}

/**
 * Mark job as failed with error
 */
export function failImageJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (job) {
    job.status = 'failed';
    job.error = error;
    job.updatedAt = Date.now();
    console.log(`[ImageJobs] Job ${id} failed: ${error}`);
  }
}

/**
 * Delete a job
 */
export function deleteImageJob(id: string): void {
  jobs.delete(id);
}

/**
 * Clean up old jobs (older than TTL)
 */
function cleanupOldJobs(): void {
  const now = Date.now();
  const cutoff = now - JOB_TTL_MS;

  let cleaned = 0;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[ImageJobs] Cleaned up ${cleaned} old jobs`);
  }
}

/**
 * Get job count (for debugging)
 */
export function getJobCount(): number {
  return jobs.size;
}
