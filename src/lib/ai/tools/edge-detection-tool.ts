/**
 * EDGE-DETECTION TOOL
 * Image edge detection algorithms
 *
 * Implements:
 * - Sobel operator
 * - Prewitt operator
 * - Roberts Cross operator
 * - Laplacian of Gaussian (LoG)
 * - Canny edge detector
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Image type (grayscale)
type GrayscaleImage = number[][];

// Convolution with kernel
function convolve(image: GrayscaleImage, kernel: number[][]): GrayscaleImage {
  const height = image.length;
  const width = image[0].length;
  const kSize = kernel.length;
  const kHalf = Math.floor(kSize / 2);

  const result: GrayscaleImage = Array(height).fill(0).map(() => Array(width).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;

      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const iy = Math.min(Math.max(y + ky - kHalf, 0), height - 1);
          const ix = Math.min(Math.max(x + kx - kHalf, 0), width - 1);
          sum += image[iy][ix] * kernel[ky][kx];
        }
      }

      result[y][x] = sum;
    }
  }

  return result;
}

// Gaussian blur
function gaussianBlur(image: GrayscaleImage, sigma: number = 1.4): GrayscaleImage {
  const kSize = Math.ceil(sigma * 6) | 1; // Ensure odd
  const kHalf = Math.floor(kSize / 2);
  const kernel: number[][] = [];

  let sum = 0;
  for (let y = 0; y < kSize; y++) {
    kernel[y] = [];
    for (let x = 0; x < kSize; x++) {
      const dx = x - kHalf;
      const dy = y - kHalf;
      const g = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = g;
      sum += g;
    }
  }

  // Normalize
  for (let y = 0; y < kSize; y++) {
    for (let x = 0; x < kSize; x++) {
      kernel[y][x] /= sum;
    }
  }

  return convolve(image, kernel);
}

// Sobel operator
function sobel(image: GrayscaleImage): { magnitude: GrayscaleImage; direction: GrayscaleImage } {
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

  const gx = convolve(image, sobelX);
  const gy = convolve(image, sobelY);

  const height = image.length;
  const width = image[0].length;
  const magnitude: GrayscaleImage = [];
  const direction: GrayscaleImage = [];

  for (let y = 0; y < height; y++) {
    magnitude[y] = [];
    direction[y] = [];
    for (let x = 0; x < width; x++) {
      magnitude[y][x] = Math.sqrt(gx[y][x] * gx[y][x] + gy[y][x] * gy[y][x]);
      direction[y][x] = Math.atan2(gy[y][x], gx[y][x]);
    }
  }

  return { magnitude, direction };
}

// Prewitt operator
function prewitt(image: GrayscaleImage): { magnitude: GrayscaleImage; direction: GrayscaleImage } {
  const prewittX = [
    [-1, 0, 1],
    [-1, 0, 1],
    [-1, 0, 1]
  ];

  const prewittY = [
    [-1, -1, -1],
    [0, 0, 0],
    [1, 1, 1]
  ];

  const gx = convolve(image, prewittX);
  const gy = convolve(image, prewittY);

  const height = image.length;
  const width = image[0].length;
  const magnitude: GrayscaleImage = [];
  const direction: GrayscaleImage = [];

  for (let y = 0; y < height; y++) {
    magnitude[y] = [];
    direction[y] = [];
    for (let x = 0; x < width; x++) {
      magnitude[y][x] = Math.sqrt(gx[y][x] * gx[y][x] + gy[y][x] * gy[y][x]);
      direction[y][x] = Math.atan2(gy[y][x], gx[y][x]);
    }
  }

  return { magnitude, direction };
}

// Roberts Cross operator
function roberts(image: GrayscaleImage): GrayscaleImage {
  const robertsX = [
    [1, 0],
    [0, -1]
  ];

  const robertsY = [
    [0, 1],
    [-1, 0]
  ];

  const gx = convolve(image, robertsX);
  const gy = convolve(image, robertsY);

  const height = image.length;
  const width = image[0].length;
  const magnitude: GrayscaleImage = [];

  for (let y = 0; y < height; y++) {
    magnitude[y] = [];
    for (let x = 0; x < width; x++) {
      magnitude[y][x] = Math.sqrt(gx[y][x] * gx[y][x] + gy[y][x] * gy[y][x]);
    }
  }

  return magnitude;
}

// Laplacian of Gaussian
function laplacianOfGaussian(image: GrayscaleImage, sigma: number = 1.4): GrayscaleImage {
  // First apply Gaussian blur
  const blurred = gaussianBlur(image, sigma);

  // Laplacian kernel
  const laplacian = [
    [0, 1, 0],
    [1, -4, 1],
    [0, 1, 0]
  ];

  return convolve(blurred, laplacian);
}

// Non-maximum suppression for Canny
function nonMaxSuppression(magnitude: GrayscaleImage, direction: GrayscaleImage): GrayscaleImage {
  const height = magnitude.length;
  const width = magnitude[0].length;
  const result: GrayscaleImage = [];

  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      const angle = direction[y][x] * 180 / Math.PI;
      const normalizedAngle = angle < 0 ? angle + 180 : angle;

      let q = 255, r = 255;

      // Determine neighbors based on gradient direction
      if ((normalizedAngle >= 0 && normalizedAngle < 22.5) || (normalizedAngle >= 157.5 && normalizedAngle <= 180)) {
        // Horizontal edge
        q = x > 0 ? magnitude[y][x - 1] : 0;
        r = x < width - 1 ? magnitude[y][x + 1] : 0;
      } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
        // Diagonal (/)
        q = (y > 0 && x < width - 1) ? magnitude[y - 1][x + 1] : 0;
        r = (y < height - 1 && x > 0) ? magnitude[y + 1][x - 1] : 0;
      } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
        // Vertical edge
        q = y > 0 ? magnitude[y - 1][x] : 0;
        r = y < height - 1 ? magnitude[y + 1][x] : 0;
      } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
        // Diagonal (\)
        q = (y > 0 && x > 0) ? magnitude[y - 1][x - 1] : 0;
        r = (y < height - 1 && x < width - 1) ? magnitude[y + 1][x + 1] : 0;
      }

      if (magnitude[y][x] >= q && magnitude[y][x] >= r) {
        result[y][x] = magnitude[y][x];
      } else {
        result[y][x] = 0;
      }
    }
  }

  return result;
}

// Double threshold and hysteresis for Canny
function doubleThresholdHysteresis(
  image: GrayscaleImage,
  lowThreshold: number,
  highThreshold: number
): GrayscaleImage {
  const height = image.length;
  const width = image[0].length;
  const result: GrayscaleImage = [];

  // Initialize
  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      if (image[y][x] >= highThreshold) {
        result[y][x] = 255; // Strong edge
      } else if (image[y][x] >= lowThreshold) {
        result[y][x] = 128; // Weak edge
      } else {
        result[y][x] = 0;
      }
    }
  }

  // Hysteresis: connect weak edges to strong edges
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (result[y][x] === 128) {
          // Check if connected to strong edge
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (result[y + dy][x + dx] === 255) {
                result[y][x] = 255;
                changed = true;
                break;
              }
            }
            if (result[y][x] === 255) break;
          }
        }
      }
    }
  }

  // Suppress remaining weak edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (result[y][x] === 128) {
        result[y][x] = 0;
      }
    }
  }

  return result;
}

// Full Canny edge detector
function canny(
  image: GrayscaleImage,
  sigma: number = 1.4,
  lowThreshold: number = 20,
  highThreshold: number = 50
): { edges: GrayscaleImage; magnitude: GrayscaleImage; direction: GrayscaleImage } {
  // 1. Gaussian blur
  const blurred = gaussianBlur(image, sigma);

  // 2. Compute gradients
  const { magnitude, direction } = sobel(blurred);

  // 3. Non-maximum suppression
  const suppressed = nonMaxSuppression(magnitude, direction);

  // 4. Double threshold and hysteresis
  const edges = doubleThresholdHysteresis(suppressed, lowThreshold, highThreshold);

  return { edges, magnitude, direction };
}

// Generate test images
function generateTestImage(type: string, width: number, height: number): GrayscaleImage {
  const image: GrayscaleImage = [];

  for (let y = 0; y < height; y++) {
    image[y] = [];
    for (let x = 0; x < width; x++) {
      switch (type) {
        case 'step':
          // Vertical step edge
          image[y][x] = x < width / 2 ? 50 : 200;
          break;
        case 'gradient':
          // Horizontal gradient
          image[y][x] = Math.floor((x / width) * 255);
          break;
        case 'circle':
          // Circle
          const cx = width / 2, cy = height / 2, r = Math.min(width, height) / 3;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          image[y][x] = dist < r ? 200 : 50;
          break;
        case 'square':
          // Square in center
          const margin = Math.min(width, height) / 4;
          image[y][x] = (x > margin && x < width - margin && y > margin && y < height - margin) ? 200 : 50;
          break;
        case 'checkerboard':
          // Checkerboard pattern
          const blockSize = Math.floor(Math.min(width, height) / 4);
          const bx = Math.floor(x / blockSize);
          const by = Math.floor(y / blockSize);
          image[y][x] = (bx + by) % 2 === 0 ? 200 : 50;
          break;
        case 'diagonal':
          // Diagonal line
          image[y][x] = Math.abs(x - y) < 3 ? 200 : 50;
          break;
        default:
          image[y][x] = 128;
      }
    }
  }

  return image;
}

// Visualize image as ASCII
function visualizeImage(image: GrayscaleImage, maxWidth: number = 60, maxHeight: number = 30): string {
  const chars = ' .:-=+*#%@';
  const height = image.length;
  const width = image[0].length;

  const scaleX = Math.ceil(width / maxWidth);
  const scaleY = Math.ceil(height / maxHeight);

  const lines: string[] = [];

  for (let y = 0; y < height; y += scaleY) {
    let line = '';
    for (let x = 0; x < width; x += scaleX) {
      const val = image[y][x];
      const normalized = Math.max(0, Math.min(255, val)) / 255;
      const charIdx = Math.floor(normalized * (chars.length - 1));
      line += chars[charIdx];
    }
    lines.push(line);
  }

  return lines.join('\n');
}

// Calculate edge statistics
function calculateEdgeStats(edges: GrayscaleImage): {
  edgePixels: number;
  totalPixels: number;
  edgeDensity: number;
  avgMagnitude: number;
  maxMagnitude: number;
} {
  const height = edges.length;
  const width = edges[0].length;
  let edgePixels = 0;
  let sumMagnitude = 0;
  let maxMagnitude = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y][x] > 0) {
        edgePixels++;
        sumMagnitude += edges[y][x];
        maxMagnitude = Math.max(maxMagnitude, edges[y][x]);
      }
    }
  }

  const totalPixels = height * width;

  return {
    edgePixels,
    totalPixels,
    edgeDensity: edgePixels / totalPixels,
    avgMagnitude: edgePixels > 0 ? sumMagnitude / edgePixels : 0,
    maxMagnitude
  };
}

export const edgedetectionTool: UnifiedTool = {
  name: 'edge_detection',
  description: 'Image edge detection - Sobel, Prewitt, Roberts, Laplacian, Canny algorithms',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['sobel', 'prewitt', 'roberts', 'laplacian', 'canny', 'compare', 'info', 'examples'],
        description: 'Edge detection algorithm'
      },
      testImage: {
        type: 'string',
        enum: ['step', 'gradient', 'circle', 'square', 'checkerboard', 'diagonal'],
        description: 'Test image type'
      },
      width: { type: 'number', description: 'Image width' },
      height: { type: 'number', description: 'Image height' },
      sigma: { type: 'number', description: 'Gaussian sigma for Canny/LoG' },
      lowThreshold: { type: 'number', description: 'Low threshold for Canny' },
      highThreshold: { type: 'number', description: 'High threshold for Canny' }
    },
    required: ['operation']
  }
};

export async function executeedgedetection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'edge-detection',
          description: 'Image edge detection algorithms',
          algorithms: {
            sobel: {
              name: 'Sobel Operator',
              description: '3x3 gradient operator, emphasis on vertical/horizontal edges',
              complexity: 'O(n) per pixel'
            },
            prewitt: {
              name: 'Prewitt Operator',
              description: '3x3 gradient operator, simpler than Sobel',
              complexity: 'O(n) per pixel'
            },
            roberts: {
              name: 'Roberts Cross',
              description: '2x2 gradient operator, diagonal emphasis',
              complexity: 'O(n) per pixel'
            },
            laplacian: {
              name: 'Laplacian of Gaussian',
              description: 'Second derivative, detects rapid intensity changes',
              complexity: 'O(n) per pixel'
            },
            canny: {
              name: 'Canny Edge Detector',
              description: 'Multi-stage: blur, gradient, non-max suppression, hysteresis',
              complexity: 'O(n) per pixel, multiple passes'
            }
          },
          operations: ['sobel', 'prewitt', 'roberts', 'laplacian', 'canny', 'compare', 'info', 'examples']
        }, null, 2)
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          examples: [
            {
              description: 'Sobel edge detection on circle',
              call: { operation: 'sobel', testImage: 'circle' }
            },
            {
              description: 'Canny edge detection with custom thresholds',
              call: { operation: 'canny', testImage: 'square', sigma: 1.5, lowThreshold: 15, highThreshold: 45 }
            },
            {
              description: 'Compare all algorithms on checkerboard',
              call: { operation: 'compare', testImage: 'checkerboard' }
            }
          ]
        }, null, 2)
      };
    }

    const width = Math.min(100, args.width || 32);
    const height = Math.min(100, args.height || 32);
    const testImage = args.testImage || 'circle';
    const image = generateTestImage(testImage, width, height);

    if (operation === 'sobel') {
      const result = sobel(image);
      const stats = calculateEdgeStats(result.magnitude);

      return {
        toolCallId: id,
        content: JSON.stringify({
          algorithm: 'Sobel',
          testImage,
          dimensions: { width, height },
          statistics: {
            edgePixels: stats.edgePixels,
            edgeDensity: (stats.edgeDensity * 100).toFixed(2) + '%',
            maxMagnitude: stats.maxMagnitude.toFixed(2),
            avgMagnitude: stats.avgMagnitude.toFixed(2)
          },
          visualizations: {
            original: visualizeImage(image, 40, 20),
            edges: visualizeImage(result.magnitude, 40, 20)
          }
        }, null, 2)
      };
    }

    if (operation === 'prewitt') {
      const result = prewitt(image);
      const stats = calculateEdgeStats(result.magnitude);

      return {
        toolCallId: id,
        content: JSON.stringify({
          algorithm: 'Prewitt',
          testImage,
          dimensions: { width, height },
          statistics: {
            edgePixels: stats.edgePixels,
            edgeDensity: (stats.edgeDensity * 100).toFixed(2) + '%',
            maxMagnitude: stats.maxMagnitude.toFixed(2)
          },
          visualizations: {
            original: visualizeImage(image, 40, 20),
            edges: visualizeImage(result.magnitude, 40, 20)
          }
        }, null, 2)
      };
    }

    if (operation === 'roberts') {
      const result = roberts(image);
      const stats = calculateEdgeStats(result);

      return {
        toolCallId: id,
        content: JSON.stringify({
          algorithm: 'Roberts Cross',
          testImage,
          dimensions: { width, height },
          statistics: {
            edgePixels: stats.edgePixels,
            edgeDensity: (stats.edgeDensity * 100).toFixed(2) + '%',
            maxMagnitude: stats.maxMagnitude.toFixed(2)
          },
          visualizations: {
            original: visualizeImage(image, 40, 20),
            edges: visualizeImage(result, 40, 20)
          }
        }, null, 2)
      };
    }

    if (operation === 'laplacian') {
      const sigma = args.sigma || 1.4;
      const result = laplacianOfGaussian(image, sigma);

      // Normalize for visualization
      const normalized: GrayscaleImage = result.map(row =>
        row.map(v => Math.abs(v) * 2)
      );

      const stats = calculateEdgeStats(normalized);

      return {
        toolCallId: id,
        content: JSON.stringify({
          algorithm: 'Laplacian of Gaussian',
          testImage,
          sigma,
          dimensions: { width, height },
          statistics: {
            edgePixels: stats.edgePixels,
            edgeDensity: (stats.edgeDensity * 100).toFixed(2) + '%',
            maxMagnitude: stats.maxMagnitude.toFixed(2)
          },
          visualizations: {
            original: visualizeImage(image, 40, 20),
            edges: visualizeImage(normalized, 40, 20)
          }
        }, null, 2)
      };
    }

    if (operation === 'canny') {
      const sigma = args.sigma || 1.4;
      const lowThreshold = args.lowThreshold || 20;
      const highThreshold = args.highThreshold || 50;

      const result = canny(image, sigma, lowThreshold, highThreshold);
      const stats = calculateEdgeStats(result.edges);

      return {
        toolCallId: id,
        content: JSON.stringify({
          algorithm: 'Canny Edge Detector',
          testImage,
          parameters: { sigma, lowThreshold, highThreshold },
          dimensions: { width, height },
          statistics: {
            edgePixels: stats.edgePixels,
            edgeDensity: (stats.edgeDensity * 100).toFixed(2) + '%'
          },
          stages: {
            description: ['1. Gaussian blur', '2. Sobel gradient', '3. Non-maximum suppression', '4. Double threshold & hysteresis']
          },
          visualizations: {
            original: visualizeImage(image, 40, 20),
            magnitude: visualizeImage(result.magnitude, 40, 20),
            edges: visualizeImage(result.edges, 40, 20)
          }
        }, null, 2)
      };
    }

    if (operation === 'compare') {
      const sobelResult = sobel(image);
      const prewittResult = prewitt(image);
      const robertsResult = roberts(image);
      const cannyResult = canny(image);

      const sobelStats = calculateEdgeStats(sobelResult.magnitude);
      const prewittStats = calculateEdgeStats(prewittResult.magnitude);
      const robertsStats = calculateEdgeStats(robertsResult);
      const cannyStats = calculateEdgeStats(cannyResult.edges);

      return {
        toolCallId: id,
        content: JSON.stringify({
          comparison: {
            testImage,
            dimensions: { width, height }
          },
          results: {
            sobel: {
              edgeDensity: (sobelStats.edgeDensity * 100).toFixed(2) + '%',
              maxMagnitude: sobelStats.maxMagnitude.toFixed(2)
            },
            prewitt: {
              edgeDensity: (prewittStats.edgeDensity * 100).toFixed(2) + '%',
              maxMagnitude: prewittStats.maxMagnitude.toFixed(2)
            },
            roberts: {
              edgeDensity: (robertsStats.edgeDensity * 100).toFixed(2) + '%',
              maxMagnitude: robertsStats.maxMagnitude.toFixed(2)
            },
            canny: {
              edgeDensity: (cannyStats.edgeDensity * 100).toFixed(2) + '%',
              maxMagnitude: cannyStats.maxMagnitude.toFixed(2)
            }
          },
          recommendation: 'Canny provides best results for most applications due to multi-stage processing',
          visualizations: {
            original: visualizeImage(image, 40, 20),
            sobel: visualizeImage(sobelResult.magnitude, 40, 20),
            canny: visualizeImage(cannyResult.edges, 40, 20)
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: `Unknown operation: ${operation}` }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isedgedetectionAvailable(): boolean { return true; }
