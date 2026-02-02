/**
 * IMAGE-SEGMENTATION TOOL
 * Comprehensive image segmentation algorithms
 *
 * Features:
 * - K-means clustering segmentation
 * - Mean shift segmentation
 * - Watershed algorithm
 * - Region growing
 * - Graph-based segmentation (Felzenszwalb)
 * - Superpixel generation (SLIC-like)
 * - Connected component labeling
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

interface ColorImage {
  width: number;
  height: number;
  data: number[][][]; // 2D array of [R, G, B] values
}

interface SegmentationResult {
  labels: number[][];       // Label map
  numSegments: number;      // Number of segments
  segmentSizes: number[];   // Size of each segment
  segmentColors?: number[][]; // Representative color for each segment
}

interface Pixel {
  x: number;
  y: number;
  value: number | number[];
}

interface Region {
  id: number;
  pixels: Pixel[];
  centroid: { x: number; y: number };
  color: number | number[];
  size: number;
}

// ============================================================================
// COLOR SPACE UTILITIES
// ============================================================================

/**
 * Convert RGB to LAB color space
 */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // Normalize to [0,1]
  let R = r / 255;
  let G = g / 255;
  let B = b / 255;

  // sRGB to linear
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

  // Linear RGB to XYZ
  let X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  let Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  let Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

  // Normalize for D65 illuminant
  X /= 0.95047;
  Y /= 1.00000;
  Z /= 1.08883;

  // XYZ to LAB
  const f = (t: number) => t > 0.008856 ? Math.pow(t, 1/3) : 7.787 * t + 16/116;

  const L = 116 * f(Y) - 16;
  const a = 500 * (f(X) - f(Y));
  const bLab = 200 * (f(Y) - f(Z));

  return [L, a, bLab];
}

/**
 * Euclidean distance between colors
 */
function colorDistance(c1: number[], c2: number[]): number {
  let sum = 0;
  for (let i = 0; i < c1.length; i++) {
    sum += (c1[i] - c2[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Create grayscale image from color
 */
function toGrayscale(color: ColorImage): GrayscaleImage {
  const data: number[][] = [];
  for (let y = 0; y < color.height; y++) {
    data[y] = [];
    for (let x = 0; x < color.width; x++) {
      const [r, g, b] = color.data[y][x];
      data[y][x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return { width: color.width, height: color.height, data };
}

// ============================================================================
// K-MEANS SEGMENTATION
// ============================================================================

class KMeansSegmenter {
  private k: number;
  private maxIterations: number;
  private tolerance: number;

  constructor(k: number = 5, maxIterations: number = 100, tolerance: number = 1e-4) {
    this.k = k;
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  /**
   * Segment grayscale image using k-means
   */
  segmentGrayscale(image: GrayscaleImage): SegmentationResult {
    const { width, height, data } = image;

    // Initialize centroids randomly
    const centroids: number[] = [];
    for (let i = 0; i < this.k; i++) {
      centroids.push(Math.random() * 255);
    }
    centroids.sort((a, b) => a - b);

    const labels: number[][] = [];
    for (let y = 0; y < height; y++) {
      labels[y] = new Array(width).fill(0);
    }

    // Iterate
    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Assign labels
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value = data[y][x];
          let minDist = Infinity;
          let bestLabel = 0;

          for (let k = 0; k < this.k; k++) {
            const dist = Math.abs(value - centroids[k]);
            if (dist < minDist) {
              minDist = dist;
              bestLabel = k;
            }
          }

          labels[y][x] = bestLabel;
        }
      }

      // Update centroids
      const newCentroids = new Array(this.k).fill(0);
      const counts = new Array(this.k).fill(0);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const label = labels[y][x];
          newCentroids[label] += data[y][x];
          counts[label]++;
        }
      }

      let converged = true;
      for (let k = 0; k < this.k; k++) {
        if (counts[k] > 0) {
          newCentroids[k] /= counts[k];
        }
        if (Math.abs(newCentroids[k] - centroids[k]) > this.tolerance) {
          converged = false;
        }
        centroids[k] = newCentroids[k];
      }

      if (converged) break;
    }

    // Compute segment sizes
    const segmentSizes = new Array(this.k).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        segmentSizes[labels[y][x]]++;
      }
    }

    return {
      labels,
      numSegments: this.k,
      segmentSizes,
      segmentColors: centroids.map(c => [c, c, c])
    };
  }

  /**
   * Segment color image using k-means in LAB space
   */
  segmentColor(image: ColorImage): SegmentationResult {
    const { width, height, data } = image;

    // Convert to LAB
    const labData: number[][][] = [];
    for (let y = 0; y < height; y++) {
      labData[y] = [];
      for (let x = 0; x < width; x++) {
        const [r, g, b] = data[y][x];
        labData[y][x] = rgbToLab(r, g, b);
      }
    }

    // Initialize centroids
    const centroids: number[][] = [];
    for (let i = 0; i < this.k; i++) {
      const y = Math.floor(Math.random() * height);
      const x = Math.floor(Math.random() * width);
      centroids.push([...labData[y][x]]);
    }

    const labels: number[][] = [];
    for (let y = 0; y < height; y++) {
      labels[y] = new Array(width).fill(0);
    }

    // Iterate
    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Assign labels
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const color = labData[y][x];
          let minDist = Infinity;
          let bestLabel = 0;

          for (let k = 0; k < this.k; k++) {
            const dist = colorDistance(color, centroids[k]);
            if (dist < minDist) {
              minDist = dist;
              bestLabel = k;
            }
          }

          labels[y][x] = bestLabel;
        }
      }

      // Update centroids
      const newCentroids = Array.from({ length: this.k }, () => [0, 0, 0]);
      const counts = new Array(this.k).fill(0);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const label = labels[y][x];
          const color = labData[y][x];
          newCentroids[label][0] += color[0];
          newCentroids[label][1] += color[1];
          newCentroids[label][2] += color[2];
          counts[label]++;
        }
      }

      let converged = true;
      for (let k = 0; k < this.k; k++) {
        if (counts[k] > 0) {
          newCentroids[k][0] /= counts[k];
          newCentroids[k][1] /= counts[k];
          newCentroids[k][2] /= counts[k];
        }
        if (colorDistance(newCentroids[k], centroids[k]) > this.tolerance) {
          converged = false;
        }
        centroids[k] = newCentroids[k];
      }

      if (converged) break;
    }

    // Compute segment sizes and colors
    const segmentSizes = new Array(this.k).fill(0);
    const segmentColors: number[][] = Array.from({ length: this.k }, () => [0, 0, 0]);
    const colorCounts = new Array(this.k).fill(0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const label = labels[y][x];
        segmentSizes[label]++;
        const [r, g, b] = data[y][x];
        segmentColors[label][0] += r;
        segmentColors[label][1] += g;
        segmentColors[label][2] += b;
        colorCounts[label]++;
      }
    }

    for (let k = 0; k < this.k; k++) {
      if (colorCounts[k] > 0) {
        segmentColors[k][0] = Math.round(segmentColors[k][0] / colorCounts[k]);
        segmentColors[k][1] = Math.round(segmentColors[k][1] / colorCounts[k]);
        segmentColors[k][2] = Math.round(segmentColors[k][2] / colorCounts[k]);
      }
    }

    return {
      labels,
      numSegments: this.k,
      segmentSizes,
      segmentColors
    };
  }
}

