/**
 * Morphological Operations Tool - FULL IMPLEMENTATION
 * Provides comprehensive morphological image processing operations
 */

import { UnifiedTool, ToolResult } from './types';

// ============================================================================
// IMAGE AND STRUCTURING ELEMENT TYPES
// ============================================================================

type BinaryImage = number[][];
type GrayscaleImage = number[][];

interface StructuringElement {
  data: number[][];
  originX: number;
  originY: number;
}

interface ConnectedComponent {
  label: number;
  pixels: Array<{ x: number; y: number }>;
  area: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  centroid: { x: number; y: number };
}

// ============================================================================
// STRUCTURING ELEMENT GENERATORS
// ============================================================================

class StructuringElementGenerator {
  static rectangle(width: number, height: number): StructuringElement {
    const data: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(1);
      }
      data.push(row);
    }
    return {
      data,
      originX: Math.floor(width / 2),
      originY: Math.floor(height / 2)
    };
  }

  static cross(size: number): StructuringElement {
    const data: number[][] = [];
    for (let y = 0; y < size; y++) {
      const row: number[] = [];
      for (let x = 0; x < size; x++) {
        const center = Math.floor(size / 2);
        row.push(x === center || y === center ? 1 : 0);
      }
      data.push(row);
    }
    return {
      data,
      originX: Math.floor(size / 2),
      originY: Math.floor(size / 2)
    };
  }

  static ellipse(width: number, height: number): StructuringElement {
    const data: number[][] = [];
    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        row.push(dx * dx + dy * dy <= 1 ? 1 : 0);
      }
      data.push(row);
    }
    return {
      data,
      originX: Math.floor(width / 2),
      originY: Math.floor(height / 2)
    };
  }

  static diamond(size: number): StructuringElement {
    const data: number[][] = [];
    const center = Math.floor(size / 2);

    for (let y = 0; y < size; y++) {
      const row: number[] = [];
      for (let x = 0; x < size; x++) {
        const dist = Math.abs(x - center) + Math.abs(y - center);
        row.push(dist <= center ? 1 : 0);
      }
      data.push(row);
    }
    return {
      data,
      originX: center,
      originY: center
    };
  }

  static disk(radius: number): StructuringElement {
    const size = radius * 2 + 1;
    const data: number[][] = [];

    for (let y = 0; y < size; y++) {
      const row: number[] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - radius;
        const dy = y - radius;
        row.push(dx * dx + dy * dy <= radius * radius ? 1 : 0);
      }
      data.push(row);
    }
    return {
      data,
      originX: radius,
      originY: radius
    };
  }
}

// ============================================================================
// BASIC MORPHOLOGICAL OPERATIONS
// ============================================================================

class MorphologicalOps {
  /**
   * Erosion - shrinks foreground regions
   * Minimum filter within structuring element
   */
  static erode(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const height = image.length;
    const width = image[0].length;
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        let minVal = 255;

        // Apply structuring element
        for (let sy = 0; sy < se.data.length; sy++) {
          for (let sx = 0; sx < se.data[0].length; sx++) {
            if (se.data[sy][sx] === 1) {
              const ix = x + sx - se.originX;
              const iy = y + sy - se.originY;

              if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
                minVal = Math.min(minVal, image[iy][ix]);
              } else {
                // Treat out-of-bounds as 0 (background)
                minVal = 0;
              }
            }
          }
        }

        row.push(minVal);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Dilation - expands foreground regions
   * Maximum filter within structuring element
   */
  static dilate(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const height = image.length;
    const width = image[0].length;
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        let maxVal = 0;

        // Apply structuring element (reflected)
        for (let sy = 0; sy < se.data.length; sy++) {
          for (let sx = 0; sx < se.data[0].length; sx++) {
            if (se.data[sy][sx] === 1) {
              const ix = x - sx + se.originX;
              const iy = y - sy + se.originY;

              if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
                maxVal = Math.max(maxVal, image[iy][ix]);
              }
            }
          }
        }

        row.push(maxVal);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Opening - erosion followed by dilation
   * Removes small bright spots (noise) and thin protrusions
   */
  static opening(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const eroded = this.erode(image, se);
    return this.dilate(eroded, se);
  }

  /**
   * Closing - dilation followed by erosion
   * Fills small dark holes and narrow gaps
   */
  static closing(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const dilated = this.dilate(image, se);
    return this.erode(dilated, se);
  }

