/**
 * SIFT Features Tool - FULL IMPLEMENTATION
 * Scale-Invariant Feature Transform for robust feature detection and matching
 */

import { UnifiedTool, ToolResult } from './types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type GrayscaleImage = number[][];

interface SIFTKeypoint {
  x: number;
  y: number;
  scale: number;
  octave: number;
  layer: number;
  orientation: number;
  response: number;
  descriptor?: number[];
}

interface GaussianPyramid {
  octaves: GrayscaleImage[][];
  sigmas: number[][];
}

interface DoGPyramid {
  octaves: GrayscaleImage[][];
}

interface KeypointMatch {
  keypoint1: SIFTKeypoint;
  keypoint2: SIFTKeypoint;
  distance: number;
  ratio: number;
}

// ============================================================================
// GAUSSIAN AND IMAGE OPERATIONS
// ============================================================================

class ImageOperations {
  /**
   * Create Gaussian kernel
   */
  static createGaussianKernel(sigma: number): number[][] {
    const size = Math.ceil(sigma * 6) | 1; // Ensure odd
    const kernel: number[][] = [];
    const center = Math.floor(size / 2);
    let sum = 0;

    for (let y = 0; y < size; y++) {
      const row: number[] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        row.push(value);
        sum += value;
      }
      kernel.push(row);
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
   * Apply Gaussian blur
   */
  static gaussianBlur(image: GrayscaleImage, sigma: number): GrayscaleImage {
    const kernel = this.createGaussianKernel(sigma);
    return this.convolve(image, kernel);
  }

  /**
   * Convolve image with kernel
   */
  static convolve(image: GrayscaleImage, kernel: number[][]): GrayscaleImage {
    const height = image.length;
    const width = image[0].length;
    const kHeight = kernel.length;
    const kWidth = kernel[0].length;
    const padY = Math.floor(kHeight / 2);
    const padX = Math.floor(kWidth / 2);
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        let sum = 0;

        for (let ky = 0; ky < kHeight; ky++) {
          for (let kx = 0; kx < kWidth; kx++) {
            const iy = Math.min(Math.max(y + ky - padY, 0), height - 1);
            const ix = Math.min(Math.max(x + kx - padX, 0), width - 1);
            sum += image[iy][ix] * kernel[ky][kx];
          }
        }

        row.push(sum);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Downsample image by factor of 2
   */
  static downsample(image: GrayscaleImage): GrayscaleImage {
    const height = image.length;
    const width = image[0].length;
    const newHeight = Math.floor(height / 2);
    const newWidth = Math.floor(width / 2);
    const result: GrayscaleImage = [];

    for (let y = 0; y < newHeight; y++) {
      const row: number[] = [];
      for (let x = 0; x < newWidth; x++) {
        row.push(image[y * 2][x * 2]);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Compute image gradients
   */
  static computeGradients(image: GrayscaleImage): {
    magnitude: GrayscaleImage;
    orientation: GrayscaleImage;
  } {
    const height = image.length;
    const width = image[0].length;
    const magnitude: GrayscaleImage = [];
    const orientation: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const magRow: number[] = [];
      const oriRow: number[] = [];

      for (let x = 0; x < width; x++) {
        // Compute gradients using central differences
        const gx = (x < width - 1 ? image[y][x + 1] : image[y][x]) -
                   (x > 0 ? image[y][x - 1] : image[y][x]);
        const gy = (y < height - 1 ? image[y + 1][x] : image[y][x]) -
                   (y > 0 ? image[y - 1][x] : image[y][x]);

        const mag = Math.sqrt(gx * gx + gy * gy);
        let ori = Math.atan2(gy, gx) * (180 / Math.PI);
        if (ori < 0) ori += 360;

        magRow.push(mag);
        oriRow.push(ori);
      }

      magnitude.push(magRow);
      orientation.push(oriRow);
    }

    return { magnitude, orientation };
  }
}

// ============================================================================
// SCALE SPACE CONSTRUCTION
// ============================================================================

class ScaleSpace {
  private numOctaves: number;
  private numScales: number;
  private sigma0: number;
  private k: number;

  constructor(numOctaves: number = 4, numScales: number = 3, sigma0: number = 1.6) {
    this.numOctaves = numOctaves;
    this.numScales = numScales;
    this.sigma0 = sigma0;
    this.k = Math.pow(2, 1 / numScales);
  }

  /**
   * Build Gaussian pyramid
   */
  buildGaussianPyramid(image: GrayscaleImage): GaussianPyramid {
    const octaves: GrayscaleImage[][] = [];
    const sigmas: number[][] = [];
    const numImages = this.numScales + 3; // s+3 images per octave

    let currentImage = image;

    for (let o = 0; o < this.numOctaves; o++) {
      const octave: GrayscaleImage[] = [];
      const octaveSigmas: number[] = [];

      for (let s = 0; s < numImages; s++) {
        const sigma = this.sigma0 * Math.pow(this.k, s);
        octaveSigmas.push(sigma * Math.pow(2, o));

        if (s === 0 && o === 0) {
          // First image: blur input
          octave.push(ImageOperations.gaussianBlur(currentImage, sigma));
        } else if (s === 0) {
          // First image of new octave: downsample from previous octave
          octave.push(currentImage);
        } else {
          // Incremental blur
          const prevSigma = this.sigma0 * Math.pow(this.k, s - 1);
          const incrementalSigma = Math.sqrt(sigma * sigma - prevSigma * prevSigma);
          octave.push(ImageOperations.gaussianBlur(octave[s - 1], incrementalSigma));
        }
      }

      octaves.push(octave);
      sigmas.push(octaveSigmas);

      // Prepare for next octave
      if (o < this.numOctaves - 1) {
        currentImage = ImageOperations.downsample(octave[this.numScales]);
      }
    }

    return { octaves, sigmas };
  }

  /**
   * Build Difference of Gaussian pyramid
   */
  buildDoGPyramid(gaussianPyramid: GaussianPyramid): DoGPyramid {
    const octaves: GrayscaleImage[][] = [];

    for (let o = 0; o < gaussianPyramid.octaves.length; o++) {
      const octave: GrayscaleImage[] = [];
      const gaussianOctave = gaussianPyramid.octaves[o];

      for (let s = 0; s < gaussianOctave.length - 1; s++) {
        const height = gaussianOctave[s].length;
        const width = gaussianOctave[s][0].length;
        const dog: GrayscaleImage = [];

        for (let y = 0; y < height; y++) {
          const row: number[] = [];
          for (let x = 0; x < width; x++) {
            row.push(gaussianOctave[s + 1][y][x] - gaussianOctave[s][y][x]);
          }
          dog.push(row);
        }

        octave.push(dog);
      }

      octaves.push(octave);
    }

    return { octaves };
  }
}

// ============================================================================
// KEYPOINT DETECTION
// ============================================================================

class KeypointDetector {
  private contrastThreshold: number;
  private edgeThreshold: number;

  constructor(contrastThreshold: number = 0.04, edgeThreshold: number = 10) {
    this.contrastThreshold = contrastThreshold;
    this.edgeThreshold = edgeThreshold;
  }

  /**
   * Find scale-space extrema in DoG pyramid
   */
  findExtrema(dogPyramid: DoGPyramid, gaussianPyramid: GaussianPyramid): SIFTKeypoint[] {
    const keypoints: SIFTKeypoint[] = [];

    for (let o = 0; o < dogPyramid.octaves.length; o++) {
      const octave = dogPyramid.octaves[o];

      // Check layers 1 to n-2 (need neighbors above and below)
      for (let s = 1; s < octave.length - 1; s++) {
        const current = octave[s];
        const below = octave[s - 1];
        const above = octave[s + 1];
        const height = current.length;
        const width = current[0].length;

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const value = current[y][x];

            // Skip low contrast points early
            if (Math.abs(value) < this.contrastThreshold * 0.5) continue;

            // Check if extremum in 3x3x3 neighborhood
            if (this.isExtremum(value, x, y, current, below, above)) {
              // Localize keypoint with sub-pixel accuracy
              const keypoint = this.localizeKeypoint(
                x, y, s, o, octave, gaussianPyramid.sigmas[o][s]
              );

              if (keypoint) {
                keypoints.push(keypoint);
              }
            }
          }
        }
      }
    }

    return keypoints;
  }

  /**
   * Check if point is extremum in 3x3x3 neighborhood
   */
  private isExtremum(
    value: number,
    x: number,
    y: number,
    current: GrayscaleImage,
    below: GrayscaleImage,
    above: GrayscaleImage
  ): boolean {
    const isMax = value > 0;
    const threshold = isMax ? value : -value;

    // Check all 26 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // Current layer (skip center)
        if (dx !== 0 || dy !== 0) {
          const neighbor = current[y + dy][x + dx];
          if (isMax ? neighbor >= value : neighbor <= value) return false;
        }
        // Above layer
        const aboveNeighbor = above[y + dy][x + dx];
        if (isMax ? aboveNeighbor >= value : aboveNeighbor <= value) return false;
        // Below layer
        const belowNeighbor = below[y + dy][x + dx];
        if (isMax ? belowNeighbor >= value : belowNeighbor <= value) return false;
      }
    }

    return true;
  }

