/**
 * BLOOM-EFFECT TOOL
 * HDR bloom post-processing with physically-based light scattering simulation
 *
 * Implements:
 * - Brightness thresholding with soft/hard knee
 * - Multi-pass Gaussian blur with separable kernels
 * - Kawase blur (fast approximation)
 * - Dual filtering (downsample/upsample pyramid)
 * - Lens dirt/diffraction effects
 * - Anamorphic bloom (stretched horizontally)
 * - HDR tone mapping integration
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface HDRPixel {
  r: number; // Can exceed 1.0 for HDR
  g: number;
  b: number;
  luminance: number;
}

interface BloomSettings {
  threshold: number; // Brightness threshold (0-1 for SDR, >1 for HDR)
  softKnee: number; // Soft knee width (0 = hard, 1 = very soft)
  intensity: number; // Bloom intensity multiplier
  radius: number; // Blur radius in pixels
  iterations: number; // Number of blur passes
  tint: { r: number; g: number; b: number }; // Color tint
  dirtMask?: number[][]; // Optional lens dirt texture
  anamorphic: number; // Anamorphic ratio (1 = normal, 2 = 2x horizontal stretch)
}

interface BloomMip {
  width: number;
  height: number;
  data: HDRPixel[][];
  blurredData?: HDRPixel[][];
}

interface BloomPipeline {
  inputWidth: number;
  inputHeight: number;
  mipChain: BloomMip[];
  settings: BloomSettings;
  combinedResult?: HDRPixel[][];
}

// ============================================================================
// GAUSSIAN BLUR IMPLEMENTATION
// ============================================================================

class GaussianBlur {
  /**
   * Generate 1D Gaussian kernel
   */
  static generateKernel(radius: number, sigma?: number): number[] {
    const size = radius * 2 + 1;
    const s = sigma || radius / 3;
    const kernel: number[] = new Array(size);
    let sum = 0;

    for (let i = 0; i < size; i++) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / (2 * s * s));
      sum += kernel[i];
    }

    // Normalize
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }

  /**
   * Apply separable Gaussian blur (horizontal pass)
   */
  static blurHorizontal(
    pixels: HDRPixel[][],
    width: number,
    height: number,
    kernel: number[],
    stretch: number = 1
  ): HDRPixel[][] {
    const radius = Math.floor(kernel.length / 2);
    const effectiveRadius = Math.floor(radius * stretch);
    const result: HDRPixel[][] = [];

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          weightSum = 0;

        for (let k = -effectiveRadius; k <= effectiveRadius; k++) {
          const kernelIdx = Math.floor(k / stretch + radius);
          if (kernelIdx < 0 || kernelIdx >= kernel.length) continue;

          const sampleX = Math.min(Math.max(x + k, 0), width - 1);
          const weight = kernel[kernelIdx];

          r += pixels[y][sampleX].r * weight;
          g += pixels[y][sampleX].g * weight;
          b += pixels[y][sampleX].b * weight;
          weightSum += weight;
        }

        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        result[y][x] = {
          r: r / weightSum,
          g: g / weightSum,
          b: b / weightSum,
          luminance,
        };
      }
    }

    return result;
  }

  /**
   * Apply separable Gaussian blur (vertical pass)
   */
  static blurVertical(
    pixels: HDRPixel[][],
    width: number,
    height: number,
    kernel: number[]
  ): HDRPixel[][] {
    const radius = Math.floor(kernel.length / 2);
    const result: HDRPixel[][] = [];

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          weightSum = 0;

        for (let k = -radius; k <= radius; k++) {
          const sampleY = Math.min(Math.max(y + k, 0), height - 1);
          const weight = kernel[k + radius];

          r += pixels[sampleY][x].r * weight;
          g += pixels[sampleY][x].g * weight;
          b += pixels[sampleY][x].b * weight;
          weightSum += weight;
        }

        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        result[y][x] = {
          r: r / weightSum,
          g: g / weightSum,
          b: b / weightSum,
          luminance,
        };
      }
    }

    return result;
  }

  /**
   * Full separable Gaussian blur
   */
  static blur(
    pixels: HDRPixel[][],
    width: number,
    height: number,
    radius: number,
    anamorphic: number = 1
  ): HDRPixel[][] {
    const kernel = this.generateKernel(radius);
    const horizontal = this.blurHorizontal(pixels, width, height, kernel, anamorphic);
    return this.blurVertical(horizontal, width, height, kernel);
  }
}

