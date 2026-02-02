/**
 * OPTICAL FLOW TOOL
 * Comprehensive optical flow algorithms for motion estimation
 *
 * Features:
 * - Lucas-Kanade method (sparse, local)
 * - Horn-Schunck method (dense, global)
 * - Farneback dense optical flow
 * - Block matching
 * - Phase correlation
 * - Gradient-based methods
 * - Flow vector visualization
 * - Motion segmentation
 * - Pyramidal optical flow
 * - Temporal consistency
 * - Occlusion handling
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GrayscaleImage {
  width: number;
  height: number;
  data: number[][]; // 2D array [y][x] of pixel values [0-255]
}

interface FlowField {
  width: number;
  height: number;
  u: number[][]; // Horizontal flow component
  v: number[][]; // Vertical flow component
}

interface FlowVector {
  x: number;
  y: number;
  u: number;
  v: number;
  magnitude: number;
  angle: number;
}

interface MotionSegment {
  id: number;
  pixels: { x: number; y: number }[];
  centroid: { x: number; y: number };
  avgFlow: { u: number; v: number };
  area: number;
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

function createFlowField(width: number, height: number): FlowField {
  const u: number[][] = [];
  const v: number[][] = [];
  for (let y = 0; y < height; y++) {
    u[y] = new Array(width).fill(0);
    v[y] = new Array(width).fill(0);
  }
  return { width, height, u, v };
}

function getPixel(img: GrayscaleImage, x: number, y: number): number {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return 0;
  return img.data[Math.floor(y)][Math.floor(x)];
}

function bilinearInterpolate(img: GrayscaleImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;

  const v00 = getPixel(img, x0, y0);
  const v10 = getPixel(img, x1, y0);
  const v01 = getPixel(img, x0, y1);
  const v11 = getPixel(img, x1, y1);

  return (1 - fx) * (1 - fy) * v00 +
         fx * (1 - fy) * v10 +
         (1 - fx) * fy * v01 +
         fx * fy * v11;
}

// ============================================================================
// CONVOLUTION AND GRADIENTS
// ============================================================================

function convolve2D(img: GrayscaleImage, kernel: number[][]): GrayscaleImage {
  const { width, height } = img;
  const kSize = kernel.length;
  const kHalf = Math.floor(kSize / 2);
  const result = createImage(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const px = x + kx - kHalf;
          const py = y + ky - kHalf;
          sum += getPixel(img, px, py) * kernel[ky][kx];
        }
      }
      result.data[y][x] = sum;
    }
  }
  return result;
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

  // Normalize
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return convolve2D(img, kernel);
}

function computeGradients(img: GrayscaleImage): { Ix: GrayscaleImage; Iy: GrayscaleImage } {
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  return {
    Ix: convolve2D(img, sobelX),
    Iy: convolve2D(img, sobelY)
  };
}

function computeTemporalGradient(img1: GrayscaleImage, img2: GrayscaleImage): GrayscaleImage {
  const { width, height } = img1;
  const It = createImage(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      It.data[y][x] = img2.data[y][x] - img1.data[y][x];
    }
  }
  return It;
}

// ============================================================================
// LUCAS-KANADE OPTICAL FLOW
// ============================================================================

class LucasKanadeFlow {
  private windowSize: number;
  private minEigenvalue: number;

  constructor(windowSize: number = 15, minEigenvalue: number = 0.01) {
    this.windowSize = windowSize;
    this.minEigenvalue = minEigenvalue;
  }

  /**
   * Compute sparse optical flow at specified points
   */
  computeSparse(
    img1: GrayscaleImage,
    img2: GrayscaleImage,
    points: { x: number; y: number }[]
  ): FlowVector[] {
    const blurred1 = gaussianBlur(img1, 1.0);
    const blurred2 = gaussianBlur(img2, 1.0);

    const { Ix, Iy } = computeGradients(blurred1);
    const It = computeTemporalGradient(blurred1, blurred2);

    const flows: FlowVector[] = [];
    const half = Math.floor(this.windowSize / 2);

    for (const point of points) {
      const { x, y } = point;

      // Build matrices for least squares: A^T * A * v = A^T * b
      let sumIxx = 0, sumIyy = 0, sumIxy = 0;
      let sumIxt = 0, sumIyt = 0;

      for (let wy = -half; wy <= half; wy++) {
        for (let wx = -half; wx <= half; wx++) {
          const px = x + wx;
          const py = y + wy;

          const ix = getPixel(Ix, px, py);
          const iy = getPixel(Iy, px, py);
          const it = getPixel(It, px, py);

          sumIxx += ix * ix;
          sumIyy += iy * iy;
          sumIxy += ix * iy;
          sumIxt += ix * it;
          sumIyt += iy * it;
        }
      }

      // Solve 2x2 system using Cramer's rule
      const det = sumIxx * sumIyy - sumIxy * sumIxy;
      const trace = sumIxx + sumIyy;
      const discriminant = trace * trace - 4 * det;

      // Check eigenvalues for good tracking
      const minEig = discriminant >= 0
        ? (trace - Math.sqrt(discriminant)) / 2
        : 0;

      if (Math.abs(det) > 1e-6 && minEig > this.minEigenvalue) {
        const u = -(sumIyy * sumIxt - sumIxy * sumIyt) / det;
        const v = -(sumIxx * sumIyt - sumIxy * sumIxt) / det;

        const magnitude = Math.sqrt(u * u + v * v);
        const angle = Math.atan2(v, u);

        flows.push({ x, y, u, v, magnitude, angle });
      }
    }

    return flows;
  }

  /**
   * Compute dense optical flow
   */
  computeDense(img1: GrayscaleImage, img2: GrayscaleImage, step: number = 5): FlowField {
    const { width, height } = img1;
    const flow = createFlowField(width, height);

    const points: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        points.push({ x, y });
      }
    }

    const sparseFlows = this.computeSparse(img1, img2, points);

    // Fill in flow field from sparse results
    for (const f of sparseFlows) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        flow.u[y][x] = f.u;
        flow.v[y][x] = f.v;
      }
    }

    // Interpolate missing values
    this.interpolateFlow(flow, step);

    return flow;
  }

  private interpolateFlow(flow: FlowField, step: number): void {
    const { width, height } = flow;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (flow.u[y][x] === 0 && flow.v[y][x] === 0) {
          // Find nearest computed flow
          const gridX = Math.round(x / step) * step;
          const gridY = Math.round(y / step) * step;

          if (gridY >= 0 && gridY < height && gridX >= 0 && gridX < width) {
            flow.u[y][x] = flow.u[gridY][gridX] || 0;
            flow.v[y][x] = flow.v[gridY][gridX] || 0;
          }
        }
      }
    }
  }
}