// ============================================================================
// MEAN SHIFT SEGMENTATION
// ============================================================================

class MeanShiftSegmenter {
  private spatialBandwidth: number;
  private colorBandwidth: number;
  private maxIterations: number;
  private convergenceThreshold: number;

  constructor(
    spatialBandwidth: number = 20,
    colorBandwidth: number = 30,
    maxIterations: number = 50,
    convergenceThreshold: number = 1
  ) {
    this.spatialBandwidth = spatialBandwidth;
    this.colorBandwidth = colorBandwidth;
    this.maxIterations = maxIterations;
    this.convergenceThreshold = convergenceThreshold;
  }

  /**
   * Gaussian kernel
   */
  private kernel(distance: number, bandwidth: number): number {
    return Math.exp(-(distance ** 2) / (2 * bandwidth ** 2));
  }

  /**
   * Segment grayscale image using mean shift
   */
  segment(image: GrayscaleImage): SegmentationResult {
    const { width, height, data } = image;

    // For each pixel, find the mode
    const modes: number[][] = [];
    for (let y = 0; y < height; y++) {
      modes[y] = [];
      for (let x = 0; x < width; x++) {
        modes[y][x] = this.findMode(image, x, y);
      }
    }

    // Cluster modes
    const labels = this.clusterModes(modes, width, height);

    // Count unique labels
    const labelSet = new Set<number>();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        labelSet.add(labels[y][x]);
      }
    }

    const numSegments = labelSet.size;
    const segmentSizes = new Array(numSegments).fill(0);

    // Remap labels to consecutive integers
    const labelMap = new Map<number, number>();
    let nextLabel = 0;
    for (const label of labelSet) {
      labelMap.set(label, nextLabel++);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const oldLabel = labels[y][x];
        const newLabel = labelMap.get(oldLabel) || 0;
        labels[y][x] = newLabel;
        segmentSizes[newLabel]++;
      }
    }

    return {
      labels,
      numSegments,
      segmentSizes
    };
  }

  /**
   * Find mode for a pixel using mean shift
   */
  private findMode(image: GrayscaleImage, startX: number, startY: number): number {
    const { width, height, data } = image;

    let cx = startX;
    let cy = startY;
    let cValue = data[startY][startX];

    for (let iter = 0; iter < this.maxIterations; iter++) {
      let sumX = 0, sumY = 0, sumValue = 0, sumWeight = 0;

      // Search in spatial window
      const minY = Math.max(0, Math.floor(cy - this.spatialBandwidth));
      const maxY = Math.min(height - 1, Math.ceil(cy + this.spatialBandwidth));
      const minX = Math.max(0, Math.floor(cx - this.spatialBandwidth));
      const maxX = Math.min(width - 1, Math.ceil(cx + this.spatialBandwidth));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const spatialDist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          const colorDist = Math.abs(data[y][x] - cValue);

          if (spatialDist <= this.spatialBandwidth && colorDist <= this.colorBandwidth) {
            const weight = this.kernel(spatialDist, this.spatialBandwidth) *
                          this.kernel(colorDist, this.colorBandwidth);

            sumX += x * weight;
            sumY += y * weight;
            sumValue += data[y][x] * weight;
            sumWeight += weight;
          }
        }
      }

      if (sumWeight > 0) {
        const newX = sumX / sumWeight;
        const newY = sumY / sumWeight;
        const newValue = sumValue / sumWeight;

        const shift = Math.sqrt((newX - cx) ** 2 + (newY - cy) ** 2);

        cx = newX;
        cy = newY;
        cValue = newValue;

        if (shift < this.convergenceThreshold) break;
      }
    }

    return Math.round(cValue);
  }

  /**
   * Cluster modes into segments
   */
  private clusterModes(modes: number[][], width: number, height: number): number[][] {
    const labels: number[][] = [];
    for (let y = 0; y < height; y++) {
      labels[y] = new Array(width).fill(-1);
    }

    const modeThreshold = this.colorBandwidth / 2;
    let currentLabel = 0;
    const modeToLabel = new Map<number, number>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const mode = modes[y][x];

        // Find existing label for similar mode
        let foundLabel = -1;
        for (const [existingMode, label] of modeToLabel) {
          if (Math.abs(mode - existingMode) < modeThreshold) {
            foundLabel = label;
            break;
          }
        }

        if (foundLabel >= 0) {
          labels[y][x] = foundLabel;
        } else {
          modeToLabel.set(mode, currentLabel);
          labels[y][x] = currentLabel;
          currentLabel++;
        }
      }
    }

    return labels;
  }
}

