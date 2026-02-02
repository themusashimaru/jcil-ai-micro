/**
 * HARRIS-CORNERS TOOL
 * Harris corner detection algorithm with sub-pixel refinement
 *
 * Features:
 * - Harris corner response calculation
 * - Sobel gradients for image derivatives
 * - Non-maximum suppression
 * - Adaptive thresholding
 * - Sub-pixel corner refinement
 * - Shi-Tomasi modification
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GrayscaleImage {
  width: number;
  height: number;
  data: number[][]; // 2D array of pixel values [0-255]
}

interface Corner {
  x: number;
  y: number;
  response: number;
  subPixelX?: number;
  subPixelY?: number;
  angle?: number;
}

interface HarrisParams {
  k?: number;           // Harris sensitivity parameter (default: 0.04)
  windowSize?: number;  // Window size for gradient summation (default: 3)
  threshold?: number;   // Response threshold (default: auto)
  nmsRadius?: number;   // Non-maximum suppression radius (default: 3)
  maxCorners?: number;  // Maximum number of corners to return
  subPixel?: boolean;   // Enable sub-pixel refinement
  method?: 'harris' | 'shi-tomasi' | 'harmonic-mean';
}

interface GradientImage {
  Ix: number[][];
  Iy: number[][];
}

interface StructureTensor {
  Ixx: number[][];
  Iyy: number[][];
  Ixy: number[][];
}

// ============================================================================
// IMAGE PROCESSING UTILITIES
// ============================================================================

/**
 * Create a Gaussian kernel
 */
function createGaussianKernel(size: number, sigma: number): number[][] {
  const kernel: number[][] = [];
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = value;
      sum += value;
    }
  }

  // Normalize
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
}

/**
 * Convolve image with kernel
 */
function convolve2D(image: number[][], kernel: number[][]): number[][] {
  const height = image.length;
  const width = image[0].length;
  const kSize = kernel.length;
  const kCenter = Math.floor(kSize / 2);
  const result: number[][] = [];

  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const iy = Math.min(Math.max(y + ky - kCenter, 0), height - 1);
          const ix = Math.min(Math.max(x + kx - kCenter, 0), width - 1);
          sum += image[iy][ix] * kernel[ky][kx];
        }
      }
      result[y][x] = sum;
    }
  }

  return result;
}

/**
 * Apply Sobel operator for gradient computation
 */
function computeSobelGradients(image: number[][]): GradientImage {
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ];

  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ];

  return {
    Ix: convolve2D(image, sobelX),
    Iy: convolve2D(image, sobelY)
  };
}

/**
 * Compute Scharr gradients (more accurate than Sobel)
 */
function computeScharrGradients(image: number[][]): GradientImage {
  const scharrX = [
    [-3, 0, 3],
    [-10, 0, 10],
    [-3, 0, 3]
  ];

  const scharrY = [
    [-3, -10, -3],
    [0, 0, 0],
    [3, 10, 3]
  ];

  return {
    Ix: convolve2D(image, scharrX),
    Iy: convolve2D(image, scharrY)
  };
}

/**
 * Compute structure tensor components
 */
function computeStructureTensor(gradients: GradientImage, windowSize: number): StructureTensor {
  const height = gradients.Ix.length;
  const width = gradients.Ix[0].length;

  // Compute gradient products
  const IxIx: number[][] = [];
  const IyIy: number[][] = [];
  const IxIy: number[][] = [];

  for (let y = 0; y < height; y++) {
    IxIx[y] = [];
    IyIy[y] = [];
    IxIy[y] = [];
    for (let x = 0; x < width; x++) {
      IxIx[y][x] = gradients.Ix[y][x] * gradients.Ix[y][x];
      IyIy[y][x] = gradients.Iy[y][x] * gradients.Iy[y][x];
      IxIy[y][x] = gradients.Ix[y][x] * gradients.Iy[y][x];
    }
  }

  // Apply Gaussian smoothing
  const sigma = windowSize / 6;
  const gaussian = createGaussianKernel(windowSize, sigma);

  return {
    Ixx: convolve2D(IxIx, gaussian),
    Iyy: convolve2D(IyIy, gaussian),
    Ixy: convolve2D(IxIy, gaussian)
  };
}

