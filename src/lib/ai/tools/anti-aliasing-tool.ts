/**
 * ANTI-ALIASING TOOL
 * Comprehensive anti-aliasing algorithms for image and graphics processing
 *
 * Features:
 * - FXAA (Fast Approximate Anti-Aliasing)
 * - MSAA simulation (Multi-Sample Anti-Aliasing)
 * - SMAA (Subpixel Morphological Anti-Aliasing)
 * - Edge detection based smoothing
 * - Supersampling
 * - Temporal anti-aliasing concepts
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Image {
  width: number;
  height: number;
  data: number[][][]; // [y][x][rgba]
}

interface Pixel {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface EdgeInfo {
  horizontal: boolean;
  vertical: boolean;
  diagonal: boolean;
  strength: number;
}

export interface AAParams {
  threshold?: number;
  searchSteps?: number;
  subpixelQuality?: number;
  edgeSharpness?: number;
  samples?: number;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(value: number, min: number = 0, max: number = 255): number {
  return Math.max(min, Math.min(max, value));
}

function blendPixels(p1: Pixel, p2: Pixel, t: number): Pixel {
  return {
    r: p1.r * (1 - t) + p2.r * t,
    g: p1.g * (1 - t) + p2.g * t,
    b: p1.b * (1 - t) + p2.b * t,
    a: ((p1.a ?? 255) * (1 - t) + (p2.a ?? 255) * t)
  };
}

function averagePixels(pixels: Pixel[]): Pixel {
  if (pixels.length === 0) return { r: 0, g: 0, b: 0, a: 255 };

  let r = 0, g = 0, b = 0, a = 0;
  for (const p of pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
    a += p.a ?? 255;
  }

  const n = pixels.length;
  return { r: r / n, g: g / n, b: b / n, a: a / n };
}

function getPixel(image: Image, x: number, y: number): Pixel {
  const cx = Math.max(0, Math.min(image.width - 1, x));
  const cy = Math.max(0, Math.min(image.height - 1, y));
  const pixel = image.data[cy][cx];
  return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] ?? 255 };
}

function setPixel(image: Image, x: number, y: number, pixel: Pixel): void {
  if (x >= 0 && x < image.width && y >= 0 && y < image.height) {
    image.data[y][x] = [
      clamp(Math.round(pixel.r)),
      clamp(Math.round(pixel.g)),
      clamp(Math.round(pixel.b)),
      clamp(Math.round(pixel.a ?? 255))
    ];
  }
}

// ============================================================================
// EDGE DETECTION
// ============================================================================

function detectEdges(image: Image, threshold: number = 0.1): EdgeInfo[][] {
  const { width, height } = image;
  const edges: EdgeInfo[][] = [];

  for (let y = 0; y < height; y++) {
    edges[y] = [];
    for (let x = 0; x < width; x++) {
      const c = getPixel(image, x, y);
      const n = getPixel(image, x, y - 1);
      const s = getPixel(image, x, y + 1);
      const e = getPixel(image, x + 1, y);
      const w = getPixel(image, x - 1, y);
      const ne = getPixel(image, x + 1, y - 1);
      const nw = getPixel(image, x - 1, y - 1);
      const se = getPixel(image, x + 1, y + 1);
      const sw = getPixel(image, x - 1, y + 1);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _lC = luminance(c.r, c.g, c.b) / 255;
      const lN = luminance(n.r, n.g, n.b) / 255;
      const lS = luminance(s.r, s.g, s.b) / 255;
      const lE = luminance(e.r, e.g, e.b) / 255;
      const lW = luminance(w.r, w.g, w.b) / 255;
      const lNE = luminance(ne.r, ne.g, ne.b) / 255;
      const lNW = luminance(nw.r, nw.g, nw.b) / 255;
      const lSE = luminance(se.r, se.g, se.b) / 255;
      const lSW = luminance(sw.r, sw.g, sw.b) / 255;

      // Sobel gradients
      const gx = -lNW - 2 * lW - lSW + lNE + 2 * lE + lSE;
      const gy = -lNW - 2 * lN - lNE + lSW + 2 * lS + lSE;

      const strength = Math.sqrt(gx * gx + gy * gy);
      const horizontal = Math.abs(gy) > threshold;
      const vertical = Math.abs(gx) > threshold;
      const diagonal = Math.abs(lNE - lSW) > threshold || Math.abs(lNW - lSE) > threshold;

      edges[y][x] = { horizontal, vertical, diagonal, strength };
    }
  }

  return edges;
}

// ============================================================================
// FXAA (Fast Approximate Anti-Aliasing)
// ============================================================================

class FXAAFilter {
  private threshold: number;
  private subpixelQuality: number;

  constructor(threshold: number = 0.0833, subpixelQuality: number = 0.75) {
    this.threshold = threshold;
    this.subpixelQuality = subpixelQuality;
  }

  apply(image: Image): Image {
    const { width, height } = image;
    const output: Image = {
      width,
      height,
      data: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => [0, 0, 0, 255])
      )
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const result = this.fxaaPixel(image, x, y);
        setPixel(output, x, y, result);
      }
    }

    return output;
  }

  private fxaaPixel(image: Image, x: number, y: number): Pixel {
    // Get local contrast
    const c = getPixel(image, x, y);
    const n = getPixel(image, x, y - 1);
    const s = getPixel(image, x, y + 1);
    const e = getPixel(image, x + 1, y);
    const w = getPixel(image, x - 1, y);

    const lC = luminance(c.r, c.g, c.b) / 255;
    const lN = luminance(n.r, n.g, n.b) / 255;
    const lS = luminance(s.r, s.g, s.b) / 255;
    const lE = luminance(e.r, e.g, e.b) / 255;
    const lW = luminance(w.r, w.g, w.b) / 255;

    const rangeMin = Math.min(lC, lN, lS, lE, lW);
    const rangeMax = Math.max(lC, lN, lS, lE, lW);
    const range = rangeMax - rangeMin;

    // Skip if contrast is too low
    if (range < Math.max(0.0312, rangeMax * this.threshold)) {
      return c;
    }

    // Get corner luminances
    const ne = getPixel(image, x + 1, y - 1);
    const nw = getPixel(image, x - 1, y - 1);
    const se = getPixel(image, x + 1, y + 1);
    const sw = getPixel(image, x - 1, y + 1);

    const lNE = luminance(ne.r, ne.g, ne.b) / 255;
    const lNW = luminance(nw.r, nw.g, nw.b) / 255;
    const lSE = luminance(se.r, se.g, se.b) / 255;
    const lSW = luminance(sw.r, sw.g, sw.b) / 255;

    // Compute edge direction
    const edgeH = Math.abs(-2 * lW + lNW + lSW) +
                  Math.abs(-2 * lC + lN + lS) * 2 +
                  Math.abs(-2 * lE + lNE + lSE);
    const edgeV = Math.abs(-2 * lN + lNW + lNE) +
                  Math.abs(-2 * lC + lW + lE) * 2 +
                  Math.abs(-2 * lS + lSW + lSE);

    const isHorizontal = edgeH >= edgeV;

    // Determine blend direction and amount
    const luma1 = isHorizontal ? lN : lW;
    const luma2 = isHorizontal ? lS : lE;
    const gradient1 = Math.abs(luma1 - lC);
    const gradient2 = Math.abs(luma2 - lC);

    const is1Steeper = gradient1 >= gradient2;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _stepLength = isHorizontal ? 1 / image.height : 1 / image.width;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _localAvg = (luma1 + luma2) * 0.5;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _gradient = (gradient1 + gradient2) * 0.5;

    // Subpixel AA
    const subpixelOffset = Math.abs(
      ((lN + lS + lE + lW) * 0.25 + (lNE + lNW + lSE + lSW) * 0.25 * 0.5) * 0.5 - lC
    ) / range;
    const subpixelOffsetFinal = Math.pow(subpixelOffset * 2, 2) * this.subpixelQuality;

    // Compute final blend
    const blendFactor = Math.min(subpixelOffsetFinal, 0.75);

    // Blend with neighbors
    let blendPixel: Pixel;
    if (isHorizontal) {
      blendPixel = is1Steeper ? n : s;
    } else {
      blendPixel = is1Steeper ? w : e;
    }

    return blendPixels(c, blendPixel, blendFactor);
  }
}

// ============================================================================
// MSAA SIMULATION
// ============================================================================

class MSAAFilter {
  private samples: number;

  constructor(samples: number = 4) {
    // Common MSAA sample counts: 2, 4, 8, 16
    this.samples = Math.min(16, Math.max(2, samples));
  }

  /**
   * Apply MSAA simulation by supersampling and downsampling
   */
  apply(image: Image): Image {
    const { width, height } = image;

    // Generate sample offsets (jittered grid)
    const offsets = this.generateSampleOffsets();

    const output: Image = {
      width,
      height,
      data: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => [0, 0, 0, 255])
      )
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const samples: Pixel[] = [];

        for (const offset of offsets) {
          const sx = x + offset.x;
          const sy = y + offset.y;

          // Bilinear interpolation for subpixel sampling
          const pixel = this.sampleBilinear(image, sx, sy);
          samples.push(pixel);
        }

        const result = averagePixels(samples);
        setPixel(output, x, y, result);
      }
    }

    return output;
  }

  private generateSampleOffsets(): { x: number; y: number }[] {
    const offsets: { x: number; y: number }[] = [];

    if (this.samples === 2) {
      // 2x MSAA: diagonal pattern
      offsets.push({ x: 0.25, y: 0.25 }, { x: -0.25, y: -0.25 });
    } else if (this.samples === 4) {
      // 4x MSAA: rotated grid
      offsets.push(
        { x: -0.125, y: -0.375 },
        { x: 0.375, y: -0.125 },
        { x: -0.375, y: 0.125 },
        { x: 0.125, y: 0.375 }
      );
    } else if (this.samples === 8) {
      // 8x MSAA
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 16;
        const r = 0.3;
        offsets.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r
        });
      }
    } else {
      // 16x MSAA
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2 + Math.PI / 32;
        const r = 0.35 * (0.7 + 0.3 * ((i % 2) === 0 ? 1 : 0.5));
        offsets.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r
        });
      }
    }

    return offsets;
  }

  private sampleBilinear(image: Image, x: number, y: number): Pixel {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const dx = x - x0;
    const dy = y - y0;

    const p00 = getPixel(image, x0, y0);
    const p10 = getPixel(image, x1, y0);
    const p01 = getPixel(image, x0, y1);
    const p11 = getPixel(image, x1, y1);

    const top = blendPixels(p00, p10, dx);
    const bottom = blendPixels(p01, p11, dx);

    return blendPixels(top, bottom, dy);
  }
}

