/**
 * BLACK FOREST LABS (BFL) FLUX API TYPES
 *
 * TypeScript interfaces for the FLUX.2 image generation API.
 * Supports text-to-image, image editing, and multi-reference generation.
 */

// =============================================================================
// API REQUEST TYPES
// =============================================================================

/**
 * Available FLUX.2 models
 */
export type FluxModel =
  | 'flux-2-pro'
  | 'flux-2-max'
  | 'flux-2-flex'
  | 'flux-2-klein-4b'
  | 'flux-2-klein-9b';

/**
 * Base request parameters shared across all generation types
 */
export interface FluxBaseRequest {
  /** Text prompt describing the desired image */
  prompt: string;
  /** Image width in pixels (default: 1024) */
  width?: number;
  /** Image height in pixels (default: 1024) */
  height?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Guidance scale for prompt adherence (default varies by model) */
  guidance?: number;
  /** Number of inference steps */
  steps?: number;
  /** Output format: jpeg, png, or webp */
  output_format?: 'jpeg' | 'png' | 'webp';
  /** Safety tolerance level (0-6, higher = more permissive) */
  safety_tolerance?: number;
}

/**
 * Text-to-image generation request
 */
export interface FluxGenerateRequest extends FluxBaseRequest {
  /** Prompt upsampling to enhance quality */
  prompt_upsampling?: boolean;
}

/**
 * Image editing request with reference images
 */
export interface FluxEditRequest extends FluxBaseRequest {
  /** Base64-encoded reference images (up to 8 for pro model) */
  image?: string;
  /** Multiple reference images for style/content matching */
  images?: string[];
  /** Strength of the edit (0.0-1.0, higher = more change) */
  strength?: number;
}

/**
 * Redux/variation request for image modifications
 */
export interface FluxReduxRequest {
  /** Base64-encoded source image */
  image: string;
  /** Optional prompt to guide variations */
  prompt?: string;
  /** Random seed for reproducibility */
  seed?: number;
  /** Output format */
  output_format?: 'jpeg' | 'png' | 'webp';
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Status of a generation request
 */
export type FluxStatus =
  | 'Pending'
  | 'Request Moderated'
  | 'Content Moderated'
  | 'Ready'
  | 'Error'
  | 'Task not found';

/**
 * Initial response when submitting a generation request
 */
export interface FluxSubmitResponse {
  /** Unique request identifier */
  id: string;
  /** URL to poll for status updates */
  polling_url: string;
  /** Initial status (usually 'Pending') */
  status: FluxStatus;
}

/**
 * Response when polling for generation status
 */
export interface FluxPollResponse {
  /** Current status of the generation */
  status: FluxStatus;
  /** Result data (only present when status is 'Ready') */
  result?: {
    /** URL to the generated image (expires in 10 minutes) */
    sample: string;
    /** Generation seed used */
    seed?: number;
    /** Prompt used (may differ if upsampled) */
    prompt?: string;
  };
  /** Error message if generation failed */
  error?: string;
}

/**
 * Complete generation result after successful completion
 */
export interface FluxGenerationResult {
  /** Unique request identifier */
  id: string;
  /** Final status */
  status: 'Ready';
  /** URL to the generated image (temporary, expires in 10 minutes) */
  imageUrl: string;
  /** Permanent URL after storage (Supabase) */
  storedUrl?: string;
  /** Generation seed for reproducibility */
  seed?: number;
  /** Model used for generation */
  model: FluxModel;
  /** Original prompt */
  prompt: string;
  /** Upsampled/enhanced prompt if applicable */
  enhancedPrompt?: string;
  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Cost in credits/megapixels */
  cost: number;
  /** Timestamp of completion */
  completedAt: Date;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * BFL API error response
 */
export interface FluxApiError {
  /** Error code */
  code?: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Custom error class for BFL operations
 */
export class BFLError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BFLError';
  }
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Configuration for polling behavior
 */
export interface PollingConfig {
  /** Maximum time to wait for completion (ms) */
  timeout: number;
  /** Initial delay between polls (ms) */
  initialInterval: number;
  /** Maximum delay between polls (ms) */
  maxInterval: number;
  /** Backoff multiplier for increasing delays */
  backoffMultiplier: number;
}

/**
 * Generation job for tracking in-progress requests
 */
export interface GenerationJob {
  /** Unique job identifier */
  id: string;
  /** User who initiated the request */
  userId: string;
  /** Associated conversation ID (optional) */
  conversationId?: string;
  /** Type of generation */
  type: 'image' | 'edit' | 'slides';
  /** Model being used */
  model: FluxModel;
  /** Original prompt */
  prompt: string;
  /** Full request parameters */
  request: FluxGenerateRequest | FluxEditRequest;
  /** BFL request ID */
  bflRequestId?: string;
  /** Polling URL */
  pollingUrl?: string;
  /** Current status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Result if completed */
  result?: FluxGenerationResult;
  /** Error message if failed */
  error?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Completion timestamp */
  completedAt?: Date;
}