// ============================================================================
// HARRIS CORNER DETECTION
// ============================================================================

/**
 * Compute Harris corner response
 * R = det(M) - k * trace(M)^2
 * where M is the structure tensor
 */
function computeHarrisResponse(tensor: StructureTensor, k: number): number[][] {
  const height = tensor.Ixx.length;
  const width = tensor.Ixx[0].length;
  const response: number[][] = [];

  for (let y = 0; y < height; y++) {
    response[y] = [];
    for (let x = 0; x < width; x++) {
      const Ixx = tensor.Ixx[y][x];
      const Iyy = tensor.Iyy[y][x];
      const Ixy = tensor.Ixy[y][x];

      // Determinant and trace
      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;

      // Harris response
      response[y][x] = det - k * trace * trace;
    }
  }

  return response;
}

/**
 * Compute Shi-Tomasi corner response
 * R = min(λ1, λ2)
 * More stable than Harris for tracking
 */
function computeShiTomasiResponse(tensor: StructureTensor): number[][] {
  const height = tensor.Ixx.length;
  const width = tensor.Ixx[0].length;
  const response: number[][] = [];

  for (let y = 0; y < height; y++) {
    response[y] = [];
    for (let x = 0; x < width; x++) {
      const Ixx = tensor.Ixx[y][x];
      const Iyy = tensor.Iyy[y][x];
      const Ixy = tensor.Ixy[y][x];

      // Eigenvalues of structure tensor
      const trace = Ixx + Iyy;
      const det = Ixx * Iyy - Ixy * Ixy;
      const discriminant = Math.sqrt(Math.max(0, trace * trace / 4 - det));

      const lambda1 = trace / 2 + discriminant;
      const lambda2 = trace / 2 - discriminant;

      // Minimum eigenvalue
      response[y][x] = Math.min(lambda1, lambda2);
    }
  }

  return response;
}

/**
 * Compute harmonic mean response
 * R = det(M) / trace(M)
 * More robust to noise
 */
function computeHarmonicMeanResponse(tensor: StructureTensor): number[][] {
  const height = tensor.Ixx.length;
  const width = tensor.Ixx[0].length;
  const response: number[][] = [];

  for (let y = 0; y < height; y++) {
    response[y] = [];
    for (let x = 0; x < width; x++) {
      const Ixx = tensor.Ixx[y][x];
      const Iyy = tensor.Iyy[y][x];
      const Ixy = tensor.Ixy[y][x];

      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;

      // Avoid division by zero
      response[y][x] = trace > 1e-10 ? det / trace : 0;
    }
  }

  return response;
}

/**
 * Non-maximum suppression
 */
function nonMaxSuppression(response: number[][], radius: number, threshold: number): Corner[] {
  const height = response.length;
  const width = response[0].length;
  const corners: Corner[] = [];

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const value = response[y][x];

      if (value < threshold) continue;

      // Check if local maximum
      let isMax = true;
      for (let dy = -radius; dy <= radius && isMax; dy++) {
        for (let dx = -radius; dx <= radius && isMax; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (response[y + dy][x + dx] >= value) {
            isMax = false;
          }
        }
      }

      if (isMax) {
        corners.push({ x, y, response: value });
      }
    }
  }

  return corners;
}

/**
 * Adaptive threshold calculation using OTSU-like method
 */
function computeAdaptiveThreshold(response: number[][], percentile: number = 0.99): number {
  const values: number[] = [];

  for (let y = 0; y < response.length; y++) {
    for (let x = 0; x < response[y].length; x++) {
      if (response[y][x] > 0) {
        values.push(response[y][x]);
      }
    }
  }

  if (values.length === 0) return 0;

  values.sort((a, b) => a - b);
  const index = Math.floor(values.length * percentile);
  return values[Math.min(index, values.length - 1)];
}

/**
 * Sub-pixel corner refinement using quadratic fitting
 */
