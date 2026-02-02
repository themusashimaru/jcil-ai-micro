/**
 * DOF-EFFECT TOOL
 * Depth of Field effect simulation with physically-based optics
 *
 * Implements:
 * - Circle of Confusion (CoC) calculation
 * - Bokeh shape simulation (circular, hexagonal, anamorphic)
 * - Gaussian and disk blur kernels
 * - Focal plane definition
 * - Near/far blur control
 * - Depth-based blur intensity mapping
 * - Bokeh highlights and cat's eye effect
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RGBPixel {
  r: number;
  g: number;
  b: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DepthPixel extends RGBPixel {
  depth: number;  // 0 = near, 1 = far
}

interface DOFSettings {
  focalDistance: number;      // Focus distance (0-1 in normalized depth)
  focalLength: number;        // Lens focal length in mm (for CoC calculation)
  aperture: number;           // f-stop (f/1.4, f/2.8, etc.)
  sensorSize: number;         // Sensor width in mm (36 for full frame)
  nearBlurMax: number;        // Maximum blur for near objects (pixels)
  farBlurMax: number;         // Maximum blur for far objects (pixels)
  bokehShape: 'circular' | 'hexagonal' | 'octagonal' | 'anamorphic';
  bokehRotation: number;      // Rotation of bokeh shape (degrees)
  bokehHighlightThreshold: number;  // Brightness threshold for bokeh highlights
  bokehHighlightGain: number;       // Intensity boost for highlights
  catEyeStrength: number;     // Cat's eye vignetting effect (0-1)
}

interface BokehKernel {
  size: number;
  weights: number[][];
  shape: string;
}

interface DOFResult {
  width: number;
  height: number;
  blurredImage: RGBPixel[][];
  cocMap: number[][];  // Circle of confusion per pixel
}

// ============================================================================
// CIRCLE OF CONFUSION CALCULATION
// ============================================================================

class CircleOfConfusion {
  /**
   * Calculate CoC based on thin lens equation
   * CoC = |A * f * (S - D)| / (D * (S - f))
   * Where:
   * - A = aperture diameter
   * - f = focal length
   * - S = subject distance
   * - D = focus distance
   */
  static calculate(
    depth: number,
    focalDistance: number,
    focalLength: number,
    aperture: number,
    sensorSize: number
  ): number {
    // Convert normalized depth to approximate world distance
    // Using exponential mapping for more realistic depth perception
    const minDist = focalLength * 2;  // Minimum focus distance (2x focal length)
    const maxDist = 10000;  // Maximum distance (10m = infinity for practical purposes)

    const subjectDistance = minDist + Math.pow(depth, 2) * (maxDist - minDist);
    const focusDistance = minDist + Math.pow(focalDistance, 2) * (maxDist - minDist);

    // Aperture diameter in mm
    const apertureDiameter = focalLength / aperture;

    // Calculate CoC using thin lens formula
    const numerator = Math.abs(apertureDiameter * focalLength * (subjectDistance - focusDistance));
    const denominator = focusDistance * (subjectDistance - focalLength);

    if (denominator === 0) return 0;

    // CoC in mm, convert to fraction of sensor width
    const cocMM = numerator / denominator;
    const cocNormalized = cocMM / sensorSize;

    return cocNormalized;
  }

  /**
   * Calculate blur radius from CoC for given image dimensions
   */
  static cocToBlurRadius(
    coc: number,
    imageWidth: number,
    maxBlur: number
  ): number {
    const blurPixels = coc * imageWidth;
    return Math.min(blurPixels, maxBlur);
  }

  /**
   * Generate CoC map for depth buffer
   */
  static generateCoCMap(
    depthBuffer: number[][],
    settings: DOFSettings
  ): number[][] {
    const height = depthBuffer.length;
    const width = depthBuffer[0]?.length || 0;
    const cocMap: number[][] = [];

    for (let y = 0; y < height; y++) {
      cocMap[y] = [];
      for (let x = 0; x < width; x++) {
        const depth = depthBuffer[y][x];
        const coc = this.calculate(
          depth,
          settings.focalDistance,
          settings.focalLength,
          settings.aperture,
          settings.sensorSize
        );

        // Determine if near or far blur
        const isFar = depth > settings.focalDistance;
        const maxBlur = isFar ? settings.farBlurMax : settings.nearBlurMax;

        cocMap[y][x] = this.cocToBlurRadius(coc, width, maxBlur);
      }
    }

    return cocMap;
  }
}