// ============================================================================
// KAWASE BLUR (FAST APPROXIMATION)
// ============================================================================

class KawaseBlur {
  /**
   * Single Kawase blur pass
   * Samples 4 corners at increasing distances
   */
  static pass(pixels: HDRPixel[][], width: number, height: number, offset: number): HDRPixel[][] {
    const result: HDRPixel[][] = [];
    const halfOffset = offset + 0.5;

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        // Sample 4 corners
        const samples: { x: number; y: number }[] = [
          { x: x - halfOffset, y: y - halfOffset },
          { x: x + halfOffset, y: y - halfOffset },
          { x: x - halfOffset, y: y + halfOffset },
          { x: x + halfOffset, y: y + halfOffset },
        ];

        let r = 0,
          g = 0,
          b = 0;

        for (const sample of samples) {
          const sx = Math.min(Math.max(Math.floor(sample.x), 0), width - 1);
          const sy = Math.min(Math.max(Math.floor(sample.y), 0), height - 1);

          r += pixels[sy][sx].r;
          g += pixels[sy][sx].g;
          b += pixels[sy][sx].b;
        }

        r /= 4;
        g /= 4;
        b /= 4;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        result[y][x] = { r, g, b, luminance };
      }
    }

    return result;
  }

  /**
   * Multi-pass Kawase blur
   */
  static blur(
    pixels: HDRPixel[][],
    width: number,
    height: number,
    iterations: number
  ): HDRPixel[][] {
    // Kawase offsets for progressive blur
    const offsets = [0, 1, 2, 2, 3];
    let current = pixels;

    for (let i = 0; i < iterations && i < offsets.length; i++) {
      current = this.pass(current, width, height, offsets[i]);
    }

    return current;
  }
}

// ============================================================================
// DUAL FILTERING BLOOM (PYRAMID-BASED)
// ============================================================================

class DualFilterBloom {
  /**
   * Downsample with 4-tap filter
   */
  static downsample(
    pixels: HDRPixel[][],
    srcWidth: number,
    srcHeight: number
  ): { data: HDRPixel[][]; width: number; height: number } {
    const dstWidth = Math.max(1, Math.floor(srcWidth / 2));
    const dstHeight = Math.max(1, Math.floor(srcHeight / 2));
    const result: HDRPixel[][] = [];

    for (let y = 0; y < dstHeight; y++) {
      result[y] = [];
      for (let x = 0; x < dstWidth; x++) {
        const srcX = x * 2;
        const srcY = y * 2;

        // 4x4 tap with center weighted
        let r = 0,
          g = 0,
          b = 0;
        let weightSum = 0;

        const taps = [
          { dx: 0, dy: 0, w: 4 },
          { dx: -1, dy: -1, w: 1 },
          { dx: 1, dy: -1, w: 1 },
          { dx: -1, dy: 1, w: 1 },
          { dx: 1, dy: 1, w: 1 },
          { dx: 0, dy: -1, w: 2 },
          { dx: 0, dy: 1, w: 2 },
          { dx: -1, dy: 0, w: 2 },
          { dx: 1, dy: 0, w: 2 },
        ];

        for (const tap of taps) {
          const sx = Math.min(Math.max(srcX + tap.dx, 0), srcWidth - 1);
          const sy = Math.min(Math.max(srcY + tap.dy, 0), srcHeight - 1);

          r += pixels[sy][sx].r * tap.w;
          g += pixels[sy][sx].g * tap.w;
          b += pixels[sy][sx].b * tap.w;
          weightSum += tap.w;
        }

        r /= weightSum;
        g /= weightSum;
        b /= weightSum;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        result[y][x] = { r, g, b, luminance };
      }
    }

    return { data: result, width: dstWidth, height: dstHeight };
  }