// ============================================================================
// WATERSHED SEGMENTATION
// ============================================================================

class WatershedSegmenter {
  /**
   * Compute gradient magnitude for watershed
   */
  private computeGradient(image: GrayscaleImage): number[][] {
    const { width, height, data } = image;
    const gradient: number[][] = [];

    for (let y = 0; y < height; y++) {
      gradient[y] = [];
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          gradient[y][x] = 0;
          continue;
        }

        const gx = data[y][x + 1] - data[y][x - 1];
        const gy = data[y + 1][x] - data[y - 1][x];
        gradient[y][x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    return gradient;
  }

  /**
   * Segment using watershed algorithm (marker-based)
   */
  segment(image: GrayscaleImage, markers?: number[][]): SegmentationResult {
    const { width, height } = image;
    const gradient = this.computeGradient(image);

    // Initialize labels from markers or use threshold-based initialization
    const labels: number[][] = [];
    for (let y = 0; y < height; y++) {
      labels[y] = new Array(width).fill(-1); // -1 = unlabeled
    }

    let numLabels = 0;

    if (markers) {
      // Use provided markers
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (markers[y][x] > 0) {
            labels[y][x] = markers[y][x];
            numLabels = Math.max(numLabels, markers[y][x] + 1);
          }
        }
      }
    } else {
      // Auto-generate markers using local minima
      numLabels = this.findLocalMinima(gradient, labels);
    }

    // Priority queue simulation using sorted array
    const queue: { x: number; y: number; priority: number }[] = [];

    // Add border pixels of labeled regions to queue
    const dx = [-1, 0, 1, 0, -1, 1, 1, -1];
    const dy = [0, -1, 0, 1, -1, -1, 1, 1];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labels[y][x] >= 0) {
          for (let d = 0; d < 8; d++) {
            const nx = x + dx[d];
            const ny = y + dy[d];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && labels[ny][nx] < 0) {
              queue.push({ x, y, priority: gradient[y][x] });
              break;
            }
          }
        }
      }
    }

    // Process queue (flooding)
    while (queue.length > 0) {
      // Sort and get minimum (inefficient but simple)
      queue.sort((a, b) => a.priority - b.priority);
      const { x, y } = queue.shift()!;

      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        if (labels[ny][nx] < 0) {
          // Unlabeled - propagate label
          labels[ny][nx] = labels[y][x];
          queue.push({ x: nx, y: ny, priority: gradient[ny][nx] });
        } else if (labels[ny][nx] !== labels[y][x] && labels[ny][nx] >= 0) {
          // Different label - this is a watershed line
          // Mark as boundary (using -2)
          // For simplicity, we'll keep the first label
        }
      }
    }

    // Fill remaining unlabeled pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labels[y][x] < 0) {
          labels[y][x] = 0;
        }
      }
    }

    // Compute segment sizes
    const segmentSizes = new Array(numLabels).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const label = labels[y][x];
        if (label >= 0 && label < numLabels) {
          segmentSizes[label]++;
        }
      }
    }

    return {
      labels,
      numSegments: numLabels,
      segmentSizes
    };
  }

  /**
   * Find local minima in gradient for auto markers
   */
  private findLocalMinima(gradient: number[][], labels: number[][]): number {
    const height = gradient.length;
    const width = gradient[0].length;

    let labelCount = 0;
    const dx = [-1, 0, 1, 0];
    const dy = [0, -1, 0, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const value = gradient[y][x];
        let isMinimum = true;

        for (let d = 0; d < 4; d++) {
          if (gradient[y + dy[d]][x + dx[d]] < value) {
            isMinimum = false;
            break;
          }
        }

        if (isMinimum && value < 50) { // Threshold for minima
          labels[y][x] = labelCount++;
        }
      }
    }

    return labelCount;
  }
}