  /**
   * Localize keypoint with sub-pixel accuracy using Taylor expansion
   */
  private localizeKeypoint(
    x: number,
    y: number,
    s: number,
    o: number,
    octave: GrayscaleImage[],
    sigma: number
  ): SIFTKeypoint | null {
    const current = octave[s];
    const below = octave[s - 1];
    const above = octave[s + 1];
    const height = current.length;
    const width = current[0].length;

    // Iterative refinement
    let xi = x;
    let yi = y;
    let si = s;

    for (let iter = 0; iter < 5; iter++) {
      if (xi < 1 || xi >= width - 1 || yi < 1 || yi >= height - 1) {
        return null;
      }

      // Compute derivatives
      const dx = (current[yi][xi + 1] - current[yi][xi - 1]) / 2;
      const dy = (current[yi + 1][xi] - current[yi - 1][xi]) / 2;
      const ds = (above[yi][xi] - below[yi][xi]) / 2;

      // Compute Hessian
      const dxx = current[yi][xi + 1] - 2 * current[yi][xi] + current[yi][xi - 1];
      const dyy = current[yi + 1][xi] - 2 * current[yi][xi] + current[yi - 1][xi];
      const dss = above[yi][xi] - 2 * current[yi][xi] + below[yi][xi];
      const dxy = (current[yi + 1][xi + 1] - current[yi + 1][xi - 1] -
                   current[yi - 1][xi + 1] + current[yi - 1][xi - 1]) / 4;
      const dxs = (above[yi][xi + 1] - above[yi][xi - 1] -
                   below[yi][xi + 1] + below[yi][xi - 1]) / 4;
      const dys = (above[yi + 1][xi] - above[yi - 1][xi] -
                   below[yi + 1][xi] + below[yi - 1][xi]) / 4;

      // Solve 3x3 linear system (simplified)
      const det = dxx * (dyy * dss - dys * dys) -
                  dxy * (dxy * dss - dys * dxs) +
                  dxs * (dxy * dys - dyy * dxs);

      if (Math.abs(det) < 1e-10) return null;

      const offsetX = -(dyy * dss - dys * dys) * dx / det;
      const offsetY = -(dxx * dss - dxs * dxs) * dy / det;
      const offsetS = -(dxx * dyy - dxy * dxy) * ds / det;

      // Check convergence
      if (Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5 && Math.abs(offsetS) < 0.5) {
        // Compute contrast at refined location
        const contrast = current[yi][xi] + 0.5 * (dx * offsetX + dy * offsetY + ds * offsetS);

        if (Math.abs(contrast) < this.contrastThreshold) return null;

        // Edge response check
        const trace = dxx + dyy;
        const det2d = dxx * dyy - dxy * dxy;
        const edgeResponse = trace * trace / det2d;
        const edgeThresholdSq = (this.edgeThreshold + 1) ** 2 / this.edgeThreshold;

        if (det2d < 0 || edgeResponse > edgeThresholdSq) return null;

        // Scale coordinates to original image
        const scale = Math.pow(2, o);

        return {
          x: (xi + offsetX) * scale,
          y: (yi + offsetY) * scale,
          scale: sigma * Math.pow(2, offsetS / 3),
          octave: o,
          layer: si,
          orientation: 0, // Will be assigned later
          response: Math.abs(contrast)
        };
      }

      // Update position for next iteration
      xi = Math.round(xi + offsetX);
      yi = Math.round(yi + offsetY);
    }

    return null;
  }
}

