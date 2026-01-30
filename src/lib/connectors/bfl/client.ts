/**
 * BLACK FOREST LABS (BFL) API CLIENT
 *
 * Handles communication with the FLUX.2 API including:
 * - Request submission
 * - Status polling with exponential backoff
 * - Error handling and retries
 */

import { logger } from '@/lib/logger';
import {
  type FluxModel,
  type FluxGenerateRequest,
  type FluxEditRequest,
  type FluxSubmitResponse,
  type FluxPollResponse,
  type FluxGenerationResult,
  type PollingConfig,
  BFLError,
} from './types';
import { FLUX_MODELS, DEFAULT_MODEL, calculateCost } from './models';

const log = logger('BFLClient');

// =============================================================================
// CONFIGURATION
// =============================================================================

const BFL_API_BASE = 'https://api.bfl.ai';

const DEFAULT_POLLING_CONFIG: PollingConfig = {
  timeout: 120_000, // 2 minutes max
  initialInterval: 1_000, // Start polling at 1 second
  maxInterval: 5_000, // Max 5 seconds between polls
  backoffMultiplier: 1.5, // Increase delay by 50% each poll
};

// =============================================================================
// API KEY MANAGEMENT
// =============================================================================

function getApiKey(): string {
  const key = process.env.BLACK_FOREST_LABS_API_KEY;
  if (!key) {
    throw new BFLError(
      'BLACK_FOREST_LABS_API_KEY environment variable is not set',
      'API_KEY_MISSING'
    );
  }
  return key;
}

/**
 * Check if BFL API is configured
 */
export function isBFLConfigured(): boolean {
  return !!process.env.BLACK_FOREST_LABS_API_KEY;
}

// =============================================================================
// HTTP CLIENT
// =============================================================================