  /**
   * Upsample with tent filter and add to existing
   */
  static upsample(
    pixels: HDRPixel[][],
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number,
    existing?: HDRPixel[][]
  ): HDRPixel[][] {
    const result: HDRPixel[][] = [];

    for (let y = 0; y < dstHeight; y++) {
      result[y] = [];
      for (let x = 0; x < dstWidth; x++) {
        const srcX = (x / dstWidth) * srcWidth;
        const srcY = (y / dstHeight) * srcHeight;

        // Bilinear interpolation
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, srcWidth - 1);
        const y1 = Math.min(y0 + 1, srcHeight - 1);

        const fx = srcX - x0;
        const fy = srcY - y0;

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        let r =
          pixels[y0][x0].r * w00 +
          pixels[y0][x1].r * w10 +
          pixels[y1][x0].r * w01 +
          pixels[y1][x1].r * w11;
        let g =
          pixels[y0][x0].g * w00 +
          pixels[y0][x1].g * w10 +
          pixels[y1][x0].g * w01 +
          pixels[y1][x1].g * w11;
        let b =
          pixels[y0][x0].b * w00 +
          pixels[y0][x1].b * w10 +
          pixels[y1][x0].b * w01 +
          pixels[y1][x1].b * w11;

        // Add existing if provided
        if (existing && existing[y] && existing[y][x]) {
          r += existing[y][x].r;
          g += existing[y][x].g;
          b += existing[y][x].b;
        }

        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        result[y][x] = { r, g, b, luminance };
      }
    }

    return result;
  }

  /**
   * Build full bloom pyramid
   */
  static buildPyramid(
    brightPass: HDRPixel[][],
    width: number,
    height: number,
    levels: number
  ): BloomMip[] {
    const mips: BloomMip[] = [{ width, height, data: brightPass }];

    let currentData = brightPass;
    let currentWidth = width;
    let currentHeight = height;

    // Build downsample chain
    for (let i = 1; i < levels; i++) {
      const down = this.downsample(currentData, currentWidth, currentHeight);
      mips.push({ width: down.width, height: down.height, data: down.data });
      currentData = down.data;
      currentWidth = down.width;
      currentHeight = down.height;
    }

    // Upsample and combine
    let combined = mips[mips.length - 1].data;
    let combinedWidth = mips[mips.length - 1].width;
    let combinedHeight = mips[mips.length - 1].height;

    for (let i = mips.length - 2; i >= 0; i--) {
      combined = this.upsample(
        combined,
        combinedWidth,
        combinedHeight,
        mips[i].width,
        mips[i].height,
        mips[i].data
      );
      combinedWidth = mips[i].width;
      combinedHeight = mips[i].height;
      mips[i].blurredData = combined;
    }

    return mips;
  }
}

// ============================================================================
// BRIGHTNESS EXTRACTION
// ============================================================================

class BrightnessExtractor {
  /**
   * Calculate relative luminance
   */
  static luminance(r: number, g: number, b: number): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Soft knee threshold function
   * Provides smooth transition around threshold
   */
  static softKnee(luminance: number, threshold: number, knee: number): number {
    const soft = threshold - knee;
    const excess = luminance - soft;

    if (excess < 0) return 0;
    if (excess < 2 * knee) {
      // Quadratic interpolation in knee region
      return (excess * excess) / (4 * knee);
    }
    return luminance - threshold;
  }

  /**
   * Extract bright regions from image
   */
  static extract(
    pixels: { r: number; g: number; b: number }[][],
    width: number,
    height: number,
    threshold: number,
    softKnee: number
  ): HDRPixel[][] {
    const result: HDRPixel[][] = [];
    const knee = threshold * softKnee;

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        const pixel = pixels[y][x];
        const lum = this.luminance(pixel.r, pixel.g, pixel.b);

        // Calculate contribution
        const contribution = this.softKnee(lum, threshold, knee);
        const scale = contribution > 0 ? contribution / Math.max(lum, 0.0001) : 0;

        result[y][x] = {
          r: pixel.r * scale,
          g: pixel.g * scale,
          b: pixel.b * scale,
          luminance: lum * scale,
        };
      }
    }

    return result;
  }
}

// ============================================================================
// LENS EFFECTS
// ============================================================================

