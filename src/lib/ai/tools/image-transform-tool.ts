/**
 * IMAGE TRANSFORM TOOL
 *
 * Transforms images: resize, compress, convert format, rotate, crop, watermark.
 * Uses Sharp for high-performance image processing.
 *
 * Features:
 * - Resize (with aspect ratio preservation)
 * - Compress (quality adjustment)
 * - Convert format (PNG, JPEG, WebP, AVIF, GIF)
 * - Rotate
 * - Crop
 * - Watermark (text overlay)
 * - Grayscale, blur, sharpen
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded Sharp library
let sharp: typeof import('sharp') | null = null;

async function initSharp(): Promise<boolean> {
  if (sharp) return true;
  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default || sharpModule;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const imageTransformTool: UnifiedTool = {
  name: 'transform_image',
  description: `Transform images: resize, compress, convert format, rotate, crop, add watermark, and apply effects.

Operations available:
- resize: Change dimensions (preserves aspect ratio by default)
- compress: Reduce file size with quality setting
- convert: Change format (png, jpeg, webp, avif, gif)
- rotate: Rotate by degrees (90, 180, 270, or any angle)
- crop: Extract a region from the image
- watermark: Add text overlay
- grayscale: Convert to black and white
- blur: Apply gaussian blur
- sharpen: Enhance sharpness

Input: Provide image as base64 string or URL.
Output: Returns transformed image as downloadable file.`,
  parameters: {
    type: 'object',
    properties: {
      image_url: {
        type: 'string',
        description: 'URL of the image to transform',
      },
      image_base64: {
        type: 'string',
        description: 'Base64-encoded image data (without data URL prefix)',
      },
      operations: {
        type: 'array',
        description:
          'Array of operations to apply in order. Each operation is an object with type and parameters.',
        items: {
          type: 'object',
        },
      },
      output_format: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp', 'avif', 'gif'],
        description: 'Output format. Default: same as input or png',
      },
      quality: {
        type: 'number',
        description: 'Output quality for lossy formats (1-100). Default: 80',
      },
    },
    required: ['operations'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isImageTransformAvailable(): Promise<boolean> {
  return await initSharp();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchImageAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'JCIL-AI-ImageTransform/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.startsWith('image/')) {
    throw new Error(`URL does not point to an image (content-type: ${contentType})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

interface ResizeOp {
  type: 'resize';
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

interface CropOp {
  type: 'crop';
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RotateOp {
  type: 'rotate';
  angle: number;
  background?: string;
}

interface WatermarkOp {
  type: 'watermark';
  text: string;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  fontSize?: number;
  color?: string;
  opacity?: number;
}

interface EffectOp {
  type: 'grayscale' | 'blur' | 'sharpen' | 'negate' | 'flip' | 'flop';
  sigma?: number; // For blur
}

type ImageOperation = ResizeOp | CropOp | RotateOp | WatermarkOp | EffectOp;

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeImageTransform(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    image_url?: string;
    image_base64?: string;
    operations: ImageOperation[];
    output_format?: 'png' | 'jpeg' | 'webp' | 'avif' | 'gif';
    quality?: number;
  };

  // Validate input
  if (!args.image_url && !args.image_base64) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Either image_url or image_base64 must be provided',
      isError: true,
    };
  }

  if (!args.operations || !Array.isArray(args.operations) || args.operations.length === 0) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: At least one operation must be specified',
      isError: true,
    };
  }

  // Initialize Sharp
  const loaded = await initSharp();
  if (!loaded || !sharp) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Image processing library not available',
      isError: true,
    };
  }

  try {
    // Get image buffer
    let imageBuffer: Buffer;
    if (args.image_base64) {
      imageBuffer = Buffer.from(args.image_base64, 'base64');
    } else if (args.image_url) {
      imageBuffer = await fetchImageAsBuffer(args.image_url);
    } else {
      throw new Error('No image source provided');
    }

    // Create Sharp instance
    let image = sharp(imageBuffer);

    // Get original metadata
    const metadata = await image.metadata();
    const originalFormat = metadata.format || 'png';

    // Apply operations in order
    for (const op of args.operations) {
      switch (op.type) {
        case 'resize': {
          const resizeOp = op as ResizeOp;
          image = image.resize({
            width: resizeOp.width,
            height: resizeOp.height,
            fit: resizeOp.fit || 'inside',
            withoutEnlargement: true,
          });
          break;
        }

        case 'crop': {
          const cropOp = op as CropOp;
          image = image.extract({
            left: cropOp.left,
            top: cropOp.top,
            width: cropOp.width,
            height: cropOp.height,
          });
          break;
        }

        case 'rotate': {
          const rotateOp = op as RotateOp;
          image = image.rotate(rotateOp.angle, {
            background: rotateOp.background || '#ffffff',
          });
          break;
        }

        case 'watermark': {
          const watermarkOp = op as WatermarkOp;
          const fontSize = watermarkOp.fontSize || 24;
          const color = watermarkOp.color || '#ffffff';
          const opacity = watermarkOp.opacity || 0.5;

          // Get current dimensions for positioning
          const currentMeta = await image.metadata();
          const imgWidth = currentMeta.width || 800;
          const imgHeight = currentMeta.height || 600;

          // Calculate position
          let x = imgWidth / 2;
          let y = imgHeight / 2;
          let anchor: 'start' | 'middle' | 'end' = 'middle';

          switch (watermarkOp.position) {
            case 'top-left':
              x = 20;
              y = fontSize + 20;
              anchor = 'start';
              break;
            case 'top-right':
              x = imgWidth - 20;
              y = fontSize + 20;
              anchor = 'end';
              break;
            case 'bottom-left':
              x = 20;
              y = imgHeight - 20;
              anchor = 'start';
              break;
            case 'bottom-right':
              x = imgWidth - 20;
              y = imgHeight - 20;
              anchor = 'end';
              break;
            default:
              // center
              break;
          }

          // Create SVG overlay for text
          const svgText = `
            <svg width="${imgWidth}" height="${imgHeight}">
              <style>
                .watermark {
                  fill: ${color};
                  font-size: ${fontSize}px;
                  font-family: sans-serif;
                  opacity: ${opacity};
                }
              </style>
              <text x="${x}" y="${y}" text-anchor="${anchor}" class="watermark">${watermarkOp.text}</text>
            </svg>
          `;

          image = image.composite([
            {
              input: Buffer.from(svgText),
              top: 0,
              left: 0,
            },
          ]);
          break;
        }

        case 'grayscale':
          image = image.grayscale();
          break;

        case 'blur': {
          const blurOp = op as EffectOp;
          image = image.blur(blurOp.sigma || 3);
          break;
        }

        case 'sharpen':
          image = image.sharpen();
          break;

        case 'negate':
          image = image.negate();
          break;

        case 'flip':
          image = image.flip(); // Vertical flip
          break;

        case 'flop':
          image = image.flop(); // Horizontal flip
          break;

        default:
          // Skip unknown operations
          break;
      }
    }

    // Set output format
    const outputFormat = args.output_format || (originalFormat as 'png' | 'jpeg' | 'webp');
    const quality = Math.min(Math.max(args.quality || 80, 1), 100);

    switch (outputFormat) {
      case 'jpeg':
        image = image.jpeg({ quality });
        break;
      case 'webp':
        image = image.webp({ quality });
        break;
      case 'avif':
        image = image.avif({ quality });
        break;
      case 'gif':
        image = image.gif();
        break;
      case 'png':
      default:
        image = image.png({ compressionLevel: Math.floor((100 - quality) / 11) });
        break;
    }

    // Generate output
    const outputBuffer = await image.toBuffer();
    const outputMetadata = await sharp(outputBuffer).metadata();

    const base64Data = outputBuffer.toString('base64');
    const timestamp = Date.now();
    const filename = `transformed_${timestamp}.${outputFormat}`;

    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      avif: 'image/avif',
      gif: 'image/gif',
    };

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Image transformed successfully with ${args.operations.length} operation(s)`,
        filename,
        format: outputFormat,
        dimensions: `${outputMetadata.width}x${outputMetadata.height}`,
        fileSize: `${(outputBuffer.length / 1024).toFixed(1)} KB`,
        operations: args.operations.map((op) => op.type),
        mimeType: mimeTypes[outputFormat] || 'image/png',
        // Base64 data for the image
        imageData: base64Data,
        dataUrl: `data:${mimeTypes[outputFormat] || 'image/png'};base64,${base64Data}`,
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error transforming image: ${(error as Error).message}`,
      isError: true,
    };
  }
}
