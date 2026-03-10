// ============================================================================
// HOUGH VISION TOOL - TIER GODMODE
// ============================================================================
// Computer vision primitives: Hough transform for line/circle detection,
// corner detection, edge detection, feature extraction, and contour analysis.
// Pure TypeScript implementation.
// ============================================================================

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

/* interface Point {
  x: number;
  y: number;
} */

interface Line {
  rho: number; // Distance from origin
  theta: number; // Angle in radians
  votes: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

interface Circle {
  x: number;
  y: number;
  radius: number;
  votes: number;
}

interface Corner {
  x: number;
  y: number;
  strength: number;
}

interface Edge {
  x: number;
  y: number;
  magnitude: number;
  direction: number;
}

// ============================================================================
// IMAGE REPRESENTATION
// ============================================================================

type GrayscaleImage = number[][]; // 0-255 values

function createImage(width: number, height: number, value: number = 0): GrayscaleImage {
  const img: GrayscaleImage = [];
  for (let y = 0; y < height; y++) {
    img.push(new Array(width).fill(value));
  }
  return img;
}

function drawLine(img: GrayscaleImage, x1: number, y1: number, x2: number, y2: number, value: number = 255): void {
  // Bresenham's line algorithm
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let x = x1;
  let y = y1;

  while (true) {
    if (y >= 0 && y < img.length && x >= 0 && x < img[0].length) {
      img[y][x] = value;
    }

    if (x === x2 && y === y2) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawCircle(img: GrayscaleImage, cx: number, cy: number, radius: number, value: number = 255): void {
  // Midpoint circle algorithm
  let x = radius;
  let y = 0;
  let err = 0;

  while (x >= y) {
    setPixelSafe(img, cx + x, cy + y, value);
    setPixelSafe(img, cx + y, cy + x, value);
    setPixelSafe(img, cx - y, cy + x, value);
    setPixelSafe(img, cx - x, cy + y, value);
    setPixelSafe(img, cx - x, cy - y, value);
    setPixelSafe(img, cx - y, cy - x, value);
    setPixelSafe(img, cx + y, cy - x, value);
    setPixelSafe(img, cx + x, cy - y, value);

    y++;
    if (err <= 0) {
      err += 2 * y + 1;
    }
    if (err > 0) {
      x--;
      err -= 2 * x + 1;
    }
  }
}

function setPixelSafe(img: GrayscaleImage, x: number, y: number, value: number): void {
  if (y >= 0 && y < img.length && x >= 0 && x < img[0].length) {
    img[y][x] = value;
  }
}

function getPixelSafe(img: GrayscaleImage, x: number, y: number): number {
  if (y >= 0 && y < img.length && x >= 0 && x < img[0].length) {
    return img[y][x];
  }
  return 0;
}

// ============================================================================
// CONVOLUTION & FILTERS
// ============================================================================

function convolve(img: GrayscaleImage, kernel: number[][]): GrayscaleImage {
  const height = img.length;
  const width = img[0].length;
  const kSize = kernel.length;
  const kHalf = Math.floor(kSize / 2);
  const result = createImage(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const py = y + ky - kHalf;
          const px = x + kx - kHalf;
          sum += getPixelSafe(img, px, py) * kernel[ky][kx];
        }
      }
      result[y][x] = Math.max(0, Math.min(255, sum));
    }
  }

  return result;
}

// Sobel kernels for edge detection
const SOBEL_X: number[][] = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

const SOBEL_Y: number[][] = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

// Gaussian blur kernel
const GAUSSIAN_3x3: number[][] = [
  [1 / 16, 2 / 16, 1 / 16],
  [2 / 16, 4 / 16, 2 / 16],
  [1 / 16, 2 / 16, 1 / 16],
];

// ============================================================================
// EDGE DETECTION
// ============================================================================