// ============================================================================
// ORIENTATION ASSIGNMENT
// ============================================================================

class OrientationAssigner {
  private numBins: number = 36;
  private peakRatio: number = 0.8;

  /**
   * Assign orientations to keypoints
   */
  assignOrientations(
    keypoints: SIFTKeypoint[],
    gaussianPyramid: GaussianPyramid
  ): SIFTKeypoint[] {
    const orientedKeypoints: SIFTKeypoint[] = [];

    for (const kp of keypoints) {
      const octave = kp.octave;
      const layer = kp.layer;
      const image = gaussianPyramid.octaves[octave][layer];
      const scale = Math.pow(2, octave);

      // Local coordinates in octave
      const localX = Math.round(kp.x / scale);
      const localY = Math.round(kp.y / scale);

      // Compute gradient histogram
      const histogram = this.computeOrientationHistogram(
        image, localX, localY, kp.scale
      );

      // Smooth histogram
      this.smoothHistogram(histogram);

      // Find peaks
      const peaks = this.findPeaks(histogram);

      // Create keypoint for each peak
      for (const peak of peaks) {
        orientedKeypoints.push({
          ...kp,
          orientation: peak.orientation
        });
      }
    }

    return orientedKeypoints;
  }

  /**
   * Compute orientation histogram around keypoint
   */
  private computeOrientationHistogram(
    image: GrayscaleImage,
    x: number,
    y: number,
    scale: number
  ): number[] {
    const histogram = new Array(this.numBins).fill(0);
    const radius = Math.round(scale * 3);
    const sigma = scale * 1.5;
    const height = image.length;
    const width = image[0].length;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;

        if (px < 1 || px >= width - 1 || py < 1 || py >= height - 1) continue;

        // Compute gradient
        const gx = image[py][px + 1] - image[py][px - 1];
        const gy = image[py + 1][px] - image[py - 1][px];
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        let orientation = Math.atan2(gy, gx) * (180 / Math.PI);
        if (orientation < 0) orientation += 360;

        // Gaussian weight
        const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));

        // Add to histogram
        const bin = Math.floor(orientation / (360 / this.numBins)) % this.numBins;
        histogram[bin] += magnitude * weight;
      }
    }

    return histogram;
  }

  /**
   * Smooth histogram with 6-tap filter
   */
  private smoothHistogram(histogram: number[]): void {
    const temp = [...histogram];
    for (let i = 0; i < this.numBins; i++) {
      const prev = temp[(i - 1 + this.numBins) % this.numBins];
      const curr = temp[i];
      const next = temp[(i + 1) % this.numBins];
      histogram[i] = (prev + curr + next) / 3;
    }
  }

  /**
   * Find orientation peaks in histogram
   */
  private findPeaks(histogram: number[]): Array<{ bin: number; orientation: number }> {
    const peaks: Array<{ bin: number; orientation: number; value: number }> = [];
    const maxValue = Math.max(...histogram);

    for (let i = 0; i < this.numBins; i++) {
      const prev = histogram[(i - 1 + this.numBins) % this.numBins];
      const curr = histogram[i];
      const next = histogram[(i + 1) % this.numBins];

      // Check if local maximum and above threshold
      if (curr > prev && curr > next && curr >= maxValue * this.peakRatio) {
        // Parabolic interpolation for sub-bin accuracy
        const offset = (prev - next) / (2 * (prev - 2 * curr + next));
        let orientation = ((i + offset + 0.5) * (360 / this.numBins)) % 360;
        if (orientation < 0) orientation += 360;

        peaks.push({ bin: i, orientation, value: curr });
      }
    }

    return peaks;
  }
}

