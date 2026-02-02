/**
 * ORB FEATURES TOOL
 * Oriented FAST and Rotated BRIEF feature detection and description
 *
 * Features:
 * - FAST corner detection
 * - Harris corner measure for keypoint selection
 * - Orientation computation using intensity centroid
 * - BRIEF descriptor computation
 * - Rotation invariance via steered BRIEF
 * - Scale pyramid construction
 * - Non-maximal suppression
 * - Feature matching (brute force)
 * - Homography estimation from matches
 * - RANSAC outlier rejection
 * - Descriptor comparison (Hamming distance)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GrayscaleImage {
  width: number;
  height: number;
  data: number[][];
}

interface Keypoint {
  x: number;
  y: number;
  scale: number;
  angle: number;
  response: number;
  octave: number;
}

interface ORBDescriptor {
  keypoint: Keypoint;
  descriptor: Uint8Array; // 256-bit = 32 bytes
}

interface FeatureMatch {
  queryIdx: number;
  trainIdx: number;
  distance: number;
}

interface HomographyResult {
  H: number[][];
  inliers: number[];
  numInliers: number;
  reprojectionError: number;
}

// ============================================================================
// IMAGE UTILITIES
// ============================================================================

function createImage(width: number, height: number, value: number = 0): GrayscaleImage {
  const data: number[][] = [];
  for (let y = 0; y < height; y++) {
    data[y] = new Array(width).fill(value);
  }
  return { width, height, data };
}

function getPixel(img: GrayscaleImage, x: number, y: number): number {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return 0;
  return img.data[Math.floor(y)][Math.floor(x)];
}

function gaussianBlur(img: GrayscaleImage, sigma: number = 1.0): GrayscaleImage {
  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel: number[][] = [];
  let sum = 0;

  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - Math.floor(size / 2);
      const dy = y - Math.floor(size / 2);
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = value;
      sum += value;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  const { width, height } = img;
  const result = createImage(width, height);
  const half = Math.floor(size / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let ky = 0; ky < size; ky++) {
        for (let kx = 0; kx < size; kx++) {
          val += getPixel(img, x + kx - half, y + ky - half) * kernel[ky][kx];
        }
      }
      result.data[y][x] = val;
    }
  }

  return result;
}

function downsample(img: GrayscaleImage, factor: number = 2): GrayscaleImage {
  const newWidth = Math.floor(img.width / factor);
  const newHeight = Math.floor(img.height / factor);
  const result = createImage(newWidth, newHeight);

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      let sum = 0, count = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          sum += getPixel(img, x * factor + dx, y * factor + dy);
          count++;
        }
      }
      result.data[y][x] = sum / count;
    }
  }

  return result;
}

// ============================================================================
// FAST CORNER DETECTION
// ============================================================================

class FASTDetector {
  private threshold: number;
  private n: number; // Number of contiguous pixels

  // Circle of 16 pixels at radius 3
  private static readonly CIRCLE_OFFSETS: [number, number][] = [
    [0, -3], [1, -3], [2, -2], [3, -1],
    [3, 0], [3, 1], [2, 2], [1, 3],
    [0, 3], [-1, 3], [-2, 2], [-3, 1],
    [-3, 0], [-3, -1], [-2, -2], [-1, -3]
  ];

  constructor(threshold: number = 20, n: number = 9) {
    this.threshold = threshold;
    this.n = n;
  }

  /**
   * Detect FAST corners
   */
  detect(image: GrayscaleImage): Keypoint[] {
    const { width, height, data } = image;
    const corners: Keypoint[] = [];

    for (let y = 3; y < height - 3; y++) {
      for (let x = 3; x < width - 3; x++) {
        if (this.isCorner(data, x, y, width)) {
          const response = this.cornerResponse(data, x, y);
          corners.push({
            x,
            y,
            scale: 1,
            angle: 0,
            response,
            octave: 0
          });
        }
      }
    }

    return corners;
  }

  /**
   * Fast corner test
   */
  private isCorner(data: number[][], x: number, y: number, _width: number): boolean {
    const center = data[y][x];
    const t = this.threshold;

    // Quick reject using pixels 1, 5, 9, 13 (N, E, S, W)
    const p1 = data[y - 3][x];
    const p5 = data[y][x + 3];
    const p9 = data[y + 3][x];
    const p13 = data[y][x - 3];

    let brighterCount = 0;
    let darkerCount = 0;

    if (p1 > center + t) brighterCount++;
    else if (p1 < center - t) darkerCount++;

    if (p5 > center + t) brighterCount++;
    else if (p5 < center - t) darkerCount++;

    if (p9 > center + t) brighterCount++;
    else if (p9 < center - t) darkerCount++;

    if (p13 > center + t) brighterCount++;
    else if (p13 < center - t) darkerCount++;

    if (brighterCount < 3 && darkerCount < 3) return false;

    // Full corner test
    let brighter = 0;
    let darker = 0;
    let maxBrighter = 0;
    let maxDarker = 0;

    // Check all 16 pixels on the circle
    for (let i = 0; i < 32; i++) { // Go around twice for wraparound
      const idx = i % 16;
      const [dx, dy] = FASTDetector.CIRCLE_OFFSETS[idx];
      const p = data[y + dy][x + dx];

      if (p > center + t) {
        brighter++;
        darker = 0;
        maxBrighter = Math.max(maxBrighter, brighter);
      } else if (p < center - t) {
        darker++;
        brighter = 0;
        maxDarker = Math.max(maxDarker, darker);
      } else {
        brighter = 0;
        darker = 0;
      }
    }

    return maxBrighter >= this.n || maxDarker >= this.n;
  }

  /**
   * Compute corner response for ranking
   */
  private cornerResponse(data: number[][], x: number, y: number): number {
    const center = data[y][x];
    let sum = 0;

    for (const [dx, dy] of FASTDetector.CIRCLE_OFFSETS) {
      const diff = Math.abs(data[y + dy][x + dx] - center);
      sum += diff;
    }

    return sum;
  }
}