// ============================================================================
// HORN-SCHUNCK OPTICAL FLOW
// ============================================================================

class HornSchunckFlow {
  private alpha: number; // Regularization parameter
  private iterations: number;
  private tolerance: number;

  constructor(alpha: number = 1.0, iterations: number = 100, tolerance: number = 1e-4) {
    this.alpha = alpha;
    this.iterations = iterations;
    this.tolerance = tolerance;
  }

  /**
   * Compute dense optical flow using Horn-Schunck method
   */
  compute(img1: GrayscaleImage, img2: GrayscaleImage): FlowField {
    const { width, height } = img1;

    // Blur images
    const blurred1 = gaussianBlur(img1, 1.5);
    const blurred2 = gaussianBlur(img2, 1.5);

    // Compute gradients
    const { Ix, Iy } = computeGradients(blurred1);
    const It = computeTemporalGradient(blurred1, blurred2);

    // Initialize flow
    const flow = createFlowField(width, height);

    // Laplacian averaging kernel
    const avgKernel = [
      [1/12, 1/6, 1/12],
      [1/6,  0,   1/6],
      [1/12, 1/6, 1/12]
    ];

    // Iterative refinement
    for (let iter = 0; iter < this.iterations; iter++) {
      let maxChange = 0;

      // Compute average flow
      const uAvg = createImage(width, height);
      const vAvg = createImage(width, height);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sumU = 0, sumV = 0;
          for (let ky = 0; ky < 3; ky++) {
            for (let kx = 0; kx < 3; kx++) {
              const px = x + kx - 1;
              const py = y + ky - 1;
              sumU += flow.u[py][px] * avgKernel[ky][kx];
              sumV += flow.v[py][px] * avgKernel[ky][kx];
            }
          }
          uAvg.data[y][x] = sumU;
          vAvg.data[y][x] = sumV;
        }
      }

      // Update flow
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const ix = Ix.data[y][x];
          const iy = Iy.data[y][x];
          const it = It.data[y][x];

          const uA = uAvg.data[y][x];
          const vA = vAvg.data[y][x];

          const denom = this.alpha * this.alpha + ix * ix + iy * iy;
          const P = (ix * uA + iy * vA + it);

          const newU = uA - (ix * P) / denom;
          const newV = vA - (iy * P) / denom;

          maxChange = Math.max(maxChange, Math.abs(newU - flow.u[y][x]));
          maxChange = Math.max(maxChange, Math.abs(newV - flow.v[y][x]));

          flow.u[y][x] = newU;
          flow.v[y][x] = newV;
        }
      }

      if (maxChange < this.tolerance) break;
    }

    return flow;
  }
}

// ============================================================================
// FARNEBACK DENSE OPTICAL FLOW
// ============================================================================

class FarnebackFlow {
  private numLevels: number;
  private pyrScale: number;
  private winSize: number;
  private iterations: number;
  private polyN: number;
  private polySigma: number;

  constructor(
    numLevels: number = 3,
    pyrScale: number = 0.5,
    winSize: number = 13,
    iterations: number = 10,
    polyN: number = 5,
    polySigma: number = 1.1
  ) {
    this.numLevels = numLevels;
    this.pyrScale = pyrScale;
    this.winSize = winSize;
    this.iterations = iterations;
    this.polyN = polyN;
    this.polySigma = polySigma;
  }

