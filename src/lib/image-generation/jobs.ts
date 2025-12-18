/**
 * IMAGE GENERATION JOB QUEUE
 *
 * PURPOSE:
 * - Store and track image generation jobs in Supabase
 * - Support async image generation with polling
 * - Works with serverless environments (persistent storage)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// Lazy-init Supabase client with service role (bypasses RLS)
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.log('[ImageJobs] Supabase not configured');
    return null;
  }

  supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
  return supabaseAdmin;
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a new image generation job
 */
export async function createImageJob(options: {
  prompt: string;
  type: 'image' | 'slide';
  model: string;
  userId: string;
}): Promise<ImageJob> {
  const supabase = getSupabaseAdmin();
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

  if (!supabase) {
    console.error('[ImageJobs] Supabase not configured, job will not persist');
    return job;
  }

  const { error } = await supabase.from('image_jobs').insert({
    id: job.id,
    user_id: options.userId,
    prompt: options.prompt,
    type: options.type,
    model: options.model,
    status: 'pending',
  });

  if (error) {
    console.error('[ImageJobs] Failed to create job:', error);
    throw new Error('Failed to create image job');
  }

  console.log(`[ImageJobs] Created job ${id} for ${options.type}`);
  return job;
}

/**
 * Get a job by ID
 */
export async function getImageJob(id: string): Promise<ImageJob | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('image_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  // Convert database row to ImageJob
  const job: ImageJob = {
    id: data.id,
    status: data.status as ImageJob['status'],
    prompt: data.prompt,
    type: data.type as 'image' | 'slide',
    model: data.model,
    userId: data.user_id,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };

  if (data.result_image_data && data.result_mime_type) {
    job.result = {
      imageData: data.result_image_data,
      mimeType: data.result_mime_type,
      content: data.result_content || '',
    };
  }

  if (data.error_message) {
    job.error = data.error_message;
  }

  return job;
}

/**
 * Update job status to processing
 */
export async function markJobProcessing(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase
    .from('image_jobs')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[ImageJobs] Failed to mark job processing:', error);
  }
}

/**
 * Mark job as completed with result
 */
export async function completeImageJob(id: string, result: {
  imageData: string;
  mimeType: string;
  content: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase
    .from('image_jobs')
    .update({
      status: 'completed',
      result_image_data: result.imageData,
      result_mime_type: result.mimeType,
      result_content: result.content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[ImageJobs] Failed to complete job:', error);
  } else {
    console.log(`[ImageJobs] Job ${id} completed`);
  }
}

/**
 * Mark job as failed with error
 */
export async function failImageJob(id: string, errorMsg: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error: dbError } = await supabase
    .from('image_jobs')
    .update({
      status: 'failed',
      error_message: errorMsg,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (dbError) {
    console.error('[ImageJobs] Failed to mark job as failed:', dbError);
  } else {
    console.log(`[ImageJobs] Job ${id} failed: ${errorMsg}`);
  }
}

/**
 * Delete a job
 */
export async function deleteImageJob(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase
    .from('image_jobs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[ImageJobs] Failed to delete job:', error);
  }
}

/**
 * Get job count (for debugging)
 */
export async function getJobCount(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('image_jobs')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[ImageJobs] Failed to get job count:', error);
    return 0;
  }

  return count || 0;
}
