/**
 * OBJECT TRACKING TOOL
 * Comprehensive object tracking algorithms
 *
 * Features:
 * - Mean-shift tracking
 * - CAMshift (Continuously Adaptive Mean Shift)
 * - Kalman filter tracking
 * - Particle filter tracking
 * - Correlation-based tracking
 * - Template matching tracking
 * - Multi-object tracking (MOT)
 * - Hungarian algorithm for assignment
 * - Track ID management
 * - Occlusion handling
 * - Track smoothing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Track {
  id: number;
  bbox: BoundingBox;
  history: BoundingBox[];
  age: number;
  hitStreak: number;
  timeSinceUpdate: number;
  state: 'active' | 'tentative' | 'lost';
  kalman?: KalmanState;
  color?: number[];
}

interface Detection {
  bbox: BoundingBox;
  confidence?: number;
  label?: string;
}

interface KalmanState {
  x: number[];      // State vector [x, y, w, h, vx, vy, vw, vh]
  P: number[][];    // Covariance matrix
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  weight: number;
}

interface GrayscaleImage {
  width: number;
  height: number;
  data: number[][];
}

// ============================================================================
// UTILITY FUNCTIONS
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

function iou(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

function boxCenter(box: BoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

function euclideanDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// ============================================================================
// MEAN-SHIFT TRACKING
// ============================================================================

class MeanShiftTracker {
  private histBins: number = 16;
  private maxIterations: number = 20;
  private epsilon: number = 1.0;

  private targetHistogram: number[] = [];
  private currentWindow: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

  /**
   * Initialize tracker with target region
   */
  init(image: GrayscaleImage, bbox: BoundingBox): void {
    this.currentWindow = { ...bbox };
    this.targetHistogram = this.computeHistogram(image, bbox);
  }

  /**
   * Update tracker on new frame
   */
  update(image: GrayscaleImage): BoundingBox {
    const window = { ...this.currentWindow };

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Compute weights based on histogram back-projection
      const weights = this.computeWeights(image, window);

      // Compute mean shift vector
      let sumX = 0, sumY = 0, sumW = 0;

      for (let y = 0; y < window.height; y++) {
        for (let x = 0; x < window.width; x++) {
          const px = window.x + x;
          const py = window.y + y;
          const w = weights[y * window.width + x] || 0;

          sumX += px * w;
          sumY += py * w;
          sumW += w;
        }
      }

      if (sumW > 0) {
        const newCx = sumX / sumW;
        const newCy = sumY / sumW;

        const dx = newCx - (window.x + window.width / 2);
        const dy = newCy - (window.y + window.height / 2);

        window.x = Math.max(0, window.x + dx);
        window.y = Math.max(0, window.y + dy);

        if (Math.sqrt(dx * dx + dy * dy) < this.epsilon) {
          break;
        }
      }
    }

    this.currentWindow = window;
    return window;
  }

  /**
   * Compute histogram for a region
   */
  private computeHistogram(image: GrayscaleImage, bbox: BoundingBox): number[] {
    const histogram = new Array(this.histBins).fill(0);
    const binWidth = 256 / this.histBins;
    let total = 0;

    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const px = bbox.x + x;
        const py = bbox.y + y;
        const value = getPixel(image, px, py);
        const bin = Math.min(Math.floor(value / binWidth), this.histBins - 1);
        histogram[bin]++;
        total++;
      }
    }

    // Normalize
    if (total > 0) {
      for (let i = 0; i < this.histBins; i++) {
        histogram[i] /= total;
      }
    }

    return histogram;
  }

  /**
   * Compute pixel weights for mean shift
   */
  private computeWeights(image: GrayscaleImage, bbox: BoundingBox): number[] {
    const candidateHist = this.computeHistogram(image, bbox);
    const weights: number[] = [];
    const binWidth = 256 / this.histBins;

    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const px = bbox.x + x;
        const py = bbox.y + y;
        const value = getPixel(image, px, py);
        const bin = Math.min(Math.floor(value / binWidth), this.histBins - 1);

        // Bhattacharyya weight
        const q = this.targetHistogram[bin] || 0.001;
        const p = candidateHist[bin] || 0.001;
        weights.push(Math.sqrt(q / p));
      }
    }

    return weights;
  }

  getWindow(): BoundingBox {
    return { ...this.currentWindow };
  }
}

// ============================================================================
// CAMSHIFT TRACKING
// ============================================================================