  /**
   * Morphological gradient - difference between dilation and erosion
   * Highlights boundaries/edges
   */
  static gradient(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const dilated = this.dilate(image, se);
    const eroded = this.erode(image, se);
    const height = image.length;
    const width = image[0].length;
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(dilated[y][x] - eroded[y][x]);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Internal gradient - difference between original and erosion
   */
  static internalGradient(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const eroded = this.erode(image, se);
    const height = image.length;
    const width = image[0].length;
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(image[y][x] - eroded[y][x]);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * External gradient - difference between dilation and original
   */
  static externalGradient(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const dilated = this.dilate(image, se);
    const height = image.length;
    const width = image[0].length;
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(dilated[y][x] - image[y][x]);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Top-hat transform - difference between original and opening
   * Extracts bright features smaller than SE
   */
  static topHat(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const opened = this.opening(image, se);
    const height = image.length;
    const width = image[0].length;
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(Math.max(0, image[y][x] - opened[y][x]));
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Black-hat transform - difference between closing and original
   * Extracts dark features smaller than SE
   */
  static blackHat(image: GrayscaleImage, se: StructuringElement): GrayscaleImage {
    const closed = this.closing(image, se);
    const height = image.length;
    const width = image[0].length;
    const result: GrayscaleImage = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(Math.max(0, closed[y][x] - image[y][x]));
      }
      result.push(row);
    }

    return result;
  }
}

// ============================================================================
// SKELETONIZATION (MORPHOLOGICAL THINNING)
// ============================================================================

class Skeletonization {
  /**
   * Zhang-Suen thinning algorithm
   * Produces 8-connected skeleton
   */
  static zhangSuen(image: BinaryImage): BinaryImage {
    const height = image.length;
    const width = image[0].length;

    // Create working copy
    const current: BinaryImage = image.map(row => [...row]);

    // Neighbors in clockwise order starting from top
    const neighbors = [
      [-1, 0],  // P2 - top
      [-1, 1],  // P3 - top right
      [0, 1],   // P4 - right
      [1, 1],   // P5 - bottom right
      [1, 0],   // P6 - bottom
      [1, -1],  // P7 - bottom left
      [0, -1],  // P8 - left
      [-1, -1]  // P9 - top left
    ];

    const getNeighbors = (img: BinaryImage, y: number, x: number): number[] => {
      return neighbors.map(([dy, dx]) => {
        const ny = y + dy;
        const nx = x + dx;
        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
          return img[ny][nx] > 0 ? 1 : 0;
        }
        return 0;
      });
    };

    // Count non-zero neighbors
    const countNonZero = (n: number[]): number => {
      return n.reduce((sum, v) => sum + v, 0);
    };

    // Count 0 to 1 transitions in clockwise order
    const countTransitions = (n: number[]): number => {
      let count = 0;
      for (let i = 0; i < 8; i++) {
        if (n[i] === 0 && n[(i + 1) % 8] === 1) {
          count++;
        }
      }
      return count;
    };

    let changed = true;
    let iteration = 0;
    const maxIterations = Math.max(width, height);

    while (changed && iteration < maxIterations) {
      iteration++;
      changed = false;

      // Step 1
      const toRemove1: Array<[number, number]> = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (current[y][x] === 0) continue;

          const n = getNeighbors(current, y, x);
          const B = countNonZero(n);
          const A = countTransitions(n);

          // Conditions for step 1
          if (B >= 2 && B <= 6 &&
              A === 1 &&
              n[0] * n[2] * n[4] === 0 &&  // P2 * P4 * P6 = 0
              n[2] * n[4] * n[6] === 0) {  // P4 * P6 * P8 = 0
            toRemove1.push([y, x]);
          }
        }
      }

      for (const [y, x] of toRemove1) {
        current[y][x] = 0;
        changed = true;
      }

      // Step 2
      const toRemove2: Array<[number, number]> = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (current[y][x] === 0) continue;

          const n = getNeighbors(current, y, x);
          const B = countNonZero(n);
          const A = countTransitions(n);

          // Conditions for step 2
          if (B >= 2 && B <= 6 &&
              A === 1 &&
              n[0] * n[2] * n[6] === 0 &&  // P2 * P4 * P8 = 0
              n[0] * n[4] * n[6] === 0) {  // P2 * P6 * P8 = 0
            toRemove2.push([y, x]);
          }
        }
      }

      for (const [y, x] of toRemove2) {
        current[y][x] = 0;
        changed = true;
      }
    }

    return current;
  }

  /**
   * Morphological skeleton via opening
   * S(X) = Union of (X eroded n times) - opening(X eroded n times)
   */
  static morphologicalSkeleton(image: BinaryImage, se: StructuringElement): BinaryImage {
    const height = image.length;
    const width = image[0].length;
    const skeleton: BinaryImage = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    let eroded = image.map(row => [...row]);
    let iteration = 0;
    const maxIterations = Math.max(width, height) / 2;

    while (iteration < maxIterations) {
      // Check if eroded image is all zeros
      let hasContent = false;
      for (let y = 0; y < height && !hasContent; y++) {
        for (let x = 0; x < width && !hasContent; x++) {
          if (eroded[y][x] > 0) hasContent = true;
        }
      }
      if (!hasContent) break;

      // Compute skeleton subset: eroded - opening(eroded)
      const opened = MorphologicalOps.opening(eroded, se);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (eroded[y][x] > 0 && opened[y][x] === 0) {
            skeleton[y][x] = 255;
          }
        }
      }

      // Erode for next iteration
      eroded = MorphologicalOps.erode(eroded, se);
      iteration++;
    }

    return skeleton;
  }

  /**
   * Medial axis transform using distance transform
   */
  static medialAxis(image: BinaryImage): { skeleton: BinaryImage; distances: GrayscaleImage } {
    const height = image.length;
    const width = image[0].length;

    // Compute distance transform
    const dist: GrayscaleImage = this.distanceTransform(image);

    // Find ridge points (local maxima in distance)
    const skeleton: BinaryImage = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (dist[y][x] === 0) continue;

        // Check if local maximum in 8-neighborhood
        const current = dist[y][x];
        let isMax = true;

        for (let dy = -1; dy <= 1 && isMax; dy++) {
          for (let dx = -1; dx <= 1 && isMax; dx++) {
            if (dy === 0 && dx === 0) continue;
            if (dist[y + dy][x + dx] > current) {
              isMax = false;
            }
          }
        }

        if (isMax && current > 1) {
          skeleton[y][x] = 255;
        }
      }
    }

    return { skeleton, distances: dist };
  }

  /**
   * Distance transform using chamfer 3-4 approximation
   */
  static distanceTransform(image: BinaryImage): GrayscaleImage {
    const height = image.length;
    const width = image[0].length;
    const INF = width + height;

    // Initialize distance map
    const dist: GrayscaleImage = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(image[y][x] > 0 ? INF : 0);
      }
      dist.push(row);
    }

    // Forward pass (top-left to bottom-right)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (dist[y][x] === 0) continue;

        let minDist = dist[y][x];

        // Check top
        if (y > 0) minDist = Math.min(minDist, dist[y - 1][x] + 3);
        // Check left
        if (x > 0) minDist = Math.min(minDist, dist[y][x - 1] + 3);
        // Check top-left
        if (y > 0 && x > 0) minDist = Math.min(minDist, dist[y - 1][x - 1] + 4);
        // Check top-right
        if (y > 0 && x < width - 1) minDist = Math.min(minDist, dist[y - 1][x + 1] + 4);

        dist[y][x] = minDist;
      }
    }

    // Backward pass (bottom-right to top-left)
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        if (dist[y][x] === 0) continue;

        let minDist = dist[y][x];

        // Check bottom
        if (y < height - 1) minDist = Math.min(minDist, dist[y + 1][x] + 3);
        // Check right
        if (x < width - 1) minDist = Math.min(minDist, dist[y][x + 1] + 3);
        // Check bottom-right
        if (y < height - 1 && x < width - 1) minDist = Math.min(minDist, dist[y + 1][x + 1] + 4);
        // Check bottom-left
        if (y < height - 1 && x > 0) minDist = Math.min(minDist, dist[y + 1][x - 1] + 4);

        dist[y][x] = minDist;
      }
    }

    // Normalize (divide by 3 for chamfer distance)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        dist[y][x] = Math.round(dist[y][x] / 3);
      }
    }

    return dist;
  }
}