// ============================================================================
// REGION GROWING
// ============================================================================

class RegionGrowingSegmenter {
  private threshold: number;

  constructor(threshold: number = 20) {
    this.threshold = threshold;
  }

  /**
   * Segment using region growing from seeds
   */
  segment(image: GrayscaleImage, seeds?: { x: number; y: number }[]): SegmentationResult {
    const { width, height, data } = image;

    const labels: number[][] = [];
    for (let y = 0; y < height; y++) {
      labels[y] = new Array(width).fill(-1);
    }

    // Generate seeds if not provided
    if (!seeds || seeds.length === 0) {
      seeds = this.generateSeeds(image, 10);
    }

    const dx = [-1, 0, 1, 0, -1, 1, 1, -1];
    const dy = [0, -1, 0, 1, -1, -1, 1, 1];

    let labelCount = 0;

    for (const seed of seeds) {
      if (labels[seed.y][seed.x] >= 0) continue;

      const label = labelCount++;
      const queue: { x: number; y: number }[] = [seed];
      labels[seed.y][seed.x] = label;
      const seedValue = data[seed.y][seed.x];

      while (queue.length > 0) {
        const { x, y } = queue.shift()!;
        const currentValue = data[y][x];

        for (let d = 0; d < 8; d++) {
          const nx = x + dx[d];
          const ny = y + dy[d];

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (labels[ny][nx] >= 0) continue;

          const neighborValue = data[ny][nx];
          const diff = Math.abs(neighborValue - currentValue);
          const diffFromSeed = Math.abs(neighborValue - seedValue);

          if (diff < this.threshold && diffFromSeed < this.threshold * 2) {
            labels[ny][nx] = label;
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    // Label remaining pixels with nearest region
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labels[y][x] < 0) {
          labels[y][x] = this.findNearestLabel(labels, x, y, width, height);
        }
      }
    }

    // Compute segment sizes
    const segmentSizes = new Array(labelCount).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const label = labels[y][x];
        if (label >= 0 && label < labelCount) {
          segmentSizes[label]++;
        }
      }
    }

    return {
      labels,
      numSegments: labelCount,
      segmentSizes
    };
  }

  /**
   * Generate seed points using grid sampling
   */
  private generateSeeds(image: GrayscaleImage, numSeeds: number): { x: number; y: number }[] {
    const seeds: { x: number; y: number }[] = [];
    const gridSize = Math.ceil(Math.sqrt(numSeeds));
    const stepX = image.width / gridSize;
    const stepY = image.height / gridSize;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = Math.floor(stepX * (j + 0.5));
        const y = Math.floor(stepY * (i + 0.5));
        if (x < image.width && y < image.height) {
          seeds.push({ x, y });
        }
      }
    }

    return seeds;
  }

  /**
   * Find nearest labeled pixel
   */
  private findNearestLabel(
    labels: number[][],
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    for (let radius = 1; radius < Math.max(width, height); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && labels[ny][nx] >= 0) {
            return labels[ny][nx];
          }
        }
      }
    }
    return 0;
  }
}

// ============================================================================
// FELZENSZWALB GRAPH-BASED SEGMENTATION
// ============================================================================

class GraphSegmenter {
  private k: number; // Scale parameter
  private minSize: number;

  constructor(k: number = 300, minSize: number = 50) {
    this.k = k;
    this.minSize = minSize;
  }

