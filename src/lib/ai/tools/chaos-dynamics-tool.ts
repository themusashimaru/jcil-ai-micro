// ============================================================================
// CHAOS DYNAMICS TOOL - TIER INFINITY
// ============================================================================
// Chaos theory and nonlinear dynamics: Lorenz attractor, Lyapunov exponents,
// bifurcation diagrams, fractals, and strange attractors.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface TimeSeriesPoint {
  t: number;
  x: number;
  y?: number;
  z?: number;
}

// ============================================================================
// DYNAMICAL SYSTEMS
// ============================================================================

// Lorenz system: dx/dt = σ(y-x), dy/dt = x(ρ-z)-y, dz/dt = xy-βz
function lorenzDerivatives(
  x: number,
  y: number,
  z: number,
  sigma: number,
  rho: number,
  beta: number
): Point3D {
  return {
    x: sigma * (y - x),
    y: x * (rho - z) - y,
    z: x * y - beta * z,
  };
}

function simulateLorenz(
  x0: number,
  y0: number,
  z0: number,
  sigma: number,
  rho: number,
  beta: number,
  dt: number,
  steps: number
): TimeSeriesPoint[] {
  const trajectory: TimeSeriesPoint[] = [];
  let x = x0,
    y = y0,
    z = z0;

  for (let i = 0; i < steps; i++) {
    trajectory.push({ t: i * dt, x, y, z });

    // RK4 integration
    const k1 = lorenzDerivatives(x, y, z, sigma, rho, beta);
    const k2 = lorenzDerivatives(
      x + 0.5 * dt * k1.x,
      y + 0.5 * dt * k1.y,
      z + 0.5 * dt * k1.z,
      sigma,
      rho,
      beta
    );
    const k3 = lorenzDerivatives(
      x + 0.5 * dt * k2.x,
      y + 0.5 * dt * k2.y,
      z + 0.5 * dt * k2.z,
      sigma,
      rho,
      beta
    );
    const k4 = lorenzDerivatives(x + dt * k3.x, y + dt * k3.y, z + dt * k3.z, sigma, rho, beta);

    x += (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x);
    y += (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y);
    z += (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z);
  }

  return trajectory;
}

// Rössler system
function rosslerDerivatives(
  x: number,
  y: number,
  z: number,
  a: number,
  b: number,
  c: number
): Point3D {
  return {
    x: -y - z,
    y: x + a * y,
    z: b + z * (x - c),
  };
}

function simulateRossler(
  x0: number,
  y0: number,
  z0: number,
  a: number,
  b: number,
  c: number,
  dt: number,
  steps: number
): TimeSeriesPoint[] {
  const trajectory: TimeSeriesPoint[] = [];
  let x = x0,
    y = y0,
    z = z0;

  for (let i = 0; i < steps; i++) {
    trajectory.push({ t: i * dt, x, y, z });

    const k1 = rosslerDerivatives(x, y, z, a, b, c);
    const k2 = rosslerDerivatives(
      x + 0.5 * dt * k1.x,
      y + 0.5 * dt * k1.y,
      z + 0.5 * dt * k1.z,
      a,
      b,
      c
    );
    const k3 = rosslerDerivatives(
      x + 0.5 * dt * k2.x,
      y + 0.5 * dt * k2.y,
      z + 0.5 * dt * k2.z,
      a,
      b,
      c
    );
    const k4 = rosslerDerivatives(x + dt * k3.x, y + dt * k3.y, z + dt * k3.z, a, b, c);

    x += (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x);
    y += (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y);
    z += (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z);
  }

  return trajectory;
}

// Logistic map: x_{n+1} = r * x_n * (1 - x_n)
function logisticMap(x: number, r: number): number {
  return r * x * (1 - x);
}

function iterateLogistic(x0: number, r: number, iterations: number): number[] {
  const values: number[] = [x0];
  let x = x0;
  for (let i = 0; i < iterations - 1; i++) {
    x = logisticMap(x, r);
    values.push(x);
  }
  return values;
}

// Bifurcation diagram
function bifurcationDiagram(
  rMin: number,
  rMax: number,
  rSteps: number,
  transient: number,
  samples: number
): { r: number; x: number }[] {
  const points: { r: number; x: number }[] = [];
  const rStep = (rMax - rMin) / rSteps;

  for (let i = 0; i <= rSteps; i++) {
    const r = rMin + i * rStep;
    let x = 0.5;

    // Transient
    for (let j = 0; j < transient; j++) {
      x = logisticMap(x, r);
    }

    // Sample
    for (let j = 0; j < samples; j++) {
      x = logisticMap(x, r);
      points.push({ r, x });
    }
  }

  return points;
}