function sobelEdgeDetection(img: GrayscaleImage): {
  magnitude: GrayscaleImage;
  direction: number[][];
  edges: Edge[];
} {
  const gx = convolve(img, SOBEL_X);
  const gy = convolve(img, SOBEL_Y);

  const height = img.length;
  const width = img[0].length;
  const magnitude = createImage(width, height);
  const direction: number[][] = [];
  const edges: Edge[] = [];

  for (let y = 0; y < height; y++) {
    direction.push([]);
    for (let x = 0; x < width; x++) {
      const mag = Math.sqrt(gx[y][x] ** 2 + gy[y][x] ** 2);
      magnitude[y][x] = Math.min(255, mag);
      direction[y][x] = Math.atan2(gy[y][x], gx[y][x]);

      if (mag > 50) {
        // Threshold
        edges.push({ x, y, magnitude: mag, direction: direction[y][x] });
      }
    }
  }

  return { magnitude, direction, edges };
}

function cannyEdgeDetection(
  img: GrayscaleImage,
  lowThreshold: number = 50,
  highThreshold: number = 100
): GrayscaleImage {
  // 1. Gaussian blur
  const blurred = convolve(img, GAUSSIAN_3x3);

  // 2. Sobel gradients
  const { magnitude, direction } = sobelEdgeDetection(blurred);

  const height = img.length;
  const width = img[0].length;

  // 3. Non-maximum suppression
  const suppressed = createImage(width, height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const angle = direction[y][x];
      const mag = magnitude[y][x];

      // Quantize angle to 0, 45, 90, 135 degrees
      let q: number, r: number;

      if (
        (angle >= -Math.PI / 8 && angle < Math.PI / 8) ||
        (angle >= (7 * Math.PI) / 8 || angle < (-7 * Math.PI) / 8)
      ) {
        // Horizontal
        q = magnitude[y][x + 1];
        r = magnitude[y][x - 1];
      } else if (angle >= Math.PI / 8 && angle < (3 * Math.PI) / 8) {
        // Diagonal /
        q = magnitude[y - 1][x + 1];
        r = magnitude[y + 1][x - 1];
      } else if (
        (angle >= (3 * Math.PI) / 8 && angle < (5 * Math.PI) / 8) ||
        (angle >= (-5 * Math.PI) / 8 && angle < (-3 * Math.PI) / 8)
      ) {
        // Vertical
        q = magnitude[y - 1][x];
        r = magnitude[y + 1][x];
      } else {
        // Diagonal \
        q = magnitude[y - 1][x - 1];
        r = magnitude[y + 1][x + 1];
      }

      suppressed[y][x] = mag >= q && mag >= r ? mag : 0;
    }
  }

  // 4. Double threshold and hysteresis
  const result = createImage(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (suppressed[y][x] >= highThreshold) {
        result[y][x] = 255;
      } else if (suppressed[y][x] >= lowThreshold) {
        // Check if connected to strong edge
        let connected = false;
        for (let dy = -1; dy <= 1 && !connected; dy++) {
          for (let dx = -1; dx <= 1 && !connected; dx++) {
            if (getPixelSafe(suppressed, x + dx, y + dy) >= highThreshold) {
              connected = true;
            }
          }
        }
        result[y][x] = connected ? 255 : 0;
      }
    }
  }

  return result;
}

// ============================================================================
// HOUGH LINE TRANSFORM
// ============================================================================