// ============================================================================
// SMAA (Subpixel Morphological Anti-Aliasing)
// ============================================================================

class SMAAFilter {
  private threshold: number;
  private searchSteps: number;

  constructor(threshold: number = 0.1, searchSteps: number = 16) {
    this.threshold = threshold;
    this.searchSteps = searchSteps;
  }

  /**
   * Apply SMAA in three passes:
   * 1. Edge detection
   * 2. Blending weight calculation
   * 3. Neighborhood blending
   */
  apply(image: Image): Image {
    const { width, height } = image;

    // Pass 1: Edge detection
    const edges = this.detectEdges(image);

    // Pass 2: Compute blending weights
    const weights = this.computeBlendingWeights(edges, width, height);

    // Pass 3: Apply blending
    const output: Image = {
      width,
      height,
      data: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => [0, 0, 0, 255])
      )
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const result = this.blendNeighborhood(image, weights, x, y);
        setPixel(output, x, y, result);
      }
    }

    return output;
  }

  private detectEdges(image: Image): boolean[][][] {
    const { width, height } = image;
    const edges: boolean[][][] = [];

    for (let y = 0; y < height; y++) {
      edges[y] = [];
      for (let x = 0; x < width; x++) {
        const c = getPixel(image, x, y);
        const r = getPixel(image, x + 1, y);
        const b = getPixel(image, x, y + 1);

        const lC = luminance(c.r, c.g, c.b) / 255;
        const lR = luminance(r.r, r.g, r.b) / 255;
        const lB = luminance(b.r, b.g, b.b) / 255;

        const edgeH = Math.abs(lC - lR) > this.threshold;
        const edgeV = Math.abs(lC - lB) > this.threshold;

        edges[y][x] = [edgeH, edgeV];
      }
    }

    return edges;
  }

  private computeBlendingWeights(
    edges: boolean[][][],
    width: number,
    height: number
  ): number[][][] {
    const weights: number[][][] = [];

    for (let y = 0; y < height; y++) {
      weights[y] = [];
      for (let x = 0; x < width; x++) {
        const [edgeH, edgeV] = edges[y]?.[x] ?? [false, false];

        let wLeft = 0, wRight = 0, wTop = 0, wBottom = 0;

        if (edgeH) {
          // Search along horizontal edge
          const leftDist = this.searchEdge(edges, x, y, -1, 0, true);
          const rightDist = this.searchEdge(edges, x, y, 1, 0, true);

          const length = leftDist + rightDist + 1;
          if (length > 1) {
            wLeft = leftDist / length;
            wRight = rightDist / length;
          }
        }

        if (edgeV) {
          // Search along vertical edge
          const topDist = this.searchEdge(edges, x, y, 0, -1, false);
          const bottomDist = this.searchEdge(edges, x, y, 0, 1, false);

          const length = topDist + bottomDist + 1;
          if (length > 1) {
            wTop = topDist / length;
            wBottom = bottomDist / length;
          }
        }

        weights[y][x] = [wLeft, wRight, wTop, wBottom];
      }
    }

    return weights;
  }

  private searchEdge(
    edges: boolean[][][],
    startX: number,
    startY: number,
    dx: number,
    dy: number,
    horizontal: boolean
  ): number {
    let x = startX + dx;
    let y = startY + dy;
    let steps = 0;

    while (steps < this.searchSteps) {
      if (y < 0 || y >= edges.length || x < 0 || x >= (edges[0]?.length ?? 0)) break;

      const [edgeH, edgeV] = edges[y]?.[x] ?? [false, false];
      if (!(horizontal ? edgeH : edgeV)) break;

      x += dx;
      y += dy;
      steps++;
    }

    return steps;
  }

  private blendNeighborhood(
    image: Image,
    weights: number[][][],
    x: number,
    y: number
  ): Pixel {
    const [wLeft, wRight, wTop, wBottom] = weights[y]?.[x] ?? [0, 0, 0, 0];

    const c = getPixel(image, x, y);
    const l = getPixel(image, x - 1, y);
    const r = getPixel(image, x + 1, y);
    const t = getPixel(image, x, y - 1);
    const b = getPixel(image, x, y + 1);

    const totalWeight = wLeft + wRight + wTop + wBottom;
    if (totalWeight < 0.001) return c;

    return {
      r: c.r * (1 - totalWeight * 0.25) + (l.r * wLeft + r.r * wRight + t.r * wTop + b.r * wBottom) * 0.25,
      g: c.g * (1 - totalWeight * 0.25) + (l.g * wLeft + r.g * wRight + t.g * wTop + b.g * wBottom) * 0.25,
      b: c.b * (1 - totalWeight * 0.25) + (l.b * wLeft + r.b * wRight + t.b * wTop + b.b * wBottom) * 0.25,
      a: c.a
    };
  }
}