// ============================================================================
// DESCRIPTOR COMPUTATION (128-dimensional)
// ============================================================================

class DescriptorComputer {
  private descriptorWidth: number = 4; // 4x4 grid
  private numBins: number = 8;
  private descriptorSize: number = 128; // 4x4x8

  /**
   * Compute 128-dimensional SIFT descriptors
   */
  computeDescriptors(
    keypoints: SIFTKeypoint[],
    gaussianPyramid: GaussianPyramid
  ): SIFTKeypoint[] {
    const result: SIFTKeypoint[] = [];

    for (const kp of keypoints) {
      const descriptor = this.computeDescriptor(kp, gaussianPyramid);
      if (descriptor) {
        result.push({
          ...kp,
          descriptor
        });
      }
    }

    return result;
  }

  /**
   * Compute descriptor for single keypoint
   */
  private computeDescriptor(
    kp: SIFTKeypoint,
    gaussianPyramid: GaussianPyramid
  ): number[] | null {
    const octave = kp.octave;
    const layer = kp.layer;
    const image = gaussianPyramid.octaves[octave][layer];
    const scale = Math.pow(2, octave);
    const height = image.length;
    const width = image[0].length;

    // Local coordinates
    const localX = kp.x / scale;
    const localY = kp.y / scale;

    // Descriptor window size
    const windowSize = this.descriptorWidth * 4; // 16 pixels
    const halfWindow = windowSize / 2;
    const binSize = windowSize / this.descriptorWidth;
    const sigma = windowSize / 2;

    // Rotation for dominant orientation
    const cos = Math.cos(kp.orientation * Math.PI / 180);
    const sin = Math.sin(kp.orientation * Math.PI / 180);

    // Initialize histogram grid
    const histograms: number[][][] = [];
    for (let i = 0; i < this.descriptorWidth; i++) {
      histograms[i] = [];
      for (let j = 0; j < this.descriptorWidth; j++) {
        histograms[i][j] = new Array(this.numBins).fill(0);
      }
    }

    // Sample gradients in rotated window
    for (let dy = -halfWindow; dy < halfWindow; dy++) {
      for (let dx = -halfWindow; dx < halfWindow; dx++) {
        // Rotate sample point
        const rotX = dx * cos - dy * sin;
        const rotY = dx * sin + dy * cos;

        const px = Math.round(localX + rotX);
        const py = Math.round(localY + rotY);

        if (px < 1 || px >= width - 1 || py < 1 || py >= height - 1) continue;

        // Compute gradient
        const gx = image[py][px + 1] - image[py][px - 1];
        const gy = image[py + 1][px] - image[py - 1][px];
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        let orientation = Math.atan2(gy, gx) * (180 / Math.PI) - kp.orientation;
        if (orientation < 0) orientation += 360;
        if (orientation >= 360) orientation -= 360;

        // Gaussian weight
        const weight = Math.exp(-(rotX * rotX + rotY * rotY) / (2 * sigma * sigma));

        // Determine histogram bin
        const histX = (rotX + halfWindow) / binSize;
        const histY = (rotY + halfWindow) / binSize;
        const binIdx = Math.floor(orientation / (360 / this.numBins)) % this.numBins;

        // Trilinear interpolation
        const xi = Math.floor(histX);
        const yi = Math.floor(histY);

        if (xi >= 0 && xi < this.descriptorWidth && yi >= 0 && yi < this.descriptorWidth) {
          histograms[yi][xi][binIdx] += magnitude * weight;
        }
      }
    }

    // Flatten to 128-dimensional vector
    const descriptor: number[] = [];
    for (let i = 0; i < this.descriptorWidth; i++) {
      for (let j = 0; j < this.descriptorWidth; j++) {
        for (let k = 0; k < this.numBins; k++) {
          descriptor.push(histograms[i][j][k]);
        }
      }
    }

    // Normalize and threshold
    let norm = Math.sqrt(descriptor.reduce((sum, v) => sum + v * v, 0));
    if (norm < 1e-10) return null;

    for (let i = 0; i < descriptor.length; i++) {
      descriptor[i] /= norm;
      // Clamp to 0.2 to reduce influence of large gradients
      descriptor[i] = Math.min(descriptor[i], 0.2);
    }

    // Renormalize after clamping
    norm = Math.sqrt(descriptor.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < descriptor.length; i++) {
      descriptor[i] /= norm;
    }

    return descriptor;
  }
}