  /**
   * Segment using graph-based method (Felzenszwalb)
   */
  segment(image: GrayscaleImage): SegmentationResult {
    const { width, height, data } = image;
    const numPixels = width * height;

    // Build edge list
    const edges: { u: number; v: number; w: number }[] = [];
    const dx = [1, 0, 1, 1];
    const dy = [0, 1, 1, -1];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = y * width + x;

        for (let d = 0; d < 4; d++) {
          const nx = x + dx[d];
          const ny = y + dy[d];

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const v = ny * width + nx;
            const w = Math.abs(data[y][x] - data[ny][nx]);
            edges.push({ u, v, w });
          }
        }
      }
    }

    // Sort edges by weight
    edges.sort((a, b) => a.w - b.w);

    // Union-Find data structure
    const parent = new Array(numPixels);
    const rank = new Array(numPixels).fill(0);
    const size = new Array(numPixels).fill(1);
    const threshold = new Array(numPixels).fill(this.k);

    for (let i = 0; i < numPixels; i++) {
      parent[i] = i;
    }

    const find = (x: number): number => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    };

    const union = (x: number, y: number): void => {
      const px = find(x);
      const py = find(y);

      if (px === py) return;

      if (rank[px] < rank[py]) {
        parent[px] = py;
        size[py] += size[px];
      } else if (rank[px] > rank[py]) {
        parent[py] = px;
        size[px] += size[py];
      } else {
        parent[py] = px;
        size[px] += size[py];
        rank[px]++;
      }
    };

    // Process edges
    for (const edge of edges) {
      const pu = find(edge.u);
      const pv = find(edge.v);

      if (pu !== pv) {
        const threshU = threshold[pu];
        const threshV = threshold[pv];

        if (edge.w <= threshU && edge.w <= threshV) {
          union(pu, pv);
          const newRoot = find(pu);
          threshold[newRoot] = edge.w + this.k / size[newRoot];
        }
      }
    }

    // Merge small segments
    for (const edge of edges) {
      const pu = find(edge.u);
      const pv = find(edge.v);

      if (pu !== pv && (size[pu] < this.minSize || size[pv] < this.minSize)) {
        union(pu, pv);
      }
    }

    // Create label map
    const rootToLabel = new Map<number, number>();
    let labelCount = 0;

    const labels: number[][] = [];
    for (let y = 0; y < height; y++) {
      labels[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const root = find(idx);

        if (!rootToLabel.has(root)) {
          rootToLabel.set(root, labelCount++);
        }

        labels[y][x] = rootToLabel.get(root)!;
      }
    }

    // Compute segment sizes
    const segmentSizes = new Array(labelCount).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        segmentSizes[labels[y][x]]++;
      }
    }

    return {
      labels,
      numSegments: labelCount,
      segmentSizes
    };
  }
}

// ============================================================================
// SLIC-LIKE SUPERPIXEL SEGMENTATION
// ============================================================================

class SuperpixelSegmenter {
  private numSuperpixels: number;
  private compactness: number;
  private maxIterations: number;

  constructor(
    numSuperpixels: number = 100,
    compactness: number = 10,
    maxIterations: number = 10
  ) {
    this.numSuperpixels = numSuperpixels;
    this.compactness = compactness;
    this.maxIterations = maxIterations;
  }

  /**
   * Generate superpixels using SLIC-like algorithm
   */
  segment(image: GrayscaleImage): SegmentationResult {
    const { width, height, data } = image;

    // Calculate grid step
    const totalPixels = width * height;
    const step = Math.sqrt(totalPixels / this.numSuperpixels);

    // Initialize cluster centers
    const centers: { x: number; y: number; value: number }[] = [];
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        const cx = Math.min(Math.floor(x), width - 1);
        const cy = Math.min(Math.floor(y), height - 1);
        centers.push({
          x: cx,
          y: cy,
          value: data[cy][cx]
        });
      }
    }

    // Move centers to lowest gradient position in 3x3 neighborhood
    const gradient = this.computeGradient(data, width, height);
    for (const center of centers) {
      let minGrad = Infinity;
      let bestX = center.x;
      let bestY = center.y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = center.x + dx;
          const ny = center.y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (gradient[ny][nx] < minGrad) {
              minGrad = gradient[ny][nx];
              bestX = nx;
              bestY = ny;
            }
          }
        }
      }

      center.x = bestX;
      center.y = bestY;
      center.value = data[bestY][bestX];
    }

    const labels: number[][] = [];
    for (let y = 0; y < height; y++) {
      labels[y] = new Array(width).fill(-1);
    }

    const distances: number[][] = [];
    for (let y = 0; y < height; y++) {
      distances[y] = new Array(width).fill(Infinity);
    }

    // Iterate
    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Reset distances
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          distances[y][x] = Infinity;
        }
      }

      // Assign pixels to nearest center
      for (let k = 0; k < centers.length; k++) {
        const center = centers[k];
        const minX = Math.max(0, Math.floor(center.x - 2 * step));
        const maxX = Math.min(width - 1, Math.ceil(center.x + 2 * step));
        const minY = Math.max(0, Math.floor(center.y - 2 * step));
        const maxY = Math.min(height - 1, Math.ceil(center.y + 2 * step));

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dc = Math.abs(data[y][x] - center.value);
            const ds = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
            const D = Math.sqrt(dc ** 2 + (ds / step) ** 2 * this.compactness ** 2);

            if (D < distances[y][x]) {
              distances[y][x] = D;
              labels[y][x] = k;
            }
          }
        }
      }

      // Update centers
      const sums = centers.map(() => ({ x: 0, y: 0, value: 0, count: 0 }));

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const k = labels[y][x];
          if (k >= 0) {
            sums[k].x += x;
            sums[k].y += y;
            sums[k].value += data[y][x];
            sums[k].count++;
          }
        }
      }

      for (let k = 0; k < centers.length; k++) {
        if (sums[k].count > 0) {
          centers[k].x = sums[k].x / sums[k].count;
          centers[k].y = sums[k].y / sums[k].count;
          centers[k].value = sums[k].value / sums[k].count;
        }
      }
    }

    // Enforce connectivity
    this.enforceConnectivity(labels, width, height);

    // Compute segment sizes
    const numSegments = centers.length;
    const segmentSizes = new Array(numSegments).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const label = labels[y][x];
        if (label >= 0 && label < numSegments) {
          segmentSizes[label]++;
        }
      }
    }

    return {
      labels,
      numSegments,
      segmentSizes
    };
  }

  /**
   * Compute gradient magnitude
   */
  private computeGradient(data: number[][], width: number, height: number): number[][] {
    const gradient: number[][] = [];

    for (let y = 0; y < height; y++) {
      gradient[y] = [];
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          gradient[y][x] = 0;
          continue;
        }

        const gx = data[y][x + 1] - data[y][x - 1];
        const gy = data[y + 1][x] - data[y - 1][x];
        gradient[y][x] = gx * gx + gy * gy;
      }
    }

    return gradient;
  }

  /**
   * Enforce connectivity of superpixels
   */
  private enforceConnectivity(labels: number[][], width: number, height: number): void {
    const dx = [-1, 0, 1, 0];
    const dy = [0, -1, 0, 1];
    const visited: boolean[][] = [];

    for (let y = 0; y < height; y++) {
      visited[y] = new Array(width).fill(false);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labels[y][x] < 0) {
          // Find nearest valid label
          for (let d = 0; d < 4; d++) {
            const nx = x + dx[d];
            const ny = y + dy[d];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && labels[ny][nx] >= 0) {
              labels[y][x] = labels[ny][nx];
              break;
            }
          }
        }
      }
    }
  }
}