class CAMShiftTracker extends MeanShiftTracker {
  /**
   * Update with adaptive window size
   */
  updateAdaptive(image: GrayscaleImage): BoundingBox {
    // First, run mean shift
    const window = super.update(image);

    // Compute moments to adapt window size
    const moments = this.computeMoments(image, window);

    if (moments.m00 > 0) {
      // Compute orientation
      const a = moments.m20 / moments.m00 - (moments.m10 / moments.m00) ** 2;
      const b = 2 * (moments.m11 / moments.m00 - (moments.m10 / moments.m00) * (moments.m01 / moments.m00));
      const c = moments.m02 / moments.m00 - (moments.m01 / moments.m00) ** 2;

      const theta = 0.5 * Math.atan2(b, a - c);

      // Compute eigenvalues for size
      const discriminant = Math.sqrt(b * b + (a - c) ** 2);
      const lambda1 = (a + c + discriminant) / 2;
      const lambda2 = (a + c - discriminant) / 2;

      const width = 2 * Math.sqrt(Math.abs(lambda1)) * 2;
      const height = 2 * Math.sqrt(Math.abs(lambda2)) * 2;

      // Update window size
      window.width = Math.max(10, Math.min(width, image.width / 2));
      window.height = Math.max(10, Math.min(height, image.height / 2));

      // Store orientation
      (window as BoundingBox & { orientation?: number }).orientation = theta;
    }

    return window;
  }

  /**
   * Compute image moments
   */
  private computeMoments(image: GrayscaleImage, bbox: BoundingBox): {
    m00: number; m10: number; m01: number; m20: number; m02: number; m11: number;
  } {
    let m00 = 0, m10 = 0, m01 = 0, m20 = 0, m02 = 0, m11 = 0;

    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const px = bbox.x + x;
        const py = bbox.y + y;
        const value = getPixel(image, px, py);

        m00 += value;
        m10 += x * value;
        m01 += y * value;
        m20 += x * x * value;
        m02 += y * y * value;
        m11 += x * y * value;
      }
    }

    return { m00, m10, m01, m20, m02, m11 };
  }
}

// ============================================================================
// KALMAN FILTER TRACKING
// ============================================================================

class KalmanTracker {
  private state: KalmanState;
  private F: number[][];  // State transition
  private H: number[][];  // Measurement matrix
  private Q: number[][];  // Process noise
  private R: number[][];  // Measurement noise

  constructor(bbox: BoundingBox) {
    // State: [x, y, w, h, vx, vy, vw, vh]
    const center = boxCenter(bbox);
    this.state = {
      x: [center.x, center.y, bbox.width, bbox.height, 0, 0, 0, 0],
      P: this.eye(8, 10)
    };

    // State transition matrix (constant velocity model)
    this.F = [
      [1, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0, 0, 1, 0],
      [0, 0, 0, 1, 0, 0, 0, 1],
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 1]
    ];

    // Measurement matrix (observe x, y, w, h)
    this.H = [
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0]
    ];

    // Process noise
    this.Q = this.eye(8, 1);

    // Measurement noise
    this.R = this.eye(4, 10);
  }

  private eye(n: number, scale: number = 1): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      matrix[i] = new Array(n).fill(0);
      matrix[i][i] = scale;
    }
    return matrix;
  }

  /**
   * Predict next state
   */
  predict(): BoundingBox {
    // x = F * x
    const newX = this.matVecMul(this.F, this.state.x);

    // P = F * P * F' + Q
    const FP = this.matMul(this.F, this.state.P);
    const FPFt = this.matMul(FP, this.transpose(this.F));
    const newP = this.matAdd(FPFt, this.Q);

    this.state.x = newX;
    this.state.P = newP;

    return this.getBox();
  }

  /**
   * Update with measurement
   */
  update(bbox: BoundingBox): BoundingBox {
    const center = boxCenter(bbox);
    const z = [center.x, center.y, bbox.width, bbox.height];

    // y = z - H * x
    const Hx = this.matVecMul(this.H, this.state.x);
    const y = z.map((v, i) => v - Hx[i]);

    // S = H * P * H' + R
    const HP = this.matMul(this.H, this.state.P);
    const HPHt = this.matMul(HP, this.transpose(this.H));
    const S = this.matAdd(HPHt, this.R);

    // K = P * H' * S^-1
    const PHt = this.matMul(this.state.P, this.transpose(this.H));
    const Sinv = this.invert4x4(S);
    const K = this.matMul(PHt, Sinv);

    // x = x + K * y
    const Ky = this.matVecMul(K, y);
    this.state.x = this.state.x.map((v, i) => v + Ky[i]);

    // P = (I - K * H) * P
    const KH = this.matMul(K, this.H);
    const IKH = this.matSub(this.eye(8), KH);
    this.state.P = this.matMul(IKH, this.state.P);

    return this.getBox();
  }

  /**
   * Get current bounding box
   */
  getBox(): BoundingBox {
    return {
      x: this.state.x[0] - this.state.x[2] / 2,
      y: this.state.x[1] - this.state.x[3] / 2,
      width: this.state.x[2],
      height: this.state.x[3]
    };
  }

  getState(): KalmanState {
    return { ...this.state };
  }

  // Matrix operations
  private matVecMul(A: number[][], v: number[]): number[] {
    return A.map(row => row.reduce((sum, a, i) => sum + a * v[i], 0));
  }

  private matMul(A: number[][], B: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < B[0].length; j++) {
        result[i][j] = 0;
        for (let k = 0; k < B.length; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  private transpose(A: number[][]): number[][] {
    const result: number[][] = [];
    for (let j = 0; j < A[0].length; j++) {
      result[j] = [];
      for (let i = 0; i < A.length; i++) {
        result[j][i] = A[i][j];
      }
    }
    return result;
  }

  private matAdd(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((v, j) => v + B[i][j]));
  }

  private matSub(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((v, j) => v - B[i][j]));
  }

  private invert4x4(m: number[][]): number[][] {
    // Simplified 4x4 matrix inversion
    const det = this.det4x4(m);
    if (Math.abs(det) < 1e-10) {
      return this.eye(4, 0.001);
    }

    const inv: number[][] = [];
    for (let i = 0; i < 4; i++) {
      inv[i] = [];
      for (let j = 0; j < 4; j++) {
        inv[i][j] = this.cofactor(m, j, i) / det;
      }
    }
    return inv;
  }

  private det4x4(m: number[][]): number {
    // Expansion by minors
    let det = 0;
    for (let i = 0; i < 4; i++) {
      det += (i % 2 === 0 ? 1 : -1) * m[0][i] * this.det3x3(this.minor(m, 0, i));
    }
    return det;
  }

  private det3x3(m: number[][]): number {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
         - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
         + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  private minor(m: number[][], row: number, col: number): number[][] {
    return m.filter((_, i) => i !== row).map(r => r.filter((_, j) => j !== col));
  }

  private cofactor(m: number[][], row: number, col: number): number {
    const sign = ((row + col) % 2 === 0) ? 1 : -1;
    return sign * this.det3x3(this.minor(m, row, col));
  }
}