// ============================================================================
// BOKEH KERNEL GENERATION
// ============================================================================

class BokehKernelGenerator {
  /**
   * Generate circular bokeh kernel (perfect circle)
   */
  static circular(radius: number): BokehKernel {
    const size = Math.ceil(radius) * 2 + 1;
    const center = Math.floor(size / 2);
    const weights: number[][] = [];
    let totalWeight = 0;

    for (let y = 0; y < size; y++) {
      weights[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Sharp circular cutoff with slight feathering
        if (dist <= radius) {
          const feather = dist > radius - 1 ? (radius - dist) : 1;
          weights[y][x] = feather;
          totalWeight += feather;
        } else {
          weights[y][x] = 0;
        }
      }
    }

    // Normalize
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        weights[y][x] /= totalWeight;
      }
    }

    return { size, weights, shape: 'circular' };
  }

  /**
   * Generate hexagonal bokeh kernel (6-bladed aperture)
   */
  static hexagonal(radius: number, rotation: number = 0): BokehKernel {
    const size = Math.ceil(radius) * 2 + 1;
    const center = Math.floor(size / 2);
    const weights: number[][] = [];
    let totalWeight = 0;

    const rotRad = rotation * Math.PI / 180;
    const sides = 6;

    for (let y = 0; y < size; y++) {
      weights[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + rotRad;

        // Hexagon distance calculation
        const sectorAngle = (2 * Math.PI) / sides;
        const sectorIndex = Math.floor((angle + Math.PI) / sectorAngle);
        const localAngle = (angle + Math.PI) - sectorIndex * sectorAngle - sectorAngle / 2;
        const hexRadius = radius / Math.cos(localAngle);

        if (dist <= hexRadius) {
          const feather = dist > hexRadius - 1 ? (hexRadius - dist) : 1;
          weights[y][x] = Math.max(0, feather);
          totalWeight += weights[y][x];
        } else {
          weights[y][x] = 0;
        }
      }
    }

    // Normalize
    if (totalWeight > 0) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          weights[y][x] /= totalWeight;
        }
      }
    }

    return { size, weights, shape: 'hexagonal' };
  }

  /**
   * Generate octagonal bokeh kernel (8-bladed aperture)
   */
  static octagonal(radius: number, rotation: number = 0): BokehKernel {
    const size = Math.ceil(radius) * 2 + 1;
    const center = Math.floor(size / 2);
    const weights: number[][] = [];
    let totalWeight = 0;

    const rotRad = rotation * Math.PI / 180;
    const sides = 8;

    for (let y = 0; y < size; y++) {
      weights[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + rotRad;

        const sectorAngle = (2 * Math.PI) / sides;
        const sectorIndex = Math.floor((angle + Math.PI) / sectorAngle);
        const localAngle = (angle + Math.PI) - sectorIndex * sectorAngle - sectorAngle / 2;
        const octRadius = radius / Math.cos(localAngle);

        if (dist <= octRadius) {
          const feather = dist > octRadius - 1 ? (octRadius - dist) : 1;
          weights[y][x] = Math.max(0, feather);
          totalWeight += weights[y][x];
        } else {
          weights[y][x] = 0;
        }
      }
    }

    if (totalWeight > 0) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          weights[y][x] /= totalWeight;
        }
      }
    }

    return { size, weights, shape: 'octagonal' };
  }

  /**
   * Generate anamorphic bokeh (oval/stretched)
   */
  static anamorphic(radius: number, squeeze: number = 2, rotation: number = 0): BokehKernel {
    const sizeX = Math.ceil(radius * squeeze) * 2 + 1;
    const sizeY = Math.ceil(radius) * 2 + 1;
    const size = Math.max(sizeX, sizeY);
    const centerX = Math.floor(size / 2);
    const centerY = Math.floor(size / 2);
    const weights: number[][] = [];
    let totalWeight = 0;

    const rotRad = rotation * Math.PI / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    for (let y = 0; y < size; y++) {
      weights[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - centerX;
        const dy = y - centerY;

        // Rotate
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        // Ellipse equation: (rx/a)^2 + (ry/b)^2 <= 1
        const a = radius * squeeze;
        const b = radius;
        const ellipseDist = (rx * rx) / (a * a) + (ry * ry) / (b * b);

        if (ellipseDist <= 1) {
          const feather = ellipseDist > 0.8 ? (1 - ellipseDist) / 0.2 : 1;
          weights[y][x] = Math.max(0, feather);
          totalWeight += weights[y][x];
        } else {
          weights[y][x] = 0;
        }
      }
    }

    if (totalWeight > 0) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          weights[y][x] /= totalWeight;
        }
      }
    }

    return { size, weights, shape: 'anamorphic' };
  }

  /**
   * Generate kernel based on settings
   */
  static generate(radius: number, settings: DOFSettings): BokehKernel {
    if (radius < 1) {
      return { size: 1, weights: [[1]], shape: 'point' };
    }

    switch (settings.bokehShape) {
      case 'hexagonal':
        return this.hexagonal(radius, settings.bokehRotation);
      case 'octagonal':
        return this.octagonal(radius, settings.bokehRotation);
      case 'anamorphic':
        return this.anamorphic(radius, 2, settings.bokehRotation);
      case 'circular':
      default:
        return this.circular(radius);
    }
  }
}

