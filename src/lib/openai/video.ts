/**
 * Video Generation with Sora API
 *
 * Implements:
 * - Sora 2 / Sora 2 Pro video generation
 * - Async job management (create, poll, download)
 * - Progress tracking
 * - Error handling with detailed messages
 * - Structured logging for billing
 *
 * IMPORTANT: Video generation is async and takes several minutes.
 * Use the polling pattern to check status.
 */

import { logVideoGeneration } from '../log';

// ========================================
// TYPES
// ========================================

export type VideoModel = 'sora-2' | 'sora-2-pro';

export type VideoSize =
  | '1920x1080'  // 16:9 HD
  | '1080x1920'  // 9:16 Vertical
  | '1280x720'   // 16:9 720p
  | '720x1280'   // 9:16 Vertical 720p
  | '1080x1080'; // 1:1 Square

export type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export interface VideoJobRequest {
  prompt: string;
  model?: VideoModel;
  size?: VideoSize;
  seconds?: number; // 1-20 seconds
  audio?: boolean;  // Enable audio generation (sora-2-pro only)
  userId?: string;
}

export interface VideoRemixRequest {
  videoId: string;      // ID of the completed video to remix/extend
  prompt: string;       // New prompt describing the change or continuation
  model?: VideoModel;
  size?: VideoSize;
  seconds?: number;
  audio?: boolean;
  userId?: string;
}

export interface VideoJob {
  id: string;
  status: VideoStatus;
  progress: number; // 0-100
  model: VideoModel;
  size: VideoSize;
  seconds: number;
  createdAt: number;
  remixedFromVideoId?: string; // If this is a remix, the source video ID
  error?: {
    code: string;
    message: string;
  };
}

export interface VideoGenerationResult {
  ok: true;
  job: VideoJob;
}

export interface VideoGenerationError {
  ok: false;
  error: string;
  code: string;
  retryable: boolean;
}

export type CreateVideoResult = VideoGenerationResult | VideoGenerationError;

// ========================================
// CONSTANTS
// ========================================

const RETRY_DELAYS = [500, 1000, 2000];
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const API_TIMEOUT_MS = 30_000; // 30 seconds for API calls (not video generation)

// Estimated costs per second of video (unofficial estimates)
const VIDEO_COSTS_PER_SECOND: Record<VideoModel, number> = {
  'sora-2': 0.05,      // ~$0.05/sec for fast model
  'sora-2-pro': 0.10,  // ~$0.10/sec for pro model
};

// Default settings
const DEFAULT_MODEL: VideoModel = 'sora-2-pro'; // Pro model supports audio
const DEFAULT_SIZE: VideoSize = '1280x720';
// API only accepts 4, 8, or 12 seconds
const DEFAULT_SECONDS = 12; // Max available duration
const DEFAULT_AUDIO = true; // Enable audio by default for pro model

/**
 * Snap seconds to nearest valid API value (4, 8, or 12)
 */
function snapToValidSeconds(seconds: number): number {
  if (seconds <= 4) return 4;
  if (seconds <= 8) return 8;
  return 12;
}

// ========================================
// UTILITIES
// ========================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return apiKey;
}

function getBaseURL(): string {
  return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
}

/**
 * Make an API request with timeout and retries
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit,
  retries = true
): Promise<Response> {
  const apiKey = getOpenAIApiKey();
  const baseURL = getBaseURL();
  const url = `${baseURL}${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const requestOptions: RequestInit = {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: controller.signal,
  };

  let lastError: Error | null = null;
  const maxAttempts = retries ? RETRY_DELAYS.length + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeout);

      if (!response.ok && RETRYABLE_STATUS_CODES.includes(response.status) && attempt < RETRY_DELAYS.length) {
        console.log(`[Sora] Retrying in ${RETRY_DELAYS[attempt]}ms... (status: ${response.status})`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }

      if (attempt < RETRY_DELAYS.length && retries) {
        console.log(`[Sora] Retrying in ${RETRY_DELAYS[attempt]}ms... (error: ${lastError.message})`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed');
}

/**
 * Parse API error response
 */
async function parseErrorResponse(response: Response): Promise<{ code: string; message: string }> {
  try {
    const data = await response.json();
    return {
      code: data.error?.code || `http_${response.status}`,
      message: data.error?.message || `Request failed with status ${response.status}`,
    };
  } catch {
    return {
      code: `http_${response.status}`,
      message: `Request failed with status ${response.status}`,
    };
  }
}

// ========================================
// CONTENT VALIDATION
// ========================================

/**
 * Check if a prompt might violate Sora's content restrictions
 * Returns warning message if issues detected, null if OK
 */