// ============================================================================
// HARRIS CORNER MEASURE
// ============================================================================

class HarrisCornerMeasure {
  private k: number = 0.04;

  /**
   * Compute Harris response for keypoints
   */
  computeResponse(image: GrayscaleImage, keypoints: Keypoint[]): Keypoint[] {
    const { width, height, data } = image;

    // Compute gradients
    const Ix = createImage(width, height);
    const Iy = createImage(width, height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        Ix.data[y][x] = (data[y][x + 1] - data[y][x - 1]) / 2;
        Iy.data[y][x] = (data[y + 1][x] - data[y - 1][x]) / 2;
      }
    }

    // Compute Harris response for each keypoint
    const windowSize = 3;
    const half = Math.floor(windowSize / 2);

    for (const kp of keypoints) {
      let Sxx = 0, Syy = 0, Sxy = 0;

      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const px = kp.x + dx;
          const py = kp.y + dy;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const ix = Ix.data[py][px];
            const iy = Iy.data[py][px];
            Sxx += ix * ix;
            Syy += iy * iy;
            Sxy += ix * iy;
          }
        }
      }

      // Harris response: det(M) - k * trace(M)^2
      const det = Sxx * Syy - Sxy * Sxy;
      const trace = Sxx + Syy;
      kp.response = det - this.k * trace * trace;
    }

    return keypoints;
  }
}

// ============================================================================
// ORIENTATION COMPUTATION
// ============================================================================

class OrientationComputer {
  private patchSize: number = 31;

  /**
   * Compute orientation using intensity centroid
   */
  computeOrientation(image: GrayscaleImage, keypoints: Keypoint[]): Keypoint[] {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: _data } = image;
    const half = Math.floor(this.patchSize / 2);

    for (const kp of keypoints) {
      let m01 = 0, m10 = 0;

      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          // Circular patch
          if (dx * dx + dy * dy <= half * half) {
            const py = Math.floor(kp.y) + dy;
            const px = Math.floor(kp.x) + dx;
            const intensity = getPixel(image, px, py);

            m10 += dx * intensity;
            m01 += dy * intensity;
          }
        }
      }

      kp.angle = Math.atan2(m01, m10);
    }

    return keypoints;
  }
}

// ============================================================================
// BRIEF DESCRIPTOR
// ============================================================================

class BRIEFDescriptor {
  private patchSize: number = 31;
  private descriptorSize: number = 256; // bits
  private samplingPattern: [number, number, number, number][] = [];

  constructor() {
    this.generateSamplingPattern();
  }

  /**
   * Generate random sampling pattern for BRIEF
   */
  private generateSamplingPattern(): void {
    const half = Math.floor(this.patchSize / 2);
    const rng = this.seededRandom(42); // Fixed seed for reproducibility

    for (let i = 0; i < this.descriptorSize; i++) {
      const x1 = Math.floor(rng() * this.patchSize) - half;
      const y1 = Math.floor(rng() * this.patchSize) - half;
      const x2 = Math.floor(rng() * this.patchSize) - half;
      const y2 = Math.floor(rng() * this.patchSize) - half;
      this.samplingPattern.push([x1, y1, x2, y2]);
    }
  }