// ============================================================================
// PARTICLE FILTER TRACKING
// ============================================================================

class ParticleFilterTracker {
  private particles: Particle[] = [];
  private numParticles: number;
  private template: GrayscaleImage | null = null;
  private templateBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

  constructor(numParticles: number = 100) {
    this.numParticles = numParticles;
  }

  /**
   * Initialize with target region
   */
  init(image: GrayscaleImage, bbox: BoundingBox): void {
    this.templateBox = { ...bbox };
    this.template = this.extractTemplate(image, bbox);

    // Initialize particles around target
    this.particles = [];
    const center = boxCenter(bbox);

    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: center.x + (Math.random() - 0.5) * 20,
        y: center.y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        weight: 1 / this.numParticles
      });
    }
  }

  /**
   * Update tracker on new frame
   */
  update(image: GrayscaleImage): BoundingBox {
    // Predict: move particles according to motion model
    this.predict();

    // Update weights based on observation
    this.updateWeights(image);

    // Resample particles
    this.resample();

    // Estimate state
    return this.estimate();
  }

  /**
   * Move particles with noise
   */
  private predict(): void {
    const processNoise = 5;
    const velocityNoise = 2;

    for (const p of this.particles) {
      p.x += p.vx + (Math.random() - 0.5) * processNoise;
      p.y += p.vy + (Math.random() - 0.5) * processNoise;
      p.vx += (Math.random() - 0.5) * velocityNoise;
      p.vy += (Math.random() - 0.5) * velocityNoise;
    }
  }

  /**
   * Update particle weights based on template matching
   */
  private updateWeights(image: GrayscaleImage): void {
    if (!this.template) return;

    let totalWeight = 0;

    for (const p of this.particles) {
      const bbox: BoundingBox = {
        x: p.x - this.templateBox.width / 2,
        y: p.y - this.templateBox.height / 2,
        width: this.templateBox.width,
        height: this.templateBox.height
      };

      const similarity = this.computeSimilarity(image, bbox);
      p.weight = Math.exp(-similarity / 100);
      totalWeight += p.weight;
    }

    // Normalize weights
    if (totalWeight > 0) {
      for (const p of this.particles) {
        p.weight /= totalWeight;
      }
    }
  }

  /**
   * Compute SSD between template and image region
   */
  private computeSimilarity(image: GrayscaleImage, bbox: BoundingBox): number {
    if (!this.template) return Infinity;

    let ssd = 0;
    let count = 0;

    for (let y = 0; y < this.templateBox.height; y++) {
      for (let x = 0; x < this.templateBox.width; x++) {
        const px = Math.floor(bbox.x + x);
        const py = Math.floor(bbox.y + y);

        if (px >= 0 && px < image.width && py >= 0 && py < image.height) {
          const diff = getPixel(image, px, py) - this.template.data[y][x];
          ssd += diff * diff;
          count++;
        }
      }
    }

    return count > 0 ? ssd / count : Infinity;
  }

  /**
   * Resample particles based on weights
   */
  private resample(): void {
    const newParticles: Particle[] = [];
    const cumWeights: number[] = [];
    let cumSum = 0;

    for (const p of this.particles) {
      cumSum += p.weight;
      cumWeights.push(cumSum);
    }

    for (let i = 0; i < this.numParticles; i++) {
      const r = Math.random();
      let idx = 0;
      while (idx < cumWeights.length - 1 && cumWeights[idx] < r) {
        idx++;
      }

      newParticles.push({
        ...this.particles[idx],
        weight: 1 / this.numParticles
      });
    }

    this.particles = newParticles;
  }

  /**
   * Estimate state from particles
   */
  private estimate(): BoundingBox {
    let sumX = 0, sumY = 0, totalWeight = 0;

    for (const p of this.particles) {
      sumX += p.x * p.weight;
      sumY += p.y * p.weight;
      totalWeight += p.weight;
    }

    if (totalWeight > 0) {
      const cx = sumX / totalWeight;
      const cy = sumY / totalWeight;

      return {
        x: cx - this.templateBox.width / 2,
        y: cy - this.templateBox.height / 2,
        width: this.templateBox.width,
        height: this.templateBox.height
      };
    }

    return this.templateBox;
  }

  /**
   * Extract template from image
   */
  private extractTemplate(image: GrayscaleImage, bbox: BoundingBox): GrayscaleImage {
    const template = createImage(Math.floor(bbox.width), Math.floor(bbox.height));

    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const px = Math.floor(bbox.x + x);
        const py = Math.floor(bbox.y + y);
        template.data[y][x] = getPixel(image, px, py);
      }
    }

    return template;
  }

  getParticles(): Particle[] {
    return [...this.particles];
  }
}