async function bflFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiKey = getApiKey();
  const url = endpoint.startsWith('http') ? endpoint : `${BFL_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-key': apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `BFL API error: ${response.status} ${response.statusText}`;
    let errorDetails: Record<string, unknown> | undefined;

    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
      }
      errorDetails = errorBody;
    } catch {
      // Ignore JSON parse errors
    }

    throw new BFLError(errorMessage, 'API_ERROR', response.status, errorDetails);
  }

  return response.json();
}

// =============================================================================
// GENERATION FUNCTIONS
// =============================================================================

/**
 * Submit a text-to-image generation request
 */
export async function submitGeneration(
  prompt: string,
  options: Partial<FluxGenerateRequest> = {},
  model: FluxModel = DEFAULT_MODEL
): Promise<FluxSubmitResponse> {
  const config = FLUX_MODELS[model];

  const request: FluxGenerateRequest = {
    prompt,
    width: options.width ?? config.defaults.width,
    height: options.height ?? config.defaults.height,
    guidance: options.guidance ?? config.defaults.guidance,
    steps: options.steps ?? config.defaults.steps,
    output_format: options.output_format ?? config.defaults.outputFormat,
    ...options,
  };

  log.info('Submitting generation request', {
    model,
    prompt: prompt.substring(0, 100),
    width: request.width,
    height: request.height,
  });

  const response = await bflFetch<FluxSubmitResponse>(config.endpoint, {
    method: 'POST',
    body: JSON.stringify(request),
  });

  log.info('Generation submitted', {
    id: response.id,
    status: response.status,
  });

  return response;
}

/**
 * Submit an image editing request with reference images
 */
export async function submitEdit(
  prompt: string,
  images: string[], // Base64-encoded images
  options: Partial<FluxEditRequest> = {},
  model: FluxModel = DEFAULT_MODEL
): Promise<FluxSubmitResponse> {
  const config = FLUX_MODELS[model];

  if (!config.capabilities.imageEditing) {
    throw new BFLError(
      `Model ${config.name} does not support image editing`,
      'CAPABILITY_NOT_SUPPORTED'
    );
  }

  if (images.length > config.capabilities.maxReferenceImages) {
    throw new BFLError(
      `Model ${config.name} supports maximum ${config.capabilities.maxReferenceImages} reference images`,
      'TOO_MANY_IMAGES'
    );
  }

  const request: FluxEditRequest = {
    prompt,
    images: images.length > 1 ? images : undefined,
    image: images.length === 1 ? images[0] : undefined,
    width: options.width ?? config.defaults.width,
    height: options.height ?? config.defaults.height,
    guidance: options.guidance ?? config.defaults.guidance,
    strength: options.strength ?? 0.8,
    ...options,
  };

  log.info('Submitting edit request', {
    model,
    prompt: prompt.substring(0, 100),
    imageCount: images.length,
  });

  // Edit endpoint is typically the same with different params
  const response = await bflFetch<FluxSubmitResponse>(config.endpoint, {
    method: 'POST',
    body: JSON.stringify(request),
  });

  log.info('Edit submitted', {
    id: response.id,
    status: response.status,
  });

  return response;
}

// =============================================================================
// POLLING
// =============================================================================

/**
 * Poll for generation status until complete or timeout
 */
export async function pollForResult(
  pollingUrl: string,
  config: Partial<PollingConfig> = {}
): Promise<FluxPollResponse> {
  const { timeout, initialInterval, maxInterval, backoffMultiplier } = {
    ...DEFAULT_POLLING_CONFIG,
    ...config,
  };

  const startTime = Date.now();
  let currentInterval = initialInterval;
  let pollCount = 0;

  while (Date.now() - startTime < timeout) {
    pollCount++;

    try {
      const response = await bflFetch<FluxPollResponse>(pollingUrl);

      log.debug('Poll response', {
        status: response.status,
        pollCount,
        elapsed: Date.now() - startTime,
      });

      // Check for terminal states
      if (response.status === 'Ready') {
        log.info('Generation complete', { pollCount });
        return response;
      }

      if (response.status === 'Error') {
        throw new BFLError(response.error || 'Generation failed', 'GENERATION_FAILED');
      }

      if (response.status === 'Request Moderated') {
        throw new BFLError('Request was moderated by content filter', 'REQUEST_MODERATED');
      }

      if (response.status === 'Content Moderated') {
        throw new BFLError('Generated content was moderated by safety filter', 'CONTENT_MODERATED');
      }

      if (response.status === 'Task not found') {
        throw new BFLError('Generation task not found', 'TASK_NOT_FOUND');
      }

      // Still pending, wait and poll again
      await sleep(currentInterval);
      currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval);
    } catch (error) {
      if (error instanceof BFLError) {
        throw error;
      }
      // Network error - retry with backoff
      log.warn('Poll request failed, retrying', { error });
      await sleep(currentInterval);
      currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval);
    }
  }

  throw new BFLError(`Generation timed out after ${timeout}ms`, 'TIMEOUT');
}

// =============================================================================
// HIGH-LEVEL API
// =============================================================================

/**
 * Generate an image and wait for result
 */
export async function generateImage(
  prompt: string,
  options: {
    model?: FluxModel;
    width?: number;
    height?: number;
    guidance?: number;
    steps?: number;
    seed?: number;
    outputFormat?: 'jpeg' | 'png' | 'webp';
    promptUpsampling?: boolean;
    pollingConfig?: Partial<PollingConfig>;
  } = {}
): Promise<FluxGenerationResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const modelConfig = FLUX_MODELS[model];

  // Submit the request
  const submission = await submitGeneration(
    prompt,
    {
      width: options.width,
      height: options.height,
      guidance: options.guidance,
      steps: options.steps,
      seed: options.seed,
      output_format: options.outputFormat,
      prompt_upsampling: options.promptUpsampling,
    },
    model
  );

  // Poll for result
  const result = await pollForResult(submission.polling_url, options.pollingConfig);

  if (!result.result?.sample) {
    throw new BFLError('Generation completed but no image URL returned', 'NO_IMAGE');
  }

  const width = options.width ?? modelConfig.defaults.width;
  const height = options.height ?? modelConfig.defaults.height;

  return {
    id: submission.id,
    status: 'Ready',
    imageUrl: result.result.sample,
    seed: result.result.seed,
    model,
    prompt,
    enhancedPrompt: result.result.prompt,
    dimensions: { width, height },
    cost: calculateCost(model, width, height),
    completedAt: new Date(),
  };
}

/**
 * Edit an image using reference images and wait for result
 */
export async function editImage(
  prompt: string,
  images: string[],
  options: {
    model?: FluxModel;
    width?: number;
    height?: number;
    guidance?: number;
    strength?: number;
    seed?: number;
    outputFormat?: 'jpeg' | 'png' | 'webp';
    pollingConfig?: Partial<PollingConfig>;
  } = {}
): Promise<FluxGenerationResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const modelConfig = FLUX_MODELS[model];

  // Submit the request
  const submission = await submitEdit(
    prompt,
    images,
    {
      width: options.width,
      height: options.height,
      guidance: options.guidance,
      strength: options.strength,
      seed: options.seed,
      output_format: options.outputFormat,
    },
    model
  );

  // Poll for result
  const result = await pollForResult(submission.polling_url, options.pollingConfig);

  if (!result.result?.sample) {
    throw new BFLError('Edit completed but no image URL returned', 'NO_IMAGE');
  }

  const width = options.width ?? modelConfig.defaults.width;
  const height = options.height ?? modelConfig.defaults.height;

  return {
    id: submission.id,
    status: 'Ready',
    imageUrl: result.result.sample,
    seed: result.result.seed,
    model,
    prompt,
    dimensions: { width, height },
    cost: calculateCost(model, width, height),
    completedAt: new Date(),
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert image file to base64
 */
export function imageToBase64(buffer: Buffer, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Extract base64 data from data URL
 */
export function extractBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}