  /**
   * Compute polynomial expansion coefficients for a pixel neighborhood
   */
  private computePolynomialExpansion(
    img: GrayscaleImage,
    x: number,
    y: number
  ): { A: number[][]; b: number[] } {
    const half = Math.floor(this.polyN / 2);
    const sigma2 = this.polySigma * this.polySigma;

    let sumW = 0;
    let sumWxx = 0, sumWyy = 0, sumWxy = 0;
    let sumWIx = 0, sumWIy = 0;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma2));
        const I = getPixel(img, x + dx, y + dy);

        sumW += weight;
        sumWxx += weight * dx * dx;
        sumWyy += weight * dy * dy;
        sumWxy += weight * dx * dy;
        sumWIx += weight * I * dx;
        sumWIy += weight * I * dy;
      }
    }

    // Return simplified A matrix (2x2) and b vector for displacement estimation
    const A = [
      [sumWxx / sumW, sumWxy / sumW],
      [sumWxy / sumW, sumWyy / sumW]
    ];

    const b = [sumWIx / sumW, sumWIy / sumW];

    return { A, b };
  }

  /**
   * Compute dense optical flow using Farneback method
   */
  compute(img1: GrayscaleImage, img2: GrayscaleImage): FlowField {
    // Build image pyramids
    const pyramid1 = this.buildPyramid(img1);
    const pyramid2 = this.buildPyramid(img2);

    // Initialize flow at coarsest level
    let flow = createFlowField(
      pyramid1[this.numLevels - 1].width,
      pyramid1[this.numLevels - 1].height
    );

    // Coarse to fine
    for (let level = this.numLevels - 1; level >= 0; level--) {
      const img1Level = pyramid1[level];
      const img2Level = pyramid2[level];

      // Upscale flow if not at coarsest level
      if (level < this.numLevels - 1) {
        flow = this.upscaleFlow(flow, img1Level.width, img1Level.height);
      }

      // Refine flow at this level
      flow = this.refineFlowLevel(img1Level, img2Level, flow);
    }

    return flow;
  }

  private buildPyramid(img: GrayscaleImage): GrayscaleImage[] {
    const pyramid: GrayscaleImage[] = [img];

    for (let i = 1; i < this.numLevels; i++) {
      const prev = pyramid[i - 1];
      const newWidth = Math.max(1, Math.floor(prev.width * this.pyrScale));
      const newHeight = Math.max(1, Math.floor(prev.height * this.pyrScale));
      pyramid.push(this.downsample(prev, newWidth, newHeight));
    }

    return pyramid;
  }

  private downsample(img: GrayscaleImage, newWidth: number, newHeight: number): GrayscaleImage {
    const result = createImage(newWidth, newHeight);
    const scaleX = img.width / newWidth;
    const scaleY = img.height / newHeight;

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        result.data[y][x] = bilinearInterpolate(img, x * scaleX, y * scaleY);
      }
    }

    return result;
  }

  private upscaleFlow(flow: FlowField, newWidth: number, newHeight: number): FlowField {
    const result = createFlowField(newWidth, newHeight);
    const scaleX = flow.width / newWidth;
    const scaleY = flow.height / newHeight;
    const flowScaleX = newWidth / flow.width;
    const flowScaleY = newHeight / flow.height;

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = x * scaleX;
        const srcY = y * scaleY;
        const srcXi = Math.min(Math.floor(srcX), flow.width - 1);
        const srcYi = Math.min(Math.floor(srcY), flow.height - 1);

        result.u[y][x] = flow.u[srcYi][srcXi] * flowScaleX;
        result.v[y][x] = flow.v[srcYi][srcXi] * flowScaleY;
      }
    }

    return result;
  }

  private refineFlowLevel(
    img1: GrayscaleImage,
    img2: GrayscaleImage,
    flow: FlowField
  ): FlowField {
    const { width, height } = img1;
    const half = Math.floor(this.winSize / 2);

    for (let iter = 0; iter < this.iterations; iter++) {
      for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
          // Get current flow estimate
          const u0 = flow.u[y][x];
          const v0 = flow.v[y][x];

          // Warp coordinates
          const x2 = x + u0;
          const y2 = y + v0;

          if (x2 < 0 || x2 >= width - 1 || y2 < 0 || y2 >= height - 1) continue;

          // Compute polynomial expansion at both points
          const { A: A1, b: b1 } = this.computePolynomialExpansion(img1, x, y);
          const { A: A2, b: b2 } = this.computePolynomialExpansion(img2, Math.round(x2), Math.round(y2));

          // Combine constraints
          const A = [
            [(A1[0][0] + A2[0][0]) / 2, (A1[0][1] + A2[0][1]) / 2],
            [(A1[1][0] + A2[1][0]) / 2, (A1[1][1] + A2[1][1]) / 2]
          ];

          const db = [b2[0] - b1[0], b2[1] - b1[1]];

          // Solve for flow update
          const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
          if (Math.abs(det) > 1e-6) {
            const du = (A[1][1] * db[0] - A[0][1] * db[1]) / det;
            const dv = (A[0][0] * db[1] - A[1][0] * db[0]) / det;

            flow.u[y][x] = u0 - du * 0.5;
            flow.v[y][x] = v0 - dv * 0.5;
          }
        }
      }
    }

    return flow;
  }
}

// ============================================================================
// BLOCK MATCHING
// ============================================================================

class BlockMatchingFlow {
  private blockSize: number;
  private searchRange: number;

  constructor(blockSize: number = 16, searchRange: number = 32) {
    this.blockSize = blockSize;
    this.searchRange = searchRange;
  }

  /**
   * Compute optical flow using block matching
   */
  compute(img1: GrayscaleImage, img2: GrayscaleImage): FlowField {
    const { width, height } = img1;
    const flow = createFlowField(width, height);

    const half = Math.floor(this.blockSize / 2);

    for (let by = half; by < height - half; by += this.blockSize) {
      for (let bx = half; bx < width - half; bx += this.blockSize) {
        // Find best match for this block
        const { dx, dy } = this.findBestMatch(img1, img2, bx, by);

        // Fill flow for all pixels in block
        for (let py = 0; py < this.blockSize && by + py < height; py++) {
          for (let px = 0; px < this.blockSize && bx + px < width; px++) {
            const y = by + py - half;
            const x = bx + px - half;
            if (y >= 0 && y < height && x >= 0 && x < width) {
              flow.u[y][x] = dx;
              flow.v[y][x] = dy;
            }
          }
        }
      }
    }

    return flow;
  }