// ============================================================================
// CONNECTED COMPONENT LABELING
// ============================================================================

class ConnectedComponentLabeler {
  /**
   * Two-pass algorithm for 8-connected component labeling
   */
  static label8Connected(image: BinaryImage): {
    labels: number[][];
    components: ConnectedComponent[];
  } {
    const height = image.length;
    const width = image[0].length;
    const labels: number[][] = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    // Union-Find data structure
    const parent: Map<number, number> = new Map();

    const find = (x: number): number => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (x: number, y: number): void => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent.set(px, py);
      }
    };

    let nextLabel = 1;

    // First pass: assign provisional labels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (image[y][x] === 0) continue;

        // Get labels of already processed neighbors (8-connected)
        const neighborLabels: number[] = [];

        // Top-left
        if (y > 0 && x > 0 && labels[y - 1][x - 1] > 0) {
          neighborLabels.push(labels[y - 1][x - 1]);
        }
        // Top
        if (y > 0 && labels[y - 1][x] > 0) {
          neighborLabels.push(labels[y - 1][x]);
        }
        // Top-right
        if (y > 0 && x < width - 1 && labels[y - 1][x + 1] > 0) {
          neighborLabels.push(labels[y - 1][x + 1]);
        }
        // Left
        if (x > 0 && labels[y][x - 1] > 0) {
          neighborLabels.push(labels[y][x - 1]);
        }

        if (neighborLabels.length === 0) {
          // New component
          labels[y][x] = nextLabel;
          parent.set(nextLabel, nextLabel);
          nextLabel++;
        } else {
          // Assign minimum label and record equivalences
          const minLabel = Math.min(...neighborLabels);
          labels[y][x] = minLabel;

          for (const l of neighborLabels) {
            union(l, minLabel);
          }
        }
      }
    }

    // Second pass: resolve equivalences
    const labelMap: Map<number, number> = new Map();
    let finalLabel = 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labels[y][x] === 0) continue;

        const root = find(labels[y][x]);
        if (!labelMap.has(root)) {
          labelMap.set(root, finalLabel++);
        }
        labels[y][x] = labelMap.get(root)!;
      }
    }

    // Extract component properties
    const componentMap: Map<number, ConnectedComponent> = new Map();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const label = labels[y][x];
        if (label === 0) continue;

        if (!componentMap.has(label)) {
          componentMap.set(label, {
            label,
            pixels: [],
            area: 0,
            boundingBox: { x: x, y: y, width: 1, height: 1 },
            centroid: { x: 0, y: 0 }
          });
        }

        const comp = componentMap.get(label)!;
        comp.pixels.push({ x, y });
        comp.area++;

        // Update bounding box
        comp.boundingBox.x = Math.min(comp.boundingBox.x, x);
        comp.boundingBox.y = Math.min(comp.boundingBox.y, y);
        const maxX = Math.max(comp.boundingBox.x + comp.boundingBox.width - 1, x);
        const maxY = Math.max(comp.boundingBox.y + comp.boundingBox.height - 1, y);
        comp.boundingBox.width = maxX - comp.boundingBox.x + 1;
        comp.boundingBox.height = maxY - comp.boundingBox.y + 1;
      }
    }

    // Compute centroids
    for (const comp of componentMap.values()) {
      let sumX = 0;
      let sumY = 0;
      for (const p of comp.pixels) {
        sumX += p.x;
        sumY += p.y;
      }
      comp.centroid.x = sumX / comp.area;
      comp.centroid.y = sumY / comp.area;
    }

    return {
      labels,
      components: Array.from(componentMap.values()).sort((a, b) => a.label - b.label)
    };
  }

  /**
   * 4-connected component labeling
   */
  static label4Connected(image: BinaryImage): {
    labels: number[][];
    components: ConnectedComponent[];
  } {
    const height = image.length;
    const width = image[0].length;
    const labels: number[][] = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    const parent: Map<number, number> = new Map();

    const find = (x: number): number => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (x: number, y: number): void => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent.set(px, py);
      }
    };

    let nextLabel = 1;

    // First pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (image[y][x] === 0) continue;

        const neighborLabels: number[] = [];

        // Top
        if (y > 0 && labels[y - 1][x] > 0) {
          neighborLabels.push(labels[y - 1][x]);
        }
        // Left
        if (x > 0 && labels[y][x - 1] > 0) {
          neighborLabels.push(labels[y][x - 1]);
        }

        if (neighborLabels.length === 0) {
          labels[y][x] = nextLabel;
          parent.set(nextLabel, nextLabel);
          nextLabel++;
        } else {
          const minLabel = Math.min(...neighborLabels);
          labels[y][x] = minLabel;
          for (const l of neighborLabels) {
            union(l, minLabel);
          }
        }
      }
    }

    // Second pass
    const labelMap: Map<number, number> = new Map();
    let finalLabel = 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labels[y][x] === 0) continue;
        const root = find(labels[y][x]);
        if (!labelMap.has(root)) {
          labelMap.set(root, finalLabel++);
        }
        labels[y][x] = labelMap.get(root)!;
      }
    }

    // Extract components
    const componentMap: Map<number, ConnectedComponent> = new Map();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const label = labels[y][x];
        if (label === 0) continue;

        if (!componentMap.has(label)) {
          componentMap.set(label, {
            label,
            pixels: [],
            area: 0,
            boundingBox: { x: x, y: y, width: 1, height: 1 },
            centroid: { x: 0, y: 0 }
          });
        }

        const comp = componentMap.get(label)!;
        comp.pixels.push({ x, y });
        comp.area++;

        comp.boundingBox.x = Math.min(comp.boundingBox.x, x);
        comp.boundingBox.y = Math.min(comp.boundingBox.y, y);
        const maxX = Math.max(comp.boundingBox.x + comp.boundingBox.width - 1, x);
        const maxY = Math.max(comp.boundingBox.y + comp.boundingBox.height - 1, y);
        comp.boundingBox.width = maxX - comp.boundingBox.x + 1;
        comp.boundingBox.height = maxY - comp.boundingBox.y + 1;
      }
    }

    for (const comp of componentMap.values()) {
      let sumX = 0;
      let sumY = 0;
      for (const p of comp.pixels) {
        sumX += p.x;
        sumY += p.y;
      }
      comp.centroid.x = sumX / comp.area;
      comp.centroid.y = sumY / comp.area;
    }

    return {
      labels,
      components: Array.from(componentMap.values()).sort((a, b) => a.label - b.label)
    };
  }
}

