/**
 * COMPUTATIONAL GEOMETRY TOOL
 *
 * Computational geometry using delaunator and earcut.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Delaunay triangulation
 * - Voronoi diagrams
 * - Polygon triangulation
 * - Convex hull
 * - Point-in-polygon tests
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded libraries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Delaunator: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let earcut: any = null;

async function initGeometry(): Promise<boolean> {
  if (Delaunator && earcut) return true;
  try {
    const [delMod, earMod] = await Promise.all([import('delaunator'), import('earcut')]);
    Delaunator = delMod.default || delMod;
    earcut = earMod.default || earMod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const geometryTool: UnifiedTool = {
  name: 'compute_geometry',
  description: `Perform computational geometry operations.

Operations:
- delaunay: Delaunay triangulation of points
- voronoi: Voronoi diagram from points
- triangulate: Triangulate a polygon (with holes)
- convex_hull: Compute convex hull of points
- point_in_polygon: Test if point is inside polygon
- polygon_area: Calculate polygon area
- centroid: Calculate polygon centroid

Use cases:
- Mesh generation for simulations
- Spatial analysis
- Game development (terrain, pathfinding)
- Geographic data processing
- Computer graphics`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'delaunay',
          'voronoi',
          'triangulate',
          'convex_hull',
          'point_in_polygon',
          'polygon_area',
          'centroid',
        ],
        description: 'Geometry operation',
      },
      points: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of [x, y] coordinates: [[0,0], [1,0], [0.5, 1]]',
      },
      polygon: {
        type: 'array',
        items: { type: 'number' },
        description: 'Flat array of polygon vertices: [x1,y1,x2,y2,...]',
      },
      holes: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of hole start indices for triangulation',
      },
      test_point: {
        type: 'array',
        items: { type: 'number' },
        description: '[x, y] point to test',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isGeometryAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function pointInPolygon(point: number[], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

function calculatePolygonArea(vertices: number[][]): number {
  let area = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }

  return Math.abs(area / 2);
}

function calculateCentroid(vertices: number[][]): [number, number] {
  let cx = 0,
    cy = 0;
  const n = vertices.length;

  for (const [x, y] of vertices) {
    cx += x;
    cy += y;
  }

  return [cx / n, cy / n];
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeGeometry(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    points?: number[][];
    polygon?: number[];
    holes?: number[];
    test_point?: number[];
  };

  const { operation, points, polygon, holes, test_point } = args;

  try {
    const initialized = await initGeometry();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize geometry libraries' }),
        isError: true,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'delaunay': {
        if (!points || points.length < 3) {
          throw new Error('At least 3 points required for Delaunay triangulation');
        }

        // Flatten points for delaunator
        const coords = points.flat();
        const delaunay = new Delaunator(coords);

        // Extract triangles
        const triangles: number[][] = [];
        for (let i = 0; i < delaunay.triangles.length; i += 3) {
          triangles.push([
            delaunay.triangles[i],
            delaunay.triangles[i + 1],
            delaunay.triangles[i + 2],
          ]);
        }

        result = {
          operation: 'delaunay',
          input_points: points.length,
          triangles: triangles.length,
          triangle_indices: triangles.slice(0, 20), // First 20 triangles
          hull: Array.from(delaunay.hull),
        };
        break;
      }

      case 'voronoi': {
        if (!points || points.length < 3) {
          throw new Error('At least 3 points required for Voronoi diagram');
        }

        const coords = points.flat();
        const delaunay = new Delaunator(coords);

        // Compute circumcenters (Voronoi vertices)
        const circumcenters: number[][] = [];
        for (let i = 0; i < delaunay.triangles.length; i += 3) {
          const p0 = points[delaunay.triangles[i]];
          const p1 = points[delaunay.triangles[i + 1]];
          const p2 = points[delaunay.triangles[i + 2]];

          // Circumcenter calculation
          const d =
            2 * (p0[0] * (p1[1] - p2[1]) + p1[0] * (p2[1] - p0[1]) + p2[0] * (p0[1] - p1[1]));
          if (Math.abs(d) > 1e-10) {
            const ux =
              ((p0[0] * p0[0] + p0[1] * p0[1]) * (p1[1] - p2[1]) +
                (p1[0] * p1[0] + p1[1] * p1[1]) * (p2[1] - p0[1]) +
                (p2[0] * p2[0] + p2[1] * p2[1]) * (p0[1] - p1[1])) /
              d;
            const uy =
              ((p0[0] * p0[0] + p0[1] * p0[1]) * (p2[0] - p1[0]) +
                (p1[0] * p1[0] + p1[1] * p1[1]) * (p0[0] - p2[0]) +
                (p2[0] * p2[0] + p2[1] * p2[1]) * (p1[0] - p0[0])) /
              d;
            circumcenters.push([ux, uy]);
          }
        }

        result = {
          operation: 'voronoi',
          input_points: points.length,
          voronoi_vertices: circumcenters.length,
          vertices: circumcenters.slice(0, 20), // First 20 vertices
        };
        break;
      }

      case 'triangulate': {
        if (!polygon || polygon.length < 6) {
          throw new Error('Polygon needs at least 3 vertices (6 coordinates)');
        }

        const indices = earcut(polygon, holes);
        const triangleCount = indices.length / 3;

        // Extract actual triangles
        const triangles: number[][][] = [];
        for (let i = 0; i < Math.min(indices.length, 30); i += 3) {
          const t: number[][] = [];
          for (let j = 0; j < 3; j++) {
            const idx = indices[i + j] * 2;
            t.push([polygon[idx], polygon[idx + 1]]);
          }
          triangles.push(t);
        }

        result = {
          operation: 'triangulate',
          input_vertices: polygon.length / 2,
          holes: holes?.length || 0,
          output_triangles: triangleCount,
          triangle_indices: indices.slice(0, 30),
          sample_triangles: triangles.slice(0, 10),
        };
        break;
      }

      case 'convex_hull': {
        if (!points || points.length < 3) {
          throw new Error('At least 3 points required for convex hull');
        }

        const coords = points.flat();
        const delaunay = new Delaunator(coords);
        const hullIndices = Array.from(delaunay.hull) as number[];
        const hullPoints = hullIndices.map((i) => points[i]);

        result = {
          operation: 'convex_hull',
          input_points: points.length,
          hull_points: hullPoints.length,
          hull_indices: hullIndices,
          hull_vertices: hullPoints,
          hull_area: calculatePolygonArea(hullPoints),
        };
        break;
      }

      case 'point_in_polygon': {
        if (!points || !test_point) {
          throw new Error('points (polygon vertices) and test_point required');
        }

        const inside = pointInPolygon(test_point, points);

        result = {
          operation: 'point_in_polygon',
          test_point,
          polygon_vertices: points.length,
          inside,
        };
        break;
      }

      case 'polygon_area': {
        if (!points || points.length < 3) {
          throw new Error('At least 3 points required');
        }

        const area = calculatePolygonArea(points);

        result = {
          operation: 'polygon_area',
          vertices: points.length,
          area,
          perimeter: points.reduce((sum, p, i) => {
            const next = points[(i + 1) % points.length];
            return sum + Math.sqrt(Math.pow(next[0] - p[0], 2) + Math.pow(next[1] - p[1], 2));
          }, 0),
        };
        break;
      }

      case 'centroid': {
        if (!points || points.length < 3) {
          throw new Error('At least 3 points required');
        }

        const [cx, cy] = calculateCentroid(points);

        result = {
          operation: 'centroid',
          vertices: points.length,
          centroid: { x: cx, y: cy },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
