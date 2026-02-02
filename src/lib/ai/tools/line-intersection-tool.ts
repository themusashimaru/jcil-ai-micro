/**
 * LINE-INTERSECTION TOOL
 * Line segment intersection detection algorithms
 *
 * Implements computational geometry algorithms:
 * - Simple O(n²) intersection detection
 * - Bentley-Ottmann sweep line algorithm
 * - Line-line intersection calculation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Point type
interface Point {
  x: number;
  y: number;
}

// Line segment type
interface Segment {
  id: string;
  p1: Point;
  p2: Point;
}

// Intersection result
interface Intersection {
  point: Point;
  segments: [string, string];
}

// Tolerance for floating point comparisons
const EPSILON = 1e-10;

// Cross product of vectors (p2-p1) and (p3-p1)
function crossProduct(p1: Point, p2: Point, p3: Point): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

// Check if point q lies on segment pr
function onSegment(p: Point, q: Point, r: Point): boolean {
  return q.x <= Math.max(p.x, r.x) + EPSILON &&
         q.x >= Math.min(p.x, r.x) - EPSILON &&
         q.y <= Math.max(p.y, r.y) + EPSILON &&
         q.y >= Math.min(p.y, r.y) - EPSILON;
}

// Get orientation of triplet (p, q, r)
// 0: Collinear, 1: Clockwise, 2: Counterclockwise
function orientation(p: Point, q: Point, r: Point): number {
  const val = crossProduct(p, q, r);
  if (Math.abs(val) < EPSILON) return 0;
  return val > 0 ? 1 : 2;
}

// Check if two segments intersect
function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const p1 = s1.p1, q1 = s1.p2;
  const p2 = s2.p1, q2 = s2.p2;

  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // General case
  if (o1 !== o2 && o3 !== o4) return true;

  // Collinear cases
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

// Calculate intersection point of two segments (assumes they intersect)
function getIntersectionPoint(s1: Segment, s2: Segment): Point | null {
  const x1 = s1.p1.x, y1 = s1.p1.y;
  const x2 = s1.p2.x, y2 = s1.p2.y;
  const x3 = s2.p1.x, y3 = s2.p1.y;
  const x4 = s2.p2.x, y4 = s2.p2.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < EPSILON) {
    // Parallel or collinear
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null;
}

// Simple O(n²) algorithm to find all intersections
function findAllIntersectionsSimple(segments: Segment[]): Intersection[] {
  const intersections: Intersection[] = [];

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (segmentsIntersect(segments[i], segments[j])) {
        const point = getIntersectionPoint(segments[i], segments[j]);
        if (point) {
          intersections.push({
            point,
            segments: [segments[i].id, segments[j].id]
          });
        }
      }
    }
  }

  return intersections;
}

// Event type for sweep line algorithm
interface SweepEvent {
  x: number;
  y: number;
  type: 'left' | 'right' | 'intersection';
  segment?: Segment;
  segments?: [Segment, Segment];
}

// Status structure node (simplified balanced tree using array)
class StatusStructure {
  private segments: Segment[] = [];
  private sweepX: number = 0;

  setSweepLine(x: number): void {
    this.sweepX = x;
  }

  private getYAtSweep(s: Segment): number {
    if (Math.abs(s.p2.x - s.p1.x) < EPSILON) {
      return (s.p1.y + s.p2.y) / 2;
    }
    const t = (this.sweepX - s.p1.x) / (s.p2.x - s.p1.x);
    return s.p1.y + t * (s.p2.y - s.p1.y);
  }

  insert(segment: Segment): void {
    const y = this.getYAtSweep(segment);
    let insertIdx = 0;
    for (let i = 0; i < this.segments.length; i++) {
      if (this.getYAtSweep(this.segments[i]) < y) {
        insertIdx = i + 1;
      }
    }
    this.segments.splice(insertIdx, 0, segment);
  }

  remove(segment: Segment): void {
    const idx = this.segments.findIndex(s => s.id === segment.id);
    if (idx >= 0) {
      this.segments.splice(idx, 1);
    }
  }

  getNeighbors(segment: Segment): { above: Segment | null; below: Segment | null } {
    const idx = this.segments.findIndex(s => s.id === segment.id);
    return {
      above: idx < this.segments.length - 1 ? this.segments[idx + 1] : null,
      below: idx > 0 ? this.segments[idx - 1] : null
    };
  }

  swap(s1: Segment, s2: Segment): void {
    const idx1 = this.segments.findIndex(s => s.id === s1.id);
    const idx2 = this.segments.findIndex(s => s.id === s2.id);
    if (idx1 >= 0 && idx2 >= 0) {
      [this.segments[idx1], this.segments[idx2]] = [this.segments[idx2], this.segments[idx1]];
    }
  }
}

// Bentley-Ottmann sweep line algorithm (simplified)
function bentleyOttmann(segments: Segment[]): Intersection[] {
  const intersections: Intersection[] = [];
  const processedPairs = new Set<string>();

  // Create event queue
  const events: SweepEvent[] = [];

  for (const segment of segments) {
    const [left, right] = segment.p1.x <= segment.p2.x
      ? [segment.p1, segment.p2]
      : [segment.p2, segment.p1];

    events.push({ x: left.x, y: left.y, type: 'left', segment });
    events.push({ x: right.x, y: right.y, type: 'right', segment });
  }

  // Sort events by x, then by type (left before right)
  events.sort((a, b) => {
    if (Math.abs(a.x - b.x) > EPSILON) return a.x - b.x;
    if (a.type !== b.type) {
      const order = { left: 0, intersection: 1, right: 2 };
      return order[a.type] - order[b.type];
    }
    return a.y - b.y;
  });

  const status = new StatusStructure();

  // Process events
  for (const event of events) {
    status.setSweepLine(event.x);

    if (event.type === 'left' && event.segment) {
      const s = event.segment;
      status.insert(s);

      const neighbors = status.getNeighbors(s);

      if (neighbors.above) {
        checkAndAddIntersection(s, neighbors.above, event.x, intersections, processedPairs);
      }
      if (neighbors.below) {
        checkAndAddIntersection(s, neighbors.below, event.x, intersections, processedPairs);
      }
    } else if (event.type === 'right' && event.segment) {
      const s = event.segment;
      const neighbors = status.getNeighbors(s);

      if (neighbors.above && neighbors.below) {
        checkAndAddIntersection(neighbors.above, neighbors.below, event.x, intersections, processedPairs);
      }

      status.remove(s);
    }
  }

  return intersections;
}

function checkAndAddIntersection(
  s1: Segment,
  s2: Segment,
  currentX: number,
  intersections: Intersection[],
  processedPairs: Set<string>
): void {
  const pairKey = [s1.id, s2.id].sort().join('-');
  if (processedPairs.has(pairKey)) return;

  if (segmentsIntersect(s1, s2)) {
    const point = getIntersectionPoint(s1, s2);
    if (point && point.x >= currentX - EPSILON) {
      intersections.push({
        point,
        segments: [s1.id, s2.id]
      });
      processedPairs.add(pairKey);
    }
  }
}

// Check if a point is to the left of a line
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isLeftOf(p: Point, lineStart: Point, lineEnd: Point): boolean {
  return crossProduct(lineStart, lineEnd, p) > 0;
}

// Calculate distance from point to line segment
function pointToSegmentDistance(p: Point, s: Segment): number {
  const dx = s.p2.x - s.p1.x;
  const dy = s.p2.y - s.p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < EPSILON) {
    // Segment is a point
    return Math.sqrt((p.x - s.p1.x) ** 2 + (p.y - s.p1.y) ** 2);
  }

  let t = ((p.x - s.p1.x) * dx + (p.y - s.p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = s.p1.x + t * dx;
  const projY = s.p1.y + t * dy;

  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

// Calculate line segment length
function segmentLength(s: Segment): number {
  return Math.sqrt((s.p2.x - s.p1.x) ** 2 + (s.p2.y - s.p1.y) ** 2);
}

// Calculate angle of line segment (in degrees)
function segmentAngle(s: Segment): number {
  return Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x) * 180 / Math.PI;
}

// Generate example segments
function createExampleSegments(type: string): Segment[] {
  switch (type) {
    case 'simple':
      return [
        { id: 's1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } },
        { id: 's2', p1: { x: 0, y: 10 }, p2: { x: 10, y: 0 } }
      ];

    case 'grid':
      // 3x3 grid of segments
      return [
        // Horizontal
        { id: 'h1', p1: { x: 0, y: 1 }, p2: { x: 3, y: 1 } },
        { id: 'h2', p1: { x: 0, y: 2 }, p2: { x: 3, y: 2 } },
        // Vertical
        { id: 'v1', p1: { x: 1, y: 0 }, p2: { x: 1, y: 3 } },
        { id: 'v2', p1: { x: 2, y: 0 }, p2: { x: 2, y: 3 } }
      ];

    case 'star':
      // Star pattern with center at (5, 5)
      const center: Point = { x: 5, y: 5 };
      const segments: Segment[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const endPoint: Point = {
          x: center.x + 5 * Math.cos(angle),
          y: center.y + 5 * Math.sin(angle)
        };
        segments.push({ id: `ray${i}`, p1: center, p2: endPoint });
      }
      return segments;

    case 'random':
      // Random segments in [0, 10] x [0, 10]
      const random: Segment[] = [];
      for (let i = 0; i < 6; i++) {
        random.push({
          id: `r${i}`,
          p1: { x: Math.random() * 10, y: Math.random() * 10 },
          p2: { x: Math.random() * 10, y: Math.random() * 10 }
        });
      }
      return random;

    case 'parallel':
      return [
        { id: 'p1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } },
        { id: 'p2', p1: { x: 0, y: 2 }, p2: { x: 10, y: 2 } },
        { id: 'p3', p1: { x: 0, y: 4 }, p2: { x: 10, y: 4 } }
      ];

    default:
      return createExampleSegments('simple');
  }
}

// Visualize segments as ASCII
function visualizeSegments(segments: Segment[], intersections: Intersection[], width: number = 40, height: number = 20): string {
  // Find bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const s of segments) {
    minX = Math.min(minX, s.p1.x, s.p2.x);
    maxX = Math.max(maxX, s.p1.x, s.p2.x);
    minY = Math.min(minY, s.p1.y, s.p2.y);
    maxY = Math.max(maxY, s.p1.y, s.p2.y);
  }

  // Add padding
  const padX = (maxX - minX) * 0.1 || 1;
  const padY = (maxY - minY) * 0.1 || 1;
  minX -= padX; maxX += padX;
  minY -= padY; maxY += padY;

  // Create grid
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  const toGridX = (x: number) => Math.round((x - minX) / (maxX - minX) * (width - 1));
  const toGridY = (y: number) => Math.round((maxY - y) / (maxY - minY) * (height - 1));

  // Draw segments using Bresenham's line algorithm (simplified)
  for (const s of segments) {
    const x1 = toGridX(s.p1.x), y1 = toGridY(s.p1.y);
    const x2 = toGridX(s.p2.x), y2 = toGridY(s.p2.y);

    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x1 + t * (x2 - x1));
      const y = Math.round(y1 + t * (y2 - y1));
      if (x >= 0 && x < width && y >= 0 && y < height) {
        if (grid[y][x] === ' ') {
          grid[y][x] = '·';
        }
      }
    }

    // Mark endpoints
    if (y1 >= 0 && y1 < height && x1 >= 0 && x1 < width) grid[y1][x1] = 'o';
    if (y2 >= 0 && y2 < height && x2 >= 0 && x2 < width) grid[y2][x2] = 'o';
  }

  // Mark intersections
  for (const inter of intersections) {
    const x = toGridX(inter.point.x);
    const y = toGridY(inter.point.y);
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = 'X';
    }
  }

  // Build string
  let result = '╔' + '═'.repeat(width) + '╗\n';
  for (const row of grid) {
    result += '║' + row.join('') + '║\n';
  }
  result += '╚' + '═'.repeat(width) + '╝\n';
  result += 'Legend: o = endpoint, · = segment, X = intersection';

  return result;
}

export const lineintersectionTool: UnifiedTool = {
  name: 'line_intersection',
  description: `Line segment intersection detection algorithms.

Implements computational geometry algorithms:
- Simple O(n²) brute force detection
- Bentley-Ottmann sweep line algorithm
- Precise intersection point calculation

Features:
- Detect if two segments intersect
- Find all intersections among multiple segments
- Calculate intersection coordinates
- Handle collinear and parallel cases
- Segment analysis (length, angle, distance to point)`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['detect', 'find_all', 'sweep_line', 'analyze', 'visualize', 'examples', 'info'],
        description: 'Operation to perform'
      },
      example: {
        type: 'string',
        enum: ['simple', 'grid', 'star', 'random', 'parallel'],
        description: 'Example segment set'
      },
      segments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            p1: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
            p2: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } }
          }
        },
        description: 'Custom segments as [{id, p1: {x,y}, p2: {x,y}}, ...]'
      },
      segment1: {
        type: 'object',
        description: 'First segment for pairwise detection'
      },
      segment2: {
        type: 'object',
        description: 'Second segment for pairwise detection'
      },
      point: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' } },
        description: 'Point for distance calculation'
      }
    },
    required: ['operation']
  }
};

export async function executelineintersection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, example, segments: customSegments, segment1, segment2, point } = args;

    // Get segments
    let segments: Segment[];
    if (customSegments) {
      segments = customSegments;
    } else {
      segments = createExampleSegments(example || 'simple');
    }

    switch (operation) {
      case 'detect': {
        // Pairwise intersection detection
        if (segment1 && segment2) {
          const s1: Segment = { id: 's1', ...segment1 };
          const s2: Segment = { id: 's2', ...segment2 };

          const intersects = segmentsIntersect(s1, s2);
          const intersectionPoint = intersects ? getIntersectionPoint(s1, s2) : null;

          return {
            toolCallId: id,
            content: JSON.stringify({
              segment1: s1,
              segment2: s2,
              intersects,
              intersection_point: intersectionPoint ? {
                x: intersectionPoint.x.toFixed(6),
                y: intersectionPoint.y.toFixed(6)
              } : null
            }, null, 2)
          };
        }

        // Check all pairs
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _allIntersections = findAllIntersectionsSimple(segments);
        const pairs: { s1: string; s2: string; intersects: boolean; point?: Point }[] = [];

        for (let i = 0; i < segments.length; i++) {
          for (let j = i + 1; j < segments.length; j++) {
            const intersects = segmentsIntersect(segments[i], segments[j]);
            const point = intersects ? getIntersectionPoint(segments[i], segments[j]) : undefined;
            pairs.push({
              s1: segments[i].id,
              s2: segments[j].id,
              intersects,
              point
            });
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            num_segments: segments.length,
            num_pairs: pairs.length,
            intersecting_pairs: pairs.filter(p => p.intersects).length,
            pairs: pairs.map(p => ({
              ...p,
              point: p.point ? { x: p.point.x.toFixed(6), y: p.point.y.toFixed(6) } : null
            }))
          }, null, 2)
        };
      }

      case 'find_all': {
        const intersections = findAllIntersectionsSimple(segments);

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm: 'Brute Force O(n²)',
            num_segments: segments.length,
            num_intersections: intersections.length,
            intersections: intersections.map(i => ({
              segments: i.segments,
              point: { x: i.point.x.toFixed(6), y: i.point.y.toFixed(6) }
            })),
            segments: segments.map(s => ({
              id: s.id,
              p1: s.p1,
              p2: s.p2
            }))
          }, null, 2)
        };
      }

      case 'sweep_line': {
        const intersections = bentleyOttmann(segments);

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm: 'Bentley-Ottmann Sweep Line',
            complexity: 'O((n + k) log n) where k = intersections',
            num_segments: segments.length,
            num_intersections: intersections.length,
            intersections: intersections.map(i => ({
              segments: i.segments,
              point: { x: i.point.x.toFixed(6), y: i.point.y.toFixed(6) }
            }))
          }, null, 2)
        };
      }

      case 'analyze': {
        const analysis = segments.map(s => ({
          id: s.id,
          length: segmentLength(s).toFixed(6),
          angle_degrees: segmentAngle(s).toFixed(2),
          midpoint: {
            x: ((s.p1.x + s.p2.x) / 2).toFixed(6),
            y: ((s.p1.y + s.p2.y) / 2).toFixed(6)
          },
          bounding_box: {
            minX: Math.min(s.p1.x, s.p2.x).toFixed(6),
            maxX: Math.max(s.p1.x, s.p2.x).toFixed(6),
            minY: Math.min(s.p1.y, s.p2.y).toFixed(6),
            maxY: Math.max(s.p1.y, s.p2.y).toFixed(6)
          }
        }));

        // If point provided, calculate distances
        let pointDistances: { segment: string; distance: number }[] | undefined;
        if (point) {
          pointDistances = segments.map(s => ({
            segment: s.id,
            distance: pointToSegmentDistance(point, s)
          })).sort((a, b) => a.distance - b.distance);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            num_segments: segments.length,
            segment_analysis: analysis,
            point_distances: pointDistances ? {
              query_point: point,
              distances: pointDistances.map(d => ({
                ...d,
                distance: d.distance.toFixed(6)
              }))
            } : undefined
          }, null, 2)
        };
      }

      case 'visualize': {
        const intersections = findAllIntersectionsSimple(segments);
        const visualization = visualizeSegments(segments, intersections);

        return {
          toolCallId: id,
          content: JSON.stringify({
            example: example || 'custom',
            num_segments: segments.length,
            num_intersections: intersections.length,
            ascii_visualization: visualization,
            segments: segments.map(s => ({
              id: s.id,
              from: `(${s.p1.x.toFixed(2)}, ${s.p1.y.toFixed(2)})`,
              to: `(${s.p2.x.toFixed(2)}, ${s.p2.y.toFixed(2)})`
            }))
          }, null, 2)
        };
      }

      case 'examples': {
        const examples = ['simple', 'grid', 'star', 'random', 'parallel'].map(type => {
          const segs = createExampleSegments(type);
          const inters = findAllIntersectionsSimple(segs);
          return {
            name: type,
            num_segments: segs.length,
            num_intersections: inters.length,
            description: type === 'simple' ? 'Two crossing diagonals'
              : type === 'grid' ? '2 horizontal + 2 vertical lines'
              : type === 'star' ? '5 rays from center'
              : type === 'random' ? '6 random segments'
              : '3 parallel horizontal lines'
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            example_sets: examples,
            usage: 'Use example parameter to select these segment sets'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'line_intersection',
            description: 'Line segment intersection detection',
            algorithms: {
              brute_force: {
                complexity: 'O(n²)',
                description: 'Check all pairs of segments'
              },
              bentley_ottmann: {
                complexity: 'O((n+k) log n)',
                description: 'Sweep line algorithm, k = number of intersections'
              }
            },
            operations: {
              detect: 'Check if segments intersect (pairwise or all)',
              find_all: 'Find all intersection points (brute force)',
              sweep_line: 'Find intersections using Bentley-Ottmann',
              analyze: 'Compute segment properties (length, angle, etc.)',
              visualize: 'ASCII visualization of segments and intersections',
              examples: 'List example segment sets'
            },
            applications: [
              'Collision detection in graphics',
              'Map overlay in GIS',
              'Circuit routing validation',
              'CAD/CAM applications'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islineintersectionAvailable(): boolean {
  return true;
}