// ============================================================================
// CAT'S EYE EFFECT
// ============================================================================

class CatEyeEffect {
  /**
   * Apply cat's eye vignetting to kernel
   * Bokeh shapes become more oval/clipped toward image edges
   */
  static apply(
    kernel: BokehKernel,
    pixelX: number,
    pixelY: number,
    imageWidth: number,
    imageHeight: number,
    strength: number
  ): BokehKernel {
    if (strength === 0) return kernel;

    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;

    // Distance from image center (normalized 0-1)
    const dx = (pixelX - centerX) / centerX;
    const dy = (pixelY - centerY) / centerY;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    // Cat's eye effect increases toward edges
    const catEyeAmount = distFromCenter * strength;
    if (catEyeAmount < 0.01) return kernel;

    // Direction toward center (for clipping)
    const angle = Math.atan2(-dy, -dx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const newWeights: number[][] = [];
    let totalWeight = 0;
    const kCenter = Math.floor(kernel.size / 2);

    for (let y = 0; y < kernel.size; y++) {
      newWeights[y] = [];
      for (let x = 0; x < kernel.size; x++) {
        const kx = x - kCenter;
        const ky = y - kCenter;

        // Project onto direction toward center
        const projection = kx * cos + ky * sin;

        // Clip based on projection (simulate aperture vignetting)
        const clipFactor = projection > 0
          ? Math.max(0, 1 - projection * catEyeAmount * 0.3)
          : 1;

        newWeights[y][x] = kernel.weights[y][x] * clipFactor;
        totalWeight += newWeights[y][x];
      }
    }

    // Normalize
    if (totalWeight > 0) {
      for (let y = 0; y < kernel.size; y++) {
        for (let x = 0; x < kernel.size; x++) {
          newWeights[y][x] /= totalWeight;
        }
      }
    }

    return { size: kernel.size, weights: newWeights, shape: kernel.shape + '_cateye' };
  }
}

// ============================================================================
// BOKEH HIGHLIGHT PROCESSING
// ============================================================================

class BokehHighlights {
  /**
   * Apply highlight boost for bright areas
   * Creates characteristic bright bokeh circles
   */
  static process(
    pixel: RGBPixel,
    threshold: number,
    gain: number
  ): RGBPixel {
    const luminance = 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;

    if (luminance > threshold) {
      const boost = 1 + (luminance - threshold) * gain;
      return {
        r: Math.min(1, pixel.r * boost),
        g: Math.min(1, pixel.g * boost),
        b: Math.min(1, pixel.b * boost)
      };
    }

    return pixel;
  }
}

// ============================================================================
// DEPTH OF FIELD PROCESSOR
// ============================================================================

class DOFProcessor {
  /**
   * Apply DOF blur to single pixel using gather approach
   */
  static blurPixelGather(
    image: RGBPixel[][],
    depthBuffer: number[][],
    cocMap: number[][],
    x: number,
    y: number,
    settings: DOFSettings
  ): RGBPixel {
    const height = image.length;
    const width = image[0]?.length || 0;
    const centerCOC = cocMap[y][x];
    const centerDepth = depthBuffer[y][x];

    if (centerCOC < 0.5) {
      return image[y][x];
    }

    // Generate kernel for this pixel's COC
    let kernel = BokehKernelGenerator.generate(centerCOC, settings);

    // Apply cat's eye effect
    kernel = CatEyeEffect.apply(
      kernel,
      x, y,
      width, height,
      settings.catEyeStrength
    );

    const halfSize = Math.floor(kernel.size / 2);
    let r = 0, g = 0, b = 0;
    let totalWeight = 0;

    for (let ky = -halfSize; ky <= halfSize; ky++) {
      for (let kx = -halfSize; kx <= halfSize; kx++) {
        const sampleX = Math.min(Math.max(x + kx, 0), width - 1);
        const sampleY = Math.min(Math.max(y + ky, 0), height - 1);

        const sampleDepth = depthBuffer[sampleY][sampleX];
        const sampleCOC = cocMap[sampleY][sampleX];
        const kernelWeight = kernel.weights[ky + halfSize]?.[kx + halfSize] || 0;

        // Depth-aware weighting
        // Objects in front can blur into background, but not vice versa
        let weight = kernelWeight;

        if (sampleDepth < centerDepth) {
          // Sample is in front - use sample's COC to determine contribution
          const sampleKernelRadius = sampleCOC;
          const dist = Math.sqrt(kx * kx + ky * ky);
          if (dist > sampleKernelRadius) {
            weight *= 0.1;  // Greatly reduce contribution from far foreground
          }
        }

        if (weight > 0) {
          let pixel = image[sampleY][sampleX];

          // Apply bokeh highlight boost
          pixel = BokehHighlights.process(
            pixel,
            settings.bokehHighlightThreshold,
            settings.bokehHighlightGain
          );

          r += pixel.r * weight;
          g += pixel.g * weight;
          b += pixel.b * weight;
          totalWeight += weight;
        }
      }
    }

    if (totalWeight > 0) {
      return {
        r: r / totalWeight,
        g: g / totalWeight,
        b: b / totalWeight
      };
    }

    return image[y][x];
  }

