/**
 * IMAGE GENERATION SERVICE
 *
 * PURPOSE:
 * - Generate images using AI models
 * - Configurable model selection (nano banana 3)
 * - Support for various styles and sizes
 */

export type ImageModel = 'nano-banana-3' | 'nano-banana-4' | 'stable-diffusion' | 'dall-e-3';

export interface ImageGenerationConfig {
  model: ImageModel;
  width: number;
  height: number;
  steps?: number;
  guidance?: number;
  style?: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: ImageModel;
  width: number;
  height: number;
  createdAt: Date;
}

// Default configuration
const DEFAULT_CONFIG: ImageGenerationConfig = {
  model: 'nano-banana-3',
  width: 1024,
  height: 1024,
  steps: 30,
  guidance: 7.5,
};

// Available styles
export const IMAGE_STYLES = [
  { id: 'photorealistic', name: 'Photorealistic', prompt: 'photorealistic, 8k, ultra detailed' },
  { id: 'digital-art', name: 'Digital Art', prompt: 'digital art, trending on artstation' },
  { id: 'anime', name: 'Anime', prompt: 'anime style, studio ghibli, vibrant colors' },
  { id: 'oil-painting', name: 'Oil Painting', prompt: 'oil painting, classical style, textured canvas' },
  { id: 'watercolor', name: 'Watercolor', prompt: 'watercolor painting, soft edges, artistic' },
  { id: 'sketch', name: 'Sketch', prompt: 'pencil sketch, detailed line art, hand drawn' },
  { id: 'minimalist', name: 'Minimalist', prompt: 'minimalist, clean, simple shapes, modern design' },
  { id: '3d-render', name: '3D Render', prompt: '3d render, octane render, high quality, realistic lighting' },
];

// Aspect ratios
export const ASPECT_RATIOS = [
  { id: '1:1', width: 1024, height: 1024, name: 'Square' },
  { id: '16:9', width: 1024, height: 576, name: 'Landscape' },
  { id: '9:16', width: 576, height: 1024, name: 'Portrait' },
  { id: '4:3', width: 1024, height: 768, name: 'Standard' },
  { id: '3:4', width: 768, height: 1024, name: 'Portrait Standard' },
];

// Enhance prompt with style
export function enhancePrompt(prompt: string, styleId?: string): string {
  const style = IMAGE_STYLES.find((s) => s.id === styleId);
  if (style) {
    return `${prompt}, ${style.prompt}`;
  }
  return prompt;
}

// Generate image (API call)
export async function generateImage(
  prompt: string,
  config: Partial<ImageGenerationConfig> = {}
): Promise<GeneratedImage> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Call the image generation API
  const response = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      ...finalConfig,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Image generation failed');
  }

  return response.json();
}

// Get model info
export function getModelInfo(model: ImageModel): {
  name: string;
  description: string;
  maxWidth: number;
  maxHeight: number;
  supportsStyles: boolean;
} {
  const models: Record<ImageModel, ReturnType<typeof getModelInfo>> = {
    'nano-banana-3': {
      name: 'Nano Banana 3',
      description: 'High-quality image generation with excellent prompt following',
      maxWidth: 2048,
      maxHeight: 2048,
      supportsStyles: true,
    },
    'nano-banana-4': {
      name: 'Nano Banana 4',
      description: 'Latest model with improved quality and speed',
      maxWidth: 2048,
      maxHeight: 2048,
      supportsStyles: true,
    },
    'stable-diffusion': {
      name: 'Stable Diffusion',
      description: 'Open-source image generation model',
      maxWidth: 1024,
      maxHeight: 1024,
      supportsStyles: true,
    },
    'dall-e-3': {
      name: 'DALL-E 3',
      description: 'OpenAI image generation model',
      maxWidth: 1024,
      maxHeight: 1024,
      supportsStyles: false,
    },
  };

  return models[model];
}

// List available models
export function listModels(): { id: ImageModel; name: string }[] {
  return [
    { id: 'nano-banana-3', name: 'Nano Banana 3' },
    { id: 'nano-banana-4', name: 'Nano Banana 4' },
    { id: 'stable-diffusion', name: 'Stable Diffusion' },
    { id: 'dall-e-3', name: 'DALL-E 3' },
  ];
}
