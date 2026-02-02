/**
 * CONTOUR-DETECTION TOOL
 * Image contour detection using edge tracing algorithms
 * Supports boundary tracing, contour analysis, and shape descriptors
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const contourdetectionTool: UnifiedTool = {
  name: 'contour_detection',
  description: 'Image contour detection - boundary tracing, shape analysis, Hu moments',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['detect', 'trace', 'analyze', 'moments', 'hierarchy', 'approximate', 'generate', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      image: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' }
        },
        description: 'Binary image as 2D array (0 = background, >0 = foreground)'
      },
      method: {
        type: 'string',
        enum: ['moore', 'radial', 'square', 'pavlidis'],
        description: 'Contour tracing method'
      },
      mode: {
        type: 'string',
        enum: ['external', 'all', 'tree'],
        description: 'Contour retrieval mode'
      },
      approximation: {
        type: 'string',
        enum: ['none', 'simple', 'douglas_peucker'],
        description: 'Contour approximation method'
      },
      epsilon: { type: 'number', description: 'Approximation accuracy for Douglas-Peucker' },
      shape: {
        type: 'string',
        enum: ['circle', 'square', 'triangle', 'star', 'cross', 'ring', 'multiple'],
        description: 'Shape to generate for testing'
      },
      size: { type: 'integer', description: 'Image size for generation' }
    },
    required: ['operation']
  }
};

// Point type
interface Point {
  x: number;
  y: number;
}

// Contour type
interface Contour {
  id: number;
  points: Point[];
  isHole: boolean;
  parentId: number | null;
  children: number[];
  area: number;
  perimeter: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

// Moore neighborhood directions (8-connected, clockwise from east)
const MOORE_DIRECTIONS: Point[] = [
  { x: 1, y: 0 },   // E
  { x: 1, y: 1 },   // SE
  { x: 0, y: 1 },   // S
  { x: -1, y: 1 },  // SW
  { x: -1, y: 0 },  // W
  { x: -1, y: -1 }, // NW
  { x: 0, y: -1 },  // N
  { x: 1, y: -1 }   // NE
];

// Generate test images
function generateTestImage(shape: string, size: number): number[][] {
  const image: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const center = Math.floor(size / 2);
  const radius = Math.floor(size / 3);

  switch (shape) {
    case 'circle':
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center;
          const dy = y - center;
          if (dx * dx + dy * dy <= radius * radius) {
            image[y][x] = 255;
          }
        }
      }
      break;

    case 'square':
      const half = radius;
      for (let y = center - half; y <= center + half; y++) {
        for (let x = center - half; x <= center + half; x++) {
          if (y >= 0 && y < size && x >= 0 && x < size) {
            image[y][x] = 255;
          }
        }
      }
      break;

    case 'triangle':
      for (let y = center - radius; y <= center + radius; y++) {
        const rowFromTop = y - (center - radius);
        const halfWidth = Math.floor(rowFromTop / 2);
        for (let x = center - halfWidth; x <= center + halfWidth; x++) {
          if (y >= 0 && y < size && x >= 0 && x < size) {
            image[y][x] = 255;
          }
        }
      }
      break;

    case 'star':
      // 5-pointed star
      const outerR = radius;
      const innerR = radius * 0.4;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center;
          const dy = y - center;
          const angle = Math.atan2(dy, dx);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const starAngle = ((angle * 5 / Math.PI + 1) % 2 - 1);
          const starR = innerR + (outerR - innerR) * (1 - Math.abs(starAngle));
          if (dist <= starR) {
            image[y][x] = 255;
          }
        }
      }
      break;

    case 'cross':
      const thickness = Math.floor(radius / 2);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const inVertical = Math.abs(x - center) <= thickness && Math.abs(y - center) <= radius;
          const inHorizontal = Math.abs(y - center) <= thickness && Math.abs(x - center) <= radius;
          if (inVertical || inHorizontal) {
            image[y][x] = 255;
          }
        }
      }
      break;

    case 'ring':
      const outerRadius = radius;
      const innerRadius = radius * 0.5;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center;
          const dy = y - center;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= outerRadius * outerRadius && dist2 >= innerRadius * innerRadius) {
            image[y][x] = 255;
          }
        }
      }
      break;

    case 'multiple':
      // Multiple shapes
      const r = Math.floor(size / 6);
      // Circle in top-left
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - size / 4;
          const dy = y - size / 4;
          if (dx * dx + dy * dy <= r * r) {
            image[y][x] = 255;
          }
        }
      }
      // Square in top-right
      for (let y = Math.floor(size / 4) - r; y <= Math.floor(size / 4) + r; y++) {
        for (let x = Math.floor(3 * size / 4) - r; x <= Math.floor(3 * size / 4) + r; x++) {
          if (y >= 0 && y < size && x >= 0 && x < size) {
            image[y][x] = 255;
          }
        }
      }
      // Triangle in bottom
      for (let y = Math.floor(3 * size / 4) - r; y <= Math.floor(3 * size / 4) + r; y++) {
        const rowFromTop = y - (Math.floor(3 * size / 4) - r);
        const halfWidth = Math.floor(rowFromTop / 2);
        for (let x = Math.floor(size / 2) - halfWidth; x <= Math.floor(size / 2) + halfWidth; x++) {
          if (y >= 0 && y < size && x >= 0 && x < size) {
            image[y][x] = 255;
          }
        }
      }
      break;

    default:
      // Default to circle
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center;
          const dy = y - center;
          if (dx * dx + dy * dy <= radius * radius) {
            image[y][x] = 255;
          }
        }
      }
  }

  return image;
}

// Moore-Neighbor boundary tracing
function mooreTrace(image: number[][], startX: number, startY: number, visited: Set<string>): Point[] {
  const height = image.length;
  const width = image[0].length;
  const contour: Point[] = [];

  const isValid = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height;

  const isForeground = (x: number, y: number) =>
    isValid(x, y) && image[y][x] > 0;

  // Find starting direction (enter from left)
  let dirIndex = 4; // Start looking from West

  let x = startX;
  let y = startY;
  let startingPoint = true;

  do {
    contour.push({ x, y });
    visited.add(`${x},${y}`);

    // Search for next boundary pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (dirIndex + i) % 8;
      const dx = MOORE_DIRECTIONS[checkDir].x;
      const dy = MOORE_DIRECTIONS[checkDir].y;
      const nx = x + dx;
      const ny = y + dy;

      if (isForeground(nx, ny)) {
        x = nx;
        y = ny;
        // Backtrack direction (opposite + 1, then -2 for 8-connected)
        dirIndex = (checkDir + 5) % 8;
        found = true;
        break;
      }
    }

    if (!found) break;

    // Check if we're back at start
    if (x === startX && y === startY && !startingPoint) {
      break;
    }
    startingPoint = false;

  } while (contour.length < width * height); // Safety limit

  return contour;
}

// Square tracing algorithm (simpler 4-connected)
function squareTrace(image: number[][], startX: number, startY: number, visited: Set<string>): Point[] {
  const height = image.length;
  const width = image[0].length;
  const contour: Point[] = [];

  // 4-connected directions (clockwise: E, S, W, N)
  const dirs: Point[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 }
  ];

  const isValid = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height;

  const isForeground = (x: number, y: number) =>
    isValid(x, y) && image[y][x] > 0;

  let x = startX;
  let y = startY;
  let dir = 0; // Start facing East

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const startKey = `${x},${y}`;
  let firstMove = true;

  while (contour.length < width * height) {
    const key = `${x},${y}`;
    contour.push({ x, y });
    visited.add(key);

    // Turn right
    dir = (dir + 1) % 4;

    // Find next pixel
    for (let i = 0; i < 4; i++) {
      const checkDir = (dir + 4 - i) % 4;
      const nx = x + dirs[checkDir].x;
      const ny = y + dirs[checkDir].y;

      if (isForeground(nx, ny)) {
        x = nx;
        y = ny;
        dir = checkDir;
        break;
      }
    }

    if (!firstMove && x === startX && y === startY) {
      break;
    }
    firstMove = false;
  }

  return contour;
}

// Find all contours in image
function findContours(image: number[][], method: string): Contour[] {
  const height = image.length;
  const width = image[0].length;
  const contours: Contour[] = [];
  const visited = new Set<string>();

  // Scan image for boundary pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (image[y][x] > 0 && !visited.has(`${x},${y}`)) {
        // Check if it's a boundary pixel (has at least one background neighbor)
        let isBoundary = false;
        for (const dir of MOORE_DIRECTIONS) {
          const nx = x + dir.x;
          const ny = y + dir.y;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height || image[ny][nx] === 0) {
            isBoundary = true;
            break;
          }
        }

        if (isBoundary) {
          let points: Point[];

          if (method === 'square') {
            points = squareTrace(image, x, y, visited);
          } else {
            points = mooreTrace(image, x, y, visited);
          }

          if (points.length >= 3) {
            const contour = createContour(contours.length, points, false);
            contours.push(contour);
          }
        }
      }
    }
  }

  return contours;
}

// Create contour object with properties
function createContour(id: number, points: Point[], isHole: boolean): Contour {
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  // Calculate area using shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  area = Math.abs(area) / 2;

  // Calculate perimeter
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return {
    id,
    points,
    isHole,
    parentId: null,
    children: [],
    area,
    perimeter,
    boundingBox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }
  };
}

// Douglas-Peucker contour approximation
function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

// Perpendicular distance from point to line
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);

  if (mag === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
    );
  }

  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  const closestX = lineStart.x + u * dx;
  const closestY = lineStart.y + u * dy;

  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

// Calculate image moments
function calculateMoments(contour: Contour): object {
  const points = contour.points;

  // Raw moments
  let m00 = 0, m10 = 0, m01 = 0, m20 = 0, m11 = 0, m02 = 0, m30 = 0, m21 = 0, m12 = 0, m03 = 0;

  // Using contour points (area-based moments would require filled region)
  for (const p of points) {
    const x = p.x;
    const y = p.y;
    m00 += 1;
    m10 += x;
    m01 += y;
    m20 += x * x;
    m11 += x * y;
    m02 += y * y;
    m30 += x * x * x;
    m21 += x * x * y;
    m12 += x * y * y;
    m03 += y * y * y;
  }

  // Centroid
  const cx = m10 / m00;
  const cy = m01 / m00;

  // Central moments
  const mu00 = m00;
  const mu20 = m20 - cx * m10;
  const mu11 = m11 - cx * m01;
  const mu02 = m02 - cy * m01;
  const mu30 = m30 - 3 * cx * m20 + 2 * cx * cx * m10;
  const mu21 = m21 - 2 * cx * m11 - cy * m20 + 2 * cx * cx * m01;
  const mu12 = m12 - 2 * cy * m11 - cx * m02 + 2 * cy * cy * m10;
  const mu03 = m03 - 3 * cy * m02 + 2 * cy * cy * m01;

  // Normalized central moments
  const n20 = mu20 / Math.pow(mu00, 2);
  const n11 = mu11 / Math.pow(mu00, 2);
  const n02 = mu02 / Math.pow(mu00, 2);
  const n30 = mu30 / Math.pow(mu00, 2.5);
  const n21 = mu21 / Math.pow(mu00, 2.5);
  const n12 = mu12 / Math.pow(mu00, 2.5);
  const n03 = mu03 / Math.pow(mu00, 2.5);

  // Hu moments (first 4)
  const hu1 = n20 + n02;
  const hu2 = (n20 - n02) ** 2 + 4 * n11 ** 2;
  const hu3 = (n30 - 3 * n12) ** 2 + (3 * n21 - n03) ** 2;
  const hu4 = (n30 + n12) ** 2 + (n21 + n03) ** 2;

  return {
    raw: { m00, m10, m01, m20, m11, m02 },
    centroid: { x: cx.toFixed(2), y: cy.toFixed(2) },
    central: {
      mu00: mu00.toFixed(2),
      mu20: mu20.toFixed(2),
      mu11: mu11.toFixed(2),
      mu02: mu02.toFixed(2)
    },
    normalized: {
      n20: n20.toFixed(6),
      n11: n11.toFixed(6),
      n02: n02.toFixed(6)
    },
    hu_moments: {
      h1: hu1.toFixed(6),
      h2: hu2.toFixed(6),
      h3: hu3.toFixed(6),
      h4: hu4.toFixed(6)
    }
  };
}

// Calculate shape descriptors
function analyzeShape(contour: Contour): object {
  const area = contour.area;
  const perimeter = contour.perimeter;
  const bbox = contour.boundingBox;

  // Circularity (1.0 for perfect circle)
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

  // Aspect ratio
  const aspectRatio = bbox.width / bbox.height;

  // Extent (ratio of contour area to bounding box area)
  const extent = area / (bbox.width * bbox.height);

  // Solidity would require convex hull (simplified here)
  // Equivalent diameter
  const equivalentDiameter = Math.sqrt(4 * area / Math.PI);

  // Compactness
  const compactness = perimeter * perimeter / area;

  return {
    area: area.toFixed(2),
    perimeter: perimeter.toFixed(2),
    bounding_box: bbox,
    circularity: circularity.toFixed(4),
    aspect_ratio: aspectRatio.toFixed(4),
    extent: extent.toFixed(4),
    equivalent_diameter: equivalentDiameter.toFixed(2),
    compactness: compactness.toFixed(4),
    shape_estimate: estimateShape(circularity, aspectRatio, extent)
  };
}

// Estimate shape type from descriptors
function estimateShape(circularity: number, aspectRatio: number, extent: number): string {
  if (circularity > 0.85) return 'circle';
  if (extent > 0.9 && Math.abs(aspectRatio - 1) < 0.2) return 'square';
  if (extent > 0.9) return 'rectangle';
  if (extent > 0.4 && extent < 0.6) return 'triangle';
  if (circularity < 0.5) return 'star or complex';
  return 'irregular';
}

export async function executecontourdetection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'detect': {
        let image = args.image;
        if (!image) {
          const shape = args.shape || 'circle';
          const size = args.size || 50;
          image = generateTestImage(shape, size);
        }

        const method = args.method || 'moore';
        const contours = findContours(image, method);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect',
            method,
            image_size: `${image[0].length}x${image.length}`,
            num_contours: contours.length,
            contours: contours.map(c => ({
              id: c.id,
              num_points: c.points.length,
              area: c.area.toFixed(2),
              perimeter: c.perimeter.toFixed(2),
              bounding_box: c.boundingBox,
              first_points: c.points.slice(0, 10).map(p => `(${p.x},${p.y})`)
            }))
          }, null, 2)
        };
      }

      case 'trace': {
        let image = args.image;
        if (!image) {
          const shape = args.shape || 'square';
          const size = args.size || 30;
          image = generateTestImage(shape, size);
        }

        const method = args.method || 'moore';
        const contours = findContours(image, method);

        // Apply approximation if requested
        let processedContours = contours;
        if (args.approximation && args.approximation !== 'none') {
          const epsilon = args.epsilon || 1.0;
          processedContours = contours.map(c => ({
            ...c,
            points: args.approximation === 'douglas_peucker'
              ? douglasPeucker(c.points, epsilon)
              : c.points.filter((_, i) => i % 2 === 0) // Simple: every other point
          }));
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'trace',
            method,
            approximation: args.approximation || 'none',
            epsilon: args.epsilon,
            num_contours: processedContours.length,
            contours: processedContours.map(c => ({
              id: c.id,
              original_points: contours[c.id].points.length,
              simplified_points: c.points.length,
              compression_ratio: (1 - c.points.length / contours[c.id].points.length).toFixed(2),
              points: c.points.map(p => [p.x, p.y])
            }))
          }, null, 2)
        };
      }

      case 'analyze': {
        let image = args.image;
        if (!image) {
          const shape = args.shape || 'circle';
          const size = args.size || 50;
          image = generateTestImage(shape, size);
        }

        const contours = findContours(image, 'moore');

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            num_contours: contours.length,
            analysis: contours.map(c => ({
              contour_id: c.id,
              ...analyzeShape(c)
            }))
          }, null, 2)
        };
      }

      case 'moments': {
        let image = args.image;
        if (!image) {
          const shape = args.shape || 'circle';
          const size = args.size || 50;
          image = generateTestImage(shape, size);
        }

        const contours = findContours(image, 'moore');

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'moments',
            description: 'Image moments and Hu invariants for shape matching',
            num_contours: contours.length,
            moments: contours.map(c => ({
              contour_id: c.id,
              num_points: c.points.length,
              ...calculateMoments(c)
            })),
            usage: 'Hu moments are invariant to translation, scale, and rotation - useful for shape matching'
          }, null, 2)
        };
      }

      case 'approximate': {
        let image = args.image;
        if (!image) {
          const shape = args.shape || 'circle';
          const size = args.size || 50;
          image = generateTestImage(shape, size);
        }

        const contours = findContours(image, 'moore');
        const epsilon = args.epsilon || 2.0;

        const results = contours.map(c => {
          const simplified = douglasPeucker(c.points, epsilon);
          return {
            contour_id: c.id,
            original_points: c.points.length,
            simplified_points: simplified.length,
            reduction: ((1 - simplified.length / c.points.length) * 100).toFixed(1) + '%',
            original_sample: c.points.slice(0, 5).map(p => [p.x, p.y]),
            simplified: simplified.map(p => [p.x, p.y])
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'approximate',
            method: 'Douglas-Peucker',
            epsilon,
            results
          }, null, 2)
        };
      }

      case 'generate': {
        const shape = args.shape || 'circle';
        const size = args.size || 30;
        const image = generateTestImage(shape, size);

        // Create ASCII visualization
        const ascii = image.map(row =>
          row.map(v => v > 0 ? '█' : '·').join('')
        );

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'generate',
            shape,
            size: `${size}x${size}`,
            visualization: ascii,
            raw_image: image,
            note: 'Use this image with other operations (detect, analyze, etc.)'
          }, null, 2)
        };
      }

      case 'demo': {
        // Compare different shapes
        const shapes = ['circle', 'square', 'triangle', 'star'];
        const size = 40;

        const results = shapes.map(shape => {
          const image = generateTestImage(shape, size);
          const contours = findContours(image, 'moore');
          const contour = contours[0];

          if (!contour) return { shape, error: 'No contour found' };

          const analysis = analyzeShape(contour);
          const moments = calculateMoments(contour);

          return {
            shape,
            num_points: contour.points.length,
            area: analysis.area,
            perimeter: analysis.perimeter,
            circularity: analysis.circularity,
            extent: analysis.extent,
            detected_as: analysis.shape_estimate,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hu1: (moments as any).hu_moments.h1
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'Shape analysis comparison',
            image_size: `${size}x${size}`,
            shapes: results,
            interpretation: {
              circularity: 'Closer to 1.0 = more circular',
              extent: 'Ratio of area to bounding box',
              hu1: 'First Hu moment - shape descriptor'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'contour_detection',
            description: 'Image contour detection and shape analysis',
            algorithms: {
              moore: {
                name: 'Moore-Neighbor Tracing',
                connectivity: '8-connected',
                description: 'Follows boundary using Moore neighborhood'
              },
              square: {
                name: 'Square Tracing',
                connectivity: '4-connected',
                description: 'Simpler algorithm for 4-connected boundaries'
              },
              douglas_peucker: {
                name: 'Douglas-Peucker Approximation',
                description: 'Reduces points while preserving shape'
              }
            },
            shape_descriptors: {
              circularity: '4πA/P² - 1.0 for circle',
              aspect_ratio: 'Width/Height of bounding box',
              extent: 'Area / Bounding box area',
              compactness: 'P²/A'
            },
            moments: {
              raw: 'Basic spatial moments',
              central: 'Translation invariant',
              normalized: 'Scale invariant',
              hu: 'Rotation, scale, translation invariant'
            },
            operations: {
              detect: 'Find all contours in image',
              trace: 'Trace contours with optional approximation',
              analyze: 'Calculate shape descriptors',
              moments: 'Calculate image moments and Hu invariants',
              approximate: 'Simplify contours using Douglas-Peucker',
              generate: 'Generate test shapes'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                description: 'Detect contours in generated circle',
                call: {
                  operation: 'detect',
                  shape: 'circle',
                  size: 50
                }
              },
              {
                description: 'Analyze shape properties',
                call: {
                  operation: 'analyze',
                  shape: 'star',
                  size: 60
                }
              },
              {
                description: 'Calculate Hu moments',
                call: {
                  operation: 'moments',
                  shape: 'triangle',
                  size: 50
                }
              },
              {
                description: 'Approximate contour',
                call: {
                  operation: 'approximate',
                  shape: 'circle',
                  size: 50,
                  epsilon: 3.0
                }
              },
              {
                description: 'Generate and visualize shape',
                call: {
                  operation: 'generate',
                  shape: 'ring',
                  size: 30
                }
              },
              {
                description: 'Compare multiple shapes',
                call: {
                  operation: 'demo'
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscontourdetectionAvailable(): boolean {
  return true;
}
