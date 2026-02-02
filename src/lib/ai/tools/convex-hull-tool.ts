/**
 * CONVEX-HULL TOOL
 * Computational geometry - Convex hull algorithms
 * Graham scan, Jarvis march, and QuickHull implementations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const convexhullTool: UnifiedTool = {
  name: 'convex_hull',
  description: 'Convex hull computation (Graham scan, Jarvis march, QuickHull)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'compute', 'compare', 'area', 'perimeter', 'contains', 'demonstrate'],
        description: 'Operation to perform'
      },
      points: { type: 'array', description: 'Array of [x, y] points' },
      algorithm: { type: 'string', enum: ['graham_scan', 'jarvis_march', 'quickhull', 'monotone_chain'], description: 'Algorithm to use' },
      query_point: { type: 'array', description: 'Point to check containment [x, y]' }
    },
    required: ['operation']
  }
};

// ===== TYPE DEFINITIONS =====

interface Point {
  x: number;
  y: number;
}

// ===== GEOMETRIC PRIMITIVES =====

// Cross product of vectors OA and OB (O is origin)
function cross(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

// Distance between two points
function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Distance from point to line (signed)
function pointLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  return (A * D - B * C) / Math.sqrt(lenSq);
}

// Polar angle from point O to point P
function polarAngle(O: Point, P: Point): number {
  return Math.atan2(P.y - O.y, P.x - O.x);
}

// ===== CONVEX HULL ALGORITHMS =====

// Graham Scan - O(n log n)
function grahamScan(points: Point[]): { hull: Point[]; steps: number } {
  if (points.length < 3) return { hull: [...points], steps: 0 };

  let steps = 0;

  // Find the lowest point (and leftmost if tied)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    steps++;
    if (points[i].y < points[start].y ||
        (points[i].y === points[start].y && points[i].x < points[start].x)) {
      start = i;
    }
  }

  const pivot = points[start];

  // Sort points by polar angle with respect to pivot
  const sorted = points.filter((_, i) => i !== start).sort((a, b) => {
    steps++;
    const angleA = polarAngle(pivot, a);
    const angleB = polarAngle(pivot, b);
    if (angleA !== angleB) return angleA - angleB;
    // If same angle, closer point first
    return distance(pivot, a) - distance(pivot, b);
  });

  // Build hull using stack
  const hull: Point[] = [pivot];

  for (const point of sorted) {
    steps++;
    // Remove points that make clockwise turn
    while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
      steps++;
    }
    hull.push(point);
  }

  return { hull, steps };
}

// Jarvis March (Gift Wrapping) - O(nh) where h is hull size
function jarvisMarch(points: Point[]): { hull: Point[]; steps: number } {
  if (points.length < 3) return { hull: [...points], steps: 0 };

  let steps = 0;

  // Find leftmost point
  let leftmost = 0;
  for (let i = 1; i < points.length; i++) {
    steps++;
    if (points[i].x < points[leftmost].x ||
        (points[i].x === points[leftmost].x && points[i].y < points[leftmost].y)) {
      leftmost = i;
    }
  }

  const hull: Point[] = [];
  let current = leftmost;

  do {
    hull.push(points[current]);
    let next = 0;

    for (let i = 1; i < points.length; i++) {
      steps++;
      if (next === current) {
        next = i;
      } else {
        const crossProduct = cross(points[current], points[next], points[i]);
        if (crossProduct < 0 ||
            (crossProduct === 0 && distance(points[current], points[i]) > distance(points[current], points[next]))) {
          next = i;
        }
      }
    }

    current = next;
  } while (current !== leftmost && hull.length < points.length);

  return { hull, steps };
}

// QuickHull - O(n log n) average, O(n²) worst
function quickHull(points: Point[]): { hull: Point[]; steps: number } {
  if (points.length < 3) return { hull: [...points], steps: 0 };

  let steps = 0;

  // Find leftmost and rightmost points
  let minIdx = 0, maxIdx = 0;
  for (let i = 1; i < points.length; i++) {
    steps++;
    if (points[i].x < points[minIdx].x) minIdx = i;
    if (points[i].x > points[maxIdx].x) maxIdx = i;
  }

  const minPoint = points[minIdx];
  const maxPoint = points[maxIdx];

  // Divide points into upper and lower sets
  const upperSet: Point[] = [];
  const lowerSet: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    steps++;
    if (i === minIdx || i === maxIdx) continue;

    const crossProduct = cross(minPoint, maxPoint, points[i]);
    if (crossProduct > 0) {
      upperSet.push(points[i]);
    } else if (crossProduct < 0) {
      lowerSet.push(points[i]);
    }
  }

  // Recursively find hull points
  const hull: Point[] = [];

  function findHull(set: Point[], A: Point, B: Point): void {
    if (set.length === 0) return;

    // Find farthest point from line AB
    let maxDist = -Infinity;
    let maxPoint: Point | null = null;

    for (const point of set) {
      steps++;
      const dist = Math.abs(pointLineDistance(point, A, B));
      if (dist > maxDist) {
        maxDist = dist;
        maxPoint = point;
      }
    }

    if (!maxPoint) return;

    // Points to the left of A->maxPoint
    const leftOfAM: Point[] = [];
    // Points to the left of maxPoint->B
    const leftOfMB: Point[] = [];

    for (const point of set) {
      steps++;
      if (point === maxPoint) continue;

      if (cross(A, maxPoint, point) > 0) {
        leftOfAM.push(point);
      } else if (cross(maxPoint, B, point) > 0) {
        leftOfMB.push(point);
      }
    }

    findHull(leftOfAM, A, maxPoint);
    hull.push(maxPoint);
    findHull(leftOfMB, maxPoint, B);
  }

  hull.push(minPoint);
  findHull(upperSet, minPoint, maxPoint);
  hull.push(maxPoint);
  findHull(lowerSet, maxPoint, minPoint);

  return { hull, steps };
}

// Monotone Chain (Andrew's algorithm) - O(n log n)
function monotoneChain(points: Point[]): { hull: Point[]; steps: number } {
  if (points.length < 3) return { hull: [...points], steps: 0 };

  let steps = 0;

  // Sort points by x, then by y
  const sorted = [...points].sort((a, b) => {
    steps++;
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  // Build lower hull
  const lower: Point[] = [];
  for (const point of sorted) {
    steps++;
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
      steps++;
    }
    lower.push(point);
  }

  // Build upper hull
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    steps++;
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
      steps++;
    }
    upper.push(point);
  }

  // Remove last point of each half (it's duplicated at the beginning of the other)
  lower.pop();
  upper.pop();

  return { hull: [...lower, ...upper], steps };
}

// ===== HULL PROPERTIES =====

// Calculate area of convex hull using shoelace formula
function hullArea(hull: Point[]): number {
  if (hull.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    area += hull[i].x * hull[j].y;
    area -= hull[j].x * hull[i].y;
  }

  return Math.abs(area) / 2;
}

// Calculate perimeter of convex hull
function hullPerimeter(hull: Point[]): number {
  if (hull.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    perimeter += distance(hull[i], hull[j]);
  }

  return perimeter;
}

// Check if point is inside convex hull
function pointInHull(point: Point, hull: Point[]): boolean {
  if (hull.length < 3) return false;

  // Check if point is on the same side of all edges
  let sign: number | null = null;

  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const crossProduct = cross(hull[i], hull[j], point);

    if (crossProduct !== 0) {
      const currentSign = crossProduct > 0 ? 1 : -1;
      if (sign === null) {
        sign = currentSign;
      } else if (sign !== currentSign) {
        return false;
      }
    }
  }

  return true;
}

// Calculate centroid of convex hull
function hullCentroid(hull: Point[]): Point {
  if (hull.length === 0) return { x: 0, y: 0 };

  let cx = 0, cy = 0;
  for (const point of hull) {
    cx += point.x;
    cy += point.y;
  }

  return { x: cx / hull.length, y: cy / hull.length };
}

// ===== VISUALIZATION =====

function generateAsciiVisualization(points: Point[], hull: Point[], width: number = 40, height: number = 20): string[] {
  // Find bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Create grid
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Map point to grid coordinates
  const toGrid = (p: Point): { gx: number; gy: number } => ({
    gx: Math.round((p.x - minX) / rangeX * (width - 1)),
    gy: Math.round((maxY - p.y) / rangeY * (height - 1))
  });

  // Mark all points
  for (const p of points) {
    const { gx, gy } = toGrid(p);
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
      grid[gy][gx] = '·';
    }
  }

  // Mark hull points
  const hullSet = new Set(hull.map(p => `${p.x},${p.y}`));
  for (const p of points) {
    if (hullSet.has(`${p.x},${p.y}`)) {
      const { gx, gy } = toGrid(p);
      if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
        grid[gy][gx] = '●';
      }
    }
  }

  return grid.map(row => row.join(''));
}

// ===== SAMPLE DATA =====

function generateRandomPoints(n: number, maxCoord: number = 100): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    points.push({
      x: Math.round(Math.random() * maxCoord * 10) / 10,
      y: Math.round(Math.random() * maxCoord * 10) / 10
    });
  }
  return points;
}

// ===== MAIN EXECUTION =====

export async function executeconvexhull(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'convex_hull',
            description: 'Computes the convex hull of a set of 2D points',
            definition: 'The convex hull is the smallest convex polygon containing all points',
            algorithms: {
              graham_scan: {
                complexity: 'O(n log n)',
                description: 'Sort points by polar angle, then use stack to build hull',
                best_for: 'General purpose, good average performance'
              },
              jarvis_march: {
                complexity: 'O(nh) where h is hull size',
                description: 'Gift wrapping - find next hull point by maximum angle',
                best_for: 'Small output hulls, simple implementation'
              },
              quickhull: {
                complexity: 'O(n log n) average, O(n²) worst',
                description: 'Divide-and-conquer using farthest point',
                best_for: 'Points distributed uniformly'
              },
              monotone_chain: {
                complexity: 'O(n log n)',
                description: 'Sort by x-coordinate, build lower and upper hulls',
                best_for: 'Robust, handles collinear points well'
              }
            },
            applications: [
              'Collision detection in games',
              'Pattern recognition',
              'Image processing',
              'Geographic Information Systems',
              'Robotics path planning'
            ],
            operations: ['info', 'compute', 'compare', 'area', 'perimeter', 'contains', 'demonstrate']
          }, null, 2)
        };
      }

      case 'compute': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(20);
        }

        const algorithm = args.algorithm || 'graham_scan';

        let result: { hull: Point[]; steps: number };
        switch (algorithm) {
          case 'jarvis_march':
            result = jarvisMarch(points);
            break;
          case 'quickhull':
            result = quickHull(points);
            break;
          case 'monotone_chain':
            result = monotoneChain(points);
            break;
          default:
            result = grahamScan(points);
        }

        const area = hullArea(result.hull);
        const perimeter = hullPerimeter(result.hull);
        const centroid = hullCentroid(result.hull);

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm,
            input: {
              point_count: points.length,
              points: points.slice(0, 10).map(p => `(${p.x}, ${p.y})`).join(', ') +
                (points.length > 10 ? ` ... and ${points.length - 10} more` : '')
            },
            result: {
              hull_size: result.hull.length,
              hull_points: result.hull.map(p => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })),
              steps: result.steps
            },
            properties: {
              area: Math.round(area * 100) / 100,
              perimeter: Math.round(perimeter * 100) / 100,
              centroid: { x: Math.round(centroid.x * 100) / 100, y: Math.round(centroid.y * 100) / 100 }
            },
            visualization: generateAsciiVisualization(points, result.hull).join('\n')
          }, null, 2)
        };
      }

      case 'compare': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(50);
        }

        const graham = grahamScan(points);
        const jarvis = jarvisMarch(points);
        const quick = quickHull(points);
        const monotone = monotoneChain(points);

        return {
          toolCallId: id,
          content: JSON.stringify({
            comparison: 'Convex Hull Algorithm Comparison',
            input_size: points.length,
            results: {
              graham_scan: {
                hull_size: graham.hull.length,
                steps: graham.steps,
                complexity: 'O(n log n)'
              },
              jarvis_march: {
                hull_size: jarvis.hull.length,
                steps: jarvis.steps,
                complexity: `O(n·h) = O(${points.length}·${jarvis.hull.length})`
              },
              quickhull: {
                hull_size: quick.hull.length,
                steps: quick.steps,
                complexity: 'O(n log n) avg'
              },
              monotone_chain: {
                hull_size: monotone.hull.length,
                steps: monotone.steps,
                complexity: 'O(n log n)'
              }
            },
            analysis: {
              most_efficient: (() => {
                const results = [
                  { name: 'graham_scan', steps: graham.steps },
                  { name: 'jarvis_march', steps: jarvis.steps },
                  { name: 'quickhull', steps: quick.steps },
                  { name: 'monotone_chain', steps: monotone.steps }
                ];
                return results.sort((a, b) => a.steps - b.steps)[0].name;
              })(),
              hull_verified: graham.hull.length === jarvis.hull.length &&
                           jarvis.hull.length === quick.hull.length &&
                           quick.hull.length === monotone.hull.length
            }
          }, null, 2)
        };
      }

      case 'area': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(15);
        }

        const { hull } = grahamScan(points);
        const area = hullArea(hull);
        const boundingArea = (() => {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
          }
          return (maxX - minX) * (maxY - minY);
        })();

        return {
          toolCallId: id,
          content: JSON.stringify({
            calculation: 'Convex Hull Area',
            method: 'Shoelace formula',
            formula: 'A = (1/2)|Σ(x_i·y_{i+1} - x_{i+1}·y_i)|',
            hull_vertices: hull.length,
            results: {
              hull_area: Math.round(area * 100) / 100,
              bounding_box_area: Math.round(boundingArea * 100) / 100,
              efficiency: `${(area / boundingArea * 100).toFixed(1)}%`,
              description: 'Ratio of hull area to bounding box area'
            }
          }, null, 2)
        };
      }

      case 'perimeter': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(15);
        }

        const { hull } = grahamScan(points);
        const perimeter = hullPerimeter(hull);

        // Calculate edge lengths
        const edges: { from: Point; to: Point; length: number }[] = [];
        for (let i = 0; i < hull.length; i++) {
          const j = (i + 1) % hull.length;
          edges.push({
            from: hull[i],
            to: hull[j],
            length: distance(hull[i], hull[j])
          });
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            calculation: 'Convex Hull Perimeter',
            hull_vertices: hull.length,
            total_perimeter: Math.round(perimeter * 100) / 100,
            edges: edges.map((e, i) => ({
              edge: i + 1,
              from: `(${Math.round(e.from.x * 10) / 10}, ${Math.round(e.from.y * 10) / 10})`,
              to: `(${Math.round(e.to.x * 10) / 10}, ${Math.round(e.to.y * 10) / 10})`,
              length: Math.round(e.length * 100) / 100
            })),
            statistics: {
              min_edge: Math.round(Math.min(...edges.map(e => e.length)) * 100) / 100,
              max_edge: Math.round(Math.max(...edges.map(e => e.length)) * 100) / 100,
              avg_edge: Math.round(perimeter / edges.length * 100) / 100
            }
          }, null, 2)
        };
      }

      case 'contains': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(10);
        }

        const { hull } = grahamScan(points);

        let queryPoint: Point;
        if (args.query_point) {
          queryPoint = Array.isArray(args.query_point)
            ? { x: args.query_point[0], y: args.query_point[1] }
            : args.query_point;
        } else {
          // Generate random query point
          queryPoint = { x: Math.random() * 100, y: Math.random() * 100 };
        }

        const isInside = pointInHull(queryPoint, hull);

        return {
          toolCallId: id,
          content: JSON.stringify({
            calculation: 'Point-in-Hull Test',
            method: 'Cross product sign consistency',
            query_point: { x: Math.round(queryPoint.x * 100) / 100, y: Math.round(queryPoint.y * 100) / 100 },
            hull_vertices: hull.length,
            result: {
              is_inside: isInside,
              description: isInside
                ? 'Point is inside or on the boundary of the convex hull'
                : 'Point is outside the convex hull'
            },
            algorithm: 'Check if point is on same side of all hull edges'
          }, null, 2)
        };
      }

      case 'demonstrate': {
        // Generate sample points
        const samplePoints: Point[] = [
          { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
          { x: 5, y: 5 }, { x: 3, y: 7 }, { x: 7, y: 3 }, { x: 2, y: 2 },
          { x: 8, y: 8 }, { x: 4, y: 6 }, { x: 6, y: 4 }, { x: 5, y: 1 },
          { x: 1, y: 5 }, { x: 9, y: 5 }, { x: 5, y: 9 }
        ];

        const graham = grahamScan(samplePoints);
        const jarvis = jarvisMarch(samplePoints);

        const area = hullArea(graham.hull);
        const perimeter = hullPerimeter(graham.hull);

        // Test containment
        const insidePoint = { x: 5, y: 5 };
        const outsidePoint = { x: 15, y: 15 };

        return {
          toolCallId: id,
          content: JSON.stringify({
            demonstration: 'Convex Hull Algorithms',
            input: {
              points: samplePoints.length,
              description: 'Points including corners of a 10x10 square plus interior points'
            },
            graham_scan: {
              hull: graham.hull.map(p => `(${p.x}, ${p.y})`),
              steps: graham.steps,
              explanation: '1) Find lowest point, 2) Sort by polar angle, 3) Build hull using stack'
            },
            jarvis_march: {
              hull: jarvis.hull.map(p => `(${p.x}, ${p.y})`),
              steps: jarvis.steps,
              explanation: 'Gift wrapping: from each hull point, find the point that makes the smallest angle'
            },
            properties: {
              hull_size: graham.hull.length,
              area: Math.round(area * 100) / 100,
              perimeter: Math.round(perimeter * 100) / 100
            },
            containment_tests: {
              inside_point: { point: insidePoint, result: pointInHull(insidePoint, graham.hull) },
              outside_point: { point: outsidePoint, result: pointInHull(outsidePoint, graham.hull) }
            },
            visualization: generateAsciiVisualization(samplePoints, graham.hull).join('\n'),
            key_insights: [
              'Convex hull is the "rubber band" around the points',
              'Only extreme points appear on the hull',
              'O(n log n) is optimal for comparison-based algorithms',
              'Jarvis march is efficient when output hull is small',
              'Used in collision detection, path planning, and pattern recognition'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            available_operations: ['info', 'compute', 'compare', 'area', 'perimeter', 'contains', 'demonstrate']
          }, null, 2)
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isconvexhullAvailable(): boolean { return true; }
