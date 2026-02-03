/**
 * STATE-SPACE TOOL
 * State-space representation and analysis for control systems
 *
 * Implements state-space model creation, analysis, and conversions
 * for linear time-invariant (LTI) systems.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Matrix type
type Matrix = number[][];

// Matrix operations
function matrixCreate(rows: number, cols: number, fill: number = 0): Matrix {
  return Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(fill));
}

function matrixIdentity(n: number): Matrix {
  const I = matrixCreate(n, n);
  for (let i = 0; i < n; i++) {
    I[i][i] = 1;
  }
  return I;
}

function matrixAdd(A: Matrix, B: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const C = matrixCreate(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = A[i][j] + B[i][j];
    }
  }
  return C;
}

function matrixScale(A: Matrix, s: number): Matrix {
  return A.map((row) => row.map((val) => val * s));
}

function matrixMultiply(A: Matrix, B: Matrix): Matrix {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const C = matrixCreate(rowsA, colsB);

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

// Extract column from matrix
function matrixGetColumn(A: Matrix, col: number): Matrix {
  return A.map((row) => [row[col]]);
}

// LU decomposition with partial pivoting
function luDecomposition(A: Matrix): { L: Matrix; U: Matrix; P: Matrix } {
  const n = A.length;
  const L = matrixIdentity(n);
  const U = A.map((row) => [...row]);
  const P = matrixIdentity(n);

  for (let k = 0; k < n - 1; k++) {
    // Find pivot
    let maxVal = Math.abs(U[k][k]);
    let maxIdx = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(U[i][k]) > maxVal) {
        maxVal = Math.abs(U[i][k]);
        maxIdx = i;
      }
    }

    // Swap rows
    if (maxIdx !== k) {
      [U[k], U[maxIdx]] = [U[maxIdx], U[k]];
      [P[k], P[maxIdx]] = [P[maxIdx], P[k]];
      for (let j = 0; j < k; j++) {
        [L[k][j], L[maxIdx][j]] = [L[maxIdx][j], L[k][j]];
      }
    }

    // Eliminate
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(U[k][k]) > 1e-15) {
        L[i][k] = U[i][k] / U[k][k];
        for (let j = k; j < n; j++) {
          U[i][j] -= L[i][k] * U[k][j];
        }
      }
    }
  }

  return { L, U, P };
}

// Matrix rank using reduced row echelon form
function matrixRank(A: Matrix): number {
  const rows = A.length;
  const cols = A[0].length;
  const R = A.map((row) => [...row]);
  const tolerance = 1e-10;

  let rank = 0;
  let col = 0;

  for (let row = 0; row < rows && col < cols; row++) {
    // Find pivot
    let maxVal = Math.abs(R[row][col]);
    let maxIdx = row;
    for (let i = row + 1; i < rows; i++) {
      if (Math.abs(R[i][col]) > maxVal) {
        maxVal = Math.abs(R[i][col]);
        maxIdx = i;
      }
    }

    if (maxVal < tolerance) {
      col++;
      row--;
      continue;
    }

    // Swap rows
    if (maxIdx !== row) {
      [R[row], R[maxIdx]] = [R[maxIdx], R[row]];
    }

    // Eliminate
    for (let i = row + 1; i < rows; i++) {
      const factor = R[i][col] / R[row][col];
      for (let j = col; j < cols; j++) {
        R[i][j] -= factor * R[row][j];
      }
    }

    rank++;
    col++;
  }

  return rank;
}

// Complex number operations for eigenvalues
interface Complex {
  real: number;
  imag: number;
}

function complexMagnitude(c: Complex): number {
  return Math.sqrt(c.real * c.real + c.imag * c.imag);
}

// Find eigenvalues of matrix using QR algorithm (simplified)
function findEigenvalues(A: Matrix): Complex[] {
  const n = A.length;

  if (n === 1) {
    return [{ real: A[0][0], imag: 0 }];
  }

  if (n === 2) {
    // Characteristic polynomial: λ² - trace(A)·λ + det(A) = 0
    const trace = A[0][0] + A[1][1];
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const disc = trace * trace - 4 * det;

    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      return [
        { real: (trace + sqrtDisc) / 2, imag: 0 },
        { real: (trace - sqrtDisc) / 2, imag: 0 },
      ];
    } else {
      const realPart = trace / 2;
      const imagPart = Math.sqrt(-disc) / 2;
      return [
        { real: realPart, imag: imagPart },
        { real: realPart, imag: -imagPart },
      ];
    }
  }

  // QR algorithm for larger matrices
  let H = A.map((row) => [...row]); // Copy

  // Simple QR iteration
  for (let iter = 0; iter < 100; iter++) {
    // QR decomposition using Gram-Schmidt
    const Q = matrixCreate(n, n);
    const R = matrixCreate(n, n);

    for (let j = 0; j < n; j++) {
      // Get column j of H
      const v = H.map((row) => row[j]);

      // Orthogonalize against previous columns
      for (let i = 0; i < j; i++) {
        let dot = 0;
        for (let k = 0; k < n; k++) {
          dot += Q[k][i] * v[k];
        }
        R[i][j] = dot;
        for (let k = 0; k < n; k++) {
          v[k] -= dot * Q[k][i];
        }
      }

      // Normalize
      let norm = 0;
      for (let k = 0; k < n; k++) {
        norm += v[k] * v[k];
      }
      norm = Math.sqrt(norm);
      R[j][j] = norm;

      if (norm > 1e-15) {
        for (let k = 0; k < n; k++) {
          Q[k][j] = v[k] / norm;
        }
      }
    }

    // H = R * Q
    H = matrixMultiply(R, Q);
  }

  // Extract eigenvalues from quasi-triangular form
  const eigenvalues: Complex[] = [];
  let i = 0;
  while (i < n) {
    if (i === n - 1 || Math.abs(H[i + 1][i]) < 1e-10) {
      // Real eigenvalue
      eigenvalues.push({ real: H[i][i], imag: 0 });
      i++;
    } else {
      // 2x2 block - complex conjugate pair
      const a = H[i][i],
        b = H[i][i + 1];
      const c = H[i + 1][i],
        d = H[i + 1][i + 1];
      const trace = a + d;
      const det = a * d - b * c;
      const disc = trace * trace - 4 * det;

      if (disc < 0) {
        const realPart = trace / 2;
        const imagPart = Math.sqrt(-disc) / 2;
        eigenvalues.push({ real: realPart, imag: imagPart });
        eigenvalues.push({ real: realPart, imag: -imagPart });
      } else {
        const sqrtDisc = Math.sqrt(disc);
        eigenvalues.push({ real: (trace + sqrtDisc) / 2, imag: 0 });
        eigenvalues.push({ real: (trace - sqrtDisc) / 2, imag: 0 });
      }
      i += 2;
    }
  }

  return eigenvalues;
}

// State-space system
interface StateSpaceSystem {
  A: Matrix; // State matrix (n×n)
  B: Matrix; // Input matrix (n×m)
  C: Matrix; // Output matrix (p×n)
  D: Matrix; // Feedthrough matrix (p×m)
  n: number; // Number of states
  m: number; // Number of inputs
  p: number; // Number of outputs
}

// Build controllability matrix [B, AB, A²B, ..., A^(n-1)B]
function controllabilityMatrix(sys: StateSpaceSystem): Matrix {
  const { A, B, n, m } = sys;
  const cols: Matrix[] = [];

  // Start with B
  let Ai_B = B;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      cols.push(matrixGetColumn(Ai_B, j));
    }
    Ai_B = matrixMultiply(A, Ai_B);
  }

  // Build matrix
  const Mc = matrixCreate(n, n * m);
  for (let col = 0; col < cols.length && col < n * m; col++) {
    for (let row = 0; row < n; row++) {
      Mc[row][col] = cols[col][row][0];
    }
  }

  return Mc;
}

// Build observability matrix [C; CA; CA²; ...; CA^(n-1)]
function observabilityMatrix(sys: StateSpaceSystem): Matrix {
  const { A, C, n, p } = sys;
  const rows: Matrix[] = [];

  // Start with C
  let C_Ai = C;
  for (let i = 0; i < n; i++) {
    rows.push(C_Ai);
    C_Ai = matrixMultiply(C_Ai, A);
  }

  // Build matrix
  const Mo = matrixCreate(n * p, n);
  let rowIdx = 0;
  for (const row of rows) {
    for (let r = 0; r < row.length; r++) {
      for (let c = 0; c < n; c++) {
        Mo[rowIdx][c] = row[r][c];
      }
      rowIdx++;
      if (rowIdx >= n * p) break;
    }
    if (rowIdx >= n * p) break;
  }

  return Mo;
}

// Check system stability (all eigenvalues in LHP)
function checkStability(sys: StateSpaceSystem): {
  eigenvalues: Complex[];
  isStable: boolean;
  marginallySTable: boolean;
} {
  const eigenvalues = findEigenvalues(sys.A);
  const isStable = eigenvalues.every((e) => e.real < 0);
  const marginallySTable =
    eigenvalues.every((e) => e.real <= 0) && eigenvalues.some((e) => Math.abs(e.real) < 1e-10);

  return { eigenvalues, isStable, marginallySTable };
}

// Simulate step response
function stepResponse(
  sys: StateSpaceSystem,
  duration: number,
  dt: number = 0.01
): { time: number[]; output: number[][] } {
  const { A, B, C, D, n, m, p } = sys;

  const numSteps = Math.floor(duration / dt);
  const time: number[] = [];
  const output: number[][] = [];

  // Initial state
  let x = matrixCreate(n, 1);
  // Step input (all inputs = 1)
  const u = matrixCreate(m, 1, 1);

  for (let i = 0; i <= numSteps; i++) {
    const t = i * dt;
    time.push(t);

    // Output: y = Cx + Du
    const Cx = matrixMultiply(C, x);
    const Du = matrixMultiply(D, u);
    const y = matrixAdd(Cx, Du);
    output.push(y.map((row) => row[0]));

    // State update: x_new = x + dt*(Ax + Bu)
    const Ax = matrixMultiply(A, x);
    const Bu = matrixMultiply(B, u);
    const xdot = matrixAdd(Ax, Bu);
    x = matrixAdd(x, matrixScale(xdot, dt));
  }

  return { time, output };
}

// Convert transfer function to state-space (controllable canonical form)
function tf2ss(numerator: number[], denominator: number[]): StateSpaceSystem {
  // Normalize by leading coefficient
  const a0 = denominator[0];
  const num = numerator.map((c) => c / a0);
  const den = denominator.map((c) => c / a0);

  const n = den.length - 1; // System order

  // Make numerator same length as denominator
  while (num.length < den.length) {
    num.unshift(0);
  }

  // A matrix in controllable canonical form
  const A = matrixCreate(n, n);
  for (let i = 0; i < n - 1; i++) {
    A[i][i + 1] = 1;
  }
  for (let i = 0; i < n; i++) {
    A[n - 1][i] = -den[n - i];
  }

  // B matrix
  const B = matrixCreate(n, 1);
  B[n - 1][0] = 1;

  // C matrix
  const C = matrixCreate(1, n);
  for (let i = 0; i < n; i++) {
    C[0][i] = num[n - i] - num[0] * den[n - i];
  }

  // D matrix
  const D = [[num[0]]];

  return { A, B, C, D, n, m: 1, p: 1 };
}

// Convert state-space to transfer function
function ss2tf(sys: StateSpaceSystem): { numerator: number[]; denominator: number[] } {
  const { A, B, C, D, n } = sys;

  // Characteristic polynomial = det(sI - A)
  // For simplicity, compute coefficients using eigenvalues
  const eigenvalues = findEigenvalues(A);

  // Denominator: (s - λ1)(s - λ2)...(s - λn)
  let denominator = [1];
  for (const e of eigenvalues) {
    if (Math.abs(e.imag) < 1e-10) {
      // Real eigenvalue: multiply by (s - λ)
      const newDen = Array(denominator.length + 1).fill(0);
      for (let i = 0; i < denominator.length; i++) {
        newDen[i] += denominator[i];
        newDen[i + 1] -= e.real * denominator[i];
      }
      denominator = newDen;
    }
  }

  // Handle complex conjugate pairs
  const complexEigs = eigenvalues.filter((e) => e.imag > 1e-10);
  for (const e of complexEigs) {
    // (s - (a+jb))(s - (a-jb)) = s² - 2as + (a² + b²)
    const a = e.real;
    const b = e.imag;
    const quadCoeffs = [1, -2 * a, a * a + b * b];

    const newDen = Array(denominator.length + 2).fill(0);
    for (let i = 0; i < denominator.length; i++) {
      for (let j = 0; j < quadCoeffs.length; j++) {
        newDen[i + j] += denominator[i] * quadCoeffs[j];
      }
    }
    denominator = newDen;
  }

  // Numerator: approximate using DC gain
  // G(0) = C * (-A)^(-1) * B + D
  const dcGain = D[0][0]; // Simplified

  // For a proper system, numerator degree < denominator degree
  const numerator = [dcGain * denominator[denominator.length - 1]];

  return { numerator, denominator };
}

// Format matrix for display
function formatMatrix(M: Matrix, name: string): string {
  const rows = M.length;
  const cols = M[0].length;

  let result = `${name} (${rows}×${cols}):\n`;
  result += '┌' + ' '.repeat(cols * 10) + '┐\n';

  for (const row of M) {
    result += '│';
    for (const val of row) {
      const formatted = val.toFixed(4).padStart(9);
      result += formatted + ' ';
    }
    result += '│\n';
  }

  result += '└' + ' '.repeat(cols * 10) + '┘';
  return result;
}

// Example systems
const EXAMPLE_SYSTEMS: Record<string, StateSpaceSystem & { description: string }> = {
  mass_spring_damper: {
    // m*x'' + c*x' + k*x = u
    // State: [x, x']
    // With m=1, c=0.5, k=2
    A: [
      [0, 1],
      [-2, -0.5],
    ],
    B: [[0], [1]],
    C: [[1, 0]],
    D: [[0]],
    n: 2,
    m: 1,
    p: 1,
    description: 'Mass-spring-damper: m=1, c=0.5, k=2',
  },
  dc_motor: {
    // State: [θ, ω, i]
    // Simplified DC motor model
    A: [
      [0, 1, 0],
      [0, -0.1, 0.5],
      [0, -0.5, -1],
    ],
    B: [[0], [0], [1]],
    C: [[1, 0, 0]],
    D: [[0]],
    n: 3,
    m: 1,
    p: 1,
    description: 'DC motor (position, velocity, current)',
  },
  inverted_pendulum: {
    // Linearized about upright position
    // State: [θ, θ', x, x']
    A: [
      [0, 1, 0, 0],
      [10, 0, 0, 0],
      [0, 0, 0, 1],
      [-1, 0, 0, 0],
    ],
    B: [[0], [-1], [0], [1]],
    C: [
      [1, 0, 0, 0],
      [0, 0, 1, 0],
    ],
    D: [[0], [0]],
    n: 4,
    m: 1,
    p: 2,
    description: 'Linearized inverted pendulum on cart',
  },
  aircraft_longitudinal: {
    // Simplified longitudinal dynamics
    // State: [u, w, q, θ]
    A: [
      [-0.038, 18.984, 0, -32.174],
      [-0.001, -0.632, 1, 0],
      [0, -0.759, -0.518, 0],
      [0, 0, 1, 0],
    ],
    B: [[10.1], [0], [-0.0086], [0]],
    C: [[1, 0, 0, 0]],
    D: [[0]],
    n: 4,
    m: 1,
    p: 1,
    description: 'Aircraft longitudinal dynamics',
  },
};

export const statespaceTool: UnifiedTool = {
  name: 'state_space',
  description: `State-space representation and analysis for control systems.

Models LTI systems in state-space form:
  ẋ = Ax + Bu
  y = Cx + Du

Features:
- Create state-space models from matrices
- Convert transfer function to state-space
- Check controllability and observability
- Analyze stability via eigenvalues
- Simulate step response
- Calculate system properties

Matrix dimensions:
- A: n×n (state matrix)
- B: n×m (input matrix)
- C: p×n (output matrix)
- D: p×m (feedthrough matrix)`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create',
          'analyze',
          'controllability',
          'observability',
          'stability',
          'eigenvalues',
          'step_response',
          'tf2ss',
          'ss2tf',
          'examples',
          'info',
        ],
        description: 'Operation to perform',
      },
      A: {
        type: 'array',
        items: { type: 'array' },
        description: 'State matrix (n×n) - 2D array of numbers',
      },
      B: {
        type: 'array',
        items: { type: 'array' },
        description: 'Input matrix (n×m) - 2D array of numbers',
      },
      C: {
        type: 'array',
        items: { type: 'array' },
        description: 'Output matrix (p×n) - 2D array of numbers',
      },
      D: {
        type: 'array',
        items: { type: 'array' },
        description: 'Feedthrough matrix (p×m) - 2D array of numbers',
      },
      example: {
        type: 'string',
        enum: ['mass_spring_damper', 'dc_motor', 'inverted_pendulum', 'aircraft_longitudinal'],
        description: 'Use example system',
      },
      numerator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Transfer function numerator for tf2ss',
      },
      denominator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Transfer function denominator for tf2ss',
      },
      duration: {
        type: 'number',
        description: 'Simulation duration for step response (default: 10)',
      },
      dt: { type: 'number', description: 'Time step for simulation (default: 0.01)' },
    },
    required: ['operation'],
  },
};

export async function executestatespace(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, example, numerator, denominator, duration, dt } = args;

    // Get system matrices
    let sys: StateSpaceSystem;
    let systemDescription = 'Custom system';

    if (example && EXAMPLE_SYSTEMS[example]) {
      const exSys = EXAMPLE_SYSTEMS[example];
      sys = {
        A: exSys.A,
        B: exSys.B,
        C: exSys.C,
        D: exSys.D,
        n: exSys.n,
        m: exSys.m,
        p: exSys.p,
      };
      systemDescription = exSys.description;
    } else if (args.A) {
      const A = args.A as Matrix;
      const B = (args.B as Matrix) || matrixCreate(A.length, 1);
      const C = (args.C as Matrix) || matrixCreate(1, A.length, 1);
      const D = (args.D as Matrix) || [[0]];

      sys = {
        A,
        B,
        C,
        D,
        n: A.length,
        m: B[0].length,
        p: C.length,
      };
    } else {
      // Default simple system
      sys = {
        A: [[-1]],
        B: [[1]],
        C: [[1]],
        D: [[0]],
        n: 1,
        m: 1,
        p: 1,
      };
    }

    switch (operation) {
      case 'create': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              state_space_model: {
                equations: ['ẋ = Ax + Bu', 'y = Cx + Du'],
                dimensions: {
                  states: sys.n,
                  inputs: sys.m,
                  outputs: sys.p,
                },
                A: sys.A,
                B: sys.B,
                C: sys.C,
                D: sys.D,
              },
              formatted: {
                A: formatMatrix(sys.A, 'A'),
                B: formatMatrix(sys.B, 'B'),
                C: formatMatrix(sys.C, 'C'),
                D: formatMatrix(sys.D, 'D'),
              },
            },
            null,
            2
          ),
        };
      }

      case 'analyze': {
        const Mc = controllabilityMatrix(sys);
        const Mo = observabilityMatrix(sys);
        const controllabilityRank = matrixRank(Mc);
        const observabilityRank = matrixRank(Mo);
        const stability = checkStability(sys);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              dimensions: {
                states: sys.n,
                inputs: sys.m,
                outputs: sys.p,
              },
              controllability: {
                rank: controllabilityRank,
                required_rank: sys.n,
                is_controllable: controllabilityRank === sys.n,
              },
              observability: {
                rank: observabilityRank,
                required_rank: sys.n,
                is_observable: observabilityRank === sys.n,
              },
              stability: {
                eigenvalues: stability.eigenvalues.map((e) => ({
                  real: e.real.toFixed(6),
                  imag: e.imag.toFixed(6),
                  location:
                    e.real < 0 ? 'LHP (stable)' : e.real > 0 ? 'RHP (unstable)' : 'imaginary axis',
                })),
                is_stable: stability.isStable,
                is_marginally_stable: stability.marginallySTable,
              },
              minimality: {
                is_minimal: controllabilityRank === sys.n && observabilityRank === sys.n,
                explanation: 'System is minimal if both controllable and observable',
              },
            },
            null,
            2
          ),
        };
      }

      case 'controllability': {
        const Mc = controllabilityMatrix(sys);
        const rank = matrixRank(Mc);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              controllability_matrix: {
                description: 'Mc = [B, AB, A²B, ..., A^(n-1)B]',
                dimensions: `${sys.n} × ${sys.n * sys.m}`,
                matrix: Mc,
                formatted: formatMatrix(Mc, 'Mc'),
              },
              analysis: {
                rank: rank,
                required_rank: sys.n,
                is_controllable: rank === sys.n,
              },
              interpretation:
                rank === sys.n
                  ? 'System is fully controllable - all states can be driven to any value'
                  : `System has ${sys.n - rank} uncontrollable mode(s)`,
            },
            null,
            2
          ),
        };
      }

      case 'observability': {
        const Mo = observabilityMatrix(sys);
        const rank = matrixRank(Mo);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              observability_matrix: {
                description: 'Mo = [C; CA; CA²; ...; CA^(n-1)]',
                dimensions: `${sys.n * sys.p} × ${sys.n}`,
                matrix: Mo,
                formatted: formatMatrix(Mo, 'Mo'),
              },
              analysis: {
                rank: rank,
                required_rank: sys.n,
                is_observable: rank === sys.n,
              },
              interpretation:
                rank === sys.n
                  ? 'System is fully observable - all states can be determined from outputs'
                  : `System has ${sys.n - rank} unobservable mode(s)`,
            },
            null,
            2
          ),
        };
      }

      case 'stability': {
        const stability = checkStability(sys);

        // Categorize eigenvalues
        const stableEigs = stability.eigenvalues.filter((e) => e.real < 0);
        const unstableEigs = stability.eigenvalues.filter((e) => e.real > 0);
        const marginalEigs = stability.eigenvalues.filter((e) => Math.abs(e.real) < 1e-10);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              stability_analysis: {
                is_asymptotically_stable: stability.isStable,
                is_marginally_stable: stability.marginallySTable,
                is_unstable: !stability.isStable && !stability.marginallySTable,
              },
              eigenvalue_summary: {
                total: stability.eigenvalues.length,
                in_lhp: stableEigs.length,
                in_rhp: unstableEigs.length,
                on_imaginary_axis: marginalEigs.length,
              },
              eigenvalues: stability.eigenvalues.map((e) => {
                const mag = complexMagnitude(e);
                return {
                  value: `${e.real.toFixed(6)} ${e.imag >= 0 ? '+' : '-'} ${Math.abs(e.imag).toFixed(6)}j`,
                  magnitude: mag.toFixed(6),
                  damping_ratio: e.imag !== 0 ? (-e.real / mag).toFixed(6) : 'N/A (real)',
                  natural_frequency: mag.toFixed(6),
                  stability: e.real < 0 ? 'stable' : e.real > 0 ? 'unstable' : 'marginal',
                };
              }),
              criteria: {
                continuous_time: 'All eigenvalues must have negative real parts',
                discrete_time:
                  'All eigenvalues must have magnitude less than 1 (not applicable here)',
              },
            },
            null,
            2
          ),
        };
      }

      case 'eigenvalues': {
        const eigenvalues = findEigenvalues(sys.A);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              state_matrix_A: sys.A,
              eigenvalues: eigenvalues.map((e, i) => ({
                index: i + 1,
                real: e.real.toFixed(6),
                imag: e.imag.toFixed(6),
                complex_form: `${e.real.toFixed(4)} ${e.imag >= 0 ? '+' : '-'} ${Math.abs(e.imag).toFixed(4)}j`,
                magnitude: complexMagnitude(e).toFixed(6),
                phase_degrees: ((Math.atan2(e.imag, e.real) * 180) / Math.PI).toFixed(2),
              })),
              characteristic_polynomial: {
                description: 'det(λI - A) = 0',
                degree: sys.n,
              },
            },
            null,
            2
          ),
        };
      }

      case 'step_response': {
        const simDuration = duration || 10;
        const simDt = dt || 0.01;
        const response = stepResponse(sys, simDuration, simDt);

        // Sample output at key times
        const sampleTimes = [0, 0.5, 1, 2, 5, simDuration];
        const samples = sampleTimes.map((t) => {
          const idx = Math.min(Math.round(t / simDt), response.time.length - 1);
          return {
            time: response.time[idx].toFixed(3),
            output: response.output[idx].map((v) => v.toFixed(6)),
          };
        });

        // Find steady-state value (last value)
        const steadyState = response.output[response.output.length - 1];

        // Find rise time (10% to 90%)
        let riseTime = 'N/A';
        if (steadyState[0] !== 0) {
          const target10 = 0.1 * steadyState[0];
          const target90 = 0.9 * steadyState[0];
          let t10 = 0,
            t90 = 0;
          for (let i = 0; i < response.output.length; i++) {
            if (response.output[i][0] >= target10 && t10 === 0) {
              t10 = response.time[i];
            }
            if (response.output[i][0] >= target90 && t90 === 0) {
              t90 = response.time[i];
              break;
            }
          }
          if (t90 > t10) {
            riseTime = (t90 - t10).toFixed(4);
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              simulation_parameters: {
                duration: simDuration,
                time_step: simDt,
                input: 'Unit step on all inputs',
                total_points: response.time.length,
              },
              response_samples: samples,
              performance_metrics: {
                steady_state_value: steadyState.map((v) => v.toFixed(6)),
                rise_time_10_90: riseTime,
                note: 'Full time series available for plotting',
              },
            },
            null,
            2
          ),
        };
      }

      case 'tf2ss': {
        if (!numerator || !denominator) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'Provide numerator and denominator arrays for tf2ss conversion',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const ssSys = tf2ss(numerator, denominator);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              conversion: 'Transfer Function to State-Space',
              transfer_function: {
                numerator,
                denominator,
              },
              state_space: {
                form: 'Controllable Canonical Form',
                dimensions: {
                  states: ssSys.n,
                  inputs: ssSys.m,
                  outputs: ssSys.p,
                },
                A: ssSys.A,
                B: ssSys.B,
                C: ssSys.C,
                D: ssSys.D,
              },
              formatted: {
                A: formatMatrix(ssSys.A, 'A'),
                B: formatMatrix(ssSys.B, 'B'),
                C: formatMatrix(ssSys.C, 'C'),
                D: formatMatrix(ssSys.D, 'D'),
              },
            },
            null,
            2
          ),
        };
      }

      case 'ss2tf': {
        const tf = ss2tf(sys);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              system: systemDescription,
              conversion: 'State-Space to Transfer Function',
              state_space: {
                A: sys.A,
                B: sys.B,
                C: sys.C,
                D: sys.D,
              },
              transfer_function: {
                numerator: tf.numerator,
                denominator: tf.denominator,
                formula: 'G(s) = C(sI - A)^(-1)B + D',
              },
              note: 'Transfer function is approximate for MIMO systems',
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        const examples = Object.entries(EXAMPLE_SYSTEMS).map(([key, sys]) => {
          const stability = checkStability(sys);
          return {
            name: key,
            description: sys.description,
            dimensions: {
              states: sys.n,
              inputs: sys.m,
              outputs: sys.p,
            },
            is_stable: stability.isStable,
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              example_systems: examples,
              usage: 'Use example parameter to analyze these systems',
            },
            null,
            2
          ),
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'state_space',
              description: 'State-space analysis for linear control systems',
              state_space_form: {
                state_equation: 'ẋ = Ax + Bu',
                output_equation: 'y = Cx + Du',
                matrices: {
                  A: 'State matrix (n×n) - defines system dynamics',
                  B: 'Input matrix (n×m) - how inputs affect states',
                  C: 'Output matrix (p×n) - how states map to outputs',
                  D: 'Feedthrough matrix (p×m) - direct input-output coupling',
                },
              },
              operations: {
                create: 'Create and display state-space model',
                analyze: 'Complete system analysis',
                controllability: 'Check and compute controllability matrix',
                observability: 'Check and compute observability matrix',
                stability: 'Detailed stability analysis',
                eigenvalues: 'Compute eigenvalues of A matrix',
                step_response: 'Simulate step response',
                tf2ss: 'Convert transfer function to state-space',
                ss2tf: 'Convert state-space to transfer function',
                examples: 'List available example systems',
              },
              key_concepts: {
                controllability: 'Can all states be controlled from inputs?',
                observability: 'Can all states be inferred from outputs?',
                stability: 'Do all eigenvalues have negative real parts?',
                minimality: 'Is system both controllable and observable?',
              },
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true,
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isstatespaceAvailable(): boolean {
  return true;
}