function refineCornerSubPixel(response: number[][], corner: Corner): Corner {
  const { x, y } = corner;

  // Check bounds
  if (x < 1 || x >= response[0].length - 1 || y < 1 || y >= response.length - 1) {
    return { ...corner, subPixelX: x, subPixelY: y };
  }

  // Fit quadratic surface: f(dx, dy) = a*dx^2 + b*dy^2 + c*dx*dy + d*dx + e*dy + f
  // Take partial derivatives and set to zero to find peak

  const f00 = response[y][x];
  const f10 = response[y][x + 1];
  const f01 = response[y + 1][x];
  const fm10 = response[y][x - 1];
  const f0m1 = response[y - 1][x];
  const f11 = response[y + 1][x + 1];
  const fm1m1 = response[y - 1][x - 1];
  const f1m1 = response[y - 1][x + 1];
  const fm11 = response[y + 1][x - 1];

  // Hessian matrix elements
  const dxx = f10 + fm10 - 2 * f00;
  const dyy = f01 + f0m1 - 2 * f00;
  const dxy = (f11 - fm11 - f1m1 + fm1m1) / 4;

  // Gradient
  const dx = (f10 - fm10) / 2;
  const dy = (f01 - f0m1) / 2;

  // Solve 2x2 system: H * offset = -gradient
  const det = dxx * dyy - dxy * dxy;

  if (Math.abs(det) < 1e-10) {
    return { ...corner, subPixelX: x, subPixelY: y };
  }

  const offsetX = -(dyy * dx - dxy * dy) / det;
  const offsetY = -(dxx * dy - dxy * dx) / det;

  // Limit offset to within the pixel
  const clampedOffsetX = Math.max(-0.5, Math.min(0.5, offsetX));
  const clampedOffsetY = Math.max(-0.5, Math.min(0.5, offsetY));

  return {
    ...corner,
    subPixelX: x + clampedOffsetX,
    subPixelY: y + clampedOffsetY
  };
}

/**
 * Compute corner orientation using gradient
 */
function computeCornerOrientation(gradients: GradientImage, corner: Corner, windowSize: number = 5): number {
  const { x, y } = corner;
  const half = Math.floor(windowSize / 2);
  const height = gradients.Ix.length;
  const width = gradients.Ix[0].length;

  let sumGx = 0;
  let sumGy = 0;

  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const iy = Math.min(Math.max(y + dy, 0), height - 1);
      const ix = Math.min(Math.max(x + dx, 0), width - 1);
      sumGx += gradients.Ix[iy][ix];
      sumGy += gradients.Iy[iy][ix];
    }
  }

  return Math.atan2(sumGy, sumGx);
}

// ============================================================================
// MAIN HARRIS CORNER DETECTOR
// ============================================================================

class HarrisCornerDetector {
  private params: Required<HarrisParams>;

  constructor(params: HarrisParams = {}) {
    this.params = {
      k: params.k ?? 0.04,
      windowSize: params.windowSize ?? 3,
      threshold: params.threshold ?? -1, // -1 means auto
      nmsRadius: params.nmsRadius ?? 3,
      maxCorners: params.maxCorners ?? 500,
      subPixel: params.subPixel ?? true,
      method: params.method ?? 'harris'
    };
  }

  /**
   * Detect corners in image
   */
  detect(image: GrayscaleImage): Corner[] {
    // Step 1: Compute gradients
    const gradients = computeSobelGradients(image.data);

    // Step 2: Compute structure tensor
    const tensor = computeStructureTensor(gradients, this.params.windowSize);

    // Step 3: Compute corner response
    let response: number[][];
    switch (this.params.method) {
      case 'shi-tomasi':
        response = computeShiTomasiResponse(tensor);
        break;
      case 'harmonic-mean':
        response = computeHarmonicMeanResponse(tensor);
        break;
      default:
        response = computeHarrisResponse(tensor, this.params.k);
    }

    // Step 4: Determine threshold
    let threshold = this.params.threshold;
    if (threshold < 0) {
      threshold = computeAdaptiveThreshold(response, 0.99);
    }

    // Step 5: Non-maximum suppression
    let corners = nonMaxSuppression(response, this.params.nmsRadius, threshold);

    // Step 6: Sort by response strength
    corners.sort((a, b) => b.response - a.response);

    // Step 7: Limit number of corners
    if (this.params.maxCorners > 0 && corners.length > this.params.maxCorners) {
      corners = corners.slice(0, this.params.maxCorners);
    }

    // Step 8: Sub-pixel refinement
    if (this.params.subPixel) {
      corners = corners.map(c => refineCornerSubPixel(response, c));
    }

    // Step 9: Compute orientations
    corners = corners.map(c => ({
      ...c,
      angle: computeCornerOrientation(gradients, c)
    }));

    return corners;
  }