// Hénon map
function henonMap(x: number, y: number, a: number, b: number): [number, number] {
  return [1 - a * x * x + y, b * x];
}

function iterateHenon(
  x0: number,
  y0: number,
  a: number,
  b: number,
  iterations: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [{ x: x0, y: y0 }];
  let x = x0,
    y = y0;

  for (let i = 0; i < iterations - 1; i++) {
    [x, y] = henonMap(x, y, a, b);
    points.push({ x, y });
  }

  return points;
}

// Lyapunov exponent for logistic map
function lyapunovLogistic(r: number, iterations: number = 1000, transient: number = 100): number {
  let x = 0.5;

  // Transient
  for (let i = 0; i < transient; i++) {
    x = logisticMap(x, r);
  }

  // Compute Lyapunov exponent
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    const derivative = Math.abs(r * (1 - 2 * x));
    if (derivative > 0) {
      sum += Math.log(derivative);
    }
    x = logisticMap(x, r);
  }

  return sum / iterations;
}

// Mandelbrot set iteration count
function mandelbrotIterations(cReal: number, cImag: number, maxIter: number): number {
  let zr = 0,
    zi = 0;
  let iter = 0;

  while (zr * zr + zi * zi <= 4 && iter < maxIter) {
    const newZr = zr * zr - zi * zi + cReal;
    zi = 2 * zr * zi + cImag;
    zr = newZr;
    iter++;
  }

  return iter;
}