  private findBestMatch(
    img1: GrayscaleImage,
    img2: GrayscaleImage,
    cx: number,
    cy: number
  ): { dx: number; dy: number } {
    const half = Math.floor(this.blockSize / 2);
    let bestDx = 0, bestDy = 0;
    let bestSAD = Infinity;

    for (let dy = -this.searchRange; dy <= this.searchRange; dy++) {
      for (let dx = -this.searchRange; dx <= this.searchRange; dx++) {
        let sad = 0;

        for (let py = -half; py < half; py++) {
          for (let px = -half; px < half; px++) {
            const v1 = getPixel(img1, cx + px, cy + py);
            const v2 = getPixel(img2, cx + px + dx, cy + py + dy);
            sad += Math.abs(v1 - v2);
          }
        }

        if (sad < bestSAD) {
          bestSAD = sad;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }

    return { dx: bestDx, dy: bestDy };
  }
}

// ============================================================================
// PHASE CORRELATION
// ============================================================================

class PhaseCorrelationFlow {
  private blockSize: number;

  constructor(blockSize: number = 64) {
    this.blockSize = blockSize;
  }

  /**
   * Compute global translation using phase correlation
   */
  computeGlobalTranslation(img1: GrayscaleImage, img2: GrayscaleImage): { dx: number; dy: number } {
    const size = this.blockSize;
    const cx = Math.floor(img1.width / 2);
    const cy = Math.floor(img1.height / 2);

    // Extract central blocks
    const block1 = this.extractBlock(img1, cx, cy, size);
    const block2 = this.extractBlock(img2, cx, cy, size);

    // Compute DFT (simplified 2D DFT)
    const F1 = this.dft2D(block1);
    const F2 = this.dft2D(block2);

    // Cross power spectrum
    const R = this.crossPowerSpectrum(F1, F2);

    // Inverse DFT
    const r = this.idft2D(R, size);

    // Find peak
    let maxVal = 0;
    let peakX = 0, peakY = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (r[y][x] > maxVal) {
          maxVal = r[y][x];
          peakX = x;
          peakY = y;
        }
      }
    }

    // Convert to displacement
    const dx = peakX > size / 2 ? peakX - size : peakX;
    const dy = peakY > size / 2 ? peakY - size : peakY;

    return { dx, dy };
  }

  /**
   * Compute block-based flow field
   */
  compute(img1: GrayscaleImage, img2: GrayscaleImage): FlowField {
    const { width, height } = img1;
    const flow = createFlowField(width, height);
    const step = this.blockSize / 2;

    for (let by = 0; by < height; by += step) {
      for (let bx = 0; bx < width; bx += step) {
        const blockCx = Math.min(bx + step, width - 1);
        const blockCy = Math.min(by + step, height - 1);

        const block1 = this.extractBlock(img1, blockCx, blockCy, this.blockSize);
        const block2 = this.extractBlock(img2, blockCx, blockCy, this.blockSize);

        const F1 = this.dft2D(block1);
        const F2 = this.dft2D(block2);
        const R = this.crossPowerSpectrum(F1, F2);
        const r = this.idft2D(R, this.blockSize);

        // Find peak
        let maxVal = 0;
        let peakX = 0, peakY = 0;

        for (let y = 0; y < this.blockSize; y++) {
          for (let x = 0; x < this.blockSize; x++) {
            if (r[y][x] > maxVal) {
              maxVal = r[y][x];
              peakX = x;
              peakY = y;
            }
          }
        }

        const dx = peakX > this.blockSize / 2 ? peakX - this.blockSize : peakX;
        const dy = peakY > this.blockSize / 2 ? peakY - this.blockSize : peakY;

        // Fill flow
        for (let py = 0; py < step && by + py < height; py++) {
          for (let px = 0; px < step && bx + px < width; px++) {
            flow.u[by + py][bx + px] = dx;
            flow.v[by + py][bx + px] = dy;
          }
        }
      }
    }

    return flow;
  }

  private extractBlock(img: GrayscaleImage, cx: number, cy: number, size: number): number[][] {
    const block: number[][] = [];
    const half = size / 2;

    for (let y = 0; y < size; y++) {
      block[y] = [];
      for (let x = 0; x < size; x++) {
        block[y][x] = getPixel(img, cx - half + x, cy - half + y);
      }
    }

    return block;
  }

  private dft2D(block: number[][]): { real: number[][]; imag: number[][] } {
    const size = block.length;
    const real: number[][] = [];
    const imag: number[][] = [];

    for (let v = 0; v < size; v++) {
      real[v] = [];
      imag[v] = [];
      for (let u = 0; u < size; u++) {
        let sumR = 0, sumI = 0;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const angle = -2 * Math.PI * (u * x / size + v * y / size);
            sumR += block[y][x] * Math.cos(angle);
            sumI += block[y][x] * Math.sin(angle);
          }
        }
        real[v][u] = sumR;
        imag[v][u] = sumI;
      }
    }

    return { real, imag };
  }

  private crossPowerSpectrum(
    F1: { real: number[][]; imag: number[][] },
    F2: { real: number[][]; imag: number[][] }
  ): { real: number[][]; imag: number[][] } {
    const size = F1.real.length;
    const real: number[][] = [];
    const imag: number[][] = [];

    for (let v = 0; v < size; v++) {
      real[v] = [];
      imag[v] = [];
      for (let u = 0; u < size; u++) {
        // F1 * conj(F2)
        const r1 = F1.real[v][u], i1 = F1.imag[v][u];
        const r2 = F2.real[v][u], i2 = -F2.imag[v][u]; // conjugate

        const prodR = r1 * r2 - i1 * i2;
        const prodI = r1 * i2 + i1 * r2;

        const mag = Math.sqrt(prodR * prodR + prodI * prodI) + 1e-10;
        real[v][u] = prodR / mag;
        imag[v][u] = prodI / mag;
      }
    }

    return { real, imag };
  }

  private idft2D(F: { real: number[][]; imag: number[][] }, size: number): number[][] {
    const result: number[][] = [];

    for (let y = 0; y < size; y++) {
      result[y] = [];
      for (let x = 0; x < size; x++) {
        let sum = 0;
        for (let v = 0; v < size; v++) {
          for (let u = 0; u < size; u++) {
            const angle = 2 * Math.PI * (u * x / size + v * y / size);
            sum += F.real[v][u] * Math.cos(angle) - F.imag[v][u] * Math.sin(angle);
          }
        }
        result[y][x] = sum / (size * size);
      }
    }

    return result;
  }
}