  /**
   * Get response map
   */
  getResponseMap(image: GrayscaleImage): number[][] {
    const gradients = computeSobelGradients(image.data);
    const tensor = computeStructureTensor(gradients, this.params.windowSize);

    switch (this.params.method) {
      case 'shi-tomasi':
        return computeShiTomasiResponse(tensor);
      case 'harmonic-mean':
        return computeHarmonicMeanResponse(tensor);
      default:
        return computeHarrisResponse(tensor, this.params.k);
    }
  }
}

// ============================================================================
// MULTI-SCALE HARRIS DETECTION
// ============================================================================

/**
 * Downsample image by factor of 2
 */
function downsampleImage(image: number[][]): number[][] {
  const height = image.length;
  const width = image[0].length;
  const newHeight = Math.floor(height / 2);
  const newWidth = Math.floor(width / 2);
  const result: number[][] = [];

  for (let y = 0; y < newHeight; y++) {
    result[y] = [];
    for (let x = 0; x < newWidth; x++) {
      // Average 2x2 block
      result[y][x] = (
        image[y * 2][x * 2] +
        image[y * 2][x * 2 + 1] +
        image[y * 2 + 1][x * 2] +
        image[y * 2 + 1][x * 2 + 1]
      ) / 4;
    }
  }

  return result;
}

/**
 * Multi-scale Harris detection
 */
function detectMultiScale(
  image: GrayscaleImage,
  params: HarrisParams,
  numScales: number = 3
): { corners: Corner[]; scale: number }[] {
  const results: { corners: Corner[]; scale: number }[] = [];
  let currentImage = image.data;
  let scale = 1;

  for (let s = 0; s < numScales; s++) {
    const detector = new HarrisCornerDetector(params);
    const corners = detector.detect({
      width: currentImage[0].length,
      height: currentImage.length,
      data: currentImage
    });

    // Scale corners back to original coordinates
    const scaledCorners = corners.map(c => ({
      ...c,
      x: c.x * scale,
      y: c.y * scale,
      subPixelX: (c.subPixelX ?? c.x) * scale,
      subPixelY: (c.subPixelY ?? c.y) * scale
    }));

    results.push({ corners: scaledCorners, scale });

    // Prepare next scale
    currentImage = downsampleImage(currentImage);
    scale *= 2;
  }

  return results;
}

// ============================================================================
// CORNER TRACKING
// ============================================================================

/**
 * Match corners between frames using NCC
 */