  /**
   * Simple seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /**
   * Compute BRIEF descriptor (not rotation invariant)
   */
  compute(image: GrayscaleImage, keypoints: Keypoint[]): ORBDescriptor[] {
    const blurred = gaussianBlur(image, 2);
    const descriptors: ORBDescriptor[] = [];

    for (const kp of keypoints) {
      const descriptor = new Uint8Array(32); // 256 bits = 32 bytes

      for (let i = 0; i < this.descriptorSize; i++) {
        const [x1, y1, x2, y2] = this.samplingPattern[i];

        const p1 = getPixel(blurred, kp.x + x1, kp.y + y1);
        const p2 = getPixel(blurred, kp.x + x2, kp.y + y2);

        if (p1 < p2) {
          const byteIdx = Math.floor(i / 8);
          const bitIdx = i % 8;
          descriptor[byteIdx] |= (1 << bitIdx);
        }
      }

      descriptors.push({ keypoint: kp, descriptor });
    }

    return descriptors;
  }

  /**
   * Compute steered BRIEF descriptor (rotation invariant)
   */
  computeSteered(image: GrayscaleImage, keypoints: Keypoint[]): ORBDescriptor[] {
    const blurred = gaussianBlur(image, 2);
    const descriptors: ORBDescriptor[] = [];

    for (const kp of keypoints) {
      const descriptor = new Uint8Array(32);
      const cos = Math.cos(kp.angle);
      const sin = Math.sin(kp.angle);

      for (let i = 0; i < this.descriptorSize; i++) {
        const [x1, y1, x2, y2] = this.samplingPattern[i];

        // Rotate sampling points by keypoint orientation
        const rx1 = Math.round(x1 * cos - y1 * sin);
        const ry1 = Math.round(x1 * sin + y1 * cos);
        const rx2 = Math.round(x2 * cos - y2 * sin);
        const ry2 = Math.round(x2 * sin + y2 * cos);

        const p1 = getPixel(blurred, kp.x + rx1, kp.y + ry1);
        const p2 = getPixel(blurred, kp.x + rx2, kp.y + ry2);

        if (p1 < p2) {
          const byteIdx = Math.floor(i / 8);
          const bitIdx = i % 8;
          descriptor[byteIdx] |= (1 << bitIdx);
        }
      }

      descriptors.push({ keypoint: kp, descriptor });
    }

    return descriptors;
  }
}

// ============================================================================
// SCALE PYRAMID
// ============================================================================

class ScalePyramid {
  private numLevels: number;
  private scaleFactor: number;

  constructor(numLevels: number = 8, scaleFactor: number = 1.2) {
    this.numLevels = numLevels;
    this.scaleFactor = scaleFactor;
  }

  /**
   * Build scale pyramid
   */
  build(image: GrayscaleImage): { images: GrayscaleImage[]; scales: number[] } {
    const images: GrayscaleImage[] = [image];
    const scales: number[] = [1];

    let currentImage = image;
    let currentScale = 1;

    for (let i = 1; i < this.numLevels; i++) {
      currentScale *= this.scaleFactor;
      const newWidth = Math.floor(image.width / currentScale);
      const newHeight = Math.floor(image.height / currentScale);

      if (newWidth < 20 || newHeight < 20) break;

      currentImage = downsample(currentImage, this.scaleFactor);
      currentImage = gaussianBlur(currentImage, 1.0);

      images.push(currentImage);
      scales.push(currentScale);
    }

    return { images, scales };
  }
}

// ============================================================================
// NON-MAXIMAL SUPPRESSION
// ============================================================================

function nonMaximalSuppression(keypoints: Keypoint[], radius: number = 5): Keypoint[] {
  // Sort by response descending
  const sorted = [...keypoints].sort((a, b) => b.response - a.response);
  const result: Keypoint[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;

    result.push(sorted[i]);

    // Suppress nearby keypoints
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;

      const dx = sorted[i].x - sorted[j].x;
      const dy = sorted[i].y - sorted[j].y;

      if (dx * dx + dy * dy < radius * radius) {
        suppressed.add(j);
      }
    }
  }

  return result;
}

// ============================================================================
// FEATURE MATCHING
// ============================================================================

class FeatureMatcher {
  /**
   * Hamming distance between two descriptors
   */
  static hammingDistance(d1: Uint8Array, d2: Uint8Array): number {
    let distance = 0;
    for (let i = 0; i < d1.length; i++) {
      let xor = d1[i] ^ d2[i];
      while (xor) {
        distance += xor & 1;
        xor >>= 1;
      }
    }
    return distance;
  }

