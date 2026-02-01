/**
 * IMAGE COMPUTATION TOOL
 *
 * Pure computational image processing without external libraries.
 * Implements fundamental image processing algorithms.
 *
 * Features:
 * - Convolution and filtering
 * - Edge detection (Sobel, Prewitt, Laplacian)
 * - Histogram analysis
 * - Image transformations
 * - Morphological operations
 * - Feature detection
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ImageMatrix = number[][];
type Kernel = number[][];

// ============================================================================
// CONVOLUTION KERNELS
// ============================================================================

const KERNELS: Record<string, Kernel> = {
  // Edge detection
  sobel_x: [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ],
  sobel_y: [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ],
  prewitt_x: [
    [-1, 0, 1],
    [-1, 0, 1],
    [-1, 0, 1],
  ],
  prewitt_y: [
    [-1, -1, -1],
    [0, 0, 0],
    [1, 1, 1],
  ],
  laplacian: [
    [0, 1, 0],
    [1, -4, 1],
    [0, 1, 0],
  ],
  laplacian_diag: [
    [1, 1, 1],
    [1, -8, 1],
    [1, 1, 1],
  ],

  // Blur
  box_blur_3x3: [
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
  ],
  gaussian_3x3: [
    [1 / 16, 2 / 16, 1 / 16],
    [2 / 16, 4 / 16, 2 / 16],
    [1 / 16, 2 / 16, 1 / 16],
  ],
  gaussian_5x5: [
    [1 / 256, 4 / 256, 6 / 256, 4 / 256, 1 / 256],
    [4 / 256, 16 / 256, 24 / 256, 16 / 256, 4 / 256],
    [6 / 256, 24 / 256, 36 / 256, 24 / 256, 6 / 256],
    [4 / 256, 16 / 256, 24 / 256, 16 / 256, 4 / 256],
    [1 / 256, 4 / 256, 6 / 256, 4 / 256, 1 / 256],
  ],

  // Sharpen
  sharpen: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
  unsharp_mask: [
    [-1 / 256, -4 / 256, -6 / 256, -4 / 256, -1 / 256],
    [-4 / 256, -16 / 256, -24 / 256, -16 / 256, -4 / 256],
    [-6 / 256, -24 / 256, 476 / 256, -24 / 256, -6 / 256],
    [-4 / 256, -16 / 256, -24 / 256, -16 / 256, -4 / 256],
    [-1 / 256, -4 / 256, -6 / 256, -4 / 256, -1 / 256],
  ],

  // Emboss
  emboss: [
    [-2, -1, 0],
    [-1, 1, 1],
    [0, 1, 2],
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getKernelDescription(name: string): string {
  const descriptions: Record<string, string> = {
    sobel_x: 'Sobel operator for horizontal edge detection',
    sobel_y: 'Sobel operator for vertical edge detection',
    prewitt_x: 'Prewitt operator for horizontal edges',
    prewitt_y: 'Prewitt operator for vertical edges',
    laplacian: 'Laplacian for edge detection (4-connected)',
    laplacian_diag: 'Laplacian with diagonals (8-connected)',
    box_blur_3x3: 'Simple averaging blur (3x3)',
    gaussian_3x3: 'Gaussian blur (3x3, sigma~0.85)',
    gaussian_5x5: 'Gaussian blur (5x5, sigma~1)',
    sharpen: 'Basic sharpening filter',
    unsharp_mask: 'Unsharp masking for detail enhancement',
    emboss: 'Emboss effect (3D appearance)',
  };
  return descriptions[name] || 'Custom kernel';
}

// ============================================================================
// CORE IMAGE OPERATIONS
// ============================================================================

// Apply convolution with a kernel
function convolve(image: ImageMatrix, kernel: Kernel): ImageMatrix {
  const rows = image.length;
  const cols = image[0].length;
  const kRows = kernel.length;
  const kCols = kernel[0].length;
  const kCenterY = Math.floor(kRows / 2);
  const kCenterX = Math.floor(kCols / 2);

  const result: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;

      for (let ky = 0; ky < kRows; ky++) {
        for (let kx = 0; kx < kCols; kx++) {
          const iy = y + ky - kCenterY;
          const ix = x + kx - kCenterX;

          if (iy >= 0 && iy < rows && ix >= 0 && ix < cols) {
            sum += image[iy][ix] * kernel[ky][kx];
          }
        }
      }

      result[y][x] = sum;
    }
  }

  return result;
}

// Compute image histogram
function computeHistogram(image: ImageMatrix, bins: number = 256): number[] {
  const histogram = Array(bins).fill(0);
  const rows = image.length;
  const cols = image[0].length;
  const total = rows * cols;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const binIndex = Math.min(bins - 1, Math.max(0, Math.floor(image[y][x] * bins)));
      histogram[binIndex]++;
    }
  }

  // Normalize
  return histogram.map((v) => v / total);
}

// Histogram equalization
function equalizeHistogram(image: ImageMatrix): ImageMatrix {
  const rows = image.length;
  const cols = image[0].length;
  const histogram = computeHistogram(image);

  // Compute CDF
  const cdf: number[] = [];
  let cumSum = 0;
  for (const v of histogram) {
    cumSum += v;
    cdf.push(cumSum);
  }

  // Apply equalization
  const result: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const binIndex = Math.min(255, Math.max(0, Math.floor(image[y][x] * 256)));
      result[y][x] = cdf[binIndex];
    }
  }

  return result;
}

// Edge detection using Sobel operator
function sobelEdgeDetection(image: ImageMatrix): {
  magnitude: ImageMatrix;
  direction: ImageMatrix;
} {
  const gx = convolve(image, KERNELS.sobel_x);
  const gy = convolve(image, KERNELS.sobel_y);

  const rows = image.length;
  const cols = image[0].length;

  const magnitude: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));
  const direction: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      magnitude[y][x] = Math.sqrt(gx[y][x] * gx[y][x] + gy[y][x] * gy[y][x]);
      direction[y][x] = Math.atan2(gy[y][x], gx[y][x]) * (180 / Math.PI);
    }
  }

  return { magnitude, direction };
}

// Canny edge detection (simplified)
function cannyEdgeDetection(
  image: ImageMatrix,
  lowThreshold: number,
  highThreshold: number
): ImageMatrix {
  // Step 1: Gaussian blur
  const blurred = convolve(image, KERNELS.gaussian_5x5);

  // Step 2: Sobel edge detection
  const { magnitude, direction } = sobelEdgeDetection(blurred);

  const rows = image.length;
  const cols = image[0].length;

  // Step 3: Non-maximum suppression
  const suppressed: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      let angle = direction[y][x];
      if (angle < 0) angle += 180;

      let q = 1,
        r = 1;

      // Check neighboring pixels based on gradient direction
      if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
        q = magnitude[y][x + 1];
        r = magnitude[y][x - 1];
      } else if (angle >= 22.5 && angle < 67.5) {
        q = magnitude[y + 1][x - 1];
        r = magnitude[y - 1][x + 1];
      } else if (angle >= 67.5 && angle < 112.5) {
        q = magnitude[y + 1][x];
        r = magnitude[y - 1][x];
      } else if (angle >= 112.5 && angle < 157.5) {
        q = magnitude[y - 1][x - 1];
        r = magnitude[y + 1][x + 1];
      }

      if (magnitude[y][x] >= q && magnitude[y][x] >= r) {
        suppressed[y][x] = magnitude[y][x];
      }
    }
  }

  // Step 4: Double threshold
  const result: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (suppressed[y][x] >= highThreshold) {
        result[y][x] = 1; // Strong edge
      } else if (suppressed[y][x] >= lowThreshold) {
        result[y][x] = 0.5; // Weak edge
      }
    }
  }

  // Step 5: Edge tracking by hysteresis
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (result[y][x] === 0.5) {
        // Check if connected to strong edge
        let hasStrongNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (result[y + dy][x + dx] === 1) {
              hasStrongNeighbor = true;
              break;
            }
          }
          if (hasStrongNeighbor) break;
        }
        result[y][x] = hasStrongNeighbor ? 1 : 0;
      }
    }
  }

  return result;
}

// Morphological operations
function dilate(image: ImageMatrix, structuringElement: Kernel): ImageMatrix {
  const rows = image.length;
  const cols = image[0].length;
  const seRows = structuringElement.length;
  const seCols = structuringElement[0].length;
  const seCenterY = Math.floor(seRows / 2);
  const seCenterX = Math.floor(seCols / 2);

  const result: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let maxVal = 0;

      for (let sy = 0; sy < seRows; sy++) {
        for (let sx = 0; sx < seCols; sx++) {
          if (structuringElement[sy][sx] === 1) {
            const iy = y + sy - seCenterY;
            const ix = x + sx - seCenterX;

            if (iy >= 0 && iy < rows && ix >= 0 && ix < cols) {
              maxVal = Math.max(maxVal, image[iy][ix]);
            }
          }
        }
      }

      result[y][x] = maxVal;
    }
  }

  return result;
}

function erode(image: ImageMatrix, structuringElement: Kernel): ImageMatrix {
  const rows = image.length;
  const cols = image[0].length;
  const seRows = structuringElement.length;
  const seCols = structuringElement[0].length;
  const seCenterY = Math.floor(seRows / 2);
  const seCenterX = Math.floor(seCols / 2);

  const result: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let minVal = 1;

      for (let sy = 0; sy < seRows; sy++) {
        for (let sx = 0; sx < seCols; sx++) {
          if (structuringElement[sy][sx] === 1) {
            const iy = y + sy - seCenterY;
            const ix = x + sx - seCenterX;

            if (iy >= 0 && iy < rows && ix >= 0 && ix < cols) {
              minVal = Math.min(minVal, image[iy][ix]);
            } else {
              minVal = 0;
            }
          }
        }
      }

      result[y][x] = minVal;
    }
  }

  return result;
}

// Opening (erosion followed by dilation)
function morphOpen(image: ImageMatrix, structuringElement: Kernel): ImageMatrix {
  return dilate(erode(image, structuringElement), structuringElement);
}

// Closing (dilation followed by erosion)
function morphClose(image: ImageMatrix, structuringElement: Kernel): ImageMatrix {
  return erode(dilate(image, structuringElement), structuringElement);
}

// Harris corner detection
function harrisCornerDetection(
  image: ImageMatrix,
  k: number = 0.04,
  threshold: number = 0.01
): { corners: Array<{ x: number; y: number; response: number }> } {
  const rows = image.length;
  const cols = image[0].length;

  // Compute gradients
  const Ix = convolve(image, KERNELS.sobel_x);
  const Iy = convolve(image, KERNELS.sobel_y);

  // Compute products of gradients
  const Ixx: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));
  const Iyy: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));
  const Ixy: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      Ixx[y][x] = Ix[y][x] * Ix[y][x];
      Iyy[y][x] = Iy[y][x] * Iy[y][x];
      Ixy[y][x] = Ix[y][x] * Iy[y][x];
    }
  }

  // Gaussian smooth the products
  const Sxx = convolve(Ixx, KERNELS.gaussian_3x3);
  const Syy = convolve(Iyy, KERNELS.gaussian_3x3);
  const Sxy = convolve(Ixy, KERNELS.gaussian_3x3);

  // Compute Harris response
  const R: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  let maxR = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const det = Sxx[y][x] * Syy[y][x] - Sxy[y][x] * Sxy[y][x];
      const trace = Sxx[y][x] + Syy[y][x];
      R[y][x] = det - k * trace * trace;
      maxR = Math.max(maxR, R[y][x]);
    }
  }

  // Find corners (local maxima above threshold)
  const corners: Array<{ x: number; y: number; response: number }> = [];

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (R[y][x] > threshold * maxR) {
        // Check if local maximum
        let isMax = true;
        for (let dy = -1; dy <= 1 && isMax; dy++) {
          for (let dx = -1; dx <= 1 && isMax; dx++) {
            if (dy !== 0 || dx !== 0) {
              if (R[y + dy][x + dx] >= R[y][x]) {
                isMax = false;
              }
            }
          }
        }

        if (isMax) {
          corners.push({ x, y, response: R[y][x] });
        }
      }
    }
  }

  // Sort by response
  corners.sort((a, b) => b.response - a.response);

  return { corners: corners.slice(0, 100) }; // Return top 100
}

// Compute image statistics
function computeImageStats(image: ImageMatrix): {
  mean: number;
  std: number;
  min: number;
  max: number;
  entropy: number;
} {
  const rows = image.length;
  const cols = image[0].length;
  const n = rows * cols;

  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      sum += image[y][x];
      min = Math.min(min, image[y][x]);
      max = Math.max(max, image[y][x]);
    }
  }

  const mean = sum / n;

  let variance = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      variance += Math.pow(image[y][x] - mean, 2);
    }
  }
  const std = Math.sqrt(variance / n);

  // Compute entropy
  const histogram = computeHistogram(image);
  let entropy = 0;
  for (const p of histogram) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return { mean, std, min, max, entropy };
}

// 2D Discrete Fourier Transform (simplified for small images)
function dft2D(image: ImageMatrix): {
  real: ImageMatrix;
  imag: ImageMatrix;
  magnitude: ImageMatrix;
} {
  const rows = image.length;
  const cols = image[0].length;

  const real: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));
  const imag: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));
  const magnitude: ImageMatrix = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let u = 0; u < rows; u++) {
    for (let v = 0; v < cols; v++) {
      let sumReal = 0;
      let sumImag = 0;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const angle = -2 * Math.PI * ((u * y) / rows + (v * x) / cols);
          sumReal += image[y][x] * Math.cos(angle);
          sumImag += image[y][x] * Math.sin(angle);
        }
      }

      real[u][v] = sumReal;
      imag[u][v] = sumImag;
      magnitude[u][v] = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    }
  }

  return { real, imag, magnitude };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const imageComputeTool: UnifiedTool = {
  name: 'image_compute',
  description: `Pure computational image processing without external libraries.

Available operations:
- convolve: Apply convolution with predefined or custom kernel
- histogram: Compute image histogram
- equalize: Histogram equalization
- sobel: Sobel edge detection
- canny: Canny edge detection
- dilate: Morphological dilation
- erode: Morphological erosion
- open: Morphological opening
- close: Morphological closing
- harris: Harris corner detection
- stats: Compute image statistics
- dft: 2D Discrete Fourier Transform

Predefined kernels: sobel_x, sobel_y, prewitt_x, prewitt_y, laplacian, laplacian_diag, box_blur_3x3, gaussian_3x3, gaussian_5x5, sharpen, unsharp_mask, emboss`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'convolve',
          'histogram',
          'equalize',
          'sobel',
          'canny',
          'dilate',
          'erode',
          'open',
          'close',
          'harris',
          'stats',
          'dft',
        ],
        description: 'Image processing operation',
      },
      image: {
        type: 'array',
        description: 'Image as 2D array of normalized values (0-1)',
      },
      kernel_name: {
        type: 'string',
        description: 'Predefined kernel name',
      },
      custom_kernel: {
        type: 'array',
        description: 'Custom convolution kernel as 2D array',
      },
      low_threshold: {
        type: 'number',
        description: 'Low threshold for Canny edge detection',
      },
      high_threshold: {
        type: 'number',
        description: 'High threshold for Canny edge detection',
      },
      k: {
        type: 'number',
        description: 'Harris corner detector sensitivity (default 0.04)',
      },
      threshold: {
        type: 'number',
        description: 'Detection threshold (default 0.01)',
      },
    },
    required: ['operation', 'image'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isImageComputeAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeImageCompute(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as Record<string, unknown>;
  const operation = args.operation as string;
  const image = args.image as ImageMatrix;

  try {
    const result: Record<string, unknown> = { operation };

    // Default structuring element for morphological operations
    const defaultSE: Kernel = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];

    switch (operation) {
      case 'convolve': {
        const kernelName = args.kernel_name as string | undefined;
        const customKernel = args.custom_kernel as Kernel | undefined;
        const kernel = kernelName ? KERNELS[kernelName] : customKernel;

        if (!kernel) {
          throw new Error('Must specify kernel_name or custom_kernel');
        }

        const convolved = convolve(image, kernel);
        result.result = convolved;
        result.kernel_used = kernelName || 'custom';
        break;
      }

      case 'histogram': {
        const histogram = computeHistogram(image);
        result.histogram = histogram;
        result.bins = 256;
        break;
      }

      case 'equalize': {
        const equalized = equalizeHistogram(image);
        result.result = equalized;
        const beforeStats = computeImageStats(image);
        const afterStats = computeImageStats(equalized);
        result.before_stats = beforeStats;
        result.after_stats = afterStats;
        break;
      }

      case 'sobel': {
        const sobelResult = sobelEdgeDetection(image);
        result.magnitude = sobelResult.magnitude;
        result.direction = sobelResult.direction;
        const stats = computeImageStats(sobelResult.magnitude);
        result.edge_strength_stats = stats;
        break;
      }

      case 'canny': {
        const lowT = (args.low_threshold as number) || 0.1;
        const highT = (args.high_threshold as number) || 0.3;
        const edges = cannyEdgeDetection(image, lowT, highT);
        result.edges = edges;
        result.thresholds = { low: lowT, high: highT };
        break;
      }

      case 'dilate': {
        const dilated = dilate(image, defaultSE);
        result.result = dilated;
        break;
      }

      case 'erode': {
        const eroded = erode(image, defaultSE);
        result.result = eroded;
        break;
      }

      case 'open': {
        const opened = morphOpen(image, defaultSE);
        result.result = opened;
        result.note = 'Opening removes small bright spots (noise)';
        break;
      }

      case 'close': {
        const closed = morphClose(image, defaultSE);
        result.result = closed;
        result.note = 'Closing fills small dark gaps';
        break;
      }

      case 'harris': {
        const kValue = (args.k as number) || 0.04;
        const thresholdValue = (args.threshold as number) || 0.01;
        const harrisResult = harrisCornerDetection(image, kValue, thresholdValue);
        result.corners = harrisResult.corners;
        result.corner_count = harrisResult.corners.length;
        result.parameters = { k: kValue, threshold: thresholdValue };
        break;
      }

      case 'stats': {
        const stats = computeImageStats(image);
        result.mean = stats.mean;
        result.std = stats.std;
        result.min = stats.min;
        result.max = stats.max;
        result.entropy = stats.entropy;
        result.dimensions = { rows: image.length, cols: image[0].length };
        break;
      }

      case 'dft': {
        if (image.length > 64 || image[0].length > 64) {
          throw new Error('DFT limited to 64x64 images for performance');
        }
        const dftResult = dft2D(image);
        result.magnitude = dftResult.magnitude;
        result.note = 'Full complex result available if needed';
        break;
      }

      case 'list_kernels': {
        // List all available kernels
        const kernelInfo = Object.entries(KERNELS).map(([name, kernel]) => ({
          name,
          size: `${kernel.length}x${kernel[0].length}`,
          description: getKernelDescription(name),
        }));
        result.kernels = kernelInfo;
        result.total = kernelInfo.length;
        result.categories = {
          edge_detection: [
            'sobel_x',
            'sobel_y',
            'prewitt_x',
            'prewitt_y',
            'laplacian',
            'laplacian_diag',
          ],
          blur: ['box_blur_3x3', 'gaussian_3x3', 'gaussian_5x5'],
          sharpen: ['sharpen', 'unsharp_mask'],
          emboss: ['emboss'],
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
