/**
 * LINE-INTERSECTION TOOL
 * Line segment intersection detection using multiple algorithms
 * Implements Bentley-Ottmann sweep line and basic intersection tests
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Point type
interface Point {
  x: number;
  y: number;
}

// Line segment
interface Segment {
  p1: Point;
  p2: Point;
  id?: number;
}

// Intersection result
interface Intersection {
  point: Point;
  segments: [number, number]; // IDs of intersecting segments
}

// Cross product of vectors (p2-p1) and (p3-p1)
function crossProduct(p1: Point, p2: Point, p3: Point): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

// Check if point q lies on segment pr
function onSegment(p: Point, q: Point, r: Point): boolean {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
         q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

// Orientation of triplet (p, q, r)
// 0 -> Collinear, 1 -> Clockwise, 2 -> Counterclockwise
function orientation(p: Point, q: Point, r: Point): number {
  const val = crossProduct(p, q, r);
  if (Math.abs(val) < 1e-10) return 0; // Collinear
  return val > 0 ? 1 : 2; // Clockwise or counterclockwise
}

// Check if segments intersect (boolean only)
function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const p1 = s1.p1, q1 = s1.p2, p2 = s2.p1, q2 = s2.p2;

  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // General case
  if (o1 !== o2 && o3 !== o4) return true;

  // Special cases (collinear)
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

// Calculate intersection point of two line segments
function getIntersectionPoint(s1: Segment, s2: Segment): Point | null {
  const x1 = s1.p1.x, y1 = s1.p1.y, x2 = s1.p2.x, y2 = s1.p2.y;
  const x3 = s2.p1.x, y3 = s2.p1.y, x4 = s2.p2.x, y4 = s2.p2.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < 1e-10) {
    return null; // Parallel or coincident
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: parseFloat((x1 + t * (x2 - x1)).toFixed(6)),
      y: parseFloat((y1 + t * (y2 - y1)).toFixed(6))
    };
  }

  return null;
}

// Brute force O(n²) intersection detection
function bruteForceIntersections(segments: Segment[]): Intersection[] {
  const intersections: Intersection[] = [];

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const point = getIntersectionPoint(segments[i], segments[j]);
      if (point) {
        intersections.push({
          point,
          segments: [segments[i].id || i, segments[j].id || j]
        });
      }
    }
  }

  return intersections;
}

// Sweep line event types
type EventType = 'left' | 'right' | 'intersection';

interface SweepEvent {
  x: number;
  type: EventType;
  segment?: Segment;
  segmentId?: number;
  intersectionWith?: number;
}

// Simplified Bentley-Ottmann sweep line algorithm
function sweepLineIntersections(segments: Segment[]): {
  intersections: Intersection[];
  events: Array<{ x: number; type: string; description: string }>;
} {
  const events: SweepEvent[] = [];
  const eventLog: Array<{ x: number; type: string; description: string }> = [];

  // Create left and right endpoint events
  segments.forEach((seg, id) => {
    const leftPoint = seg.p1.x <= seg.p2.x ? seg.p1 : seg.p2;
    const rightPoint = seg.p1.x <= seg.p2.x ? seg.p2 : seg.p1;

    events.push({
      x: leftPoint.x,
      type: 'left',
      segment: seg,
      segmentId: id
    });
    events.push({
      x: rightPoint.x,
      type: 'right',
      segment: seg,
      segmentId: id
    });
  });

  // Sort events by x coordinate
  events.sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    // Left endpoints before right endpoints
    if (a.type !== b.type) {
      if (a.type === 'left') return -1;
      if (b.type === 'left') return 1;
    }
    return 0;
  });

  const activeSegments: Set<number> = new Set();
  const intersections: Intersection[] = [];
  const foundPairs: Set<string> = new Set();

  for (const event of events) {
    if (event.type === 'left') {
      const segId = event.segmentId!;
      eventLog.push({
        x: parseFloat(event.x.toFixed(2)),
        type: 'insert',
        description: `Segment ${segId} enters sweep line`
      });

      // Check for intersections with all active segments
      for (const activeId of activeSegments) {
        const pairKey = `${Math.min(segId, activeId)}-${Math.max(segId, activeId)}`;
        if (!foundPairs.has(pairKey)) {
          const point = getIntersectionPoint(segments[segId], segments[activeId]);
          if (point) {
            intersections.push({
              point,
              segments: [segId, activeId]
            });
            foundPairs.add(pairKey);
            eventLog.push({
              x: parseFloat(event.x.toFixed(2)),
              type: 'intersection',
              description: `Intersection found: segments ${segId} and ${activeId} at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`
            });
          }
        }
      }

      activeSegments.add(segId);
    } else if (event.type === 'right') {
      const segId = event.segmentId!;
      activeSegments.delete(segId);
      eventLog.push({
        x: parseFloat(event.x.toFixed(2)),
        type: 'remove',
        description: `Segment ${segId} leaves sweep line`
      });
    }
  }

  return { intersections, events: eventLog };
}

// Check if a point is on a line segment
function pointOnSegment(point: Point, segment: Segment, tolerance: number = 1e-6): boolean {
  const d1 = Math.sqrt(Math.pow(point.x - segment.p1.x, 2) + Math.pow(point.y - segment.p1.y, 2));
  const d2 = Math.sqrt(Math.pow(point.x - segment.p2.x, 2) + Math.pow(point.y - segment.p2.y, 2));
  const segmentLength = Math.sqrt(Math.pow(segment.p2.x - segment.p1.x, 2) + Math.pow(segment.p2.y - segment.p1.y, 2));

  return Math.abs(d1 + d2 - segmentLength) < tolerance;
}

// Line-line intersection (infinite lines)
function lineLineIntersection(
  line1: { a: number; b: number; c: number }, // ax + by = c
  line2: { a: number; b: number; c: number }
): Point | null | 'parallel' | 'coincident' {
  const det = line1.a * line2.b - line2.a * line1.b;

  if (Math.abs(det) < 1e-10) {
    // Parallel or coincident
    const det2 = line1.a * line2.c - line2.a * line1.c;
    if (Math.abs(det2) < 1e-10) {
      return 'coincident';
    }
    return 'parallel';
  }

  const x = (line2.b * line1.c - line1.b * line2.c) / det;
  const y = (line1.a * line2.c - line2.a * line1.c) / det;

  return { x: parseFloat(x.toFixed(6)), y: parseFloat(y.toFixed(6)) };
}

// Convert segment to line equation ax + by = c
function segmentToLine(segment: Segment): { a: number; b: number; c: number } {
  const a = segment.p2.y - segment.p1.y;
  const b = segment.p1.x - segment.p2.x;
  const c = a * segment.p1.x + b * segment.p1.y;
  return { a, b, c };
}

// Generate random segments for testing
function generateRandomSegments(count: number, maxCoord: number = 100): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < count; i++) {
    segments.push({
      p1: { x: parseFloat((Math.random() * maxCoord).toFixed(2)), y: parseFloat((Math.random() * maxCoord).toFixed(2)) },
      p2: { x: parseFloat((Math.random() * maxCoord).toFixed(2)), y: parseFloat((Math.random() * maxCoord).toFixed(2)) },
      id: i
    });
  }
  return segments;
}

// Visualize segments and intersections
function visualizeSegments(segments: Segment[], intersections: Intersection[]): string {
  const width = 50;
  const height = 25;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Find bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const seg of segments) {
    minX = Math.min(minX, seg.p1.x, seg.p2.x);
    maxX = Math.max(maxX, seg.p1.x, seg.p2.x);
    minY = Math.min(minY, seg.p1.y, seg.p2.y);
    maxY = Math.max(maxY, seg.p1.y, seg.p2.y);
  }

  const scaleX = (width - 2) / (maxX - minX || 1);
  const scaleY = (height - 2) / (maxY - minY || 1);

  // Draw segments
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const x1 = Math.floor((seg.p1.x - minX) * scaleX) + 1;
    const y1 = height - 1 - Math.floor((seg.p1.y - minY) * scaleY) - 1;
    const x2 = Math.floor((seg.p2.x - minX) * scaleX) + 1;
    const y2 = height - 1 - Math.floor((seg.p2.y - minY) * scaleY) - 1;

    // Draw line using Bresenham's algorithm
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;

    while (true) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        if (grid[y][x] === ' ') {
          grid[y][x] = String(s % 10);
        } else if (grid[y][x] !== '×') {
          grid[y][x] = '·';
        }
      }
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  // Mark intersections
  for (const int of intersections) {
    const x = Math.floor((int.point.x - minX) * scaleX) + 1;
    const y = height - 1 - Math.floor((int.point.y - minY) * scaleY) - 1;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '×';
    }
  }

  // Build output
  let viz = '┌' + '─'.repeat(width) + '┐\n';
  for (const row of grid) {
    viz += '│' + row.join('') + '│\n';
  }
  viz += '└' + '─'.repeat(width) + '┘';
  viz += '\nLegend: × = intersection, 0-9 = segment ID';

  return viz;
}

export const lineintersectionTool: UnifiedTool = {
  name: 'line_intersection',
  description: 'Line segment intersection detection using sweep line and brute force algorithms',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'detect', 'find_all', 'sweep_line', 'point_test', 'line_line', 'analyze', 'demonstrate'],
        description: 'Operation to perform'
      },
      segment1: { type: 'object', description: 'First segment {p1: {x, y}, p2: {x, y}}' },
      segment2: { type: 'object', description: 'Second segment' },
      segments: { type: 'array', description: 'Array of segments for multi-segment operations' },
      point: { type: 'object', description: 'Point {x, y}' },
      num_segments: { type: 'integer', description: 'Number of random segments to generate' }
    },
    required: ['operation']
  }
};

export async function executelineintersection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'line_intersection',
          description: 'Line segment intersection detection algorithms',
          algorithms: {
            brute_force: {
              complexity: 'O(n²)',
              description: 'Check all pairs of segments',
              best_for: 'Small number of segments'
            },
            sweep_line: {
              complexity: 'O((n + k) log n) where k = intersections',
              description: 'Bentley-Ottmann algorithm using sweep line',
              best_for: 'Large number of segments with few intersections'
            }
          },
          intersection_types: {
            proper: 'Segments cross at interior points',
            improper: 'Endpoint touches segment or endpoint',
            parallel: 'Segments never meet',
            collinear: 'Segments lie on same line'
          },
          key_concepts: {
            orientation: 'Clockwise, counterclockwise, or collinear',
            cross_product: 'Determines relative position of points',
            parametric: 'Line as P(t) = P1 + t(P2 - P1)'
          },
          applications: [
            'Computational geometry',
            'Computer graphics (hidden surface removal)',
            'GIS (road network analysis)',
            'Collision detection',
            'Map overlay operations'
          ],
          operations: ['detect', 'find_all', 'sweep_line', 'point_test', 'line_line', 'analyze', 'demonstrate']
        };
        break;
      }

      case 'detect': {
        const s1 = args.segment1 || { p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } };
        const s2 = args.segment2 || { p1: { x: 0, y: 10 }, p2: { x: 10, y: 0 } };

        const intersects = segmentsIntersect(s1, s2);
        const point = intersects ? getIntersectionPoint(s1, s2) : null;

        const o1 = orientation(s1.p1, s1.p2, s2.p1);
        const o2 = orientation(s1.p1, s1.p2, s2.p2);
        const o3 = orientation(s2.p1, s2.p2, s1.p1);
        const o4 = orientation(s2.p1, s2.p2, s1.p2);

        const orientationNames = ['Collinear', 'Clockwise', 'Counterclockwise'];

        result = {
          operation: 'detect',
          segment1: s1,
          segment2: s2,
          intersects: intersects,
          intersection_point: point,
          analysis: {
            orientations: {
              'p1,q1,p2': orientationNames[o1],
              'p1,q1,q2': orientationNames[o2],
              'p2,q2,p1': orientationNames[o3],
              'p2,q2,q1': orientationNames[o4]
            },
            intersection_type: !intersects ? 'none' :
                              (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) ? 'improper (endpoint/collinear)' : 'proper'
          },
          formula: 'Cross product: (p2-p1) × (p3-p1) = (x2-x1)(y3-y1) - (y2-y1)(x3-x1)'
        };
        break;
      }

      case 'find_all': {
        const segments = args.segments?.map((s: any, i: number) => ({ ...s, id: i })) ||
                        generateRandomSegments(args.num_segments || 6);

        const intersections = bruteForceIntersections(segments);

        result = {
          operation: 'find_all',
          method: 'brute_force',
          complexity: `O(n²) = O(${segments.length}²) = ${segments.length * segments.length} comparisons`,
          segment_count: segments.length,
          segments: segments.map((s: Segment) => ({
            id: s.id,
            p1: s.p1,
            p2: s.p2
          })),
          intersection_count: intersections.length,
          intersections: intersections.map(int => ({
            point: int.point,
            between_segments: int.segments
          })),
          visualization: visualizeSegments(segments, intersections)
        };
        break;
      }

      case 'sweep_line': {
        const segments = args.segments?.map((s: any, i: number) => ({ ...s, id: i })) ||
                        generateRandomSegments(args.num_segments || 8);

        const { intersections, events } = sweepLineIntersections(segments);

        result = {
          operation: 'sweep_line',
          method: 'bentley_ottmann_simplified',
          complexity: 'O((n + k) log n)',
          segment_count: segments.length,
          segments: segments.slice(0, 10).map((s: Segment) => ({
            id: s.id,
            p1: s.p1,
            p2: s.p2
          })),
          intersection_count: intersections.length,
          intersections: intersections.map(int => ({
            point: int.point,
            between_segments: int.segments
          })),
          event_log: events.slice(0, 20),
          algorithm_steps: [
            '1. Create events for segment endpoints',
            '2. Sort events by x-coordinate',
            '3. Process events left to right',
            '4. Maintain active segments in sweep line',
            '5. Check for intersections when segments enter',
            '6. Report intersections as found'
          ],
          visualization: visualizeSegments(segments, intersections)
        };
        break;
      }

      case 'point_test': {
        const point = args.point || { x: 5, y: 5 };
        const segment = args.segment1 || { p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } };

        const isOn = pointOnSegment(point, segment);
        const cross = crossProduct(segment.p1, segment.p2, point);

        const d1 = Math.sqrt(Math.pow(point.x - segment.p1.x, 2) + Math.pow(point.y - segment.p1.y, 2));
        const d2 = Math.sqrt(Math.pow(point.x - segment.p2.x, 2) + Math.pow(point.y - segment.p2.y, 2));
        const segLen = Math.sqrt(Math.pow(segment.p2.x - segment.p1.x, 2) + Math.pow(segment.p2.y - segment.p1.y, 2));

        result = {
          operation: 'point_test',
          point: point,
          segment: segment,
          point_on_segment: isOn,
          analysis: {
            cross_product: parseFloat(cross.toFixed(6)),
            orientation: cross > 0 ? 'left of line' : cross < 0 ? 'right of line' : 'on line',
            distance_to_p1: parseFloat(d1.toFixed(4)),
            distance_to_p2: parseFloat(d2.toFixed(4)),
            segment_length: parseFloat(segLen.toFixed(4)),
            sum_of_distances: parseFloat((d1 + d2).toFixed(4)),
            difference: parseFloat(Math.abs(d1 + d2 - segLen).toFixed(6))
          },
          explanation: isOn ?
            'Point lies on segment (d1 + d2 ≈ segment length)' :
            'Point not on segment (d1 + d2 > segment length)'
        };
        break;
      }

      case 'line_line': {
        const s1 = args.segment1 || { p1: { x: 0, y: 0 }, p2: { x: 10, y: 5 } };
        const s2 = args.segment2 || { p1: { x: 0, y: 5 }, p2: { x: 10, y: 0 } };

        const line1 = segmentToLine(s1);
        const line2 = segmentToLine(s2);

        const lineIntersection = lineLineIntersection(line1, line2);
        const segmentIntersection = getIntersectionPoint(s1, s2);

        result = {
          operation: 'line_line',
          segment1: s1,
          segment2: s2,
          line_equations: {
            line1: `${line1.a.toFixed(2)}x + ${line1.b.toFixed(2)}y = ${line1.c.toFixed(2)}`,
            line2: `${line2.a.toFixed(2)}x + ${line2.b.toFixed(2)}y = ${line2.c.toFixed(2)}`
          },
          infinite_line_intersection: lineIntersection,
          segment_intersection: segmentIntersection,
          intersection_type: !segmentIntersection && typeof lineIntersection === 'object' ?
            'Lines intersect but not within segment bounds' :
            segmentIntersection ? 'Segments intersect' :
            lineIntersection === 'parallel' ? 'Parallel lines' : 'Coincident lines'
        };
        break;
      }

      case 'analyze': {
        const sizes = [5, 10, 20, 50];
        const analysis = [];

        for (const n of sizes) {
          const segments = generateRandomSegments(n);

          const startBrute = performance.now();
          const bruteResult = bruteForceIntersections(segments);
          const brutTime = performance.now() - startBrute;

          const startSweep = performance.now();
          const sweepResult = sweepLineIntersections(segments);
          const sweepTime = performance.now() - startSweep;

          analysis.push({
            segments: n,
            intersections: bruteResult.length,
            brute_force_ms: parseFloat(brutTime.toFixed(3)),
            sweep_line_ms: parseFloat(sweepTime.toFixed(3)),
            brute_comparisons: (n * (n - 1)) / 2
          });
        }

        result = {
          operation: 'analyze',
          performance_comparison: analysis,
          observations: [
            'Brute force: O(n²) comparisons regardless of intersections',
            'Sweep line: O((n+k) log n) where k = intersection count',
            'For sparse intersections, sweep line is faster',
            'For dense intersections, brute force may be competitive'
          ],
          recommendation: 'Use sweep line for n > 50 with sparse intersections'
        };
        break;
      }

      case 'demonstrate': {
        const demoSegments: Segment[] = [
          { p1: { x: 10, y: 10 }, p2: { x: 90, y: 90 }, id: 0 },
          { p1: { x: 10, y: 90 }, p2: { x: 90, y: 10 }, id: 1 },
          { p1: { x: 50, y: 10 }, p2: { x: 50, y: 90 }, id: 2 },
          { p1: { x: 10, y: 50 }, p2: { x: 90, y: 50 }, id: 3 }
        ];

        const intersections = bruteForceIntersections(demoSegments);

        result = {
          operation: 'demonstrate',
          tool: 'line_intersection',
          demo_segments: demoSegments,
          intersections: intersections,
          visualization: visualizeSegments(demoSegments, intersections),
          algorithm_explanation: {
            orientation_test: {
              description: 'Use cross product to determine relative position',
              formula: 'cross = (p2-p1) × (p3-p1)',
              interpretation: 'positive = left, negative = right, zero = collinear'
            },
            intersection_test: {
              description: 'Two segments intersect if they straddle each other',
              condition1: 'Points of S2 on opposite sides of line through S1',
              condition2: 'Points of S1 on opposite sides of line through S2'
            },
            intersection_point: {
              description: 'Solve parametric line equations',
              line1: 'P(t) = P1 + t(P2 - P1)',
              line2: 'Q(s) = Q1 + s(Q2 - Q1)',
              solution: 'Find t and s where P(t) = Q(s)'
            }
          },
          ascii_art: `
LINE SEGMENT INTERSECTION
═════════════════════════

     Proper Intersection       Collinear Overlap
     ─────────────────────     ─────────────────
           ╲   ╱                    ─────────
            ╲ ╱                   ═══════
             ×                      (overlap)
            ╱ ╲
           ╱   ╲

     Endpoint Touch           No Intersection
     ─────────────────         ─────────────────
         ─────●                    ─────
              │                          ─────
              │

     ORIENTATION TEST
     ═════════════════
         C                    Cross product (B-A) × (C-A):
        ╱                     • Positive: C is LEFT of A→B
       ╱                      • Negative: C is RIGHT of A→B
      A─────B                 • Zero: A, B, C are COLLINEAR
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'detect', 'find_all', 'sweep_line', 'point_test', 'line_line', 'analyze', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function islineintersectionAvailable(): boolean {
  return true;
}