// ============================================================================
// SUPERSAMPLING AA
// ============================================================================

class SupersamplingAA {
  private factor: number;

  constructor(factor: number = 2) {
    this.factor = Math.max(2, Math.min(4, factor));
  }

  /**
   * Simple supersampling: average NxN pixel blocks
   */
  apply(image: Image): Image {
    // For demonstration, we apply a blur-like effect
    // In real implementation, this would work on a higher-res render
    const { width, height } = image;

    const output: Image = {
      width,
      height,
      data: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => [0, 0, 0, 255])
      )
    };

    const radius = Math.floor(this.factor / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const samples: Pixel[] = [];

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            samples.push(getPixel(image, x + dx, y + dy));
          }
        }

        const result = averagePixels(samples);
        setPixel(output, x, y, result);
      }
    }

    return output;
  }
}

// ============================================================================
// EDGE-BASED SMOOTHING
// ============================================================================

function applyEdgeSmoothing(image: Image, threshold: number = 0.1, strength: number = 0.5): Image {
  const { width, height } = image;
  const edges = detectEdges(image, threshold);

  const output: Image = {
    width,
    height,
    data: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => [0, 0, 0, 255])
    )
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = edges[y][x];
      const c = getPixel(image, x, y);

      if (edge.strength < threshold) {
        setPixel(output, x, y, c);
        continue;
      }

      // Blur along edge direction
      const samples: Pixel[] = [c];

      if (edge.horizontal) {
        samples.push(getPixel(image, x - 1, y));
        samples.push(getPixel(image, x + 1, y));
      }
      if (edge.vertical) {
        samples.push(getPixel(image, x, y - 1));
        samples.push(getPixel(image, x, y + 1));
      }

      const blurred = averagePixels(samples);
      const result = blendPixels(c, blurred, strength * edge.strength);
      setPixel(output, x, y, result);
    }
  }

  return output;
}

