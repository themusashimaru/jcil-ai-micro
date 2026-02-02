/**
 * CHAOS-THEORY TOOL
 * Chaos theory, dynamical systems, and nonlinear dynamics
 * Lorenz, Rössler, logistic map, Lyapunov exponents, bifurcation diagrams
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const chaostheoryTool: UnifiedTool = {
  name: 'chaos_theory',
  description: `Chaos theory and dynamical systems analysis.

Operations:
- info: Chaos theory overview
- lorenz: Lorenz attractor simulation
- rossler: Rössler attractor simulation
- logistic: Logistic map iteration
- henon: Hénon map
- lyapunov: Calculate Lyapunov exponent
- bifurcation: Generate bifurcation diagram data
- sensitivity: Demonstrate sensitive dependence
- strange_attractor: Strange attractor properties
- mandelbrot: Mandelbrot set analysis

Parameters:
- operation: The operation to perform
- system: Chaotic system to analyze
- r: Parameter r for logistic map
- sigma, rho, beta: Lorenz parameters
- a, b, c: Rössler parameters
- initial_conditions: Starting point [x, y, z]
- iterations: Number of iterations`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'lorenz', 'rossler', 'logistic', 'henon', 'lyapunov', 'bifurcation', 'sensitivity', 'strange_attractor', 'mandelbrot'],
        description: 'Operation to perform'
      },
      system: {
        type: 'string',
        enum: ['lorenz', 'rossler', 'logistic_map', 'henon', 'tent_map'],
        description: 'Chaotic system'
      },
      r: { type: 'number', description: 'Control parameter' },
      sigma: { type: 'number', description: 'Lorenz sigma' },
      rho: { type: 'number', description: 'Lorenz rho' },
      beta: { type: 'number', description: 'Lorenz beta' },
      iterations: { type: 'number', description: 'Number of iterations' },
      x0: { type: 'number', description: 'Initial x value' }
    },
    required: ['operation']
  }
};

// ============================================================================
// CHAOTIC SYSTEMS
// ============================================================================

/**
 * Lorenz system derivatives
 * dx/dt = σ(y - x)
 * dy/dt = x(ρ - z) - y
 * dz/dt = xy - βz
 */
function lorenzDerivatives(x: number, y: number, z: number,
                           sigma: number, rho: number, beta: number): [number, number, number] {
  const dx = sigma * (y - x);
  const dy = x * (rho - z) - y;
  const dz = x * y - beta * z;
  return [dx, dy, dz];
}

/**
 * Rössler system derivatives
 * dx/dt = -y - z
 * dy/dt = x + ay
 * dz/dt = b + z(x - c)
 */
function rosslerDerivatives(x: number, y: number, z: number,
                            a: number, b: number, c: number): [number, number, number] {
  const dx = -y - z;
  const dy = x + a * y;
  const dz = b + z * (x - c);
  return [dx, dy, dz];
}

/**
 * 4th-order Runge-Kutta for 3D system
 */
function rk4_3d(
  x: number, y: number, z: number,
  derivatives: (x: number, y: number, z: number) => [number, number, number],
  dt: number
): [number, number, number] {
  const [k1x, k1y, k1z] = derivatives(x, y, z);
  const [k2x, k2y, k2z] = derivatives(x + 0.5 * dt * k1x, y + 0.5 * dt * k1y, z + 0.5 * dt * k1z);
  const [k3x, k3y, k3z] = derivatives(x + 0.5 * dt * k2x, y + 0.5 * dt * k2y, z + 0.5 * dt * k2z);
  const [k4x, k4y, k4z] = derivatives(x + dt * k3x, y + dt * k3y, z + dt * k3z);

  const newX = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
  const newY = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
  const newZ = z + (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);

  return [newX, newY, newZ];
}

/**
 * Simulate Lorenz system
 */