// ============================================================================
// ADVANCED MORPHOLOGICAL OPERATIONS
// ============================================================================

class AdvancedMorphOps {
  /**
   * Hit-or-miss transform
   * Detects specific patterns
   */
  static hitOrMiss(
    image: BinaryImage,
    hit: StructuringElement,
    miss: StructuringElement
  ): BinaryImage {
    // Erode image with hit pattern
    const erodedHit = MorphologicalOps.erode(image, hit);

    // Erode complement with miss pattern
    const height = image.length;
    const width = image[0].length;
    const complement: BinaryImage = image.map(row =>
      row.map(v => (v > 0 ? 0 : 255))
    );
    const erodedMiss = MorphologicalOps.erode(complement, miss);

    // Intersection
    const result: BinaryImage = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (erodedHit[y][x] > 0 && erodedMiss[y][x] > 0) {
          result[y][x] = 255;
        }
      }
    }

    return result;
  }

  /**
   * Morphological reconstruction (geodesic dilation)
   * Reconstructs connected components of mask that intersect with marker
   */
  static reconstruct(marker: BinaryImage, mask: BinaryImage): BinaryImage {
    const height = marker.length;
    const width = marker[0].length;

    let current = marker.map(row => [...row]);
    let changed = true;
    let iteration = 0;
    const maxIterations = width * height;

    const se = StructuringElementGenerator.cross(3);

    while (changed && iteration < maxIterations) {
      iteration++;
      changed = false;

      // Geodesic dilation: dilate marker, then intersect with mask
      const dilated = MorphologicalOps.dilate(current, se);
      const next: BinaryImage = Array.from({ length: height }, () =>
        Array(width).fill(0)
      );

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const val = Math.min(dilated[y][x], mask[y][x]);
          next[y][x] = val;
          if (val !== current[y][x]) {
            changed = true;
          }
        }
      }

      current = next;
    }

    return current;
  }

  /**
   * Fill holes in binary image
   */
  static fillHoles(image: BinaryImage): BinaryImage {
    const height = image.length;
    const width = image[0].length;

    // Create marker: complement of image with border pixels set
    const marker: BinaryImage = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    // Set border pixels to complement values
    for (let y = 0; y < height; y++) {
      marker[y][0] = image[y][0] > 0 ? 0 : 255;
      marker[y][width - 1] = image[y][width - 1] > 0 ? 0 : 255;
    }
    for (let x = 0; x < width; x++) {
      marker[0][x] = image[0][x] > 0 ? 0 : 255;
      marker[height - 1][x] = image[height - 1][x] > 0 ? 0 : 255;
    }

    // Mask is complement of image
    const mask = image.map(row => row.map(v => (v > 0 ? 0 : 255)));

    // Reconstruct
    const reconstructed = this.reconstruct(marker, mask);

    // Result is complement of reconstruction
    return reconstructed.map(row => row.map(v => (v > 0 ? 0 : 255)));
  }

  /**
   * Remove small objects (area opening)
   */
  static removeSmallObjects(image: BinaryImage, minArea: number): BinaryImage {
    const { labels, components } = ConnectedComponentLabeler.label8Connected(image);
    const height = image.length;
    const width = image[0].length;
    const result: BinaryImage = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    const validLabels = new Set(
      components.filter(c => c.area >= minArea).map(c => c.label)
    );

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (validLabels.has(labels[y][x])) {
          result[y][x] = 255;
        }
      }
    }

    return result;
  }

  /**
   * Boundary extraction
   */
  static extractBoundary(image: BinaryImage): BinaryImage {
    const se = StructuringElementGenerator.cross(3);
    const eroded = MorphologicalOps.erode(image, se);
    const height = image.length;
    const width = image[0].length;

    const result: BinaryImage = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (image[y][x] > 0 && eroded[y][x] === 0) {
          result[y][x] = 255;
        }
      }
    }

    return result;
  }

  /**
   * Convex hull via iterative morphological operations
   */
  static convexHull(image: BinaryImage): BinaryImage {
    const height = image.length;
    const width = image[0].length;

    const current = image.map(row => [...row]);
    let changed = true;
    let iteration = 0;
    const maxIterations = Math.max(width, height);

    while (changed && iteration < maxIterations) {
      iteration++;
      changed = false;

      // Check each concave corner and fill
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (current[y][x] > 0) continue;

          // Check if filling this pixel would make shape more convex
          const neighbors = [
            current[y - 1][x - 1], current[y - 1][x], current[y - 1][x + 1],
            current[y][x - 1], current[y][x + 1],
            current[y + 1][x - 1], current[y + 1][x], current[y + 1][x + 1]
          ];

          const count = neighbors.filter(n => n > 0).length;

          // Fill if surrounded by many foreground pixels
          if (count >= 6) {
            current[y][x] = 255;
            changed = true;
          }
        }
      }
    }

    return current;
  }
}