function houghLineTransform(
  edgeImage: GrayscaleImage,
  thetaResolution: number = 180,
  rhoResolution: number = 1
): { accumulator: number[][]; lines: Line[] } {
  const height = edgeImage.length;
  const width = edgeImage[0].length;

  const diagonal = Math.sqrt(width * width + height * height);
  const rhoMax = Math.ceil(diagonal);
  const numRho = Math.ceil((2 * rhoMax) / rhoResolution);
  const numTheta = thetaResolution;

  // Initialize accumulator
  const accumulator: number[][] = [];
  for (let r = 0; r < numRho; r++) {
    accumulator.push(new Array(numTheta).fill(0));
  }

  // Precompute sin/cos
  const cosTable: number[] = [];
  const sinTable: number[] = [];
  for (let t = 0; t < numTheta; t++) {
    const theta = (t * Math.PI) / numTheta;
    cosTable.push(Math.cos(theta));
    sinTable.push(Math.sin(theta));
  }

  // Vote
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edgeImage[y][x] > 128) {
        for (let t = 0; t < numTheta; t++) {
          const rho = x * cosTable[t] + y * sinTable[t];
          const rhoIndex = Math.round((rho + rhoMax) / rhoResolution);
          if (rhoIndex >= 0 && rhoIndex < numRho) {
            accumulator[rhoIndex][t]++;
          }
        }
      }
    }
  }

  // Find peaks
  const lines: Line[] = [];
  const threshold = Math.max(
    10,
    Math.max(...accumulator.flat()) * 0.5
  );

  for (let r = 0; r < numRho; r++) {
    for (let t = 0; t < numTheta; t++) {
      if (accumulator[r][t] > threshold) {
        // Local maximum check
        let isMax = true;
        for (let dr = -2; dr <= 2 && isMax; dr++) {
          for (let dt = -2; dt <= 2 && isMax; dt++) {
            const nr = r + dr;
            const nt = (t + dt + numTheta) % numTheta;
            if (nr >= 0 && nr < numRho && (dr !== 0 || dt !== 0)) {
              if (accumulator[nr][nt] > accumulator[r][t]) {
                isMax = false;
              }
            }
          }
        }

        if (isMax) {
          const rho = r * rhoResolution - rhoMax;
          const theta = (t * Math.PI) / numTheta;

          // Convert to line endpoints
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);
          const x0 = cos * rho;
          const y0 = sin * rho;

          lines.push({
            rho,
            theta,
            votes: accumulator[r][t],
            x1: Math.round(x0 - 1000 * sin),
            y1: Math.round(y0 + 1000 * cos),
            x2: Math.round(x0 + 1000 * sin),
            y2: Math.round(y0 - 1000 * cos),
          });
        }
      }
    }
  }

  // Sort by votes
  lines.sort((a, b) => b.votes - a.votes);

  return { accumulator, lines: lines.slice(0, 10) };
}

// ============================================================================
// HOUGH CIRCLE TRANSFORM
// ============================================================================

function houghCircleTransform(
  edgeImage: GrayscaleImage,
  minRadius: number = 10,
  maxRadius: number = 50,
  threshold: number = 0.5
): Circle[] {
  const height = edgeImage.length;
  const width = edgeImage[0].length;

  const circles: Circle[] = [];

  for (let radius = minRadius; radius <= maxRadius; radius += 2) {
    // 3D accumulator for this radius
    const accumulator = createImage(width, height);

    // For each edge pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edgeImage[y][x] > 128) {
          // Vote in a circle
          for (let angle = 0; angle < 360; angle += 5) {
            const rad = (angle * Math.PI) / 180;
            const cx = Math.round(x - radius * Math.cos(rad));
            const cy = Math.round(y - radius * Math.sin(rad));
            if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
              accumulator[cy][cx]++;
            }
          }
        }
      }
    }

    // Find peaks
    const circumference = 2 * Math.PI * radius;
    const voteThreshold = circumference * threshold * 0.1;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (accumulator[y][x] > voteThreshold) {
          // Local maximum
          let isMax = true;
          for (let dy = -1; dy <= 1 && isMax; dy++) {
            for (let dx = -1; dx <= 1 && isMax; dx++) {
              if ((dx !== 0 || dy !== 0) && accumulator[y + dy][x + dx] > accumulator[y][x]) {
                isMax = false;
              }
            }
          }

          if (isMax) {
            circles.push({
              x,
              y,
              radius,
              votes: accumulator[y][x],
            });
          }
        }
      }
    }
  }

  // Sort by votes and remove duplicates
  circles.sort((a, b) => b.votes - a.votes);

  // Remove overlapping circles
  const filtered: Circle[] = [];
  for (const circle of circles) {
    const overlaps = filtered.some(
      (c) => Math.sqrt((c.x - circle.x) ** 2 + (c.y - circle.y) ** 2) < (c.radius + circle.radius) / 2
    );
    if (!overlaps) {
      filtered.push(circle);
    }
    if (filtered.length >= 10) break;
  }

  return filtered;
}