// ============================================================================
// CONNECTED COMPONENT LABELING
// ============================================================================

function connectedComponents(binaryImage: number[][]): SegmentationResult {
  const height = binaryImage.length;
  const width = binaryImage[0].length;

  const labels: number[][] = [];
  for (let y = 0; y < height; y++) {
    labels[y] = new Array(width).fill(0);
  }

  let currentLabel = 0;
  const dx = [-1, 0, 1, 0];
  const dy = [0, -1, 0, 1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binaryImage[y][x] > 0 && labels[y][x] === 0) {
        currentLabel++;
        const queue: { x: number; y: number }[] = [{ x, y }];
        labels[y][x] = currentLabel;

        while (queue.length > 0) {
          const { x: cx, y: cy } = queue.shift()!;

          for (let d = 0; d < 4; d++) {
            const nx = cx + dx[d];
            const ny = cy + dy[d];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                binaryImage[ny][nx] > 0 && labels[ny][nx] === 0) {
              labels[ny][nx] = currentLabel;
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }
    }
  }

  // Compute segment sizes
  const segmentSizes = new Array(currentLabel + 1).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      segmentSizes[labels[y][x]]++;
    }
  }

  return {
    labels,
    numSegments: currentLabel + 1,
    segmentSizes
  };
}

// ============================================================================
// TEST IMAGE GENERATION
// ============================================================================