// ============================================================================
// TEST IMAGE GENERATORS
// ============================================================================

function generateTestImage(): BinaryImage {
  const size = 64;
  const image: BinaryImage = Array.from({ length: size }, () =>
    Array(size).fill(0)
  );

  // Draw a rectangle with some holes and noise
  for (let y = 10; y < 40; y++) {
    for (let x = 10; x < 50; x++) {
      image[y][x] = 255;
    }
  }

  // Add a hole
  for (let y = 20; y < 30; y++) {
    for (let x = 25; x < 35; x++) {
      image[y][x] = 0;
    }
  }

  // Add noise dots
  image[5][5] = 255;
  image[5][7] = 255;
  image[55][55] = 255;
  image[45][15] = 255;

  // Add a small connected component
  for (let y = 50; y < 55; y++) {
    for (let x = 5; x < 10; x++) {
      image[y][x] = 255;
    }
  }

  // Draw a line for skeletonization demo
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 3; j++) {
      if (45 + i < size && 35 + j < size) {
        image[45 + i][35 + j] = 255;
      }
    }
  }

  return image;
}

function generateGrayscaleTestImage(): GrayscaleImage {
  const size = 64;
  const image: GrayscaleImage = Array.from({ length: size }, () =>
    Array(size).fill(128)
  );

  // Create gradient region
  for (let y = 10; y < 50; y++) {
    for (let x = 10; x < 50; x++) {
      const dist = Math.sqrt((y - 30) ** 2 + (x - 30) ** 2);
      image[y][x] = Math.max(0, Math.min(255, 200 - dist * 5));
    }
  }

  // Add some bright spots
  for (let y = 5; y < 10; y++) {
    for (let x = 5; x < 10; x++) {
      image[y][x] = 250;
    }
  }

  return image;
}