function matchCorners(
  corners1: Corner[],
  corners2: Corner[],
  image1: number[][],
  image2: number[][],
  patchSize: number = 11,
  maxDistance: number = 50
): { matches: [number, number][]; scores: number[] } {
  const matches: [number, number][] = [];
  const scores: number[] = [];
  const half = Math.floor(patchSize / 2);

  // Extract patch from image
  const extractPatch = (image: number[][], x: number, y: number): number[] => {
    const patch: number[] = [];
    const height = image.length;
    const width = image[0].length;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const iy = Math.min(Math.max(Math.round(y + dy), 0), height - 1);
        const ix = Math.min(Math.max(Math.round(x + dx), 0), width - 1);
        patch.push(image[iy][ix]);
      }
    }

    return patch;
  };

  // Compute NCC between patches
  const computeNCC = (patch1: number[], patch2: number[]): number => {
    const n = patch1.length;
    let mean1 = 0, mean2 = 0;

    for (let i = 0; i < n; i++) {
      mean1 += patch1[i];
      mean2 += patch2[i];
    }
    mean1 /= n;
    mean2 /= n;

    let num = 0, den1 = 0, den2 = 0;
    for (let i = 0; i < n; i++) {
      const d1 = patch1[i] - mean1;
      const d2 = patch2[i] - mean2;
      num += d1 * d2;
      den1 += d1 * d1;
      den2 += d2 * d2;
    }

    const den = Math.sqrt(den1 * den2);
    return den > 1e-10 ? num / den : 0;
  };

  // Match each corner in first set
  const used = new Set<number>();

  for (let i = 0; i < corners1.length; i++) {
    const c1 = corners1[i];
    const patch1 = extractPatch(image1, c1.x, c1.y);

    let bestMatch = -1;
    let bestScore = -Infinity;

    for (let j = 0; j < corners2.length; j++) {
      if (used.has(j)) continue;

      const c2 = corners2[j];
      const dist = Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2);

      if (dist > maxDistance) continue;

      const patch2 = extractPatch(image2, c2.x, c2.y);
      const score = computeNCC(patch1, patch2);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = j;
      }
    }

    if (bestMatch >= 0 && bestScore > 0.8) {
      matches.push([i, bestMatch]);
      scores.push(bestScore);
      used.add(bestMatch);
    }
  }

  return { matches, scores };
}

// ============================================================================
// SYNTHETIC IMAGE GENERATION
// ============================================================================

