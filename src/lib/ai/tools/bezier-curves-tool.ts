/**
 * BEZIER CURVES TOOL
 *
 * Mathematical bezier curve calculations and visualizations.
 * Supports quadratic, cubic, and higher-order curves.
 *
 * Part of TIER VISUAL MADNESS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Point { x: number; y: number; }

// ============================================================================
// BEZIER CALCULATIONS
// ============================================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPoint(p1: Point, p2: Point, t: number): Point {
  return { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) };
}

function deCasteljau(points: Point[], t: number): Point {
  if (points.length === 1) return points[0];
  const newPoints: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    newPoints.push(lerpPoint(points[i], points[i + 1], t));
  }
  return deCasteljau(newPoints, t);
}

function quadraticBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt*mt*mt * p0.x + 3*mt*mt*t * p1.x + 3*mt*t*t * p2.x + t*t*t * p3.x,
    y: mt*mt*mt * p0.y + 3*mt*mt*t * p1.y + 3*mt*t*t * p2.y + t*t*t * p3.y,
  };
}

function bezierDerivative(points: Point[], t: number): Point {
  const n = points.length - 1;
  const derivPoints: Point[] = [];
  for (let i = 0; i < n; i++) {
    derivPoints.push({
      x: n * (points[i + 1].x - points[i].x),
      y: n * (points[i + 1].y - points[i].y),
    });
  }
  return deCasteljau(derivPoints, t);
}

function bezierLength(points: Point[], steps: number = 100): number {
  let length = 0;
  let prev = deCasteljau(points, 0);
  for (let i = 1; i <= steps; i++) {
    const curr = deCasteljau(points, i / steps);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prev = curr;
  }
  return length;
}

function bezierCurvature(points: Point[], t: number): number {
  const d1 = bezierDerivative(points, t);
  const secondDeriv: Point[] = [];
  const n = points.length - 1;
  for (let i = 0; i < n - 1; i++) {
    secondDeriv.push({
      x: n * (n - 1) * (points[i + 2].x - 2 * points[i + 1].x + points[i].x),
      y: n * (n - 1) * (points[i + 2].y - 2 * points[i + 1].y + points[i].y),
    });
  }
  const d2 = secondDeriv.length > 0 ? deCasteljau(secondDeriv, t) : { x: 0, y: 0 };
  const cross = d1.x * d2.y - d1.y * d2.x;
  const norm = Math.pow(d1.x * d1.x + d1.y * d1.y, 1.5);
  return norm > 0 ? cross / norm : 0;
}

function splitBezier(points: Point[], t: number): { left: Point[]; right: Point[] } {
  const left: Point[] = [points[0]];
  const right: Point[] = [points[points.length - 1]];
  let current = [...points];
  
  while (current.length > 1) {
    const newLevel: Point[] = [];
    for (let i = 0; i < current.length - 1; i++) {
      newLevel.push(lerpPoint(current[i], current[i + 1], t));
    }
    left.push(newLevel[0]);
    right.unshift(newLevel[newLevel.length - 1]);
    current = newLevel;
  }
  
  return { left, right };
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeBezier(points: Point[], width: number = 60, height: number = 25): string {
  const canvas: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  // Normalize points to canvas
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  
  const toCanvas = (p: Point): Point => ({
    x: Math.round(((p.x - minX) / rangeX) * (width - 3) + 1),
    y: Math.round(((maxY - p.y) / rangeY) * (height - 3) + 1),
  });

  // Draw curve
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const p = deCasteljau(points, t);
    const cp = toCanvas(p);
    if (cp.x >= 0 && cp.x < width && cp.y >= 0 && cp.y < height) {
      canvas[cp.y][cp.x] = '●';
    }
  }

  // Draw control points and lines
  for (let i = 0; i < points.length; i++) {
    const cp = toCanvas(points[i]);
    if (cp.x >= 0 && cp.x < width && cp.y >= 0 && cp.y < height) {
      canvas[cp.y][cp.x] = i === 0 || i === points.length - 1 ? '◆' : '○';
    }
  }

  // Draw control polygon
  for (let i = 0; i < points.length - 1; i++) {
    const c1 = toCanvas(points[i]);
    const c2 = toCanvas(points[i + 1]);
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(c1.x + (s / steps) * dx);
      const y = Math.round(c1.y + (s / steps) * dy);
      if (x >= 0 && x < width && y >= 0 && y < height && canvas[y][x] === ' ') {
        canvas[y][x] = '·';
      }
    }
  }

  return canvas.map(row => row.join('')).join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const bezierCurvesTool: UnifiedTool = {
  name: 'bezier_curves',
  description: `Bezier curve mathematics and visualization.

Operations:
- evaluate: Calculate point on curve at parameter t
- sample: Sample multiple points along curve
- derivative: Get tangent vector at t
- length: Calculate arc length
- curvature: Get curvature at t
- split: Split curve at parameter t
- visualize: ASCII visualization of curve

Supports quadratic, cubic, and arbitrary-order curves.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['evaluate', 'sample', 'derivative', 'length', 'curvature', 'split', 'visualize'],
        description: 'Bezier operation',
      },
      points: { type: 'string', description: 'Control points as JSON [[x,y], [x,y], ...]' },
      t: { type: 'number', description: 'Parameter t (0-1)' },
      steps: { type: 'number', description: 'Sample steps' },
      width: { type: 'number', description: 'Visualization width' },
      height: { type: 'number', description: 'Visualization height' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeBezierCurves(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, t = 0.5, steps = 10, width = 60, height = 25 } = args;
    const pointsStr = args.points || '[[0,0], [50,100], [100,0]]';
    const rawPoints = JSON.parse(pointsStr);
    const points: Point[] = rawPoints.map((p: number[]) => ({ x: p[0], y: p[1] }));

    let result: Record<string, unknown>;

    switch (operation) {
      case 'evaluate': {
        const point = deCasteljau(points, t);
        result = { operation, t, point: { x: Math.round(point.x * 100) / 100, y: Math.round(point.y * 100) / 100 }, control_points: points };
        break;
      }
      case 'sample': {
        const samples: Point[] = [];
        for (let i = 0; i <= steps; i++) {
          const p = deCasteljau(points, i / steps);
          samples.push({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
        }
        result = { operation, steps, samples };
        break;
      }
      case 'derivative': {
        const deriv = bezierDerivative(points, t);
        const magnitude = Math.sqrt(deriv.x * deriv.x + deriv.y * deriv.y);
        result = { operation, t, tangent: deriv, magnitude: Math.round(magnitude * 100) / 100 };
        break;
      }
      case 'length': {
        const len = bezierLength(points, steps || 100);
        result = { operation, arc_length: Math.round(len * 100) / 100, precision: steps || 100 };
        break;
      }
      case 'curvature': {
        const curv = bezierCurvature(points, t);
        result = { operation, t, curvature: Math.round(curv * 10000) / 10000, radius: curv !== 0 ? Math.round(1/Math.abs(curv) * 100) / 100 : Infinity };
        break;
      }
      case 'split': {
        const split = splitBezier(points, t);
        result = { operation, t, left_curve: split.left, right_curve: split.right };
        break;
      }
      case 'visualize': {
        const viz = visualizeBezier(points, width, height);
        result = { operation, control_points: points, degree: points.length - 1, visualization: viz };
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Bezier Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isBezierCurvesAvailable(): boolean { return true; }