class LensEffects {
  /**
   * Apply lens dirt mask to bloom
   */
  static applyDirtMask(
    bloom: HDRPixel[][],
    width: number,
    height: number,
    dirtMask: number[][]
  ): HDRPixel[][] {
    const maskHeight = dirtMask.length;
    const maskWidth = dirtMask[0]?.length || 0;
    const result: HDRPixel[][] = [];

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        // Sample dirt mask with bilinear interpolation
        const maskX = (x / width) * maskWidth;
        const maskY = (y / height) * maskHeight;

        const x0 = Math.floor(maskX);
        const y0 = Math.floor(maskY);
        const x1 = Math.min(x0 + 1, maskWidth - 1);
        const y1 = Math.min(y0 + 1, maskHeight - 1);

        const fx = maskX - x0;
        const fy = maskY - y0;

        const dirtValue =
          dirtMask[y0][x0] * (1 - fx) * (1 - fy) +
          dirtMask[y0][x1] * fx * (1 - fy) +
          dirtMask[y1][x0] * (1 - fx) * fy +
          dirtMask[y1][x1] * fx * fy;

        const b = bloom[y][x];
        result[y][x] = {
          r: b.r * (1 + dirtValue),
          g: b.g * (1 + dirtValue),
          b: b.b * (1 + dirtValue),
          luminance: b.luminance * (1 + dirtValue),
        };
      }
    }

    return result;
  }

  /**
   * Generate procedural dirt mask
   */
  static generateDirtMask(width: number, height: number, density: number): number[][] {
    const mask: number[][] = [];

    for (let y = 0; y < height; y++) {
      mask[y] = [];
      for (let x = 0; x < width; x++) {
        // Radial falloff
        const cx = x / width - 0.5;
        const cy = y / height - 0.5;
        const radial = Math.sqrt(cx * cx + cy * cy);

        // Procedural noise (simplified)
        const noise =
          Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 +
          Math.sin(x * 0.3 + y * 0.2) * 0.3 +
          Math.sin(x * 0.05 - y * 0.05) * 0.2;

        mask[y][x] = Math.max(0, (noise + radial) * density);
      }
    }

    return mask;
  }

  /**
   * Apply color tint to bloom
   */
  static applyTint(
    bloom: HDRPixel[][],
    width: number,
    height: number,
    tint: { r: number; g: number; b: number }
  ): HDRPixel[][] {
    const result: HDRPixel[][] = [];

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        const b = bloom[y][x];
        result[y][x] = {
          r: b.r * tint.r,
          g: b.g * tint.g,
          b: b.b * tint.b,
          luminance: BrightnessExtractor.luminance(b.r * tint.r, b.g * tint.g, b.b * tint.b),
        };
      }
    }

    return result;
  }
}

// ============================================================================
// BLOOM COMPOSITOR
// ============================================================================

class BloomCompositor {
  /**
   * Combine bloom with original image
   */
  static combine(
    original: { r: number; g: number; b: number }[][],
    bloom: HDRPixel[][],
    width: number,
    height: number,
    intensity: number
  ): HDRPixel[][] {
    const result: HDRPixel[][] = [];

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        const o = original[y][x];
        const b = bloom[y][x];

        const r = o.r + b.r * intensity;
        const g = o.g + b.g * intensity;
        const bl = o.b + b.b * intensity;
        const luminance = BrightnessExtractor.luminance(r, g, bl);

        result[y][x] = { r, g, b: bl, luminance };
      }
    }

    return result;
  }

  /**
   * Apply simple Reinhard tone mapping
   */
  static toneMapReinhard(pixels: HDRPixel[][], exposure: number = 1): HDRPixel[][] {
    const result: HDRPixel[][] = [];

    for (let y = 0; y < pixels.length; y++) {
      result[y] = [];
      for (let x = 0; x < pixels[y].length; x++) {
        const p = pixels[y][x];
        const r = (p.r * exposure) / (1 + p.r * exposure);
        const g = (p.g * exposure) / (1 + p.g * exposure);
        const b = (p.b * exposure) / (1 + p.b * exposure);
        const luminance = BrightnessExtractor.luminance(r, g, b);

        result[y][x] = { r, g, b, luminance };
      }
    }

    return result;
  }

  /**
   * Apply ACES filmic tone mapping
   */
  static toneMapACES(pixels: HDRPixel[][]): HDRPixel[][] {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    const result: HDRPixel[][] = [];

    for (let y = 0; y < pixels.length; y++) {
      result[y] = [];
      for (let x = 0; x < pixels[y].length; x++) {
        const p = pixels[y][x];
        const r = Math.max(0, Math.min(1, (p.r * (a * p.r + b)) / (p.r * (c * p.r + d) + e)));
        const g = Math.max(0, Math.min(1, (p.g * (a * p.g + b)) / (p.g * (c * p.g + d) + e)));
        const bl = Math.max(0, Math.min(1, (p.b * (a * p.b + b)) / (p.b * (c * p.b + d) + e)));
        const luminance = BrightnessExtractor.luminance(r, g, bl);

        result[y][x] = { r, g, b: bl, luminance };
      }
    }

    return result;
  }
}