function generateTestImage(width: number, height: number, pattern: string): GrayscaleImage {
  const data: number[][] = [];

  for (let y = 0; y < height; y++) {
    data[y] = [];
    for (let x = 0; x < width; x++) {
      data[y][x] = 128; // Gray background
    }
  }

  switch (pattern) {
    case 'checkerboard':
      const squareSize = 20;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const sx = Math.floor(x / squareSize);
          const sy = Math.floor(y / squareSize);
          data[y][x] = ((sx + sy) % 2 === 0) ? 255 : 0;
        }
      }
      break;

    case 'corners':
      // Draw rectangles to create corners
      const rects = [
        { x: 50, y: 50, w: 60, h: 40 },
        { x: 150, y: 80, w: 80, h: 50 },
        { x: 80, y: 150, w: 50, h: 60 }
      ];

      for (const rect of rects) {
        for (let y = rect.y; y < Math.min(rect.y + rect.h, height); y++) {
          for (let x = rect.x; x < Math.min(rect.x + rect.w, width); x++) {
            data[y][x] = 255;
          }
        }
      }
      break;

    case 'gradient':
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          data[y][x] = Math.floor((x / width) * 255);
        }
      }
      // Add some squares for corners
      for (let y = 40; y < 80; y++) {
        for (let x = 40; x < 80; x++) {
          data[y][x] = 255;
        }
      }
      break;

    case 'noise':
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          data[y][x] = Math.floor(Math.random() * 256);
        }
      }
      break;

    default:
      // Simple cross pattern
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (Math.abs(x - width / 2) < 5 || Math.abs(y - height / 2) < 5) {
            data[y][x] = 255;
          }
        }
      }
  }

  return { width, height, data };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const harriscornersTool: UnifiedTool = {
  name: 'harris_corners',
  description: 'Harris corner detection with sub-pixel refinement, multi-scale detection, and corner tracking',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['detect', 'multi_scale', 'track', 'response_map', 'compare_methods', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      image: {
        type: 'object',
        description: 'Grayscale image data { width, height, data: number[][] }',
        properties: {
          width: { type: 'number', description: 'Image width' },
          height: { type: 'number', description: 'Image height' },
          data: { type: 'array', description: '2D array of pixel values [0-255]' }
        }
      },
      params: {
        type: 'object',
        description: 'Harris detection parameters',
        properties: {
          k: { type: 'number', description: 'Harris sensitivity (default: 0.04)' },
          windowSize: { type: 'number', description: 'Window size (default: 3)' },
          threshold: { type: 'number', description: 'Response threshold (auto if < 0)' },
          nmsRadius: { type: 'number', description: 'Non-maximum suppression radius (default: 3)' },
          maxCorners: { type: 'number', description: 'Maximum corners (default: 500)' },
          subPixel: { type: 'boolean', description: 'Enable sub-pixel refinement' },
          method: { type: 'string', enum: ['harris', 'shi-tomasi', 'harmonic-mean'] }
        }
      },
      image2: {
        type: 'object',
        description: 'Second image for tracking'
      },
      numScales: {
        type: 'number',
        description: 'Number of scales for multi-scale detection'
      },
      testPattern: {
        type: 'string',
        enum: ['checkerboard', 'corners', 'gradient', 'noise', 'cross'],
        description: 'Test pattern for demo'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeharriscorners(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, params, image2, numScales, testPattern } = args;

    let result: unknown;

    switch (operation) {
      case 'detect': {
        if (!image) {
          throw new Error('Image data required for detection');
        }

        const detector = new HarrisCornerDetector(params || {});
        const corners = detector.detect(image);

        result = {
          operation: 'detect',
          method: params?.method || 'harris',
          cornerCount: corners.length,
          corners: corners.slice(0, 100), // Limit output
          parameters: {
            k: params?.k ?? 0.04,
            windowSize: params?.windowSize ?? 3,
            nmsRadius: params?.nmsRadius ?? 3,
            subPixel: params?.subPixel ?? true
          },
          statistics: {
            maxResponse: Math.max(...corners.map(c => c.response)),
            minResponse: Math.min(...corners.map(c => c.response)),
            avgResponse: corners.reduce((s, c) => s + c.response, 0) / corners.length
          }
        };
        break;
      }

      case 'multi_scale': {
        if (!image) {
          throw new Error('Image data required');
        }

        const scales = detectMultiScale(image, params || {}, numScales || 3);

        result = {
          operation: 'multi_scale',
          numScales: scales.length,
          scales: scales.map(s => ({
            scale: s.scale,
            cornerCount: s.corners.length,
            corners: s.corners.slice(0, 50)
          })),
          totalCorners: scales.reduce((sum, s) => sum + s.corners.length, 0)
        };
        break;
      }

      case 'track': {
        if (!image || !image2) {
          throw new Error('Two images required for tracking');
        }

        const detector = new HarrisCornerDetector(params || {});
        const corners1 = detector.detect(image);
        const corners2 = detector.detect(image2);

        const { matches, scores } = matchCorners(
          corners1,
          corners2,
          image.data,
          image2.data
        );

        result = {
          operation: 'track',
          corners1Count: corners1.length,
          corners2Count: corners2.length,
          matchCount: matches.length,
          matches: matches.slice(0, 50).map((m, i) => ({
            corner1: { x: corners1[m[0]].x, y: corners1[m[0]].y },
            corner2: { x: corners2[m[1]].x, y: corners2[m[1]].y },
            score: scores[i]
          })),
          averageScore: scores.reduce((s, v) => s + v, 0) / scores.length
        };
        break;
      }

      case 'response_map': {
        if (!image) {
          throw new Error('Image data required');
        }

        const detector = new HarrisCornerDetector(params || {});
        const responseMap = detector.getResponseMap(image);

        // Compute statistics
        let min = Infinity, max = -Infinity, sum = 0;
        let count = 0;

        for (let y = 0; y < responseMap.length; y++) {
          for (let x = 0; x < responseMap[y].length; x++) {
            const v = responseMap[y][x];
            min = Math.min(min, v);
            max = Math.max(max, v);
            sum += v;
            count++;
          }
        }

        result = {
          operation: 'response_map',
          dimensions: { width: responseMap[0].length, height: responseMap.length },
          statistics: {
            min,
            max,
            mean: sum / count
          },
          // Return downsampled response for visualization
          sampleData: responseMap.filter((_, i) => i % 4 === 0)
            .map(row => row.filter((_, i) => i % 4 === 0))
        };
        break;
      }

      case 'compare_methods': {
        if (!image) {
          throw new Error('Image data required');
        }

        const methods = ['harris', 'shi-tomasi', 'harmonic-mean'] as const;
        const comparison: Record<string, unknown> = {};

        for (const method of methods) {
          const detector = new HarrisCornerDetector({ ...params, method });
          const corners = detector.detect(image);

          comparison[method] = {
            cornerCount: corners.length,
            topCorners: corners.slice(0, 10).map(c => ({
              x: c.x,
              y: c.y,
              response: c.response
            })),
            maxResponse: Math.max(...corners.map(c => c.response)),
            avgResponse: corners.reduce((s, c) => s + c.response, 0) / corners.length
          };
        }

        result = {
          operation: 'compare_methods',
          imageSize: { width: image.width, height: image.height },
          comparison
        };
        break;
      }

      case 'demo': {
        const pattern = testPattern || 'checkerboard';
        const testImage = generateTestImage(200, 200, pattern);

        const harrisDetector = new HarrisCornerDetector({ method: 'harris' });
        const shiTomasiDetector = new HarrisCornerDetector({ method: 'shi-tomasi' });

        const harrisCorners = harrisDetector.detect(testImage);
        const shiTomasiCorners = shiTomasiDetector.detect(testImage);

        result = {
          operation: 'demo',
          testPattern: pattern,
          imageSize: { width: 200, height: 200 },
          harris: {
            cornerCount: harrisCorners.length,
            topCorners: harrisCorners.slice(0, 20).map(c => ({
              x: Math.round(c.subPixelX ?? c.x),
              y: Math.round(c.subPixelY ?? c.y),
              response: c.response.toFixed(2)
            }))
          },
          shiTomasi: {
            cornerCount: shiTomasiCorners.length,
            topCorners: shiTomasiCorners.slice(0, 20).map(c => ({
              x: Math.round(c.subPixelX ?? c.x),
              y: Math.round(c.subPixelY ?? c.y),
              response: c.response.toFixed(2)
            }))
          },
          explanation: {
            harris: 'Uses det(M) - k*trace(M)^2 for corner response',
            shiTomasi: 'Uses min eigenvalue, more stable for tracking'
          }
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'Basic corner detection',
              code: `{
  "operation": "detect",
  "image": { "width": 100, "height": 100, "data": [[...]] },
  "params": { "method": "harris", "maxCorners": 100 }
}`
            },
            {
              name: 'Multi-scale detection',
              code: `{
  "operation": "multi_scale",
  "image": { "width": 200, "height": 200, "data": [[...]] },
  "numScales": 4
}`
            },
            {
              name: 'Corner tracking',
              code: `{
  "operation": "track",
  "image": { ... },
  "image2": { ... }
}`
            },
            {
              name: 'Compare methods',
              code: `{
  "operation": "compare_methods",
  "image": { ... }
}`
            },
            {
              name: 'Demo with test pattern',
              code: `{
  "operation": "demo",
  "testPattern": "checkerboard"
}`
            }
          ]
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'harris_corners',
          description: 'Harris corner detection with sub-pixel refinement',
          capabilities: [
            'Harris corner response calculation',
            'Shi-Tomasi (Good Features to Track) method',
            'Harmonic mean response',
            'Non-maximum suppression',
            'Sub-pixel corner refinement',
            'Multi-scale detection',
            'Corner tracking between frames',
            'Adaptive thresholding'
          ],
          methods: {
            harris: {
              formula: 'R = det(M) - k * trace(M)²',
              description: 'Original Harris formulation, good for general corner detection'
            },
            'shi-tomasi': {
              formula: 'R = min(λ₁, λ₂)',
              description: 'Minimum eigenvalue, more stable for tracking'
            },
            'harmonic-mean': {
              formula: 'R = det(M) / trace(M)',
              description: 'More robust to noise'
            }
          },
          parameters: {
            k: 'Harris sensitivity (0.04-0.06), higher = fewer corners',
            windowSize: 'Gradient window size (3-7)',
            threshold: 'Response threshold, -1 for adaptive',
            nmsRadius: 'Non-maximum suppression radius',
            maxCorners: 'Maximum number of corners to return',
            subPixel: 'Enable sub-pixel refinement for better accuracy'
          },
          operations: ['detect', 'multi_scale', 'track', 'response_map', 'compare_methods', 'demo', 'info', 'examples']
        };
      }
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2)
    };

  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in harris_corners: ${error}`,
      isError: true
    };
  }
}

export function isharriscornersAvailable(): boolean {
  return true;
}