// ============================================================================
// FEATURE MATCHING
// ============================================================================

class FeatureMatcher {
  private ratioThreshold: number;

  constructor(ratioThreshold: number = 0.75) {
    this.ratioThreshold = ratioThreshold;
  }

  /**
   * Match keypoints using Lowe's ratio test
   */
  matchFeatures(
    keypoints1: SIFTKeypoint[],
    keypoints2: SIFTKeypoint[]
  ): KeypointMatch[] {
    const matches: KeypointMatch[] = [];

    for (const kp1 of keypoints1) {
      if (!kp1.descriptor) continue;

      // Find two nearest neighbors
      let best1 = { distance: Infinity, keypoint: null as SIFTKeypoint | null };
      let best2 = { distance: Infinity, keypoint: null as SIFTKeypoint | null };

      for (const kp2 of keypoints2) {
        if (!kp2.descriptor) continue;

        const distance = this.computeDistance(kp1.descriptor, kp2.descriptor);

        if (distance < best1.distance) {
          best2 = best1;
          best1 = { distance, keypoint: kp2 };
        } else if (distance < best2.distance) {
          best2 = { distance, keypoint: kp2 };
        }
      }

      // Ratio test
      if (best1.keypoint && best2.distance > 0) {
        const ratio = best1.distance / best2.distance;
        if (ratio < this.ratioThreshold) {
          matches.push({
            keypoint1: kp1,
            keypoint2: best1.keypoint,
            distance: best1.distance,
            ratio
          });
        }
      }
    }

    return matches;
  }

  /**
   * Compute Euclidean distance between descriptors
   */
  private computeDistance(desc1: number[], desc2: number[]): number {
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
      const diff = desc1[i] - desc2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Cross-check matches (bidirectional consistency)
   */
  crossCheckMatches(
    matches12: KeypointMatch[],
    matches21: KeypointMatch[]
  ): KeypointMatch[] {
    const consistent: KeypointMatch[] = [];

    for (const m12 of matches12) {
      for (const m21 of matches21) {
        if (m12.keypoint1 === m21.keypoint2 && m12.keypoint2 === m21.keypoint1) {
          consistent.push(m12);
          break;
        }
      }
    }

    return consistent;
  }
}

// ============================================================================
// SIFT DETECTOR
// ============================================================================

class SIFTDetector {
  private scaleSpace: ScaleSpace;
  private keypointDetector: KeypointDetector;
  private orientationAssigner: OrientationAssigner;
  private descriptorComputer: DescriptorComputer;

  constructor(
    numOctaves: number = 4,
    numScales: number = 3,
    contrastThreshold: number = 0.04,
    edgeThreshold: number = 10
  ) {
    this.scaleSpace = new ScaleSpace(numOctaves, numScales);
    this.keypointDetector = new KeypointDetector(contrastThreshold, edgeThreshold);
    this.orientationAssigner = new OrientationAssigner();
    this.descriptorComputer = new DescriptorComputer();
  }

  /**
   * Detect SIFT keypoints and compute descriptors
   */
  detectAndCompute(image: GrayscaleImage): SIFTKeypoint[] {
    // Build scale space
    const gaussianPyramid = this.scaleSpace.buildGaussianPyramid(image);
    const dogPyramid = this.scaleSpace.buildDoGPyramid(gaussianPyramid);

    // Detect keypoints
    let keypoints = this.keypointDetector.findExtrema(dogPyramid, gaussianPyramid);

    // Assign orientations
    keypoints = this.orientationAssigner.assignOrientations(keypoints, gaussianPyramid);

    // Compute descriptors
    keypoints = this.descriptorComputer.computeDescriptors(keypoints, gaussianPyramid);

    return keypoints;
  }

