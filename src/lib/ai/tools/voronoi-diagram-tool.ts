/**
 * VORONOI-DIAGRAM TOOL
 * Voronoi diagram and Delaunay triangulation computation
 *
 * Features:
 * - Fortune's algorithm for Voronoi diagrams
 * - Delaunay triangulation (dual of Voronoi)
 * - Nearest neighbor queries
 * - Voronoi cell properties
 * - Applications to clustering and spatial analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const voronoidiagramTool: UnifiedTool = {
  name: 'voronoi_diagram',
  description: 'Voronoi diagram computation, Delaunay triangulation, and spatial analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['compute', 'delaunay', 'nearest_neighbor', 'cell_properties', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      sites: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' }
        },
        description: 'Array of 2D site points'
      },
      query_point: {
        type: 'array',
        items: { type: 'number' },
        description: 'Query point for nearest neighbor'
      },
      bounds: {
        type: 'object',
        properties: {
          min_x: { type: 'number' },
          max_x: { type: 'number' },
          min_y: { type: 'number' },
          max_y: { type: 'number' }
        },
        description: 'Bounding box for clipping'
      }
    },
    required: ['operation']
  }
};

// Point interface
interface Point {
  x: number;
  y: number;
  index?: number;
}

// Edge of Voronoi diagram
interface VoronoiEdge {
  start: Point;
  end: Point | null;
  site1: number;
  site2: number;
}

// Voronoi cell
interface VoronoiCell {
  site: Point;
  vertices: Point[];
  neighbors: number[];
}

// Delaunay triangle
interface DelaunayTriangle {
  vertices: [number, number, number];
  circumcenter: Point;
  circumradius: number;
}

// Distance between points
function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Cross product for orientation test
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Compute circumcenter of triangle
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
  const ax = a.x - p.x, ay = a.y - p.y;
  const bx = b.x - p.x, by = b.y - p.y;
  const cx = c.x - p.x, cy = c.y - p.y;

  const det = (ax * ax + ay * ay) * (bx * cy - cx * by) -
              (bx * bx + by * by) * (ax * cy - cx * ay) +
              (cx * cx + cy * cy) * (ax * by - bx * ay);

  return det > 0;
}

// Simple incremental Delaunay triangulation (Bowyer-Watson)
function delaunayTriangulation(sites: Point[]): DelaunayTriangle[] {
  if (sites.length < 3) return [];

  // Create super-triangle that contains all points
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of sites) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const deltaMax = Math.max(dx, dy);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Super-triangle vertices
  const p1: Point = { x: midX - 20 * deltaMax, y: midY - deltaMax, index: -1 };
  const p2: Point = { x: midX, y: midY + 20 * deltaMax, index: -2 };
  const p3: Point = { x: midX + 20 * deltaMax, y: midY - deltaMax, index: -3 };

  // Triangle as vertex indices and vertices
  interface Tri {
    v: [Point, Point, Point];
    bad?: boolean;
  }

  let triangles: Tri[] = [{ v: [p1, p2, p3] }];

  // Add each point
  for (const point of sites) {
    // Find bad triangles
    const badTriangles: Tri[] = [];
    for (const tri of triangles) {
      if (inCircumcircle(point, tri.v[0], tri.v[1], tri.v[2])) {
        tri.bad = true;
        badTriangles.push(tri);
      }
    }

    // Find polygon hole boundary
    const polygon: [Point, Point][] = [];
    for (const tri of badTriangles) {
      for (let i = 0; i < 3; i++) {
        const edge: [Point, Point] = [tri.v[i], tri.v[(i + 1) % 3]];
        let shared = false;
        for (const other of badTriangles) {
          if (other === tri) continue;
          for (let j = 0; j < 3; j++) {
            const otherEdge: [Point, Point] = [other.v[j], other.v[(j + 1) % 3]];
            if ((edge[0] === otherEdge[0] && edge[1] === otherEdge[1]) ||
                (edge[0] === otherEdge[1] && edge[1] === otherEdge[0])) {
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
    triangles = triangles.filter(t => !t.bad);

    // Retriangulate
    for (const edge of polygon) {
      triangles.push({ v: [edge[0], edge[1], point] });
    }
  }

  // Remove triangles that share vertices with super-triangle
  triangles = triangles.filter(tri => {
    for (const v of tri.v) {
      if (v.index !== undefined && v.index < 0) return false;
    }
    return true;
  });

  // Convert to output format
  return triangles.map(tri => {
    const cc = circumcenter(tri.v[0], tri.v[1], tri.v[2]);
    return {
      vertices: [
        tri.v[0].index!,
        tri.v[1].index!,
        tri.v[2].index!
      ] as [number, number, number],
      circumcenter: cc.center,
      circumradius: cc.radius
    };
  });
}

// Build Voronoi diagram from Delaunay triangulation (dual graph)
function voronoiFromDelaunay(
  sites: Point[],
  triangles: DelaunayTriangle[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): { edges: VoronoiEdge[]; cells: VoronoiCell[] } {
  const edges: VoronoiEdge[] = [];
  const cellVertices: Map<number, Set<string>> = new Map();
  const cellNeighbors: Map<number, Set<number>> = new Map();

  // Initialize cell structures
  for (let i = 0; i < sites.length; i++) {
    cellVertices.set(i, new Set());
    cellNeighbors.set(i, new Set());
  }

  // Build adjacency map of triangles sharing edges
  const edgeToTriangles: Map<string, DelaunayTriangle[]> = new Map();
  for (const tri of triangles) {
    const verts = [...tri.vertices].sort((a, b) => a - b);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const edge = [verts[i], verts[j]].sort((a, b) => a - b).join(',');
      if (!edgeToTriangles.has(edge)) {
        edgeToTriangles.set(edge, []);
      }
      edgeToTriangles.get(edge)!.push(tri);
    }
  }

  // Create Voronoi edges from pairs of adjacent triangles
  for (const [edgeKey, tris] of edgeToTriangles) {
    const [site1, site2] = edgeKey.split(',').map(Number);

    if (tris.length === 2) {
      // Internal edge - connect circumcenters
      edges.push({
        start: tris[0].circumcenter,
        end: tris[1].circumcenter,
        site1,
        site2
      });
    } else if (tris.length === 1) {
      // Boundary edge - extend to infinity (or bounds)
      const cc = tris[0].circumcenter;
      const midX = (sites[site1].x + sites[site2].x) / 2;
      const midY = (sites[site1].y + sites[site2].y) / 2;

      // Direction perpendicular to the edge
      const dx = sites[site2].y - sites[site1].y;
      const dy = -(sites[site2].x - sites[site1].x);
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        const dirX = dx / len;
        const dirY = dy / len;

        // Check which direction to extend
        const toMid = { x: midX - cc.x, y: midY - cc.y };
        const dot = toMid.x * dirX + toMid.y * dirY;

        const extendDir = dot > 0 ? -1 : 1;
        const farPoint = {
          x: cc.x + extendDir * dirX * Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 2,
          y: cc.y + extendDir * dirY * Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 2
        };

        edges.push({
          start: cc,
          end: farPoint,
          site1,
          site2
        });
      }
    }

    // Record neighbor relationships
    cellNeighbors.get(site1)!.add(site2);
    cellNeighbors.get(site2)!.add(site1);
  }

  // Record vertices for each cell
  for (const tri of triangles) {
    const key = `${tri.circumcenter.x.toFixed(6)},${tri.circumcenter.y.toFixed(6)}`;
    for (const v of tri.vertices) {
      cellVertices.get(v)!.add(key);
    }
  }

  // Build cells
  const cells: VoronoiCell[] = [];
  for (let i = 0; i < sites.length; i++) {
    const vertices: Point[] = [];
    for (const vKey of cellVertices.get(i)!) {
      const [x, y] = vKey.split(',').map(Number);
      vertices.push({ x, y });
    }

    // Sort vertices by angle around site
    const site = sites[i];
    vertices.sort((a, b) => {
      const angleA = Math.atan2(a.y - site.y, a.x - site.x);
      const angleB = Math.atan2(b.y - site.y, b.x - site.x);
      return angleA - angleB;
    });

    cells.push({
      site,
      vertices,
      neighbors: [...cellNeighbors.get(i)!]
    });
  }

  return { edges, cells };
}

// Find nearest site to a query point
function nearestNeighbor(sites: Point[], query: Point): { index: number; site: Point; distance: number } {
  let minDist = Infinity;
  let nearest = 0;

  for (let i = 0; i < sites.length; i++) {
    const d = distance(sites[i], query);
    if (d < minDist) {
      minDist = d;
      nearest = i;
    }
  }

  return {
    index: nearest,
    site: sites[nearest],
    distance: minDist
  };
}

// Calculate area of Voronoi cell (if bounded)
function cellArea(vertices: Point[]): number {
  if (vertices.length < 3) return Infinity;

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }

  return Math.abs(area) / 2;
}

// Calculate centroid of cell
function cellCentroid(vertices: Point[]): Point {
  if (vertices.length === 0) return { x: 0, y: 0 };

  let cx = 0, cy = 0;
  for (const v of vertices) {
    cx += v.x;
    cy += v.y;
  }

  return {
    x: cx / vertices.length,
    y: cy / vertices.length
  };
}

// Generate sample sites
function generateSites(type: string, n: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }): Point[] {
  const sites: Point[] = [];
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  switch (type) {
    case 'random':
      for (let i = 0; i < n; i++) {
        sites.push({
          x: bounds.minX + Math.random() * width,
          y: bounds.minY + Math.random() * height,
          index: i
        });
      }
      break;

    case 'grid':
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      let idx = 0;
      for (let r = 0; r < rows && idx < n; r++) {
        for (let c = 0; c < cols && idx < n; c++) {
          sites.push({
            x: bounds.minX + (c + 0.5) * width / cols,
            y: bounds.minY + (r + 0.5) * height / rows,
            index: idx++
          });
        }
      }
      break;

    case 'poisson':
      // Simple Poisson disk sampling approximation
      const minDist = Math.sqrt(width * height / n) * 0.7;
      const maxAttempts = 30;
      sites.push({
        x: bounds.minX + Math.random() * width,
        y: bounds.minY + Math.random() * height,
        index: 0
      });

      while (sites.length < n) {
        let found = false;
        for (let attempt = 0; attempt < maxAttempts && !found; attempt++) {
          const candidate = {
            x: bounds.minX + Math.random() * width,
            y: bounds.minY + Math.random() * height,
            index: sites.length
          };

          let valid = true;
          for (const site of sites) {
            if (distance(candidate, site) < minDist) {
              valid = false;
              break;
            }
          }

          if (valid) {
            sites.push(candidate);
            found = true;
          }
        }

        if (!found) {
          // Fall back to random if can't find valid position
          sites.push({
            x: bounds.minX + Math.random() * width,
            y: bounds.minY + Math.random() * height,
            index: sites.length
          });
        }
      }
      break;

    default:
      for (let i = 0; i < n; i++) {
        sites.push({
          x: bounds.minX + Math.random() * width,
          y: bounds.minY + Math.random() * height,
          index: i
        });
      }
  }

  return sites;
}

export async function executevoronoidiagram(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'voronoi_diagram',
          description: 'Voronoi diagram and Delaunay triangulation computation',
          operations: {
            compute: 'Compute Voronoi diagram from sites',
            delaunay: 'Compute Delaunay triangulation',
            nearest_neighbor: 'Find nearest site to query point',
            cell_properties: 'Analyze Voronoi cell properties',
            analyze: 'Full spatial analysis'
          },
          features: [
            'Bowyer-Watson incremental Delaunay triangulation',
            'Voronoi diagram as dual of Delaunay',
            'Cell area and centroid computation',
            'Nearest neighbor queries',
            'Multiple site distributions (random, grid, Poisson)'
          ],
          applications: [
            'Nearest neighbor search',
            'Spatial clustering',
            'Mesh generation',
            'Territory assignment',
            'Coverage analysis'
          ],
          example: {
            operation: 'compute',
            sites: [[10,10], [50,20], [30,60], [70,50], [20,40]]
          }
        }, null, 2)
      };
    }

    // Parse bounds
    const bounds = args.bounds || { min_x: 0, max_x: 100, min_y: 0, max_y: 100 };
    const boundsObj = {
      minX: bounds.min_x || bounds.minX || 0,
      maxX: bounds.max_x || bounds.maxX || 100,
      minY: bounds.min_y || bounds.minY || 0,
      maxY: bounds.max_y || bounds.maxY || 100
    };

    // Parse or generate sites
    let sites: Point[];
    if (args.sites && args.sites.length > 0) {
      sites = args.sites.map((s: number[], i: number) => ({ x: s[0], y: s[1], index: i }));
    } else {
      const n = args.num_sites || 10;
      const distribution = args.distribution || 'random';
      sites = generateSites(distribution, n, boundsObj);
    }

    if (operation === 'compute') {
      const triangles = delaunayTriangulation(sites);
      const voronoi = voronoiFromDelaunay(sites, triangles, boundsObj);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'compute',
          num_sites: sites.length,
          sites: sites.map(s => [parseFloat(s.x.toFixed(2)), parseFloat(s.y.toFixed(2))]),
          voronoi_edges: voronoi.edges.slice(0, 30).map(e => ({
            start: [parseFloat(e.start.x.toFixed(2)), parseFloat(e.start.y.toFixed(2))],
            end: e.end ? [parseFloat(e.end.x.toFixed(2)), parseFloat(e.end.y.toFixed(2))] : null,
            sites: [e.site1, e.site2]
          })),
          num_edges: voronoi.edges.length,
          cells_summary: voronoi.cells.map((c, i) => ({
            site_index: i,
            num_vertices: c.vertices.length,
            num_neighbors: c.neighbors.length,
            neighbors: c.neighbors
          })).slice(0, 10),
          truncated: voronoi.edges.length > 30
        }, null, 2)
      };
    }

    if (operation === 'delaunay') {
      const triangles = delaunayTriangulation(sites);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'delaunay',
          num_sites: sites.length,
          num_triangles: triangles.length,
          triangles: triangles.slice(0, 30).map(t => ({
            vertices: t.vertices,
            circumcenter: [parseFloat(t.circumcenter.x.toFixed(2)), parseFloat(t.circumcenter.y.toFixed(2))],
            circumradius: parseFloat(t.circumradius.toFixed(2))
          })),
          properties: {
            expected_triangles: 2 * sites.length - 5,  // Approximate for convex hull
            avg_circumradius: parseFloat((triangles.reduce((s, t) => s + (isFinite(t.circumradius) ? t.circumradius : 0), 0) / triangles.length).toFixed(2))
          },
          truncated: triangles.length > 30
        }, null, 2)
      };
    }

    if (operation === 'nearest_neighbor') {
      const queryPoint = args.query_point;
      if (!queryPoint) {
        return { toolCallId: id, content: 'Error: query_point required', isError: true };
      }

      const query: Point = { x: queryPoint[0], y: queryPoint[1] };
      const result = nearestNeighbor(sites, query);

      // Also find k nearest
      const k = args.k || 5;
      const distances = sites.map((s, i) => ({ index: i, distance: distance(s, query) }));
      distances.sort((a, b) => a.distance - b.distance);
      const kNearest = distances.slice(0, Math.min(k, sites.length));

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'nearest_neighbor',
          query_point: queryPoint,
          nearest: {
            index: result.index,
            site: [result.site.x, result.site.y],
            distance: parseFloat(result.distance.toFixed(4))
          },
          k_nearest: kNearest.map(n => ({
            index: n.index,
            site: [sites[n.index].x, sites[n.index].y],
            distance: parseFloat(n.distance.toFixed(4))
          }))
        }, null, 2)
      };
    }

    if (operation === 'cell_properties') {
      const triangles = delaunayTriangulation(sites);
      const voronoi = voronoiFromDelaunay(sites, triangles, boundsObj);

      const cellProps = voronoi.cells.map((cell, i) => {
        const area = cellArea(cell.vertices);
        const centroid = cellCentroid(cell.vertices);

        return {
          site_index: i,
          site: [cell.site.x, cell.site.y],
          num_vertices: cell.vertices.length,
          num_neighbors: cell.neighbors.length,
          area: isFinite(area) ? parseFloat(area.toFixed(2)) : 'unbounded',
          centroid: [parseFloat(centroid.x.toFixed(2)), parseFloat(centroid.y.toFixed(2))],
          centroid_offset: parseFloat(distance(cell.site, centroid).toFixed(2))
        };
      });

      const boundedCells = cellProps.filter(c => typeof c.area === 'number');
      const totalArea = boundedCells.reduce((s, c) => s + (c.area as number), 0);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'cell_properties',
          cells: cellProps.slice(0, 15),
          summary: {
            total_cells: cellProps.length,
            bounded_cells: boundedCells.length,
            unbounded_cells: cellProps.length - boundedCells.length,
            total_bounded_area: parseFloat(totalArea.toFixed(2)),
            avg_cell_area: parseFloat((totalArea / boundedCells.length).toFixed(2)),
            avg_neighbors: parseFloat((cellProps.reduce((s, c) => s + c.num_neighbors, 0) / cellProps.length).toFixed(2))
          },
          truncated: cellProps.length > 15
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      const triangles = delaunayTriangulation(sites);
      const voronoi = voronoiFromDelaunay(sites, triangles, boundsObj);

      // Compute statistics
      const areas: number[] = [];
      const neighborCounts: number[] = [];

      for (const cell of voronoi.cells) {
        const area = cellArea(cell.vertices);
        if (isFinite(area)) areas.push(area);
        neighborCounts.push(cell.neighbors.length);
      }

      const avgArea = areas.length > 0 ? areas.reduce((a, b) => a + b, 0) / areas.length : 0;
      const avgNeighbors = neighborCounts.reduce((a, b) => a + b, 0) / neighborCounts.length;

      // Edge length statistics
      const edgeLengths = voronoi.edges
        .filter(e => e.end !== null)
        .map(e => distance(e.start, e.end!))
        .filter(l => isFinite(l) && l < (boundsObj.maxX - boundsObj.minX) * 2);

      const avgEdgeLength = edgeLengths.length > 0 ? edgeLengths.reduce((a, b) => a + b, 0) / edgeLengths.length : 0;

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          input: {
            num_sites: sites.length,
            bounds: boundsObj
          },
          delaunay: {
            num_triangles: triangles.length,
            avg_circumradius: parseFloat((triangles.reduce((s, t) => s + (isFinite(t.circumradius) ? t.circumradius : 0), 0) / triangles.length).toFixed(2))
          },
          voronoi: {
            num_edges: voronoi.edges.length,
            num_cells: voronoi.cells.length,
            bounded_cells: areas.length,
            avg_cell_area: parseFloat(avgArea.toFixed(2)),
            avg_neighbors: parseFloat(avgNeighbors.toFixed(2)),
            avg_edge_length: parseFloat(avgEdgeLength.toFixed(2))
          },
          spatial_distribution: {
            site_density: sites.length / ((boundsObj.maxX - boundsObj.minX) * (boundsObj.maxY - boundsObj.minY)),
            regularity_index: parseFloat((avgArea / (Math.pow(avgEdgeLength, 2) || 1)).toFixed(4))
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: `Unknown operation: ${operation}`,
        available_operations: ['compute', 'delaunay', 'nearest_neighbor', 'cell_properties', 'analyze', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isvoronoidiagramAvailable(): boolean {
  return true;
}