function formatImageAscii(image: number[][], width: number, height: number): string {
  const lines: string[] = [];
  const stepY = Math.max(1, Math.floor(image.length / height));
  const stepX = Math.max(1, Math.floor(image[0].length / width));

  for (let y = 0; y < image.length; y += stepY) {
    let line = '';
    for (let x = 0; x < image[0].length; x += stepX) {
      const val = image[y][x];
      if (val > 200) line += '@';
      else if (val > 150) line += '#';
      else if (val > 100) line += '+';
      else if (val > 50) line += '.';
      else line += ' ';
    }
    lines.push(line);
    if (lines.length >= height) break;
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

async function executemorphologicalops(params: Record<string, unknown>): Promise<ToolResult> {
  const operation = (params.operation as string) || 'info';

  switch (operation) {
    case 'info': {
      return {
        success: true,
        data: {
          name: 'Morphological Operations Tool',
          version: '1.0.0',
          description: 'Comprehensive morphological image processing operations',
          operations: {
            basic: ['erode', 'dilate', 'opening', 'closing', 'gradient', 'top_hat', 'black_hat'],
            skeletonization: ['zhang_suen', 'morphological_skeleton', 'medial_axis'],
            connected_components: ['label_8connected', 'label_4connected'],
            advanced: ['hit_or_miss', 'reconstruct', 'fill_holes', 'remove_small_objects', 'extract_boundary', 'convex_hull']
          },
          structuring_elements: ['rectangle', 'cross', 'ellipse', 'diamond', 'disk']
        }
      };
    }

    case 'demo': {
      const binaryImage = generateTestImage();
      const grayscaleImage = generateGrayscaleTestImage();
      const se = StructuringElementGenerator.disk(2);

      // Demonstrate various operations
      const eroded = MorphologicalOps.erode(binaryImage, se);
      const dilated = MorphologicalOps.dilate(binaryImage, se);
      const opened = MorphologicalOps.opening(binaryImage, se);
      const closed = MorphologicalOps.closing(binaryImage, se);
      const gradient = MorphologicalOps.gradient(binaryImage, se);
      const topHat = MorphologicalOps.topHat(grayscaleImage, se);
      const blackHat = MorphologicalOps.blackHat(grayscaleImage, se);

      // Skeletonization
      const skeleton = Skeletonization.zhangSuen(binaryImage);

      // Connected components
      const { components } = ConnectedComponentLabeler.label8Connected(binaryImage);

      // Fill holes
      const filled = AdvancedMorphOps.fillHoles(binaryImage);

      // Boundary
      const boundary = AdvancedMorphOps.extractBoundary(binaryImage);

      return {
        success: true,
        data: {
          demonstration: 'Morphological operations demonstration',
          input: {
            binary_image: {
              size: `${binaryImage[0].length}x${binaryImage.length}`,
              preview: formatImageAscii(binaryImage, 32, 16)
            },
            structuring_element: {
              type: 'disk',
              radius: 2
            }
          },
          results: {
            erosion: {
              description: 'Shrinks foreground regions',
              preview: formatImageAscii(eroded, 32, 16)
            },
            dilation: {
              description: 'Expands foreground regions',
              preview: formatImageAscii(dilated, 32, 16)
            },
            opening: {
              description: 'Removes small bright regions',
              preview: formatImageAscii(opened, 32, 16)
            },
            closing: {
              description: 'Fills small dark holes',
              preview: formatImageAscii(closed, 32, 16)
            },
            gradient: {
              description: 'Edge detection via morphology',
              preview: formatImageAscii(gradient, 32, 16)
            },
            top_hat: {
              description: 'Extracts bright features',
              sample_values: topHat.slice(0, 3).map(row => row.slice(0, 10))
            },
            black_hat: {
              description: 'Extracts dark features',
              sample_values: blackHat.slice(0, 3).map(row => row.slice(0, 10))
            },
            skeleton: {
              description: 'Zhang-Suen thinning',
              preview: formatImageAscii(skeleton, 32, 16)
            },
            connected_components: {
              count: components.length,
              components: components.map(c => ({
                label: c.label,
                area: c.area,
                centroid: c.centroid,
                bounding_box: c.boundingBox
              }))
            },
            filled_holes: {
              description: 'Binary image with holes filled',
              preview: formatImageAscii(filled, 32, 16)
            },
            boundary: {
              description: 'Extracted boundary pixels',
              preview: formatImageAscii(boundary, 32, 16)
            }
          }
        }
      };
    }

    case 'erode': {
      const image = params.image as number[][] | undefined;
      const seType = (params.structuring_element as string) || 'disk';
      const seSize = (params.size as number) || 3;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      let se: StructuringElement;
      switch (seType) {
        case 'rectangle':
          se = StructuringElementGenerator.rectangle(seSize, seSize);
          break;
        case 'cross':
          se = StructuringElementGenerator.cross(seSize);
          break;
        case 'ellipse':
          se = StructuringElementGenerator.ellipse(seSize, seSize);
          break;
        case 'diamond':
          se = StructuringElementGenerator.diamond(seSize);
          break;
        default:
          se = StructuringElementGenerator.disk(Math.floor(seSize / 2));
      }

      const result = MorphologicalOps.erode(image, se);

      return {
        success: true,
        data: {
          operation: 'erosion',
          input_size: `${image[0].length}x${image.length}`,
          structuring_element: { type: seType, size: seSize },
          result: result
        }
      };
    }

    case 'dilate': {
      const image = params.image as number[][] | undefined;
      const seType = (params.structuring_element as string) || 'disk';
      const seSize = (params.size as number) || 3;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      let se: StructuringElement;
      switch (seType) {
        case 'rectangle':
          se = StructuringElementGenerator.rectangle(seSize, seSize);
          break;
        case 'cross':
          se = StructuringElementGenerator.cross(seSize);
          break;
        case 'ellipse':
          se = StructuringElementGenerator.ellipse(seSize, seSize);
          break;
        case 'diamond':
          se = StructuringElementGenerator.diamond(seSize);
          break;
        default:
          se = StructuringElementGenerator.disk(Math.floor(seSize / 2));
      }

      const result = MorphologicalOps.dilate(image, se);

      return {
        success: true,
        data: {
          operation: 'dilation',
          input_size: `${image[0].length}x${image.length}`,
          structuring_element: { type: seType, size: seSize },
          result: result
        }
      };
    }

    case 'opening': {
      const image = params.image as number[][] | undefined;
      const seType = (params.structuring_element as string) || 'disk';
      const seSize = (params.size as number) || 3;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      let se: StructuringElement;
      switch (seType) {
        case 'rectangle':
          se = StructuringElementGenerator.rectangle(seSize, seSize);
          break;
        case 'cross':
          se = StructuringElementGenerator.cross(seSize);
          break;
        default:
          se = StructuringElementGenerator.disk(Math.floor(seSize / 2));
      }

      const result = MorphologicalOps.opening(image, se);

      return {
        success: true,
        data: {
          operation: 'opening',
          description: 'Erosion followed by dilation - removes small bright regions',
          result: result
        }
      };
    }

    case 'closing': {
      const image = params.image as number[][] | undefined;
      const seType = (params.structuring_element as string) || 'disk';
      const seSize = (params.size as number) || 3;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      let se: StructuringElement;
      switch (seType) {
        case 'rectangle':
          se = StructuringElementGenerator.rectangle(seSize, seSize);
          break;
        case 'cross':
          se = StructuringElementGenerator.cross(seSize);
          break;
        default:
          se = StructuringElementGenerator.disk(Math.floor(seSize / 2));
      }

      const result = MorphologicalOps.closing(image, se);

      return {
        success: true,
        data: {
          operation: 'closing',
          description: 'Dilation followed by erosion - fills small dark holes',
          result: result
        }
      };
    }

    case 'gradient': {
      const image = params.image as number[][] | undefined;
      const seSize = (params.size as number) || 3;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      const se = StructuringElementGenerator.disk(Math.floor(seSize / 2));
      const result = MorphologicalOps.gradient(image, se);

      return {
        success: true,
        data: {
          operation: 'morphological_gradient',
          description: 'Difference between dilation and erosion - edge detection',
          result: result
        }
      };
    }

    case 'top_hat': {
      const image = params.image as number[][] | undefined;
      const seSize = (params.size as number) || 5;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      const se = StructuringElementGenerator.disk(Math.floor(seSize / 2));
      const result = MorphologicalOps.topHat(image, se);

      return {
        success: true,
        data: {
          operation: 'top_hat',
          description: 'Original minus opening - extracts bright features smaller than SE',
          result: result
        }
      };
    }

    case 'black_hat': {
      const image = params.image as number[][] | undefined;
      const seSize = (params.size as number) || 5;

      if (!image) {
        return { success: false, error: 'Image required' };
      }

      const se = StructuringElementGenerator.disk(Math.floor(seSize / 2));
      const result = MorphologicalOps.blackHat(image, se);

      return {
        success: true,
        data: {
          operation: 'black_hat',
          description: 'Closing minus original - extracts dark features smaller than SE',
          result: result
        }
      };
    }

    case 'skeletonize': {
      const image = params.image as number[][] | undefined;
      const method = (params.method as string) || 'zhang_suen';

      if (!image) {
        return { success: false, error: 'Binary image required' };
      }

      let skeleton: BinaryImage;
      let additionalData: Record<string, unknown> = {};

      switch (method) {
        case 'morphological': {
          const se = StructuringElementGenerator.cross(3);
          skeleton = Skeletonization.morphologicalSkeleton(image, se);
          break;
        }
        case 'medial_axis': {
          const result = Skeletonization.medialAxis(image);
          skeleton = result.skeleton;
          additionalData = { distance_transform: result.distances };
          break;
        }
        default:
          skeleton = Skeletonization.zhangSuen(image);
      }

      // Count skeleton pixels
      let skeletonPixels = 0;
      for (const row of skeleton) {
        for (const val of row) {
          if (val > 0) skeletonPixels++;
        }
      }

      return {
        success: true,
        data: {
          operation: 'skeletonization',
          method: method,
          skeleton: skeleton,
          skeleton_pixels: skeletonPixels,
          ...additionalData
        }
      };
    }

    case 'connected_components': {
      const image = params.image as number[][] | undefined;
      const connectivity = (params.connectivity as number) || 8;

      if (!image) {
        return { success: false, error: 'Binary image required' };
      }

      const result = connectivity === 4
        ? ConnectedComponentLabeler.label4Connected(image)
        : ConnectedComponentLabeler.label8Connected(image);

      return {
        success: true,
        data: {
          operation: 'connected_component_labeling',
          connectivity: connectivity,
          num_components: result.components.length,
          labels: result.labels,
          components: result.components.map(c => ({
            label: c.label,
            area: c.area,
            centroid: { x: c.centroid.x.toFixed(2), y: c.centroid.y.toFixed(2) },
            bounding_box: c.boundingBox
          }))
        }
      };
    }

    case 'fill_holes': {
      const image = params.image as number[][] | undefined;

      if (!image) {
        return { success: false, error: 'Binary image required' };
      }

      const result = AdvancedMorphOps.fillHoles(image);

      return {
        success: true,
        data: {
          operation: 'fill_holes',
          description: 'Fills enclosed dark regions in binary image',
          result: result
        }
      };
    }

    case 'remove_small_objects': {
      const image = params.image as number[][] | undefined;
      const minArea = (params.min_area as number) || 50;

      if (!image) {
        return { success: false, error: 'Binary image required' };
      }

      const result = AdvancedMorphOps.removeSmallObjects(image, minArea);

      return {
        success: true,
        data: {
          operation: 'remove_small_objects',
          min_area: minArea,
          result: result
        }
      };
    }

    case 'extract_boundary': {
      const image = params.image as number[][] | undefined;

      if (!image) {
        return { success: false, error: 'Binary image required' };
      }

      const result = AdvancedMorphOps.extractBoundary(image);

      return {
        success: true,
        data: {
          operation: 'boundary_extraction',
          result: result
        }
      };
    }

    case 'distance_transform': {
      const image = params.image as number[][] | undefined;

      if (!image) {
        return { success: false, error: 'Binary image required' };
      }

      const result = Skeletonization.distanceTransform(image);

      // Find max distance
      let maxDist = 0;
      for (const row of result) {
        for (const val of row) {
          maxDist = Math.max(maxDist, val);
        }
      }

      return {
        success: true,
        data: {
          operation: 'distance_transform',
          description: 'Chamfer 3-4 distance transform',
          max_distance: maxDist,
          result: result
        }
      };
    }

    case 'hit_or_miss': {
      const image = params.image as number[][] | undefined;
      const hitPattern = params.hit as number[][] | undefined;
      const missPattern = params.miss as number[][] | undefined;

      if (!image || !hitPattern || !missPattern) {
        return { success: false, error: 'Image, hit pattern, and miss pattern required' };
      }

      const hit: StructuringElement = {
        data: hitPattern,
        originX: Math.floor(hitPattern[0].length / 2),
        originY: Math.floor(hitPattern.length / 2)
      };

      const miss: StructuringElement = {
        data: missPattern,
        originX: Math.floor(missPattern[0].length / 2),
        originY: Math.floor(missPattern.length / 2)
      };

      const result = AdvancedMorphOps.hitOrMiss(image, hit, miss);

      return {
        success: true,
        data: {
          operation: 'hit_or_miss_transform',
          description: 'Pattern detection using hit-or-miss transform',
          result: result
        }
      };
    }

    case 'reconstruct': {
      const marker = params.marker as number[][] | undefined;
      const mask = params.mask as number[][] | undefined;

      if (!marker || !mask) {
        return { success: false, error: 'Marker and mask images required' };
      }

      const result = AdvancedMorphOps.reconstruct(marker, mask);

      return {
        success: true,
        data: {
          operation: 'morphological_reconstruction',
          description: 'Geodesic reconstruction of mask from marker',
          result: result
        }
      };
    }

    case 'examples': {
      return {
        success: true,
        data: {
          examples: [
            {
              title: 'Basic Erosion',
              code: 'executemorphologicalops({ operation: "erode", image: binaryImage, structuring_element: "disk", size: 3 })',
              description: 'Erodes image using disk-shaped structuring element'
            },
            {
              title: 'Opening for Noise Removal',
              code: 'executemorphologicalops({ operation: "opening", image: noisyImage, size: 5 })',
              description: 'Removes small bright noise while preserving shape'
            },
            {
              title: 'Skeletonization',
              code: 'executemorphologicalops({ operation: "skeletonize", image: binaryShape, method: "zhang_suen" })',
              description: 'Extracts skeleton using Zhang-Suen algorithm'
            },
            {
              title: 'Connected Component Analysis',
              code: 'executemorphologicalops({ operation: "connected_components", image: binaryImage, connectivity: 8 })',
              description: 'Labels and analyzes connected regions'
            },
            {
              title: 'Fill Holes',
              code: 'executemorphologicalops({ operation: "fill_holes", image: imageWithHoles })',
              description: 'Fills enclosed holes in binary objects'
            },
            {
              title: 'Morphological Gradient (Edge Detection)',
              code: 'executemorphologicalops({ operation: "gradient", image: grayscaleImage, size: 3 })',
              description: 'Detects edges using morphological gradient'
            },
            {
              title: 'Top-Hat Transform',
              code: 'executemorphologicalops({ operation: "top_hat", image: grayscaleImage, size: 15 })',
              description: 'Extracts bright features smaller than structuring element'
            },
            {
              title: 'Distance Transform',
              code: 'executemorphologicalops({ operation: "distance_transform", image: binaryImage })',
              description: 'Computes distance from background for each pixel'
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

function ismorphologicalopsAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const morphologicalopsTool: UnifiedTool = {
  name: 'morphologicalops',
  description: `Comprehensive morphological image processing operations.

OPERATIONS:
- erode: Shrink foreground regions using minimum filter
- dilate: Expand foreground regions using maximum filter
- opening: Erosion + dilation (removes small bright regions)
- closing: Dilation + erosion (fills small dark holes)
- gradient: Edge detection via dilation - erosion
- top_hat: Extract bright features smaller than SE
- black_hat: Extract dark features smaller than SE
- skeletonize: Thin binary shapes (zhang_suen, morphological, medial_axis)
- connected_components: Label and analyze connected regions
- fill_holes: Fill enclosed dark regions
- remove_small_objects: Filter by minimum area
- extract_boundary: Get boundary pixels
- distance_transform: Compute distance from background
- hit_or_miss: Pattern detection transform
- reconstruct: Morphological reconstruction

STRUCTURING ELEMENTS: rectangle, cross, ellipse, diamond, disk`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform'
      },
      image: {
        type: 'array',
        description: '2D array of pixel values (binary or grayscale)'
      },
      structuring_element: {
        type: 'string',
        description: 'Type: rectangle, cross, ellipse, diamond, disk'
      },
      size: {
        type: 'number',
        description: 'Structuring element size'
      },
      method: {
        type: 'string',
        description: 'Algorithm method for operations with variants'
      },
      connectivity: {
        type: 'number',
        description: '4 or 8 connectivity for connected components'
      },
      min_area: {
        type: 'number',
        description: 'Minimum area for small object removal'
      },
      marker: {
        type: 'array',
        description: 'Marker image for reconstruction'
      },
      mask: {
        type: 'array',
        description: 'Mask image for reconstruction'
      },
      hit: {
        type: 'array',
        description: 'Hit pattern for hit-or-miss'
      },
      miss: {
        type: 'array',
        description: 'Miss pattern for hit-or-miss'
      }
    },
    required: []
  },
  execute: executemorphologicalops
};

export { executemorphologicalops, ismorphologicalopsAvailable };
