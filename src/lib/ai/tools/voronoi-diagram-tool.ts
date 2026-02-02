/**
 * VORONOI-DIAGRAM TOOL
 * Voronoi diagrams and Delaunay triangulation
 * Fortune's algorithm concepts, nearest neighbor queries
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const voronoidiagramTool: UnifiedTool = {
  name: 'voronoi_diagram',
  description: 'Voronoi diagram and Delaunay triangulation computation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'voronoi', 'delaunay', 'nearest_neighbor', 'circumcircle', 'visualize', 'demonstrate'],
        description: 'Operation to perform'
      },
      points: { type: 'array', description: 'Array of [x, y] points (sites)' },
      query_point: { type: 'array', description: 'Query point [x, y] for nearest neighbor' },
      bounds: { type: 'object', description: 'Bounding box { minX, minY, maxX, maxY }' }
    },
    required: ['operation']
  }
};

// ===== TYPE DEFINITIONS =====

interface Point {
  x: number;
  y: number;
}

interface Edge {
  start: Point;
  end: Point;
}

interface Triangle {
  a: Point;
  b: Point;
  c: Point;
  circumcenter: Point;
  circumradius: number;
}

interface VoronoiCell {
  site: Point;
  vertices: Point[];
  edges: Edge[];
  neighbors: number[];
}

// ===== GEOMETRIC PRIMITIVES =====

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function cross(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

// Calculate circumcenter of triangle
function circumcenter(a: Point, b: Point, c: Point): { center: Point; radius: number } {
  const ax = a.x, ay = a.y;
  const bx = b.x, by = b.y;
  const cx = c.x, cy = c.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  if (Math.abs(d) < 1e-10) {
    // Collinear points
    return { center: { x: (ax + bx + cx) / 3, y: (ay + by + cy) / 3 }, radius: Infinity };
  }

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const center = { x: ux, y: uy };
  const radius = distance(center, a);

  return { center, radius };
}

// Check if point is inside circumcircle of triangle
function inCircumcircle(p: Point, a: Point, b: Point, c: Point): boolean {
  const { center, radius } = circumcenter(a, b, c);
  return distance(p, center) < radius - 1e-10;
}

// ===== DELAUNAY TRIANGULATION (Bowyer-Watson Algorithm) =====

function delaunayTriangulation(points: Point[]): Triangle[] {
  if (points.length < 3) return [];

  // Find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dmax = Math.max(dx, dy);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Create super-triangle that contains all points
  const superTriangle: Point[] = [
    { x: midX - 20 * dmax, y: midY - dmax },
    { x: midX, y: midY + 20 * dmax },
    { x: midX + 20 * dmax, y: midY - dmax }
  ];

  // Initialize triangulation with super-triangle
  let triangles: { a: Point; b: Point; c: Point }[] = [
    { a: superTriangle[0], b: superTriangle[1], c: superTriangle[2] }
  ];

  // Add each point to triangulation
  for (const point of points) {
    const badTriangles: typeof triangles = [];

    // Find all triangles whose circumcircle contains the point
    for (const tri of triangles) {
      if (inCircumcircle(point, tri.a, tri.b, tri.c)) {
        badTriangles.push(tri);
      }
    }

    // Find the boundary of the polygonal hole
    const polygon: { a: Point; b: Point }[] = [];

    for (const tri of badTriangles) {
      const edges = [
        { a: tri.a, b: tri.b },
        { a: tri.b, b: tri.c },
        { a: tri.c, b: tri.a }
      ];

      for (const edge of edges) {
        // Check if edge is shared by another bad triangle
        let shared = false;
        for (const other of badTriangles) {
          if (other === tri) continue;
          const otherEdges = [
            { a: other.a, b: other.b },
            { a: other.b, b: other.c },
            { a: other.c, b: other.a }
          ];
          for (const oe of otherEdges) {
            if ((edge.a === oe.a && edge.b === oe.b) || (edge.a === oe.b && edge.b === oe.a)) {
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
    triangles = triangles.filter(t => !badTriangles.includes(t));

    // Re-triangulate the hole
    for (const edge of polygon) {
      triangles.push({ a: edge.a, b: edge.b, c: point });
    }
  }

  // Remove triangles that share vertices with super-triangle
  triangles = triangles.filter(tri => {
    for (const sp of superTriangle) {
      if (tri.a === sp || tri.b === sp || tri.c === sp) return false;
    }
    return true;
  });

  // Add circumcircle info
  return triangles.map(tri => {
    const { center, radius } = circumcenter(tri.a, tri.b, tri.c);
    return {
      ...tri,
      circumcenter: center,
      circumradius: radius
    };
  });
}

// ===== VORONOI DIAGRAM (from Delaunay) =====

function voronoiDiagram(
  points: Point[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): VoronoiCell[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{
      site: points[0],
      vertices: [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY }
      ],
      edges: [],
      neighbors: []
    }];
  }

  const triangles = delaunayTriangulation(points);
  const cells: VoronoiCell[] = points.map(site => ({
    site,
    vertices: [],
    edges: [],
    neighbors: []
  }));

  // Build adjacency: for each point, find its Voronoi vertices (circumcenters of adjacent triangles)
  const pointTriangles: Map<string, Triangle[]> = new Map();

  for (const tri of triangles) {
    for (const p of [tri.a, tri.b, tri.c]) {
      const key = `${p.x},${p.y}`;
      if (!pointTriangles.has(key)) pointTriangles.set(key, []);
      pointTriangles.get(key)!.push(tri);
    }
  }

  // For each site, collect circumcenters and order them
  for (let i = 0; i < points.length; i++) {
    const site = points[i];
    const key = `${site.x},${site.y}`;
    const adjacentTris = pointTriangles.get(key) || [];

    // Collect circumcenters
    const vertices: Point[] = adjacentTris.map(t => t.circumcenter);

    // Sort vertices by angle around site
    if (vertices.length > 0) {
      vertices.sort((a, b) => {
        const angleA = Math.atan2(a.y - site.y, a.x - site.x);
        const angleB = Math.atan2(b.y - site.y, b.x - site.x);
        return angleA - angleB;
      });
    }

    // Find neighbors
    const neighbors: Set<number> = new Set();
    for (const tri of adjacentTris) {
      for (const p of [tri.a, tri.b, tri.c]) {
        if (p !== site) {
          const idx = points.findIndex(pt => pt.x === p.x && pt.y === p.y);
          if (idx !== -1 && idx !== i) neighbors.add(idx);
        }
      }
    }

    cells[i].vertices = vertices;
    cells[i].neighbors = Array.from(neighbors);

    // Create edges between consecutive vertices
    for (let j = 0; j < vertices.length; j++) {
      const next = (j + 1) % vertices.length;
      cells[i].edges.push({ start: vertices[j], end: vertices[next] });
    }
  }

  return cells;
}

// ===== NEAREST NEIGHBOR QUERY =====

function nearestNeighbor(query: Point, points: Point[]): { nearest: Point; distance: number; index: number } {
  if (points.length === 0) {
    return { nearest: query, distance: Infinity, index: -1 };
  }

  let minDist = Infinity;
  let minIdx = 0;

  for (let i = 0; i < points.length; i++) {
    const d = distance(query, points[i]);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }

  return { nearest: points[minIdx], distance: minDist, index: minIdx };
}

// K nearest neighbors
function kNearestNeighbors(query: Point, points: Point[], k: number): { point: Point; distance: number; index: number }[] {
  const distances = points.map((p, i) => ({
    point: p,
    distance: distance(query, p),
    index: i
  }));

  distances.sort((a, b) => a.distance - b.distance);

  return distances.slice(0, Math.min(k, points.length));
}

// ===== VISUALIZATION =====

function visualizeVoronoi(points: Point[], cells: VoronoiCell[], width: number = 40, height: number = 20): string[] {
  if (points.length === 0) return ['(no points)'];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Assign each grid cell to nearest point
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const x = minX + (gx / (width - 1)) * rangeX;
      const y = maxY - (gy / (height - 1)) * rangeY;
      const { index } = nearestNeighbor({ x, y }, points);
      // Use different characters for different regions
      const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
      grid[gy][gx] = chars[index % chars.length];
    }
  }

  // Mark site locations
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const gx = Math.round((p.x - minX) / rangeX * (width - 1));
    const gy = Math.round((maxY - p.y) / rangeY * (height - 1));
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
      grid[gy][gx] = '●';
    }
  }

  return grid.map(row => row.join(''));
}

function visualizeDelaunay(points: Point[], triangles: Triangle[], width: number = 40, height: number = 20): string[] {
  if (points.length === 0) return ['(no points)'];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  const toGrid = (p: Point): { gx: number; gy: number } => ({
    gx: Math.round((p.x - minX) / rangeX * (width - 1)),
    gy: Math.round((maxY - p.y) / rangeY * (height - 1))
  });

  // Draw triangle edges
  for (const tri of triangles) {
    const edges = [
      [tri.a, tri.b],
      [tri.b, tri.c],
      [tri.c, tri.a]
    ];

    for (const [start, end] of edges) {
      const s = toGrid(start);
      const e = toGrid(end);

      // Bresenham's line algorithm
      let x0 = s.gx, y0 = s.gy, x1 = e.gx, y1 = e.gy;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
          if (grid[y0][x0] === ' ') grid[y0][x0] = '·';
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    }
  }

  // Mark vertices
  for (const p of points) {
    const { gx, gy } = toGrid(p);
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
      grid[gy][gx] = '●';
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

export async function executevoronoidiagram(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'voronoi_diagram',
            description: 'Voronoi diagrams and Delaunay triangulation',
            concepts: {
              voronoi_diagram: 'Partitions plane into regions closest to each site point',
              voronoi_cell: 'Region of all points closest to a particular site',
              voronoi_edge: 'Points equidistant from exactly two sites',
              voronoi_vertex: 'Points equidistant from three or more sites',
              delaunay_triangulation: 'Triangulation maximizing minimum angle (dual of Voronoi)',
              circumcircle: 'Circle passing through all three vertices of a triangle'
            },
            duality: {
              voronoi_edge: 'Connects circumcenters of adjacent Delaunay triangles',
              voronoi_vertex: 'Circumcenter of a Delaunay triangle',
              delaunay_edge: 'Connects sites of adjacent Voronoi cells'
            },
            properties: {
              delaunay: [
                'No point lies inside any triangle\'s circumcircle',
                'Maximizes minimum angle (avoids skinny triangles)',
                'Unique for points in general position'
              ],
              voronoi: [
                'Each cell is a convex polygon',
                'Cells partition the plane',
                'Edges are perpendicular bisectors'
              ]
            },
            algorithms: {
              fortune: 'O(n log n) sweep line algorithm',
              bowyer_watson: 'O(n log n) to O(n²) incremental insertion',
              divide_conquer: 'O(n log n) divide and conquer'
            },
            applications: [
              'Nearest neighbor search',
              'Mesh generation for FEM',
              'Geographic analysis',
              'Cell biology (modeling)',
              'Path planning'
            ],
            operations: ['info', 'voronoi', 'delaunay', 'nearest_neighbor', 'circumcircle', 'visualize', 'demonstrate']
          }, null, 2)
        };
      }

      case 'voronoi': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(10);
        }

        const bounds = args.bounds || {
          minX: Math.min(...points.map(p => p.x)) - 10,
          minY: Math.min(...points.map(p => p.y)) - 10,
          maxX: Math.max(...points.map(p => p.x)) + 10,
          maxY: Math.max(...points.map(p => p.y)) + 10
        };

        const cells = voronoiDiagram(points, bounds);
        const visualization = visualizeVoronoi(points, cells);

        return {
          toolCallId: id,
          content: JSON.stringify({
            computation: 'Voronoi Diagram',
            sites: points.length,
            cells: cells.map((cell, i) => ({
              site_index: i,
              site: { x: Math.round(cell.site.x * 100) / 100, y: Math.round(cell.site.y * 100) / 100 },
              vertex_count: cell.vertices.length,
              neighbor_count: cell.neighbors.length,
              neighbors: cell.neighbors
            })),
            visualization: visualization.join('\n'),
            bounds,
            interpretation: 'Each region shows points closest to the site marked with ●'
          }, null, 2)
        };
      }

      case 'delaunay': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(10);
        }

        const triangles = delaunayTriangulation(points);
        const visualization = visualizeDelaunay(points, triangles);

        return {
          toolCallId: id,
          content: JSON.stringify({
            computation: 'Delaunay Triangulation',
            algorithm: 'Bowyer-Watson incremental insertion',
            points: points.length,
            triangles: triangles.length,
            triangle_details: triangles.slice(0, 10).map((tri, i) => ({
              index: i,
              vertices: [
                { x: Math.round(tri.a.x * 100) / 100, y: Math.round(tri.a.y * 100) / 100 },
                { x: Math.round(tri.b.x * 100) / 100, y: Math.round(tri.b.y * 100) / 100 },
                { x: Math.round(tri.c.x * 100) / 100, y: Math.round(tri.c.y * 100) / 100 }
              ],
              circumcenter: {
                x: Math.round(tri.circumcenter.x * 100) / 100,
                y: Math.round(tri.circumcenter.y * 100) / 100
              },
              circumradius: Math.round(tri.circumradius * 100) / 100
            })),
            euler_formula: {
              V: points.length,
              E: triangles.length * 3 / 2, // approximate for interior
              F: triangles.length,
              check: `V - E + F = ${points.length} - ${Math.round(triangles.length * 1.5)} + ${triangles.length} ≈ 2`
            },
            visualization: visualization.join('\n')
          }, null, 2)
        };
      }

      case 'nearest_neighbor': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(10);
        }

        let queryPoint: Point;
        if (args.query_point) {
          queryPoint = Array.isArray(args.query_point)
            ? { x: args.query_point[0], y: args.query_point[1] }
            : args.query_point;
        } else {
          queryPoint = { x: 50, y: 50 };
        }

        const k = args.k || 3;
        const knn = kNearestNeighbors(queryPoint, points, k);
        const nearest = knn[0];

        return {
          toolCallId: id,
          content: JSON.stringify({
            computation: 'Nearest Neighbor Query',
            query_point: { x: Math.round(queryPoint.x * 100) / 100, y: Math.round(queryPoint.y * 100) / 100 },
            total_points: points.length,
            nearest: {
              point: { x: Math.round(nearest.point.x * 100) / 100, y: Math.round(nearest.point.y * 100) / 100 },
              distance: Math.round(nearest.distance * 100) / 100,
              index: nearest.index
            },
            k_nearest: knn.map(n => ({
              point: { x: Math.round(n.point.x * 100) / 100, y: Math.round(n.point.y * 100) / 100 },
              distance: Math.round(n.distance * 100) / 100,
              index: n.index
            })),
            method: 'Brute force O(n)',
            voronoi_approach: 'With Voronoi diagram, query point lookup is O(log n) after O(n log n) preprocessing'
          }, null, 2)
        };
      }

      case 'circumcircle': {
        let points: Point[];
        if (args.points && Array.isArray(args.points) && args.points.length >= 3) {
          points = args.points.slice(0, 3).map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }];
        }

        const [a, b, c] = points;
        const { center, radius } = circumcenter(a, b, c);

        // Calculate triangle area
        const area = Math.abs(cross(a, b, c)) / 2;

        // Check Delaunay property with a test point
        const testPoint = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
        const insideCircle = distance(testPoint, center) < radius;

        return {
          toolCallId: id,
          content: JSON.stringify({
            computation: 'Circumcircle',
            triangle: {
              a: { x: Math.round(a.x * 100) / 100, y: Math.round(a.y * 100) / 100 },
              b: { x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 },
              c: { x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 }
            },
            circumcircle: {
              center: { x: Math.round(center.x * 100) / 100, y: Math.round(center.y * 100) / 100 },
              radius: Math.round(radius * 100) / 100
            },
            triangle_properties: {
              area: Math.round(area * 100) / 100,
              perimeter: Math.round((distance(a, b) + distance(b, c) + distance(c, a)) * 100) / 100
            },
            delaunay_property: {
              description: 'No point should lie inside the circumcircle of any Delaunay triangle',
              centroid_inside: insideCircle,
              centroid: { x: Math.round(testPoint.x * 100) / 100, y: Math.round(testPoint.y * 100) / 100 }
            },
            formula: {
              description: 'Circumcenter is equidistant from all three vertices',
              equation: 'Solve system: |PC|² = |PA|² = |PB|²'
            }
          }, null, 2)
        };
      }

      case 'visualize': {
        let points: Point[];
        if (args.points && Array.isArray(args.points)) {
          points = args.points.map((p: number[] | Point) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
        } else {
          points = generateRandomPoints(8);
        }

        const bounds = {
          minX: Math.min(...points.map(p => p.x)) - 10,
          minY: Math.min(...points.map(p => p.y)) - 10,
          maxX: Math.max(...points.map(p => p.x)) + 10,
          maxY: Math.max(...points.map(p => p.y)) + 10
        };

        const cells = voronoiDiagram(points, bounds);
        const triangles = delaunayTriangulation(points);

        const voronoiVis = visualizeVoronoi(points, cells);
        const delaunayVis = visualizeDelaunay(points, triangles);

        return {
          toolCallId: id,
          content: JSON.stringify({
            visualization: 'Voronoi and Delaunay',
            sites: points.map((p, i) => ({
              index: i,
              coordinates: { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }
            })),
            voronoi_diagram: {
              description: 'Each character shows which site is nearest. Sites marked with ●',
              ascii: voronoiVis.join('\n')
            },
            delaunay_triangulation: {
              description: 'Triangle edges shown with ·, vertices marked with ●',
              triangle_count: triangles.length,
              ascii: delaunayVis.join('\n')
            }
          }, null, 2)
        };
      }

      case 'demonstrate': {
        // Create a nice demo set
        const demoPoints: Point[] = [
          { x: 20, y: 20 }, { x: 80, y: 20 }, { x: 50, y: 50 },
          { x: 20, y: 80 }, { x: 80, y: 80 }, { x: 35, y: 35 },
          { x: 65, y: 65 }
        ];

        const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        const cells = voronoiDiagram(demoPoints, bounds);
        const triangles = delaunayTriangulation(demoPoints);

        // Query example
        const queryPoint = { x: 45, y: 55 };
        const nearest = nearestNeighbor(queryPoint, demoPoints);

        return {
          toolCallId: id,
          content: JSON.stringify({
            demonstration: 'Voronoi Diagram and Delaunay Triangulation',
            sites: demoPoints.map((p, i) => `Site ${i}: (${p.x}, ${p.y})`),
            voronoi: {
              cell_count: cells.length,
              description: 'Each cell contains all points closest to its site',
              visualization: visualizeVoronoi(demoPoints, cells).join('\n')
            },
            delaunay: {
              triangle_count: triangles.length,
              description: 'Triangulation with no point inside any circumcircle',
              sample_triangles: triangles.slice(0, 3).map((t, i) => ({
                triangle: i,
                circumradius: Math.round(t.circumradius * 10) / 10
              })),
              visualization: visualizeDelaunay(demoPoints, triangles).join('\n')
            },
            nearest_neighbor_example: {
              query: queryPoint,
              result: {
                nearest_site: nearest.index,
                coordinates: { x: nearest.nearest.x, y: nearest.nearest.y },
                distance: Math.round(nearest.distance * 100) / 100
              }
            },
            duality: {
              explanation: 'Voronoi vertices are Delaunay circumcenters',
              voronoi_edges: 'Perpendicular bisectors of Delaunay edges',
              delaunay_edges: 'Connect sites of adjacent Voronoi cells'
            },
            key_insights: [
              'Voronoi: "territory" of each site',
              'Delaunay: "good" triangulation (max min angle)',
              'Dual structures: one defines the other',
              'O(n log n) construction via Fortune\'s algorithm',
              'Applications: mesh generation, geographic analysis, clustering'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            available_operations: ['info', 'voronoi', 'delaunay', 'nearest_neighbor', 'circumcircle', 'visualize', 'demonstrate']
          }, null, 2)
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isvoronoidiagramAvailable(): boolean { return true; }