  /**
   * Process full image with DOF effect
   */
  static process(
    image: RGBPixel[][],
    depthBuffer: number[][],
    settings: DOFSettings
  ): DOFResult {
    const height = image.length;
    const width = image[0]?.length || 0;

    // Generate CoC map
    const cocMap = CircleOfConfusion.generateCoCMap(depthBuffer, settings);

    // Apply blur
    const blurredImage: RGBPixel[][] = [];

    for (let y = 0; y < height; y++) {
      blurredImage[y] = [];
      for (let x = 0; x < width; x++) {
        blurredImage[y][x] = this.blurPixelGather(
          image,
          depthBuffer,
          cocMap,
          x, y,
          settings
        );
      }
    }

    return {
      width,
      height,
      blurredImage,
      cocMap
    };
  }

  /**
   * Fast approximation using separable blur
   */
  static processFast(
    image: RGBPixel[][],
    depthBuffer: number[][],
    settings: DOFSettings
  ): DOFResult {
    const height = image.length;
    const width = image[0]?.length || 0;

    // Generate CoC map
    const cocMap = CircleOfConfusion.generateCoCMap(depthBuffer, settings);

    // Two-pass separable blur (approximation)
    // First pass: horizontal
    const horizontalBlur: RGBPixel[][] = [];

    for (let y = 0; y < height; y++) {
      horizontalBlur[y] = [];
      for (let x = 0; x < width; x++) {
        const coc = cocMap[y][x];
        if (coc < 0.5) {
          horizontalBlur[y][x] = image[y][x];
          continue;
        }

        const radius = Math.ceil(coc);
        let r = 0, g = 0, b = 0, w = 0;

        for (let kx = -radius; kx <= radius; kx++) {
          const sampleX = Math.min(Math.max(x + kx, 0), width - 1);
          const dist = Math.abs(kx) / coc;
          const weight = dist <= 1 ? (1 - dist * dist) : 0;

          if (weight > 0) {
            r += image[y][sampleX].r * weight;
            g += image[y][sampleX].g * weight;
            b += image[y][sampleX].b * weight;
            w += weight;
          }
        }

        horizontalBlur[y][x] = w > 0
          ? { r: r / w, g: g / w, b: b / w }
          : image[y][x];
      }
    }

    // Second pass: vertical
    const blurredImage: RGBPixel[][] = [];

    for (let y = 0; y < height; y++) {
      blurredImage[y] = [];
      for (let x = 0; x < width; x++) {
        const coc = cocMap[y][x];
        if (coc < 0.5) {
          blurredImage[y][x] = horizontalBlur[y][x];
          continue;
        }

        const radius = Math.ceil(coc);
        let r = 0, g = 0, b = 0, w = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          const sampleY = Math.min(Math.max(y + ky, 0), height - 1);
          const dist = Math.abs(ky) / coc;
          const weight = dist <= 1 ? (1 - dist * dist) : 0;

          if (weight > 0) {
            r += horizontalBlur[sampleY][x].r * weight;
            g += horizontalBlur[sampleY][x].g * weight;
            b += horizontalBlur[sampleY][x].b * weight;
            w += weight;
          }
        }

        blurredImage[y][x] = w > 0
          ? { r: r / w, g: g / w, b: b / w }
          : horizontalBlur[y][x];
      }
    }