  /**
   * Brute force matching
   */
  static bruteForceMatch(
    query: ORBDescriptor[],
    train: ORBDescriptor[],
    crossCheck: boolean = true
  ): FeatureMatch[] {
    const matches: FeatureMatch[] = [];

    // Forward matching
    const forwardMatches: number[] = [];
    for (let i = 0; i < query.length; i++) {
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let j = 0; j < train.length; j++) {
        const dist = this.hammingDistance(query[i].descriptor, train[j].descriptor);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }

      forwardMatches.push(bestIdx);
    }

    if (crossCheck) {
      // Backward matching for cross-check
      const backwardMatches: number[] = [];
      for (let j = 0; j < train.length; j++) {
        let bestIdx = -1;
        let bestDist = Infinity;

        for (let i = 0; i < query.length; i++) {
          const dist = this.hammingDistance(query[i].descriptor, train[j].descriptor);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }

        backwardMatches.push(bestIdx);
      }

      // Keep only cross-checked matches
      for (let i = 0; i < query.length; i++) {
        const j = forwardMatches[i];
        if (j >= 0 && backwardMatches[j] === i) {
          const dist = this.hammingDistance(query[i].descriptor, train[j].descriptor);
          matches.push({ queryIdx: i, trainIdx: j, distance: dist });
        }
      }
    } else {
      for (let i = 0; i < query.length; i++) {
        const j = forwardMatches[i];
        if (j >= 0) {
          const dist = this.hammingDistance(query[i].descriptor, train[j].descriptor);
          matches.push({ queryIdx: i, trainIdx: j, distance: dist });
        }
      }
    }

    return matches.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Ratio test matching
   */
  static ratioTestMatch(
    query: ORBDescriptor[],
    train: ORBDescriptor[],
    ratio: number = 0.75
  ): FeatureMatch[] {
    const matches: FeatureMatch[] = [];

    for (let i = 0; i < query.length; i++) {
      let best1Idx = -1, best2Idx = -1;
      let best1Dist = Infinity, best2Dist = Infinity;

      for (let j = 0; j < train.length; j++) {
        const dist = this.hammingDistance(query[i].descriptor, train[j].descriptor);

        if (dist < best1Dist) {
          best2Dist = best1Dist;
          best2Idx = best1Idx;
          best1Dist = dist;
          best1Idx = j;
        } else if (dist < best2Dist) {
          best2Dist = dist;
          best2Idx = j;
        }
      }

      if (best1Idx >= 0 && best2Idx >= 0 && best1Dist < ratio * best2Dist) {
        matches.push({ queryIdx: i, trainIdx: best1Idx, distance: best1Dist });
      }
    }

    return matches;
  }
}

// ============================================================================
// HOMOGRAPHY ESTIMATION
// ============================================================================

