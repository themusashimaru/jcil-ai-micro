/**
 * STATE-SPACE TOOL
 * State-space control system representation and analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const statespaceTool: UnifiedTool = {
  name: 'state_space',
  description: 'State-space representation and analysis for control systems',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'analyze', 'controllability', 'observability', 'stability', 'simulate', 'info'], description: 'Operation' },
      A: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'State matrix A (n×n)' },
      B: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Input matrix B (n×m)' },
      C: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Output matrix C (p×n)' },
      D: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Feedthrough matrix D (p×m)' },
      initial_state: { type: 'array', items: { type: 'number' }, description: 'Initial state x(0)' },
      time_end: { type: 'number', description: 'Simulation end time' }
    },
    required: ['operation']
  }
};

interface Complex {
  re: number;
  im: number;
}

type Matrix = number[][];

// Matrix operations
function matMul(A: Matrix, B: Matrix): Matrix {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const C: Matrix = Array(m).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < p; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

function matAdd(A: Matrix, B: Matrix): Matrix {
  return A.map((row, i) => row.map((val, j) => val + B[i][j]));
}

function matScale(A: Matrix, s: number): Matrix {
  return A.map(row => row.map(val => val * s));
}

function matTranspose(A: Matrix): Matrix {
  const m = A.length;
  const n = A[0].length;
  const T: Matrix = Array(n).fill(null).map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

function identity(n: number): Matrix {
  return Array(n).fill(null).map((_, i) =>
    Array(n).fill(null).map((_, j) => i === j ? 1 : 0)
  );
}

// Matrix determinant (recursive for small matrices)
function det(A: Matrix): number {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];

  let d = 0;
  for (let j = 0; j < n; j++) {
    const minor: Matrix = [];
    for (let i = 1; i < n; i++) {
      minor.push([...A[i].slice(0, j), ...A[i].slice(j + 1)]);
    }
    d += (j % 2 === 0 ? 1 : -1) * A[0][j] * det(minor);
  }
  return d;
}

// Matrix rank (using row reduction)
function rank(A: Matrix): number {
  const m = A.length;
  const n = A[0].length;
  const M = A.map(row => [...row]);

  let r = 0;
  for (let col = 0; col < n && r < m; col++) {
    // Find pivot
    let pivotRow = r;
    for (let i = r + 1; i < m; i++) {
      if (Math.abs(M[i][col]) > Math.abs(M[pivotRow][col])) {
        pivotRow = i;
      }
    }

    if (Math.abs(M[pivotRow][col]) < 1e-10) continue;

    // Swap rows
    [M[r], M[pivotRow]] = [M[pivotRow], M[r]];

    // Eliminate
    for (let i = r + 1; i < m; i++) {
      const factor = M[i][col] / M[r][col];
      for (let j = col; j < n; j++) {
        M[i][j] -= factor * M[r][j];
      }
    }
    r++;
  }

  return r;
}

// Find eigenvalues of 2×2 or estimate for larger
function eigenvalues(A: Matrix): Complex[] {
  const n = A.length;

  if (n === 1) {
    return [{ re: A[0][0], im: 0 }];
  }

  if (n === 2) {
    const trace = A[0][0] + A[1][1];
    const determinant = det(A);
    const disc = trace * trace - 4 * determinant;

    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      return [
        { re: (trace + sq) / 2, im: 0 },
        { re: (trace - sq) / 2, im: 0 }
      ];
    } else {
      const sq = Math.sqrt(-disc);
      return [
        { re: trace / 2, im: sq / 2 },
        { re: trace / 2, im: -sq / 2 }
      ];
    }
  }

  // For larger matrices, use power iteration approximation
  const eigs: Complex[] = [];
  let v = Array(n).fill(1 / Math.sqrt(n));

  for (let iter = 0; iter < 50; iter++) {
    const Av = matMul(A, v.map(x => [x])).map(row => row[0]);
    const norm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0));
    v = Av.map(x => x / norm);
  }

  const Av = matMul(A, v.map(x => [x])).map(row => row[0]);
  const lambda = v.reduce((s, x, i) => s + x * Av[i], 0);
  eigs.push({ re: lambda, im: 0 });

  // Estimate other eigenvalues from trace
  const trace = A.reduce((s, row, i) => s + row[i], 0);
  const remaining = trace - lambda;
  for (let i = 1; i < n; i++) {
    eigs.push({ re: remaining / (n - 1), im: 0 });
  }

  return eigs;
}

// Controllability matrix
function controllabilityMatrix(A: Matrix, B: Matrix): Matrix {
  const n = A.length;
  const m = B[0].length;
  const C: Matrix = Array(n).fill(null).map(() => []);

  let AiB = B.map(row => [...row]);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < m; k++) {
        C[j].push(AiB[j][k]);
      }
    }
    AiB = matMul(A, AiB);
  }

  return C;
}

// Observability matrix
function observabilityMatrix(A: Matrix, C: Matrix): Matrix {
  const n = A.length;
  const p = C.length;
  const O: Matrix = [];

  let CAi = C.map(row => [...row]);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      O.push([...CAi[j]]);
    }
    CAi = matMul(CAi, A);
  }

  return O;
}

// Simulate state-space system
function simulate(A: Matrix, B: Matrix, C: Matrix, D: Matrix,
  x0: number[], tEnd: number, dt: number = 0.01): { t: number[]; x: number[][]; y: number[][] } {

  const n = A.length;
  const m = B[0].length;
  const p = C.length;

  const t: number[] = [];
  const x: number[][] = [];
  const y: number[][] = [];

  let state = [...x0];
  const input = Array(m).fill(1); // Step input

  for (let time = 0; time <= tEnd; time += dt) {
    t.push(time);
    x.push([...state]);

    // Output: y = Cx + Du
    const output: number[] = [];
    for (let i = 0; i < p; i++) {
      let yi = 0;
      for (let j = 0; j < n; j++) yi += C[i][j] * state[j];
      for (let j = 0; j < m; j++) yi += D[i][j] * input[j];
      output.push(yi);
    }
    y.push(output);

    // State update: x_dot = Ax + Bu (Euler integration)
    const xDot: number[] = [];
    for (let i = 0; i < n; i++) {
      let xi = 0;
      for (let j = 0; j < n; j++) xi += A[i][j] * state[j];
      for (let j = 0; j < m; j++) xi += B[i][j] * input[j];
      xDot.push(xi);
    }

    for (let i = 0; i < n; i++) {
      state[i] += xDot[i] * dt;
    }
  }

  return { t, x, y };
}

function formatComplex(c: Complex): string {
  if (Math.abs(c.im) < 1e-6) return c.re.toFixed(4);
  if (Math.abs(c.re) < 1e-6) return `${c.im.toFixed(4)}j`;
  const sign = c.im >= 0 ? '+' : '-';
  return `${c.re.toFixed(4)}${sign}${Math.abs(c.im).toFixed(4)}j`;
}

function formatMatrix(M: Matrix): string {
  return M.map(row => '[ ' + row.map(v => v.toFixed(4).padStart(10)).join(' ') + ' ]').join('\n');
}

export async function executestatespace(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'state-space',
        description: 'State-space representation: ẋ = Ax + Bu, y = Cx + Du',
        matrices: {
          A: 'State matrix (n×n) - system dynamics',
          B: 'Input matrix (n×m) - input coupling',
          C: 'Output matrix (p×n) - output selection',
          D: 'Feedthrough matrix (p×m) - direct input-output coupling'
        },
        equations: {
          stateDiff: 'ẋ(t) = Ax(t) + Bu(t)',
          output: 'y(t) = Cx(t) + Du(t)',
          solution: 'x(t) = e^(At)x(0) + ∫e^(A(t-τ))Bu(τ)dτ'
        },
        properties: {
          controllability: 'rank([B AB A²B ... A^(n-1)B]) = n',
          observability: 'rank([C; CA; CA²; ...; CA^(n-1)]) = n',
          stability: 'All eigenvalues of A have negative real parts'
        },
        conversions: {
          toTransferFunction: 'G(s) = C(sI-A)⁻¹B + D',
          fromTransferFunction: 'Controllable/observable canonical forms'
        },
        operations: ['create', 'analyze', 'controllability', 'observability', 'stability', 'simulate']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Default example: second-order system
    const defaultA = args.A || [[0, 1], [-2, -3]];
    const defaultB = args.B || [[0], [1]];
    const defaultC = args.C || [[1, 0]];
    const defaultD = args.D || [[0]];

    if (operation === 'create') {
      const A = defaultA;
      const B = defaultB;
      const C = defaultC;
      const D = defaultD;

      const n = A.length;
      const m = B[0].length;
      const p = C.length;

      const result = {
        operation: 'create',
        dimensions: {
          states: n,
          inputs: m,
          outputs: p
        },
        matrices: {
          A: formatMatrix(A),
          B: formatMatrix(B),
          C: formatMatrix(C),
          D: formatMatrix(D)
        },
        equations: {
          state: `ẋ = Ax + Bu (${n} state equations)`,
          output: `y = Cx + Du (${p} output equations)`
        },
        blockDiagram: `
        State-Space Block Diagram:

        u(t) ─→[B]─→(+)─→[∫]─→ x(t) ─→[C]─→(+)─→ y(t)
                    ↑           │           ↑
                    └────[A]←───┘           │
                                            │
        u(t) ────────────[D]────────────────┘
        `
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'analyze') {
      const A = defaultA;
      const B = defaultB;
      const C = defaultC;
      const D = defaultD;

      const n = A.length;
      const eigs = eigenvalues(A);

      const Mc = controllabilityMatrix(A, B);
      const Mo = observabilityMatrix(A, C);

      const controllable = rank(Mc) === n;
      const observable = rank(Mo) === n;
      const stable = eigs.every(e => e.re < 0);

      const result = {
        operation: 'analyze',
        systemOrder: n,
        eigenvalues: eigs.map(e => ({
          value: formatComplex(e),
          stable: e.re < 0,
          timeConstant: e.re < 0 ? (-1 / e.re).toFixed(4) + 's' : 'Unstable'
        })),
        properties: {
          controllable,
          observable,
          stable,
          minimalRealization: controllable && observable
        },
        controllabilityRank: rank(Mc),
        observabilityRank: rank(Mo),
        systemType: stable ? (controllable && observable ? 'Fully controllable and observable' :
          controllable ? 'Controllable but not fully observable' :
          observable ? 'Observable but not fully controllable' :
          'Neither fully controllable nor observable') : 'Unstable system'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'controllability') {
      const A = defaultA;
      const B = defaultB;
      const n = A.length;

      const Mc = controllabilityMatrix(A, B);
      const r = rank(Mc);
      const controllable = r === n;

      const result = {
        operation: 'controllability',
        definition: 'System is controllable if any state can be reached from any initial state',
        controllabilityMatrix: {
          construction: 'Mc = [B | AB | A²B | ... | A^(n-1)B]',
          dimensions: `${n} × ${Mc[0].length}`,
          matrix: n <= 4 ? formatMatrix(Mc) : 'Matrix too large to display'
        },
        rank: r,
        requiredRank: n,
        controllable,
        interpretation: controllable ?
          'All states are reachable - full state control possible' :
          `Only ${r} states are controllable - system has uncontrollable modes`,
        poleplacementPossible: controllable ?
          'Yes - all closed-loop poles can be placed arbitrarily with state feedback' :
          'Only controllable modes can be placed'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'observability') {
      const A = defaultA;
      const C = defaultC;
      const n = A.length;

      const Mo = observabilityMatrix(A, C);
      const r = rank(Mo);
      const observable = r === n;

      const result = {
        operation: 'observability',
        definition: 'System is observable if initial state can be determined from outputs',
        observabilityMatrix: {
          construction: 'Mo = [C; CA; CA²; ...; CA^(n-1)]',
          dimensions: `${Mo.length} × ${n}`,
          matrix: n <= 4 ? formatMatrix(Mo) : 'Matrix too large to display'
        },
        rank: r,
        requiredRank: n,
        observable,
        interpretation: observable ?
          'All states are observable - full state estimation possible' :
          `Only ${r} states are observable - hidden dynamics exist`,
        observerDesignPossible: observable ?
          'Yes - state observer can estimate all states from output measurements' :
          'Only observable states can be estimated'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'stability') {
      const A = defaultA;
      const n = A.length;
      const eigs = eigenvalues(A);

      const stable = eigs.every(e => e.re < 0);
      const marginal = eigs.some(e => Math.abs(e.re) < 1e-6);

      // Characterize dynamics
      const dynamics = eigs.map(e => {
        if (Math.abs(e.im) < 1e-6) {
          if (e.re < 0) return { type: 'Exponential decay', timeConstant: -1 / e.re };
          if (e.re > 0) return { type: 'Exponential growth', doublingTime: Math.log(2) / e.re };
          return { type: 'Constant mode' };
        } else {
          const sigma = e.re;
          const omega = Math.abs(e.im);
          const period = 2 * Math.PI / omega;
          if (sigma < 0) return { type: 'Damped oscillation', period, damping: -sigma };
          if (sigma > 0) return { type: 'Growing oscillation', period };
          return { type: 'Sustained oscillation', period };
        }
      });

      const result = {
        operation: 'stability',
        eigenvalues: eigs.map((e, i) => ({
          value: formatComplex(e),
          realPart: e.re.toFixed(6),
          imagPart: e.im.toFixed(6),
          ...dynamics[i]
        })),
        stability: {
          asymptoticallyStable: stable && !marginal,
          marginallyStable: marginal && !eigs.some(e => e.re > 0),
          unstable: eigs.some(e => e.re > 0)
        },
        lyapunovStability: stable ? 'Stable in the sense of Lyapunov' : 'Unstable',
        dominantMode: {
          eigenvalue: formatComplex(eigs.reduce((a, b) => a.re > b.re ? a : b)),
          settlingTime: stable ? (4 / Math.abs(Math.max(...eigs.map(e => e.re)))).toFixed(3) + 's' : 'N/A'
        },
        criteria: {
          continuous: 'All eigenvalues must have Re(λ) < 0',
          discrete: 'All eigenvalues must have |λ| < 1'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'simulate') {
      const A = defaultA;
      const B = defaultB;
      const C = defaultC;
      const D = defaultD;
      const x0 = args.initial_state || Array(A.length).fill(0);
      const tEnd = args.time_end || 10;

      const sim = simulate(A, B, C, D, x0, tEnd);

      const finalState = sim.x[sim.x.length - 1];
      const finalOutput = sim.y[sim.y.length - 1];

      const result = {
        operation: 'simulate',
        initialState: x0,
        input: 'Unit step',
        simulationTime: tEnd + 's',
        samplePoints: sim.t.filter((_, i) => i % Math.floor(sim.t.length / 10) === 0).map((t, idx) => ({
          t: t.toFixed(3),
          x: sim.x[idx * Math.floor(sim.t.length / 10)]?.map(v => v.toFixed(4)),
          y: sim.y[idx * Math.floor(sim.t.length / 10)]?.map(v => v.toFixed(4))
        })),
        finalState: finalState.map(v => v.toFixed(4)),
        finalOutput: finalOutput.map(v => v.toFixed(4)),
        plot: createStatePlot(sim.t, sim.y.map(y => y[0]))
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: JSON.stringify({ error: 'Unknown operation', operation }, null, 2), isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function createStatePlot(t: number[], y: number[]): string {
  const width = 50;
  const height = 12;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  const minY = Math.min(...y, 0);
  const maxY = Math.max(...y, 0.1);
  const range = maxY - minY || 1;

  // Zero line
  const zeroRow = Math.round((height - 1) * (maxY / range));
  if (zeroRow >= 0 && zeroRow < height) {
    for (let x = 0; x < width; x++) grid[zeroRow][x] = '─';
  }

  // Plot
  for (let i = 0; i < t.length; i++) {
    const x = Math.floor(i * width / t.length);
    const row = Math.round((height - 1) * ((maxY - y[i]) / range));
    if (x >= 0 && x < width && row >= 0 && row < height) {
      grid[row][x] = '█';
    }
  }

  const lines = [
    'Output Response',
    `${maxY.toFixed(2)} ┐`,
    ...grid.map(row => '      │' + row.join('')),
    `${minY.toFixed(2)} ┘└${'─'.repeat(width - 1)}→ t`
  ];

  return lines.join('\n');
}

export function isstatespaceAvailable(): boolean { return true; }