// ============================================================================
// FLOW UTILITIES AND MOTION SEGMENTATION
// ============================================================================

function computeFlowMagnitude(flow: FlowField): GrayscaleImage {
  const { width, height, u, v } = flow;
  const result = createImage(width, height);

  let maxMag = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mag = Math.sqrt(u[y][x] * u[y][x] + v[y][x] * v[y][x]);
      result.data[y][x] = mag;
      maxMag = Math.max(maxMag, mag);
    }
  }

  // Normalize to 0-255
  if (maxMag > 0) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result.data[y][x] = (result.data[y][x] / maxMag) * 255;
      }
    }
  }

  return result;
}

function computeFlowDirection(flow: FlowField): GrayscaleImage {
  const { width, height, u, v } = flow;
  const result = createImage(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const angle = Math.atan2(v[y][x], u[y][x]);
      result.data[y][x] = ((angle + Math.PI) / (2 * Math.PI)) * 255;
    }
  }

  return result;
}

function segmentMotion(flow: FlowField, threshold: number = 1.0): MotionSegment[] {
  const { width, height, u, v } = flow;
  const visited: boolean[][] = [];
  const labels: number[][] = [];

  for (let y = 0; y < height; y++) {
    visited[y] = new Array(width).fill(false);
    labels[y] = new Array(width).fill(-1);
  }

  const segments: MotionSegment[] = [];
  let labelId = 0;

  const dx = [-1, 0, 1, 0, -1, 1, 1, -1];
  const dy = [0, -1, 0, 1, -1, -1, 1, 1];

  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const mag = Math.sqrt(u[sy][sx] * u[sy][sx] + v[sy][sx] * v[sy][sx]);

      if (!visited[sy][sx] && mag > threshold) {
        // BFS to find connected region
        const queue: { x: number; y: number }[] = [{ x: sx, y: sy }];
        const pixels: { x: number; y: number }[] = [];
        let sumU = 0, sumV = 0;
        let sumX = 0, sumY = 0;

        while (queue.length > 0) {
          const { x, y } = queue.shift()!;

          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          if (visited[y][x]) continue;

          const pMag = Math.sqrt(u[y][x] * u[y][x] + v[y][x] * v[y][x]);
          if (pMag <= threshold) continue;

          visited[y][x] = true;
          labels[y][x] = labelId;
          pixels.push({ x, y });
          sumU += u[y][x];
          sumV += v[y][x];
          sumX += x;
          sumY += y;

          for (let d = 0; d < 8; d++) {
            queue.push({ x: x + dx[d], y: y + dy[d] });
          }
        }

        if (pixels.length > 10) {
          segments.push({
            id: labelId,
            pixels,
            centroid: { x: sumX / pixels.length, y: sumY / pixels.length },
            avgFlow: { u: sumU / pixels.length, v: sumV / pixels.length },
            area: pixels.length
          });
          labelId++;
        }
      }
    }
  }

  return segments;
}

function visualizeFlow(flow: FlowField, step: number = 10): string {
  const { width, height, u, v } = flow;
  const lines: string[] = [];

  // Find max magnitude for scaling
  let maxMag = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const mag = Math.sqrt(u[y][x] * u[y][x] + v[y][x] * v[y][x]);
      maxMag = Math.max(maxMag, mag);
    }
  }

  const scale = maxMag > 0 ? 2 / maxMag : 1;

  for (let y = 0; y < height; y += step) {
    let line = '';
    for (let x = 0; x < width; x += step) {
      const ux = u[y][x] * scale;
      const vy = v[y][x] * scale;
      const mag = Math.sqrt(ux * ux + vy * vy);

      if (mag < 0.1) {
        line += '.';
      } else {
        const angle = Math.atan2(vy, ux);
        const dir = Math.round((angle + Math.PI) / (Math.PI / 4)) % 8;
        const arrows = ['>', '/', '^', '\\', '<', '/', 'v', '\\'];
        line += arrows[dir];
      }
    }
    lines.push(line);
  }

  return lines.join('\n');
}

// ============================================================================
// FLOW STATISTICS
// ============================================================================