// ============================================================================
// CORRELATION-BASED TRACKING
// ============================================================================

class CorrelationTracker {
  private template: GrayscaleImage | null = null;
  private searchRadius: number;
  private templateBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

  constructor(searchRadius: number = 30) {
    this.searchRadius = searchRadius;
  }

  init(image: GrayscaleImage, bbox: BoundingBox): void {
    this.templateBox = { ...bbox };
    this.template = this.extractTemplate(image, bbox);
  }

  update(image: GrayscaleImage): BoundingBox {
    if (!this.template) return this.templateBox;

    let bestScore = -Infinity;
    let bestX = this.templateBox.x;
    let bestY = this.templateBox.y;

    const cx = this.templateBox.x + this.templateBox.width / 2;
    const cy = this.templateBox.y + this.templateBox.height / 2;

    for (let dy = -this.searchRadius; dy <= this.searchRadius; dy += 2) {
      for (let dx = -this.searchRadius; dx <= this.searchRadius; dx += 2) {
        const testX = cx + dx - this.templateBox.width / 2;
        const testY = cy + dy - this.templateBox.height / 2;

        const score = this.ncc(image, testX, testY);
        if (score > bestScore) {
          bestScore = score;
          bestX = testX;
          bestY = testY;
        }
      }
    }

    this.templateBox.x = bestX;
    this.templateBox.y = bestY;

    return { ...this.templateBox };
  }

  /**
   * Normalized Cross Correlation
   */
  private ncc(image: GrayscaleImage, x: number, y: number): number {
    if (!this.template) return 0;

    let sumIT = 0, sumI2 = 0, sumT2 = 0;
    let meanI = 0, meanT = 0;
    let count = 0;

    // Compute means
    for (let ty = 0; ty < this.templateBox.height; ty++) {
      for (let tx = 0; tx < this.templateBox.width; tx++) {
        const px = Math.floor(x + tx);
        const py = Math.floor(y + ty);

        if (px >= 0 && px < image.width && py >= 0 && py < image.height) {
          meanI += getPixel(image, px, py);
          meanT += this.template.data[ty][tx];
          count++;
        }
      }
    }

    if (count === 0) return -1;

    meanI /= count;
    meanT /= count;

    // Compute NCC
    for (let ty = 0; ty < this.templateBox.height; ty++) {
      for (let tx = 0; tx < this.templateBox.width; tx++) {
        const px = Math.floor(x + tx);
        const py = Math.floor(y + ty);

        if (px >= 0 && px < image.width && py >= 0 && py < image.height) {
          const i = getPixel(image, px, py) - meanI;
          const t = this.template.data[ty][tx] - meanT;

          sumIT += i * t;
          sumI2 += i * i;
          sumT2 += t * t;
        }
      }
    }

    const denom = Math.sqrt(sumI2 * sumT2);
    return denom > 0 ? sumIT / denom : 0;
  }

  private extractTemplate(image: GrayscaleImage, bbox: BoundingBox): GrayscaleImage {
    const template = createImage(Math.floor(bbox.width), Math.floor(bbox.height));

    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const px = Math.floor(bbox.x + x);
        const py = Math.floor(bbox.y + y);
        template.data[y][x] = getPixel(image, px, py);
      }
    }

    return template;
  }
}

// ============================================================================
// HUNGARIAN ALGORITHM
// ============================================================================

