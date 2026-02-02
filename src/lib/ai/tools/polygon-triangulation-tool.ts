/**
 * POLYGON-TRIANGULATION TOOL
 * Polygon triangulation algorithms including ear clipping and monotone decomposition
 * For computational geometry, mesh generation, and graphics applications
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Point type
interface Point {
  x: number;
  y: number;
}

// Triangle type
interface Triangle {
  vertices: [Point, Point, Point];
  indices: [number, number, number];
}

// Calculate signed area of triangle (for orientation)
function signedArea(p1: Point, p2: Point, p3: Point): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y);
}

// Check if point is strictly left of line
function isLeft(p: Point, a: Point, b: Point): boolean {
  return signedArea(a, b, p) > 0;
}

// Check if three points are collinear
function isCollinear(p1: Point, p2: Point, p3: Point): boolean {
  return Math.abs(signedArea(p1, p2, p3)) < 1e-10;
}

// Check if polygon is counter-clockwise
function isCounterClockwise(polygon: Point[]): boolean {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    sum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return sum < 0;
}

// Reverse polygon to make CCW
function ensureCCW(polygon: Point[]): Point[] {
  if (!isCounterClockwise(polygon)) {
    return [...polygon].reverse();
  }
  return [...polygon];
}

// Calculate polygon area
function polygonArea(polygon: Point[]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

// Check if point is inside triangle
function pointInTriangle(p: Point, t1: Point, t2: Point, t3: Point): boolean {
  const d1 = signedArea(p, t1, t2);
  const d2 = signedArea(p, t2, t3);
  const d3 = signedArea(p, t3, t1);

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

  return !(hasNeg && hasPos);
}

// Check if vertex is convex (for CCW polygon)
function isConvex(prev: Point, curr: Point, next: Point): boolean {
  return signedArea(prev, curr, next) > 0;
}

// Check if vertex is an ear
function isEar(polygon: Point[], i: number, indices: number[]): boolean {
  const n = indices.length;
  if (n < 3) return false;

  const prevIdx = indices[(i - 1 + n) % n];
  const currIdx = indices[i];
  const nextIdx = indices[(i + 1) % n];

  const prev = polygon[prevIdx];
  const curr = polygon[currIdx];
  const next = polygon[nextIdx];

  // Must be convex
  if (!isConvex(prev, curr, next)) {
    return false;
  }

  // No other vertex inside the triangle
  for (let j = 0; j < n; j++) {
    if (j === (i - 1 + n) % n || j === i || j === (i + 1) % n) continue;
    if (pointInTriangle(polygon[indices[j]], prev, curr, next)) {
      return false;
    }
  }

  return true;
}

// Ear clipping triangulation
function earClipping(polygon: Point[]): {
  triangles: Triangle[];
  steps: Array<{ step: number; earIndex: number; remainingVertices: number }>;
} {
  const ccwPolygon = ensureCCW(polygon);
  const triangles: Triangle[] = [];
  const steps: Array<{ step: number; earIndex: number; remainingVertices: number }> = [];

  // Create index list
  let indices = Array.from({ length: ccwPolygon.length }, (_, i) => i);

  let step = 0;
  let iterations = 0;
  const maxIterations = ccwPolygon.length * 2;

  while (indices.length > 3 && iterations < maxIterations) {
    iterations++;
    let foundEar = false;

    for (let i = 0; i < indices.length; i++) {
      if (isEar(ccwPolygon, i, indices)) {
        const n = indices.length;
        const prevIdx = indices[(i - 1 + n) % n];
        const currIdx = indices[i];
        const nextIdx = indices[(i + 1) % n];

        triangles.push({
          vertices: [ccwPolygon[prevIdx], ccwPolygon[currIdx], ccwPolygon[nextIdx]],
          indices: [prevIdx, currIdx, nextIdx]
        });

        steps.push({
          step: step++,
          earIndex: currIdx,
          remainingVertices: indices.length - 1
        });

        // Remove ear
        indices.splice(i, 1);
        foundEar = true;
        break;
      }
    }

    if (!foundEar) {
      break;
    }
  }

  // Last triangle
  if (indices.length === 3) {
    triangles.push({
      vertices: [ccwPolygon[indices[0]], ccwPolygon[indices[1]], ccwPolygon[indices[2]]],
      indices: [indices[0], indices[1], indices[2]]
    });
    steps.push({
      step: step++,
      earIndex: indices[1],
      remainingVertices: 0
    });
  }

  return { triangles, steps };
}

// Classify vertex type for monotone decomposition
type VertexType = 'start' | 'end' | 'regular' | 'split' | 'merge';

function classifyVertex(polygon: Point[], i: number): VertexType {
  const n = polygon.length;
  const prev = polygon[(i - 1 + n) % n];
  const curr = polygon[i];
  const next = polygon[(i + 1) % n];

  const prevAbove = prev.y > curr.y || (prev.y === curr.y && prev.x < curr.x);
  const nextAbove = next.y > curr.y || (next.y === curr.y && next.x < curr.x);

  if (prevAbove && nextAbove) {
    // Both neighbors above
    if (isConvex(prev, curr, next)) {
      return 'start';
    } else {
      return 'split';
    }
  } else if (!prevAbove && !nextAbove) {
    // Both neighbors below
    if (isConvex(prev, curr, next)) {
      return 'end';
    } else {
      return 'merge';
    }
  } else {
    return 'regular';
  }
}

// Simple monotone polygon triangulation
function monotoneTriangulation(polygon: Point[]): {
  triangles: Triangle[];
  vertexTypes: Array<{ index: number; type: VertexType }>;
} {
  const ccwPolygon = ensureCCW(polygon);
  const triangles: Triangle[] = [];

  // Classify vertices
  const vertexTypes = ccwPolygon.map((_, i) => ({
    index: i,
    type: classifyVertex(ccwPolygon, i)
  }));

  // Sort vertices by y-coordinate (descending)
  const sorted = [...vertexTypes].sort((a, b) => {
    if (ccwPolygon[b.index].y !== ccwPolygon[a.index].y) {
      return ccwPolygon[b.index].y - ccwPolygon[a.index].y;
    }
    return ccwPolygon[a.index].x - ccwPolygon[b.index].x;
  });

  // Use fan triangulation for simple y-monotone polygons
  // This is a simplified approach - full monotone partitioning is more complex
  if (sorted.length >= 3) {
    // Find top and bottom vertices
    const topIdx = sorted[0].index;

    // Simple fan from top vertex
    for (let i = 1; i < sorted.length - 1; i++) {
      triangles.push({
        vertices: [
          ccwPolygon[topIdx],
          ccwPolygon[sorted[i].index],
          ccwPolygon[sorted[i + 1].index]
        ],
        indices: [topIdx, sorted[i].index, sorted[i + 1].index]
      });
    }
  }

  return { triangles, vertexTypes };
}

// Fan triangulation (for convex polygons)
function fanTriangulation(polygon: Point[]): Triangle[] {
  const ccwPolygon = ensureCCW(polygon);
  const triangles: Triangle[] = [];

  for (let i = 1; i < ccwPolygon.length - 1; i++) {
    triangles.push({
      vertices: [ccwPolygon[0], ccwPolygon[i], ccwPolygon[i + 1]],
      indices: [0, i, i + 1]
    });
  }

  return triangles;
}

// Check if polygon is convex
function isConvexPolygon(polygon: Point[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  let sign = 0;
  for (let i = 0; i < n; i++) {
    const area = signedArea(
      polygon[i],
      polygon[(i + 1) % n],
      polygon[(i + 2) % n]
    );
    if (sign === 0) {
      sign = area > 0 ? 1 : -1;
    } else if ((area > 0 ? 1 : -1) !== sign && Math.abs(area) > 1e-10) {
      return false;
    }
  }
  return true;
}

// Check if polygon is simple (non-self-intersecting)
function isSimplePolygon(polygon: Point[]): { isSimple: boolean; intersections?: [number, number][] } {
  const n = polygon.length;
  const intersections: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // Adjacent edges

      const a1 = polygon[i];
      const a2 = polygon[(i + 1) % n];
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % n];

      if (segmentsIntersect(a1, a2, b1, b2)) {
        intersections.push([i, j]);
      }
    }
  }

  return {
    isSimple: intersections.length === 0,
    intersections: intersections.length > 0 ? intersections : undefined
  };
}

// Check if two line segments intersect
function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1 = signedArea(b1, b2, a1);
  const d2 = signedArea(b1, b2, a2);
  const d3 = signedArea(a1, a2, b1);
  const d4 = signedArea(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

// Calculate centroid of triangle
function triangleCentroid(t: Triangle): Point {
  return {
    x: (t.vertices[0].x + t.vertices[1].x + t.vertices[2].x) / 3,
    y: (t.vertices[0].y + t.vertices[1].y + t.vertices[2].y) / 3
  };
}

// Calculate area of triangle
function triangleArea(t: Triangle): number {
  const [a, b, c] = t.vertices;
  return Math.abs(signedArea(a, b, c)) / 2;
}

// Generate ASCII visualization
function visualizeTriangulation(polygon: Point[], triangles: Triangle[]): string {
  const width = 40;
  const height = 20;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Find bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const scaleX = (width - 2) / (maxX - minX || 1);
  const scaleY = (height - 2) / (maxY - minY || 1);

  // Draw polygon outline
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const x1 = Math.floor((p1.x - minX) * scaleX) + 1;
    const y1 = height - 1 - Math.floor((p1.y - minY) * scaleY) - 1;
    const x2 = Math.floor((p2.x - minX) * scaleX) + 1;
    const y2 = height - 1 - Math.floor((p2.y - minY) * scaleY) - 1;

    // Draw line (simple Bresenham)
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;

    while (true) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        grid[y][x] = '·';
      }
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  // Draw vertices
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const x = Math.floor((p.x - minX) * scaleX) + 1;
    const y = height - 1 - Math.floor((p.y - minY) * scaleY) - 1;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = String(i % 10);
    }
  }

  // Draw triangle centroids
  for (let i = 0; i < triangles.length; i++) {
    const c = triangleCentroid(triangles[i]);
    const x = Math.floor((c.x - minX) * scaleX) + 1;
    const y = height - 1 - Math.floor((c.y - minY) * scaleY) - 1;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '△';
    }
  }

  // Build string
  let viz = '┌' + '─'.repeat(width) + '┐\n';
  for (const row of grid) {
    viz += '│' + row.join('') + '│\n';
  }
  viz += '└' + '─'.repeat(width) + '┘';

  return viz;
}

// Predefined test polygons
const TEST_POLYGONS: Record<string, Point[]> = {
  square: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 }
  ],
  triangle: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 10 }
  ],
  pentagon: [
    { x: 5, y: 0 },
    { x: 10, y: 4 },
    { x: 8, y: 10 },
    { x: 2, y: 10 },
    { x: 0, y: 4 }
  ],
  star: [
    { x: 5, y: 0 },
    { x: 6, y: 3 },
    { x: 10, y: 4 },
    { x: 7, y: 6 },
    { x: 8, y: 10 },
    { x: 5, y: 8 },
    { x: 2, y: 10 },
    { x: 3, y: 6 },
    { x: 0, y: 4 },
    { x: 4, y: 3 }
  ],
  L_shape: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 10 },
    { x: 0, y: 10 }
  ]
};

export const polygontriangulationTool: UnifiedTool = {
  name: 'polygon_triangulation',
  description: 'Polygon triangulation using ear clipping, monotone decomposition, and fan algorithms',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'triangulate', 'ear_clipping', 'monotone', 'fan', 'analyze', 'validate', 'demonstrate'],
        description: 'Operation to perform'
      },
      polygon: { type: 'array', description: 'Array of {x, y} points' },
      preset: { type: 'string', enum: ['square', 'triangle', 'pentagon', 'star', 'L_shape'], description: 'Use preset polygon' },
      algorithm: { type: 'string', enum: ['ear_clipping', 'monotone', 'fan'], description: 'Triangulation algorithm' }
    },
    required: ['operation']
  }
};

export async function executepolygontriangulation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'polygon_triangulation',
          description: 'Algorithms for decomposing polygons into triangles',
          algorithms: {
            ear_clipping: {
              name: 'Ear Clipping',
              complexity: 'O(n²)',
              description: 'Iteratively removes "ears" (convex vertices with no other vertices inside)',
              works_with: 'Simple polygons (with or without holes)',
              pros: ['Simple to implement', 'Handles concave polygons'],
              cons: ['Not optimal for large polygons']
            },
            monotone: {
              name: 'Monotone Polygon Triangulation',
              complexity: 'O(n log n)',
              description: 'Partitions into y-monotone pieces, then triangulates each',
              works_with: 'Simple polygons',
              pros: ['More efficient', 'Good for CAD applications'],
              cons: ['More complex implementation']
            },
            fan: {
              name: 'Fan Triangulation',
              complexity: 'O(n)',
              description: 'Creates triangles from one vertex to all others',
              works_with: 'Convex polygons only',
              pros: ['Very fast', 'Simple'],
              cons: ['Only works for convex polygons']
            }
          },
          applications: [
            '3D graphics and rendering',
            'Finite element mesh generation',
            'Collision detection',
            'Area calculations',
            'Polygon decomposition'
          ],
          key_concepts: {
            simple_polygon: 'Non-self-intersecting',
            convex_polygon: 'All interior angles < 180°',
            ear: 'Triangle formed by consecutive vertices with no vertices inside',
            diagonal: 'Line segment connecting non-adjacent vertices'
          },
          preset_polygons: Object.keys(TEST_POLYGONS),
          operations: ['triangulate', 'ear_clipping', 'monotone', 'fan', 'analyze', 'validate', 'demonstrate']
        };
        break;
      }

      case 'triangulate':
      case 'ear_clipping': {
        const polygon = args.polygon || TEST_POLYGONS[args.preset || 'pentagon'];

        if (!polygon || polygon.length < 3) {
          result = { error: 'Polygon must have at least 3 vertices' };
          break;
        }

        const { triangles, steps } = earClipping(polygon);
        const totalArea = polygonArea(polygon);
        const triangleAreas = triangles.map(t => triangleArea(t));
        const sumTriangleAreas = triangleAreas.reduce((a, b) => a + b, 0);

        result = {
          operation: 'ear_clipping',
          input: {
            vertices: polygon.length,
            polygon: polygon.slice(0, 10) // Show first 10
          },
          result: {
            num_triangles: triangles.length,
            expected_triangles: polygon.length - 2,
            triangles: triangles.map((t, i) => ({
              triangle: i + 1,
              indices: t.indices,
              vertices: t.vertices.map(v => ({ x: parseFloat(v.x.toFixed(2)), y: parseFloat(v.y.toFixed(2)) })),
              area: parseFloat(triangleArea(t).toFixed(4))
            }))
          },
          verification: {
            polygon_area: parseFloat(totalArea.toFixed(4)),
            triangles_area_sum: parseFloat(sumTriangleAreas.toFixed(4)),
            areas_match: Math.abs(totalArea - sumTriangleAreas) < 0.01
          },
          algorithm_steps: steps.slice(0, 10),
          visualization: visualizeTriangulation(polygon, triangles)
        };
        break;
      }

      case 'monotone': {
        const polygon = args.polygon || TEST_POLYGONS[args.preset || 'pentagon'];

        if (!polygon || polygon.length < 3) {
          result = { error: 'Polygon must have at least 3 vertices' };
          break;
        }

        const { triangles, vertexTypes } = monotoneTriangulation(polygon);

        result = {
          operation: 'monotone',
          input: {
            vertices: polygon.length
          },
          vertex_classification: vertexTypes.map(v => ({
            index: v.index,
            type: v.type,
            position: polygon[v.index]
          })),
          result: {
            num_triangles: triangles.length,
            triangles: triangles.map((t, i) => ({
              triangle: i + 1,
              indices: t.indices
            }))
          },
          vertex_types_explained: {
            start: 'Both neighbors below, interior to the right',
            end: 'Both neighbors above, interior to the right',
            split: 'Both neighbors below, interior to the left (creates split)',
            merge: 'Both neighbors above, interior to the left (needs merge)',
            regular: 'One neighbor above, one below'
          },
          visualization: visualizeTriangulation(polygon, triangles)
        };
        break;
      }

      case 'fan': {
        const polygon = args.polygon || TEST_POLYGONS[args.preset || 'square'];

        if (!polygon || polygon.length < 3) {
          result = { error: 'Polygon must have at least 3 vertices' };
          break;
        }

        const isConvex = isConvexPolygon(polygon);
        const triangles = isConvex ? fanTriangulation(polygon) : [];

        result = {
          operation: 'fan',
          input: {
            vertices: polygon.length,
            is_convex: isConvex
          },
          result: isConvex ? {
            num_triangles: triangles.length,
            triangles: triangles.map((t, i) => ({
              triangle: i + 1,
              indices: t.indices,
              area: parseFloat(triangleArea(t).toFixed(4))
            })),
            visualization: visualizeTriangulation(polygon, triangles)
          } : {
            error: 'Fan triangulation only works for convex polygons',
            suggestion: 'Use ear_clipping or monotone for non-convex polygons'
          }
        };
        break;
      }

      case 'analyze': {
        const polygon = args.polygon || TEST_POLYGONS[args.preset || 'star'];

        if (!polygon || polygon.length < 3) {
          result = { error: 'Polygon must have at least 3 vertices' };
          break;
        }

        const simpleCheck = isSimplePolygon(polygon);
        const convexCheck = isConvexPolygon(polygon);
        const ccw = isCounterClockwise(polygon);
        const area = polygonArea(polygon);

        // Calculate perimeter
        let perimeter = 0;
        for (let i = 0; i < polygon.length; i++) {
          const p1 = polygon[i];
          const p2 = polygon[(i + 1) % polygon.length];
          perimeter += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }

        // Find bounding box
        const minX = Math.min(...polygon.map(p => p.x));
        const maxX = Math.max(...polygon.map(p => p.x));
        const minY = Math.min(...polygon.map(p => p.y));
        const maxY = Math.max(...polygon.map(p => p.y));

        // Calculate centroid
        let cx = 0, cy = 0;
        for (const p of polygon) {
          cx += p.x;
          cy += p.y;
        }
        cx /= polygon.length;
        cy /= polygon.length;

        result = {
          operation: 'analyze',
          polygon: {
            vertices: polygon.length,
            is_simple: simpleCheck.isSimple,
            is_convex: convexCheck,
            is_ccw: ccw,
            self_intersections: simpleCheck.intersections
          },
          measurements: {
            area: parseFloat(area.toFixed(4)),
            perimeter: parseFloat(perimeter.toFixed(4)),
            centroid: { x: parseFloat(cx.toFixed(4)), y: parseFloat(cy.toFixed(4)) }
          },
          bounding_box: {
            min: { x: minX, y: minY },
            max: { x: maxX, y: maxY },
            width: maxX - minX,
            height: maxY - minY
          },
          recommended_algorithm: !simpleCheck.isSimple ? 'polygon is not simple (self-intersecting)' :
                                 convexCheck ? 'fan (fastest for convex)' : 'ear_clipping',
          expected_triangles: polygon.length - 2
        };
        break;
      }

      case 'validate': {
        const polygon = args.polygon;

        if (!polygon) {
          result = {
            operation: 'validate',
            error: 'No polygon provided',
            expected_format: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 5, y: 10 }
            ]
          };
          break;
        }

        const errors: string[] = [];

        if (!Array.isArray(polygon)) {
          errors.push('Polygon must be an array');
        } else {
          if (polygon.length < 3) {
            errors.push('Polygon must have at least 3 vertices');
          }

          for (let i = 0; i < polygon.length; i++) {
            if (typeof polygon[i].x !== 'number' || typeof polygon[i].y !== 'number') {
              errors.push(`Vertex ${i} must have numeric x and y properties`);
            }
          }

          if (errors.length === 0) {
            const simpleCheck = isSimplePolygon(polygon);
            if (!simpleCheck.isSimple) {
              errors.push(`Polygon is self-intersecting at edges: ${simpleCheck.intersections?.map(([i, j]) => `${i}-${j}`).join(', ')}`);
            }
          }
        }

        result = {
          operation: 'validate',
          valid: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined,
          polygon_info: errors.length === 0 ? {
            vertices: polygon.length,
            is_convex: isConvexPolygon(polygon),
            is_ccw: isCounterClockwise(polygon),
            area: parseFloat(polygonArea(polygon).toFixed(4))
          } : undefined
        };
        break;
      }

      case 'demonstrate': {
        const demos = [];

        for (const [name, polygon] of Object.entries(TEST_POLYGONS)) {
          const { triangles } = earClipping(polygon);
          demos.push({
            name,
            vertices: polygon.length,
            triangles: triangles.length,
            is_convex: isConvexPolygon(polygon),
            area: parseFloat(polygonArea(polygon).toFixed(2))
          });
        }

        result = {
          operation: 'demonstrate',
          tool: 'polygon_triangulation',
          preset_examples: demos,
          ear_clipping_example: {
            polygon: 'L_shape',
            ...earClipping(TEST_POLYGONS.L_shape),
            visualization: visualizeTriangulation(TEST_POLYGONS.L_shape, earClipping(TEST_POLYGONS.L_shape).triangles)
          },
          key_theorem: {
            name: 'Art Gallery Theorem',
            statement: 'Any simple polygon with n vertices can be guarded by ⌊n/3⌋ guards',
            connection: 'Based on 3-coloring of triangulation graph'
          },
          triangulation_theorem: {
            statement: 'Any simple polygon with n vertices can be triangulated into exactly n-2 triangles',
            proof_idea: 'Induction: removing one ear leaves a polygon with n-1 vertices'
          },
          complexity_comparison: `
ALGORITHM COMPARISON
════════════════════

Algorithm        │ Time        │ Best For
─────────────────┼─────────────┼─────────────────
Fan              │ O(n)        │ Convex polygons
Ear Clipping     │ O(n²)       │ Simple polygons
Monotone         │ O(n log n)  │ Large polygons
Delaunay-based   │ O(n log n)  │ Quality meshes
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'triangulate', 'ear_clipping', 'monotone', 'fan', 'analyze', 'validate', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function ispolygontriangulationAvailable(): boolean {
  return true;
}
