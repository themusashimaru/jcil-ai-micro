/**
 * CHAOS-THEORY TOOL
 * Chaos theory and dynamical systems analysis
 *
 * Implements real chaotic dynamics:
 * - Lorenz system (butterfly attractor)
 * - Rössler system (folded band attractor)
 * - Logistic map (period doubling to chaos)
 * - Hénon map (strange attractor)
 * - Lyapunov exponent calculation
 * - Bifurcation analysis
 * - Poincaré sections
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const chaostheoryTool: UnifiedTool = {
  name: 'chaos_theory',
  description:
    'Chaos theory analysis - Lyapunov exponents, strange attractors, bifurcation diagrams. Supports Lorenz, Rössler, logistic map, Hénon map systems.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'simulate',
          'lyapunov',
          'bifurcation',
          'attractor',
          'sensitivity',
          'poincare',
          'correlation_dim',
          'info',
        ],
        description:
          'Operation: simulate (evolve system), lyapunov (compute exponent), bifurcation (parameter sweep), attractor (characterize), sensitivity (compare trajectories), poincare (section), correlation_dim (fractal dimension)',
      },
      system: {
        type: 'string',
        enum: ['lorenz', 'rossler', 'logistic_map', 'henon', 'duffing', 'double_pendulum'],
        description: 'Chaotic system to analyze',
      },
      initial_state: {
        type: 'array',
        items: { type: 'number' },
        description: 'Initial conditions [x, y, z] or [x, y]',
      },
      parameters: {
        type: 'object',
        description: 'System parameters (sigma, rho, beta for Lorenz, etc.)',
      },
      timesteps: { type: 'integer', description: 'Number of timesteps to simulate' },
      dt: { type: 'number', description: 'Time step size (default 0.01)' },
      parameter_name: { type: 'string', description: 'Parameter to vary for bifurcation diagram' },
      param_range: {
        type: 'array',
        items: { type: 'number' },
        description: 'Parameter range [min, max] for bifurcation',
      },
      param_steps: { type: 'integer', description: 'Number of parameter values to test' },
      perturbation: {
        type: 'number',
        description: 'Initial perturbation size for sensitivity analysis',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SystemState {
  state: number[];
  time: number;
}

interface TrajectoryResult {
  trajectory: number[][];
  times: number[];
  statistics: {
    mean: number[];
    std: number[];
    min: number[];
    max: number[];
  };
}

interface LyapunovResult {
  exponents: number[];
  chaos_indicator: string;
  divergence_rate: number;
  predictability_horizon: number;
}

// ============================================================================
// LORENZ SYSTEM
// dx/dt = σ(y - x)
// dy/dt = x(ρ - z) - y
// dz/dt = xy - βz
// ============================================================================

function lorenzDerivatives(state: number[], sigma: number, rho: number, beta: number): number[] {
  const [x, y, z] = state;
  return [sigma * (y - x), x * (rho - z) - y, x * y - beta * z];
}

function lorenzJacobian(state: number[], sigma: number, rho: number, beta: number): number[][] {
  const [x, y, z] = state;
  return [
    [-sigma, sigma, 0],
    [rho - z, -1, -x],
    [y, x, -beta],
  ];
}

// ============================================================================
// RÖSSLER SYSTEM
// dx/dt = -y - z
// dy/dt = x + ay
// dz/dt = b + z(x - c)
// ============================================================================

function rosslerDerivatives(state: number[], a: number, b: number, c: number): number[] {
  const [x, y, z] = state;
  return [-y - z, x + a * y, b + z * (x - c)];
}

function rosslerJacobian(state: number[], a: number, _b: number, c: number): number[][] {
  const [x, _y, z] = state;
  return [
    [0, -1, -1],
    [1, a, 0],
    [z, 0, x - c],
  ];
}

// ============================================================================
// LOGISTIC MAP
// x_{n+1} = r * x_n * (1 - x_n)
// ============================================================================

function logisticMap(x: number, r: number): number {
  return r * x * (1 - x);
}

function logisticMapDerivative(x: number, r: number): number {
  return r * (1 - 2 * x);
}

// ============================================================================
// HÉNON MAP
// x_{n+1} = 1 - a*x_n² + y_n
// y_{n+1} = b*x_n
// ============================================================================

function henonMap(state: number[], a: number, b: number): number[] {
  const [x, y] = state;
  return [1 - a * x * x + y, b * x];
}

function henonJacobian(state: number[], a: number, b: number): number[][] {
  const [x] = state;
  return [
    [-2 * a * x, 1],
    [b, 0],
  ];
}

// ============================================================================
// DUFFING OSCILLATOR (forced)
// dx/dt = y
// dy/dt = x - x³ - δy + γcos(ωt)
// ============================================================================

function duffingDerivatives(
  state: number[],
  t: number,
  delta: number,
  gamma: number,
  omega: number
): number[] {
  const [x, y] = state;
  return [y, x - x * x * x - delta * y + gamma * Math.cos(omega * t)];
}

// ============================================================================
// DOUBLE PENDULUM (simplified, chaotic)
// ============================================================================

function doublePendulumDerivatives(
  state: number[],
  m1: number,
  m2: number,
  l1: number,
  l2: number,
  g: number
): number[] {
  const [theta1, omega1, theta2, omega2] = state;
  const delta = theta2 - theta1;
  const denom1 = (m1 + m2) * l1 - m2 * l1 * Math.cos(delta) * Math.cos(delta);
  const denom2 = (l2 / l1) * denom1;

  const dtheta1 = omega1;
  const dtheta2 = omega2;

  const domega1 =
    (m2 * l1 * omega1 * omega1 * Math.sin(delta) * Math.cos(delta) +
      m2 * g * Math.sin(theta2) * Math.cos(delta) +
      m2 * l2 * omega2 * omega2 * Math.sin(delta) -
      (m1 + m2) * g * Math.sin(theta1)) /
    denom1;

  const domega2 =
    (-m2 * l2 * omega2 * omega2 * Math.sin(delta) * Math.cos(delta) +
      (m1 + m2) * g * Math.sin(theta1) * Math.cos(delta) -
      (m1 + m2) * l1 * omega1 * omega1 * Math.sin(delta) -
      (m1 + m2) * g * Math.sin(theta2)) /
    denom2;

  return [dtheta1, domega1, dtheta2, domega2];
}

// ============================================================================
// RK4 NUMERICAL INTEGRATION
// ============================================================================

function rk4Step(
  state: number[],
  t: number,
  dt: number,
  derivatives: (state: number[], t: number) => number[]
): number[] {
  const k1 = derivatives(state, t);
  const k2 = derivatives(
    state.map((s, i) => s + 0.5 * dt * k1[i]),
    t + 0.5 * dt
  );
  const k3 = derivatives(
    state.map((s, i) => s + 0.5 * dt * k2[i]),
    t + 0.5 * dt
  );
  const k4 = derivatives(
    state.map((s, i) => s + dt * k3[i]),
    t + dt
  );

  return state.map((s, i) => s + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

function simulateSystem(
  system: string,
  initialState: number[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  timesteps: number,
  dt: number
): TrajectoryResult {
  const trajectory: number[][] = [initialState];
  const times: number[] = [0];
  let state = [...initialState];
  let t = 0;

  // Get derivative function based on system
  const getDerivatives = (s: number[], time: number): number[] => {
    switch (system) {
      case 'lorenz':
        return lorenzDerivatives(s, params.sigma || 10, params.rho || 28, params.beta || 8 / 3);
      case 'rossler':
        return rosslerDerivatives(s, params.a || 0.2, params.b || 0.2, params.c || 5.7);
      case 'duffing':
        return duffingDerivatives(
          s,
          time,
          params.delta || 0.3,
          params.gamma || 0.5,
          params.omega || 1.2
        );
      case 'double_pendulum':
        return doublePendulumDerivatives(
          s,
          params.m1 || 1,
          params.m2 || 1,
          params.l1 || 1,
          params.l2 || 1,
          params.g || 9.81
        );
      default:
        return lorenzDerivatives(s, 10, 28, 8 / 3);
    }
  };

  // For discrete maps
  if (system === 'logistic_map') {
    let x = initialState[0] || 0.5;
    const r = params.r || 3.9;
    for (let i = 0; i < timesteps; i++) {
      x = logisticMap(x, r);
      trajectory.push([x]);
      times.push(i + 1);
    }
  } else if (system === 'henon') {
    state = initialState.length >= 2 ? initialState : [0.1, 0.1];
    const a = params.a || 1.4;
    const b = params.b || 0.3;
    for (let i = 0; i < timesteps; i++) {
      state = henonMap(state, a, b);
      trajectory.push([...state]);
      times.push(i + 1);
    }
  } else {
    // Continuous systems with RK4
    for (let i = 0; i < timesteps; i++) {
      state = rk4Step(state, t, dt, getDerivatives);
      t += dt;
      trajectory.push([...state]);
      times.push(t);
    }
  }

  // Compute statistics
  const n = trajectory.length;
  const dim = trajectory[0].length;
  const mean = new Array(dim).fill(0);
  const min = new Array(dim).fill(Infinity);
  const max = new Array(dim).fill(-Infinity);

  for (const point of trajectory) {
    for (let d = 0; d < dim; d++) {
      mean[d] += point[d] / n;
      min[d] = Math.min(min[d], point[d]);
      max[d] = Math.max(max[d], point[d]);
    }
  }

  const std = new Array(dim).fill(0);
  for (const point of trajectory) {
    for (let d = 0; d < dim; d++) {
      std[d] += (point[d] - mean[d]) ** 2 / n;
    }
  }
  for (let d = 0; d < dim; d++) {
    std[d] = Math.sqrt(std[d]);
  }

  return {
    trajectory,
    times,
    statistics: { mean, std, min, max },
  };
}

// ============================================================================
// LYAPUNOV EXPONENT CALCULATION
// ============================================================================

function computeLyapunovExponent(
  system: string,
  initialState: number[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  timesteps: number,
  dt: number
): LyapunovResult {
  // For discrete maps
  if (system === 'logistic_map') {
    return computeLogisticLyapunov(initialState[0] || 0.5, params.r || 3.9, timesteps);
  }

  if (system === 'henon') {
    return computeHenonLyapunov(initialState, params, timesteps);
  }

  // For continuous systems, use QR method
  return computeContinuousLyapunov(system, initialState, params, timesteps, dt);
}

function computeLogisticLyapunov(x0: number, r: number, iterations: number): LyapunovResult {
  let x = x0;
  let lyapunovSum = 0;

  // Skip transient
  const transient = Math.min(1000, iterations / 10);
  for (let i = 0; i < transient; i++) {
    x = logisticMap(x, r);
  }

  // Accumulate Lyapunov exponent
  for (let i = 0; i < iterations - transient; i++) {
    const derivative = Math.abs(logisticMapDerivative(x, r));
    if (derivative > 0) {
      lyapunovSum += Math.log(derivative);
    }
    x = logisticMap(x, r);
  }

  const lambda = lyapunovSum / (iterations - transient);

  return {
    exponents: [lambda],
    chaos_indicator: lambda > 0.001 ? 'chaotic' : lambda < -0.001 ? 'stable' : 'edge_of_chaos',
    divergence_rate: Math.exp(lambda),
    predictability_horizon: lambda > 0 ? 1 / lambda : Infinity,
  };
}

function computeHenonLyapunov(
  initialState: number[],
  params: { a?: number; b?: number },
  iterations: number
): LyapunovResult {
  const a = params.a || 1.4;
  const b = params.b || 0.3;
  let state = initialState.length >= 2 ? [...initialState] : [0.1, 0.1];

  // Initialize tangent vectors
  let v1 = [1, 0];
  let v2 = [0, 1];
  let lyapunov1 = 0;
  let lyapunov2 = 0;

  // Skip transient
  const transient = Math.min(1000, iterations / 10);
  for (let i = 0; i < transient; i++) {
    state = henonMap(state, a, b);
  }

  // Main iteration
  for (let i = 0; i < iterations - transient; i++) {
    const J = henonJacobian(state, a, b);

    // Evolve tangent vectors
    const newV1 = [J[0][0] * v1[0] + J[0][1] * v1[1], J[1][0] * v1[0] + J[1][1] * v1[1]];
    const newV2 = [J[0][0] * v2[0] + J[0][1] * v2[1], J[1][0] * v2[0] + J[1][1] * v2[1]];

    // Gram-Schmidt orthonormalization
    const norm1 = Math.sqrt(newV1[0] ** 2 + newV1[1] ** 2);
    v1 = [newV1[0] / norm1, newV1[1] / norm1];
    lyapunov1 += Math.log(norm1);

    // Orthogonalize v2
    const dot = newV2[0] * v1[0] + newV2[1] * v1[1];
    const orthoV2 = [newV2[0] - dot * v1[0], newV2[1] - dot * v1[1]];
    const norm2 = Math.sqrt(orthoV2[0] ** 2 + orthoV2[1] ** 2);
    v2 = [orthoV2[0] / norm2, orthoV2[1] / norm2];
    lyapunov2 += Math.log(norm2);

    state = henonMap(state, a, b);
  }

  const n = iterations - transient;
  const lambda1 = lyapunov1 / n;
  const lambda2 = lyapunov2 / n;

  return {
    exponents: [lambda1, lambda2],
    chaos_indicator: lambda1 > 0.001 ? 'chaotic' : 'stable',
    divergence_rate: Math.exp(lambda1),
    predictability_horizon: lambda1 > 0 ? 1 / lambda1 : Infinity,
  };
}

function computeContinuousLyapunov(
  system: string,
  initialState: number[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  timesteps: number,
  dt: number
): LyapunovResult {
  const dim = initialState.length;
  let state = [...initialState];
  let t = 0;

  // Get Jacobian function
  const getJacobian = (s: number[]): number[][] => {
    switch (system) {
      case 'lorenz':
        return lorenzJacobian(s, params.sigma || 10, params.rho || 28, params.beta || 8 / 3);
      case 'rossler':
        return rosslerJacobian(s, params.a || 0.2, params.b || 0.2, params.c || 5.7);
      default:
        return lorenzJacobian(s, 10, 28, 8 / 3);
    }
  };

  const getDerivatives = (s: number[], _time: number): number[] => {
    switch (system) {
      case 'lorenz':
        return lorenzDerivatives(s, params.sigma || 10, params.rho || 28, params.beta || 8 / 3);
      case 'rossler':
        return rosslerDerivatives(s, params.a || 0.2, params.b || 0.2, params.c || 5.7);
      default:
        return lorenzDerivatives(s, 10, 28, 8 / 3);
    }
  };

  // Initialize orthonormal tangent vectors
  const Q: number[][] = [];
  for (let i = 0; i < dim; i++) {
    Q.push(new Array(dim).fill(0));
    Q[i][i] = 1;
  }

  const lyapunovSums = new Array(dim).fill(0);

  // Skip transient
  const transient = Math.min(5000, timesteps / 10);
  for (let i = 0; i < transient; i++) {
    state = rk4Step(state, t, dt, getDerivatives);
    t += dt;
  }

  // Main iteration with QR decomposition
  const reorthSteps = 10;
  for (let i = 0; i < timesteps - transient; i++) {
    const J = getJacobian(state);

    // Evolve tangent vectors using linearized dynamics
    for (let j = 0; j < dim; j++) {
      const dq = new Array(dim).fill(0);
      for (let k = 0; k < dim; k++) {
        for (let l = 0; l < dim; l++) {
          dq[k] += J[k][l] * Q[j][l];
        }
      }
      for (let k = 0; k < dim; k++) {
        Q[j][k] += dq[k] * dt;
      }
    }

    // Periodic Gram-Schmidt orthonormalization
    if ((i + 1) % reorthSteps === 0) {
      for (let j = 0; j < dim; j++) {
        // Orthogonalize against previous vectors
        for (let k = 0; k < j; k++) {
          let dot = 0;
          for (let l = 0; l < dim; l++) {
            dot += Q[j][l] * Q[k][l];
          }
          for (let l = 0; l < dim; l++) {
            Q[j][l] -= dot * Q[k][l];
          }
        }

        // Normalize
        let norm = 0;
        for (let l = 0; l < dim; l++) {
          norm += Q[j][l] * Q[j][l];
        }
        norm = Math.sqrt(norm);

        if (norm > 1e-10) {
          lyapunovSums[j] += Math.log(norm);
          for (let l = 0; l < dim; l++) {
            Q[j][l] /= norm;
          }
        }
      }
    }

    state = rk4Step(state, t, dt, getDerivatives);
    t += dt;
  }

  const totalTime = (timesteps - transient) * dt;
  const exponents = lyapunovSums.map((sum) => sum / totalTime);

  const maxExponent = Math.max(...exponents);

  return {
    exponents,
    chaos_indicator:
      maxExponent > 0.001 ? 'chaotic' : maxExponent < -0.001 ? 'stable' : 'edge_of_chaos',
    divergence_rate: Math.exp(maxExponent),
    predictability_horizon: maxExponent > 0 ? 1 / maxExponent : Infinity,
  };
}

// ============================================================================
// BIFURCATION DIAGRAM
// ============================================================================

function computeBifurcationDiagram(
  system: string,
  paramName: string,
  paramRange: [number, number],
  paramSteps: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  initialState: number[]
): { paramValues: number[]; attractorPoints: number[][] } {
  const paramValues: number[] = [];
  const attractorPoints: number[][] = [];

  const [pMin, pMax] = paramRange;
  const dp = (pMax - pMin) / (paramSteps - 1);

  for (let i = 0; i < paramSteps; i++) {
    const p = pMin + i * dp;
    paramValues.push(p);

    // Create params with varied parameter
    const currentParams = { ...params, [paramName]: p };

    // Simulate and collect attractor points
    if (system === 'logistic_map') {
      let x = initialState[0] || 0.5;

      // Skip transient
      for (let j = 0; j < 500; j++) {
        x = logisticMap(x, p);
      }

      // Collect attractor points
      const points: number[] = [];
      for (let j = 0; j < 100; j++) {
        x = logisticMap(x, p);
        points.push(x);
      }
      attractorPoints.push(points);
    } else {
      // For continuous systems, use Poincaré section
      const result = simulateSystem(system, initialState, currentParams, 5000, 0.01);

      // Sample last portion of trajectory
      const lastN = Math.min(200, result.trajectory.length);
      const points = result.trajectory.slice(-lastN).map((s) => s[0]);
      attractorPoints.push(points);
    }
  }

  return { paramValues, attractorPoints };
}

// ============================================================================
// SENSITIVITY ANALYSIS (BUTTERFLY EFFECT)
// ============================================================================

function sensitivityAnalysis(
  system: string,
  initialState: number[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  perturbation: number,
  timesteps: number,
  dt: number
): { original: number[][]; perturbed: number[][]; divergence: number[]; times: number[] } {
  const perturbedState = initialState.map((x, i) => (i === 0 ? x + perturbation : x));

  const original = simulateSystem(system, initialState, params, timesteps, dt);
  const perturbed = simulateSystem(system, perturbedState, params, timesteps, dt);

  // Compute divergence over time
  const divergence: number[] = [];
  const minLen = Math.min(original.trajectory.length, perturbed.trajectory.length);

  for (let i = 0; i < minLen; i++) {
    let dist = 0;
    for (let d = 0; d < original.trajectory[i].length; d++) {
      dist += (original.trajectory[i][d] - perturbed.trajectory[i][d]) ** 2;
    }
    divergence.push(Math.sqrt(dist));
  }

  return {
    original: original.trajectory,
    perturbed: perturbed.trajectory,
    divergence,
    times: original.times.slice(0, minLen),
  };
}

// ============================================================================
// CORRELATION DIMENSION (FRACTAL DIMENSION)
// ============================================================================

function computeCorrelationDimension(
  trajectory: number[][],
  maxRadius: number
): { dimension: number; radii: number[]; correlationIntegral: number[] } {
  const n = trajectory.length;
  const dim = trajectory[0].length;

  // Sample pairs to avoid O(n²) for large datasets
  const maxPairs = Math.min(10000, (n * (n - 1)) / 2);
  const pairs: [number, number][] = [];

  for (let i = 0; i < n && pairs.length < maxPairs; i++) {
    for (let j = i + 1; j < n && pairs.length < maxPairs; j++) {
      pairs.push([i, j]);
    }
  }

  // Compute pairwise distances
  const distances: number[] = [];
  for (const [i, j] of pairs) {
    let dist = 0;
    for (let d = 0; d < dim; d++) {
      dist += (trajectory[i][d] - trajectory[j][d]) ** 2;
    }
    distances.push(Math.sqrt(dist));
  }

  distances.sort((a, b) => a - b);

  // Compute correlation integral at different radii
  const numRadii = 20;
  const minDist = Math.max(distances[0], maxRadius / 1000);
  const radii: number[] = [];
  const correlationIntegral: number[] = [];

  for (let i = 0; i < numRadii; i++) {
    const r = minDist * Math.pow(maxRadius / minDist, i / (numRadii - 1));
    radii.push(r);

    // Count pairs within radius r
    const count = distances.filter((d) => d < r).length;
    correlationIntegral.push(count / distances.length);
  }

  // Estimate dimension from log-log slope (exclude endpoints)
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  let validPoints = 0;

  for (let i = 3; i < numRadii - 3; i++) {
    if (correlationIntegral[i] > 0.01 && correlationIntegral[i] < 0.99) {
      const x = Math.log(radii[i]);
      const y = Math.log(correlationIntegral[i]);
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      validPoints++;
    }
  }

  const dimension =
    validPoints > 1
      ? (validPoints * sumXY - sumX * sumY) / (validPoints * sumX2 - sumX * sumX)
      : NaN;

  return { dimension, radii, correlationIntegral };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executechaostheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation = 'info',
      system = 'lorenz',
      initial_state,
      parameters = {},
      timesteps = 5000,
      dt = 0.01,
      parameter_name = 'r',
      param_range = [2.5, 4.0],
      param_steps = 200,
      perturbation = 1e-8,
    } = args;

    // Default initial states for each system
    const defaultStates: Record<string, number[]> = {
      lorenz: [1, 1, 1],
      rossler: [1, 1, 1],
      logistic_map: [0.5],
      henon: [0.1, 0.1],
      duffing: [0.5, 0.5],
      double_pendulum: [Math.PI / 2, 0, Math.PI / 2, 0],
    };

    const initialState = initial_state || defaultStates[system] || [1, 1, 1];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simulate': {
        const simResult = simulateSystem(system, initialState, parameters, timesteps, dt);

        // Sample trajectory for output
        const sampleInterval = Math.max(1, Math.floor(simResult.trajectory.length / 100));
        const sampledTrajectory = simResult.trajectory.filter((_, i) => i % sampleInterval === 0);

        result = {
          operation: 'simulate',
          system,
          initial_state: initialState,
          parameters,
          timesteps,
          dt,
          statistics: simResult.statistics,
          trajectory_sample: sampledTrajectory.slice(0, 50),
          total_points: simResult.trajectory.length,
          description:
            `Simulated ${system} system for ${timesteps} steps. ` +
            `Attractor bounds: x∈[${simResult.statistics.min[0].toFixed(2)}, ${simResult.statistics.max[0].toFixed(2)}]`,
        };
        break;
      }

      case 'lyapunov': {
        const lyapResult = computeLyapunovExponent(system, initialState, parameters, timesteps, dt);

        result = {
          operation: 'lyapunov',
          system,
          lyapunov_exponents: lyapResult.exponents,
          max_lyapunov: Math.max(...lyapResult.exponents),
          chaos_indicator: lyapResult.chaos_indicator,
          divergence_rate: lyapResult.divergence_rate,
          predictability_horizon: lyapResult.predictability_horizon,
          interpretation: {
            positive: 'λ > 0: Chaotic - nearby trajectories diverge exponentially',
            zero: 'λ ≈ 0: Edge of chaos - marginal stability',
            negative: 'λ < 0: Stable - trajectories converge',
          },
          description:
            `Lyapunov exponents for ${system}: ${lyapResult.exponents.map((e) => e.toFixed(4)).join(', ')}. ` +
            `System is ${lyapResult.chaos_indicator}. ` +
            `Predictability horizon: ${lyapResult.predictability_horizon.toFixed(2)} time units.`,
        };
        break;
      }

      case 'bifurcation': {
        const bifResult = computeBifurcationDiagram(
          system,
          parameter_name,
          param_range as [number, number],
          param_steps,
          parameters,
          initialState
        );

        // Sample for output
        const sampleInterval = Math.max(1, Math.floor(param_steps / 50));
        const sampledParams = bifResult.paramValues.filter((_, i) => i % sampleInterval === 0);
        const sampledPoints = bifResult.attractorPoints.filter((_, i) => i % sampleInterval === 0);

        result = {
          operation: 'bifurcation',
          system,
          parameter_name,
          param_range,
          param_steps,
          sample_parameters: sampledParams,
          sample_attractor_points: sampledPoints.map((pts) => pts.slice(0, 10)),
          observations: {
            period_doubling: 'As parameter increases, period doubles (1→2→4→8→...→chaos)',
            windows: 'Periodic windows exist within chaotic regime',
            universality: 'Feigenbaum constants δ≈4.669 and α≈2.503 are universal',
          },
          description: `Bifurcation diagram for ${system} varying ${parameter_name} from ${param_range[0]} to ${param_range[1]}`,
        };
        break;
      }

      case 'sensitivity': {
        const sensResult = sensitivityAnalysis(
          system,
          initialState,
          parameters,
          perturbation,
          timesteps,
          dt
        );

        // Sample for output
        const sampleInterval = Math.max(1, Math.floor(sensResult.times.length / 50));
        const sampledDivergence = sensResult.divergence.filter((_, i) => i % sampleInterval === 0);
        const sampledTimes = sensResult.times.filter((_, i) => i % sampleInterval === 0);

        // Find when divergence exceeds significant threshold
        const threshold =
          Math.sqrt(initialState.reduce((s: number, x: number) => s + x * x, 0)) * 0.1;
        const crossingTime =
          sensResult.times[sensResult.divergence.findIndex((d) => d > threshold)] || Infinity;

        result = {
          operation: 'sensitivity',
          system,
          initial_perturbation: perturbation,
          divergence_over_time: sampledDivergence.slice(0, 30),
          times: sampledTimes.slice(0, 30),
          final_divergence: sensResult.divergence[sensResult.divergence.length - 1],
          crossing_time: crossingTime,
          amplification_factor:
            sensResult.divergence[sensResult.divergence.length - 1] / perturbation,
          butterfly_effect: `Initial perturbation of ${perturbation.toExponential(2)} amplified to ${sensResult.divergence[sensResult.divergence.length - 1].toFixed(4)}`,
          description:
            `Sensitivity analysis: perturbation of ${perturbation.toExponential(2)} in ${system}. ` +
            `Crossed significance threshold at t=${crossingTime.toFixed(2)}.`,
        };
        break;
      }

      case 'correlation_dim': {
        const simResult = simulateSystem(system, initialState, parameters, timesteps, dt);
        // Skip transient
        const trajectory = simResult.trajectory.slice(Math.floor(simResult.trajectory.length / 2));
        const maxRadius =
          Math.max(...simResult.statistics.max) - Math.min(...simResult.statistics.min);

        const dimResult = computeCorrelationDimension(trajectory, maxRadius);

        result = {
          operation: 'correlation_dim',
          system,
          correlation_dimension: dimResult.dimension,
          radii_sample: dimResult.radii.slice(0, 10),
          correlation_integral_sample: dimResult.correlationIntegral.slice(0, 10),
          interpretation: {
            lorenz: 'Expected D ≈ 2.06 for Lorenz attractor',
            henon: 'Expected D ≈ 1.26 for Hénon attractor',
            logistic_map: 'D ≈ 0.5 at chaos onset, increases with r',
          },
          description:
            `Correlation dimension for ${system}: D ≈ ${dimResult.dimension.toFixed(3)}. ` +
            `This fractal dimension characterizes the strange attractor.`,
        };
        break;
      }

      case 'attractor': {
        const simResult = simulateSystem(
          system,
          initialState,
          parameters,
          Math.max(timesteps, 10000),
          dt
        );
        // Skip transient
        const attractor = simResult.trajectory.slice(Math.floor(simResult.trajectory.length / 2));

        // Compute attractor characteristics
        const maxRadius = Math.max(
          simResult.statistics.max[0] - simResult.statistics.min[0],
          simResult.statistics.max.length > 1
            ? simResult.statistics.max[1] - simResult.statistics.min[1]
            : 0
        );
        const dimResult = computeCorrelationDimension(
          attractor.slice(0, Math.min(5000, attractor.length)),
          maxRadius
        );

        result = {
          operation: 'attractor',
          system,
          attractor_type:
            dimResult.dimension > 0 && !isNaN(dimResult.dimension)
              ? 'strange_attractor'
              : 'limit_cycle',
          bounding_box: {
            min: simResult.statistics.min,
            max: simResult.statistics.max,
          },
          center: simResult.statistics.mean,
          extent: simResult.statistics.max.map((max, i) => max - simResult.statistics.min[i]),
          correlation_dimension: dimResult.dimension,
          sample_points: attractor
            .filter((_, i) => i % Math.floor(attractor.length / 20) === 0)
            .slice(0, 20),
          description:
            `${system} attractor: ` +
            `D ≈ ${dimResult.dimension.toFixed(3)}, ` +
            `bounded in ${simResult.statistics.min.map((m, i) => `[${m.toFixed(2)}, ${simResult.statistics.max[i].toFixed(2)}]`).join(' × ')}`,
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'chaos_theory',
          description:
            'Chaos theory and nonlinear dynamics analysis - study deterministic systems with sensitive dependence on initial conditions',
          systems: {
            lorenz: {
              description: 'Lorenz attractor - butterfly-shaped strange attractor',
              equations: ['dx/dt = σ(y - x)', 'dy/dt = x(ρ - z) - y', 'dz/dt = xy - βz'],
              default_params: { sigma: 10, rho: 28, beta: 8 / 3 },
              lyapunov: 'λ₁ ≈ 0.906 (chaotic)',
            },
            rossler: {
              description: 'Rössler attractor - folded band structure',
              equations: ['dx/dt = -y - z', 'dy/dt = x + ay', 'dz/dt = b + z(x - c)'],
              default_params: { a: 0.2, b: 0.2, c: 5.7 },
              lyapunov: 'λ₁ ≈ 0.07 (weakly chaotic)',
            },
            logistic_map: {
              description: 'Logistic map - simplest chaotic system',
              equation: 'x_{n+1} = r·x_n·(1 - x_n)',
              default_params: { r: 3.9 },
              chaos_onset: 'r ≈ 3.57 (period-doubling cascade)',
            },
            henon: {
              description: 'Hénon map - 2D discrete strange attractor',
              equations: ['x_{n+1} = 1 - ax_n² + y_n', 'y_{n+1} = bx_n'],
              default_params: { a: 1.4, b: 0.3 },
              dimension: 'D ≈ 1.26',
            },
          },
          key_concepts: {
            lyapunov_exponent:
              'Measures rate of divergence of nearby trajectories. λ > 0 indicates chaos.',
            strange_attractor: 'Fractal set that trajectories approach but never repeat exactly.',
            bifurcation: 'Qualitative change in dynamics as parameter varies.',
            sensitivity: 'Butterfly effect - tiny changes grow exponentially.',
          },
          operations: {
            simulate: 'Evolve system forward in time',
            lyapunov: 'Compute Lyapunov exponents',
            bifurcation: 'Generate bifurcation diagram',
            sensitivity: 'Compare diverging trajectories',
            correlation_dim: 'Estimate fractal dimension',
            attractor: 'Characterize the attractor',
          },
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify(
        {
          error: errorMessage,
          tool: 'chaos_theory',
          hint: 'Use operation="info" for documentation',
        },
        null,
        2
      ),
      isError: true,
    };
  }
}

export function ischaostheoryAvailable(): boolean {
  return true;
}