export function validateVideoPrompt(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();

  // Real people / public figures
  const realPeoplePatterns = [
    /\b(trump|biden|obama|elon musk|taylor swift|celebrity|president|politician)\b/i,
    /\b(famous|real|actual)\s+(person|people|celebrity|actor|singer)\b/i,
  ];
  if (realPeoplePatterns.some(p => p.test(lowerPrompt))) {
    return 'Sora cannot generate videos of real people or public figures.';
  }

  // Copyrighted characters
  const copyrightPatterns = [
    /\b(mickey mouse|donald duck|mario|luigi|pokemon|pikachu|harry potter|spiderman|batman|superman)\b/i,
    /\b(disney|marvel|dc comics|nintendo|pixar)\s+(character|movie|film)\b/i,
  ];
  if (copyrightPatterns.some(p => p.test(lowerPrompt))) {
    return 'Sora cannot generate copyrighted characters. Try describing an original character instead.';
  }

  // Explicit content
  const explicitPatterns = [
    /\b(nude|naked|sexual|explicit|porn|nsfw)\b/i,
    /\b(violence|gore|blood|kill|murder|death)\b/i,
  ];
  if (explicitPatterns.some(p => p.test(lowerPrompt))) {
    return 'This content may violate Sora\'s content policy. Please use family-friendly descriptions.';
  }

  return null;
}

/**
 * Detect if a message is requesting video generation
 */
export function detectVideoRequest(content: string): boolean {
  const lowerContent = content.toLowerCase();

  const videoPatterns = [
    /\b(create|make|generate|produce|render)\b.*\b(video|clip|footage|animation|movie)\b/i,
    /\b(video|clip|footage|animation)\b.*\b(of|for|showing|depicting|about)\b/i,
    /\bsora\b/i, // Direct mention of Sora
    /\b(animate|animat(e|ing|ion))\b.*\b(scene|shot|sequence)\b/i,
    /\b(cinematic|film|movie)\b.*\b(shot|scene|clip)\b/i,
  ];

  return videoPatterns.some(pattern => pattern.test(lowerContent));
}

// ========================================
// VIDEO GENERATION API
// ========================================

/**
 * Start a new video generation job
 * Returns immediately with job ID - use pollVideoStatus to check progress
 */
export async function createVideoJob(request: VideoJobRequest): Promise<CreateVideoResult> {
  const {
    prompt,
    model = DEFAULT_MODEL,
    size = DEFAULT_SIZE,
    seconds = DEFAULT_SECONDS,
    audio = model === 'sora-2-pro' ? DEFAULT_AUDIO : false, // Audio only for pro model
    userId,
  } = request;

  // Validate prompt
  const validationError = validateVideoPrompt(prompt);
  if (validationError) {
    return {
      ok: false,
      error: validationError,
      code: 'content_policy_violation',
      retryable: false,
    };
  }

  // Validate seconds - API only accepts 4, 8, or 12
  const clampedSeconds = snapToValidSeconds(seconds);

  console.log(`[Sora] Starting video generation: model=${model}, size=${size}, seconds=${clampedSeconds}, audio=${audio}`);
  console.log(`[Sora] Prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

  const startTime = Date.now();

  try {
    // Build request body
    // Note: sora-2-pro includes audio automatically, no parameter needed
    // IMPORTANT: Sora API expects seconds as a STRING ('4', '8', '12'), not a number
    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      size,
      seconds: String(clampedSeconds),
    };

    const response = await apiRequest('/videos', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      console.error(`[Sora] Create job failed: ${error.code} - ${error.message}`);

      // Log failed attempt
      logVideoGeneration(
        userId || 'anonymous',
        model,
        size,
        clampedSeconds,
        0,
        false,
        Date.now() - startTime
      );

      return {
        ok: false,
        error: error.message,
        code: error.code,
        retryable: RETRYABLE_STATUS_CODES.includes(response.status),
      };
    }

    const data = await response.json();
    console.log(`[Sora] Job created: ${data.id}, status: ${data.status}`);

    const job: VideoJob = {
      id: data.id,
      status: data.status || 'queued',
      progress: data.progress || 0,
      model,
      size,
      seconds: clampedSeconds,
      createdAt: data.created_at || Math.floor(Date.now() / 1000),
    };

    return {
      ok: true,
      job,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Sora] Create job error: ${errorMessage}`);

    // Log failed attempt
    logVideoGeneration(
      userId || 'anonymous',
      model,
      size,
      clampedSeconds,
      0,
      false,
      Date.now() - startTime
    );

    return {
      ok: false,
      error: errorMessage,
      code: 'request_failed',
      retryable: true,
    };
  }
}

/**
 * Get the current status of a video job
 */
