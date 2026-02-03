/**
 * QUADTREE TOOL
 * Spatial partitioning with quadtrees and octrees
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Point { x: number; y: number; data?: unknown; }
interface Rect { x: number; y: number; width: number; height: number; }

class QuadTree {
  boundary: Rect;
  capacity: number;
  points: Point[] = [];
  divided = false;
  northeast?: QuadTree;
  northwest?: QuadTree;
  southeast?: QuadTree;
  southwest?: QuadTree;

  constructor(boundary: Rect, capacity: number = 4) {
    this.boundary = boundary;
    this.capacity = capacity;
  }

  contains(point: Point): boolean {
    return point.x >= this.boundary.x &&
           point.x < this.boundary.x + this.boundary.width &&
           point.y >= this.boundary.y &&
           point.y < this.boundary.y + this.boundary.height;
  }

  intersects(range: Rect): boolean {
    return !(range.x > this.boundary.x + this.boundary.width ||
             range.x + range.width < this.boundary.x ||
             range.y > this.boundary.y + this.boundary.height ||
             range.y + range.height < this.boundary.y);
  }

  subdivide(): void {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.width / 2;
    const h = this.boundary.height / 2;

    this.northeast = new QuadTree({ x: x + w, y, width: w, height: h }, this.capacity);
    this.northwest = new QuadTree({ x, y, width: w, height: h }, this.capacity);
    this.southeast = new QuadTree({ x: x + w, y: y + h, width: w, height: h }, this.capacity);
    this.southwest = new QuadTree({ x, y: y + h, width: w, height: h }, this.capacity);
    this.divided = true;
  }

  insert(point: Point): boolean {
    if (!this.contains(point)) return false;

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) this.subdivide();

    return this.northeast!.insert(point) ||
           this.northwest!.insert(point) ||
           this.southeast!.insert(point) ||
           this.southwest!.insert(point);
  }

  query(range: Rect): Point[] {
    const found: Point[] = [];
    if (!this.intersects(range)) return found;

    for (const p of this.points) {
      if (p.x >= range.x && p.x < range.x + range.width &&
          p.y >= range.y && p.y < range.y + range.height) {
        found.push(p);
      }
    }

    if (this.divided) {
      found.push(...this.northeast!.query(range));
      found.push(...this.northwest!.query(range));
      found.push(...this.southeast!.query(range));
      found.push(...this.southwest!.query(range));
    }

    return found;
  }

  queryCircle(cx: number, cy: number, radius: number): Point[] {
    const range: Rect = { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 };
    const candidates = this.query(range);
    return candidates.filter(p => {
      const dx = p.x - cx, dy = p.y - cy;
      return dx * dx + dy * dy <= radius * radius;
    });
  }

  getStats(): { nodes: number; points: number; depth: number } {
    let nodes = 1;
    let points = this.points.length;
    let depth = 1;

    if (this.divided) {
      const ne = this.northeast!.getStats();
      const nw = this.northwest!.getStats();
      const se = this.southeast!.getStats();
      const sw = this.southwest!.getStats();
      nodes += ne.nodes + nw.nodes + se.nodes + sw.nodes;
      points += ne.points + nw.points + se.points + sw.points;
      depth += Math.max(ne.depth, nw.depth, se.depth, sw.depth);
    }

    return { nodes, points, depth };
  }

  visualize(depth: number = 0): string[] {
    const lines: string[] = [];
    const indent = '  '.repeat(depth);
    lines.push(`${indent}[${this.boundary.x},${this.boundary.y} ${this.boundary.width}x${this.boundary.height}] (${this.points.length} pts)`);

    if (this.divided) {
      lines.push(`${indent}NW:`); lines.push(...this.northwest!.visualize(depth + 1));
      lines.push(`${indent}NE:`); lines.push(...this.northeast!.visualize(depth + 1));
      lines.push(`${indent}SW:`); lines.push(...this.southwest!.visualize(depth + 1));
      lines.push(`${indent}SE:`); lines.push(...this.southeast!.visualize(depth + 1));
    }

    return lines;
  }

  toAscii(charWidth: number, charHeight: number): string {
    const grid: string[][] = Array(charHeight).fill(null).map(() => Array(charWidth).fill(' '));

    const drawRect = (rect: Rect, _char: string = '+') => {
      const x1 = Math.floor((rect.x / this.boundary.width) * charWidth);
      const y1 = Math.floor((rect.y / this.boundary.height) * charHeight);
      const x2 = Math.floor(((rect.x + rect.width) / this.boundary.width) * charWidth);
      const y2 = Math.floor(((rect.y + rect.height) / this.boundary.height) * charHeight);

      for (let x = x1; x <= Math.min(x2, charWidth - 1); x++) {
        if (y1 >= 0 && y1 < charHeight) grid[y1][x] = '-';
        if (y2 >= 0 && y2 < charHeight) grid[y2][x] = '-';
      }
      for (let y = y1; y <= Math.min(y2, charHeight - 1); y++) {
        if (x1 >= 0 && x1 < charWidth) grid[y][x1] = '|';
        if (x2 >= 0 && x2 < charWidth) grid[y][x2] = '|';
      }
    };

    const drawQuad = (qt: QuadTree) => {
      drawRect(qt.boundary);
      for (const p of qt.points) {
        const px = Math.floor((p.x / this.boundary.width) * charWidth);
        const py = Math.floor((p.y / this.boundary.height) * charHeight);
        if (px >= 0 && px < charWidth && py >= 0 && py < charHeight) {
          grid[py][px] = '*';
        }
      }
      if (qt.divided) {
        drawQuad(qt.northeast!);
        drawQuad(qt.northwest!);
        drawQuad(qt.southeast!);
        drawQuad(qt.southwest!);
      }
    };

    drawQuad(this);
    return grid.map(row => row.join('')).join('\n');
  }
}

function generateRandomPoints(count: number, width: number, height: number): Point[] {
  return Array(count).fill(null).map(() => ({
    x: Math.random() * width,
    y: Math.random() * height
  }));
}

export const quadtreeTool: UnifiedTool = {
  name: 'quadtree',
  description: 'Quadtree: create, insert, query, query_circle, stats, visualize, ascii',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'insert', 'query', 'query_circle', 'stats', 'visualize', 'ascii', 'benchmark'] },
      boundary: { type: 'object' },
      capacity: { type: 'number' },
      points: { type: 'array' },
      range: { type: 'object' },
      center: { type: 'object' },
      radius: { type: 'number' },
      count: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeQuadtree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const boundary: Rect = args.boundary || { x: 0, y: 0, width: 400, height: 400 };
    const qt = new QuadTree(boundary, args.capacity || 4);
    const points: Point[] = args.points || generateRandomPoints(args.count || 50, boundary.width, boundary.height);
    let result: Record<string, unknown>;

    // Insert all points
    for (const p of points) qt.insert(p);

    switch (args.operation) {
      case 'create':
        result = { boundary, capacity: args.capacity || 4, stats: qt.getStats() };
        break;
      case 'insert':
        result = { inserted: points.length, stats: qt.getStats() };
        break;
      case 'query':
        const range = args.range || { x: 100, y: 100, width: 100, height: 100 };
        const found = qt.query(range);
        result = { range, found: found.length, points: found.slice(0, 20) };
        break;
      case 'query_circle':
        const center = args.center || { x: 200, y: 200 };
        const radius = args.radius || 50;
        const circleFound = qt.queryCircle(center.x, center.y, radius);
        result = { center, radius, found: circleFound.length, points: circleFound.slice(0, 20) };
        break;
      case 'stats':
        result = qt.getStats();
        break;
      case 'visualize':
        result = { tree: qt.visualize().slice(0, 50).join('\n') };
        break;
      case 'ascii':
        result = { ascii: qt.toAscii(60, 30) };
        break;
      case 'benchmark':
        const counts = [100, 1000, 5000];
        const results: Record<string, unknown>[] = [];
        for (const c of counts) {
          const pts = generateRandomPoints(c, boundary.width, boundary.height);
          const testQt = new QuadTree(boundary, 4);
          const insertStart = performance.now();
          for (const p of pts) testQt.insert(p);
          const insertTime = performance.now() - insertStart;

          const queryRange = { x: 150, y: 150, width: 100, height: 100 };
          const queryStart = performance.now();
          for (let i = 0; i < 100; i++) testQt.query(queryRange);
          const queryTime = (performance.now() - queryStart) / 100;

          results.push({ pointCount: c, insertMs: insertTime.toFixed(2), queryMs: queryTime.toFixed(4), ...testQt.getStats() });
        }
        result = { benchmark: results };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isQuadtreeAvailable(): boolean { return true; }