function computeFlowStatistics(flow: FlowField): {
  avgMagnitude: number;
  maxMagnitude: number;
  avgAngle: number;
  coverage: number;
  vectors: FlowVector[];
} {
  const { width, height, u, v } = flow;
  let sumMag = 0, maxMag = 0;
  let sumAngle = 0;
  let nonZeroCount = 0;
  const vectors: FlowVector[] = [];

  for (let y = 0; y < height; y += 5) {
    for (let x = 0; x < width; x += 5) {
      const ux = u[y][x];
      const vy = v[y][x];
      const mag = Math.sqrt(ux * ux + vy * vy);
      const angle = Math.atan2(vy, ux);

      if (mag > 0.1) {
        sumMag += mag;
        maxMag = Math.max(maxMag, mag);
        sumAngle += angle;
        nonZeroCount++;
        vectors.push({ x, y, u: ux, v: vy, magnitude: mag, angle });
      }
    }
  }

  return {
    avgMagnitude: nonZeroCount > 0 ? sumMag / nonZeroCount : 0,
    maxMagnitude: maxMag,
    avgAngle: nonZeroCount > 0 ? sumAngle / nonZeroCount : 0,
    coverage: nonZeroCount / ((width * height) / 25),
    vectors: vectors.slice(0, 50)
  };
}

// ============================================================================
// TEST IMAGE GENERATION
// ============================================================================