export async function getVideoStatus(videoId: string): Promise<VideoJob | null> {
  console.log(`[Sora] Checking status for: ${videoId}`);

  try {
    const response = await apiRequest(`/videos/${videoId}`, {
      method: 'GET',
    }, false); // No retries for status checks

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      console.error(`[Sora] Status check failed: ${error.code} - ${error.message}`);
      return null;
    }

    const data = await response.json();

    const job: VideoJob = {
      id: data.id,
      status: data.status,
      progress: data.progress || 0,
      model: data.model,
      size: data.size,
      seconds: parseInt(data.seconds, 10) || 5,
      createdAt: data.created_at,
    };

    if (data.error) {
      job.error = {
        code: data.error.code || 'unknown',
        message: data.error.message || 'Video generation failed',
      };
    }

    console.log(`[Sora] Status: ${job.status}, progress: ${job.progress}%`);

    return job;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Sora] Status check error: ${errorMessage}`);
    return null;
  }
}

/**
 * Download a completed video
 * Returns the video as an ArrayBuffer
 */
export async function downloadVideo(
  videoId: string,
  variant: 'video' | 'thumbnail' | 'spritesheet' = 'video'
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  console.log(`[Sora] Downloading ${variant} for: ${videoId}`);

  try {
    const apiKey = getOpenAIApiKey();
    const baseURL = getBaseURL();
    const url = `${baseURL}/videos/${videoId}/content${variant !== 'video' ? `?variant=${variant}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      console.error(`[Sora] Download failed: ${error.code} - ${error.message}`);
      return null;
    }

    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'video/mp4';

    console.log(`[Sora] Downloaded ${variant}: ${data.byteLength} bytes`);

    return { data, contentType };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Sora] Download error: ${errorMessage}`);
    return null;
  }
}

/**
 * Log successful video completion (call this when job completes)
 */
export function logVideoCompletion(
  userId: string,
  job: VideoJob,
  latencyMs: number
): void {
  const estimatedCost = VIDEO_COSTS_PER_SECOND[job.model] * job.seconds;

  logVideoGeneration(
    userId,
    job.model,
    job.size,
    job.seconds,
    estimatedCost,
    true,
    latencyMs
  );
}

/**
 * Check if video generation is available (API key configured)
 */
export function isVideoGenerationAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get estimated cost for a video
 */
export function estimateVideoCost(model: VideoModel, seconds: number): number {
  return VIDEO_COSTS_PER_SECOND[model] * seconds;
}

/**
 * Remix/extend an existing video
 * Creates a new video based on a completed video with a new prompt
 * Great for:
 * - Extending scenes (continue the action)
 * - Making targeted adjustments while keeping continuity
 * - Creating variations of a successful generation
 */
export async function remixVideo(request: VideoRemixRequest): Promise<CreateVideoResult> {
  const {
    videoId,
    prompt,
    model = DEFAULT_MODEL,
    size = DEFAULT_SIZE,
    seconds = DEFAULT_SECONDS,
    audio = model === 'sora-2-pro' ? DEFAULT_AUDIO : false,
    userId,
  } = request;

  // Validate prompt
  const validationError = validateVideoPrompt(prompt);
  if (validationError) {
    return {
      ok: false,
      error: validationError,
      code: 'content_policy_violation',
      retryable: false,
    };
  }

  // Validate seconds - API only accepts 4, 8, or 12
  const clampedSeconds = snapToValidSeconds(seconds);

  console.log(`[Sora] Starting remix of ${videoId}: model=${model}, size=${size}, seconds=${clampedSeconds}, audio=${audio}`);
  console.log(`[Sora] Remix prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

  const startTime = Date.now();

  try {
    // Build request body for remix
    // Note: sora-2-pro includes audio automatically, no parameter needed
    // IMPORTANT: Sora API expects seconds as a STRING ('4', '8', '12'), not a number
    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      size,
      seconds: String(clampedSeconds),
    };

    // Remix endpoint uses the video ID in the URL
    const response = await apiRequest(`/videos/${videoId}/remix`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      console.error(`[Sora] Remix failed: ${error.code} - ${error.message}`);

      logVideoGeneration(
        userId || 'anonymous',
        model,
        size,
        clampedSeconds,
        0,
        false,
        Date.now() - startTime
      );

      return {
        ok: false,
        error: error.message,
        code: error.code,
        retryable: RETRYABLE_STATUS_CODES.includes(response.status),
      };
    }

    const data = await response.json();
    console.log(`[Sora] Remix job created: ${data.id}, status: ${data.status}`);

    const job: VideoJob = {
      id: data.id,
      status: data.status || 'queued',
      progress: data.progress || 0,
      model,
      size,
      seconds: clampedSeconds,
      createdAt: data.created_at || Math.floor(Date.now() / 1000),
      remixedFromVideoId: videoId,
    };

    return {
      ok: true,
      job,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Sora] Remix error: ${errorMessage}`);

    logVideoGeneration(
      userId || 'anonymous',
      model,
      size,
      clampedSeconds,
      0,
      false,
      Date.now() - startTime
    );

    return {
      ok: false,
      error: errorMessage,
      code: 'request_failed',
      retryable: true,
    };
  }
}
