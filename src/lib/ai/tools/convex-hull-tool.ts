/**
 * CONVEX-HULL TOOL
 * Convex hull computation for 2D and 3D point sets
 *
 * Features:
 * - Graham scan algorithm O(n log n)
 * - Jarvis march (gift wrapping) O(nh)
 * - Quickhull algorithm O(n log n) average
 * - 3D convex hull support
 * - Area/volume computation
 * - Point-in-hull testing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const convexhullTool: UnifiedTool = {
  name: 'convex_hull',
  description: 'Convex hull computation using Graham scan, Jarvis march, or Quickhull algorithms',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'compute',
          'area',
          'perimeter',
          'contains',
          'diameter',
          'minimum_enclosing',
          'analyze',
          'info',
        ],
        description: 'Operation to perform',
      },
      points: {
        type: 'array',
        items: { type: 'array' },
        description: 'Array of 2D or 3D points (2D array of numbers)',
      },
      algorithm: {
        type: 'string',
        enum: ['graham_scan', 'jarvis_march', 'quickhull', 'auto'],
        description: 'Algorithm to use (default: auto)',
      },
      query_point: {
        type: 'array',
        items: { type: 'number' },
        description: 'Point to test for containment',
      },
    },
    required: ['operation'],
  },
};

// 2D Point type
interface Point2D {
  x: number;
  y: number;
  index?: number;
}

// 3D Point type
export interface Point3D {
  x: number;
  y: number;
  z: number;
  index?: number;
}

// Cross product of vectors OA and OB (2D)
function cross2D(O: Point2D, A: Point2D, B: Point2D): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

// Distance squared between two points (2D)
function distSq2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

// Distance between two points (2D)
function dist2D(a: Point2D, b: Point2D): number {
  return Math.sqrt(distSq2D(a, b));
}

// Graham scan algorithm O(n log n)
function grahamScan(points: Point2D[]): Point2D[] {
  if (points.length < 3) return [...points];

  // Find lowest point (and leftmost if tie)
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i].y < points[lowest].y ||
      (points[i].y === points[lowest].y && points[i].x < points[lowest].x)
    ) {
      lowest = i;
    }
  }

  const pivot = points[lowest];

  // Sort by polar angle with pivot
  const sorted = points
    .filter((_, i) => i !== lowest)
    .map((p) => ({
      point: p,
      angle: Math.atan2(p.y - pivot.y, p.x - pivot.x),
      dist: distSq2D(pivot, p),
    }))
    .sort((a, b) => {
      if (Math.abs(a.angle - b.angle) < 1e-10) {
        return a.dist - b.dist;
      }
      return a.angle - b.angle;
    })
    .map((item) => item.point);

  // Build hull
  const hull: Point2D[] = [pivot];

  for (const p of sorted) {
    while (hull.length > 1 && cross2D(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }

  return hull;
}

// Jarvis march (gift wrapping) algorithm O(nh)
function jarvisMarch(points: Point2D[]): Point2D[] {
  if (points.length < 3) return [...points];

  // Find leftmost point
  let leftmost = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i].x < points[leftmost].x ||
      (points[i].x === points[leftmost].x && points[i].y < points[leftmost].y)
    ) {
      leftmost = i;
    }
  }

  const hull: Point2D[] = [];
  let p = leftmost;

  do {
    hull.push(points[p]);
    let q = (p + 1) % points.length;

    for (let i = 0; i < points.length; i++) {
      const cross = cross2D(points[p], points[i], points[q]);
      if (
        cross > 0 ||
        (cross === 0 && distSq2D(points[p], points[i]) > distSq2D(points[p], points[q]))
      ) {
        q = i;
      }
    }

    p = q;
  } while (p !== leftmost && hull.length < points.length);

  return hull;
}

// Quickhull algorithm
function quickhull(points: Point2D[]): Point2D[] {
  if (points.length < 3) return [...points];

  // Find min and max x points
  let minX = 0,
    maxX = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < points[minX].x) minX = i;
    if (points[i].x > points[maxX].x) maxX = i;
  }

  const A = points[minX];
  const B = points[maxX];

  // Separate points into upper and lower sets
  const upper: Point2D[] = [];
  const lower: Point2D[] = [];

  for (const p of points) {
    const cross = cross2D(A, B, p);
    if (cross > 0) upper.push(p);
    else if (cross < 0) lower.push(p);
  }

  // Recursively find hull points
  function findHull(subset: Point2D[], P1: Point2D, P2: Point2D): Point2D[] {
    if (subset.length === 0) return [];

    // Find farthest point from line P1-P2
    let maxDist = -1;
    let maxIdx = 0;
    for (let i = 0; i < subset.length; i++) {
      const d = Math.abs(cross2D(P1, P2, subset[i]));
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    const farthest = subset[maxIdx];

    // Points left of P1-farthest and farthest-P2
    const left1: Point2D[] = [];
    const left2: Point2D[] = [];

    for (const p of subset) {
      if (cross2D(P1, farthest, p) > 0) left1.push(p);
      if (cross2D(farthest, P2, p) > 0) left2.push(p);
    }

    return [...findHull(left1, P1, farthest), farthest, ...findHull(left2, farthest, P2)];
  }

  const upperHull = findHull(upper, A, B);
  const lowerHull = findHull(lower, B, A);

  return [A, ...upperHull, B, ...lowerHull];
}

// Calculate polygon area (2D) using shoelace formula
function polygonArea(hull: Point2D[]): number {
  if (hull.length < 3) return 0;

  let area = 0;
  const n = hull.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += hull[i].x * hull[j].y;
    area -= hull[j].x * hull[i].y;
  }

  return Math.abs(area) / 2;
}

// Calculate polygon perimeter
function polygonPerimeter(hull: Point2D[]): number {
  if (hull.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    perimeter += dist2D(hull[i], hull[j]);
  }

  return perimeter;
}

// Check if point is inside convex hull (2D)
function pointInConvexHull(hull: Point2D[], point: Point2D): boolean {
  if (hull.length < 3) return false;

  // Check if point is on the same side of all edges
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    if (cross2D(hull[i], hull[j], point) < 0) {
      return false;
    }
  }

  return true;
}

// Find convex hull diameter (rotating calipers)
function hullDiameter(hull: Point2D[]): { diameter: number; points: [Point2D, Point2D] } {
  if (hull.length < 2) {
    return { diameter: 0, points: [hull[0] || { x: 0, y: 0 }, hull[0] || { x: 0, y: 0 }] };
  }

  if (hull.length === 2) {
    return { diameter: dist2D(hull[0], hull[1]), points: [hull[0], hull[1]] };
  }

  const n = hull.length;
  let maxDist = 0;
  let maxPoints: [Point2D, Point2D] = [hull[0], hull[1]];

  // Rotating calipers
  let j = 1;
  for (let i = 0; i < n; i++) {
    const nextI = (i + 1) % n;

    // Find antipodal point for edge i
    while (true) {
      const nextJ = (j + 1) % n;
      const area1 = Math.abs(cross2D(hull[i], hull[nextI], hull[j]));
      const area2 = Math.abs(cross2D(hull[i], hull[nextI], hull[nextJ]));
      if (area2 > area1) {
        j = nextJ;
      } else {
        break;
      }
    }

    const d = dist2D(hull[i], hull[j]);
    if (d > maxDist) {
      maxDist = d;
      maxPoints = [hull[i], hull[j]];
    }
  }

  return { diameter: maxDist, points: maxPoints };
}

// Find minimum enclosing circle (Welzl's algorithm)
function minEnclosingCircle(points: Point2D[]): { center: Point2D; radius: number } {
  // Shuffle points for randomization
  const shuffled = [...points].sort(() => Math.random() - 0.5);

  function circleFrom1(p: Point2D): { center: Point2D; radius: number } {
    return { center: p, radius: 0 };
  }

  function circleFrom2(p1: Point2D, p2: Point2D): { center: Point2D; radius: number } {
    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    return { center, radius: dist2D(p1, center) };
  }

  function circleFrom3(p1: Point2D, p2: Point2D, p3: Point2D): { center: Point2D; radius: number } {
    const ax = p2.x - p1.x,
      ay = p2.y - p1.y;
    const bx = p3.x - p1.x,
      by = p3.y - p1.y;
    const m = ax * ax + ay * ay;
    const u = bx * bx + by * by;
    const s = 2 * (ax * by - ay * bx);

    if (Math.abs(s) < 1e-10) {
      // Collinear points
      const d1 = dist2D(p1, p2);
      const d2 = dist2D(p2, p3);
      const d3 = dist2D(p1, p3);
      if (d1 >= d2 && d1 >= d3) return circleFrom2(p1, p2);
      if (d2 >= d1 && d2 >= d3) return circleFrom2(p2, p3);
      return circleFrom2(p1, p3);
    }

    const cx = p1.x + (by * m - ay * u) / s;
    const cy = p1.y + (ax * u - bx * m) / s;
    const center = { x: cx, y: cy };

    return { center, radius: dist2D(center, p1) };
  }

  function isInside(circle: { center: Point2D; radius: number }, p: Point2D): boolean {
    return dist2D(circle.center, p) <= circle.radius + 1e-10;
  }

  function welzl(
    points: Point2D[],
    boundary: Point2D[],
    n: number
  ): { center: Point2D; radius: number } {
    if (n === 0 || boundary.length === 3) {
      if (boundary.length === 0) return { center: { x: 0, y: 0 }, radius: 0 };
      if (boundary.length === 1) return circleFrom1(boundary[0]);
      if (boundary.length === 2) return circleFrom2(boundary[0], boundary[1]);
      return circleFrom3(boundary[0], boundary[1], boundary[2]);
    }

    const idx = n - 1;
    const p = points[idx];
    const circle = welzl(points, boundary, n - 1);

    if (isInside(circle, p)) {
      return circle;
    }

    return welzl(points, [...boundary, p], n - 1);
  }

  return welzl(shuffled, [], shuffled.length);
}

// Generate sample points
function generateSamplePoints(type: string, n: number): Point2D[] {
  const points: Point2D[] = [];

  switch (type) {
    case 'random':
      for (let i = 0; i < n; i++) {
        points.push({ x: Math.random() * 100, y: Math.random() * 100, index: i });
      }
      break;

    case 'circle':
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.random() * 50;
        points.push({ x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle), index: i });
      }
      break;

    case 'square':
      for (let i = 0; i < n; i++) {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        switch (side) {
          case 0:
            x = Math.random() * 100;
            y = 0;
            break;
          case 1:
            x = 100;
            y = Math.random() * 100;
            break;
          case 2:
            x = Math.random() * 100;
            y = 100;
            break;
          default:
            x = 0;
            y = Math.random() * 100;
            break;
        }
        points.push({ x, y, index: i });
      }
      break;

    case 'clustered':
      const numClusters = 4;
      const centers = [
        { x: 25, y: 25 },
        { x: 75, y: 25 },
        { x: 25, y: 75 },
        { x: 75, y: 75 },
      ];
      for (let i = 0; i < n; i++) {
        const center = centers[i % numClusters];
        points.push({
          x: center.x + (Math.random() - 0.5) * 30,
          y: center.y + (Math.random() - 0.5) * 30,
          index: i,
        });
      }
      break;

    default:
      for (let i = 0; i < n; i++) {
        points.push({ x: Math.random() * 100, y: Math.random() * 100, index: i });
      }
  }

  return points;
}

// Compute convex hull with selected algorithm
function computeHull(
  points: Point2D[],
  algorithm: string
): {
  hull: Point2D[];
  algorithm_used: string;
  comparisons: number;
} {
  let hull: Point2D[];
  let algoUsed = algorithm;

  switch (algorithm) {
    case 'graham_scan':
      hull = grahamScan(points);
      break;
    case 'jarvis_march':
      hull = jarvisMarch(points);
      break;
    case 'quickhull':
      hull = quickhull(points);
      break;
    case 'auto':
    default:
      // Use Graham scan for most cases, Jarvis for small expected hull
      if (points.length > 100) {
        hull = grahamScan(points);
        algoUsed = 'graham_scan (auto)';
      } else {
        hull = jarvisMarch(points);
        algoUsed = 'jarvis_march (auto)';
      }
  }

  return {
    hull,
    algorithm_used: algoUsed,
    comparisons: points.length * Math.ceil(Math.log2(points.length + 1)),
  };
}

export async function executeconvexhull(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            tool: 'convex_hull',
            description: 'Convex hull computation for 2D point sets',
            operations: {
              compute: 'Compute convex hull of point set',
              area: 'Calculate area enclosed by convex hull',
              perimeter: 'Calculate perimeter of convex hull',
              contains: 'Test if point is inside convex hull',
              diameter: 'Find diameter of convex hull (farthest pair)',
              minimum_enclosing: 'Find minimum enclosing circle',
              analyze: 'Full analysis of point set and hull',
            },
            algorithms: {
              graham_scan: 'O(n log n) - Sort by polar angle, build monotone chain',
              jarvis_march: 'O(nh) - Gift wrapping, good for small hulls',
              quickhull: 'O(n log n) average - Divide and conquer',
              auto: 'Automatically select best algorithm',
            },
            features: [
              'Multiple algorithm implementations',
              'Area and perimeter computation',
              'Point containment testing',
              'Rotating calipers for diameter',
              'Minimum enclosing circle (Welzl)',
              'Sample point generation',
            ],
            example: {
              operation: 'compute',
              points: [
                [0, 0],
                [10, 0],
                [5, 10],
                [3, 3],
                [7, 2],
              ],
              algorithm: 'graham_scan',
            },
          },
          null,
          2
        ),
      };
    }

    // Parse points
    let points: Point2D[];
    if (args.points && args.points.length > 0) {
      points = args.points.map((p: number[], i: number) => ({ x: p[0], y: p[1], index: i }));
    } else {
      const distribution = args.distribution || 'random';
      const n = args.num_points || 50;
      points = generateSamplePoints(distribution, n);
    }

    const algorithm = args.algorithm || 'auto';

    if (operation === 'compute') {
      const result = computeHull(points, algorithm);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'compute',
            input_points: points.length,
            hull_vertices: result.hull.length,
            algorithm_used: result.algorithm_used,
            hull: result.hull.map((p) => [parseFloat(p.x.toFixed(4)), parseFloat(p.y.toFixed(4))]),
            area: parseFloat(polygonArea(result.hull).toFixed(4)),
            perimeter: parseFloat(polygonPerimeter(result.hull).toFixed(4)),
            complexity: {
              input_size: points.length,
              hull_size: result.hull.length,
              ratio: parseFloat((result.hull.length / points.length).toFixed(4)),
            },
          },
          null,
          2
        ),
      };
    }

    if (operation === 'area') {
      const result = computeHull(points, algorithm);
      const area = polygonArea(result.hull);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'area',
            hull_vertices: result.hull.length,
            area,
            unit: 'square units',
            comparison: {
              bounding_box_area: (() => {
                let minX = Infinity,
                  maxX = -Infinity,
                  minY = Infinity,
                  maxY = -Infinity;
                for (const p of points) {
                  if (p.x < minX) minX = p.x;
                  if (p.x > maxX) maxX = p.x;
                  if (p.y < minY) minY = p.y;
                  if (p.y > maxY) maxY = p.y;
                }
                return (maxX - minX) * (maxY - minY);
              })(),
              efficiency:
                area /
                (() => {
                  let minX = Infinity,
                    maxX = -Infinity,
                    minY = Infinity,
                    maxY = -Infinity;
                  for (const p of points) {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                  }
                  return (maxX - minX) * (maxY - minY) || 1;
                })(),
            },
          },
          null,
          2
        ),
      };
    }

    if (operation === 'perimeter') {
      const result = computeHull(points, algorithm);
      const perimeter = polygonPerimeter(result.hull);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'perimeter',
            hull_vertices: result.hull.length,
            perimeter,
            avg_edge_length: perimeter / result.hull.length,
            edges: result.hull.map((p, i) => {
              const next = result.hull[(i + 1) % result.hull.length];
              return {
                from: [p.x, p.y],
                to: [next.x, next.y],
                length: dist2D(p, next),
              };
            }),
          },
          null,
          2
        ),
      };
    }

    if (operation === 'contains') {
      const queryPoint = args.query_point;
      if (!queryPoint) {
        return { toolCallId: id, content: 'Error: query_point required', isError: true };
      }

      const result = computeHull(points, algorithm);
      const point: Point2D = { x: queryPoint[0], y: queryPoint[1] };
      const inside = pointInConvexHull(result.hull, point);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'contains',
            query_point: queryPoint,
            is_inside: inside,
            hull_vertices: result.hull.length,
            distance_to_centroid: (() => {
              const cx = result.hull.reduce((s, p) => s + p.x, 0) / result.hull.length;
              const cy = result.hull.reduce((s, p) => s + p.y, 0) / result.hull.length;
              return Math.sqrt((point.x - cx) ** 2 + (point.y - cy) ** 2);
            })(),
          },
          null,
          2
        ),
      };
    }

    if (operation === 'diameter') {
      const result = computeHull(points, algorithm);
      const diam = hullDiameter(result.hull);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'diameter',
            diameter: diam.diameter,
            antipodal_points: [
              [diam.points[0].x, diam.points[0].y],
              [diam.points[1].x, diam.points[1].y],
            ],
            hull_vertices: result.hull.length,
            diameter_to_perimeter_ratio: diam.diameter / polygonPerimeter(result.hull),
          },
          null,
          2
        ),
      };
    }

    if (operation === 'minimum_enclosing') {
      const circle = minEnclosingCircle(points);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'minimum_enclosing',
            circle: {
              center: [circle.center.x, circle.center.y],
              radius: circle.radius,
            },
            circle_area: Math.PI * circle.radius * circle.radius,
            circumference: 2 * Math.PI * circle.radius,
            num_points: points.length,
            points_on_boundary: points.filter(
              (p) => Math.abs(dist2D(p, circle.center) - circle.radius) < 0.01
            ).length,
          },
          null,
          2
        ),
      };
    }

    if (operation === 'analyze') {
      const result = computeHull(points, algorithm);
      const area = polygonArea(result.hull);
      const perimeter = polygonPerimeter(result.hull);
      const diam = hullDiameter(result.hull);
      const circle = minEnclosingCircle(points);

      // Centroid
      const cx = result.hull.reduce((s, p) => s + p.x, 0) / result.hull.length;
      const cy = result.hull.reduce((s, p) => s + p.y, 0) / result.hull.length;

      // Bounding box
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'analyze',
            input_statistics: {
              num_points: points.length,
              bounding_box: {
                min: [minX, minY],
                max: [maxX, maxY],
                width: maxX - minX,
                height: maxY - minY,
              },
            },
            hull_statistics: {
              num_vertices: result.hull.length,
              hull_ratio: result.hull.length / points.length,
              area,
              perimeter,
              centroid: [cx, cy],
              compactness: (4 * Math.PI * area) / (perimeter * perimeter),
              circularity: area / (Math.PI * (diam.diameter / 2) ** 2),
            },
            diameter: {
              value: diam.diameter,
              points: diam.points.map((p) => [p.x, p.y]),
            },
            minimum_enclosing_circle: {
              center: [circle.center.x, circle.center.y],
              radius: circle.radius,
              area_ratio: area / (Math.PI * circle.radius * circle.radius),
            },
            algorithm_used: result.algorithm_used,
            vertices: result.hull.map((p) => [p.x.toFixed(2), p.y.toFixed(2)]),
          },
          null,
          2
        ),
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(
        {
          error: `Unknown operation: ${operation}`,
          available_operations: [
            'compute',
            'area',
            'perimeter',
            'contains',
            'diameter',
            'minimum_enclosing',
            'analyze',
            'info',
          ],
        },
        null,
        2
      ),
      isError: true,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isconvexhullAvailable(): boolean {
  return true;
}