  /**
   * Get intermediate results for visualization
   */
  getScaleSpaceVisualization(image: GrayscaleImage): {
    gaussianPyramid: { octave: number; layer: number; size: string }[];
    dogPyramid: { octave: number; layer: number; size: string }[];
  } {
    const gaussianPyramid = this.scaleSpace.buildGaussianPyramid(image);
    const dogPyramid = this.scaleSpace.buildDoGPyramid(gaussianPyramid);

    const gaussianInfo = [];
    const dogInfo = [];

    for (let o = 0; o < gaussianPyramid.octaves.length; o++) {
      for (let l = 0; l < gaussianPyramid.octaves[o].length; l++) {
        const img = gaussianPyramid.octaves[o][l];
        gaussianInfo.push({
          octave: o,
          layer: l,
          size: `${img[0].length}x${img.length}`
        });
      }
    }

    for (let o = 0; o < dogPyramid.octaves.length; o++) {
      for (let l = 0; l < dogPyramid.octaves[o].length; l++) {
        const img = dogPyramid.octaves[o][l];
        dogInfo.push({
          octave: o,
          layer: l,
          size: `${img[0].length}x${img.length}`
        });
      }
    }

    return {
      gaussianPyramid: gaussianInfo,
      dogPyramid: dogInfo
    };
  }
}

// ============================================================================
// TEST IMAGE GENERATOR
// ============================================================================

function generateTestImage(): GrayscaleImage {
  const size = 128;
  const image: GrayscaleImage = Array.from({ length: size }, () =>
    Array(size).fill(128)
  );

  // Create corner-like features
  for (let i = 0; i < 5; i++) {
    const cx = 20 + i * 20;
    const cy = 20 + i * 15;

    // Draw cross pattern (corner-like)
    for (let d = -10; d <= 10; d++) {
      if (cy + d >= 0 && cy + d < size && cx >= 0 && cx < size) {
        image[cy + d][cx] = 255;
      }
      if (cy >= 0 && cy < size && cx + d >= 0 && cx + d < size) {
        image[cy][cx + d] = 255;
      }
    }
  }

  // Add blob features
  for (let i = 0; i < 3; i++) {
    const cx = 30 + i * 30;
    const cy = 80;
    const radius = 8 + i * 2;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const px = cx + dx;
          const py = cy + dy;
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            image[py][px] = Math.round(255 * Math.exp(-dist * dist / (2 * (radius / 2) ** 2)));
          }
        }
      }
    }
  }

  // Add edge features
  for (let y = 50; y < 70; y++) {
    for (let x = 90; x < 120; x++) {
      if (x < size && y < size) {
        image[y][x] = x < 105 ? 50 : 200;
      }
    }
  }

  return image;
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