// ============================================================================
// HARRIS CORNER DETECTION
// ============================================================================

function harrisCornerDetection(
  img: GrayscaleImage,
  k: number = 0.04,
  threshold: number = 10000
): Corner[] {
  const { magnitude: _magnitude } = sobelEdgeDetection(img);
  const gx = convolve(img, SOBEL_X);
  const gy = convolve(img, SOBEL_Y);

  const height = img.length;
  const width = img[0].length;

  // Compute products
  const Ixx = createImage(width, height);
  const Iyy = createImage(width, height);
  const Ixy = createImage(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      Ixx[y][x] = gx[y][x] * gx[y][x];
      Iyy[y][x] = gy[y][x] * gy[y][x];
      Ixy[y][x] = gx[y][x] * gy[y][x];
    }
  }

  // Gaussian smoothing
  const Sxx = convolve(Ixx, GAUSSIAN_3x3);
  const Syy = convolve(Iyy, GAUSSIAN_3x3);
  const Sxy = convolve(Ixy, GAUSSIAN_3x3);

  // Harris response
  const corners: Corner[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const det = Sxx[y][x] * Syy[y][x] - Sxy[y][x] * Sxy[y][x];
      const trace = Sxx[y][x] + Syy[y][x];
      const R = det - k * trace * trace;

      if (R > threshold) {
        // Non-maximum suppression
        let isMax = true;
        for (let dy = -1; dy <= 1 && isMax; dy++) {
          for (let dx = -1; dx <= 1 && isMax; dx++) {
            if (dx !== 0 || dy !== 0) {
              const det2 = Sxx[y + dy][x + dx] * Syy[y + dy][x + dx] - Sxy[y + dy][x + dx] ** 2;
              const trace2 = Sxx[y + dy][x + dx] + Syy[y + dy][x + dx];
              const R2 = det2 - k * trace2 * trace2;
              if (R2 > R) isMax = false;
            }
          }
        }

        if (isMax) {
          corners.push({ x, y, strength: R });
        }
      }
    }
  }

  // Sort by strength
  corners.sort((a, b) => b.strength - a.strength);

  return corners.slice(0, 50);
}

// ============================================================================
// IMAGE TO ASCII
// ============================================================================

