/**
 * ROOT FINDER TOOL
 *
 * Find zeros/roots of functions using numerical methods.
 * Runs entirely locally - no external API costs.
 *
 * Methods:
 * - Bisection (guaranteed convergence)
 * - Newton-Raphson (fast, needs derivative)
 * - Secant method (fast, no derivative needed)
 * - Brent's method (robust and fast)
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type MathFunc = (x: number) => number;

// Create function from string expression
function createFunction(expr: string): MathFunc {
  // eslint-disable-next-line no-new-func
  const fn = new Function('x', 'Math', `return ${expr};`);
  return (x: number) => fn(x, Math);
}

// Numerical derivative
function numericalDerivative(f: MathFunc, x: number, h: number = 1e-8): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

// Bisection method
function bisection(
  f: MathFunc,
  a: number,
  b: number,
  tol: number,
  maxIter: number
): { root: number; iterations: number; converged: boolean } {
  if (f(a) * f(b) > 0) {
    throw new Error('Function must have opposite signs at interval endpoints');
  }

  let iterations = 0;
  while ((b - a) / 2 > tol && iterations < maxIter) {
    const c = (a + b) / 2;
    if (f(c) === 0) {
      return { root: c, iterations, converged: true };
    }
    if (f(a) * f(c) < 0) {
      b = c;
    } else {
      a = c;
    }
    iterations++;
  }

  return { root: (a + b) / 2, iterations, converged: (b - a) / 2 <= tol };
}

// Newton-Raphson method
function newtonRaphson(
  f: MathFunc,
  df: MathFunc | null,
  x0: number,
  tol: number,
  maxIter: number
): { root: number; iterations: number; converged: boolean } {
  let x = x0;
  let iterations = 0;

  while (iterations < maxIter) {
    const fx = f(x);
    if (Math.abs(fx) < tol) {
      return { root: x, iterations, converged: true };
    }

    const dfx = df ? df(x) : numericalDerivative(f, x);
    if (Math.abs(dfx) < 1e-15) {
      throw new Error('Derivative too small - method may not converge');
    }

    const xNew = x - fx / dfx;
    if (Math.abs(xNew - x) < tol) {
      return { root: xNew, iterations: iterations + 1, converged: true };
    }

    x = xNew;
    iterations++;
  }

  return { root: x, iterations, converged: false };
}

// Secant method
function secant(
  f: MathFunc,
  x0: number,
  x1: number,
  tol: number,
  maxIter: number
): { root: number; iterations: number; converged: boolean } {
  let xPrev = x0;
  let xCurr = x1;
  let iterations = 0;

  while (iterations < maxIter) {
    const fPrev = f(xPrev);
    const fCurr = f(xCurr);

    if (Math.abs(fCurr) < tol) {
      return { root: xCurr, iterations, converged: true };
    }

    if (Math.abs(fCurr - fPrev) < 1e-15) {
      throw new Error('Division by zero - secant method failed');
    }

    const xNew = xCurr - (fCurr * (xCurr - xPrev)) / (fCurr - fPrev);

    if (Math.abs(xNew - xCurr) < tol) {
      return { root: xNew, iterations: iterations + 1, converged: true };
    }

    xPrev = xCurr;
    xCurr = xNew;
    iterations++;
  }

  return { root: xCurr, iterations, converged: false };
}

// Brent's method (combination of bisection, secant, and inverse quadratic interpolation)
function brent(
  f: MathFunc,
  a: number,
  b: number,
  tol: number,
  maxIter: number
): { root: number; iterations: number; converged: boolean } {
  let fa = f(a);
  let fb = f(b);

  if (fa * fb > 0) {
    throw new Error('Function must have opposite signs at interval endpoints');
  }

  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }

  let c = a;
  let fc = fa;
  let d = b - a;
  let iterations = 0;

  while (iterations < maxIter) {
    if (Math.abs(fb) < tol) {
      return { root: b, iterations, converged: true };
    }

    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation
      const s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));

      if (s > Math.min(b, (3 * a + b) / 4) && s < Math.max(b, (3 * a + b) / 4)) {
        d = s - b;
      } else {
        d = (a - b) / 2;
      }
    } else {
      // Secant method
      d = ((a - b) * fb) / (fb - fa);
    }

    if (Math.abs(d) < tol) {
      d = tol * Math.sign(a - b);
    }

    c = b;
    fc = fb;
    b = b + d;
    fb = f(b);

    if (fa * fb < 0) {
      c = a;
      fc = fa;
    }

    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }

    a = c;
    fa = fc;
    iterations++;
  }

  return { root: b, iterations, converged: false };
}

// Find multiple roots in an interval
function findAllRoots(
  f: MathFunc,
  a: number,
  b: number,
  numSamples: number,
  tol: number
): number[] {
  const roots: number[] = [];
  const step = (b - a) / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const x1 = a + i * step;
    const x2 = a + (i + 1) * step;

    if (f(x1) * f(x2) < 0) {
      try {
        const result = brent(f, x1, x2, tol, 100);
        if (result.converged) {
          // Check if this root is already found
          const isDuplicate = roots.some((r) => Math.abs(r - result.root) < tol * 10);
          if (!isDuplicate) {
            roots.push(result.root);
          }
        }
      } catch {
        // Skip this interval
      }
    }
  }

  return roots.sort((a, b) => a - b);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const rootFinderTool: UnifiedTool = {
  name: 'find_roots',
  description: `Find zeros/roots of mathematical functions using numerical methods.

Methods available:
- bisection: Guaranteed to converge if root exists in interval
- newton: Fast quadratic convergence, needs good initial guess
- secant: Fast, doesn't need derivative
- brent: Robust combination of methods (recommended)
- scan: Find all roots in an interval

Use for: Solving equations, finding equilibrium points, optimization`,
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Function f(x) to find roots of. E.g., "x*x - 2" for √2, "Math.cos(x) - x"',
      },
      method: {
        type: 'string',
        enum: ['bisection', 'newton', 'secant', 'brent', 'scan'],
        description: 'Root-finding method (default: brent)',
      },
      interval_start: {
        type: 'number',
        description: 'Start of search interval (for bisection, brent, scan)',
      },
      interval_end: {
        type: 'number',
        description: 'End of search interval (for bisection, brent, scan)',
      },
      initial_guess: {
        type: 'number',
        description: 'Initial guess x0 (for newton, secant)',
      },
      second_guess: {
        type: 'number',
        description: 'Second initial point x1 (for secant method)',
      },
      derivative: {
        type: 'string',
        description: "Optional derivative f'(x) for Newton's method",
      },
      tolerance: {
        type: 'number',
        description: 'Convergence tolerance (default: 1e-10)',
      },
      max_iterations: {
        type: 'number',
        description: 'Maximum iterations (default: 100)',
      },
    },
    required: ['expression'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isRootFinderAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeRootFinder(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    expression: string;
    method?: string;
    interval_start?: number;
    interval_end?: number;
    initial_guess?: number;
    second_guess?: number;
    derivative?: string;
    tolerance?: number;
    max_iterations?: number;
  };

  const {
    expression,
    method = 'brent',
    interval_start,
    interval_end,
    initial_guess,
    second_guess,
    derivative,
    tolerance = 1e-10,
    max_iterations = 100,
  } = args;

  try {
    const f = createFunction(expression);
    const df = derivative ? createFunction(derivative) : null;

    let result: { root?: number; roots?: number[]; iterations?: number; converged?: boolean };

    switch (method) {
      case 'bisection':
        if (interval_start === undefined || interval_end === undefined) {
          throw new Error('Bisection requires interval_start and interval_end');
        }
        result = bisection(f, interval_start, interval_end, tolerance, max_iterations);
        break;

      case 'newton':
        if (initial_guess === undefined) {
          throw new Error('Newton method requires initial_guess');
        }
        result = newtonRaphson(f, df, initial_guess, tolerance, max_iterations);
        break;

      case 'secant':
        if (initial_guess === undefined) {
          throw new Error('Secant method requires initial_guess');
        }
        const x1 = second_guess ?? initial_guess + 0.1;
        result = secant(f, initial_guess, x1, tolerance, max_iterations);
        break;

      case 'brent':
        if (interval_start === undefined || interval_end === undefined) {
          throw new Error('Brent method requires interval_start and interval_end');
        }
        result = brent(f, interval_start, interval_end, tolerance, max_iterations);
        break;

      case 'scan':
        if (interval_start === undefined || interval_end === undefined) {
          throw new Error('Scan method requires interval_start and interval_end');
        }
        const roots = findAllRoots(f, interval_start, interval_end, 1000, tolerance);
        result = { roots, converged: true };
        break;

      default:
        if (interval_start !== undefined && interval_end !== undefined) {
          result = brent(f, interval_start, interval_end, tolerance, max_iterations);
        } else if (initial_guess !== undefined) {
          result = newtonRaphson(f, df, initial_guess, tolerance, max_iterations);
        } else {
          throw new Error('Provide either an interval or initial guess');
        }
    }

    // Verify the root(s)
    const verification: Record<string, unknown> = {};
    if (result.root !== undefined) {
      verification.f_at_root = f(result.root);
    }
    if (result.roots) {
      verification.f_at_roots = result.roots.map((r) => ({ x: r, f_x: f(r) }));
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(
        {
          ...result,
          expression,
          method,
          tolerance,
          verification,
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
        expression,
        method,
      }),
      isError: true,
    };
  }
}
