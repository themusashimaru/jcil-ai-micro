/**
 * FRACTAL GENERATOR TOOL
 *
 * Generate mathematical fractals with ASCII visualization.
 * Includes Mandelbrot, Julia sets, Sierpinski, Koch curves, and more.
 *
 * Part of TIER VISUAL MADNESS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// MANDELBROT SET
// ============================================================================

interface ComplexNumber {
  re: number;
  im: number;
}

function mandelbrotIteration(c: ComplexNumber, maxIter: number): number {
  let z: ComplexNumber = { re: 0, im: 0 };

  for (let i = 0; i < maxIter; i++) {
    // z = z² + c
    const re2 = z.re * z.re - z.im * z.im + c.re;
    const im2 = 2 * z.re * z.im + c.im;
    z = { re: re2, im: im2 };

    // Check if escaped (|z| > 2)
    if (z.re * z.re + z.im * z.im > 4) {
      return i;
    }
  }

  return maxIter; // Inside the set
}

function generateMandelbrot(
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  zoom: number,
  maxIter: number
): { ascii: string; stats: Record<string, number> } {
  const chars = ' .:-=+*#%@';
  const aspect = 2.0; // Character aspect ratio compensation

  const lines: string[] = [];
  let insideCount = 0;
  let totalIterations = 0;

  for (let py = 0; py < height; py++) {
    let line = '';
    for (let px = 0; px < width; px++) {
      // Map pixel to complex plane
      const x = centerX + (px - width / 2) / (width / 4) / zoom;
      const y = centerY + (py - height / 2) / (height / 4) / zoom * aspect;

      const iter = mandelbrotIteration({ re: x, im: y }, maxIter);
      totalIterations += iter;

      if (iter === maxIter) {
        insideCount++;
        line += chars[chars.length - 1];
      } else {
        const charIndex = Math.floor((iter / maxIter) * (chars.length - 1));
        line += chars[charIndex];
      }
    }
    lines.push(line);
  }

  return {
    ascii: lines.join('\n'),
    stats: {
      width,
      height,
      center_x: centerX,
      center_y: centerY,
      zoom,
      max_iterations: maxIter,
      pixels_inside_set: insideCount,
      total_pixels: width * height,
      average_iterations: totalIterations / (width * height),
    },
  };
}

// ============================================================================
// JULIA SET
// ============================================================================

function juliaIteration(z: ComplexNumber, c: ComplexNumber, maxIter: number): number {
  for (let i = 0; i < maxIter; i++) {
    // z = z² + c
    const re2 = z.re * z.re - z.im * z.im + c.re;
    const im2 = 2 * z.re * z.im + c.im;
    z = { re: re2, im: im2 };

    if (z.re * z.re + z.im * z.im > 4) {
      return i;
    }
  }
  return maxIter;
}

function generateJulia(
  width: number,
  height: number,
  cRe: number,
  cIm: number,
  zoom: number,
  maxIter: number
): { ascii: string; stats: Record<string, unknown> } {
  const chars = ' .:-=+*#%@';
  const aspect = 2.0;

  const lines: string[] = [];

  for (let py = 0; py < height; py++) {
    let line = '';
    for (let px = 0; px < width; px++) {
      const x = (px - width / 2) / (width / 4) / zoom;
      const y = (py - height / 2) / (height / 4) / zoom * aspect;

      const iter = juliaIteration({ re: x, im: y }, { re: cRe, im: cIm }, maxIter);

      if (iter === maxIter) {
        line += chars[chars.length - 1];
      } else {
        const charIndex = Math.floor((iter / maxIter) * (chars.length - 1));
        line += chars[charIndex];
      }
    }
    lines.push(line);
  }

  return {
    ascii: lines.join('\n'),
    stats: {
      width,
      height,
      c: `${cRe} + ${cIm}i`,
      zoom,
      max_iterations: maxIter,
      famous_c_values: {
        'rabbit': '-0.123 + 0.745i',
        'dendrite': '0 + 1i',
        'siegel_disk': '-0.391 - 0.587i',
        'spiral': '-0.8 + 0.156i',
        'san_marco': '-0.75 + 0i',
      },
    },
  };
}

// ============================================================================
// SIERPINSKI TRIANGLE
// ============================================================================

function generateSierpinskiTriangle(size: number, iterations: number): string {
  // Create triangle using chaos game or recursive subdivision
  const grid: boolean[][] = [];

  // Initialize grid
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size * 2; x++) {
      grid[y][x] = false;
    }
  }

  // Recursive subdivision method
  function fillTriangle(x: number, y: number, s: number, depth: number): void {
    if (depth === 0) {
      // Fill triangle
      for (let row = 0; row < s; row++) {
        for (let col = 0; col <= row; col++) {
          const px = x + s - 1 - row + col * 2;
          const py = y + row;
          if (py < size && px >= 0 && px < size * 2) {
            grid[py][px] = true;
          }
        }
      }
    } else {
      const half = Math.floor(s / 2);
      // Top triangle
      fillTriangle(x + half, y, half, depth - 1);
      // Bottom left triangle
      fillTriangle(x, y + half, half, depth - 1);
      // Bottom right triangle
      fillTriangle(x + s, y + half, half, depth - 1);
    }
  }

  fillTriangle(0, 0, size, iterations);

  // Convert to ASCII
  const lines: string[] = [];
  for (let y = 0; y < size; y++) {
    let line = '';
    for (let x = 0; x < size * 2; x++) {
      line += grid[y][x] ? '▲' : ' ';
    }
    lines.push(line.trimEnd());
  }

  return lines.join('\n');
}

// ============================================================================
// SIERPINSKI CARPET
// ============================================================================

function generateSierpinskiCarpet(size: number, iterations: number): string {
  const grid: boolean[][] = [];

  // Initialize all as filled
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = true;
    }
  }

  // Recursively remove middle squares
  function removeMiddle(x: number, y: number, s: number, depth: number): void {
    if (depth === 0 || s < 3) return;

    const third = Math.floor(s / 3);

    // Remove middle square
    for (let dy = 0; dy < third; dy++) {
      for (let dx = 0; dx < third; dx++) {
        const px = x + third + dx;
        const py = y + third + dy;
        if (py < size && px < size) {
          grid[py][px] = false;
        }
      }
    }

    // Recurse on 8 surrounding squares
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) continue; // Skip middle
        removeMiddle(x + i * third, y + j * third, third, depth - 1);
      }
    }
  }

  removeMiddle(0, 0, size, iterations);

  // Convert to ASCII
  const lines: string[] = [];
  for (let y = 0; y < size; y++) {
    let line = '';
    for (let x = 0; x < size; x++) {
      line += grid[y][x] ? '█' : ' ';
    }
    lines.push(line);
  }

  return lines.join('\n');
}

// ============================================================================
// KOCH SNOWFLAKE
// ============================================================================

interface Point {
  x: number;
  y: number;
}

function kochCurvePoints(p1: Point, p2: Point, depth: number): Point[] {
  if (depth === 0) {
    return [p1, p2];
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Divide into 3 segments
  const a = p1;
  const b = { x: p1.x + dx / 3, y: p1.y + dy / 3 };
  const c = {
    x: p1.x + dx / 2 - (dy * Math.sqrt(3)) / 6,
    y: p1.y + dy / 2 + (dx * Math.sqrt(3)) / 6,
  };
  const d = { x: p1.x + (2 * dx) / 3, y: p1.y + (2 * dy) / 3 };
  const e = p2;

  // Recursively subdivide
  const points: Point[] = [];
  points.push(...kochCurvePoints(a, b, depth - 1).slice(0, -1));
  points.push(...kochCurvePoints(b, c, depth - 1).slice(0, -1));
  points.push(...kochCurvePoints(c, d, depth - 1).slice(0, -1));
  points.push(...kochCurvePoints(d, e, depth - 1));

  return points;
}

function generateKochSnowflake(size: number, iterations: number): string {
  const height = Math.floor(size * 0.866); // √3/2
  const grid: string[][] = [];

  // Initialize grid
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = ' ';
    }
  }

  // Starting triangle vertices
  const centerX = size / 2;
  const centerY = height / 2;
  const r = Math.min(size, height) * 0.4;

  const v1 = { x: centerX, y: centerY - r };
  const v2 = { x: centerX - r * Math.cos(Math.PI / 6), y: centerY + r * Math.sin(Math.PI / 6) };
  const v3 = { x: centerX + r * Math.cos(Math.PI / 6), y: centerY + r * Math.sin(Math.PI / 6) };

  // Generate Koch curve for each side
  const side1 = kochCurvePoints(v1, v2, iterations);
  const side2 = kochCurvePoints(v2, v3, iterations);
  const side3 = kochCurvePoints(v3, v1, iterations);

  const allPoints = [...side1, ...side2, ...side3];

  // Draw lines between consecutive points
  for (let i = 0; i < allPoints.length - 1; i++) {
    const p1 = allPoints[i];
    const p2 = allPoints[i + 1];

    // Bresenham's line algorithm
    let x0 = Math.round(p1.x);
    let y0 = Math.round(p1.y);
    const x1 = Math.round(p2.x);
    const y1 = Math.round(p2.y);

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      if (y0 >= 0 && y0 < height && x0 >= 0 && x0 < size) {
        grid[y0][x0] = '*';
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  return grid.map(row => row.join('')).join('\n');
}

// ============================================================================
// DRAGON CURVE
// ============================================================================

function generateDragonCurve(iterations: number): string {
  // L-system: start with FX, X -> X+YF+, Y -> -FX-Y
  // Simplified approach: track direction changes
  let sequence = 'R'; // R = right turn, L = left turn

  for (let i = 0; i < iterations; i++) {
    const newSeq: string[] = [];
    for (let j = 0; j < sequence.length; j++) {
      newSeq.push(sequence[j]);
      if (j < sequence.length) {
        newSeq.push(j % 2 === 0 ? 'R' : 'L');
      }
    }
    sequence = newSeq.join('');
  }

  // Draw the curve
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
  ];

  let dir = 0;
  let x = 0;
  let y = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  const points: Point[] = [{ x: 0, y: 0 }];

  for (const turn of sequence) {
    if (turn === 'R') {
      dir = (dir + 1) % 4;
    } else {
      dir = (dir + 3) % 4;
    }
    x += directions[dir].dx;
    y += directions[dir].dy;
    points.push({ x, y });
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  // Create grid
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  // Plot points
  for (const p of points) {
    const px = p.x - minX;
    const py = p.y - minY;
    grid[py][px] = '█';
  }

  return grid.map(row => row.join('')).join('\n');
}

// ============================================================================
// CANTOR SET
// ============================================================================

function generateCantorSet(width: number, iterations: number): string {
  const lines: string[] = [];

  function cantorLine(start: number, length: number, depth: number): string {
    if (depth === 0 || length < 3) {
      return '█'.repeat(Math.max(1, Math.floor(length)));
    }

    const third = Math.floor(length / 3);
    const left = cantorLine(start, third, depth - 1);
    const middle = ' '.repeat(third);
    const right = cantorLine(start + 2 * third, third, depth - 1);

    return left + middle + right;
  }

  for (let i = 0; i <= iterations; i++) {
    const line = cantorLine(0, width, i);
    lines.push(line.padEnd(width, ' '));
    if (i < iterations) {
      lines.push(' '.repeat(width)); // Spacing
    }
  }

  return lines.join('\n');
}

// ============================================================================
// BINARY TREE FRACTAL
// ============================================================================

function generateBinaryTree(width: number, height: number, iterations: number): string {
  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  function drawBranch(x: number, y: number, length: number, angle: number, depth: number): void {
    if (depth === 0 || length < 1) return;

    const x2 = x + length * Math.cos(angle);
    const y2 = y - length * Math.sin(angle);

    // Draw line from (x,y) to (x2,y2)
    const steps = Math.ceil(length);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x + t * (x2 - x));
      const py = Math.round(y + t * (y2 - y));
      if (px >= 0 && px < width && py >= 0 && py < height) {
        grid[py][px] = depth > iterations / 2 ? '│' : '·';
      }
    }

    // Draw left and right branches
    const newLength = length * 0.7;
    const branchAngle = Math.PI / 4;
    drawBranch(x2, y2, newLength, angle + branchAngle, depth - 1);
    drawBranch(x2, y2, newLength, angle - branchAngle, depth - 1);
  }

  // Start from bottom center
  drawBranch(width / 2, height - 1, height / 4, Math.PI / 2, iterations);

  return grid.map(row => row.join('')).join('\n');
}

// ============================================================================
// L-SYSTEM
// ============================================================================

interface LSystemRule {
  [key: string]: string;
}

function generateLSystem(
  axiom: string,
  rules: LSystemRule,
  iterations: number,
  angle: number = 90
): { sequence: string; description: string } {
  let current = axiom;

  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const char of current) {
      next += rules[char] ?? char;
    }
    current = next;
  }

  return {
    sequence: current.length > 1000 ? current.slice(0, 1000) + '...' : current,
    description: `L-System after ${iterations} iterations. Length: ${current.length} characters.
Commands: F=forward, +=turn right ${angle}°, -=turn left ${angle}°, [=save state, ]=restore state`,
  };
}

// Famous L-Systems presets
const L_SYSTEM_PRESETS: Record<string, { axiom: string; rules: LSystemRule; angle: number; name: string }> = {
  sierpinski: {
    axiom: 'F-G-G',
    rules: { F: 'F-G+F+G-F', G: 'GG' },
    angle: 120,
    name: 'Sierpinski Triangle',
  },
  dragon: {
    axiom: 'FX',
    rules: { X: 'X+YF+', Y: '-FX-Y' },
    angle: 90,
    name: 'Dragon Curve',
  },
  plant: {
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    angle: 25,
    name: 'Fractal Plant',
  },
  hilbert: {
    axiom: 'A',
    rules: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' },
    angle: 90,
    name: 'Hilbert Curve',
  },
  koch: {
    axiom: 'F',
    rules: { F: 'F+F-F-F+F' },
    angle: 90,
    name: 'Koch Curve',
  },
  levy: {
    axiom: 'F',
    rules: { F: '+F--F+' },
    angle: 45,
    name: 'Levy C Curve',
  },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const fractalGeneratorTool: UnifiedTool = {
  name: 'fractal_generator',
  description: `Generate mathematical fractals with ASCII visualization.

Operations:
- mandelbrot: Generate Mandelbrot set with zoom/pan
- julia: Generate Julia set for given c value
- sierpinski_triangle: Sierpinski triangle
- sierpinski_carpet: Sierpinski carpet
- koch_snowflake: Koch snowflake curve
- dragon_curve: Dragon curve (Heighway dragon)
- cantor_set: Cantor set visualization
- binary_tree: Fractal binary tree
- l_system: L-System string generation
- l_system_presets: List available L-System presets

Famous Julia c values:
- Rabbit: c = -0.123 + 0.745i
- Dendrite: c = 0 + 1i
- Spiral: c = -0.8 + 0.156i`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'mandelbrot', 'julia', 'sierpinski_triangle', 'sierpinski_carpet',
          'koch_snowflake', 'dragon_curve', 'cantor_set', 'binary_tree',
          'l_system', 'l_system_presets',
        ],
        description: 'Type of fractal to generate',
      },
      width: { type: 'number', description: 'Output width in characters (default 60)' },
      height: { type: 'number', description: 'Output height in characters (default 30)' },
      iterations: { type: 'number', description: 'Iteration depth or max iterations' },
      // Mandelbrot/Julia parameters
      center_x: { type: 'number', description: 'Center X coordinate for Mandelbrot' },
      center_y: { type: 'number', description: 'Center Y coordinate for Mandelbrot' },
      zoom: { type: 'number', description: 'Zoom level (default 1)' },
      c_re: { type: 'number', description: 'Julia c real component' },
      c_im: { type: 'number', description: 'Julia c imaginary component' },
      // L-System parameters
      preset: { type: 'string', description: 'L-System preset name' },
      axiom: { type: 'string', description: 'L-System axiom (starting string)' },
      rules: { type: 'string', description: 'L-System rules as JSON object' },
      angle: { type: 'number', description: 'L-System turn angle in degrees' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeFractalGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, width = 60, height = 30 } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'mandelbrot': {
        const { center_x = -0.5, center_y = 0, zoom = 1, iterations = 50 } = args;
        const mandel = generateMandelbrot(width, height, center_x, center_y, zoom, iterations);
        result = {
          operation: 'mandelbrot',
          ascii: mandel.ascii,
          ...mandel.stats,
          interesting_locations: {
            'full_set': { center: '(-0.5, 0)', zoom: 1 },
            'seahorse_valley': { center: '(-0.75, 0.1)', zoom: 50 },
            'elephant_valley': { center: '(0.28, 0.01)', zoom: 100 },
            'spiral': { center: '(-0.761574, -0.0847596)', zoom: 2000 },
          },
        };
        break;
      }

      case 'julia': {
        const { c_re = -0.4, c_im = 0.6, zoom = 1, iterations = 50 } = args;
        const julia = generateJulia(width, height, c_re, c_im, zoom, iterations);
        result = {
          operation: 'julia',
          ascii: julia.ascii,
          ...julia.stats,
        };
        break;
      }

      case 'sierpinski_triangle': {
        const iter = args.iterations ?? 4;
        const size = Math.min(height, 32);
        const ascii = generateSierpinskiTriangle(size, iter);
        result = {
          operation: 'sierpinski_triangle',
          ascii,
          iterations: iter,
          dimension: `log(3)/log(2) ≈ 1.585`,
          description: 'Self-similar fractal with 3 copies at 1/2 scale',
        };
        break;
      }

      case 'sierpinski_carpet': {
        const iter = args.iterations ?? 3;
        const size = Math.pow(3, iter);
        const ascii = generateSierpinskiCarpet(Math.min(size, 81), iter);
        result = {
          operation: 'sierpinski_carpet',
          ascii,
          iterations: iter,
          size: Math.min(size, 81),
          dimension: `log(8)/log(3) ≈ 1.893`,
          description: 'Self-similar fractal with 8 copies at 1/3 scale',
        };
        break;
      }

      case 'koch_snowflake': {
        const iter = args.iterations ?? 3;
        const ascii = generateKochSnowflake(Math.min(width, 80), iter);
        result = {
          operation: 'koch_snowflake',
          ascii,
          iterations: iter,
          dimension: `log(4)/log(3) ≈ 1.262`,
          perimeter: `4^n / 3^n → ∞ as n → ∞`,
          area: 'Finite (8/5 of original triangle)',
          description: 'Infinite perimeter enclosing finite area',
        };
        break;
      }

      case 'dragon_curve': {
        const iter = args.iterations ?? 10;
        const ascii = generateDragonCurve(iter);
        result = {
          operation: 'dragon_curve',
          ascii,
          iterations: iter,
          dimension: '2',
          description: 'Space-filling curve discovered by NASA physicist John Heighway',
          fun_fact: 'Two dragon curves fit together perfectly with no overlap',
        };
        break;
      }

      case 'cantor_set': {
        const iter = args.iterations ?? 5;
        const ascii = generateCantorSet(Math.min(width, 81), iter);
        result = {
          operation: 'cantor_set',
          ascii,
          iterations: iter,
          dimension: `log(2)/log(3) ≈ 0.631`,
          description: 'Uncountably infinite set with measure zero',
          construction: 'Remove middle third of each segment repeatedly',
        };
        break;
      }

      case 'binary_tree': {
        const iter = args.iterations ?? 8;
        const ascii = generateBinaryTree(width, height, iter);
        result = {
          operation: 'binary_tree',
          ascii,
          iterations: iter,
          branch_ratio: 0.7,
          branch_angle: '45°',
        };
        break;
      }

      case 'l_system': {
        const preset = args.preset;
        let axiom: string, rules: LSystemRule, angle: number, name: string;

        if (preset && L_SYSTEM_PRESETS[preset]) {
          ({ axiom, rules, angle, name } = L_SYSTEM_PRESETS[preset]);
        } else {
          axiom = args.axiom ?? 'F';
          rules = args.rules ? JSON.parse(args.rules) : { F: 'F+F-F-F+F' };
          angle = args.angle ?? 90;
          name = 'Custom L-System';
        }

        const iter = args.iterations ?? 4;
        const lsys = generateLSystem(axiom, rules, iter, angle);

        result = {
          operation: 'l_system',
          name,
          axiom,
          rules,
          angle,
          iterations: iter,
          ...lsys,
        };
        break;
      }

      case 'l_system_presets': {
        result = {
          operation: 'l_system_presets',
          presets: Object.entries(L_SYSTEM_PRESETS).map(([key, val]) => ({
            name: key,
            display_name: val.name,
            axiom: val.axiom,
            angle: val.angle,
          })),
          usage: 'Use preset parameter with l_system operation',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Fractal Generator Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isFractalGeneratorAvailable(): boolean {
  return true;
}