// ============================================================================
// BLOOM EFFECT PROCESSOR
// ============================================================================

class BloomEffectProcessor {
  /**
   * Process full bloom effect pipeline
   */
  static process(
    inputImage: { r: number; g: number; b: number }[][],
    settings: BloomSettings
  ): BloomPipeline {
    const height = inputImage.length;
    const width = inputImage[0]?.length || 0;

    // 1. Extract bright regions
    const brightPass = BrightnessExtractor.extract(
      inputImage,
      width,
      height,
      settings.threshold,
      settings.softKnee
    );

    // 2. Build mip chain with dual filtering
    const mipLevels = Math.min(settings.iterations, Math.floor(Math.log2(Math.min(width, height))));
    const mipChain = DualFilterBloom.buildPyramid(brightPass, width, height, mipLevels);

    // 3. Get blurred result from mip chain
    let bloom = mipChain[0].blurredData || brightPass;

    // 4. Apply additional Gaussian blur if needed
    if (settings.radius > 0) {
      bloom = GaussianBlur.blur(bloom, width, height, settings.radius, settings.anamorphic);
    }

    // 5. Apply lens dirt if provided
    if (settings.dirtMask) {
      bloom = LensEffects.applyDirtMask(bloom, width, height, settings.dirtMask);
    }

    // 6. Apply tint
    bloom = LensEffects.applyTint(bloom, width, height, settings.tint);

    // 7. Combine with original
    const combined = BloomCompositor.combine(inputImage, bloom, width, height, settings.intensity);

    return {
      inputWidth: width,
      inputHeight: height,
      mipChain,
      settings,
      combinedResult: combined,
    };
  }

  /**
   * Render demo bloom effect
   */
  static demo(): {
    description: string;
    inputScene: { r: number; g: number; b: number }[][];
    bloomResult: HDRPixel[][];
    pipeline: BloomPipeline;
  } {
    // Create test scene with HDR light sources
    const width = 32;
    const height = 32;
    const inputScene: { r: number; g: number; b: number }[][] = [];

    for (let y = 0; y < height; y++) {
      inputScene[y] = [];
      for (let x = 0; x < width; x++) {
        // Dark background
        let r = 0.1,
          g = 0.1,
          b = 0.15;

        // Bright HDR light source at center
        const dx = x - width / 2;
        const dy = y - height / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 3) {
          // Core of light (HDR, exceeds 1.0)
          r = 5.0;
          g = 4.5;
          b = 4.0;
        } else if (dist < 6) {
          // Falloff
          const falloff = 1 - (dist - 3) / 3;
          r += 2.0 * falloff;
          g += 1.8 * falloff;
          b += 1.5 * falloff;
        }

        // Second light source
        const dx2 = x - width * 0.75;
        const dy2 = y - height * 0.25;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (dist2 < 2) {
          r += 3.0;
          g += 3.5;
          b += 4.0;
        }

        inputScene[y][x] = { r, g, b };
      }
    }

    // Process with default settings
    const settings: BloomSettings = {
      threshold: 1.0,
      softKnee: 0.5,
      intensity: 0.8,
      radius: 4,
      iterations: 5,
      tint: { r: 1.0, g: 0.95, b: 0.9 },
      anamorphic: 1.0,
    };

