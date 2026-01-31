/**
 * NUMERICAL INTEGRATION TOOL
 *
 * Numerical integration (quadrature) methods for definite integrals.
 * Runs entirely locally - no external API costs.
 *
 * Methods:
 * - Trapezoidal rule
 * - Simpson's rule (1/3 and 3/8)
 * - Gaussian quadrature (Gauss-Legendre)
 * - Adaptive Simpson's
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Gauss-Legendre quadrature nodes and weights (5-point)
const GL_NODES_5 = [
  -0.906179845938664, -0.5384693101056831, 0.0, 0.5384693101056831, 0.906179845938664,
];
const GL_WEIGHTS_5 = [
  0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665,
  0.2369268850561891,
];

// Gauss-Legendre 10-point for higher accuracy
const GL_NODES_10 = [
  -0.9739065285171717, -0.8650633666889845, -0.6794095682990244, -0.4333953941292472,
  -0.1488743389816312, 0.1488743389816312, 0.4333953941292472, 0.6794095682990244,
  0.8650633666889845, 0.9739065285171717,
];
const GL_WEIGHTS_10 = [
  0.0666713443086881, 0.1494513491505806, 0.219086362515982, 0.2692667193099963, 0.2955242247147529,
  0.2955242247147529, 0.2692667193099963, 0.219086362515982, 0.1494513491505806, 0.0666713443086881,
];

type MathFunc = (x: number) => number;

// Create function from string expression
function createFunction(expr: string): MathFunc {
  // eslint-disable-next-line no-new-func
  const fn = new Function('x', 'Math', `return ${expr};`);
  return (x: number) => fn(x, Math);
}

// Trapezoidal rule
function trapezoidal(f: MathFunc, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let sum = 0.5 * (f(a) + f(b));
  for (let i = 1; i < n; i++) {
    sum += f(a + i * h);
  }
  return h * sum;
}

// Simpson's 1/3 rule
function simpsons(f: MathFunc, a: number, b: number, n: number): number {
  if (n % 2 !== 0) n++; // Must be even
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  }
  return (h / 3) * sum;
}

// Adaptive Simpson's rule
function adaptiveSimpson(
  f: MathFunc,
  a: number,
  b: number,
  tol: number,
  maxDepth: number = 50
): number {
  function simpsonStep(a: number, b: number, fa: number, fb: number, depth: number): number {
    const c = (a + b) / 2;
    const fc = f(c);
    const h = b - a;
    const s1 = (h / 6) * (fa + 4 * fc + fb);

    const d = (a + c) / 2;
    const e = (c + b) / 2;
    const fd = f(d);
    const fe = f(e);
    const s2 = (h / 12) * (fa + 4 * fd + 2 * fc + 4 * fe + fb);

    if (depth >= maxDepth || Math.abs(s2 - s1) < 15 * tol) {
      return s2 + (s2 - s1) / 15;
    }

    return simpsonStep(a, c, fa, fc, depth + 1) + simpsonStep(c, b, fc, fb, depth + 1);
  }

  return simpsonStep(a, b, f(a), f(b), 0);
}

// Gauss-Legendre quadrature
function gaussLegendre(f: MathFunc, a: number, b: number, points: 5 | 10 = 10): number {
  const nodes = points === 5 ? GL_NODES_5 : GL_NODES_10;
  const weights = points === 5 ? GL_WEIGHTS_5 : GL_WEIGHTS_10;

  const mid = (a + b) / 2;
  const halfWidth = (b - a) / 2;

  let sum = 0;
  for (let i = 0; i < nodes.length; i++) {
    const x = mid + halfWidth * nodes[i];
    sum += weights[i] * f(x);
  }

  return halfWidth * sum;
}

// Composite Gauss-Legendre for higher accuracy
function compositeGaussLegendre(f: MathFunc, a: number, b: number, intervals: number): number {
  const h = (b - a) / intervals;
  let sum = 0;
  for (let i = 0; i < intervals; i++) {
    sum += gaussLegendre(f, a + i * h, a + (i + 1) * h, 10);
  }
  return sum;
}

// Romberg integration
function romberg(
  f: MathFunc,
  a: number,
  b: number,
  maxIter: number = 10,
  tol: number = 1e-10
): number {
  const R: number[][] = [];

  for (let i = 0; i <= maxIter; i++) {
    R[i] = [];
    const n = Math.pow(2, i);
    R[i][0] = trapezoidal(f, a, b, n);

    for (let j = 1; j <= i; j++) {
      const factor = Math.pow(4, j);
      R[i][j] = (factor * R[i][j - 1] - R[i - 1][j - 1]) / (factor - 1);
    }

    if (i > 0 && Math.abs(R[i][i] - R[i - 1][i - 1]) < tol) {
      return R[i][i];
    }
  }

  return R[maxIter][maxIter];
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const numericalIntegrateTool: UnifiedTool = {
  name: 'numerical_integrate',
  description: `Compute definite integrals numerically using various quadrature methods.

Methods available:
- trapezoidal: Simple, good for smooth functions
- simpsons: More accurate, requires even intervals
- adaptive: Automatically adjusts step size for accuracy
- gauss: Gauss-Legendre quadrature (very accurate)
- romberg: Richardson extrapolation (highest accuracy)

Use for: Physics (work, flux), probability (CDFs), engineering (area under curves)`,
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description:
          'Function to integrate as JS expression using x. E.g., "Math.sin(x)", "x*x", "Math.exp(-x*x)"',
      },
      lower_bound: {
        type: 'number',
        description: 'Lower limit of integration (a)',
      },
      upper_bound: {
        type: 'number',
        description: 'Upper limit of integration (b)',
      },
      method: {
        type: 'string',
        enum: ['trapezoidal', 'simpsons', 'adaptive', 'gauss', 'romberg'],
        description: 'Integration method (default: adaptive)',
      },
      intervals: {
        type: 'number',
        description: 'Number of intervals/subdivisions (default: 1000)',
      },
      tolerance: {
        type: 'number',
        description: 'Error tolerance for adaptive methods (default: 1e-10)',
      },
    },
    required: ['expression', 'lower_bound', 'upper_bound'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isNumericalIntegrateAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeNumericalIntegrate(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    expression: string;
    lower_bound: number;
    upper_bound: number;
    method?: string;
    intervals?: number;
    tolerance?: number;
  };

  const {
    expression,
    lower_bound: a,
    upper_bound: b,
    method = 'adaptive',
    intervals = 1000,
    tolerance = 1e-10,
  } = args;

  try {
    const f = createFunction(expression);

    // Test the function
    const testVal = f((a + b) / 2);
    if (!isFinite(testVal)) {
      throw new Error('Function returns non-finite values in the integration range');
    }

    let result: number;
    let methodUsed = method;
    const details: Record<string, unknown> = {};

    switch (method) {
      case 'trapezoidal':
        result = trapezoidal(f, a, b, intervals);
        details.intervals = intervals;
        break;

      case 'simpsons':
        result = simpsons(f, a, b, intervals);
        details.intervals = intervals % 2 === 0 ? intervals : intervals + 1;
        break;

      case 'adaptive':
        result = adaptiveSimpson(f, a, b, tolerance);
        details.tolerance = tolerance;
        details.method_detail = "Adaptive Simpson's with Richardson extrapolation";
        break;

      case 'gauss':
        result = compositeGaussLegendre(f, a, b, Math.ceil(intervals / 10));
        details.intervals = Math.ceil(intervals / 10);
        details.points_per_interval = 10;
        details.method_detail = '10-point Gauss-Legendre quadrature';
        break;

      case 'romberg':
        result = romberg(f, a, b, 15, tolerance);
        details.tolerance = tolerance;
        details.method_detail = 'Romberg integration with Richardson extrapolation';
        break;

      default:
        result = adaptiveSimpson(f, a, b, tolerance);
        methodUsed = 'adaptive';
    }

    // Compute comparison with different methods for validation
    const comparison = {
      trapezoidal_100: trapezoidal(f, a, b, 100),
      simpsons_100: simpsons(f, a, b, 100),
      gauss_10: compositeGaussLegendre(f, a, b, 10),
    };

    return {
      toolCallId: call.id,
      content: JSON.stringify(
        {
          integral: result,
          expression,
          bounds: { lower: a, upper: b },
          method: methodUsed,
          details,
          comparison,
          note: 'Values should converge as accuracy increases',
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
        bounds: { lower: a, upper: b },
      }),
      isError: true,
    };
  }
}
