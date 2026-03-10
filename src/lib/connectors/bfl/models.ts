/**
 * BLACK FOREST LABS FLUX MODEL CONFIGURATIONS
 *
 * Defines available models, their capabilities, pricing, and defaults.
 */

import type { FluxModel } from './types';

/**
 * Model capability definition
 */
export interface FluxModelConfig {
  /** Model identifier for API calls */
  id: FluxModel;
  /** Display name */
  name: string;
  /** Model description */
  description: string;
  /** API endpoint path */
  endpoint: string;
  /** Supported features */
  capabilities: {
    /** Supports text-to-image generation */
    textToImage: boolean;
    /** Supports image editing with references */
    imageEditing: boolean;
    /** Maximum reference images for editing */
    maxReferenceImages: number;
    /** Supports prompt upsampling */
    promptUpsampling: boolean;
    /** Supports redux/variations */
    redux: boolean;
  };
  /** Default parameters */
  defaults: {
    width: number;
    height: number;
    guidance: number;
    steps: number;
    outputFormat: 'jpeg' | 'png' | 'webp';
  };
  /** Parameter limits */
  limits: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    minGuidance: number;
    maxGuidance: number;
    minSteps: number;
    maxSteps: number;
  };
  /** Pricing per megapixel (USD) */
  pricePerMegapixel: number;
  /** Quality tier (higher = better quality) */
  qualityTier: 1 | 2 | 3;
  /** Speed tier (higher = faster) */
  speedTier: 1 | 2 | 3;
}

/**
 * All available FLUX.2 models with their configurations
 */
export const FLUX_MODELS: Record<FluxModel, FluxModelConfig> = {
  'flux-2-pro': {
    id: 'flux-2-pro',
    name: 'FLUX.2 Pro',
    description: 'High-quality professional model with best results',
    endpoint: '/v1/flux-2-pro',
    capabilities: {
      textToImage: true,
      imageEditing: true,
      maxReferenceImages: 8,
      promptUpsampling: true,
      redux: true,
    },
    defaults: {
      width: 1024,
      height: 1024,
      guidance: 3.5,
      steps: 28,
      outputFormat: 'png',
    },
    limits: {
      minWidth: 256,
      maxWidth: 2048,
      minHeight: 256,
      maxHeight: 2048,
      minGuidance: 1.5,
      maxGuidance: 5.0,
      minSteps: 1,
      maxSteps: 50,
    },
    pricePerMegapixel: 0.03,
    qualityTier: 3,
    speedTier: 2,
  },

  'flux-2-max': {
    id: 'flux-2-max',
    name: 'FLUX.2 Max',
    description: 'Maximum quality for demanding use cases',
    endpoint: '/v1/flux-2-max',
    capabilities: {
      textToImage: true,
      imageEditing: true,
      maxReferenceImages: 8,
      promptUpsampling: true,
      redux: true,
    },
    defaults: {
      width: 1024,
      height: 1024,
      guidance: 4.0,
      steps: 35,
      outputFormat: 'png',
    },
    limits: {
      minWidth: 256,
      maxWidth: 2048,
      minHeight: 256,
      maxHeight: 2048,
      minGuidance: 1.5,
      maxGuidance: 6.0,
      minSteps: 1,
      maxSteps: 60,
    },
    pricePerMegapixel: 0.05,
    qualityTier: 3,
    speedTier: 1,
  },

  'flux-2-flex': {
    id: 'flux-2-flex',
    name: 'FLUX.2 Flex',
    description: 'Flexible model balancing quality and speed',
    endpoint: '/v1/flux-2-flex',
    capabilities: {
      textToImage: true,
      imageEditing: true,
      maxReferenceImages: 4,
      promptUpsampling: true,
      redux: false,
    },
    defaults: {
      width: 1024,
      height: 1024,
      guidance: 3.0,
      steps: 20,
      outputFormat: 'jpeg',
    },
    limits: {
      minWidth: 256,
      maxWidth: 2048,
      minHeight: 256,
      maxHeight: 2048,
      minGuidance: 1.0,
      maxGuidance: 4.0,
      minSteps: 1,
      maxSteps: 40,
    },
    pricePerMegapixel: 0.02,
    qualityTier: 2,
    speedTier: 2,
  },

  'flux-2-klein-4b': {
    id: 'flux-2-klein-4b',
    name: 'FLUX.2 Klein 4B',
    description: 'Fast lightweight model for quick generations',
    endpoint: '/v1/flux-2-klein-4b',
    capabilities: {
      textToImage: true,
      imageEditing: false,
      maxReferenceImages: 0,
      promptUpsampling: false,
      redux: false,
    },
    defaults: {
      width: 1024,
      height: 1024,
      guidance: 2.5,
      steps: 15,
      outputFormat: 'jpeg',
    },
    limits: {
      minWidth: 256,
      maxWidth: 1536,
      minHeight: 256,
      maxHeight: 1536,
      minGuidance: 1.0,
      maxGuidance: 3.5,
      minSteps: 1,
      maxSteps: 30,
    },
    pricePerMegapixel: 0.01,
    qualityTier: 1,
    speedTier: 3,
  },

  'flux-2-klein-9b': {
    id: 'flux-2-klein-9b',
    name: 'FLUX.2 Klein 9B',
    description: 'Balanced lightweight model with better quality',
    endpoint: '/v1/flux-2-klein-9b',
    capabilities: {
      textToImage: true,
      imageEditing: false,
      maxReferenceImages: 0,
      promptUpsampling: false,
      redux: false,
    },
    defaults: {
      width: 1024,
      height: 1024,
      guidance: 2.8,
      steps: 18,
      outputFormat: 'jpeg',
    },
    limits: {
      minWidth: 256,
      maxWidth: 1536,
      minHeight: 256,
      maxHeight: 1536,
      minGuidance: 1.0,
      maxGuidance: 4.0,
      minSteps: 1,
      maxSteps: 35,
    },
    pricePerMegapixel: 0.015,
    qualityTier: 2,
    speedTier: 3,
  },
};