    const pipeline = this.process(inputScene, settings);

    return {
      description: 'HDR bloom demo with two light sources',
      inputScene,
      bloomResult: pipeline.combinedResult || [],
      pipeline,
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const bloomeffectTool: UnifiedTool = {
  name: 'bloom_effect',
  description:
    'HDR bloom post-processing tool with physically-based light scattering simulation. Supports brightness thresholding, multi-pass blur, lens dirt effects, anamorphic bloom, and HDR tone mapping.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'extract_bright',
          'blur_gaussian',
          'blur_kawase',
          'blur_dual',
          'apply_dirt',
          'composite',
          'tone_map',
          'full_pipeline',
          'demo',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      image: {
        type: 'array',
        description: 'Input image as 2D array of {r, g, b} pixels (HDR values can exceed 1.0)',
      },
      settings: {
        type: 'object',
        description:
          'Bloom settings: { threshold?: number (1.0), softKnee?: number (0.5), intensity?: number (0.8), radius?: number (4), iterations?: number (5), tint?: {r,g,b} (1,1,1), anamorphic?: number (1) }',
      },
      toneMapping: {
        type: 'string',
        enum: ['none', 'reinhard', 'aces'],
        description: 'Tone mapping operator to apply',
      },
      exposure: {
        type: 'number',
        description: 'Exposure value for tone mapping (default: 1.0)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executebloomeffect(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, settings, toneMapping, exposure } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'info': {
        result = {
          tool: 'bloom_effect',
          description: 'HDR bloom post-processing with physically-based light scattering',
          algorithms: {
            brightnessExtraction: {
              description: 'Extract pixels above brightness threshold',
              methods: ['hard_threshold', 'soft_knee'],
              parameters: ['threshold', 'softKnee'],
            },
            gaussianBlur: {
              description: 'Separable Gaussian blur with configurable kernel',
              features: ['separable_kernel', 'anamorphic_stretch'],
              complexity: 'O(n * kernel_size)',
            },
            kawaseBlur: {
              description: 'Fast approximate blur using corner sampling',
              features: ['gpu_friendly', 'progressive_offsets'],
              complexity: 'O(n * iterations)',
            },
            dualFiltering: {
              description: 'Pyramid-based blur with down/upsample chain',
              features: ['mip_chain', 'quality_vs_performance'],
              complexity: 'O(n * log(size))',
            },
            lensEffects: {
              description: 'Post-process lens simulation',
              features: ['dirt_mask', 'procedural_noise', 'color_tint'],
            },
            toneMapping: {
              description: 'HDR to LDR conversion',
              operators: ['reinhard', 'aces_filmic'],
            },
          },
          operations: [
            'extract_bright',
            'blur_gaussian',
            'blur_kawase',
            'blur_dual',
            'apply_dirt',
            'composite',
            'tone_map',
            'full_pipeline',
            'demo',
            'info',
            'examples',
          ],
        };
        break;
      }

      case 'examples': {
        result = {
          examples: [
            {
              name: 'Basic bloom',
              operation: 'full_pipeline',
              settings: { threshold: 1.0, intensity: 0.8, radius: 4 },
              description: 'Apply standard bloom to HDR image',
            },
            {
              name: 'Soft dreamy bloom',
              operation: 'full_pipeline',
              settings: { threshold: 0.7, softKnee: 0.8, intensity: 1.2, radius: 8 },
              description: 'Soft, dreamy bloom effect',
            },
            {
              name: 'Anamorphic flare',
              operation: 'full_pipeline',
              settings: { threshold: 1.2, intensity: 0.6, radius: 4, anamorphic: 2.5 },
              description: 'Cinematic anamorphic bloom streaks',
            },
            {
              name: 'Lens dirt effect',
              operation: 'full_pipeline',
              settings: { threshold: 1.0, intensity: 0.8, dirtMask: 'procedural' },
              description: 'Bloom with lens dirt overlay',
            },
            {
              name: 'Warm tinted bloom',
              operation: 'full_pipeline',
              settings: { threshold: 1.0, intensity: 0.8, tint: { r: 1.0, g: 0.9, b: 0.7 } },
              description: 'Bloom with warm color tint',
            },
          ],
        };
        break;
      }

      case 'demo': {
        const demo = BloomEffectProcessor.demo();
        result = {
          description: demo.description,
          inputSize: { width: demo.inputScene[0]?.length || 0, height: demo.inputScene.length },
          settings: demo.pipeline.settings,
          mipLevels: demo.pipeline.mipChain.length,
          sampleOutput: {
            center: demo.bloomResult[16]?.[16] || null,
            lightSource: demo.bloomResult[16]?.[16] || null,
            edge: demo.bloomResult[0]?.[0] || null,
          },
          message: 'Demo processed successfully with HDR light sources and bloom effect',
        };
        break;
      }

      case 'extract_bright': {
        if (!image || !Array.isArray(image)) {
          throw new Error('Image array required for extraction');
        }

        const threshold = settings?.threshold ?? 1.0;
        const softKnee = settings?.softKnee ?? 0.5;
        const height = image.length;
        const width = image[0]?.length || 0;

        const brightPass = BrightnessExtractor.extract(image, width, height, threshold, softKnee);

        // Count pixels above threshold
        let brightPixelCount = 0;
        let maxLuminance = 0;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (brightPass[y][x].luminance > 0) {
              brightPixelCount++;
            }
            maxLuminance = Math.max(maxLuminance, brightPass[y][x].luminance);
          }
        }

        result = {
          operation: 'extract_bright',
          inputSize: { width, height },
          threshold,
          softKnee,
          brightPixelCount,
          brightPercentage: ((brightPixelCount / (width * height)) * 100).toFixed(2) + '%',
          maxLuminance,
          brightPass:
            brightPass.length <= 16
              ? brightPass
              : 'Output truncated (use smaller image for full output)',
        };
        break;
      }