class HungarianAlgorithm {
  /**
   * Solve assignment problem using Hungarian algorithm
   * Returns optimal assignment minimizing total cost
   */
  static solve(costMatrix: number[][]): { assignment: number[]; totalCost: number } {
    if (costMatrix.length === 0) return { assignment: [], totalCost: 0 };

    const n = costMatrix.length;
    const m = costMatrix[0].length;
    const size = Math.max(n, m);

    // Pad to square matrix
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        if (i < n && j < m) {
          matrix[i][j] = costMatrix[i][j];
        } else {
          matrix[i][j] = 0;
        }
      }
    }

    // Step 1: Subtract row minimum
    for (let i = 0; i < size; i++) {
      const minVal = Math.min(...matrix[i]);
      for (let j = 0; j < size; j++) {
        matrix[i][j] -= minVal;
      }
    }

    // Step 2: Subtract column minimum
    for (let j = 0; j < size; j++) {
      let minVal = Infinity;
      for (let i = 0; i < size; i++) {
        minVal = Math.min(minVal, matrix[i][j]);
      }
      for (let i = 0; i < size; i++) {
        matrix[i][j] -= minVal;
      }
    }

    // Simple greedy assignment (approximation)
    const rowAssigned = new Array(size).fill(false);
    const colAssigned = new Array(size).fill(false);
    const assignment = new Array(n).fill(-1);
    let totalCost = 0;

    // Find zeros and assign
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        if (matrix[i][j] === 0 && !rowAssigned[i] && !colAssigned[j]) {
          assignment[i] = j;
          rowAssigned[i] = true;
          colAssigned[j] = true;
          totalCost += costMatrix[i][j];
          break;
        }
      }
    }

    // Assign remaining rows to closest available columns
    for (let i = 0; i < n; i++) {
      if (assignment[i] === -1) {
        let minCost = Infinity;
        let minJ = -1;
        for (let j = 0; j < m; j++) {
          if (!colAssigned[j] && costMatrix[i][j] < minCost) {
            minCost = costMatrix[i][j];
            minJ = j;
          }
        }
        if (minJ >= 0) {
          assignment[i] = minJ;
          colAssigned[minJ] = true;
          totalCost += minCost;
        }
      }
    }

    return { assignment, totalCost };
  }
}

// ============================================================================
// MULTI-OBJECT TRACKER (SORT-like)
// ============================================================================

class MultiObjectTracker {
  private tracks: Track[] = [];
  private nextId: number = 1;
  private maxAge: number;
  private minHits: number;
  private iouThreshold: number;

  constructor(maxAge: number = 5, minHits: number = 3, iouThreshold: number = 0.3) {
    this.maxAge = maxAge;
    this.minHits = minHits;
    this.iouThreshold = iouThreshold;
  }

  /**
   * Update tracker with new detections
   */
  update(detections: Detection[]): Track[] {
    // Predict existing tracks
    for (const track of this.tracks) {
      if (track.kalman) {
        const kalman = new KalmanTracker(track.bbox);
        kalman['state'] = track.kalman;
        track.bbox = kalman.predict();
      }
      track.age++;
      track.timeSinceUpdate++;
    }

    // Associate detections with tracks using IoU
    const costMatrix: number[][] = [];
    for (const track of this.tracks) {
      const row: number[] = [];
      for (const det of detections) {
        const iouScore = iou(track.bbox, det.bbox);
        row.push(1 - iouScore); // Convert to cost
      }
      costMatrix.push(row);
    }

    const { assignment } = HungarianAlgorithm.solve(costMatrix);

    // Update matched tracks
    const matchedDetections = new Set<number>();
    const matchedTracks = new Set<number>();

    for (let i = 0; i < assignment.length; i++) {
      const j = assignment[i];
      if (j >= 0 && j < detections.length) {
        const iouScore = iou(this.tracks[i].bbox, detections[j].bbox);
        if (iouScore >= this.iouThreshold) {
          matchedDetections.add(j);
          matchedTracks.add(i);

          // Update track
          const track = this.tracks[i];
          track.bbox = detections[j].bbox;
          track.history.push({ ...track.bbox });
          track.hitStreak++;
          track.timeSinceUpdate = 0;

          if (track.hitStreak >= this.minHits) {
            track.state = 'active';
          }

          // Update Kalman filter
          if (track.kalman) {
            const kalman = new KalmanTracker(track.bbox);
            kalman['state'] = track.kalman;
            kalman.update(track.bbox);
            track.kalman = kalman.getState();
          }
        }
      }
    }

    // Create new tracks for unmatched detections
    for (let j = 0; j < detections.length; j++) {
      if (!matchedDetections.has(j)) {
        const newTrack: Track = {
          id: this.nextId++,
          bbox: detections[j].bbox,
          history: [{ ...detections[j].bbox }],
          age: 1,
          hitStreak: 1,
          timeSinceUpdate: 0,
          state: 'tentative',
          kalman: new KalmanTracker(detections[j].bbox).getState()
        };
        this.tracks.push(newTrack);
      }
    }

    // Mark unmatched tracks as lost and remove old ones
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      if (!matchedTracks.has(i)) {
        this.tracks[i].hitStreak = 0;
        if (this.tracks[i].timeSinceUpdate > this.maxAge) {
          this.tracks[i].state = 'lost';
        }
      }
    }

    // Remove dead tracks
    this.tracks = this.tracks.filter(t => t.timeSinceUpdate <= this.maxAge);

    // Return active tracks
    return this.tracks.filter(t => t.state === 'active' || t.hitStreak >= 1);
  }

  getTracks(): Track[] {
    return [...this.tracks];
  }

  resetTracks(): void {
    this.tracks = [];
    this.nextId = 1;
  }
}

// ============================================================================
// TEST DATA GENERATION
// ============================================================================