class HomographyEstimator {
  /**
   * Compute homography using Direct Linear Transform
   */
  static computeDLT(
    srcPoints: [number, number][],
    dstPoints: [number, number][]
  ): number[][] {
    if (srcPoints.length < 4) {
      return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    }

    // Build matrix A for Ah = 0
    const A: number[][] = [];

    for (let i = 0; i < srcPoints.length; i++) {
      const [x, y] = srcPoints[i];
      const [xp, yp] = dstPoints[i];

      A.push([-x, -y, -1, 0, 0, 0, x * xp, y * xp, xp]);
      A.push([0, 0, 0, -x, -y, -1, x * yp, y * yp, yp]);
    }

    // Solve using simplified SVD (power iteration for smallest singular vector)
    const h = this.solveHomogeneous(A);

    return [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], h[8]]
    ];
  }

  /**
   * Solve homogeneous system Ax = 0
   */
  private static solveHomogeneous(A: number[][]): number[] {
    // Compute A^T * A
    const m = A.length;
    const n = A[0].length;
    const AtA: number[][] = [];

    for (let i = 0; i < n; i++) {
      AtA[i] = [];
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < m; k++) {
          sum += A[k][i] * A[k][j];
        }
        AtA[i][j] = sum;
      }
    }

    // Power iteration for smallest eigenvector
    let x = new Array(n).fill(1 / Math.sqrt(n));

    for (let iter = 0; iter < 100; iter++) {
      // y = (AtA)^-1 * x (approximated by solving AtA * y = x)
      const y = this.solveLinear(AtA, x);

      // Normalize
      const norm = Math.sqrt(y.reduce((s, v) => s + v * v, 0));
      x = y.map(v => v / norm);
    }

    return x;
  }

  /**
   * Solve linear system using Gaussian elimination
   */
  private static solveLinear(A: number[][], b: number[]): number[] {
    const n = A.length;
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
          maxRow = k;
        }
      }
      [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

      if (Math.abs(aug[i][i]) < 1e-10) continue;

      for (let k = i + 1; k < n; k++) {
        const factor = aug[k][i] / aug[i][i];
        for (let j = i; j <= n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      if (Math.abs(aug[i][i]) < 1e-10) {
        x[i] = 0;
        continue;
      }
      x[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= aug[i][j] * x[j];
      }
      x[i] /= aug[i][i];
    }

    return x;
  }

  /**
   * RANSAC homography estimation
   */
  static ransac(
    srcPoints: [number, number][],
    dstPoints: [number, number][],
    iterations: number = 1000,
    threshold: number = 3.0
  ): HomographyResult {
    const n = srcPoints.length;
    if (n < 4) {
      return {
        H: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        inliers: [],
        numInliers: 0,
        reprojectionError: Infinity
      };
    }

    let bestH: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    let bestInliers: number[] = [];
    let bestError = Infinity;

    for (let iter = 0; iter < iterations; iter++) {
      // Random sample of 4 points
      const indices = this.randomSample(n, 4);
      const srcSample = indices.map(i => srcPoints[i]);
      const dstSample = indices.map(i => dstPoints[i]);

      // Compute homography
      const H = this.computeDLT(srcSample, dstSample);

      // Count inliers
      const inliers: number[] = [];
      let totalError = 0;

      for (let i = 0; i < n; i++) {
        const error = this.reprojectionError(H, srcPoints[i], dstPoints[i]);
        if (error < threshold) {
          inliers.push(i);
          totalError += error;
        }
      }

      if (inliers.length > bestInliers.length ||
          (inliers.length === bestInliers.length && totalError < bestError)) {
        bestH = H;
        bestInliers = inliers;
        bestError = totalError;
      }
    }

    // Refit with all inliers
    if (bestInliers.length >= 4) {
      const srcInliers = bestInliers.map(i => srcPoints[i]);
      const dstInliers = bestInliers.map(i => dstPoints[i]);
      bestH = this.computeDLT(srcInliers, dstInliers);
    }

    return {
      H: bestH,
      inliers: bestInliers,
      numInliers: bestInliers.length,
      reprojectionError: bestError / Math.max(1, bestInliers.length)
    };
  }

  /**
   * Compute reprojection error
   */
  static reprojectionError(
    H: number[][],
    src: [number, number],
    dst: [number, number]
  ): number {
    const [x, y] = src;
    const w = H[2][0] * x + H[2][1] * y + H[2][2];

    if (Math.abs(w) < 1e-10) return Infinity;

    const xp = (H[0][0] * x + H[0][1] * y + H[0][2]) / w;
    const yp = (H[1][0] * x + H[1][1] * y + H[1][2]) / w;

    const dx = xp - dst[0];
    const dy = yp - dst[1];

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Random sample without replacement
   */
  private static randomSample(n: number, k: number): number[] {
    const indices = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, k);
  }
}

// ============================================================================
// ORB DETECTOR
// ============================================================================

class ORBDetector {
  private numFeatures: number;
  private scaleFactor: number;
  private numLevels: number;
  private fastThreshold: number;

  constructor(
    numFeatures: number = 500,
    scaleFactor: number = 1.2,
    numLevels: number = 8,
    fastThreshold: number = 20
  ) {
    this.numFeatures = numFeatures;
    this.scaleFactor = scaleFactor;
    this.numLevels = numLevels;
    this.fastThreshold = fastThreshold;
  }

  /**
   * Detect and compute ORB features
   */
  detectAndCompute(image: GrayscaleImage): ORBDescriptor[] {
    // Build pyramid
    const pyramid = new ScalePyramid(this.numLevels, this.scaleFactor);
    const { images, scales } = pyramid.build(image);

    // Detect keypoints at each level
    let allKeypoints: Keypoint[] = [];
    const fast = new FASTDetector(this.fastThreshold);
    const harris = new HarrisCornerMeasure();
    const orientation = new OrientationComputer();

    const featuresPerLevel = Math.floor(this.numFeatures / images.length);

    for (let level = 0; level < images.length; level++) {
      let keypoints = fast.detect(images[level]);

      // Compute Harris response
      keypoints = harris.computeResponse(images[level], keypoints);

      // NMS and select top features
      keypoints = nonMaximalSuppression(keypoints, 5);
      keypoints = keypoints.slice(0, featuresPerLevel);

      // Compute orientation
      keypoints = orientation.computeOrientation(images[level], keypoints);

      // Scale coordinates back to original image
      for (const kp of keypoints) {
        kp.x *= scales[level];
        kp.y *= scales[level];
        kp.scale = scales[level];
        kp.octave = level;
      }

      allKeypoints = allKeypoints.concat(keypoints);
    }

    // Sort by response and keep top N
    allKeypoints.sort((a, b) => b.response - a.response);
    allKeypoints = allKeypoints.slice(0, this.numFeatures);

    // Compute descriptors
    const brief = new BRIEFDescriptor();
    return brief.computeSteered(image, allKeypoints);
  }
}