      case 'blur_gaussian': {
        if (!image || !Array.isArray(image)) {
          throw new Error('Image array required for blur');
        }

        const radius = settings?.radius ?? 4;
        const anamorphic = settings?.anamorphic ?? 1;
        const height = image.length;
        const width = image[0]?.length || 0;

        // Convert to HDRPixel format if needed
        const hdrImage: HDRPixel[][] = image.map((row) =>
          row.map((p: { r: number; g: number; b: number }) => ({
            ...p,
            luminance: BrightnessExtractor.luminance(p.r, p.g, p.b),
          }))
        );

        const kernel = GaussianBlur.generateKernel(radius);
        const blurred = GaussianBlur.blur(hdrImage, width, height, radius, anamorphic);

        result = {
          operation: 'blur_gaussian',
          inputSize: { width, height },
          radius,
          anamorphic,
          kernelSize: kernel.length,
          blurred: blurred.length <= 16 ? blurred : 'Output truncated',
        };
        break;
      }

      case 'blur_kawase': {
        if (!image || !Array.isArray(image)) {
          throw new Error('Image array required for blur');
        }

        const iterations = settings?.iterations ?? 5;
        const height = image.length;
        const width = image[0]?.length || 0;

        const hdrImage: HDRPixel[][] = image.map((row) =>
          row.map((p: { r: number; g: number; b: number }) => ({
            ...p,
            luminance: BrightnessExtractor.luminance(p.r, p.g, p.b),
          }))
        );

        const blurred = KawaseBlur.blur(hdrImage, width, height, iterations);

        result = {
          operation: 'blur_kawase',
          inputSize: { width, height },
          iterations,
          description: 'Fast approximation using corner sampling',
          blurred: blurred.length <= 16 ? blurred : 'Output truncated',
        };
        break;
      }

      case 'blur_dual': {
        if (!image || !Array.isArray(image)) {
          throw new Error('Image array required for blur');
        }

        const iterations = settings?.iterations ?? 5;
        const height = image.length;
        const width = image[0]?.length || 0;

        const hdrImage: HDRPixel[][] = image.map((row) =>
          row.map((p: { r: number; g: number; b: number }) => ({
            ...p,
            luminance: BrightnessExtractor.luminance(p.r, p.g, p.b),
          }))
        );

        const mipChain = DualFilterBloom.buildPyramid(hdrImage, width, height, iterations);

        result = {
          operation: 'blur_dual',
          inputSize: { width, height },
          mipLevels: mipChain.length,
          mipSizes: mipChain.map((m) => ({ width: m.width, height: m.height })),
          description: 'Pyramid-based blur with down/upsample chain',
        };
        break;
      }

