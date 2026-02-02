/**
 * POLYGON-TRIANGULATION TOOL
 * Comprehensive polygon triangulation algorithms including ear clipping,
 * monotone decomposition, and Delaunay triangulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Point {
  x: number;
  y: number;
  index?: number;
}

interface Triangle {
  vertices: [Point, Point, Point];
  indices: [number, number, number];
  area: number;
  centroid: Point;
}

interface Edge {
  start: Point;
  end: Point;
  startIndex: number;
  endIndex: number;
}

interface TriangulationResult {
  triangles: Triangle[];
  totalArea: number;
  vertexCount: number;
  triangleCount: number;
  isConvex: boolean;
  isSimple: boolean;
  algorithm: string;
  executionSteps?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface MonotoneChain {
  vertices: Point[];
  isLeftChain: boolean;
}

// =============================================================================
// GEOMETRY UTILITIES
// =============================================================================

/**
 * Cross product of vectors (p1-p0) and (p2-p0)
 */
function crossProduct(p0: Point, p1: Point, p2: Point): number {
  return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

/**
 * Calculate signed area of polygon (positive if CCW)
 */
function signedArea(vertices: Point[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

/**
 * Calculate area of a triangle
 */
function triangleArea(p0: Point, p1: Point, p2: Point): number {
  return Math.abs(crossProduct(p0, p1, p2)) / 2;
}

/**
 * Calculate centroid of a triangle
 */
function triangleCentroid(p0: Point, p1: Point, p2: Point): Point {
  return {
    x: (p0.x + p1.x + p2.x) / 3,
    y: (p0.y + p1.y + p2.y) / 3
  };
}

/**
 * Check if polygon vertices are in counter-clockwise order
 */
function isCounterClockwise(vertices: Point[]): boolean {
  return signedArea(vertices) > 0;
}

/**
 * Ensure vertices are in CCW order
 */
function ensureCCW(vertices: Point[]): Point[] {
  if (isCounterClockwise(vertices)) {
    return vertices;
  }
  return [...vertices].reverse();
}

/**
 * Check if point is inside triangle
 */
function pointInTriangle(p: Point, t0: Point, t1: Point, t2: Point): boolean {
  const d1 = crossProduct(p, t0, t1);
  const d2 = crossProduct(p, t1, t2);
  const d3 = crossProduct(p, t2, t0);

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

  return !(hasNeg && hasPos);
}

/**
 * Check if diagonal from vertex i to vertex j is valid
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isDiagonalValid(vertices: Point[], i: number, j: number): boolean {
  const n = vertices.length;

  // Check if diagonal lies inside polygon
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _prev = (i - 1 + n) % n;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _next = (i + 1) % n;

  // Check if j is in the cone formed by edges at i
  if (!inCone(vertices, i, j)) {
    return false;
  }

  // Check if diagonal intersects any edge
  for (let k = 0; k < n; k++) {
    const kNext = (k + 1) % n;
    if (k === i || k === j || kNext === i || kNext === j) continue;

    if (segmentsIntersect(vertices[i], vertices[j], vertices[k], vertices[kNext])) {
      return false;
    }
  }

  return true;
}

/**
 * Check if vertex j is in the cone formed at vertex i
 */
function inCone(vertices: Point[], i: number, j: number): boolean {
  const n = vertices.length;
  const prev = (i - 1 + n) % n;
  const next = (i + 1) % n;

  const vi = vertices[i];
  const vPrev = vertices[prev];
  const vNext = vertices[next];
  const vj = vertices[j];

  // If vertex i is convex
  if (crossProduct(vPrev, vi, vNext) >= 0) {
    return crossProduct(vi, vj, vPrev) > 0 && crossProduct(vj, vi, vNext) > 0;
  }

  // If vertex i is reflex
  return !(crossProduct(vi, vj, vNext) >= 0 && crossProduct(vj, vi, vPrev) >= 0);
}

/**
 * Check if two line segments intersect
 */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = crossProduct(p3, p4, p1);
  const d2 = crossProduct(p3, p4, p2);
  const d3 = crossProduct(p1, p2, p3);
  const d4 = crossProduct(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

/**
 * Check if polygon is convex
 */
function isConvex(vertices: Point[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  let sign = 0;

  for (let i = 0; i < n; i++) {
    const cross = crossProduct(
      vertices[i],
      vertices[(i + 1) % n],
      vertices[(i + 2) % n]
    );

    if (cross !== 0) {
      if (sign === 0) {
        sign = cross > 0 ? 1 : -1;
      } else if ((cross > 0 ? 1 : -1) !== sign) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if polygon is simple (no self-intersections)
 */
function isSimplePolygon(vertices: Point[]): boolean {
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // Adjacent edges

      if (segmentsIntersect(
        vertices[i], vertices[(i + 1) % n],
        vertices[j], vertices[(j + 1) % n]
      )) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if vertex is an ear
 */
function isEar(vertices: Point[], indices: number[], i: number): boolean {
  const n = indices.length;
  const prev = (i - 1 + n) % n;
  const next = (i + 1) % n;

  const v0 = vertices[indices[prev]];
  const v1 = vertices[indices[i]];
  const v2 = vertices[indices[next]];

  // Check if angle is convex
  if (crossProduct(v0, v1, v2) <= 0) {
    return false;
  }

  // Check if any other vertex is inside the triangle
  for (let j = 0; j < n; j++) {
    if (j === prev || j === i || j === next) continue;

    if (pointInTriangle(vertices[indices[j]], v0, v1, v2)) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// TRIANGULATION ALGORITHMS
// =============================================================================

/**
 * Ear Clipping Algorithm
 * Time complexity: O(n²)
 */
function earClipping(vertices: Point[]): TriangulationResult {
  const steps: string[] = [];
  const triangles: Triangle[] = [];

  // Ensure CCW orientation
  const ccwVertices = ensureCCW(vertices);
  steps.push(`Polygon has ${vertices.length} vertices`);
  steps.push(`Ensured counter-clockwise orientation`);

  // Create index list
  const indices: number[] = [];
  for (let i = 0; i < ccwVertices.length; i++) {
    indices.push(i);
  }

  let earCount = 0;
  let iterations = 0;
  const maxIterations = vertices.length * vertices.length;

  while (indices.length > 3 && iterations < maxIterations) {
    iterations++;
    let earFound = false;

    for (let i = 0; i < indices.length; i++) {
      if (isEar(ccwVertices, indices, i)) {
        const n = indices.length;
        const prev = (i - 1 + n) % n;
        const next = (i + 1) % n;

        const v0 = ccwVertices[indices[prev]];
        const v1 = ccwVertices[indices[i]];
        const v2 = ccwVertices[indices[next]];

        const triangle: Triangle = {
          vertices: [v0, v1, v2],
          indices: [indices[prev], indices[i], indices[next]],
          area: triangleArea(v0, v1, v2),
          centroid: triangleCentroid(v0, v1, v2)
        };

        triangles.push(triangle);
        earCount++;
        steps.push(`Ear ${earCount}: Clipped vertex ${indices[i]} → Triangle [${indices[prev]}, ${indices[i]}, ${indices[next]}]`);

        // Remove ear vertex
        indices.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      steps.push(`Warning: No ear found at iteration ${iterations}`);
      break;
    }
  }

  // Add final triangle
  if (indices.length === 3) {
    const v0 = ccwVertices[indices[0]];
    const v1 = ccwVertices[indices[1]];
    const v2 = ccwVertices[indices[2]];

    triangles.push({
      vertices: [v0, v1, v2],
      indices: [indices[0], indices[1], indices[2]],
      area: triangleArea(v0, v1, v2),
      centroid: triangleCentroid(v0, v1, v2)
    });
    steps.push(`Final triangle: [${indices[0]}, ${indices[1]}, ${indices[2]}]`);
  }

  const totalArea = triangles.reduce((sum, t) => sum + t.area, 0);

  return {
    triangles,
    totalArea,
    vertexCount: vertices.length,
    triangleCount: triangles.length,
    isConvex: isConvex(vertices),
    isSimple: isSimplePolygon(vertices),
    algorithm: 'ear_clipping',
    executionSteps: steps
  };
}

/**
 * Fan Triangulation (for convex polygons only)
 * Time complexity: O(n)
 */
function fanTriangulation(vertices: Point[]): TriangulationResult {
  const steps: string[] = [];
  const triangles: Triangle[] = [];

  const ccwVertices = ensureCCW(vertices);
  const convex = isConvex(ccwVertices);

  steps.push(`Polygon has ${vertices.length} vertices`);
  steps.push(`Polygon is ${convex ? 'convex' : 'NOT convex'}`);

  if (!convex) {
    steps.push(`Warning: Fan triangulation works best for convex polygons`);
  }

  // Fan from vertex 0
  const pivot = ccwVertices[0];

  for (let i = 1; i < ccwVertices.length - 1; i++) {
    const v1 = ccwVertices[i];
    const v2 = ccwVertices[i + 1];

    triangles.push({
      vertices: [pivot, v1, v2],
      indices: [0, i, i + 1],
      area: triangleArea(pivot, v1, v2),
      centroid: triangleCentroid(pivot, v1, v2)
    });

    steps.push(`Triangle ${i}: [0, ${i}, ${i + 1}]`);
  }

  const totalArea = triangles.reduce((sum, t) => sum + t.area, 0);

  return {
    triangles,
    totalArea,
    vertexCount: vertices.length,
    triangleCount: triangles.length,
    isConvex: convex,
    isSimple: isSimplePolygon(vertices),
    algorithm: 'fan',
    executionSteps: steps
  };
}

/**
 * Monotone Polygon Triangulation
 * Time complexity: O(n) for monotone polygons
 */
function monotoneTriangulation(vertices: Point[], direction: 'x' | 'y' = 'y'): TriangulationResult {
  const steps: string[] = [];
  const triangles: Triangle[] = [];

  steps.push(`Monotone triangulation in ${direction}-direction`);
  steps.push(`Polygon has ${vertices.length} vertices`);

  // Sort vertices by direction
  const sortedVertices = vertices.map((v, i) => ({ ...v, index: i }));

  if (direction === 'y') {
    sortedVertices.sort((a, b) => b.y - a.y || a.x - b.x);
  } else {
    sortedVertices.sort((a, b) => a.x - b.x || a.y - b.y);
  }

  steps.push(`Sorted vertices by ${direction}-coordinate`);

  // Build chains
  const n = vertices.length;
  const leftChain = new Set<number>();
  const rightChain = new Set<number>();

  // Find top and bottom vertices
  let topIdx = 0, bottomIdx = 0;
  for (let i = 1; i < n; i++) {
    if (direction === 'y') {
      if (vertices[i].y > vertices[topIdx].y) topIdx = i;
      if (vertices[i].y < vertices[bottomIdx].y) bottomIdx = i;
    } else {
      if (vertices[i].x < vertices[topIdx].x) topIdx = i;
      if (vertices[i].x > vertices[bottomIdx].x) bottomIdx = i;
    }
  }

  // Mark left and right chains
  let idx = topIdx;
  while (idx !== bottomIdx) {
    leftChain.add(idx);
    idx = (idx + 1) % n;
  }

  idx = topIdx;
  while (idx !== bottomIdx) {
    rightChain.add(idx);
    idx = (idx - 1 + n) % n;
  }

  steps.push(`Left chain: ${leftChain.size} vertices, Right chain: ${rightChain.size} vertices`);

  // Triangulate using stack
  const stack: { vertex: Point; index: number; chain: 'left' | 'right' }[] = [];

  if (sortedVertices.length >= 2) {
    const v0 = sortedVertices[0];
    const v1 = sortedVertices[1];

    stack.push({
      vertex: v0,
      index: v0.index!,
      chain: leftChain.has(v0.index!) ? 'left' : 'right'
    });
    stack.push({
      vertex: v1,
      index: v1.index!,
      chain: leftChain.has(v1.index!) ? 'left' : 'right'
    });
  }

  for (let i = 2; i < sortedVertices.length; i++) {
    const u = sortedVertices[i];
    const uChain = leftChain.has(u.index!) ? 'left' : 'right';

    if (stack.length > 0 && uChain !== stack[stack.length - 1].chain) {
      // Different chain - triangulate with all stack vertices
      while (stack.length > 1) {
        const vj = stack.pop()!;
        const vjPrev = stack[stack.length - 1];

        triangles.push({
          vertices: [u, vj.vertex, vjPrev.vertex],
          indices: [u.index!, vj.index, vjPrev.index],
          area: triangleArea(u, vj.vertex, vjPrev.vertex),
          centroid: triangleCentroid(u, vj.vertex, vjPrev.vertex)
        });

        steps.push(`Triangle from different chains: [${u.index}, ${vj.index}, ${vjPrev.index}]`);
      }
      stack.pop();
      stack.push({ vertex: sortedVertices[i - 1], index: sortedVertices[i - 1].index!, chain: leftChain.has(sortedVertices[i - 1].index!) ? 'left' : 'right' });
      stack.push({ vertex: u, index: u.index!, chain: uChain });
    } else {
      // Same chain
      let vj = stack.pop()!;

      while (stack.length > 0) {
        const vjPrev = stack[stack.length - 1];
        const cross = crossProduct(u, vj.vertex, vjPrev.vertex);

        // Check if diagonal is valid
        const valid = uChain === 'left' ? cross > 0 : cross < 0;

        if (valid) {
          triangles.push({
            vertices: [u, vj.vertex, vjPrev.vertex],
            indices: [u.index!, vj.index, vjPrev.index],
            area: triangleArea(u, vj.vertex, vjPrev.vertex),
            centroid: triangleCentroid(u, vj.vertex, vjPrev.vertex)
          });

          steps.push(`Triangle from same chain: [${u.index}, ${vj.index}, ${vjPrev.index}]`);
          vj = stack.pop()!;
        } else {
          break;
        }
      }

      stack.push(vj);
      stack.push({ vertex: u, index: u.index!, chain: uChain });
    }
  }

  const totalArea = triangles.reduce((sum, t) => sum + t.area, 0);

  return {
    triangles,
    totalArea,
    vertexCount: vertices.length,
    triangleCount: triangles.length,
    isConvex: isConvex(vertices),
    isSimple: isSimplePolygon(vertices),
    algorithm: 'monotone',
    executionSteps: steps
  };
}

/**
 * Delaunay-like triangulation (using incremental insertion)
 */
function delaunayTriangulation(vertices: Point[]): TriangulationResult {
  const steps: string[] = [];
  const triangles: Triangle[] = [];

  steps.push(`Delaunay triangulation for ${vertices.length} vertices`);

  if (vertices.length < 3) {
    return {
      triangles: [],
      totalArea: 0,
      vertexCount: vertices.length,
      triangleCount: 0,
      isConvex: false,
      isSimple: false,
      algorithm: 'delaunay',
      executionSteps: ['Not enough vertices for triangulation']
    };
  }

  // Find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const delta = Math.max(dx, dy);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Create super-triangle
  const superTriangle: Point[] = [
    { x: midX - 2 * delta, y: midY - delta, index: -1 },
    { x: midX, y: midY + 2 * delta, index: -2 },
    { x: midX + 2 * delta, y: midY - delta, index: -3 }
  ];

  steps.push(`Created super-triangle enclosing all points`);

  interface DelaunayTriangle {
    vertices: Point[];
    circumcenter: Point;
    circumradiusSq: number;
  }

  // Calculate circumcircle
  function circumcircle(p1: Point, p2: Point, p3: Point): { center: Point; radiusSq: number } {
    const ax = p1.x, ay = p1.y;
    const bx = p2.x, by = p2.y;
    const cx = p3.x, cy = p3.y;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

    if (Math.abs(d) < 1e-10) {
      return { center: { x: 0, y: 0 }, radiusSq: Infinity };
    }

    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    const center = { x: ux, y: uy };
    const radiusSq = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy);

    return { center, radiusSq };
  }

  let delaunayTriangles: DelaunayTriangle[] = [];

  // Initialize with super-triangle
  const { center, radiusSq } = circumcircle(superTriangle[0], superTriangle[1], superTriangle[2]);
  delaunayTriangles.push({
    vertices: superTriangle,
    circumcenter: center,
    circumradiusSq: radiusSq
  });

  // Insert points one by one
  for (let i = 0; i < vertices.length; i++) {
    const p = { ...vertices[i], index: i };
    const badTriangles: DelaunayTriangle[] = [];

    // Find all triangles whose circumcircle contains the point
    for (const tri of delaunayTriangles) {
      const distSq = (p.x - tri.circumcenter.x) ** 2 + (p.y - tri.circumcenter.y) ** 2;
      if (distSq <= tri.circumradiusSq) {
        badTriangles.push(tri);
      }
    }

    // Find boundary of polygonal hole
    const polygon: Edge[] = [];
    for (const tri of badTriangles) {
      for (let j = 0; j < 3; j++) {
        const edge: Edge = {
          start: tri.vertices[j],
          end: tri.vertices[(j + 1) % 3],
          startIndex: tri.vertices[j].index ?? -1,
          endIndex: tri.vertices[(j + 1) % 3].index ?? -1
        };

        // Check if edge is shared with another bad triangle
        let shared = false;
        for (const other of badTriangles) {
          if (other === tri) continue;

          for (let k = 0; k < 3; k++) {
            const otherEdge = {
              start: other.vertices[k],
              end: other.vertices[(k + 1) % 3]
            };

            if ((edge.start === otherEdge.end && edge.end === otherEdge.start) ||
                (edge.start === otherEdge.start && edge.end === otherEdge.end)) {
              shared = true;
              break;
            }
          }
          if (shared) break;
        }

        if (!shared) {
          polygon.push(edge);
        }
      }
    }

    // Remove bad triangles
    delaunayTriangles = delaunayTriangles.filter(t => !badTriangles.includes(t));

    // Create new triangles
    for (const edge of polygon) {
      const newVerts = [edge.start, edge.end, p];
      const { center, radiusSq } = circumcircle(newVerts[0], newVerts[1], newVerts[2]);

      delaunayTriangles.push({
        vertices: newVerts,
        circumcenter: center,
        circumradiusSq: radiusSq
      });
    }

    steps.push(`Inserted vertex ${i}: ${badTriangles.length} triangles replaced`);
  }

  // Remove triangles that share vertices with super-triangle
  const finalTriangles = delaunayTriangles.filter(tri => {
    for (const v of tri.vertices) {
      if (v.index !== undefined && v.index < 0) {
        return false;
      }
    }
    return true;
  });

  steps.push(`Removed super-triangle: ${delaunayTriangles.length - finalTriangles.length} triangles removed`);

  // Convert to output format
  for (const tri of finalTriangles) {
    triangles.push({
      vertices: [tri.vertices[0], tri.vertices[1], tri.vertices[2]],
      indices: [
        tri.vertices[0].index ?? 0,
        tri.vertices[1].index ?? 0,
        tri.vertices[2].index ?? 0
      ],
      area: triangleArea(tri.vertices[0], tri.vertices[1], tri.vertices[2]),
      centroid: triangleCentroid(tri.vertices[0], tri.vertices[1], tri.vertices[2])
    });
  }

  const totalArea = triangles.reduce((sum, t) => sum + t.area, 0);

  return {
    triangles,
    totalArea,
    vertexCount: vertices.length,
    triangleCount: triangles.length,
    isConvex: isConvex(vertices),
    isSimple: true, // Point set is always simple
    algorithm: 'delaunay',
    executionSteps: steps
  };
}

// =============================================================================
// EXAMPLE POLYGONS
// =============================================================================

const examplePolygons: Record<string, Point[]> = {
  square: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ],
  triangle: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0.5, y: Math.sqrt(3) / 2 }
  ],
  pentagon: [
    { x: Math.cos(Math.PI / 2), y: Math.sin(Math.PI / 2) },
    { x: Math.cos(Math.PI / 2 + 2 * Math.PI / 5), y: Math.sin(Math.PI / 2 + 2 * Math.PI / 5) },
    { x: Math.cos(Math.PI / 2 + 4 * Math.PI / 5), y: Math.sin(Math.PI / 2 + 4 * Math.PI / 5) },
    { x: Math.cos(Math.PI / 2 + 6 * Math.PI / 5), y: Math.sin(Math.PI / 2 + 6 * Math.PI / 5) },
    { x: Math.cos(Math.PI / 2 + 8 * Math.PI / 5), y: Math.sin(Math.PI / 2 + 8 * Math.PI / 5) }
  ],
  hexagon: Array.from({ length: 6 }, (_, i) => ({
    x: Math.cos(i * Math.PI / 3),
    y: Math.sin(i * Math.PI / 3)
  })),
  l_shape: [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 2 }
  ],
  star: [
    { x: 0, y: 1 },
    { x: 0.2, y: 0.3 },
    { x: -0.8, y: 0.3 },
    { x: 0.1, y: -0.1 },
    { x: -0.5, y: -0.8 },
    { x: 0, y: 0.2 },
    { x: 0.5, y: -0.8 },
    { x: -0.1, y: -0.1 },
    { x: 0.8, y: 0.3 },
    { x: -0.2, y: 0.3 }
  ],
  arrow: [
    { x: 0, y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 0.5, y: 0.7 },
    { x: 1, y: 0.7 },
    { x: 1, y: 0.3 },
    { x: 0.5, y: 0.3 },
    { x: 0.5, y: 0 }
  ]
};

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const polygontriangulationTool: UnifiedTool = {
  name: 'polygon_triangulation',
  description: 'Polygon triangulation algorithms including ear clipping, monotone decomposition, fan triangulation, and Delaunay triangulation. Can triangulate any simple polygon or point set.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['triangulate', 'ear_clipping', 'fan', 'monotone', 'delaunay', 'analyze', 'examples', 'info'],
        description: 'Operation: triangulate (auto-select), ear_clipping, fan (convex only), monotone, delaunay, analyze polygon, examples, or info'
      },
      vertices: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        description: 'Array of polygon vertices as {x, y} objects'
      },
      polygon: {
        type: 'string',
        description: 'Named polygon: square, triangle, pentagon, hexagon, l_shape, star, arrow'
      },
      show_steps: {
        type: 'boolean',
        description: 'Show detailed execution steps'
      }
    },
    required: ['operation']
  }
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executepolygontriangulation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, vertices: inputVertices, polygon, show_steps } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'polygon-triangulation',
        description: 'Comprehensive polygon triangulation algorithms',
        algorithms: {
          ear_clipping: {
            description: 'Iteratively removes "ears" (triangles) from polygon',
            complexity: 'O(n²)',
            works_for: 'Any simple polygon',
            method: 'Find convex vertex with no other vertices inside, clip as triangle'
          },
          fan: {
            description: 'Creates fan of triangles from one vertex',
            complexity: 'O(n)',
            works_for: 'Convex polygons only',
            method: 'Connect all vertices to a single pivot vertex'
          },
          monotone: {
            description: 'Triangulates y-monotone polygons using stack',
            complexity: 'O(n)',
            works_for: 'Monotone polygons',
            method: 'Process vertices in y-order, maintain reflex chain'
          },
          delaunay: {
            description: 'Creates triangulation maximizing minimum angles',
            complexity: 'O(n log n)',
            works_for: 'Point sets',
            property: 'No point is inside circumcircle of any triangle'
          }
        },
        key_concepts: {
          ear: 'Triangle formed by three consecutive vertices where no other vertex is inside',
          convex_vertex: 'Interior angle < 180°',
          reflex_vertex: 'Interior angle > 180°',
          monotone_polygon: 'Boundary can be split into two chains monotone in some direction',
          circumcircle: 'Circle passing through all three vertices of a triangle',
          delaunay_property: 'Maximizes minimum angle across all triangles'
        },
        example_polygons: Object.keys(examplePolygons)
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      const examples = Object.entries(examplePolygons).map(([name, verts]) => ({
        name,
        vertices: verts.length,
        isConvex: isConvex(verts),
        area: Math.abs(signedArea(verts))
      }));
      return { toolCallId: id, content: JSON.stringify({ available_polygons: examples }, null, 2) };
    }

    // Get vertices
    let vertices: Point[];

    if (polygon && examplePolygons[polygon]) {
      vertices = examplePolygons[polygon];
    } else if (inputVertices && Array.isArray(inputVertices)) {
      vertices = inputVertices;
    } else {
      return {
        toolCallId: id,
        content: 'Error: Provide vertices array or polygon name (square, triangle, pentagon, hexagon, l_shape, star, arrow)',
        isError: true
      };
    }

    if (vertices.length < 3) {
      return {
        toolCallId: id,
        content: 'Error: Need at least 3 vertices for triangulation',
        isError: true
      };
    }

    // Analyze operation
    if (operation === 'analyze') {
      const analysis = {
        vertex_count: vertices.length,
        vertices: vertices.map((v, i) => ({ index: i, x: v.x, y: v.y })),
        is_convex: isConvex(vertices),
        is_simple: isSimplePolygon(vertices),
        is_ccw: isCounterClockwise(vertices),
        signed_area: signedArea(vertices),
        area: Math.abs(signedArea(vertices)),
        expected_triangles: vertices.length - 2,
        recommended_algorithm: isConvex(vertices) ? 'fan (fastest for convex)' : 'ear_clipping (works for any simple polygon)'
      };
      return { toolCallId: id, content: JSON.stringify(analysis, null, 2) };
    }

    // Triangulation operations
    let result: TriangulationResult;

    switch (operation) {
      case 'ear_clipping':
        result = earClipping(vertices);
        break;

      case 'fan':
        result = fanTriangulation(vertices);
        break;

      case 'monotone':
        result = monotoneTriangulation(vertices);
        break;

      case 'delaunay':
        result = delaunayTriangulation(vertices);
        break;

      case 'triangulate':
      default:
        // Auto-select best algorithm
        if (isConvex(vertices)) {
          result = fanTriangulation(vertices);
        } else {
          result = earClipping(vertices);
        }
        break;
    }

    // Format output
    const output: Record<string, unknown> = {
      algorithm: result.algorithm,
      polygon: {
        vertex_count: result.vertexCount,
        is_convex: result.isConvex,
        is_simple: result.isSimple
      },
      triangulation: {
        triangle_count: result.triangleCount,
        total_area: result.totalArea,
        expected_triangles: result.vertexCount - 2
      },
      triangles: result.triangles.map((t, i) => ({
        index: i,
        vertex_indices: t.indices,
        area: t.area,
        centroid: t.centroid
      }))
    };

    if (show_steps && result.executionSteps) {
      output.execution_steps = result.executionSteps;
    }

    return { toolCallId: id, content: JSON.stringify(output, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispolygontriangulationAvailable(): boolean {
  return true;
}