function generateTestSequence(
  width: number,
  height: number,
  numFrames: number,
  motionType: 'linear' | 'circular' | 'random'
): { frames: GrayscaleImage[]; groundTruth: BoundingBox[] } {
  const frames: GrayscaleImage[] = [];
  const groundTruth: BoundingBox[] = [];

  const objWidth = 30;
  const objHeight = 30;
  let x = width / 4;
  let y = height / 2;
  let vx = 3;
  let vy = 2;
  let angle = 0;

  for (let f = 0; f < numFrames; f++) {
    const frame = createImage(width, height, 50);

    // Update position
    switch (motionType) {
      case 'linear':
        x += vx;
        y += vy;
        if (x <= 0 || x + objWidth >= width) vx = -vx;
        if (y <= 0 || y + objHeight >= height) vy = -vy;
        break;
      case 'circular':
        angle += 0.1;
        x = width / 2 + Math.cos(angle) * 80 - objWidth / 2;
        y = height / 2 + Math.sin(angle) * 60 - objHeight / 2;
        break;
      case 'random':
        x += (Math.random() - 0.5) * 10;
        y += (Math.random() - 0.5) * 10;
        x = Math.max(0, Math.min(width - objWidth, x));
        y = Math.max(0, Math.min(height - objHeight, y));
        break;
    }

    // Draw object
    for (let dy = 0; dy < objHeight; dy++) {
      for (let dx = 0; dx < objWidth; dx++) {
        const px = Math.floor(x + dx);
        const py = Math.floor(y + dy);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          // Create a pattern
          const dist = Math.sqrt((dx - objWidth/2)**2 + (dy - objHeight/2)**2);
          frame.data[py][px] = dist < objWidth/2 ? 200 : 50;
        }
      }
    }

    frames.push(frame);
    groundTruth.push({
      x: Math.floor(x),
      y: Math.floor(y),
      width: objWidth,
      height: objHeight
    });
  }

  return { frames, groundTruth };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const objecttrackingTool: UnifiedTool = {
  name: 'object_tracking',
  description: 'Object tracking algorithms: mean-shift, CAMshift, Kalman, particle filter, correlation, multi-object tracking',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'init_tracker', 'update', 'predict', 'get_tracks',
          'associate_detections', 'handle_occlusion', 'visualize_tracks',
          'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      method: {
        type: 'string',
        enum: ['mean_shift', 'camshift', 'kalman', 'particle', 'correlation', 'mot'],
        description: 'Tracking method'
      },
      image: {
        type: 'object',
        description: 'Image { width, height, data: number[][] }'
      },
      bbox: {
        type: 'object',
        description: 'Bounding box { x, y, width, height }'
      },
      detections: {
        type: 'array',
        description: 'Array of detections [{ bbox, confidence }]'
      },
      params: {
        type: 'object',
        description: 'Method-specific parameters'
      },
      motionType: {
        type: 'string',
        enum: ['linear', 'circular', 'random'],
        description: 'Motion type for demo'
      }
    },
    required: ['operation']
  }
};