      case 'apply_dirt': {
        if (!image || !Array.isArray(image)) {
          throw new Error('Image array required');
        }

        const density = settings?.dirtDensity ?? 0.5;
        const height = image.length;
        const width = image[0]?.length || 0;

        const hdrImage: HDRPixel[][] = image.map((row) =>
          row.map((p: { r: number; g: number; b: number }) => ({
            ...p,
            luminance: BrightnessExtractor.luminance(p.r, p.g, p.b),
          }))
        );

        const dirtMask = LensEffects.generateDirtMask(width, height, density);
        const withDirt = LensEffects.applyDirtMask(hdrImage, width, height, dirtMask);

        result = {
          operation: 'apply_dirt',
          inputSize: { width, height },
          dirtDensity: density,
          dirtMaskSample: dirtMask.slice(0, 4).map((row) => row.slice(0, 4)),
          withDirt: withDirt.length <= 8 ? withDirt : 'Output truncated',
        };
        break;
      }

      case 'composite': {
        if (!image || !args.bloom) {
          throw new Error('Both original image and bloom required');
        }

        const intensity = settings?.intensity ?? 0.8;
        const height = image.length;
        const width = image[0]?.length || 0;

        const combined = BloomCompositor.combine(image, args.bloom, width, height, intensity);

        result = {
          operation: 'composite',
          inputSize: { width, height },
          intensity,
          combined: combined.length <= 16 ? combined : 'Output truncated',
        };
        break;
      }

      case 'tone_map': {
        if (!image || !Array.isArray(image)) {
          throw new Error('Image array required');
        }

        const hdrImage: HDRPixel[][] = image.map((row) =>
          row.map((p: { r: number; g: number; b: number }) => ({
            ...p,
            luminance: BrightnessExtractor.luminance(p.r, p.g, p.b),
          }))
        );

        const exp = exposure ?? 1.0;
        let mapped: HDRPixel[][];

        switch (toneMapping) {
          case 'aces':
            mapped = BloomCompositor.toneMapACES(hdrImage);
            break;
          case 'reinhard':
          default:
            mapped = BloomCompositor.toneMapReinhard(hdrImage, exp);
        }

        result = {
          operation: 'tone_map',
          inputSize: { width: image[0]?.length || 0, height: image.length },
          operator: toneMapping || 'reinhard',
          exposure: exp,
          mapped: mapped.length <= 16 ? mapped : 'Output truncated',
        };
        break;
      }

      case 'full_pipeline': {
        if (!image || !Array.isArray(image)) {
          throw new Error('Image array required');
        }

        const bloomSettings: BloomSettings = {
          threshold: settings?.threshold ?? 1.0,
          softKnee: settings?.softKnee ?? 0.5,
          intensity: settings?.intensity ?? 0.8,
          radius: settings?.radius ?? 4,
          iterations: settings?.iterations ?? 5,
          tint: settings?.tint ?? { r: 1, g: 1, b: 1 },
          anamorphic: settings?.anamorphic ?? 1.0,
        };

        const pipeline = BloomEffectProcessor.process(image, bloomSettings);

        // Optionally tone map
        let finalOutput = pipeline.combinedResult || [];
        if (toneMapping && toneMapping !== 'none') {
          finalOutput =
            toneMapping === 'aces'
              ? BloomCompositor.toneMapACES(finalOutput)
              : BloomCompositor.toneMapReinhard(finalOutput, exposure ?? 1.0);
        }

        result = {
          operation: 'full_pipeline',
          inputSize: { width: pipeline.inputWidth, height: pipeline.inputHeight },
          settings: bloomSettings,
          mipLevels: pipeline.mipChain.length,
          toneMapping: toneMapping || 'none',
          output: finalOutput.length <= 16 ? finalOutput : 'Output truncated (use smaller image)',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${error}`, isError: true };
  }
}

export function isbloomeffectAvailable(): boolean {
  return true;
}
