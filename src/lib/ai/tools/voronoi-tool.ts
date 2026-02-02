/**
 * VORONOI DIAGRAM TOOL
 * Generate Voronoi diagrams and Delaunay triangulations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Point { x: number; y: number; }
interface Edge { p1: Point; p2: Point; }
interface Triangle { p1: Point; p2: Point; p3: Point; }
// VoronoiCell is reserved for future Voronoi cell operations
type VoronoiCell = { site: Point; vertices: Point[]; };
export type { VoronoiCell };

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function circumcenter(t: Triangle): Point {
  const ax = t.p1.x, ay = t.p1.y;
  const bx = t.p2.x, by = t.p2.y;
  const cx = t.p3.x, cy = t.p3.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  return { x: ux, y: uy };
}

function inCircumcircle(t: Triangle, p: Point): boolean {
  const center = circumcenter(t);
  const radius = distance(center, t.p1);
  return distance(center, p) < radius;
}

function bowyerWatson(points: Point[], width: number, height: number): Triangle[] {
  // Super triangle
  const superTriangle: Triangle = {
    p1: { x: -width, y: -height },
    p2: { x: width * 2, y: -height },
    p3: { x: width / 2, y: height * 3 }
  };

  let triangles: Triangle[] = [superTriangle];

  for (const point of points) {
    const badTriangles: Triangle[] = [];
    const polygon: Edge[] = [];

    for (const t of triangles) {
      if (inCircumcircle(t, point)) {
        badTriangles.push(t);
      }
    }

    for (const t of badTriangles) {
      const edges: Edge[] = [
        { p1: t.p1, p2: t.p2 },
        { p1: t.p2, p2: t.p3 },
        { p1: t.p3, p2: t.p1 }
      ];
      for (const edge of edges) {
        let shared = false;
        for (const other of badTriangles) {
          if (other === t) continue;
          const otherEdges: Edge[] = [
            { p1: other.p1, p2: other.p2 },
            { p1: other.p2, p2: other.p3 },
            { p1: other.p3, p2: other.p1 }
          ];
          for (const oe of otherEdges) {
            if ((edge.p1.x === oe.p1.x && edge.p1.y === oe.p1.y && edge.p2.x === oe.p2.x && edge.p2.y === oe.p2.y) ||
                (edge.p1.x === oe.p2.x && edge.p1.y === oe.p2.y && edge.p2.x === oe.p1.x && edge.p2.y === oe.p1.y)) {
              shared = true;
              break;
            }
          }
          if (shared) break;
        }
        if (!shared) polygon.push(edge);
      }
    }

    triangles = triangles.filter(t => !badTriangles.includes(t));

    for (const edge of polygon) {
      triangles.push({ p1: edge.p1, p2: edge.p2, p3: point });
    }
  }

  // Remove triangles connected to super triangle
  return triangles.filter(t => {
    const superVerts = [superTriangle.p1, superTriangle.p2, superTriangle.p3];
    return !superVerts.some(sv =>
      (t.p1.x === sv.x && t.p1.y === sv.y) ||
      (t.p2.x === sv.x && t.p2.y === sv.y) ||
      (t.p3.x === sv.x && t.p3.y === sv.y)
    );
  });
}

function generateRandomPoints(count: number, width: number, height: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({ x: Math.random() * width, y: Math.random() * height });
  }
  return points;
}

function nearestSite(p: Point, sites: Point[]): number {
  let minDist = Infinity, idx = 0;
  for (let i = 0; i < sites.length; i++) {
    const d = distance(p, sites[i]);
    if (d < minDist) { minDist = d; idx = i; }
  }
  return idx;
}

function voronoiToAscii(sites: Point[], width: number, height: number, charWidth: number, charHeight: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const lines: string[] = [];
  for (let y = 0; y < charHeight; y++) {
    let line = '';
    for (let x = 0; x < charWidth; x++) {
      const p = { x: (x / charWidth) * width, y: (y / charHeight) * height };
      const idx = nearestSite(p, sites);
      line += chars[idx % chars.length];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function lloydRelaxation(sites: Point[], width: number, height: number, iterations: number): Point[] {
  let currentSites = [...sites];
  for (let iter = 0; iter < iterations; iter++) {
    const centroids: Point[] = sites.map(() => ({ x: 0, y: 0 }));
    const counts: number[] = sites.map(() => 0);

    // Sample points and accumulate
    for (let i = 0; i < 1000; i++) {
      const p = { x: Math.random() * width, y: Math.random() * height };
      const idx = nearestSite(p, currentSites);
      centroids[idx].x += p.x;
      centroids[idx].y += p.y;
      counts[idx]++;
    }

    currentSites = centroids.map((c, i) => counts[i] > 0 ? { x: c.x / counts[i], y: c.y / counts[i] } : currentSites[i]);
  }
  return currentSites;
}

export const voronoiTool: UnifiedTool = {
  name: 'voronoi',
  description: 'Voronoi Diagram: generate, delaunay, relax, ascii, cells',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'delaunay', 'relax', 'ascii', 'cells'] },
      points: { type: 'array', items: { type: 'object' } },
      count: { type: 'number' },
      width: { type: 'number' },
      height: { type: 'number' },
      iterations: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeVoronoi(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const w = args.width || 100, h = args.height || 100;
    const count = args.count || 10;
    const points: Point[] = args.points || generateRandomPoints(count, w, h);
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'generate':
        result = { sites: points, width: w, height: h };
        break;
      case 'delaunay':
        const triangles = bowyerWatson(points, w, h);
        result = { triangles, count: triangles.length };
        break;
      case 'relax':
        const relaxed = lloydRelaxation(points, w, h, args.iterations || 3);
        result = { sites: relaxed, iterations: args.iterations || 3 };
        break;
      case 'ascii':
        result = { ascii: voronoiToAscii(points, w, h, 60, 30) };
        break;
      case 'cells':
        result = { sites: points, cellCount: points.length, description: 'Each site defines a cell containing all points closer to it than any other site' };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isVoronoiAvailable(): boolean { return true; }
