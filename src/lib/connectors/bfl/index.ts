/**
 * BLACK FOREST LABS (BFL) FLUX CONNECTOR
 *
 * Complete integration for FLUX.2 image generation API.
 *
 * Features:
 * - Text-to-image generation
 * - Image editing with references
 * - Automatic polling with exponential backoff
 * - Supabase Storage for permanent image storage
 *
 * Usage:
 * ```typescript
 * import { generateImage, isBFLConfigured } from '@/lib/connectors/bfl';
 *
 * if (isBFLConfigured()) {
 *   const result = await generateImage('A beautiful sunset over mountains');
 *   console.log(result.imageUrl);
 * }
 * ```
 */

// Types
export * from './types';

// Model configurations
export {
  FLUX_MODELS,
  DEFAULT_MODEL,
  ASPECT_RATIOS,
  getModelConfig,
  calculateCost,
  validateDimensions,
  getModelsWithCapability,
  type FluxModelConfig,
  type AspectRatio,
} from './models';

// Client functions
export {
  isBFLConfigured,
  generateImage,
  editImage,
  submitGeneration,
  submitEdit,
  pollForResult,
  imageToBase64,
  extractBase64,
} from './client';

// Storage functions
export {
  downloadAndStore,
  storeBase64Image,
  deleteGeneration,
  getSignedUrl,
  generationExists,
  listUserGenerations,
} from './storage';