    return {
      width,
      height,
      blurredImage,
      cocMap
    };
  }

  /**
   * Create demo scene with depth
   */
  static createDemoScene(): { image: RGBPixel[][]; depth: number[][] } {
    const width = 32;
    const height = 32;
    const image: RGBPixel[][] = [];
    const depth: number[][] = [];

    for (let y = 0; y < height; y++) {
      image[y] = [];
      depth[y] = [];
      for (let x = 0; x < width; x++) {
        // Gradient depth (far at top, near at bottom)
        depth[y][x] = y / height;

        // Create some objects at different depths
        const cx1 = width * 0.3, cy1 = height * 0.3;  // Near object
        const cx2 = width * 0.5, cy2 = height * 0.5;  // Mid object (in focus)
        const cx3 = width * 0.7, cy3 = height * 0.7;  // Far object

        const dist1 = Math.sqrt((x - cx1) ** 2 + (y - cy1) ** 2);
        const dist2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2);
        const dist3 = Math.sqrt((x - cx3) ** 2 + (y - cy3) ** 2);

        if (dist1 < 4) {
          // Near red object
          image[y][x] = { r: 0.9, g: 0.2, b: 0.2 };
          depth[y][x] = 0.2;
        } else if (dist2 < 4) {
          // Mid green object (in focus)
          image[y][x] = { r: 0.2, g: 0.9, b: 0.2 };
          depth[y][x] = 0.5;
        } else if (dist3 < 4) {
          // Far blue object
          image[y][x] = { r: 0.2, g: 0.2, b: 0.9 };
          depth[y][x] = 0.8;
        } else {
          // Background gradient
          image[y][x] = {
            r: 0.3 + depth[y][x] * 0.2,
            g: 0.3 + depth[y][x] * 0.1,
            b: 0.4 + depth[y][x] * 0.3
          };
        }

        // Add some bright highlights for bokeh
        if ((x === 10 && y === 5) || (x === 25 && y === 28)) {
          image[y][x] = { r: 1.0, g: 1.0, b: 0.9 };
        }
      }
    }