function generateTestImage(
  width: number,
  height: number,
  pattern: 'blobs' | 'gradient' | 'checkerboard' | 'circles'
): GrayscaleImage {
  const data: number[][] = [];

  for (let y = 0; y < height; y++) {
    data[y] = [];
    for (let x = 0; x < width; x++) {
      data[y][x] = 128;
    }
  }

  switch (pattern) {
    case 'blobs': {
      const blobs = [
        { cx: width * 0.25, cy: height * 0.25, r: 30, value: 50 },
        { cx: width * 0.75, cy: height * 0.25, r: 40, value: 200 },
        { cx: width * 0.5, cy: height * 0.6, r: 50, value: 100 },
        { cx: width * 0.3, cy: height * 0.75, r: 25, value: 220 }
      ];

      for (const blob of blobs) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const dist = Math.sqrt((x - blob.cx) ** 2 + (y - blob.cy) ** 2);
            if (dist < blob.r) {
              data[y][x] = blob.value;
            }
          }
        }
      }
      break;
    }

    case 'gradient': {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          data[y][x] = Math.floor((x / width) * 255);
        }
      }
      break;
    }

    case 'checkerboard': {
      const squareSize = 20;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const sx = Math.floor(x / squareSize);
          const sy = Math.floor(y / squareSize);
          data[y][x] = ((sx + sy) % 2 === 0) ? 200 : 50;
        }
      }
      break;
    }

    case 'circles': {
      const cx = width / 2;
      const cy = height / 2;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          data[y][x] = Math.floor(Math.abs(Math.sin(dist / 10) * 127 + 128));
        }
      }
      break;
    }
  }

  return { width, height, data };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const imagesegmentationTool: UnifiedTool = {
  name: 'image_segmentation',
  description: 'Image segmentation using k-means, mean shift, watershed, region growing, graph-based, and superpixels',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'kmeans', 'mean_shift', 'watershed', 'region_growing',
          'graph_based', 'superpixels', 'connected_components',
          'demo', 'info', 'examples'
        ],
        description: 'Segmentation algorithm to use'
      },
      image: {
        type: 'object',
        description: 'Grayscale image { width, height, data: number[][] }',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          data: { type: 'array' }
        }
      },
      params: {
        type: 'object',
        description: 'Algorithm-specific parameters',
        properties: {
          k: { type: 'number', description: 'Number of clusters for k-means' },
          spatialBandwidth: { type: 'number', description: 'Spatial bandwidth for mean shift' },
          colorBandwidth: { type: 'number', description: 'Color bandwidth for mean shift' },
          threshold: { type: 'number', description: 'Threshold for region growing' },
          minSize: { type: 'number', description: 'Minimum segment size for graph-based' },
          numSuperpixels: { type: 'number', description: 'Number of superpixels' },
          compactness: { type: 'number', description: 'Compactness for superpixels' }
        }
      },
      seeds: {
        type: 'array',
        description: 'Seed points for region growing [{x, y}, ...]'
      },
      markers: {
        type: 'array',
        description: 'Marker image for watershed'
      },
      testPattern: {
        type: 'string',
        enum: ['blobs', 'gradient', 'checkerboard', 'circles'],
        description: 'Test pattern for demo'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeimagesegmentation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, params, seeds, markers, testPattern } = args;

    let result: unknown;

    switch (operation) {
      case 'kmeans': {
        if (!image) throw new Error('Image required');

        const k = params?.k ?? 5;
        const segmenter = new KMeansSegmenter(k);
        const segResult = segmenter.segmentGrayscale(image);

        result = {
          operation: 'kmeans',
          k,
          numSegments: segResult.numSegments,
          segmentSizes: segResult.segmentSizes,
          labelMapSample: segResult.labels.filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) => row.filter((_: number, j: number) => j % 4 === 0))
        };
        break;
      }

      case 'mean_shift': {
        if (!image) throw new Error('Image required');

        const segmenter = new MeanShiftSegmenter(
          params?.spatialBandwidth ?? 20,
          params?.colorBandwidth ?? 30
        );
        const segResult = segmenter.segment(image);

        result = {
          operation: 'mean_shift',
          spatialBandwidth: params?.spatialBandwidth ?? 20,
          colorBandwidth: params?.colorBandwidth ?? 30,
          numSegments: segResult.numSegments,
          segmentSizes: segResult.segmentSizes.slice(0, 20),
          labelMapSample: segResult.labels.filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) => row.filter((_: number, j: number) => j % 4 === 0))
        };
        break;
      }

      case 'watershed': {
        if (!image) throw new Error('Image required');

        const segmenter = new WatershedSegmenter();
        const segResult = segmenter.segment(image, markers);

        result = {
          operation: 'watershed',
          numSegments: segResult.numSegments,
          segmentSizes: segResult.segmentSizes.slice(0, 20),
          labelMapSample: segResult.labels.filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) => row.filter((_: number, j: number) => j % 4 === 0))
        };
        break;
      }

      case 'region_growing': {
        if (!image) throw new Error('Image required');

        const segmenter = new RegionGrowingSegmenter(params?.threshold ?? 20);
        const segResult = segmenter.segment(image, seeds);

        result = {
          operation: 'region_growing',
          threshold: params?.threshold ?? 20,
          numSeeds: seeds?.length ?? 'auto-generated',
          numSegments: segResult.numSegments,
          segmentSizes: segResult.segmentSizes,
          labelMapSample: segResult.labels.filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) => row.filter((_: number, j: number) => j % 4 === 0))
        };
        break;
      }

      case 'graph_based': {
        if (!image) throw new Error('Image required');

        const segmenter = new GraphSegmenter(
          params?.k ?? 300,
          params?.minSize ?? 50
        );
        const segResult = segmenter.segment(image);

        result = {
          operation: 'graph_based',
          scaleParameter: params?.k ?? 300,
          minSize: params?.minSize ?? 50,
          numSegments: segResult.numSegments,
          segmentSizes: segResult.segmentSizes.slice(0, 20),
          labelMapSample: segResult.labels.filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) => row.filter((_: number, j: number) => j % 4 === 0))
        };
        break;
      }

      case 'superpixels': {
        if (!image) throw new Error('Image required');

        const segmenter = new SuperpixelSegmenter(
          params?.numSuperpixels ?? 100,
          params?.compactness ?? 10
        );
        const segResult = segmenter.segment(image);

        result = {
          operation: 'superpixels',
          numSuperpixels: params?.numSuperpixels ?? 100,
          compactness: params?.compactness ?? 10,
          actualNumSegments: segResult.numSegments,
          segmentSizes: segResult.segmentSizes.slice(0, 20),
          labelMapSample: segResult.labels.filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) => row.filter((_: number, j: number) => j % 4 === 0))
        };
        break;
      }

      case 'connected_components': {
        if (!image) throw new Error('Image required');

        // Threshold to binary
        const binary: number[][] = image.data.map((row: number[]) =>
          row.map((v: number) => v > 128 ? 1 : 0)
        );

        const segResult = connectedComponents(binary);

        result = {
          operation: 'connected_components',
          numComponents: segResult.numSegments - 1, // Subtract background
          componentSizes: segResult.segmentSizes.slice(1),
          labelMapSample: segResult.labels.filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) => row.filter((_: number, j: number) => j % 4 === 0))
        };
        break;
      }

      case 'demo': {
        const pattern = testPattern || 'blobs';
        const testImage = generateTestImage(100, 100, pattern);

        // Run multiple algorithms
        const kmeansResult = new KMeansSegmenter(4).segmentGrayscale(testImage);
        const graphResult = new GraphSegmenter(200, 30).segment(testImage);
        const superpixelResult = new SuperpixelSegmenter(50).segment(testImage);

        result = {
          operation: 'demo',
          testPattern: pattern,
          imageSize: { width: 100, height: 100 },
          algorithms: {
            kmeans: {
              k: 4,
              numSegments: kmeansResult.numSegments,
              segmentSizes: kmeansResult.segmentSizes
            },
            graphBased: {
              numSegments: graphResult.numSegments,
              segmentSizes: graphResult.segmentSizes.slice(0, 10)
            },
            superpixels: {
              numSegments: superpixelResult.numSegments,
              avgSegmentSize: Math.round(10000 / superpixelResult.numSegments)
            }
          }
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'K-means segmentation',
              code: `{
  "operation": "kmeans",
  "image": { "width": 100, "height": 100, "data": [[...]] },
  "params": { "k": 5 }
}`
            },
            {
              name: 'Mean shift segmentation',
              code: `{
  "operation": "mean_shift",
  "image": { ... },
  "params": { "spatialBandwidth": 20, "colorBandwidth": 30 }
}`
            },
            {
              name: 'Watershed segmentation',
              code: `{
  "operation": "watershed",
  "image": { ... }
}`
            },
            {
              name: 'Region growing',
              code: `{
  "operation": "region_growing",
  "image": { ... },
  "seeds": [{ "x": 50, "y": 50 }, { "x": 150, "y": 100 }],
  "params": { "threshold": 25 }
}`
            },
            {
              name: 'Graph-based (Felzenszwalb)',
              code: `{
  "operation": "graph_based",
  "image": { ... },
  "params": { "k": 300, "minSize": 50 }
}`
            },
            {
              name: 'Superpixels',
              code: `{
  "operation": "superpixels",
  "image": { ... },
  "params": { "numSuperpixels": 100, "compactness": 10 }
}`
            },
            {
              name: 'Demo with test pattern',
              code: `{
  "operation": "demo",
  "testPattern": "blobs"
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
          tool: 'image_segmentation',
          description: 'Comprehensive image segmentation algorithms',
          algorithms: {
            kmeans: {
              description: 'Partition pixels into k clusters by color similarity',
              parameters: ['k: number of clusters'],
              complexity: 'O(n*k*iterations)'
            },
            mean_shift: {
              description: 'Find modes in feature space using kernel density estimation',
              parameters: ['spatialBandwidth', 'colorBandwidth'],
              complexity: 'O(n²) per iteration'
            },
            watershed: {
              description: 'Treat gradient as topographic surface and flood from markers',
              parameters: ['markers (optional)'],
              complexity: 'O(n log n)'
            },
            region_growing: {
              description: 'Grow regions from seeds based on similarity criterion',
              parameters: ['threshold', 'seeds'],
              complexity: 'O(n)'
            },
            graph_based: {
              description: 'Felzenszwalb algorithm using minimum spanning tree',
              parameters: ['k: scale parameter', 'minSize'],
              complexity: 'O(n log n)'
            },
            superpixels: {
              description: 'SLIC-like algorithm for compact superpixel generation',
              parameters: ['numSuperpixels', 'compactness'],
              complexity: 'O(n*iterations)'
            },
            connected_components: {
              description: 'Label connected regions in binary image',
              parameters: ['binary threshold'],
              complexity: 'O(n)'
            }
          },
          operations: [
            'kmeans', 'mean_shift', 'watershed', 'region_growing',
            'graph_based', 'superpixels', 'connected_components',
            'demo', 'info', 'examples'
          ]
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
      content: `Error in image_segmentation: ${error}`,
      isError: true
    };
  }
}

export function isimagesegmentationAvailable(): boolean {
  return true;
}