function generateTestFrames(
  width: number,
  height: number,
  motionType: 'translation' | 'rotation' | 'zoom' | 'random'
): { frame1: GrayscaleImage; frame2: GrayscaleImage } {
  const frame1 = createImage(width, height);
  const frame2 = createImage(width, height);

  // Draw pattern on frame1
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Checkerboard with circles
      const checkSize = 20;
      const isCheck = ((Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0);
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      const isCircle = (Math.floor(dist / 15) % 2 === 0);

      frame1.data[y][x] = (isCheck !== isCircle) ? 200 : 50;
    }
  }

  // Generate frame2 with motion
  switch (motionType) {
    case 'translation': {
      const dx = 5, dy = 3;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          frame2.data[y][x] = getPixel(frame1, x - dx, y - dy);
        }
      }
      break;
    }
    case 'rotation': {
      const angle = 0.05;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const rx = x - cx, ry = y - cy;
          const srcX = cx + rx * cos + ry * sin;
          const srcY = cy - rx * sin + ry * cos;
          frame2.data[y][x] = bilinearInterpolate(frame1, srcX, srcY);
        }
      }
      break;
    }
    case 'zoom': {
      const scale = 1.05;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcX = cx + (x - cx) / scale;
          const srcY = cy + (y - cy) / scale;
          frame2.data[y][x] = bilinearInterpolate(frame1, srcX, srcY);
        }
      }
      break;
    }
    case 'random':
    default: {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = Math.sin(x / 20) * 3;
          const dy = Math.cos(y / 20) * 3;
          frame2.data[y][x] = bilinearInterpolate(frame1, x - dx, y - dy);
        }
      }
    }
  }

  return { frame1, frame2 };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const opticalflowTool: UnifiedTool = {
  name: 'optical_flow',
  description: 'Optical flow computation for motion estimation: Lucas-Kanade, Horn-Schunck, Farneback, block matching, phase correlation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'compute_flow', 'lucas_kanade', 'horn_schunck', 'farneback',
          'block_matching', 'phase_correlation', 'visualize_flow',
          'segment_motion', 'analyze_movement', 'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      method: {
        type: 'string',
        enum: ['lucas_kanade', 'horn_schunck', 'farneback', 'block_matching', 'phase_correlation'],
        description: 'Optical flow method to use'
      },
      frame1: {
        type: 'object',
        description: 'First frame { width, height, data: number[][] }'
      },
      frame2: {
        type: 'object',
        description: 'Second frame { width, height, data: number[][] }'
      },
      points: {
        type: 'array',
        description: 'Points for sparse flow [{x, y}, ...]'
      },
      params: {
        type: 'object',
        description: 'Method-specific parameters'
      },
      motionType: {
        type: 'string',
        enum: ['translation', 'rotation', 'zoom', 'random'],
        description: 'Type of motion for demo'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeopticalflow(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, frame1, frame2, params, motionType } = args;

    let result: unknown;

    switch (operation) {
      case 'compute_flow':
      case 'lucas_kanade': {
        const useFrames = frame1 && frame2
          ? { frame1, frame2 }
          : generateTestFrames(100, 80, motionType || 'translation');

        const lk = new LucasKanadeFlow(
          params?.windowSize ?? 15,
          params?.minEigenvalue ?? 0.01
        );

        const flow = lk.computeDense(useFrames.frame1, useFrames.frame2, params?.step ?? 5);
        const stats = computeFlowStatistics(flow);

        result = {
          operation: 'lucas_kanade',
          method: 'Lucas-Kanade',
          parameters: {
            windowSize: params?.windowSize ?? 15,
            minEigenvalue: params?.minEigenvalue ?? 0.01
          },
          flowFieldSize: { width: flow.width, height: flow.height },
          statistics: {
            avgMagnitude: stats.avgMagnitude.toFixed(3),
            maxMagnitude: stats.maxMagnitude.toFixed(3),
            coverage: (stats.coverage * 100).toFixed(1) + '%'
          },
          visualization: visualizeFlow(flow, 5),
          sampleVectors: stats.vectors.slice(0, 20)
        };
        break;
      }

      case 'horn_schunck': {
        const useFrames = frame1 && frame2
          ? { frame1, frame2 }
          : generateTestFrames(80, 60, motionType || 'translation');

        const hs = new HornSchunckFlow(
          params?.alpha ?? 1.0,
          params?.iterations ?? 100
        );

        const flow = hs.compute(useFrames.frame1, useFrames.frame2);
        const stats = computeFlowStatistics(flow);

        result = {
          operation: 'horn_schunck',
          method: 'Horn-Schunck',
          parameters: {
            alpha: params?.alpha ?? 1.0,
            iterations: params?.iterations ?? 100
          },
          description: 'Dense optical flow with global smoothness constraint',
          flowFieldSize: { width: flow.width, height: flow.height },
          statistics: {
            avgMagnitude: stats.avgMagnitude.toFixed(3),
            maxMagnitude: stats.maxMagnitude.toFixed(3)
          },
          visualization: visualizeFlow(flow, 4),
          sampleVectors: stats.vectors.slice(0, 15)
        };
        break;
      }

      case 'farneback': {
        const useFrames = frame1 && frame2
          ? { frame1, frame2 }
          : generateTestFrames(80, 60, motionType || 'translation');

        const fb = new FarnebackFlow(
          params?.numLevels ?? 3,
          params?.pyrScale ?? 0.5,
          params?.winSize ?? 13,
          params?.iterations ?? 10
        );

        const flow = fb.compute(useFrames.frame1, useFrames.frame2);
        const stats = computeFlowStatistics(flow);

        result = {
          operation: 'farneback',
          method: 'Farneback',
          parameters: {
            numLevels: params?.numLevels ?? 3,
            pyrScale: params?.pyrScale ?? 0.5,
            winSize: params?.winSize ?? 13,
            iterations: params?.iterations ?? 10
          },
          description: 'Dense optical flow using polynomial expansion',
          flowFieldSize: { width: flow.width, height: flow.height },
          statistics: {
            avgMagnitude: stats.avgMagnitude.toFixed(3),
            maxMagnitude: stats.maxMagnitude.toFixed(3)
          },
          visualization: visualizeFlow(flow, 4),
          sampleVectors: stats.vectors.slice(0, 15)
        };
        break;
      }

      case 'block_matching': {
        const useFrames = frame1 && frame2
          ? { frame1, frame2 }
          : generateTestFrames(100, 80, motionType || 'translation');

        const bm = new BlockMatchingFlow(
          params?.blockSize ?? 16,
          params?.searchRange ?? 32
        );

        const flow = bm.compute(useFrames.frame1, useFrames.frame2);
        const stats = computeFlowStatistics(flow);

        result = {
          operation: 'block_matching',
          method: 'Block Matching',
          parameters: {
            blockSize: params?.blockSize ?? 16,
            searchRange: params?.searchRange ?? 32
          },
          description: 'Motion estimation using Sum of Absolute Differences',
          flowFieldSize: { width: flow.width, height: flow.height },
          statistics: {
            avgMagnitude: stats.avgMagnitude.toFixed(3),
            maxMagnitude: stats.maxMagnitude.toFixed(3)
          },
          visualization: visualizeFlow(flow, 8),
          sampleVectors: stats.vectors.slice(0, 15)
        };
        break;
      }

      case 'phase_correlation': {
        const useFrames = frame1 && frame2
          ? { frame1, frame2 }
          : generateTestFrames(128, 96, motionType || 'translation');

        const pc = new PhaseCorrelationFlow(params?.blockSize ?? 64);

        // Global translation
        const global = pc.computeGlobalTranslation(useFrames.frame1, useFrames.frame2);

        // Block-based flow
        const flow = pc.compute(useFrames.frame1, useFrames.frame2);
        const stats = computeFlowStatistics(flow);

        result = {
          operation: 'phase_correlation',
          method: 'Phase Correlation',
          parameters: { blockSize: params?.blockSize ?? 64 },
          description: 'Frequency-domain motion estimation',
          globalTranslation: global,
          flowFieldSize: { width: flow.width, height: flow.height },
          statistics: {
            avgMagnitude: stats.avgMagnitude.toFixed(3),
            maxMagnitude: stats.maxMagnitude.toFixed(3)
          },
          visualization: visualizeFlow(flow, 8)
        };
        break;
      }

      case 'visualize_flow': {
        const useFrames = frame1 && frame2
          ? { frame1, frame2 }
          : generateTestFrames(100, 80, motionType || 'translation');

        const lk = new LucasKanadeFlow();
        const flow = lk.computeDense(useFrames.frame1, useFrames.frame2, 5);

        const magImage = computeFlowMagnitude(flow);
        const dirImage = computeFlowDirection(flow);

        result = {
          operation: 'visualize_flow',
          flowVisualization: visualizeFlow(flow, 4),
          magnitudeStats: {
            min: Math.min(...magImage.data.flat()),
            max: Math.max(...magImage.data.flat())
          },
          directionStats: {
            sample: dirImage.data.slice(0, 10).map(row => row.slice(0, 10))
          },
          legend: {
            arrows: '> / ^ \\ < / v \\ indicate flow direction',
            dot: '. indicates minimal motion'
          }
        };
        break;
      }

      case 'segment_motion': {
        const useFrames = frame1 && frame2
          ? { frame1, frame2 }
          : generateTestFrames(100, 80, motionType || 'translation');

        const lk = new LucasKanadeFlow();
        const flow = lk.computeDense(useFrames.frame1, useFrames.frame2, 3);

        const segments = segmentMotion(flow, params?.threshold ?? 1.0);

        result = {
          operation: 'segment_motion',
          threshold: params?.threshold ?? 1.0,
          numSegments: segments.length,
          segments: segments.map(s => ({
            id: s.id,
            area: s.area,
            centroid: { x: Math.round(s.centroid.x), y: Math.round(s.centroid.y) },
            avgFlow: {
              u: s.avgFlow.u.toFixed(2),
              v: s.avgFlow.v.toFixed(2),
              magnitude: Math.sqrt(s.avgFlow.u ** 2 + s.avgFlow.v ** 2).toFixed(2)
            }
          })),
          flowVisualization: visualizeFlow(flow, 4)
        };
        break;
      }

      case 'analyze_movement': {
        const { frame1: f1, frame2: f2 } = generateTestFrames(
          params?.width ?? 100,
          params?.height ?? 80,
          motionType || 'translation'
        );

        // Run multiple methods
        const lk = new LucasKanadeFlow();
        const hs = new HornSchunckFlow(1.0, 50);
        const bm = new BlockMatchingFlow(16, 32);

        const lkFlow = lk.computeDense(f1, f2, 5);
        const hsFlow = hs.compute(f1, f2);
        const bmFlow = bm.compute(f1, f2);

        const lkStats = computeFlowStatistics(lkFlow);
        const hsStats = computeFlowStatistics(hsFlow);
        const bmStats = computeFlowStatistics(bmFlow);

        result = {
          operation: 'analyze_movement',
          motionType: motionType || 'translation',
          imageSize: { width: f1.width, height: f1.height },
          methodComparison: {
            lucasKanade: {
              avgMagnitude: lkStats.avgMagnitude.toFixed(3),
              maxMagnitude: lkStats.maxMagnitude.toFixed(3),
              coverage: (lkStats.coverage * 100).toFixed(1) + '%'
            },
            hornSchunck: {
              avgMagnitude: hsStats.avgMagnitude.toFixed(3),
              maxMagnitude: hsStats.maxMagnitude.toFixed(3),
              coverage: (hsStats.coverage * 100).toFixed(1) + '%'
            },
            blockMatching: {
              avgMagnitude: bmStats.avgMagnitude.toFixed(3),
              maxMagnitude: bmStats.maxMagnitude.toFixed(3),
              coverage: (bmStats.coverage * 100).toFixed(1) + '%'
            }
          },
          visualizations: {
            lucasKanade: visualizeFlow(lkFlow, 5),
            hornSchunck: visualizeFlow(hsFlow, 5)
          }
        };
        break;
      }

      case 'demo': {
        const motion = motionType || 'translation';
        const { frame1: f1, frame2: f2 } = generateTestFrames(80, 60, motion);

        const lk = new LucasKanadeFlow();
        const flow = lk.computeDense(f1, f2, 4);
        const stats = computeFlowStatistics(flow);
        const segments = segmentMotion(flow, 0.5);

        result = {
          operation: 'demo',
          motionType: motion,
          imageSize: { width: 80, height: 60 },
          flowVisualization: visualizeFlow(flow, 4),
          statistics: {
            avgMagnitude: stats.avgMagnitude.toFixed(3),
            maxMagnitude: stats.maxMagnitude.toFixed(3),
            coverage: (stats.coverage * 100).toFixed(1) + '%'
          },
          motionSegments: segments.length,
          description: `Demo showing ${motion} motion detected using Lucas-Kanade optical flow`
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'Lucas-Kanade optical flow',
              code: `{ "operation": "lucas_kanade", "motionType": "translation" }`
            },
            {
              name: 'Horn-Schunck dense flow',
              code: `{ "operation": "horn_schunck", "params": { "alpha": 1.0, "iterations": 100 } }`
            },
            {
              name: 'Farneback pyramidal flow',
              code: `{ "operation": "farneback", "params": { "numLevels": 3, "pyrScale": 0.5 } }`
            },
            {
              name: 'Block matching',
              code: `{ "operation": "block_matching", "params": { "blockSize": 16, "searchRange": 32 } }`
            },
            {
              name: 'Phase correlation',
              code: `{ "operation": "phase_correlation", "params": { "blockSize": 64 } }`
            },
            {
              name: 'Motion segmentation',
              code: `{ "operation": "segment_motion", "params": { "threshold": 1.0 } }`
            },
            {
              name: 'Compare methods',
              code: `{ "operation": "analyze_movement", "motionType": "rotation" }`
            }
          ]
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'optical_flow',
          description: 'Comprehensive optical flow algorithms for motion estimation',
          methods: {
            lucas_kanade: {
              type: 'Sparse/Dense local',
              description: 'Assumes constant flow in local neighborhood, solves with least squares',
              pros: 'Fast, accurate for small motions',
              cons: 'Fails for large displacements'
            },
            horn_schunck: {
              type: 'Dense global',
              description: 'Minimizes flow smoothness constraint with regularization',
              pros: 'Produces smooth dense flow',
              cons: 'Over-smooths motion boundaries'
            },
            farneback: {
              type: 'Dense pyramidal',
              description: 'Uses polynomial expansion with coarse-to-fine pyramid',
              pros: 'Handles large displacements, accurate',
              cons: 'More computationally expensive'
            },
            block_matching: {
              type: 'Block-based',
              description: 'Finds best matching block using SAD/SSD',
              pros: 'Simple, used in video compression',
              cons: 'Block artifacts, only pixel-accurate'
            },
            phase_correlation: {
              type: 'Frequency domain',
              description: 'Uses cross-power spectrum for translation estimation',
              pros: 'Robust to noise, fast with FFT',
              cons: 'Best for global/translational motion'
            }
          },
          operations: [
            'compute_flow', 'lucas_kanade', 'horn_schunck', 'farneback',
            'block_matching', 'phase_correlation', 'visualize_flow',
            'segment_motion', 'analyze_movement', 'demo', 'info', 'examples'
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
      content: `Error in optical_flow: ${error}`,
      isError: true
    };
  }
}

export function isopticalflowAvailable(): boolean {
  return true;
}
