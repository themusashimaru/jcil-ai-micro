/**
 * ANIMATION EASING TOOL
 *
 * Complete library of easing functions for smooth animations.
 * Generate easing curves, preview animations, and calculate timing.
 *
 * Part of TIER VISUAL MADNESS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

type EasingFunction = (t: number) => number;

const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  // Linear
  linear: (t) => t,

  // Sine
  easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Quad
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  // Cubic
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  // Quart
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,

  // Quint
  easeInQuint: (t) => t * t * t * t * t,
  easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,

  // Expo
  easeInExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2,

  // Circ
  easeInCirc: (t) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
  easeOutCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeInOutCirc: (t) => t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,

  // Back (overshoot)
  easeInBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeInElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1
      : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t) => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0 ? 0 : t === 1 ? 1 : t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // Bounce
  easeInBounce: (t) => 1 - EASING_FUNCTIONS.easeOutBounce(1 - t),
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  easeInOutBounce: (t) => t < 0.5
    ? (1 - EASING_FUNCTIONS.easeOutBounce(1 - 2 * t)) / 2
    : (1 + EASING_FUNCTIONS.easeOutBounce(2 * t - 1)) / 2,

  // Custom Power
  easeInPow: (t) => Math.pow(t, 6),
  easeOutPow: (t) => 1 - Math.pow(1 - t, 6),

  // Smooth Step (Hermite interpolation)
  smoothStep: (t) => t * t * (3 - 2 * t),
  smootherStep: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

// ============================================================================
// BEZIER CURVE EASING
// ============================================================================

function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  // Newton-Raphson iteration to find t for x
  const epsilon = 1e-6;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Binary search for t
    let t = x;
    for (let i = 0; i < 10; i++) {
      const currentX = 3 * (1 - t) * (1 - t) * t * x1 +
        3 * (1 - t) * t * t * x2 +
        t * t * t;
      const derivative = 3 * (1 - t) * (1 - t) * x1 +
        6 * (1 - t) * t * (x2 - x1) +
        3 * t * t * (1 - x2);

      if (Math.abs(currentX - x) < epsilon) break;
      if (Math.abs(derivative) < epsilon) break;

      t -= (currentX - x) / derivative;
      t = Math.max(0, Math.min(1, t));
    }

    // Calculate y at t
    return 3 * (1 - t) * (1 - t) * t * y1 +
      3 * (1 - t) * t * t * y2 +
      t * t * t;
  };
}

// Named cubic-bezier presets
const BEZIER_PRESETS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  // Material Design
  standard: [0.4, 0, 0.2, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.4, 0, 1, 1],
  // Custom
  snappy: [0.3, 0.9, 0.3, 1],
  gentle: [0.4, 0.1, 0.4, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
};

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeEasing(easingFn: EasingFunction, width: number = 60, height: number = 20): string {
  const canvas: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  // Draw axes
  for (let x = 0; x < width; x++) {
    canvas[height - 1][x] = '─';
  }
  for (let y = 0; y < height; y++) {
    canvas[y][0] = '│';
  }
  canvas[height - 1][0] = '└';
  canvas[0][width - 1] = '→';
  canvas[0][0] = '↑';

  // Draw curve
  for (let x = 1; x < width - 1; x++) {
    const t = (x - 1) / (width - 3);
    const v = easingFn(t);
    const y = height - 2 - Math.round(v * (height - 3));
    if (y >= 0 && y < height) {
      canvas[y][x] = '●';
    }
  }

  return canvas.map(row => row.join('')).join('\n');
}

function generateTimingTable(
  easingFn: EasingFunction,
  duration: number,
  steps: number = 10
): Array<{ time: number; progress: number; value: number }> {
  const table: Array<{ time: number; progress: number; value: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    table.push({
      time: Math.round(t * duration),
      progress: Math.round(t * 100),
      value: Math.round(easingFn(t) * 1000) / 1000,
    });
  }

  return table;
}

function compareEasings(
  easings: string[],
  width: number = 60,
  height: number = 15
): string {
  const symbols = '●○◆◇■□▲△';
  const lines: string[] = [];

  // Header
  lines.push('Easing Comparison:');
  lines.push('');

  // Create combined visualization
  const canvas: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  // Draw axes
  for (let x = 0; x < width; x++) {
    canvas[height - 1][x] = '─';
  }
  canvas[height - 1][0] = '└';

  // Draw each easing
  easings.forEach((name, idx) => {
    const fn = EASING_FUNCTIONS[name];
    if (!fn) return;

    const symbol = symbols[idx % symbols.length];

    for (let x = 1; x < width; x += 2) {
      const t = (x - 1) / (width - 2);
      const v = fn(t);
      const y = height - 2 - Math.round(v * (height - 3));
      if (y >= 0 && y < height - 1) {
        canvas[y][x] = symbol;
      }
    }
  });

  lines.push(...canvas.map(row => row.join('')));

  // Legend
  lines.push('');
  lines.push('Legend:');
  easings.forEach((name, idx) => {
    lines.push(`  ${symbols[idx % symbols.length]} = ${name}`);
  });

  return lines.join('\n');
}

// ============================================================================
// ANIMATION PREVIEW
// ============================================================================

function generateAnimationFrames(
  easingFn: EasingFunction,
  frames: number = 10,
  width: number = 40
): string {
  const lines: string[] = [];

  for (let i = 0; i <= frames; i++) {
    const t = i / frames;
    const v = easingFn(t);
    const pos = Math.round(v * (width - 1));

    const line = Array.from({ length: width }, (_, x) =>
      x === pos ? '■' : x < pos ? '░' : '·'
    ).join('');

    lines.push(`${String(Math.round(t * 100)).padStart(3)}% │${line}│`);
  }

  return lines.join('\n');
}

// ============================================================================
// SPRING PHYSICS
// ============================================================================

interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

function springEasing(config: SpringConfig): EasingFunction {
  const { mass, stiffness, damping } = config;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta < 1) {
    // Underdamped
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (t: number) => {
      const decay = Math.exp(-zeta * w0 * t * 5);
      return 1 - decay * (Math.cos(wd * t * 5) + (zeta * w0 / wd) * Math.sin(wd * t * 5));
    };
  } else {
    // Critically damped or overdamped
    return (t: number) => {
      const decay = Math.exp(-w0 * t * 5);
      return 1 - decay * (1 + w0 * t * 5);
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const animationEasingTool: UnifiedTool = {
  name: 'animation_easing',
  description: `Animation easing functions for smooth motion and transitions.

Operations:
- calculate: Calculate eased value at time t
- visualize: ASCII visualization of easing curve
- table: Generate timing table for duration
- compare: Compare multiple easings side-by-side
- preview: Generate animation frame preview
- bezier: Create cubic-bezier easing
- spring: Create spring-physics easing
- list: List all available easings

Available easings:
- linear, ease, easeIn, easeOut, easeInOut
- easeIn/Out/InOut + Sine, Quad, Cubic, Quart, Quint
- easeIn/Out/InOut + Expo, Circ, Back, Elastic, Bounce
- smoothStep, smootherStep
- Custom cubic-bezier and spring physics`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['calculate', 'visualize', 'table', 'compare', 'preview', 'bezier', 'spring', 'list'],
        description: 'Type of easing operation',
      },
      easing: { type: 'string', description: 'Easing function name' },
      easings: { type: 'string', description: 'Comma-separated list of easings to compare' },
      t: { type: 'number', description: 'Time value 0-1 for calculation' },
      duration: { type: 'number', description: 'Duration in milliseconds for timing table' },
      steps: { type: 'number', description: 'Number of steps/frames' },
      // Bezier parameters
      x1: { type: 'number', description: 'Bezier control point 1 X' },
      y1: { type: 'number', description: 'Bezier control point 1 Y' },
      x2: { type: 'number', description: 'Bezier control point 2 X' },
      y2: { type: 'number', description: 'Bezier control point 2 Y' },
      preset: { type: 'string', description: 'Bezier preset name' },
      // Spring parameters
      mass: { type: 'number', description: 'Spring mass (default 1)' },
      stiffness: { type: 'number', description: 'Spring stiffness (default 100)' },
      damping: { type: 'number', description: 'Spring damping (default 10)' },
      // Visualization
      width: { type: 'number', description: 'Visualization width' },
      height: { type: 'number', description: 'Visualization height' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeAnimationEasing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, easing = 'easeInOutCubic' } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'calculate': {
        const { t = 0.5 } = args;
        const fn = EASING_FUNCTIONS[easing];
        if (!fn) throw new Error(`Unknown easing: ${easing}`);

        const value = fn(t);
        result = {
          operation: 'calculate',
          easing,
          t,
          value: Math.round(value * 10000) / 10000,
          percentage: `${Math.round(value * 100)}%`,
        };
        break;
      }

      case 'visualize': {
        const { width = 60, height = 20 } = args;
        const fn = EASING_FUNCTIONS[easing];
        if (!fn) throw new Error(`Unknown easing: ${easing}`);

        const ascii = visualizeEasing(fn, width, height);
        result = {
          operation: 'visualize',
          easing,
          curve: ascii,
          description: `Progress (→) vs Value (↑)`,
        };
        break;
      }

      case 'table': {
        const { duration = 1000, steps = 10 } = args;
        const fn = EASING_FUNCTIONS[easing];
        if (!fn) throw new Error(`Unknown easing: ${easing}`);

        const table = generateTimingTable(fn, duration, steps);
        result = {
          operation: 'table',
          easing,
          duration_ms: duration,
          table,
          css_timing: `transition: all ${duration}ms ${easing};`,
        };
        break;
      }

      case 'compare': {
        const { easings: easingsStr = 'easeInQuad,easeOutQuad,easeInOutQuad', width = 60, height = 15 } = args;
        const easingList = easingsStr.split(',').map((s: string) => s.trim());

        const comparison = compareEasings(easingList, width, height);
        result = {
          operation: 'compare',
          easings: easingList,
          chart: comparison,
        };
        break;
      }

      case 'preview': {
        const { steps = 10, width = 40 } = args;
        const fn = EASING_FUNCTIONS[easing];
        if (!fn) throw new Error(`Unknown easing: ${easing}`);

        const preview = generateAnimationFrames(fn, steps, width);
        result = {
          operation: 'preview',
          easing,
          frames: steps + 1,
          animation: preview,
        };
        break;
      }

      case 'bezier': {
        const { preset, x1 = 0.42, y1 = 0, x2 = 0.58, y2 = 1 } = args;

        let points: [number, number, number, number];
        if (preset && BEZIER_PRESETS[preset]) {
          points = BEZIER_PRESETS[preset];
        } else {
          points = [x1, y1, x2, y2];
        }

        const fn = cubicBezier(...points);
        const ascii = visualizeEasing(fn, 50, 15);

        result = {
          operation: 'bezier',
          control_points: {
            p1: { x: points[0], y: points[1] },
            p2: { x: points[2], y: points[3] },
          },
          css: `cubic-bezier(${points.join(', ')})`,
          curve: ascii,
          presets: Object.keys(BEZIER_PRESETS),
        };
        break;
      }

      case 'spring': {
        const { mass = 1, stiffness = 100, damping = 10 } = args;
        const fn = springEasing({ mass, stiffness, damping });
        const ascii = visualizeEasing(fn, 50, 15);

        const zeta = damping / (2 * Math.sqrt(stiffness * mass));
        const dampingType = zeta < 1 ? 'underdamped (bouncy)' :
          zeta === 1 ? 'critically damped' : 'overdamped';

        result = {
          operation: 'spring',
          config: { mass, stiffness, damping },
          damping_ratio: Math.round(zeta * 1000) / 1000,
          type: dampingType,
          curve: ascii,
          recommendations: {
            snappy: { mass: 1, stiffness: 300, damping: 20 },
            gentle: { mass: 1, stiffness: 100, damping: 15 },
            bouncy: { mass: 1, stiffness: 200, damping: 8 },
          },
        };
        break;
      }

      case 'list': {
        const categories = {
          linear: ['linear'],
          sine: ['easeInSine', 'easeOutSine', 'easeInOutSine'],
          quad: ['easeInQuad', 'easeOutQuad', 'easeInOutQuad'],
          cubic: ['easeInCubic', 'easeOutCubic', 'easeInOutCubic'],
          quart: ['easeInQuart', 'easeOutQuart', 'easeInOutQuart'],
          quint: ['easeInQuint', 'easeOutQuint', 'easeInOutQuint'],
          expo: ['easeInExpo', 'easeOutExpo', 'easeInOutExpo'],
          circ: ['easeInCirc', 'easeOutCirc', 'easeInOutCirc'],
          back: ['easeInBack', 'easeOutBack', 'easeInOutBack'],
          elastic: ['easeInElastic', 'easeOutElastic', 'easeInOutElastic'],
          bounce: ['easeInBounce', 'easeOutBounce', 'easeInOutBounce'],
          smooth: ['smoothStep', 'smootherStep'],
        };

        result = {
          operation: 'list',
          categories,
          total: Object.keys(EASING_FUNCTIONS).length,
          bezier_presets: Object.keys(BEZIER_PRESETS),
          usage: 'Use easing parameter with calculate/visualize/table operations',
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
      content: `Animation Easing Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isAnimationEasingAvailable(): boolean {
  return true;
}
