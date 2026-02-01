/**
 * COLLISION DETECTION TOOL
 * AABB, Circle, Polygon, SAT collision algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Point { x: number; y: number; }
interface AABB { x: number; y: number; width: number; height: number; }
interface Circle { x: number; y: number; radius: number; }
interface Polygon { vertices: Point[]; }

// AABB vs AABB
function aabbVsAabb(a: AABB, b: AABB): { collision: boolean; overlap: Point | null } {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  if (overlapX > 0 && overlapY > 0) {
    return { collision: true, overlap: { x: overlapX, y: overlapY } };
  }
  return { collision: false, overlap: null };
}

// Circle vs Circle
function circleVsCircle(a: Circle, b: Circle): { collision: boolean; distance: number; overlap: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const overlap = (a.radius + b.radius) - distance;

  return { collision: overlap > 0, distance, overlap: Math.max(0, overlap) };
}

// Circle vs AABB
function circleVsAabb(circle: Circle, rect: AABB): { collision: boolean; closestPoint: Point } {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  const dx = circle.x - closestX, dy = circle.y - closestY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return { collision: distance < circle.radius, closestPoint: { x: closestX, y: closestY } };
}

// Point in AABB
function pointInAabb(point: Point, rect: AABB): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
         point.y >= rect.y && point.y <= rect.y + rect.height;
}

// Point in Circle
function pointInCircle(point: Point, circle: Circle): boolean {
  const dx = point.x - circle.x, dy = point.y - circle.y;
  return (dx * dx + dy * dy) <= circle.radius * circle.radius;
}

// Point in Polygon (ray casting)
function pointInPolygon(point: Point, polygon: Polygon): boolean {
  const { vertices } = polygon;
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

// Line vs Line intersection
function lineVsLine(p1: Point, p2: Point, p3: Point, p4: Point): { collision: boolean; point: Point | null } {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return { collision: false, point: null };

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { collision: true, point: { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) } };
  }
  return { collision: false, point: null };
}

// SAT (Separating Axis Theorem) for convex polygons
function satCollision(poly1: Polygon, poly2: Polygon): { collision: boolean; mtv: Point | null } {
  function getAxes(polygon: Polygon): Point[] {
    const axes: Point[] = [];
    for (let i = 0; i < polygon.vertices.length; i++) {
      const p1 = polygon.vertices[i];
      const p2 = polygon.vertices[(i + 1) % polygon.vertices.length];
      const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
      const normal = { x: -edge.y, y: edge.x };
      const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
      axes.push({ x: normal.x / len, y: normal.y / len });
    }
    return axes;
  }

  function project(polygon: Polygon, axis: Point): { min: number; max: number } {
    let min = Infinity, max = -Infinity;
    for (const v of polygon.vertices) {
      const proj = v.x * axis.x + v.y * axis.y;
      min = Math.min(min, proj);
      max = Math.max(max, proj);
    }
    return { min, max };
  }

  const axes = [...getAxes(poly1), ...getAxes(poly2)];
  let minOverlap = Infinity;
  let mtvAxis: Point | null = null;

  for (const axis of axes) {
    const proj1 = project(poly1, axis);
    const proj2 = project(poly2, axis);

    const overlap = Math.min(proj1.max - proj2.min, proj2.max - proj1.min);
    if (overlap < 0) return { collision: false, mtv: null };

    if (overlap < minOverlap) {
      minOverlap = overlap;
      mtvAxis = axis;
    }
  }

  return {
    collision: true,
    mtv: mtvAxis ? { x: mtvAxis.x * minOverlap, y: mtvAxis.y * minOverlap } : null
  };
}

// Spatial hash for broad phase
function createSpatialHash(cellSize: number, objects: Array<AABB & { id: string }>): Map<string, string[]> {
  const hash = new Map<string, string[]>();

  for (const obj of objects) {
    const minX = Math.floor(obj.x / cellSize);
    const maxX = Math.floor((obj.x + obj.width) / cellSize);
    const minY = Math.floor(obj.y / cellSize);
    const maxY = Math.floor((obj.y + obj.height) / cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        if (!hash.has(key)) hash.set(key, []);
        hash.get(key)!.push(obj.id);
      }
    }
  }

  return hash;
}

export const collisionDetectionTool: UnifiedTool = {
  name: 'collision_detection',
  description: 'Collision Detection: aabb, circle, polygon, sat, point_in, line, spatial_hash',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['aabb', 'circle', 'polygon', 'sat', 'point_in_aabb', 'point_in_circle', 'point_in_polygon', 'line', 'circle_aabb', 'spatial_hash'] },
      a: { type: 'object' },
      b: { type: 'object' },
      point: { type: 'object' },
      objects: { type: 'array' },
      cellSize: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeCollisionDetection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'aabb':
        const aabbA = args.a || { x: 0, y: 0, width: 50, height: 50 };
        const aabbB = args.b || { x: 30, y: 30, width: 50, height: 50 };
        result = { ...aabbVsAabb(aabbA, aabbB), a: aabbA, b: aabbB };
        break;
      case 'circle':
        const circleA = args.a || { x: 100, y: 100, radius: 30 };
        const circleB = args.b || { x: 120, y: 110, radius: 25 };
        result = { ...circleVsCircle(circleA, circleB), a: circleA, b: circleB };
        break;
      case 'circle_aabb':
        const circle = args.a || { x: 100, y: 100, radius: 30 };
        const rect = args.b || { x: 80, y: 80, width: 50, height: 50 };
        result = { ...circleVsAabb(circle, rect), circle, rect };
        break;
      case 'point_in_aabb':
        result = { inside: pointInAabb(args.point || { x: 25, y: 25 }, args.a || { x: 0, y: 0, width: 50, height: 50 }) };
        break;
      case 'point_in_circle':
        result = { inside: pointInCircle(args.point || { x: 105, y: 105 }, args.a || { x: 100, y: 100, radius: 30 }) };
        break;
      case 'point_in_polygon':
        const poly = args.a || { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
        result = { inside: pointInPolygon(args.point || { x: 50, y: 50 }, poly) };
        break;
      case 'line':
        const line1 = args.a || { p1: { x: 0, y: 0 }, p2: { x: 100, y: 100 } };
        const line2 = args.b || { p1: { x: 0, y: 100 }, p2: { x: 100, y: 0 } };
        result = lineVsLine(line1.p1, line1.p2, line2.p1, line2.p2);
        break;
      case 'sat':
        const poly1 = args.a || { vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] };
        const poly2 = args.b || { vertices: [{ x: 30, y: 30 }, { x: 80, y: 30 }, { x: 80, y: 80 }, { x: 30, y: 80 }] };
        result = { ...satCollision(poly1, poly2), poly1, poly2 };
        break;
      case 'spatial_hash':
        const objects = args.objects || [
          { id: 'a', x: 0, y: 0, width: 50, height: 50 },
          { id: 'b', x: 30, y: 30, width: 50, height: 50 },
          { id: 'c', x: 200, y: 200, width: 50, height: 50 }
        ];
        const hash = createSpatialHash(args.cellSize || 50, objects);
        result = { cells: Object.fromEntries(hash), potentialCollisions: [...hash.values()].filter(arr => arr.length > 1) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCollisionDetectionAvailable(): boolean { return true; }