function imageToAscii(img: GrayscaleImage, width: number = 60): string {
  const chars = ' .:-=+*#%@';
  const height = img.length;
  const imgWidth = img[0].length;

  const scaleX = imgWidth / width;
  const scaleY = scaleX * 2; // ASCII chars are taller than wide
  const scaledHeight = Math.floor(height / scaleY);

  const lines: string[] = [];

  for (let y = 0; y < scaledHeight; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const value = getPixelSafe(img, srcX, srcY);
      const charIndex = Math.floor((value / 255) * (chars.length - 1));
      line += chars[charIndex];
    }
    lines.push(line);
  }

  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const houghVisionTool: UnifiedTool = {
  name: 'hough_vision',
  description: `Computer vision primitives: edge detection, Hough transform, corner detection.

Operations:

Edge Detection:
- sobel: Sobel edge detection with gradient magnitude/direction
- canny: Canny edge detection with non-max suppression

Hough Transform:
- hough_lines: Detect lines using Hough transform
- hough_circles: Detect circles using Hough transform

Corner Detection:
- harris: Harris corner detection

Demo:
- create_test: Create test image with shapes
- detect_all: Run full detection pipeline

This tool implements classical computer vision algorithms for educational purposes.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['sobel', 'canny', 'hough_lines', 'hough_circles', 'harris', 'create_test', 'detect_all'],
        description: 'Vision operation',
      },
      width: { type: 'number', description: 'Image width' },
      height: { type: 'number', description: 'Image height' },
      low_threshold: { type: 'number', description: 'Canny low threshold' },
      high_threshold: { type: 'number', description: 'Canny high threshold' },
      min_radius: { type: 'number', description: 'Minimum circle radius' },
      max_radius: { type: 'number', description: 'Maximum circle radius' },
      shapes: {
        type: 'string',
        description: 'Shapes to draw as JSON array [{type, x1, y1, x2, y2, cx, cy, radius}]',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeHoughVision(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'create_test': {
        const width = args.width || 80;
        const height = args.height || 60;
        const img = createImage(width, height);

        // Draw default shapes or custom
        const shapes = args.shapes || [
          { type: 'line', x1: 10, y1: 10, x2: 70, y2: 50 },
          { type: 'line', x1: 10, y1: 50, x2: 70, y2: 10 },
          { type: 'circle', cx: 40, cy: 30, radius: 15 },
        ];

        for (const shape of shapes) {
          if (shape.type === 'line') {
            drawLine(img, shape.x1, shape.y1, shape.x2, shape.y2);
          } else if (shape.type === 'circle') {
            drawCircle(img, shape.cx, shape.cy, shape.radius);
          }
        }

        result = {
          operation: 'create_test',
          dimensions: { width, height },
          shapes,
          image_ascii: imageToAscii(img, 60),
          note: 'Test image created. Use other operations to detect features.',
        };
        break;
      }

      case 'sobel': {
        const width = args.width || 60;
        const height = args.height || 40;
        const img = createImage(width, height);

        // Create test image
        drawLine(img, 10, 10, 50, 30);
        drawLine(img, 10, 30, 50, 10);

        const edges = sobelEdgeDetection(img);

        result = {
          operation: 'sobel',
          input_ascii: imageToAscii(img, 50),
          edge_count: edges.edges.length,
          edge_magnitude_ascii: imageToAscii(edges.magnitude, 50),
          sample_edges: edges.edges.slice(0, 10).map((e) => ({
            position: `(${e.x}, ${e.y})`,
            magnitude: Math.round(e.magnitude),
            direction_degrees: Math.round((e.direction * 180) / Math.PI),
          })),
          explanation: 'Sobel operator detects edges by computing image gradients in x and y directions',
        };
        break;
      }

      case 'canny': {
        const width = args.width || 60;
        const height = args.height || 40;
        const lowThreshold = args.low_threshold || 50;
        const highThreshold = args.high_threshold || 100;

        const img = createImage(width, height);
        drawLine(img, 10, 10, 50, 30);
        drawCircle(img, 30, 20, 10);

        const edges = cannyEdgeDetection(img, lowThreshold, highThreshold);

        result = {
          operation: 'canny',
          parameters: { low_threshold: lowThreshold, high_threshold: highThreshold },
          input_ascii: imageToAscii(img, 50),
          output_ascii: imageToAscii(edges, 50),
          steps: [
            '1. Gaussian blur to reduce noise',
            '2. Sobel gradient calculation',
            '3. Non-maximum suppression (thin edges)',
            '4. Double threshold and hysteresis',
          ],
        };
        break;
      }

      case 'hough_lines': {
        const width = args.width || 80;
        const height = args.height || 60;

        const img = createImage(width, height);
        // Draw lines at different angles
        drawLine(img, 10, 10, 70, 10); // Horizontal
        drawLine(img, 10, 10, 10, 50); // Vertical
        drawLine(img, 10, 50, 70, 10); // Diagonal

        const edges = cannyEdgeDetection(img);
        const { lines } = houghLineTransform(edges);

        result = {
          operation: 'hough_lines',
          input_ascii: imageToAscii(img, 50),
          edge_ascii: imageToAscii(edges, 50),
          detected_lines: lines.map((l) => ({
            rho: Math.round(l.rho),
            theta_degrees: Math.round((l.theta * 180) / Math.PI),
            votes: l.votes,
            endpoints: `(${l.x1},${l.y1}) to (${l.x2},${l.y2})`,
          })),
          explanation: [
            'Hough Line Transform:',
            '1. Each edge point votes for all lines passing through it',
            '2. Lines are parameterized as r = x·cos(θ) + y·sin(θ)',
            '3. Peaks in accumulator space indicate detected lines',
          ],
        };
        break;
      }

      case 'hough_circles': {
        const width = args.width || 80;
        const height = args.height || 60;
        const minRadius = args.min_radius || 8;
        const maxRadius = args.max_radius || 20;

        const img = createImage(width, height);
        // Draw circles
        drawCircle(img, 25, 25, 12);
        drawCircle(img, 55, 35, 15);

        const edges = cannyEdgeDetection(img);
        const circles = houghCircleTransform(edges, minRadius, maxRadius);

        result = {
          operation: 'hough_circles',
          input_ascii: imageToAscii(img, 50),
          edge_ascii: imageToAscii(edges, 50),
          parameters: { min_radius: minRadius, max_radius: maxRadius },
          detected_circles: circles.map((c) => ({
            center: `(${c.x}, ${c.y})`,
            radius: c.radius,
            votes: c.votes,
          })),
          explanation: [
            'Hough Circle Transform:',
            '1. For each radius r, each edge point votes in a circle',
            '2. Center candidates accumulate votes',
            '3. Peaks indicate circle centers',
          ],
        };
        break;
      }

      case 'harris': {
        const width = args.width || 60;
        const height = args.height || 40;

        const img = createImage(width, height);
        // Draw a rectangle (has corners)
        drawLine(img, 15, 10, 45, 10);
        drawLine(img, 45, 10, 45, 30);
        drawLine(img, 45, 30, 15, 30);
        drawLine(img, 15, 30, 15, 10);

        const corners = harrisCornerDetection(img);

        result = {
          operation: 'harris',
          input_ascii: imageToAscii(img, 50),
          detected_corners: corners.slice(0, 10).map((c) => ({
            position: `(${c.x}, ${c.y})`,
            strength: Math.round(c.strength),
          })),
          total_corners: corners.length,
          explanation: [
            'Harris Corner Detection:',
            '1. Compute image gradients Ix, Iy',
            '2. Build structure tensor M from gradient products',
            '3. Compute R = det(M) - k·trace(M)²',
            '4. Corners have large positive R values',
          ],
        };
        break;
      }

      case 'detect_all': {
        const width = args.width || 80;
        const height = args.height || 60;

        const img = createImage(width, height);
        // Complex scene
        drawLine(img, 10, 15, 70, 15);
        drawLine(img, 10, 45, 70, 45);
        drawCircle(img, 40, 30, 12);
        // Rectangle
        drawLine(img, 55, 20, 70, 20);
        drawLine(img, 70, 20, 70, 40);
        drawLine(img, 70, 40, 55, 40);
        drawLine(img, 55, 40, 55, 20);

        const edges = cannyEdgeDetection(img);
        const { lines } = houghLineTransform(edges);
        const circles = houghCircleTransform(edges, 8, 20);
        const corners = harrisCornerDetection(img);

        result = {
          operation: 'detect_all',
          input_image: imageToAscii(img, 60),
          edge_image: imageToAscii(edges, 60),
          detections: {
            lines: lines.slice(0, 5).map((l) => ({
              theta: Math.round((l.theta * 180) / Math.PI),
              rho: Math.round(l.rho),
              votes: l.votes,
            })),
            circles: circles.slice(0, 3).map((c) => ({
              center: `(${c.x},${c.y})`,
              radius: c.radius,
            })),
            corners: corners.slice(0, 5).map((c) => ({
              position: `(${c.x},${c.y})`,
              strength: Math.round(c.strength),
            })),
          },
          summary: {
            lines_found: lines.length,
            circles_found: circles.length,
            corners_found: corners.length,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isHoughVisionAvailable(): boolean {
  return true;
}
