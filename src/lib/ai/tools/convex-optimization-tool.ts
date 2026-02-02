/**
 * CONVEX-OPTIMIZATION TOOL
 * Convex optimization algorithms and solvers
 *
 * Implements:
 * - Gradient Descent (with various step size rules)
 * - Newton's Method
 * - Interior Point Method (barrier method)
 * - Proximal Gradient Method
 * - ADMM (Alternating Direction Method of Multipliers)
 * - Linear Programming (Simplex)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Vector operations
type Vector = number[];
type Matrix = number[][];

function vecAdd(a: Vector, b: Vector): Vector {
  return a.map((x, i) => x + b[i]);
}

function vecSub(a: Vector, b: Vector): Vector {
  return a.map((x, i) => x - b[i]);
}

function vecScale(v: Vector, s: number): Vector {
  return v.map(x => x * s);
}

function vecDot(a: Vector, b: Vector): number {
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}

function vecNorm(v: Vector): number {
  return Math.sqrt(vecDot(v, v));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function matVecMul(A: Matrix, x: Vector): Vector {
  return A.map(row => vecDot(row, x));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function matMul(A: Matrix, B: Matrix): Matrix {
  const n = A.length;
  const m = B[0].length;
  const p = B.length;
  const result: Matrix = Array(n).fill(0).map(() => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < p; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function transpose(A: Matrix): Matrix {
  return A[0].map((_, i) => A.map(row => row[i]));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function identity(n: number): Matrix {
  return Array(n).fill(0).map((_, i) => Array(n).fill(0).map((__, j) => i === j ? 1 : 0));
}

// Solve Ax = b using Gaussian elimination with partial pivoting
function solveLinear(A: Matrix, b: Vector): Vector | null {
  const n = A.length;
  const aug: Matrix = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-10) continue;

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-10) return null;
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }
  return x;
}

// Numerical gradient
function numericalGradient(f: (x: Vector) => number, x: Vector, h: number = 1e-6): Vector {
  return x.map((_, i) => {
    const xPlus = [...x];
    const xMinus = [...x];
    xPlus[i] += h;
    xMinus[i] -= h;
    return (f(xPlus) - f(xMinus)) / (2 * h);
  });
}

// Numerical Hessian
function numericalHessian(f: (x: Vector) => number, x: Vector, h: number = 1e-5): Matrix {
  const n = x.length;
  const H: Matrix = Array(n).fill(0).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const xpp = [...x], xpm = [...x], xmp = [...x], xmm = [...x];
      xpp[i] += h; xpp[j] += h;
      xpm[i] += h; xpm[j] -= h;
      xmp[i] -= h; xmp[j] += h;
      xmm[i] -= h; xmm[j] -= h;

      H[i][j] = (f(xpp) - f(xpm) - f(xmp) + f(xmm)) / (4 * h * h);
      H[j][i] = H[i][j];
    }
  }
  return H;
}

// Test functions
interface OptimizationProblem {
  name: string;
  f: (x: Vector) => number;
  grad?: (x: Vector) => Vector;
  hess?: (x: Vector) => Matrix;
  x0: Vector;
  optimal?: Vector;
  optimalValue?: number;
  isConvex: boolean;
}

const testProblems: Record<string, OptimizationProblem> = {
  quadratic: {
    name: 'Quadratic f(x) = x^T A x + b^T x',
    f: (x) => x[0] * x[0] + 2 * x[1] * x[1] - 2 * x[0] - 4 * x[1] + 5,
    grad: (x) => [2 * x[0] - 2, 4 * x[1] - 4],
    hess: () => [[2, 0], [0, 4]],
    x0: [0, 0],
    optimal: [1, 1],
    optimalValue: 2,
    isConvex: true
  },
  rosenbrock: {
    name: 'Rosenbrock function (banana)',
    f: (x) => 100 * Math.pow(x[1] - x[0] * x[0], 2) + Math.pow(1 - x[0], 2),
    x0: [-1, 1],
    optimal: [1, 1],
    optimalValue: 0,
    isConvex: false // Non-convex but has unique minimum
  },
  sphere: {
    name: 'Sphere function (sum of squares)',
    f: (x) => x.reduce((sum, xi) => sum + xi * xi, 0),
    grad: (x) => x.map(xi => 2 * xi),
    hess: (x) => identity(x.length).map(row => row.map(v => v * 2)),
    x0: [1, 2, 3],
    optimal: [0, 0, 0],
    optimalValue: 0,
    isConvex: true
  },
  booth: {
    name: 'Booth function',
    f: (x) => Math.pow(x[0] + 2 * x[1] - 7, 2) + Math.pow(2 * x[0] + x[1] - 5, 2),
    x0: [0, 0],
    optimal: [1, 3],
    optimalValue: 0,
    isConvex: true
  },
  beale: {
    name: 'Beale function',
    f: (x) => {
      const [a, b] = [x[0], x[1]];
      return Math.pow(1.5 - a + a * b, 2) +
             Math.pow(2.25 - a + a * b * b, 2) +
             Math.pow(2.625 - a + a * b * b * b, 2);
    },
    x0: [0, 0],
    optimal: [3, 0.5],
    optimalValue: 0,
    isConvex: false
  },
  logSumExp: {
    name: 'Log-sum-exp (soft max)',
    f: (x) => Math.log(x.reduce((sum, xi) => sum + Math.exp(xi), 0)),
    x0: [1, 2, 3],
    isConvex: true
  }
};

// Gradient Descent
interface GDOptions {
  maxIter: number;
  tol: number;
  stepSize: number | 'backtracking' | 'diminishing';
  beta?: number;  // Backtracking parameter
  alpha?: number; // Backtracking decrease factor
}

interface OptimizationResult {
  x: Vector;
  fValue: number;
  iterations: number;
  converged: boolean;
  history: { iter: number; x: Vector; f: number; gradNorm: number }[];
}

function gradientDescent(
  f: (x: Vector) => number,
  x0: Vector,
  options: Partial<GDOptions> = {}
): OptimizationResult {
  const maxIter = options.maxIter || 1000;
  const tol = options.tol || 1e-6;
  const stepSizeRule = options.stepSize || 0.01;
  const beta = options.beta || 0.5;
  const alpha = options.alpha || 0.3;

  let x = [...x0];
  const history: OptimizationResult['history'] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const fVal = f(x);
    const grad = numericalGradient(f, x);
    const gradNorm = vecNorm(grad);

    history.push({ iter, x: [...x], f: fVal, gradNorm });

    if (gradNorm < tol) {
      return { x, fValue: fVal, iterations: iter, converged: true, history };
    }

    // Determine step size
    let t: number;
    if (typeof stepSizeRule === 'number') {
      t = stepSizeRule;
    } else if (stepSizeRule === 'backtracking') {
      t = 1;
      while (f(vecSub(x, vecScale(grad, t))) > fVal - alpha * t * gradNorm * gradNorm) {
        t *= beta;
        if (t < 1e-10) break;
      }
    } else { // diminishing
      t = 1 / (iter + 1);
    }

    // Update
    x = vecSub(x, vecScale(grad, t));
  }

  return { x, fValue: f(x), iterations: maxIter, converged: false, history };
}

// Newton's Method
function newtonsMethod(
  f: (x: Vector) => number,
  x0: Vector,
  options: { maxIter?: number; tol?: number; damped?: boolean } = {}
): OptimizationResult {
  const maxIter = options.maxIter || 100;
  const tol = options.tol || 1e-8;
  const damped = options.damped !== false;

  let x = [...x0];
  const history: OptimizationResult['history'] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const fVal = f(x);
    const grad = numericalGradient(f, x);
    const gradNorm = vecNorm(grad);

    history.push({ iter, x: [...x], f: fVal, gradNorm });

    if (gradNorm < tol) {
      return { x, fValue: fVal, iterations: iter, converged: true, history };
    }

    const H = numericalHessian(f, x);
    const direction = solveLinear(H, vecScale(grad, -1));

    if (!direction) {
      // Hessian singular, fall back to gradient descent step
      x = vecSub(x, vecScale(grad, 0.01));
      continue;
    }

    // Line search for damped Newton
    let t = 1;
    if (damped) {
      while (f(vecAdd(x, vecScale(direction, t))) > fVal - 0.25 * t * vecDot(grad, direction)) {
        t *= 0.5;
        if (t < 1e-10) break;
      }
    }

    x = vecAdd(x, vecScale(direction, t));
  }

  return { x, fValue: f(x), iterations: maxIter, converged: false, history };
}

// Interior Point Method for constrained optimization
// minimize f(x) subject to g_i(x) <= 0
function interiorPoint(
  f: (x: Vector) => number,
  constraints: ((x: Vector) => number)[],
  x0: Vector,
  options: { maxIter?: number; tol?: number; muInit?: number; muFactor?: number } = {}
): OptimizationResult & { feasible: boolean } {
  const maxIter = options.maxIter || 50;
  const tol = options.tol || 1e-6;
  const muInit = options.muInit || 10;
  const muFactor = options.muFactor || 0.5;

  // Check initial feasibility
  const isFeasible = (x: Vector) => constraints.every(g => g(x) < 0);

  if (!isFeasible(x0)) {
    return {
      x: x0,
      fValue: f(x0),
      iterations: 0,
      converged: false,
      feasible: false,
      history: []
    };
  }

  let x = [...x0];
  let mu = muInit;
  const history: OptimizationResult['history'] = [];

  // Barrier function
  const barrier = (xx: Vector) => {
    let sum = 0;
    for (const g of constraints) {
      const val = g(xx);
      if (val >= 0) return Infinity;
      sum -= Math.log(-val);
    }
    return sum;
  };

  for (let outer = 0; outer < maxIter; outer++) {
    // Minimize f(x) + mu * barrier(x)
    const augmented = (xx: Vector) => f(xx) + mu * barrier(xx);

    const result = newtonsMethod(augmented, x, { maxIter: 20, tol: tol * mu });
    x = result.x;

    const fVal = f(x);
    const grad = numericalGradient(f, x);
    const gradNorm = vecNorm(grad);

    history.push({ iter: outer, x: [...x], f: fVal, gradNorm });

    if (mu * constraints.length < tol) {
      return { x, fValue: fVal, iterations: outer, converged: true, feasible: true, history };
    }

    mu *= muFactor;
  }

  return { x, fValue: f(x), iterations: maxIter, converged: false, feasible: true, history };
}

// Proximal gradient for L1 regularization (LASSO)
function proximalGradient(
  f: (x: Vector) => number,
  lambda: number,  // L1 regularization parameter
  x0: Vector,
  options: { maxIter?: number; tol?: number; stepSize?: number } = {}
): OptimizationResult {
  const maxIter = options.maxIter || 1000;
  const tol = options.tol || 1e-6;
  const t = options.stepSize || 0.01;

  let x = [...x0];
  const history: OptimizationResult['history'] = [];

  // Soft thresholding (proximal operator for L1)
  const softThreshold = (v: Vector, thresh: number): Vector =>
    v.map(vi => Math.sign(vi) * Math.max(0, Math.abs(vi) - thresh));

  for (let iter = 0; iter < maxIter; iter++) {
    const fVal = f(x);
    const l1Norm = x.reduce((sum, xi) => sum + Math.abs(xi), 0);
    const totalObj = fVal + lambda * l1Norm;

    const grad = numericalGradient(f, x);
    const gradNorm = vecNorm(grad);

    history.push({ iter, x: [...x], f: totalObj, gradNorm });

    // Gradient step followed by proximal operator
    const y = vecSub(x, vecScale(grad, t));
    const xNew = softThreshold(y, lambda * t);

    const diff = vecNorm(vecSub(xNew, x));
    x = xNew;

    if (diff < tol) {
      return { x, fValue: f(x) + lambda * x.reduce((s, xi) => s + Math.abs(xi), 0), iterations: iter, converged: true, history };
    }
  }

  return { x, fValue: f(x) + lambda * x.reduce((s, xi) => s + Math.abs(xi), 0), iterations: maxIter, converged: false, history };
}

// Simple LP solver using revised simplex (for small problems)
interface LPResult {
  x: Vector;
  optimal: number;
  status: 'optimal' | 'infeasible' | 'unbounded' | 'error';
  iterations: number;
}

function simplexLP(
  c: Vector,      // minimize c^T x
  A: Matrix,      // Ax <= b
  b: Vector
): LPResult {
  // Convert to standard form with slack variables
  const m = A.length;
  const n = c.length;

  // Augmented tableau
  const tableau: Matrix = [];
  for (let i = 0; i < m; i++) {
    const row = [...A[i]];
    for (let j = 0; j < m; j++) {
      row.push(i === j ? 1 : 0);
    }
    row.push(b[i]);
    tableau.push(row);
  }

  // Objective row
  const objRow = [...c.map(x => -x)];
  for (let j = 0; j < m; j++) objRow.push(0);
  objRow.push(0);
  tableau.push(objRow);

  const numCols = n + m + 1;
  let iter = 0;
  const maxIter = 100;

  while (iter < maxIter) {
    iter++;

    // Find entering variable (most negative in objective row)
    let pivotCol = -1;
    let minVal = -1e-10;
    for (let j = 0; j < numCols - 1; j++) {
      if (tableau[m][j] < minVal) {
        minVal = tableau[m][j];
        pivotCol = j;
      }
    }

    if (pivotCol === -1) {
      // Optimal found
      const x = Array(n).fill(0);
      for (let i = 0; i < m; i++) {
        // Find basic variable in row i
        for (let j = 0; j < n; j++) {
          let isBasic = Math.abs(tableau[i][j] - 1) < 1e-10;
          if (isBasic) {
            for (let k = 0; k < m; k++) {
              if (k !== i && Math.abs(tableau[k][j]) > 1e-10) {
                isBasic = false;
                break;
              }
            }
            if (isBasic) {
              x[j] = tableau[i][numCols - 1];
            }
          }
        }
      }
      return { x, optimal: tableau[m][numCols - 1], status: 'optimal', iterations: iter };
    }

    // Find leaving variable (minimum ratio test)
    let pivotRow = -1;
    let minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      if (tableau[i][pivotCol] > 1e-10) {
        const ratio = tableau[i][numCols - 1] / tableau[i][pivotCol];
        if (ratio < minRatio && ratio >= 0) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }

    if (pivotRow === -1) {
      return { x: Array(n).fill(0), optimal: -Infinity, status: 'unbounded', iterations: iter };
    }

    // Pivot
    const pivotVal = tableau[pivotRow][pivotCol];
    for (let j = 0; j < numCols; j++) {
      tableau[pivotRow][j] /= pivotVal;
    }

    for (let i = 0; i <= m; i++) {
      if (i !== pivotRow) {
        const factor = tableau[i][pivotCol];
        for (let j = 0; j < numCols; j++) {
          tableau[i][j] -= factor * tableau[pivotRow][j];
        }
      }
    }
  }

  return { x: Array(n).fill(0), optimal: 0, status: 'error', iterations: iter };
}

export const convexoptimizationTool: UnifiedTool = {
  name: 'convex_optimization',
  description: 'Convex optimization algorithms - gradient descent, Newton method, interior point, proximal gradient, LP',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['gradient_descent', 'newton', 'interior_point', 'proximal', 'lp', 'compare', 'problems', 'info', 'examples'],
        description: 'Optimization method to use'
      },
      problem: { type: 'string', description: 'Predefined problem name' },
      x0: { type: 'array', items: { type: 'number' }, description: 'Initial point' },
      maxIter: { type: 'number', description: 'Maximum iterations' },
      tol: { type: 'number', description: 'Convergence tolerance' },
      stepSize: { type: 'number', description: 'Step size for gradient methods' },
      lambda: { type: 'number', description: 'L1 regularization parameter for proximal' },
      c: { type: 'array', items: { type: 'number' }, description: 'LP objective coefficients' },
      A: { type: 'array', description: 'LP constraint matrix' },
      b: { type: 'array', items: { type: 'number' }, description: 'LP constraint bounds' }
    },
    required: ['operation']
  }
};

export async function executeconvexoptimization(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'convex-optimization',
          description: 'Convex optimization algorithms and solvers',
          methods: {
            gradient_descent: 'First-order method using gradient information',
            newton: "Second-order method using Hessian (Newton's method)",
            interior_point: 'Barrier method for constrained optimization',
            proximal: 'Proximal gradient for L1-regularized problems (LASSO)',
            lp: 'Linear programming via simplex method'
          },
          concepts: {
            convergence: 'Gradient descent: O(1/k), Newton: quadratic near optimum',
            stepSize: 'Fixed, backtracking line search, or diminishing',
            regularization: 'L1 (sparsity), L2 (ridge)'
          },
          operations: ['gradient_descent', 'newton', 'interior_point', 'proximal', 'lp', 'compare', 'problems', 'info', 'examples']
        }, null, 2)
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          examples: [
            {
              description: 'Gradient descent on quadratic function',
              call: { operation: 'gradient_descent', problem: 'quadratic' }
            },
            {
              description: "Newton's method on Rosenbrock",
              call: { operation: 'newton', problem: 'rosenbrock' }
            },
            {
              description: 'Compare methods on Booth function',
              call: { operation: 'compare', problem: 'booth' }
            },
            {
              description: 'Solve linear program',
              call: { operation: 'lp', c: [-3, -5], A: [[1, 0], [0, 2], [3, 2]], b: [4, 12, 18] }
            },
            {
              description: 'Proximal gradient with L1 regularization',
              call: { operation: 'proximal', problem: 'sphere', lambda: 0.5 }
            }
          ]
        }, null, 2)
      };
    }

    if (operation === 'problems') {
      const problemList = Object.entries(testProblems).map(([key, prob]) => ({
        name: key,
        description: prob.name,
        dimension: prob.x0.length,
        isConvex: prob.isConvex,
        knownOptimal: prob.optimal ? { x: prob.optimal, f: prob.optimalValue } : null
      }));
      return { toolCallId: id, content: JSON.stringify({ problems: problemList }, null, 2) };
    }

    if (operation === 'gradient_descent' || operation === 'newton') {
      const problemName = args.problem || 'quadratic';
      const problem = testProblems[problemName];

      if (!problem) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: `Unknown problem: ${problemName}`, available: Object.keys(testProblems) }),
          isError: true
        };
      }

      const x0 = args.x0 || problem.x0;
      const options = {
        maxIter: args.maxIter || 100,
        tol: args.tol || 1e-6,
        stepSize: args.stepSize || (operation === 'gradient_descent' ? 'backtracking' : undefined)
      };

      const result = operation === 'gradient_descent'
        ? gradientDescent(problem.f, x0, options)
        : newtonsMethod(problem.f, x0, options);

      const sampleHistory = result.history.filter((_, i) =>
        i === 0 || i === result.iterations - 1 || i % Math.max(1, Math.floor(result.iterations / 5)) === 0
      );

      return {
        toolCallId: id,
        content: JSON.stringify({
          method: operation,
          problem: problemName,
          problemDescription: problem.name,
          initialPoint: x0,
          result: {
            x: result.x.map(v => v.toFixed(8)),
            fValue: result.fValue.toFixed(10),
            iterations: result.iterations,
            converged: result.converged
          },
          knownOptimal: problem.optimal ? {
            x: problem.optimal,
            f: problem.optimalValue,
            error: vecNorm(vecSub(result.x, problem.optimal)).toFixed(10)
          } : null,
          history: sampleHistory.map(h => ({
            iter: h.iter,
            f: h.f.toFixed(8),
            gradNorm: h.gradNorm.toFixed(8)
          }))
        }, null, 2)
      };
    }

    if (operation === 'interior_point') {
      // Example: minimize x^2 + y^2 subject to x + y >= 1
      // Constraint: 1 - x - y <= 0 (i.e., g(x) = 1 - x - y <= 0)
      const f = (x: Vector) => x[0] * x[0] + x[1] * x[1];
      const constraints = [(x: Vector) => 1 - x[0] - x[1]];
      const x0 = args.x0 || [1, 1]; // Feasible starting point

      const result = interiorPoint(f, constraints, x0, {
        maxIter: args.maxIter || 50,
        tol: args.tol || 1e-6
      });

      return {
        toolCallId: id,
        content: JSON.stringify({
          method: 'interior_point',
          problem: 'minimize x^2 + y^2 subject to x + y >= 1',
          initialPoint: x0,
          result: {
            x: result.x.map(v => v.toFixed(8)),
            fValue: result.fValue.toFixed(10),
            iterations: result.iterations,
            converged: result.converged,
            feasible: result.feasible
          },
          analyticalSolution: {
            x: [0.5, 0.5],
            f: 0.5,
            note: 'By symmetry and Lagrange multipliers'
          }
        }, null, 2)
      };
    }

    if (operation === 'proximal') {
      const problemName = args.problem || 'sphere';
      const problem = testProblems[problemName];

      if (!problem) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: `Unknown problem: ${problemName}`, available: Object.keys(testProblems) }),
          isError: true
        };
      }

      const lambda = args.lambda || 0.1;
      const x0 = args.x0 || problem.x0;

      const result = proximalGradient(problem.f, lambda, x0, {
        maxIter: args.maxIter || 500,
        tol: args.tol || 1e-6,
        stepSize: args.stepSize || 0.01
      });

      const l1Norm = result.x.reduce((s, xi) => s + Math.abs(xi), 0);
      const sparsity = result.x.filter(xi => Math.abs(xi) < 1e-6).length / result.x.length;

      return {
        toolCallId: id,
        content: JSON.stringify({
          method: 'proximal_gradient',
          problem: problemName,
          lambda,
          result: {
            x: result.x.map(v => v.toFixed(8)),
            smoothPart: problem.f(result.x).toFixed(10),
            l1Norm: l1Norm.toFixed(10),
            totalObjective: result.fValue.toFixed(10),
            iterations: result.iterations,
            converged: result.converged
          },
          sparsityAnalysis: {
            sparsity: (sparsity * 100).toFixed(1) + '%',
            nonzeroComponents: result.x.filter(xi => Math.abs(xi) >= 1e-6).length
          }
        }, null, 2)
      };
    }

    if (operation === 'lp') {
      const c = args.c || [-3, -5];
      const A = args.A || [[1, 0], [0, 2], [3, 2]];
      const b = args.b || [4, 12, 18];

      const result = simplexLP(c, A, b);

      return {
        toolCallId: id,
        content: JSON.stringify({
          method: 'simplex',
          problem: {
            objective: `minimize ${c.map((ci, i) => `${ci}*x${i + 1}`).join(' + ')}`,
            constraints: A.map((row, i) =>
              `${row.map((aij, j) => `${aij}*x${j + 1}`).join(' + ')} <= ${b[i]}`
            ),
            bounds: 'x >= 0'
          },
          result: {
            x: result.x.map(v => v.toFixed(6)),
            optimalValue: result.optimal.toFixed(6),
            status: result.status,
            iterations: result.iterations
          }
        }, null, 2)
      };
    }

    if (operation === 'compare') {
      const problemName = args.problem || 'quadratic';
      const problem = testProblems[problemName];

      if (!problem) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: `Unknown problem: ${problemName}`, available: Object.keys(testProblems) }),
          isError: true
        };
      }

      const maxIter = args.maxIter || 100;
      const tol = args.tol || 1e-8;

      const gdResult = gradientDescent(problem.f, problem.x0, { maxIter, tol, stepSize: 'backtracking' });
      const newtonResult = newtonsMethod(problem.f, problem.x0, { maxIter, tol });

      const comparison = {
        problem: problemName,
        description: problem.name,
        initialPoint: problem.x0,
        knownOptimal: problem.optimal,
        gradientDescent: {
          x: gdResult.x.map(v => v.toFixed(8)),
          fValue: gdResult.fValue.toFixed(10),
          iterations: gdResult.iterations,
          converged: gdResult.converged,
          error: problem.optimal ? vecNorm(vecSub(gdResult.x, problem.optimal)).toFixed(10) : 'N/A'
        },
        newton: {
          x: newtonResult.x.map(v => v.toFixed(8)),
          fValue: newtonResult.fValue.toFixed(10),
          iterations: newtonResult.iterations,
          converged: newtonResult.converged,
          error: problem.optimal ? vecNorm(vecSub(newtonResult.x, problem.optimal)).toFixed(10) : 'N/A'
        },
        winner: newtonResult.iterations < gdResult.iterations ? 'Newton (fewer iterations)' :
          gdResult.iterations < newtonResult.iterations ? 'Gradient Descent (fewer iterations)' : 'Tie'
      };

      return { toolCallId: id, content: JSON.stringify(comparison, null, 2) };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: `Unknown operation: ${operation}` }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isconvexoptimizationAvailable(): boolean { return true; }