/**
 * Default model for general use
 */
export const DEFAULT_MODEL: FluxModel = 'flux-2-pro';

/**
 * Get model configuration by ID
 */
export function getModelConfig(model: FluxModel): FluxModelConfig {
  return FLUX_MODELS[model];
}

/**
 * Calculate cost for a generation based on dimensions
 */
export function calculateCost(model: FluxModel, width: number, height: number): number {
  const config = FLUX_MODELS[model];
  const megapixels = (width * height) / 1_000_000;
  return megapixels * config.pricePerMegapixel;
}

/**
 * Validate dimensions against model limits
 */
export function validateDimensions(
  model: FluxModel,
  width: number,
  height: number
): { valid: boolean; error?: string } {
  const config = FLUX_MODELS[model];
  const { limits } = config;

  if (width < limits.minWidth || width > limits.maxWidth) {
    return {
      valid: false,
      error: `Width must be between ${limits.minWidth} and ${limits.maxWidth} for ${config.name}`,
    };
  }

  if (height < limits.minHeight || height > limits.maxHeight) {
    return {
      valid: false,
      error: `Height must be between ${limits.minHeight} and ${limits.maxHeight} for ${config.name}`,
    };
  }

  // Check total megapixels (generally max 4MP)
  const megapixels = (width * height) / 1_000_000;
  if (megapixels > 4) {
    return {
      valid: false,
      error: 'Total image size cannot exceed 4 megapixels',
    };
  }

  return { valid: true };
}

/**
 * Get models suitable for a specific capability
 */
export function getModelsWithCapability(
  capability: keyof FluxModelConfig['capabilities']
): FluxModelConfig[] {
  return Object.values(FLUX_MODELS).filter((config) => {
    const value = config.capabilities[capability];
    return typeof value === 'boolean' ? value : value > 0;
  });
}

/**
 * Common aspect ratios with dimensions
 */
export const ASPECT_RATIOS = {
  '1:1': { width: 1024, height: 1024, label: 'Square' },
  '4:3': { width: 1024, height: 768, label: 'Landscape 4:3' },
  '3:4': { width: 768, height: 1024, label: 'Portrait 3:4' },
  '16:9': { width: 1280, height: 720, label: 'Widescreen' },
  '9:16': { width: 720, height: 1280, label: 'Vertical' },
  '3:2': { width: 1024, height: 683, label: 'Photo Landscape' },
  '2:3': { width: 683, height: 1024, label: 'Photo Portrait' },
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIOS;
