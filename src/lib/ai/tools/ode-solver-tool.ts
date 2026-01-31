/**
 * ODE SOLVER TOOL
 *
 * Numerical differential equation solver using custom Runge-Kutta implementation.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Ordinary differential equations (ODEs)
 * - Systems of ODEs
 * - Initial value problems
 * - Adaptive step size Runge-Kutta 4/5 method
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// RUNGE-KUTTA 4/5 (Dormand-Prince) IMPLEMENTATION
// ============================================================================

// Dormand-Prince coefficients for RK45 adaptive method
const a = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const b = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const c5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const c4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

type DerivativeFunc = (t: number, y: number[]) => number[];

interface RK45Result {
  t: number[];
  y: number[][];
}

function rk45(
  f: DerivativeFunc,
  y0: number[],
  t0: number,
  tf: number,
  tol: number = 1e-8,
  maxSteps: number = 10000
): RK45Result {
  const dim = y0.length;
  const tOut: number[] = [t0];
  const yOut: number[][] = [y0.slice()];

  let t = t0;
  let y = y0.slice();
  let h = (tf - t0) / 100; // Initial step size estimate
  let steps = 0;

  while (t < tf && steps < maxSteps) {
    if (t + h > tf) h = tf - t;

    // Calculate k values
    const k: number[][] = [];
    k[0] = f(t, y);

    for (let i = 1; i <= 6; i++) {
      const yTemp = new Array(dim);
      for (let j = 0; j < dim; j++) {
        let sum = 0;
        for (let l = 0; l < i; l++) {
          sum += b[i][l] * k[l][j];
        }
        yTemp[j] = y[j] + h * sum;
      }
      k[i] = f(t + a[i] * h, yTemp);
    }

    // 5th order solution
    const y5 = new Array(dim);
    for (let j = 0; j < dim; j++) {
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        sum += c5[i] * k[i][j];
      }
      y5[j] = y[j] + h * sum;
    }

    // 4th order solution
    const y4 = new Array(dim);
    for (let j = 0; j < dim; j++) {
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        sum += c4[i] * k[i][j];
      }
      y4[j] = y[j] + h * sum;
    }

    // Error estimate
    let err = 0;
    for (let j = 0; j < dim; j++) {
      const scale = Math.max(Math.abs(y[j]), Math.abs(y5[j]), 1e-10);
      err = Math.max(err, Math.abs(y5[j] - y4[j]) / scale);
    }
    err = err / tol;

    // Step size adaptation
    if (err <= 1) {
      // Accept step
      t += h;
      y = y5;
      tOut.push(t);
      yOut.push(y.slice());
    }

    // Adjust step size
    const factor = err > 0 ? Math.pow(err, -0.2) : 2;
    h = h * Math.min(2, Math.max(0.1, 0.9 * factor));

    steps++;
  }

  return { t: tOut, y: yOut };
}

// Simple fixed-step RK4 for uniform output
function rk4Fixed(
  f: DerivativeFunc,
  y0: number[],
  t0: number,
  tf: number,
  steps: number
): RK45Result {
  const dim = y0.length;
  const h = (tf - t0) / steps;
  const tOut: number[] = [t0];
  const yOut: number[][] = [y0.slice()];

  let t = t0;
  const y = y0.slice();

  for (let i = 0; i < steps; i++) {
    const k1 = f(t, y);

    const yTemp2 = y.map((v, j) => v + 0.5 * h * k1[j]);
    const k2 = f(t + 0.5 * h, yTemp2);

    const yTemp3 = y.map((v, j) => v + 0.5 * h * k2[j]);
    const k3 = f(t + 0.5 * h, yTemp3);

    const yTemp4 = y.map((v, j) => v + h * k3[j]);
    const k4 = f(t + h, yTemp4);

    // Update y
    for (let j = 0; j < dim; j++) {
      y[j] = y[j] + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
    }
    t += h;

    tOut.push(t);
    yOut.push(y.slice());
  }

  return { t: tOut, y: yOut };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const odeSolverTool: UnifiedTool = {
  name: 'solve_ode',
  description: `Solve ordinary differential equations (ODEs) numerically.

Supports:
- Single ODEs: dy/dt = f(t, y)
- Systems of ODEs: dy/dt = [f1(t,y), f2(t,y), ...]
- Initial value problems with adaptive step size

Common use cases:
- Physics: motion, oscillations, pendulum, projectiles
- Chemistry: reaction kinetics, decay
- Biology: population dynamics, epidemiology (SIR models)
- Engineering: circuit analysis, control systems

The function parameter uses JavaScript syntax with variables:
- t: independent variable (time)
- y: dependent variable(s) (array for systems)
- Math functions: sin, cos, exp, log, sqrt, pow, etc.`,
  parameters: {
    type: 'object',
    properties: {
      equation: {
        type: 'string',
        description:
          'ODE as JS expression. Single: "Math.sin(t) - y[0]" for dy/dt = sin(t) - y. System: "[y[1], -9.81]" for projectile motion',
      },
      initial_conditions: {
        type: 'array',
        items: { type: 'number' },
        description: 'Initial values [y0] for single ODE or [y0, y1, ...] for systems',
      },
      t_start: {
        type: 'number',
        description: 'Start time (default: 0)',
      },
      t_end: {
        type: 'number',
        description: 'End time',
      },
      steps: {
        type: 'number',
        description: 'Number of output points (default: 100)',
      },
      tolerance: {
        type: 'number',
        description: 'Error tolerance for adaptive method (default: 1e-8)',
      },
      method: {
        type: 'string',
        enum: ['rk45', 'rk4'],
        description: 'Method: rk45 (adaptive) or rk4 (fixed step). Default: rk4',
      },
    },
    required: ['equation', 'initial_conditions', 't_end'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isOdeSolverAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeOdeSolver(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    equation: string;
    initial_conditions: number[];
    t_start?: number;
    t_end: number;
    steps?: number;
    tolerance?: number;
    method?: 'rk45' | 'rk4';
  };

  const {
    equation,
    initial_conditions,
    t_start = 0,
    t_end,
    steps = 100,
    tolerance = 1e-8,
    method = 'rk4',
  } = args;

  try {
    const dimension = initial_conditions.length;

    // Create the derivative function from the equation string
    let derivativeFunc: DerivativeFunc;

    try {
      // Wrap in function to evaluate the equation
      // eslint-disable-next-line no-new-func
      const evalFunc = new Function('t', 'y', 'Math', `return ${equation};`);

      derivativeFunc = (t: number, y: number[]): number[] => {
        const result = evalFunc(t, y, Math);
        // Ensure result is an array
        if (typeof result === 'number') {
          return [result];
        }
        return result;
      };
    } catch (parseError) {
      throw new Error(`Failed to parse equation: ${parseError}`);
    }

    // Solve the ODE
    let result: RK45Result;
    if (method === 'rk45') {
      result = rk45(derivativeFunc, initial_conditions, t_start, t_end, tolerance);
    } else {
      result = rk4Fixed(derivativeFunc, initial_conditions, t_start, t_end, steps);
    }

    const tValues = result.t;
    const yValues = result.y;

    // Find extrema if single variable
    let analysis: Record<string, unknown> = {};
    if (dimension === 1) {
      const y1d = yValues.map((y) => y[0]);
      const maxIdx = y1d.indexOf(Math.max(...y1d));
      const minIdx = y1d.indexOf(Math.min(...y1d));
      analysis = {
        maximum: { t: tValues[maxIdx], y: y1d[maxIdx] },
        minimum: { t: tValues[minIdx], y: y1d[minIdx] },
        final: { t: tValues[tValues.length - 1], y: y1d[y1d.length - 1] },
      };
    }

    // Sample points for output (limit to ~20 points)
    const stride = Math.max(1, Math.floor(tValues.length / 20));
    const samplePoints = tValues
      .map((t, i) => ({ t, y: yValues[i] }))
      .filter((_, i) => i % stride === 0 || i === tValues.length - 1);

    return {
      toolCallId: call.id,
      content: JSON.stringify(
        {
          equation,
          initial_conditions,
          time_range: [t_start, t_end],
          dimension,
          method,
          total_points: tValues.length,
          tolerance: method === 'rk45' ? tolerance : 'fixed step',
          analysis,
          sample_points: samplePoints,
          final_state: { t: tValues[tValues.length - 1], y: yValues[yValues.length - 1] },
        },
        null,
        2
      ),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        equation,
      }),
      isError: true,
    };
  }
}