function simulateLorenz(
  x0: number, y0: number, z0: number,
  sigma: number, rho: number, beta: number,
  tMax: number, dt: number
): Array<{ t: number; x: number; y: number; z: number }> {
  const results: Array<{ t: number; x: number; y: number; z: number }> = [];
  let x = x0, y = y0, z = z0;
  let t = 0;

  while (t < tMax) {
    results.push({ t, x, y, z });
    const derivatives = (xx: number, yy: number, zz: number) =>
      lorenzDerivatives(xx, yy, zz, sigma, rho, beta);
    [x, y, z] = rk4_3d(x, y, z, derivatives, dt);
    t += dt;
  }

  return results;
}

/**
 * Simulate Rössler system
 */
function simulateRossler(
  x0: number, y0: number, z0: number,
  a: number, b: number, c: number,
  tMax: number, dt: number
): Array<{ t: number; x: number; y: number; z: number }> {
  const results: Array<{ t: number; x: number; y: number; z: number }> = [];
  let x = x0, y = y0, z = z0;
  let t = 0;

  while (t < tMax) {
    results.push({ t, x, y, z });
    const derivatives = (xx: number, yy: number, zz: number) =>
      rosslerDerivatives(xx, yy, zz, a, b, c);
    [x, y, z] = rk4_3d(x, y, z, derivatives, dt);
    t += dt;
  }

  return results;
}

/**
 * Logistic map iteration
 * x_{n+1} = r * x_n * (1 - x_n)
 */
function logisticMap(x: number, r: number): number {
  return r * x * (1 - x);
}

/**
 * Iterate logistic map
 */
function iterateLogistic(x0: number, r: number, iterations: number): number[] {
  const results: number[] = [x0];
  let x = x0;
  for (let i = 0; i < iterations; i++) {
    x = logisticMap(x, r);
    results.push(x);
  }
  return results;
}

/**
 * Hénon map
 * x_{n+1} = 1 - ax_n² + y_n
 * y_{n+1} = bx_n
 */
function henonMap(x: number, y: number, a: number, b: number): [number, number] {
  const newX = 1 - a * x * x + y;
  const newY = b * x;
  return [newX, newY];
}

/**
 * Lyapunov exponent for logistic map
 * λ = lim (1/n) Σ log|f'(x_i)|
 */
function lyapunovLogistic(r: number, x0: number, iterations: number, transient: number = 1000): number {
  let x = x0;

  // Skip transient
  for (let i = 0; i < transient; i++) {
    x = logisticMap(x, r);
  }

  // Calculate Lyapunov exponent
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    // Derivative: d/dx[rx(1-x)] = r(1-2x)
    const derivative = Math.abs(r * (1 - 2 * x));
    if (derivative > 0) {
      sum += Math.log(derivative);
    }
    x = logisticMap(x, r);
  }

  return sum / iterations;
}

/**
 * Bifurcation diagram data for logistic map
 */
function bifurcationData(rMin: number, rMax: number, rSteps: number,
                         transient: number, samples: number): Array<{ r: number; x: number }> {
  const data: Array<{ r: number; x: number }> = [];
  const dr = (rMax - rMin) / rSteps;

  for (let r = rMin; r <= rMax; r += dr) {
    let x = 0.5;

    // Skip transient
    for (let i = 0; i < transient; i++) {
      x = logisticMap(x, r);
    }

    // Collect samples
    for (let i = 0; i < samples; i++) {
      x = logisticMap(x, r);
      data.push({ r, x });
    }
  }

  return data;
}

/**
 * Feigenbaum constant calculation
 */
function feigenbaumDelta(bifurcationPoints: number[]): number[] {
  const deltas: number[] = [];
  for (let i = 0; i < bifurcationPoints.length - 2; i++) {
    const delta = (bifurcationPoints[i + 1] - bifurcationPoints[i]) /
                  (bifurcationPoints[i + 2] - bifurcationPoints[i + 1]);
    deltas.push(delta);
  }
  return deltas;
}