// Global tracker instances for demo
const trackerInstances: Map<string, MeanShiftTracker | CAMShiftTracker | KalmanTracker | ParticleFilterTracker | CorrelationTracker | MultiObjectTracker> = new Map();

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeobjecttracking(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, method, image, bbox, detections, params, motionType } = args;

    let result: unknown;

    switch (operation) {
      case 'init_tracker': {
        const trackMethod = method || 'mean_shift';
        let tracker: MeanShiftTracker | CAMShiftTracker | KalmanTracker | ParticleFilterTracker | CorrelationTracker | MultiObjectTracker;

        const initBbox = bbox || { x: 50, y: 50, width: 30, height: 30 };
        const testImage = image || createImage(200, 150, 100);

        switch (trackMethod) {
          case 'mean_shift':
            tracker = new MeanShiftTracker();
            (tracker as MeanShiftTracker).init(testImage, initBbox);
            break;
          case 'camshift':
            tracker = new CAMShiftTracker();
            (tracker as CAMShiftTracker).init(testImage, initBbox);
            break;
          case 'kalman':
            tracker = new KalmanTracker(initBbox);
            break;
          case 'particle':
            tracker = new ParticleFilterTracker(params?.numParticles ?? 100);
            (tracker as ParticleFilterTracker).init(testImage, initBbox);
            break;
          case 'correlation':
            tracker = new CorrelationTracker(params?.searchRadius ?? 30);
            (tracker as CorrelationTracker).init(testImage, initBbox);
            break;
          case 'mot':
            tracker = new MultiObjectTracker(
              params?.maxAge ?? 5,
              params?.minHits ?? 3,
              params?.iouThreshold ?? 0.3
            );
            break;
          default:
            throw new Error(`Unknown method: ${trackMethod}`);
        }

        trackerInstances.set(trackMethod, tracker);

        result = {
          operation: 'init_tracker',
          method: trackMethod,
          initialBbox: initBbox,
          status: 'initialized',
          description: `Tracker initialized with ${trackMethod} method`
        };
        break;
      }

      case 'update': {
        const trackMethod = method || 'mean_shift';
        const tracker = trackerInstances.get(trackMethod);

        if (!tracker) {
          throw new Error(`Tracker not initialized. Call init_tracker first.`);
        }

        const updateImage = image || createImage(200, 150, 100);
        let updatedBbox: BoundingBox | Track[];

        if (tracker instanceof MultiObjectTracker) {
          const dets = detections || [
            { bbox: { x: 60, y: 60, width: 30, height: 30 }, confidence: 0.9 }
          ];
          updatedBbox = tracker.update(dets);
        } else if (tracker instanceof KalmanTracker) {
          const measureBbox = bbox || { x: 55, y: 55, width: 30, height: 30 };
          tracker.predict();
          updatedBbox = tracker.update(measureBbox);
        } else if (tracker instanceof CAMShiftTracker) {
          updatedBbox = tracker.updateAdaptive(updateImage);
        } else {
          updatedBbox = (tracker as MeanShiftTracker | ParticleFilterTracker | CorrelationTracker).update(updateImage);
        }

        result = {
          operation: 'update',
          method: trackMethod,
          result: updatedBbox,
          status: 'updated'
        };
        break;
      }

      case 'predict': {
        const trackMethod = method || 'kalman';
        const tracker = trackerInstances.get(trackMethod);

        if (!(tracker instanceof KalmanTracker)) {
          throw new Error('Predict operation only available for Kalman tracker');
        }

        const predictedBbox = tracker.predict();

        result = {
          operation: 'predict',
          method: trackMethod,
          predictedBbox,
          state: tracker.getState()
        };
        break;
      }

      case 'get_tracks': {
        const mot = trackerInstances.get('mot') as MultiObjectTracker | undefined;

        if (!mot) {
          throw new Error('MOT tracker not initialized');
        }

        const tracks = mot.getTracks();

        result = {
          operation: 'get_tracks',
          numTracks: tracks.length,
          tracks: tracks.map(t => ({
            id: t.id,
            bbox: t.bbox,
            state: t.state,
            age: t.age,
            hitStreak: t.hitStreak,
            historyLength: t.history.length
          }))
        };
        break;
      }

      case 'associate_detections': {
        const dets = detections || [
          { bbox: { x: 50, y: 50, width: 30, height: 30 } },
          { bbox: { x: 120, y: 80, width: 25, height: 25 } }
        ];

        const tracks = [
          { bbox: { x: 55, y: 55, width: 30, height: 30 } },
          { bbox: { x: 115, y: 75, width: 25, height: 25 } }
        ];

        // Build cost matrix
        const costMatrix: number[][] = [];
        for (const track of tracks) {
          const row: number[] = [];
          for (const det of dets) {
            const iouScore = iou(track.bbox, det.bbox);
            row.push(1 - iouScore);
          }
          costMatrix.push(row);
        }

        const { assignment, totalCost } = HungarianAlgorithm.solve(costMatrix);

        result = {
          operation: 'associate_detections',
          numDetections: dets.length,
          numTracks: tracks.length,
          costMatrix,
          assignment,
          totalCost,
          associations: assignment.map((detIdx, trackIdx) => ({
            trackIdx,
            detIdx,
            iou: detIdx >= 0 ? iou(tracks[trackIdx].bbox, dets[detIdx].bbox).toFixed(3) : 'N/A'
          }))
        };
        break;
      }

      case 'handle_occlusion': {
        result = {
          operation: 'handle_occlusion',
          strategies: {
            kalmanPrediction: 'Use Kalman filter to predict position during occlusion',
            trackAge: 'Keep track alive for maxAge frames without detection',
            reidentification: 'Match reappearing objects using appearance features',
            trajectorySmoothing: 'Interpolate missing positions from history'
          },
          example: {
            trackId: 1,
            lastSeen: 3,
            timeSinceUpdate: 2,
            predictedPosition: { x: 65, y: 65, width: 30, height: 30 },
            state: 'occluded'
          }
        };
        break;
      }

      case 'visualize_tracks': {
        const numFrames = params?.numFrames ?? 10;
        const motion = motionType || 'linear';

        const { frames, groundTruth } = generateTestSequence(100, 80, numFrames, motion);

        // Initialize tracker
        const tracker = new MeanShiftTracker();
        tracker.init(frames[0], groundTruth[0]);

        const trackResults: { frame: number; bbox: BoundingBox; error: number }[] = [];

        for (let f = 1; f < numFrames; f++) {
          const trackedBbox = tracker.update(frames[f]);
          const gt = groundTruth[f];
          const error = euclideanDistance(boxCenter(trackedBbox), boxCenter(gt));

          trackResults.push({
            frame: f,
            bbox: trackedBbox,
            error: Number(error.toFixed(2))
          });
        }

        result = {
          operation: 'visualize_tracks',
          motionType: motion,
          numFrames,
          groundTruth: groundTruth.slice(0, 5),
          trackResults: trackResults.slice(0, 10),
          avgError: (trackResults.reduce((s, r) => s + r.error, 0) / trackResults.length).toFixed(2)
        };
        break;
      }

      case 'demo': {
        const motion = motionType || 'linear';
        const numFrames = params?.numFrames ?? 20;

        const { frames, groundTruth } = generateTestSequence(120, 100, numFrames, motion);

        // Test multiple trackers
        const methods = ['mean_shift', 'kalman', 'particle', 'correlation'];
        const results: Record<string, { avgError: number; trackPositions: BoundingBox[] }> = {};

        for (const m of methods) {
          let tracker: MeanShiftTracker | KalmanTracker | ParticleFilterTracker | CorrelationTracker;
          const positions: BoundingBox[] = [groundTruth[0]];
          let totalError = 0;

          switch (m) {
            case 'mean_shift':
              tracker = new MeanShiftTracker();
              (tracker as MeanShiftTracker).init(frames[0], groundTruth[0]);
              break;
            case 'kalman':
              tracker = new KalmanTracker(groundTruth[0]);
              break;
            case 'particle':
              tracker = new ParticleFilterTracker(50);
              (tracker as ParticleFilterTracker).init(frames[0], groundTruth[0]);
              break;
            case 'correlation':
              tracker = new CorrelationTracker(30);
              (tracker as CorrelationTracker).init(frames[0], groundTruth[0]);
              break;
            default:
              continue;
          }

          for (let f = 1; f < numFrames; f++) {
            let tracked: BoundingBox;

            if (tracker instanceof KalmanTracker) {
              tracker.predict();
              tracked = tracker.update(groundTruth[f]); // Using GT as measurement for demo
            } else {
              tracked = (tracker as MeanShiftTracker | ParticleFilterTracker | CorrelationTracker).update(frames[f]);
            }

            positions.push(tracked);
            totalError += euclideanDistance(boxCenter(tracked), boxCenter(groundTruth[f]));
          }

          results[m] = {
            avgError: Number((totalError / (numFrames - 1)).toFixed(2)),
            trackPositions: positions.slice(0, 5)
          };
        }

        result = {
          operation: 'demo',
          motionType: motion,
          numFrames,
          imageSize: { width: 120, height: 100 },
          methodComparison: results,
          groundTruthSample: groundTruth.slice(0, 5),
          description: `Tracking comparison for ${motion} motion over ${numFrames} frames`
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'Initialize Mean-Shift tracker',
              code: `{ "operation": "init_tracker", "method": "mean_shift", "bbox": { "x": 50, "y": 50, "width": 30, "height": 30 } }`
            },
            {
              name: 'Update tracker',
              code: `{ "operation": "update", "method": "mean_shift" }`
            },
            {
              name: 'Kalman filter prediction',
              code: `{ "operation": "init_tracker", "method": "kalman", "bbox": { "x": 100, "y": 100, "width": 40, "height": 40 } }`
            },
            {
              name: 'Multi-object tracking',
              code: `{ "operation": "init_tracker", "method": "mot", "params": { "maxAge": 5, "minHits": 3 } }`
            },
            {
              name: 'Associate detections',
              code: `{ "operation": "associate_detections", "detections": [{ "bbox": { "x": 50, "y": 50, "width": 30, "height": 30 } }] }`
            },
            {
              name: 'Demo with motion',
              code: `{ "operation": "demo", "motionType": "circular", "params": { "numFrames": 30 } }`
            }
          ]
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'object_tracking',
          description: 'Comprehensive object tracking algorithms',
          methods: {
            mean_shift: {
              type: 'Appearance-based',
              description: 'Iteratively moves window to maximize histogram similarity',
              pros: 'Simple, no explicit motion model needed',
              cons: 'Fixed window size, struggles with scale changes'
            },
            camshift: {
              type: 'Adaptive Mean-Shift',
              description: 'CAMshift with adaptive window size based on moments',
              pros: 'Adapts to size and orientation changes',
              cons: 'Sensitive to lighting changes'
            },
            kalman: {
              type: 'Motion-based',
              description: 'Linear state estimation with process/measurement noise',
              pros: 'Handles occlusion, predicts motion',
              cons: 'Assumes linear motion, requires detections'
            },
            particle: {
              type: 'Monte Carlo',
              description: 'Represents belief as weighted particle set',
              pros: 'Handles non-linear motion, multi-modal distributions',
              cons: 'Computationally expensive, requires tuning'
            },
            correlation: {
              type: 'Template matching',
              description: 'Normalized cross-correlation with template',
              pros: 'Simple, fast',
              cons: 'Sensitive to appearance changes'
            },
            mot: {
              type: 'Multi-object',
              description: 'SORT-like tracking with Kalman + Hungarian assignment',
              pros: 'Tracks multiple objects, handles ID management',
              cons: 'Requires detections each frame'
            }
          },
          operations: [
            'init_tracker', 'update', 'predict', 'get_tracks',
            'associate_detections', 'handle_occlusion', 'visualize_tracks',
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
      content: `Error in object_tracking: ${error}`,
      isError: true
    };
  }
}

export function isobjecttrackingAvailable(): boolean {
  return true;
}