// ============================================================================
// TEMPORAL AA CONCEPTS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TemporalAAState {
  previousFrame?: Image;
  jitterIndex: number;
  jitterPattern: { x: number; y: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createTemporalAAState(): TemporalAAState {
  return {
    jitterIndex: 0,
    jitterPattern: [
      { x: 0.25, y: 0.25 },
      { x: -0.25, y: 0.25 },
      { x: 0.25, y: -0.25 },
      { x: -0.25, y: -0.25 },
      { x: 0.125, y: 0.375 },
      { x: -0.125, y: 0.375 },
      { x: 0.375, y: -0.125 },
      { x: -0.375, y: -0.125 }
    ]
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function applyTemporalAA(
  currentFrame: Image,
  state: TemporalAAState,
  blendFactor: number = 0.1
): { output: Image; state: TemporalAAState } {
  const { width, height } = currentFrame;

  if (!state.previousFrame) {
    return {
      output: currentFrame,
      state: { ...state, previousFrame: currentFrame, jitterIndex: (state.jitterIndex + 1) % state.jitterPattern.length }
    };
  }

  const output: Image = {
    width,
    height,
    data: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => [0, 0, 0, 255])
    )
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const current = getPixel(currentFrame, x, y);
      const previous = getPixel(state.previousFrame, x, y);

      // Simple exponential moving average
      const result = blendPixels(previous, current, blendFactor);
      setPixel(output, x, y, result);
    }
  }

  return {
    output,
    state: {
      ...state,
      previousFrame: output,
      jitterIndex: (state.jitterIndex + 1) % state.jitterPattern.length
    }
  };
}