export async function executechaostheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'Chaos Theory',
          description: 'Nonlinear dynamics and deterministic chaos',

          keyConceptsl: {
            sensitivityDependence: 'Small changes in initial conditions lead to vastly different outcomes (butterfly effect)',
            strangeAttractors: 'Fractal geometric structures in phase space',
            lyapunovExponents: 'Measure rate of separation of trajectories',
            bifurcations: 'Qualitative changes in dynamics as parameters vary'
          },

          classicSystems: {
            lorenz: {
              equations: ['dx/dt = σ(y-x)', 'dy/dt = x(ρ-z)-y', 'dz/dt = xy-βz'],
              parameters: 'σ=10, ρ=28, β=8/3',
              behavior: 'Strange attractor with butterfly shape'
            },
            rossler: {
              equations: ['dx/dt = -y-z', 'dy/dt = x+ay', 'dz/dt = b+z(x-c)'],
              parameters: 'a=0.2, b=0.2, c=5.7',
              behavior: 'Band-like strange attractor'
            },
            logisticMap: {
              equation: 'x_{n+1} = rx_n(1-x_n)',
              parameterRange: 'r ∈ [0, 4]',
              behavior: 'Period-doubling route to chaos'
            },
            henonMap: {
              equations: ['x_{n+1} = 1-ax²+y', 'y_{n+1} = bx'],
              parameters: 'a=1.4, b=0.3',
              behavior: 'Fractal strange attractor'
            }
          },

          feigenbaumConstants: {
            delta: '4.669201609... (ratio of bifurcation intervals)',
            alpha: '2.502907875... (ratio of widths)',
            universality: 'Same constants for all unimodal maps'
          },

          usage: 'Use operation: lorenz, rossler, logistic, henon, lyapunov, bifurcation, sensitivity'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'lorenz': {
        const sigma = args.sigma || 10;
        const rho = args.rho || 28;
        const beta = args.beta || 8 / 3;
        const x0 = args.x0 || 1;
        const y0 = args.y0 || 1;
        const z0 = args.z0 || 1;
        const tMax = args.t_max || 50;

        const trajectory = simulateLorenz(x0, y0, z0, sigma, rho, beta, tMax, 0.01);

        // Sample trajectory
        const samples = trajectory.filter((_, i) => i % 100 === 0);

        // Find attractor bounds
        const xVals = trajectory.map(p => p.x);
        const yVals = trajectory.map(p => p.y);
        const zVals = trajectory.map(p => p.z);

        const result = {
          operation: 'lorenz',
          system: 'Lorenz Attractor',

          parameters: {
            sigma: sigma,
            rho: rho,
            beta: beta.toFixed(4),
            initialConditions: [x0, y0, z0]
          },

          equations: {
            'dx/dt': `${sigma}(y - x)`,
            'dy/dt': `x(${rho} - z) - y`,
            'dz/dt': `xy - ${beta.toFixed(2)}z`
          },

          attractorBounds: {
            x: [Math.min(...xVals).toFixed(2), Math.max(...xVals).toFixed(2)],
            y: [Math.min(...yVals).toFixed(2), Math.max(...yVals).toFixed(2)],
            z: [Math.min(...zVals).toFixed(2), Math.max(...zVals).toFixed(2)]
          },

          trajectory: samples.slice(0, 20).map(p => ({
            t: p.t.toFixed(2),
            x: p.x.toFixed(4),
            y: p.y.toFixed(4),
            z: p.z.toFixed(4)
          })),

          history: {
            discoverer: 'Edward Lorenz (1963)',
            context: 'Simplified atmospheric convection model',
            significance: 'Birth of modern chaos theory'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'rossler': {
        const a = args.a || 0.2;
        const b = args.b || 0.2;
        const c = args.c || 5.7;
        const x0 = args.x0 || 0.1;
        const y0 = args.y0 || 0.1;
        const z0 = args.z0 || 0.1;
        const tMax = args.t_max || 100;

        const trajectory = simulateRossler(x0, y0, z0, a, b, c, tMax, 0.01);
        const samples = trajectory.filter((_, i) => i % 100 === 0);

        const result = {
          operation: 'rossler',
          system: 'Rössler Attractor',

          parameters: {
            a, b, c,
            initialConditions: [x0, y0, z0]
          },

          equations: {
            'dx/dt': '-y - z',
            'dy/dt': `x + ${a}y`,
            'dz/dt': `${b} + z(x - ${c})`
          },

          trajectory: samples.slice(0, 20).map(p => ({
            t: p.t.toFixed(2),
            x: p.x.toFixed(4),
            y: p.y.toFixed(4),
            z: p.z.toFixed(4)
          })),

          properties: {
            structure: 'Outward spiraling with sharp folds',
            dimension: '~2.01 (correlation dimension)',
            lyapunovExponents: '(+0.07, 0, -5.4) typical'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'logistic': {
        const r = args.r || 3.8;
        const x0 = args.x0 || 0.5;
        const iterations = args.iterations || 100;

        const orbit = iterateLogistic(x0, r, iterations);
        const lyap = lyapunovLogistic(r, x0, 10000);

        // Determine behavior
        let behavior: string;
        if (r < 1) behavior = 'Fixed point at 0';
        else if (r < 3) behavior = 'Fixed point at (r-1)/r';
        else if (r < 3.449) behavior = 'Period-2 cycle';
        else if (r < 3.544) behavior = 'Period-4 cycle';
        else if (r < 3.5699) behavior = 'Higher period cycles';
        else if (r < 4) behavior = 'Chaotic (with periodic windows)';
        else behavior = 'Fully chaotic / divergent';

        const result = {
          operation: 'logistic',
          system: 'Logistic Map',

          parameters: {
            r: r,
            x0: x0,
            iterations: iterations
          },

          equation: `x_{n+1} = ${r} × x_n × (1 - x_n)`,

          analysis: {
            behavior: behavior,
            lyapunovExponent: lyap.toFixed(4),
            chaotic: lyap > 0 ? 'Yes (positive Lyapunov)' : 'No'
          },

          orbit: {
            first20: orbit.slice(0, 20).map((x, i) => ({ n: i, x: x.toFixed(6) })),
            last10: orbit.slice(-10).map((x, i) => ({ n: iterations - 10 + i, x: x.toFixed(6) }))
          },

          bifurcationPoints: {
            'r = 1': 'Stable fixed point appears',
            'r = 3': 'First period-doubling',
            'r ≈ 3.449': 'Period-4',
            'r ≈ 3.570': 'Onset of chaos',
            'r ≈ 3.828': 'Period-3 window',
            'r = 4': 'Fully chaotic'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'henon': {
        const a = args.a || 1.4;
        const b = args.b || 0.3;
        const x0 = args.x0 || 0;
        const y0 = args.y0 || 0;
        const iterations = args.iterations || 10000;

        const points: Array<{ x: number; y: number }> = [];
        let x = x0, y = y0;

        for (let i = 0; i < iterations; i++) {
          [x, y] = henonMap(x, y, a, b);
          if (i > 100) { // Skip transient
            points.push({ x, y });
          }
        }

        const result = {
          operation: 'henon',
          system: 'Hénon Map',

          parameters: { a, b, x0, y0, iterations },

          equations: {
            'x_{n+1}': `1 - ${a}x²_n + y_n`,
            'y_{n+1}': `${b}x_n`
          },

          attractorSample: points.slice(0, 50).map(p => ({
            x: p.x.toFixed(6),
            y: p.y.toFixed(6)
          })),

          properties: {
            fractalDimension: '~1.26',
            lyapunovExponents: '(+0.42, -1.62) for standard parameters',
            jacobianDeterminant: `${b} (area contraction)`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'lyapunov': {
        const system = args.system || 'logistic_map';
        const r = args.r || 3.8;

        // Calculate Lyapunov for range of r values
        const lyapunovSpectrum: Array<{ r: number; lambda: number }> = [];

        for (let rVal = 2.5; rVal <= 4.0; rVal += 0.05) {
          const lambda = lyapunovLogistic(rVal, 0.5, 5000);
          lyapunovSpectrum.push({ r: rVal, lambda });
        }

        const specificLambda = lyapunovLogistic(r, 0.5, 10000);

        const result = {
          operation: 'lyapunov',
          system: system,

          definition: {
            formula: 'λ = lim(n→∞) (1/n) Σ log|f\'(x_i)|',
            interpretation: {
              'λ > 0': 'Chaotic (exponential divergence)',
              'λ = 0': 'Edge of chaos / periodic',
              'λ < 0': 'Stable periodic orbit'
            }
          },

          specificValue: {
            r: r,
            lyapunovExponent: specificLambda.toFixed(6),
            chaotic: specificLambda > 0
          },

          spectrum: lyapunovSpectrum.map(p => ({
            r: p.r.toFixed(2),
            lambda: p.lambda.toFixed(4),
            behavior: p.lambda > 0 ? 'chaotic' : p.lambda < -0.1 ? 'stable' : 'periodic'
          })),

          keyValues: {
            'r = 3.0': `λ = ${lyapunovLogistic(3.0, 0.5, 5000).toFixed(4)} (stable period-2)`,
            'r = 3.5': `λ = ${lyapunovLogistic(3.5, 0.5, 5000).toFixed(4)}`,
            'r = 3.8': `λ = ${lyapunovLogistic(3.8, 0.5, 5000).toFixed(4)} (chaotic)`,
            'r = 4.0': `λ = ln(2) ≈ 0.693 (maximally chaotic)`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'bifurcation': {
        const rMin = args.r_min || 2.5;
        const rMax = args.r_max || 4.0;
        const rSteps = args.r_steps || 100;

        const data = bifurcationData(rMin, rMax, rSteps, 500, 50);

        // Group by r value for summary
        const summary: Array<{ r: number; attractorPoints: number[] }> = [];
        let currentR = -1;
        let currentPoints: number[] = [];

        for (const point of data) {
          if (Math.abs(point.r - currentR) > 0.001) {
            if (currentPoints.length > 0) {
              // Keep unique points
              const unique = [...new Set(currentPoints.map(x => x.toFixed(4)))].map(Number);
              summary.push({ r: currentR, attractorPoints: unique });
            }
            currentR = point.r;
            currentPoints = [];
          }
          currentPoints.push(point.x);
        }

        const result = {
          operation: 'bifurcation',
          system: 'Logistic Map Bifurcation Diagram',

          parameterRange: { rMin, rMax, rSteps },

          feigenbaumConstant: {
            delta: 4.669201609,
            description: 'Ratio of successive bifurcation intervals',
            universality: 'Same for all period-doubling routes to chaos'
          },

          bifurcationSummary: summary.slice(0, 30).map(s => ({
            r: s.r.toFixed(3),
            periodicity: s.attractorPoints.length,
            attractorPoints: s.attractorPoints.slice(0, 4).map(x => x.toFixed(4))
          })),

          keyBifurcations: {
            'r = 3': 'Period-1 → Period-2',
            'r ≈ 3.449': 'Period-2 → Period-4',
            'r ≈ 3.544': 'Period-4 → Period-8',
            'r ≈ 3.564': 'Period-8 → Period-16',
            'r ≈ 3.569': 'Accumulation point (chaos onset)'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'sensitivity': {
        const r = args.r || 3.9;
        const x0 = args.x0 || 0.5;
        const epsilon = args.epsilon || 1e-10;
        const iterations = args.iterations || 50;

        const orbit1 = iterateLogistic(x0, r, iterations);
        const orbit2 = iterateLogistic(x0 + epsilon, r, iterations);

        const divergence = orbit1.map((x, i) => ({
          n: i,
          x1: x.toFixed(8),
          x2: orbit2[i].toFixed(8),
          diff: Math.abs(x - orbit2[i]).toExponential(2)
        }));

        const result = {
          operation: 'sensitivity',
          title: 'Sensitive Dependence on Initial Conditions',

          parameters: {
            r: r,
            x0_1: x0,
            x0_2: x0 + epsilon,
            perturbation: epsilon.toExponential()
          },

          butterflyEffect: {
            description: 'Exponentially small differences grow exponentially fast',
            formula: 'd(t) ≈ d(0) × exp(λt)',
            implication: 'Long-term prediction impossible'
          },

          trajectoryComparison: divergence,

          doublingTime: {
            lyapunovExponent: lyapunovLogistic(r, x0, 5000).toFixed(4),
            approximateDoublingTime: `${(Math.log(2) / lyapunovLogistic(r, x0, 5000)).toFixed(2)} iterations`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'strange_attractor': {
        const result = {
          operation: 'strange_attractor',
          title: 'Strange Attractors',

          definition: {
            attractor: 'Set to which system trajectories converge',
            strange: 'Has fractal structure and positive Lyapunov exponent',
            properties: ['Fractal dimension', 'Self-similarity', 'Sensitive dependence']
          },

          examples: {
            lorenz: {
              dimension: '~2.06 (correlation dimension)',
              structure: 'Two-lobed butterfly',
              lyapunov: '(+0.9, 0, -14.6)'
            },
            rossler: {
              dimension: '~2.01',
              structure: 'Spiral with folds',
              lyapunov: '(+0.07, 0, -5.4)'
            },
            henon: {
              dimension: '~1.26',
              structure: 'Bent fractal',
              lyapunov: '(+0.42, -1.62)'
            }
          },

          fractalDimensions: {
            boxCounting: 'D_0 = lim log(N(ε))/log(1/ε)',
            information: 'D_1 = lim Σp_i log p_i / log ε',
            correlation: 'D_2 from correlation sum'
          },

          chaosVsRandomness: {
            chaos: 'Deterministic but unpredictable',
            random: 'Fundamentally unpredictable',
            distinction: 'Chaos has underlying structure (attractor)'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'mandelbrot': {
        const maxIter = args.iterations || 100;

        // Sample some interesting points
        const testPoints = [
          { c_re: 0, c_im: 0, name: 'origin' },
          { c_re: -0.5, c_im: 0, name: 'main cardioid' },
          { c_re: -1, c_im: 0, name: 'period-2 bulb' },
          { c_re: -0.12, c_im: 0.75, name: 'near edge' },
          { c_re: 0.3, c_im: 0.5, name: 'outside set' }
        ];

        const results = testPoints.map(pt => {
          let z_re = 0, z_im = 0;
          let iter = 0;
          while (z_re * z_re + z_im * z_im <= 4 && iter < maxIter) {
            const temp = z_re * z_re - z_im * z_im + pt.c_re;
            z_im = 2 * z_re * z_im + pt.c_im;
            z_re = temp;
            iter++;
          }
          return {
            c: `${pt.c_re} + ${pt.c_im}i`,
            name: pt.name,
            inSet: iter === maxIter,
            escapeTime: iter < maxIter ? iter : 'never'
          };
        });

        const result = {
          operation: 'mandelbrot',
          title: 'Mandelbrot Set',

          definition: {
            iteration: 'z_{n+1} = z_n² + c, starting with z_0 = 0',
            membershipCriterion: 'c ∈ M if iteration does not escape to infinity',
            escapeCondition: '|z| > 2 guarantees escape'
          },

          properties: {
            dimension: 2,
            boundaryDimension: 2,
            connected: true,
            area: '~1.5066 (numerically estimated)'
          },

          testPoints: results,

          connectionToChaos: {
            juliaSet: 'For each c, Julia set shows dynamics of z → z² + c',
            mandelbrotPoint: 'c in Mandelbrot ↔ connected Julia set',
            parameterSpace: 'Mandelbrot is map of Julia set topologies'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, lorenz, rossler, logistic, henon, lyapunov, bifurcation, sensitivity, strange_attractor, mandelbrot`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function ischaostheoryAvailable(): boolean { return true; }