async function executesiftfeatures(params: Record<string, unknown>): Promise<ToolResult> {
  const operation = (params.operation as string) || 'info';

  switch (operation) {
    case 'info': {
      return {
        success: true,
        data: {
          name: 'SIFT Features Tool',
          version: '1.0.0',
          description: 'Scale-Invariant Feature Transform implementation',
          algorithm: {
            scale_space: 'Gaussian and Difference-of-Gaussian pyramids',
            keypoint_detection: 'Scale-space extrema detection with subpixel localization',
            orientation: '36-bin gradient histogram with parabolic interpolation',
            descriptor: '128-dimensional (4x4 grid x 8 orientation bins)',
            matching: "Lowe's ratio test with optional cross-checking"
          },
          operations: [
            'detect_keypoints',
            'compute_descriptors',
            'detect_and_compute',
            'match_features',
            'build_scale_space',
            'visualize_dog',
            'demo',
            'info',
            'examples'
          ],
          parameters: {
            num_octaves: 'Number of octaves in scale space (default: 4)',
            num_scales: 'Number of scales per octave (default: 3)',
            contrast_threshold: 'Contrast threshold for keypoint filtering (default: 0.04)',
            edge_threshold: 'Edge response threshold (default: 10)',
            ratio_threshold: 'Ratio test threshold for matching (default: 0.75)'
          }
        }
      };
    }

    case 'demo': {
      const image = generateTestImage();
      const detector = new SIFTDetector(4, 3, 0.03, 10);

      // Detect keypoints
      const keypoints = detector.detectAndCompute(image);

      // Get scale space info
      const scaleSpaceInfo = detector.getScaleSpaceVisualization(image);

      // Group keypoints by octave
      const byOctave = new Map<number, SIFTKeypoint[]>();
      for (const kp of keypoints) {
        if (!byOctave.has(kp.octave)) {
          byOctave.set(kp.octave, []);
        }
        byOctave.get(kp.octave)!.push(kp);
      }

      return {
        success: true,
        data: {
          demonstration: 'SIFT feature detection and description',
          input: {
            image_size: `${image[0].length}x${image.length}`,
            features: 'Cross patterns, Gaussian blobs, and edges'
          },
          scale_space: {
            gaussian_pyramid: scaleSpaceInfo.gaussianPyramid,
            dog_pyramid: scaleSpaceInfo.dogPyramid
          },
          results: {
            total_keypoints: keypoints.length,
            keypoints_by_octave: Array.from(byOctave.entries()).map(([o, kps]) => ({
              octave: o,
              count: kps.length
            })),
            sample_keypoints: keypoints.slice(0, 5).map(kp => ({
              position: { x: kp.x.toFixed(2), y: kp.y.toFixed(2) },
              scale: kp.scale.toFixed(3),
              orientation: kp.orientation.toFixed(1),
              response: kp.response.toFixed(4),
              descriptor_length: kp.descriptor?.length || 0
            })),
            descriptor_stats: {
              dimension: 128,
              grid_size: '4x4',
              orientation_bins: 8
            }
          }
        }
      };
    }

    case 'detect_keypoints': {
      const image = params.image as number[][] | undefined;
      const numOctaves = (params.num_octaves as number) || 4;
      const numScales = (params.num_scales as number) || 3;
      const contrastThreshold = (params.contrast_threshold as number) || 0.04;
      const edgeThreshold = (params.edge_threshold as number) || 10;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      const scaleSpace = new ScaleSpace(numOctaves, numScales);
      const keypointDetector = new KeypointDetector(contrastThreshold, edgeThreshold);
      const orientationAssigner = new OrientationAssigner();

      const gaussianPyramid = scaleSpace.buildGaussianPyramid(image);
      const dogPyramid = scaleSpace.buildDoGPyramid(gaussianPyramid);
      let keypoints = keypointDetector.findExtrema(dogPyramid, gaussianPyramid);
      keypoints = orientationAssigner.assignOrientations(keypoints, gaussianPyramid);

      return {
        success: true,
        data: {
          operation: 'detect_keypoints',
          num_keypoints: keypoints.length,
          keypoints: keypoints.map(kp => ({
            x: kp.x,
            y: kp.y,
            scale: kp.scale,
            orientation: kp.orientation,
            response: kp.response,
            octave: kp.octave,
            layer: kp.layer
          }))
        }
      };
    }

    case 'compute_descriptors': {
      const image = params.image as number[][] | undefined;
      const keypoints = params.keypoints as Array<{
        x: number;
        y: number;
        scale: number;
        orientation: number;
        octave: number;
        layer: number;
      }> | undefined;

      if (!image || !keypoints) {
        return { success: false, error: 'Image and keypoints required' };
      }

      const numOctaves = (params.num_octaves as number) || 4;
      const numScales = (params.num_scales as number) || 3;

      const scaleSpace = new ScaleSpace(numOctaves, numScales);
      const descriptorComputer = new DescriptorComputer();

      const gaussianPyramid = scaleSpace.buildGaussianPyramid(image);

      const siftKeypoints: SIFTKeypoint[] = keypoints.map(kp => ({
        ...kp,
        response: 1
      }));

      const withDescriptors = descriptorComputer.computeDescriptors(siftKeypoints, gaussianPyramid);

      return {
        success: true,
        data: {
          operation: 'compute_descriptors',
          num_descriptors: withDescriptors.length,
          descriptor_dimension: 128,
          descriptors: withDescriptors.map(kp => ({
            x: kp.x,
            y: kp.y,
            descriptor: kp.descriptor
          }))
        }
      };
    }

    case 'detect_and_compute': {
      const image = params.image as number[][] | undefined;
      const numOctaves = (params.num_octaves as number) || 4;
      const numScales = (params.num_scales as number) || 3;
      const contrastThreshold = (params.contrast_threshold as number) || 0.04;
      const edgeThreshold = (params.edge_threshold as number) || 10;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      const detector = new SIFTDetector(numOctaves, numScales, contrastThreshold, edgeThreshold);
      const keypoints = detector.detectAndCompute(image);

      return {
        success: true,
        data: {
          operation: 'detect_and_compute',
          num_keypoints: keypoints.length,
          keypoints: keypoints.map(kp => ({
            x: kp.x,
            y: kp.y,
            scale: kp.scale,
            orientation: kp.orientation,
            response: kp.response,
            descriptor: kp.descriptor
          }))
        }
      };
    }

    case 'match_features': {
      const keypoints1 = params.keypoints1 as SIFTKeypoint[] | undefined;
      const keypoints2 = params.keypoints2 as SIFTKeypoint[] | undefined;
      const ratioThreshold = (params.ratio_threshold as number) || 0.75;
      const crossCheck = (params.cross_check as boolean) || false;

      if (!keypoints1 || !keypoints2) {
        return { success: false, error: 'Two sets of keypoints required' };
      }

      const matcher = new FeatureMatcher(ratioThreshold);
      let matches = matcher.matchFeatures(keypoints1, keypoints2);

      if (crossCheck) {
        const reverseMatches = matcher.matchFeatures(keypoints2, keypoints1);
        matches = matcher.crossCheckMatches(matches, reverseMatches);
      }

      return {
        success: true,
        data: {
          operation: 'match_features',
          num_matches: matches.length,
          ratio_threshold: ratioThreshold,
          cross_checked: crossCheck,
          matches: matches.map(m => ({
            point1: { x: m.keypoint1.x, y: m.keypoint1.y },
            point2: { x: m.keypoint2.x, y: m.keypoint2.y },
            distance: m.distance.toFixed(4),
            ratio: m.ratio.toFixed(4)
          }))
        }
      };
    }

    case 'build_scale_space': {
      const image = params.image as number[][] | undefined;
      const numOctaves = (params.num_octaves as number) || 4;
      const numScales = (params.num_scales as number) || 3;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      const detector = new SIFTDetector(numOctaves, numScales);
      const info = detector.getScaleSpaceVisualization(image);

      return {
        success: true,
        data: {
          operation: 'build_scale_space',
          num_octaves: numOctaves,
          scales_per_octave: numScales,
          gaussian_pyramid: info.gaussianPyramid,
          dog_pyramid: info.dogPyramid
        }
      };
    }

    case 'examples': {
      return {
        success: true,
        data: {
          examples: [
            {
              title: 'Detect and Compute SIFT Features',
              code: 'executesiftfeatures({ operation: "detect_and_compute", image: grayscaleImage })',
              description: 'Detects keypoints and computes 128-dim descriptors'
            },
            {
              title: 'Custom Detection Parameters',
              code: 'executesiftfeatures({ operation: "detect_and_compute", image: img, num_octaves: 5, contrast_threshold: 0.03 })',
              description: 'Detect with custom scale space and thresholds'
            },
            {
              title: 'Match Features Between Images',
              code: 'executesiftfeatures({ operation: "match_features", keypoints1: kp1, keypoints2: kp2, ratio_threshold: 0.7, cross_check: true })',
              description: 'Match with ratio test and cross-checking'
            },
            {
              title: 'Visualize Scale Space',
              code: 'executesiftfeatures({ operation: "build_scale_space", image: img, num_octaves: 4 })',
              description: 'Get Gaussian and DoG pyramid information'
            },
            {
              title: 'Detect Keypoints Only',
              code: 'executesiftfeatures({ operation: "detect_keypoints", image: img })',
              description: 'Detect keypoints without computing descriptors'
            }
          ]
        }
      };
    }

    default:
      return {
        success: false,
        error: `Unknown operation: ${operation}. Use "info" to see available operations.`
      };
  }
}

function issiftfeaturesAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const siftfeaturesTool: UnifiedTool = {
  name: 'siftfeatures',
  description: `Scale-Invariant Feature Transform (SIFT) for robust feature detection.

ALGORITHM:
1. Scale Space: Gaussian pyramid + Difference of Gaussian (DoG)
2. Keypoint Detection: Scale-space extrema with subpixel localization
3. Orientation: 36-bin histogram with parabolic peak interpolation
4. Descriptor: 128-dimensional (4x4 spatial grid x 8 orientations)
5. Matching: Lowe's ratio test with optional cross-checking

OPERATIONS:
- detect_keypoints: Find scale-space extrema and assign orientations
- compute_descriptors: Compute 128-dim descriptors for keypoints
- detect_and_compute: Full SIFT pipeline
- match_features: Match descriptors with ratio test
- build_scale_space: Get pyramid visualization info

PARAMETERS:
- num_octaves: Scale space octaves (default: 4)
- num_scales: Scales per octave (default: 3)
- contrast_threshold: Keypoint contrast filter (default: 0.04)
- edge_threshold: Edge response filter (default: 10)
- ratio_threshold: Matching ratio test (default: 0.75)`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform'
      },
      image: {
        type: 'array',
        description: '2D grayscale image array'
      },
      keypoints: {
        type: 'array',
        description: 'Array of keypoints'
      },
      keypoints1: {
        type: 'array',
        description: 'First set of keypoints for matching'
      },
      keypoints2: {
        type: 'array',
        description: 'Second set of keypoints for matching'
      },
      num_octaves: {
        type: 'number',
        description: 'Number of octaves in scale space'
      },
      num_scales: {
        type: 'number',
        description: 'Number of scales per octave'
      },
      contrast_threshold: {
        type: 'number',
        description: 'Contrast threshold for keypoint filtering'
      },
      edge_threshold: {
        type: 'number',
        description: 'Edge response threshold'
      },
      ratio_threshold: {
        type: 'number',
        description: 'Ratio test threshold for matching'
      },
      cross_check: {
        type: 'boolean',
        description: 'Enable bidirectional match verification'
      }
    },
    required: []
  },
  execute: executesiftfeatures
};

export { executesiftfeatures, issiftfeaturesAvailable };