// ============================================================================
// TEST IMAGE GENERATION
// ============================================================================

function generateTestImage(width: number, height: number, pattern: string): Image {
  const data: number[][][] = [];

  for (let y = 0; y < height; y++) {
    data[y] = [];
    for (let x = 0; x < width; x++) {
      data[y][x] = [128, 128, 128, 255];
    }
  }

  switch (pattern) {
    case 'diagonal':
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x === y || x === y + 1 || x === y - 1) {
            data[y][x] = [255, 255, 255, 255];
          } else {
            data[y][x] = [0, 0, 0, 255];
          }
        }
      }
      break;

    case 'checkerboard':
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const checker = ((x + y) % 2) === 0;
          data[y][x] = checker ? [255, 255, 255, 255] : [0, 0, 0, 255];
        }
      }
      break;

    case 'edges':
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x < width / 2) {
            data[y][x] = [255, 0, 0, 255];
          } else {
            data[y][x] = [0, 0, 255, 255];
          }
        }
      }
      break;

    case 'gradient':
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const v = Math.floor((x / width) * 255);
          data[y][x] = [v, v, v, 255];
        }
      }
      break;

    default:
      // Circle with aliased edges
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) / 3;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist < r) {
            data[y][x] = [255, 100, 100, 255];
          } else {
            data[y][x] = [50, 50, 100, 255];
          }
        }
      }
  }

  return { width, height, data };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const antialiasingTool: UnifiedTool = {
  name: 'anti_aliasing',
  description: 'Anti-aliasing algorithms: FXAA, MSAA, SMAA, supersampling, edge smoothing',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['fxaa', 'msaa', 'smaa', 'supersample', 'edge_smooth', 'detect_edges', 'compare', 'demo', 'info', 'examples'],
        description: 'Anti-aliasing algorithm to apply'
      },
      image: {
        type: 'object',
        description: 'Image data { width, height, data: number[][][] [y][x][rgba] }',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          data: { type: 'array' }
        }
      },
      params: {
        type: 'object',
        description: 'Algorithm parameters',
        properties: {
          threshold: { type: 'number', description: 'Edge detection threshold' },
          subpixelQuality: { type: 'number', description: 'FXAA subpixel quality 0-1' },
          samples: { type: 'number', description: 'MSAA sample count (2,4,8,16)' },
          searchSteps: { type: 'number', description: 'SMAA search steps' },
          factor: { type: 'number', description: 'Supersampling factor' },
          strength: { type: 'number', description: 'Smoothing strength' }
        }
      },
      testPattern: {
        type: 'string',
        enum: ['diagonal', 'checkerboard', 'edges', 'gradient', 'circle'],
        description: 'Test pattern for demo'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeantialiasing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, params, testPattern } = args;

    let result: unknown;

    switch (operation) {
      case 'fxaa': {
        if (!image) throw new Error('Image required');

        const filter = new FXAAFilter(
          params?.threshold ?? 0.0833,
          params?.subpixelQuality ?? 0.75
        );
        const output = filter.apply(image);

        result = {
          operation: 'fxaa',
          parameters: {
            threshold: params?.threshold ?? 0.0833,
            subpixelQuality: params?.subpixelQuality ?? 0.75
          },
          inputSize: { width: image.width, height: image.height },
          outputSize: { width: output.width, height: output.height },
          sampleOutput: output.data.slice(0, 5).map(row => row.slice(0, 5))
        };
        break;
      }

      case 'msaa': {
        if (!image) throw new Error('Image required');

        const filter = new MSAAFilter(params?.samples ?? 4);
        const output = filter.apply(image);

        result = {
          operation: 'msaa',
          samples: params?.samples ?? 4,
          inputSize: { width: image.width, height: image.height },
          outputSize: { width: output.width, height: output.height },
          sampleOutput: output.data.slice(0, 5).map(row => row.slice(0, 5))
        };
        break;
      }

      case 'smaa': {
        if (!image) throw new Error('Image required');

        const filter = new SMAAFilter(
          params?.threshold ?? 0.1,
          params?.searchSteps ?? 16
        );
        const output = filter.apply(image);

        result = {
          operation: 'smaa',
          parameters: {
            threshold: params?.threshold ?? 0.1,
            searchSteps: params?.searchSteps ?? 16
          },
          inputSize: { width: image.width, height: image.height },
          outputSize: { width: output.width, height: output.height },
          sampleOutput: output.data.slice(0, 5).map(row => row.slice(0, 5))
        };
        break;
      }

      case 'supersample': {
        if (!image) throw new Error('Image required');

        const filter = new SupersamplingAA(params?.factor ?? 2);
        const output = filter.apply(image);

        result = {
          operation: 'supersample',
          factor: params?.factor ?? 2,
          inputSize: { width: image.width, height: image.height },
          outputSize: { width: output.width, height: output.height },
          sampleOutput: output.data.slice(0, 5).map(row => row.slice(0, 5))
        };
        break;
      }

      case 'edge_smooth': {
        if (!image) throw new Error('Image required');

        const output = applyEdgeSmoothing(
          image,
          params?.threshold ?? 0.1,
          params?.strength ?? 0.5
        );

        result = {
          operation: 'edge_smooth',
          parameters: {
            threshold: params?.threshold ?? 0.1,
            strength: params?.strength ?? 0.5
          },
          inputSize: { width: image.width, height: image.height },
          outputSize: { width: output.width, height: output.height },
          sampleOutput: output.data.slice(0, 5).map(row => row.slice(0, 5))
        };
        break;
      }

      case 'detect_edges': {
        if (!image) throw new Error('Image required');

        const edges = detectEdges(image, params?.threshold ?? 0.1);

        let edgeCount = 0;
        let totalStrength = 0;

        for (const row of edges) {
          for (const edge of row) {
            if (edge.horizontal || edge.vertical) edgeCount++;
            totalStrength += edge.strength;
          }
        }

        result = {
          operation: 'detect_edges',
          threshold: params?.threshold ?? 0.1,
          imageSize: { width: image.width, height: image.height },
          statistics: {
            edgePixels: edgeCount,
            edgeRatio: (edgeCount / (image.width * image.height)).toFixed(4),
            averageStrength: (totalStrength / (image.width * image.height)).toFixed(4)
          },
          sampleEdges: edges.slice(0, 10).map(row => row.slice(0, 10).map(e => ({
            h: e.horizontal,
            v: e.vertical,
            s: e.strength.toFixed(3)
          })))
        };
        break;
      }

      case 'compare': {
        if (!image) throw new Error('Image required');

        const fxaa = new FXAAFilter();
        const msaa = new MSAAFilter(4);
        const smaa = new SMAAFilter();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _fxaaOut = fxaa.apply(image);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _msaaOut = msaa.apply(image);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _smaaOut = smaa.apply(image);

        result = {
          operation: 'compare',
          imageSize: { width: image.width, height: image.height },
          algorithms: {
            fxaa: {
              description: 'Fast Approximate AA - edge detection + blending',
              complexity: 'O(n)',
              quality: 'Good',
              performance: 'Fast'
            },
            msaa: {
              description: 'Multi-Sample AA - supersampling simulation',
              complexity: 'O(n * samples)',
              quality: 'Very Good',
              performance: 'Moderate'
            },
            smaa: {
              description: 'Subpixel Morphological AA - edge detection + morphological search',
              complexity: 'O(n * searchSteps)',
              quality: 'Excellent',
              performance: 'Moderate'
            }
          }
        };
        break;
      }

      case 'demo': {
        const pattern = testPattern || 'diagonal';
        const testImage = generateTestImage(50, 50, pattern);

        const fxaa = new FXAAFilter();
        const msaa = new MSAAFilter(4);

        const fxaaOut = fxaa.apply(testImage);
        const msaaOut = msaa.apply(testImage);

        result = {
          operation: 'demo',
          testPattern: pattern,
          imageSize: { width: 50, height: 50 },
          algorithms: {
            fxaa: {
              samplePixels: fxaaOut.data.slice(20, 25).map(row => row.slice(20, 25))
            },
            msaa: {
              samplePixels: msaaOut.data.slice(20, 25).map(row => row.slice(20, 25))
            }
          },
          originalSample: testImage.data.slice(20, 25).map(row => row.slice(20, 25))
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'Apply FXAA',
              code: `{
  "operation": "fxaa",
  "image": { "width": 100, "height": 100, "data": [...] },
  "params": { "threshold": 0.0833, "subpixelQuality": 0.75 }
}`
            },
            {
              name: 'Apply MSAA (4x)',
              code: `{
  "operation": "msaa",
  "image": { ... },
  "params": { "samples": 4 }
}`
            },
            {
              name: 'Apply SMAA',
              code: `{
  "operation": "smaa",
  "image": { ... },
  "params": { "threshold": 0.1, "searchSteps": 16 }
}`
            },
            {
              name: 'Compare algorithms',
              code: `{
  "operation": "compare",
  "image": { ... }
}`
            },
            {
              name: 'Demo with test pattern',
              code: `{
  "operation": "demo",
  "testPattern": "diagonal"
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
          tool: 'anti_aliasing',
          description: 'Anti-aliasing algorithms for smoothing jagged edges in images',
          algorithms: {
            fxaa: {
              name: 'Fast Approximate Anti-Aliasing',
              description: 'Shader-based AA using edge detection and blending',
              pros: ['Very fast', 'Simple to implement', 'No VRAM overhead'],
              cons: ['Can blur textures', 'Less accurate']
            },
            msaa: {
              name: 'Multi-Sample Anti-Aliasing',
              description: 'Hardware-level AA using multiple samples per pixel',
              pros: ['High quality', 'Preserves textures'],
              cons: ['Higher memory usage', 'Slower']
            },
            smaa: {
              name: 'Subpixel Morphological Anti-Aliasing',
              description: 'Morphological-based AA with edge search',
              pros: ['Excellent quality', 'Good performance'],
              cons: ['More complex', 'Multiple passes']
            },
            supersampling: {
              name: 'Supersampling Anti-Aliasing',
              description: 'Render at higher resolution and downsample',
              pros: ['Highest quality'],
              cons: ['Very expensive', 'Memory intensive']
            }
          },
          operations: ['fxaa', 'msaa', 'smaa', 'supersample', 'edge_smooth', 'detect_edges', 'compare', 'demo', 'info', 'examples']
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
      content: `Error in anti_aliasing: ${error}`,
      isError: true
    };
  }
}

export function isantialiasingAvailable(): boolean {
  return true;
}
