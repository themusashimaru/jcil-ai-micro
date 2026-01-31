/**
 * INTERPOLATION TOOL
 *
 * Interpolation and curve fitting for data points.
 * Runs entirely locally - no external API costs.
 *
 * Methods:
 * - Linear interpolation
 * - Polynomial interpolation (Lagrange, Newton)
 * - Cubic spline interpolation
 * - Polynomial regression fitting
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Linear interpolation
function linearInterpolate(xData: number[], yData: number[], xQuery: number): number {
  const n = xData.length;

  if (xQuery <= xData[0]) return yData[0];
  if (xQuery >= xData[n - 1]) return yData[n - 1];

  // Find the interval
  let i = 0;
  while (i < n - 1 && xData[i + 1] < xQuery) i++;

  const t = (xQuery - xData[i]) / (xData[i + 1] - xData[i]);
  return yData[i] + t * (yData[i + 1] - yData[i]);
}

// Lagrange polynomial interpolation
function lagrangeInterpolate(xData: number[], yData: number[], xQuery: number): number {
  const n = xData.length;
  let result = 0;

  for (let i = 0; i < n; i++) {
    let term = yData[i];
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        term *= (xQuery - xData[j]) / (xData[i] - xData[j]);
      }
    }
    result += term;
  }

  return result;
}

// Newton's divided differences interpolation
function newtonInterpolate(
  xData: number[],
  yData: number[]
): { coefficients: number[]; evaluate: (x: number) => number } {
  const n = xData.length;
  const dividedDiff: number[][] = [];

  // Initialize with y values
  dividedDiff[0] = [...yData];

  // Compute divided differences
  for (let j = 1; j < n; j++) {
    dividedDiff[j] = [];
    for (let i = 0; i < n - j; i++) {
      dividedDiff[j][i] =
        (dividedDiff[j - 1][i + 1] - dividedDiff[j - 1][i]) / (xData[i + j] - xData[i]);
    }
  }

  // Extract coefficients (first element of each column)
  const coefficients = dividedDiff.map((col) => col[0]);

  // Evaluate polynomial using Horner's method
  const evaluate = (x: number): number => {
    let result = coefficients[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      result = result * (x - xData[i]) + coefficients[i];
    }
    return result;
  };

  return { coefficients, evaluate };
}

// Cubic spline interpolation (natural spline)
function cubicSplineInterpolate(
  xData: number[],
  yData: number[]
): {
  evaluate: (x: number) => number;
  coefficients: { a: number[]; b: number[]; c: number[]; d: number[] };
} {
  const n = xData.length - 1;
  const h: number[] = [];
  const alpha: number[] = [];

  // Step 1: Compute h and alpha
  for (let i = 0; i < n; i++) {
    h[i] = xData[i + 1] - xData[i];
  }

  for (let i = 1; i < n; i++) {
    alpha[i] = (3 / h[i]) * (yData[i + 1] - yData[i]) - (3 / h[i - 1]) * (yData[i] - yData[i - 1]);
  }

  // Step 2: Solve tridiagonal system
  const l: number[] = [1];
  const mu: number[] = [0];
  const z: number[] = [0];

  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xData[i + 1] - xData[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  l[n] = 1;
  z[n] = 0;

  // Step 3: Back substitution
  const a = [...yData];
  const b: number[] = new Array(n);
  const c: number[] = new Array(n + 1);
  const d: number[] = new Array(n);

  c[n] = 0;

  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  // Evaluate function
  const evaluate = (x: number): number => {
    // Find the right interval
    let i = 0;
    while (i < n - 1 && x > xData[i + 1]) i++;
    if (i >= n) i = n - 1;

    const dx = x - xData[i];
    return a[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  };

  return { evaluate, coefficients: { a: a.slice(0, n), b, c: c.slice(0, n), d } };
}

// Polynomial regression (least squares fit)
function polynomialFit(
  xData: number[],
  yData: number[],
  degree: number
): { coefficients: number[]; evaluate: (x: number) => number; rSquared: number } {
  const n = xData.length;
  const m = degree + 1;

  // Build Vandermonde matrix
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    X[i] = [];
    for (let j = 0; j < m; j++) {
      X[i][j] = Math.pow(xData[i], j);
    }
  }

  // Compute X^T * X
  const XtX: number[][] = [];
  for (let i = 0; i < m; i++) {
    XtX[i] = [];
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
    }
  }

  // Compute X^T * y
  const Xty: number[] = [];
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * yData[k];
    }
    Xty[i] = sum;
  }

  // Solve using Gaussian elimination
  const coefficients = solveLinearSystem(XtX, Xty);

  // Evaluate polynomial
  const evaluate = (x: number): number => {
    let result = 0;
    for (let i = 0; i < coefficients.length; i++) {
      result += coefficients[i] * Math.pow(x, i);
    }
    return result;
  };

  // Compute R-squared
  const yMean = yData.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yPred = evaluate(xData[i]);
    ssRes += (yData[i] - yPred) ** 2;
    ssTot += (yData[i] - yMean) ** 2;
  }
  const rSquared = 1 - ssRes / ssTot;

  return { coefficients, evaluate, rSquared };
}

// Gaussian elimination for solving linear systems
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Partial pivoting
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Elimination
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // Back substitution
  const x: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const interpolationTool: UnifiedTool = {
  name: 'interpolate',
  description: `Interpolate data points and fit curves using various methods.

Methods:
- linear: Simple linear interpolation between points
- lagrange: Polynomial through all points (Lagrange form)
- newton: Polynomial through all points (Newton form)
- spline: Smooth cubic spline (natural boundary conditions)
- polyfit: Least squares polynomial regression

Use for: Data fitting, signal reconstruction, curve smoothing`,
  parameters: {
    type: 'object',
    properties: {
      x_data: {
        type: 'array',
        items: { type: 'number' },
        description: 'X coordinates of data points',
      },
      y_data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Y coordinates of data points',
      },
      method: {
        type: 'string',
        enum: ['linear', 'lagrange', 'newton', 'spline', 'polyfit'],
        description: 'Interpolation method (default: spline)',
      },
      x_query: {
        type: 'array',
        items: { type: 'number' },
        description: 'X values to interpolate at (optional)',
      },
      degree: {
        type: 'number',
        description: 'Polynomial degree for polyfit (default: auto)',
      },
    },
    required: ['x_data', 'y_data'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isInterpolationAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeInterpolation(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    x_data: number[];
    y_data: number[];
    method?: string;
    x_query?: number[];
    degree?: number;
  };

  const { x_data, y_data, method = 'spline', x_query, degree } = args;

  try {
    if (x_data.length !== y_data.length) {
      throw new Error('x_data and y_data must have the same length');
    }
    if (x_data.length < 2) {
      throw new Error('At least 2 data points required');
    }

    // Sort data by x
    const indices = x_data.map((_, i) => i).sort((a, b) => x_data[a] - x_data[b]);
    const xSorted = indices.map((i) => x_data[i]);
    const ySorted = indices.map((i) => y_data[i]);

    const result: Record<string, unknown> = { method };
    let evalFunc: (x: number) => number;

    switch (method) {
      case 'linear':
        evalFunc = (x) => linearInterpolate(xSorted, ySorted, x);
        result.method_detail = 'Piecewise linear interpolation';
        break;

      case 'lagrange':
        evalFunc = (x) => lagrangeInterpolate(xSorted, ySorted, x);
        result.method_detail = 'Lagrange polynomial interpolation';
        result.polynomial_degree = x_data.length - 1;
        break;

      case 'newton': {
        const newton = newtonInterpolate(xSorted, ySorted);
        evalFunc = newton.evaluate;
        result.coefficients = newton.coefficients;
        result.method_detail = 'Newton divided differences';
        break;
      }

      case 'spline': {
        const spline = cubicSplineInterpolate(xSorted, ySorted);
        evalFunc = spline.evaluate;
        result.spline_coefficients = spline.coefficients;
        result.method_detail = 'Natural cubic spline';
        break;
      }

      case 'polyfit': {
        const deg = degree ?? Math.min(x_data.length - 1, 5);
        const fit = polynomialFit(xSorted, ySorted, deg);
        evalFunc = fit.evaluate;
        result.coefficients = fit.coefficients;
        result.r_squared = fit.rSquared;
        result.degree = deg;
        result.method_detail = `Polynomial regression degree ${deg}`;
        break;
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    // Interpolate at query points
    if (x_query && x_query.length > 0) {
      result.interpolated_values = x_query.map((x) => ({
        x,
        y: evalFunc(x),
      }));
    } else {
      // Generate sample points for visualization
      const xMin = Math.min(...xSorted);
      const xMax = Math.max(...xSorted);
      const samples = 21;
      const samplePoints = [];
      for (let i = 0; i < samples; i++) {
        const x = xMin + (i / (samples - 1)) * (xMax - xMin);
        samplePoints.push({ x, y: evalFunc(x) });
      }
      result.sample_curve = samplePoints;
    }

    result.data_points = x_data.length;
    result.x_range = [Math.min(...xSorted), Math.max(...xSorted)];

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        method,
      }),
      isError: true,
    };
  }
}