// Julia set iteration count
function juliaIterations(
  zReal: number,
  zImag: number,
  cReal: number,
  cImag: number,
  maxIter: number
): number {
  let zr = zReal,
    zi = zImag;
  let iter = 0;

  while (zr * zr + zi * zi <= 4 && iter < maxIter) {
    const newZr = zr * zr - zi * zi + cReal;
    zi = 2 * zr * zi + cImag;
    zr = newZr;
    iter++;
  }

  return iter;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const chaosDynamicsTool: UnifiedTool = {
  name: 'chaos_dynamics',
  description: `Chaos theory and nonlinear dynamics simulations.

Operations:
- lorenz: Simulate Lorenz attractor
- rossler: Simulate Rössler attractor
- logistic: Iterate logistic map
- henon: Iterate Hénon map
- bifurcation: Generate bifurcation diagram
- lyapunov: Calculate Lyapunov exponent
- mandelbrot: Mandelbrot set iteration
- julia: Julia set iteration
- sensitivity: Demonstrate butterfly effect`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'lorenz',
          'rossler',
          'logistic',
          'henon',
          'bifurcation',
          'lyapunov',
          'mandelbrot',
          'julia',
          'sensitivity',
        ],
        description: 'System to simulate',
      },
      x0: { type: 'number', description: 'Initial x' },
      y0: { type: 'number', description: 'Initial y' },
      z0: { type: 'number', description: 'Initial z' },
      sigma: { type: 'number', description: 'Lorenz σ parameter' },
      rho: { type: 'number', description: 'Lorenz ρ parameter' },
      beta: { type: 'number', description: 'Lorenz β parameter' },
      a: { type: 'number', description: 'System a parameter' },
      b: { type: 'number', description: 'System b parameter' },
      c: { type: 'number', description: 'System c parameter' },
      r: { type: 'number', description: 'Logistic map r parameter' },
      dt: { type: 'number', description: 'Time step' },
      steps: { type: 'number', description: 'Number of iterations' },
      r_min: { type: 'number', description: 'Min r for bifurcation' },
      r_max: { type: 'number', description: 'Max r for bifurcation' },
      c_real: { type: 'number', description: 'Complex c real part' },
      c_imag: { type: 'number', description: 'Complex c imaginary part' },
      max_iter: { type: 'number', description: 'Maximum iterations' },
      perturbation: { type: 'number', description: 'Initial perturbation size' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeChaosDynamics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'lorenz': {
        const x0 = args.x0 ?? 1;
        const y0 = args.y0 ?? 1;
        const z0 = args.z0 ?? 1;
        const sigma = args.sigma ?? 10;
        const rho = args.rho ?? 28;
        const beta = args.beta ?? 8 / 3;
        const dt = args.dt ?? 0.01;
        const steps = args.steps ?? 1000;

        const trajectory = simulateLorenz(x0, y0, z0, sigma, rho, beta, dt, steps);

        // Sample for output
        const sampleRate = Math.max(1, Math.floor(trajectory.length / 100));
        const sampled = trajectory.filter((_, i) => i % sampleRate === 0);

        // Calculate bounds
        const xMin = Math.min(...trajectory.map((p) => p.x));
        const xMax = Math.max(...trajectory.map((p) => p.x));
        const yMin = Math.min(...trajectory.map((p) => p.y!));
        const yMax = Math.max(...trajectory.map((p) => p.y!));
        const zMin = Math.min(...trajectory.map((p) => p.z!));
        const zMax = Math.max(...trajectory.map((p) => p.z!));

        result = {
          operation: 'lorenz',
          parameters: { sigma, rho, beta },
          initial_conditions: { x0, y0, z0 },
          simulation: { dt, steps, total_time: dt * steps },
          bounds: {
            x: [xMin, xMax],
            y: [yMin, yMax],
            z: [zMin, zMax],
          },
          trajectory_sample: sampled.map((p) => ({
            t: p.t.toFixed(2),
            x: p.x.toFixed(3),
            y: p.y!.toFixed(3),
            z: p.z!.toFixed(3),
          })),
          note: 'Classic chaotic attractor discovered by Edward Lorenz',
        };
        break;
      }

      case 'rossler': {
        const x0 = args.x0 ?? 0.1;
        const y0 = args.y0 ?? 0;
        const z0 = args.z0 ?? 0;
        const a = args.a ?? 0.2;
        const b = args.b ?? 0.2;
        const c = args.c ?? 5.7;
        const dt = args.dt ?? 0.01;
        const steps = args.steps ?? 2000;

        const trajectory = simulateRossler(x0, y0, z0, a, b, c, dt, steps);
        const sampleRate = Math.max(1, Math.floor(trajectory.length / 100));
        const sampled = trajectory.filter((_, i) => i % sampleRate === 0);

        result = {
          operation: 'rossler',
          parameters: { a, b, c },
          initial_conditions: { x0, y0, z0 },
          simulation: { dt, steps },
          trajectory_sample: sampled.map((p) => ({
            t: p.t.toFixed(2),
            x: p.x.toFixed(3),
            y: p.y!.toFixed(3),
            z: p.z!.toFixed(3),
          })),
        };
        break;
      }

      case 'logistic': {
        const x0 = args.x0 ?? 0.5;
        const r = args.r ?? 3.9;
        const steps = args.steps ?? 100;

        const values = iterateLogistic(x0, r, steps);

        // Check for period
        const lastValues = values.slice(-20);
        const unique = [...new Set(lastValues.map((v) => v.toFixed(6)))];

        result = {
          operation: 'logistic',
          parameters: { r, x0 },
          iterations: steps,
          behavior: r < 3 ? 'fixed_point' : r < 3.57 ? 'periodic' : 'chaotic',
          final_values: values.slice(-10).map((v) => parseFloat(v.toFixed(6))),
          apparent_period: unique.length,
          lyapunov_exponent: lyapunovLogistic(r),
        };
        break;
      }

      case 'henon': {
        const x0 = args.x0 ?? 0;
        const y0 = args.y0 ?? 0;
        const a = args.a ?? 1.4;
        const b = args.b ?? 0.3;
        const steps = args.steps ?? 1000;

        const points = iterateHenon(x0, y0, a, b, steps);
        const sampleRate = Math.max(1, Math.floor(points.length / 100));
        const sampled = points.filter((_, i) => i % sampleRate === 0);

        result = {
          operation: 'henon',
          parameters: { a, b },
          initial_conditions: { x0, y0 },
          iterations: steps,
          attractor_sample: sampled.map((p) => ({
            x: p.x.toFixed(4),
            y: p.y.toFixed(4),
          })),
        };
        break;
      }

      case 'bifurcation': {
        const rMin = args.r_min ?? 2.5;
        const rMax = args.r_max ?? 4;
        const rSteps = 200;
        const transient = 200;
        const samples = 50;

        const points = bifurcationDiagram(rMin, rMax, rSteps, transient, samples);

        // Group by r value for output
        const grouped: Record<string, number[]> = {};
        for (const p of points) {
          const rKey = p.r.toFixed(4);
          if (!grouped[rKey]) grouped[rKey] = [];
          grouped[rKey].push(parseFloat(p.x.toFixed(4)));
        }

        // Sample output
        const sampledR = Object.keys(grouped).filter((_, i) => i % 20 === 0);
        const output = sampledR.map((r) => ({
          r: parseFloat(r),
          x_values: [...new Set(grouped[r])].slice(0, 8),
        }));

        result = {
          operation: 'bifurcation',
          r_range: [rMin, rMax],
          features: {
            period_doubling_cascade: 'r ≈ 3.0 → 3.57',
            onset_of_chaos: 'r ≈ 3.57',
            period_3_window: 'r ≈ 3.83',
          },
          diagram_sample: output,
        };
        break;
      }

      case 'lyapunov': {
        const r = args.r ?? 3.9;
        const iterations = args.steps ?? 1000;

        const lambda = lyapunovLogistic(r, iterations);

        // Scan across r values
        const rValues = [2.5, 3.0, 3.2, 3.5, 3.57, 3.8, 3.9, 4.0];
        const scan = rValues.map((rv) => ({
          r: rv,
          lyapunov: parseFloat(lyapunovLogistic(rv).toFixed(4)),
          behavior: lyapunovLogistic(rv) < 0 ? 'stable' : 'chaotic',
        }));

        result = {
          operation: 'lyapunov',
          r: r,
          lyapunov_exponent: lambda,
          interpretation:
            lambda < 0
              ? 'Stable (periodic or fixed point)'
              : lambda === 0
                ? 'Edge of chaos'
                : 'Chaotic (sensitive to initial conditions)',
          scan: scan,
        };
        break;
      }

      case 'mandelbrot': {
        const cReal = args.c_real ?? -0.5;
        const cImag = args.c_imag ?? 0;
        const maxIter = args.max_iter ?? 100;

        const iter = mandelbrotIterations(cReal, cImag, maxIter);

        // Sample around the point
        const resolution = 5;
        const delta = 0.1;
        const neighborhood: { re: number; im: number; iter: number }[] = [];

        for (let i = -resolution; i <= resolution; i++) {
          for (let j = -resolution; j <= resolution; j++) {
            const re = cReal + i * delta;
            const im = cImag + j * delta;
            neighborhood.push({
              re: parseFloat(re.toFixed(2)),
              im: parseFloat(im.toFixed(2)),
              iter: mandelbrotIterations(re, im, maxIter),
            });
          }
        }

        result = {
          operation: 'mandelbrot',
          point: { real: cReal, imaginary: cImag },
          iterations_to_escape: iter,
          in_set: iter === maxIter,
          neighborhood_sample: neighborhood.filter((_, i) => i % 3 === 0),
        };
        break;
      }

      case 'julia': {
        const zReal = args.x0 ?? 0;
        const zImag = args.y0 ?? 0;
        const cReal = args.c_real ?? -0.7;
        const cImag = args.c_imag ?? 0.27015;
        const maxIter = args.max_iter ?? 100;

        const iter = juliaIterations(zReal, zImag, cReal, cImag, maxIter);

        result = {
          operation: 'julia',
          c: { real: cReal, imaginary: cImag },
          z0: { real: zReal, imaginary: zImag },
          iterations_to_escape: iter,
          in_set: iter === maxIter,
          interesting_c_values: [
            { c: [-0.7, 0.27015], name: 'Douady rabbit' },
            { c: [-0.8, 0.156], name: 'Dendrite' },
            { c: [-0.4, 0.6], name: 'San Marco fractal' },
            { c: [0.285, 0.01], name: 'Spiral' },
          ],
        };
        break;
      }

      case 'sensitivity': {
        const r = args.r ?? 3.9;
        const x0 = args.x0 ?? 0.5;
        const perturbation = args.perturbation ?? 1e-10;
        const steps = args.steps ?? 50;

        const trajectory1 = iterateLogistic(x0, r, steps);
        const trajectory2 = iterateLogistic(x0 + perturbation, r, steps);

        const divergence = trajectory1.map((v1, i) => ({
          iteration: i,
          x1: parseFloat(v1.toFixed(10)),
          x2: parseFloat(trajectory2[i].toFixed(10)),
          difference: Math.abs(v1 - trajectory2[i]),
        }));

        // Find when divergence becomes significant
        const significantIdx = divergence.findIndex((d) => d.difference > 0.01);

        result = {
          operation: 'sensitivity',
          parameters: { r, x0, perturbation },
          message: 'Butterfly Effect Demonstration',
          initial_difference: perturbation,
          significant_divergence_at:
            significantIdx > 0 ? significantIdx : 'after ' + steps + ' iterations',
          divergence_sample: divergence.filter((_, i) => i % 5 === 0 || i < 10),
          interpretation: 'Tiny initial differences grow exponentially in chaotic systems',
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
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isChaosDynamicsAvailable(): boolean {
  return true;
}