// ============================================================================
// TEST IMAGE GENERATION
// ============================================================================

function generateTestImage(
  width: number,
  height: number,
  pattern: 'corners' | 'checkerboard' | 'features'
): GrayscaleImage {
  const image = createImage(width, height, 128);

  switch (pattern) {
    case 'corners':
      // Draw corners/shapes
      for (let i = 0; i < 5; i++) {
        const cx = 30 + i * 30;
        const cy = 30 + i * 20;
        // Rectangle
        for (let y = cy - 10; y <= cy + 10; y++) {
          for (let x = cx - 10; x <= cx + 10; x++) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
              image.data[y][x] = 200;
            }
          }
        }
      }
      break;

    case 'checkerboard':
      const size = 20;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cx = Math.floor(x / size);
          const cy = Math.floor(y / size);
          image.data[y][x] = ((cx + cy) % 2 === 0) ? 50 : 200;
        }
      }
      break;

    case 'features':
      // Random features
      for (let i = 0; i < 20; i++) {
        const cx = 20 + Math.floor(Math.random() * (width - 40));
        const cy = 20 + Math.floor(Math.random() * (height - 40));
        const r = 5 + Math.floor(Math.random() * 10);

        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r) {
              const x = cx + dx;
              const y = cy + dy;
              if (x >= 0 && x < width && y >= 0 && y < height) {
                image.data[y][x] = 50 + Math.floor(Math.random() * 150);
              }
            }
          }
        }
      }
      break;
  }

  return image;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const orbfeaturesTool: UnifiedTool = {
  name: 'orb_features',
  description: 'ORB (Oriented FAST and Rotated BRIEF) feature detection and matching',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'detect_keypoints', 'compute_descriptors', 'match_features',
          'find_homography', 'visualize_features', 'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      image: {
        type: 'object',
        description: 'Image { width, height, data: number[][] }'
      },
      image1: {
        type: 'object',
        description: 'First image for matching'
      },
      image2: {
        type: 'object',
        description: 'Second image for matching'
      },
      params: {
        type: 'object',
        description: 'Detection parameters'
      },
      pattern: {
        type: 'string',
        enum: ['corners', 'checkerboard', 'features'],
        description: 'Test pattern type'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeorbfeatures(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, image1, image2, params, pattern } = args;

    let result: unknown;

    switch (operation) {
      case 'detect_keypoints': {
        const testImage = image || generateTestImage(150, 120, pattern || 'corners');

        const fast = new FASTDetector(params?.threshold ?? 20);
        let keypoints = fast.detect(testImage);

        const harris = new HarrisCornerMeasure();
        keypoints = harris.computeResponse(testImage, keypoints);

        keypoints = nonMaximalSuppression(keypoints, params?.nmsRadius ?? 5);
        keypoints = keypoints.slice(0, params?.maxKeypoints ?? 100);

        const orientation = new OrientationComputer();
        keypoints = orientation.computeOrientation(testImage, keypoints);

        result = {
          operation: 'detect_keypoints',
          imageSize: { width: testImage.width, height: testImage.height },
          numKeypoints: keypoints.length,
          keypoints: keypoints.slice(0, 20).map(kp => ({
            x: Math.round(kp.x),
            y: Math.round(kp.y),
            response: Math.round(kp.response),
            angle: (kp.angle * 180 / Math.PI).toFixed(1) + ' deg'
          })),
          parameters: {
            threshold: params?.threshold ?? 20,
            nmsRadius: params?.nmsRadius ?? 5
          }
        };
        break;
      }

      case 'compute_descriptors': {
        const testImage = image || generateTestImage(150, 120, pattern || 'corners');

        const orb = new ORBDetector(
          params?.numFeatures ?? 100,
          params?.scaleFactor ?? 1.2,
          params?.numLevels ?? 4
        );

        const descriptors = orb.detectAndCompute(testImage);

        result = {
          operation: 'compute_descriptors',
          imageSize: { width: testImage.width, height: testImage.height },
          numDescriptors: descriptors.length,
          descriptorSize: '256 bits (32 bytes)',
          features: descriptors.slice(0, 10).map((d, i) => ({
            index: i,
            keypoint: {
              x: Math.round(d.keypoint.x),
              y: Math.round(d.keypoint.y),
              scale: d.keypoint.scale.toFixed(2),
              angle: (d.keypoint.angle * 180 / Math.PI).toFixed(1) + ' deg'
            },
            descriptorPreview: Array.from(d.descriptor.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
          })),
          parameters: {
            numFeatures: params?.numFeatures ?? 100,
            scaleFactor: params?.scaleFactor ?? 1.2,
            numLevels: params?.numLevels ?? 4
          }
        };
        break;
      }

      case 'match_features': {
        const img1 = image1 || generateTestImage(150, 120, 'corners');
        const img2 = image2 || generateTestImage(150, 120, 'corners');

        const orb = new ORBDetector(params?.numFeatures ?? 100);

        const desc1 = orb.detectAndCompute(img1);
        const desc2 = orb.detectAndCompute(img2);

        const matches = params?.useRatioTest
          ? FeatureMatcher.ratioTestMatch(desc1, desc2, params?.ratio ?? 0.75)
          : FeatureMatcher.bruteForceMatch(desc1, desc2, params?.crossCheck ?? true);

        result = {
          operation: 'match_features',
          image1Features: desc1.length,
          image2Features: desc2.length,
          numMatches: matches.length,
          matches: matches.slice(0, 15).map(m => ({
            queryIdx: m.queryIdx,
            trainIdx: m.trainIdx,
            distance: m.distance,
            queryPoint: {
              x: Math.round(desc1[m.queryIdx].keypoint.x),
              y: Math.round(desc1[m.queryIdx].keypoint.y)
            },
            trainPoint: {
              x: Math.round(desc2[m.trainIdx].keypoint.x),
              y: Math.round(desc2[m.trainIdx].keypoint.y)
            }
          })),
          matchStatistics: {
            minDistance: matches.length > 0 ? Math.min(...matches.map(m => m.distance)) : 0,
            maxDistance: matches.length > 0 ? Math.max(...matches.map(m => m.distance)) : 0,
            avgDistance: matches.length > 0
              ? (matches.reduce((s, m) => s + m.distance, 0) / matches.length).toFixed(1)
              : 0
          }
        };
        break;
      }

      case 'find_homography': {
        const img1 = image1 || generateTestImage(150, 120, 'corners');
        const img2 = image2 || generateTestImage(150, 120, 'corners');

        const orb = new ORBDetector(params?.numFeatures ?? 200);

        const desc1 = orb.detectAndCompute(img1);
        const desc2 = orb.detectAndCompute(img2);

        const matches = FeatureMatcher.bruteForceMatch(desc1, desc2, true);

        if (matches.length < 4) {
          result = {
            operation: 'find_homography',
            error: 'Not enough matches for homography',
            numMatches: matches.length
          };
          break;
        }

        const srcPoints: [number, number][] = matches.map(m =>
          [desc1[m.queryIdx].keypoint.x, desc1[m.queryIdx].keypoint.y]
        );
        const dstPoints: [number, number][] = matches.map(m =>
          [desc2[m.trainIdx].keypoint.x, desc2[m.trainIdx].keypoint.y]
        );

        const homography = HomographyEstimator.ransac(
          srcPoints,
          dstPoints,
          params?.iterations ?? 1000,
          params?.threshold ?? 3.0
        );

        result = {
          operation: 'find_homography',
          numMatches: matches.length,
          numInliers: homography.numInliers,
          inlierRatio: (homography.numInliers / matches.length * 100).toFixed(1) + '%',
          reprojectionError: homography.reprojectionError.toFixed(2) + ' px',
          homographyMatrix: homography.H.map(row => row.map(v => v.toFixed(4))),
          parameters: {
            ransacIterations: params?.iterations ?? 1000,
            ransacThreshold: params?.threshold ?? 3.0
          }
        };
        break;
      }

      case 'visualize_features': {
        const testImage = image || generateTestImage(100, 80, pattern || 'corners');

        const orb = new ORBDetector(50);
        const descriptors = orb.detectAndCompute(testImage);

        // Create ASCII visualization
        const visualization: string[] = [];
        const step = 4;

        for (let y = 0; y < testImage.height; y += step) {
          let line = '';
          for (let x = 0; x < testImage.width; x += step) {
            // Check if any keypoint is near this position
            const hasKeypoint = descriptors.some(d =>
              Math.abs(d.keypoint.x - x) < step && Math.abs(d.keypoint.y - y) < step
            );

            if (hasKeypoint) {
              line += '*';
            } else {
              const val = getPixel(testImage, x, y);
              if (val < 64) line += ' ';
              else if (val < 128) line += '.';
              else if (val < 192) line += 'o';
              else line += 'O';
            }
          }
          visualization.push(line);
        }

        result = {
          operation: 'visualize_features',
          imageSize: { width: testImage.width, height: testImage.height },
          numFeatures: descriptors.length,
          visualization: visualization.join('\n'),
          legend: '* = keypoint, O/o/. = pixel intensity'
        };
        break;
      }

      case 'demo': {
        // Create two related test images
        const img1 = generateTestImage(120, 100, pattern || 'corners');

        // Create img2 with some transformation
        const img2 = createImage(120, 100, 128);
        const offsetX = 5, offsetY = 3;
        for (let y = 0; y < 100; y++) {
          for (let x = 0; x < 120; x++) {
            const srcX = x - offsetX;
            const srcY = y - offsetY;
            img2.data[y][x] = getPixel(img1, srcX, srcY);
          }
        }

        const orb = new ORBDetector(100);
        const desc1 = orb.detectAndCompute(img1);
        const desc2 = orb.detectAndCompute(img2);

        const matches = FeatureMatcher.bruteForceMatch(desc1, desc2, true);

        result = {
          operation: 'demo',
          description: 'ORB feature detection and matching demo',
          image1: {
            size: { width: img1.width, height: img1.height },
            numFeatures: desc1.length
          },
          image2: {
            size: { width: img2.width, height: img2.height },
            numFeatures: desc2.length,
            transformation: `Translation (${offsetX}, ${offsetY})`
          },
          matching: {
            numMatches: matches.length,
            topMatches: matches.slice(0, 5).map(m => ({
              distance: m.distance,
              query: `(${Math.round(desc1[m.queryIdx].keypoint.x)}, ${Math.round(desc1[m.queryIdx].keypoint.y)})`,
              train: `(${Math.round(desc2[m.trainIdx].keypoint.x)}, ${Math.round(desc2[m.trainIdx].keypoint.y)})`
            }))
          }
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'Detect keypoints',
              code: `{ "operation": "detect_keypoints", "params": { "threshold": 20, "maxKeypoints": 100 } }`
            },
            {
              name: 'Compute ORB descriptors',
              code: `{ "operation": "compute_descriptors", "params": { "numFeatures": 200, "numLevels": 4 } }`
            },
            {
              name: 'Match features',
              code: `{ "operation": "match_features", "params": { "crossCheck": true } }`
            },
            {
              name: 'Find homography with RANSAC',
              code: `{ "operation": "find_homography", "params": { "iterations": 1000, "threshold": 3.0 } }`
            },
            {
              name: 'Visualize features',
              code: `{ "operation": "visualize_features", "pattern": "checkerboard" }`
            }
          ]
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'orb_features',
          description: 'ORB (Oriented FAST and Rotated BRIEF) feature detector and descriptor',
          components: {
            FAST: 'Fast corner detection using 16-pixel circle test',
            Harris: 'Harris corner measure for keypoint ranking',
            Orientation: 'Intensity centroid for rotation invariance',
            BRIEF: 'Binary descriptor using pairwise intensity comparisons',
            Steered: 'Rotation-invariant BRIEF using keypoint orientation'
          },
          features: {
            scalePyramid: 'Multi-scale detection for scale invariance',
            nms: 'Non-maximal suppression for keypoint selection',
            hammingDistance: 'Fast binary descriptor matching',
            crossCheck: 'Bidirectional matching for reliability',
            ratioTest: "Lowe's ratio test for match filtering",
            ransac: 'RANSAC homography estimation with outlier rejection'
          },
          performance: {
            descriptorSize: '256 bits (32 bytes)',
            matchingComplexity: 'O(n*m) for brute force, uses fast Hamming distance',
            advantages: 'Fast, rotation invariant, suitable for real-time'
          },
          operations: [
            'detect_keypoints', 'compute_descriptors', 'match_features',
            'find_homography', 'visualize_features', 'demo', 'info', 'examples'
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
      content: `Error in orb_features: ${error}`,
      isError: true
    };
  }
}

export function isorbfeaturesAvailable(): boolean {
  return true;
}