    return { image, depth };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const dofeffectTool: UnifiedTool = {
  name: 'dof_effect',
  description: 'Depth of Field effect simulation with physically-based optics. Supports Circle of Confusion calculation, various bokeh shapes (circular, hexagonal, anamorphic), highlight bloom, and cat\'s eye vignetting.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['apply', 'apply_fast', 'calculate_coc', 'generate_kernel', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      image: {
        type: 'array',
        description: 'Input image as 2D array of {r, g, b} pixels'
      },
      depthBuffer: {
        type: 'array',
        description: 'Depth buffer as 2D array of values 0-1 (0=near, 1=far)'
      },
      settings: {
        type: 'object',
        properties: {
          focalDistance: { type: 'number', description: 'Focus distance (0-1, default: 0.5)' },
          focalLength: { type: 'number', description: 'Lens focal length in mm (default: 50)' },
          aperture: { type: 'number', description: 'f-stop (default: 2.8)' },
          sensorSize: { type: 'number', description: 'Sensor width in mm (default: 36)' },
          nearBlurMax: { type: 'number', description: 'Max near blur radius (default: 15)' },
          farBlurMax: { type: 'number', description: 'Max far blur radius (default: 20)' },
          bokehShape: { type: 'string', enum: ['circular', 'hexagonal', 'octagonal', 'anamorphic'] },
          bokehRotation: { type: 'number', description: 'Bokeh rotation in degrees' },
          bokehHighlightThreshold: { type: 'number', description: 'Highlight threshold (0-1)' },
          bokehHighlightGain: { type: 'number', description: 'Highlight intensity boost' },
          catEyeStrength: { type: 'number', description: 'Cat\'s eye effect (0-1)' }
        },
        description: 'DOF settings'
      },
      depth: {
        type: 'number',
        description: 'Single depth value for CoC calculation'
      },
      radius: {
        type: 'number',
        description: 'Kernel radius for generation'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executedofeffect(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, depthBuffer, settings, depth, radius } = args;

    // Default settings
    const dofSettings: DOFSettings = {
      focalDistance: settings?.focalDistance ?? 0.5,
      focalLength: settings?.focalLength ?? 50,
      aperture: settings?.aperture ?? 2.8,
      sensorSize: settings?.sensorSize ?? 36,
      nearBlurMax: settings?.nearBlurMax ?? 15,
      farBlurMax: settings?.farBlurMax ?? 20,
      bokehShape: settings?.bokehShape ?? 'circular',
      bokehRotation: settings?.bokehRotation ?? 0,
      bokehHighlightThreshold: settings?.bokehHighlightThreshold ?? 0.8,
      bokehHighlightGain: settings?.bokehHighlightGain ?? 2,
      catEyeStrength: settings?.catEyeStrength ?? 0.3
    };

    let result: Record<string, unknown>;

    switch (operation) {
      case 'info': {
        result = {
          tool: 'dof_effect',
          description: 'Physically-based depth of field simulation',
          features: {
            cocCalculation: 'Thin lens equation for accurate Circle of Confusion',
            bokehShapes: ['circular', 'hexagonal', 'octagonal', 'anamorphic'],
            effects: ['highlight_bloom', 'cat_eye_vignetting', 'depth_aware_blur'],
            algorithms: ['gather_blur', 'separable_fast_blur']
          },
          parameters: {
            focalDistance: 'Focus distance in normalized depth (0-1)',
            focalLength: 'Lens focal length in mm (affects CoC)',
            aperture: 'f-stop number (lower = more blur)',
            sensorSize: 'Camera sensor width in mm (36 for full frame)',
            bokehShape: 'Shape of out-of-focus highlights',
            catEyeStrength: 'Edge vignetting of bokeh shapes'
          },
          operations: ['apply', 'apply_fast', 'calculate_coc', 'generate_kernel', 'demo', 'info', 'examples']
        };
        break;
      }

      case 'examples': {
        result = {
          examples: [
            {
              name: 'Portrait DOF (shallow)',
              settings: {
                focalDistance: 0.3,
                aperture: 1.4,
                focalLength: 85,
                bokehShape: 'circular'
              },
              description: 'Classic portrait with subject in focus, smooth background blur'
            },
            {
              name: 'Landscape (deep)',
              settings: {
                focalDistance: 0.6,
                aperture: 11,
                focalLength: 24,
                bokehShape: 'octagonal'
              },
              description: 'Landscape with most of scene in focus'
            },
            {
              name: 'Cinematic (anamorphic)',
              settings: {
                focalDistance: 0.4,
                aperture: 2.0,
                focalLength: 50,
                bokehShape: 'anamorphic',
                bokehHighlightGain: 3
              },
              description: 'Cinematic look with oval bokeh and bright highlights'
            },
            {
              name: 'Vintage lens',
              settings: {
                focalDistance: 0.5,
                aperture: 2.8,
                focalLength: 50,
                bokehShape: 'hexagonal',
                catEyeStrength: 0.6,
                bokehRotation: 30
              },
              description: 'Vintage lens look with cat\'s eye effect'
            }
          ]
        };
        break;
      }

      case 'demo': {
        const scene = DOFProcessor.createDemoScene();
        const dofResult = DOFProcessor.processFast(scene.image, scene.depth, dofSettings);

        result = {
          operation: 'demo',
          description: 'DOF demo with three objects at different depths',
          settings: dofSettings,
          sceneSize: { width: dofResult.width, height: dofResult.height },
          objects: {
            near: { color: 'red', depth: 0.2, blur: 'visible' },
            mid: { color: 'green', depth: 0.5, blur: 'in_focus' },
            far: { color: 'blue', depth: 0.8, blur: 'visible' }
          },
          sampleCoC: {
            nearObject: dofResult.cocMap[Math.floor(0.3 * 32)][Math.floor(0.3 * 32)].toFixed(2),
            midObject: dofResult.cocMap[Math.floor(0.5 * 32)][Math.floor(0.5 * 32)].toFixed(2),
            farObject: dofResult.cocMap[Math.floor(0.7 * 32)][Math.floor(0.7 * 32)].toFixed(2)
          },
          sampleOutput: {
            center: dofResult.blurredImage[16]?.[16] || null,
            nearObject: dofResult.blurredImage[Math.floor(0.3 * 32)]?.[Math.floor(0.3 * 32)] || null,
            farObject: dofResult.blurredImage[Math.floor(0.7 * 32)]?.[Math.floor(0.7 * 32)] || null
          },
          message: 'DOF effect applied - mid-distance objects in focus, near/far blurred'
        };
        break;
      }

      case 'apply': {
        if (!image || !depthBuffer) {
          throw new Error('Both image and depthBuffer required');
        }

        const dofResult = DOFProcessor.process(image, depthBuffer, dofSettings);

        result = {
          operation: 'apply',
          inputSize: { width: dofResult.width, height: dofResult.height },
          settings: dofSettings,
          output: dofResult.blurredImage.length <= 16 ? dofResult.blurredImage : 'Output truncated',
          cocMap: dofResult.cocMap.length <= 16 ? dofResult.cocMap : 'CoC map truncated'
        };
        break;
      }

      case 'apply_fast': {
        if (!image || !depthBuffer) {
          throw new Error('Both image and depthBuffer required');
        }

        const dofResult = DOFProcessor.processFast(image, depthBuffer, dofSettings);

        result = {
          operation: 'apply_fast',
          inputSize: { width: dofResult.width, height: dofResult.height },
          settings: dofSettings,
          method: 'separable_blur',
          output: dofResult.blurredImage.length <= 16 ? dofResult.blurredImage : 'Output truncated',
          cocMap: dofResult.cocMap.length <= 16 ? dofResult.cocMap : 'CoC map truncated'
        };
        break;
      }

      case 'calculate_coc': {
        if (depth === undefined) {
          throw new Error('Depth value required');
        }

        const coc = CircleOfConfusion.calculate(
          depth,
          dofSettings.focalDistance,
          dofSettings.focalLength,
          dofSettings.aperture,
          dofSettings.sensorSize
        );

        const blurRadius = CircleOfConfusion.cocToBlurRadius(
          coc,
          1920,  // Assume HD resolution
          depth > dofSettings.focalDistance ? dofSettings.farBlurMax : dofSettings.nearBlurMax
        );

        result = {
          operation: 'calculate_coc',
          input: {
            depth,
            focalDistance: dofSettings.focalDistance,
            focalLength: dofSettings.focalLength,
            aperture: dofSettings.aperture,
            sensorSize: dofSettings.sensorSize
          },
          cocNormalized: coc,
          blurRadiusAt1080p: blurRadius.toFixed(2),
          inFocus: coc < 0.001,
          position: depth < dofSettings.focalDistance ? 'foreground' : 'background'
        };
        break;
      }

      case 'generate_kernel': {
        const kernelRadius = radius || 10;
        const kernel = BokehKernelGenerator.generate(kernelRadius, dofSettings);

        // Create visualization
        const visualization = kernel.weights.map(row =>
          row.map(w => w > 0.001 ? (w > 0.01 ? '#' : '.') : ' ').join('')
        ).join('\n');

        result = {
          operation: 'generate_kernel',
          shape: dofSettings.bokehShape,
          radius: kernelRadius,
          rotation: dofSettings.bokehRotation,
          kernelSize: kernel.size,
          nonZeroElements: kernel.weights.flat().filter(w => w > 0).length,
          visualization,
          weights: kernel.size <= 15 ? kernel.weights : 'Weights truncated (kernel too large)'
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

export function isdofeffectAvailable(): boolean {
  return true;
}
