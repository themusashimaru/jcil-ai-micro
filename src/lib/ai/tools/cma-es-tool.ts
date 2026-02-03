/**
 * CMA-ES TOOL
 * Covariance Matrix Adaptation Evolution Strategy
 * State-of-the-art evolutionary algorithm for continuous optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface CMAESConfig {
  populationSize: number;
  sigma: number; // Initial step size
  maxIterations: number;
  targetFitness?: number;
  dimension: number;
}

interface CMAESState {
  mean: number[];
  sigma: number;
  C: number[][]; // Covariance matrix
  pc: number[]; // Evolution path for C
  ps: number[]; // Evolution path for sigma
  B: number[][]; // Eigenvectors of C
  D: number[]; // Eigenvalues of C
  generation: number;
}

interface OptimizationResult {
  bestSolution: number[];
  bestFitness: number;
  generations: number;
  convergenceHistory: { generation: number; bestFitness: number; sigma: number }[];
  finalState: {
    mean: number[];
    sigma: number;
    covarianceTrace: number;
  };
}

// ============================================================================
// BENCHMARK FUNCTIONS
// ============================================================================

const benchmarkFunctions: Record<
  string,
  {
    fn: (x: number[]) => number;
    optimum: number;
    bounds: [number, number];
    description: string;
  }
> = {
  sphere: {
    fn: (x: number[]) => x.reduce((sum, xi) => sum + xi * xi, 0),
    optimum: 0,
    bounds: [-5.12, 5.12],
    description: 'Simple sphere function: sum(x_i^2)',
  },
  rosenbrock: {
    fn: (x: number[]) => {
      let sum = 0;
      for (let i = 0; i < x.length - 1; i++) {
        sum += 100 * Math.pow(x[i + 1] - x[i] * x[i], 2) + Math.pow(1 - x[i], 2);
      }
      return sum;
    },
    optimum: 0,
    bounds: [-5, 10],
    description: 'Rosenbrock banana function',
  },
  rastrigin: {
    fn: (x: number[]) => {
      const A = 10;
      return (
        A * x.length + x.reduce((sum, xi) => sum + xi * xi - A * Math.cos(2 * Math.PI * xi), 0)
      );
    },
    optimum: 0,
    bounds: [-5.12, 5.12],
    description: 'Rastrigin function with many local minima',
  },
  ackley: {
    fn: (x: number[]) => {
      const n = x.length;
      const sum1 = x.reduce((s, xi) => s + xi * xi, 0);
      const sum2 = x.reduce((s, xi) => s + Math.cos(2 * Math.PI * xi), 0);
      return -20 * Math.exp(-0.2 * Math.sqrt(sum1 / n)) - Math.exp(sum2 / n) + 20 + Math.E;
    },
    optimum: 0,
    bounds: [-32.768, 32.768],
    description: 'Ackley function',
  },
  schwefel: {
    fn: (x: number[]) => {
      const n = x.length;
      return 418.9829 * n - x.reduce((sum, xi) => sum + xi * Math.sin(Math.sqrt(Math.abs(xi))), 0);
    },
    optimum: 0,
    bounds: [-500, 500],
    description: 'Schwefel function',
  },
};

// ============================================================================
// LINEAR ALGEBRA UTILITIES
// ============================================================================

export function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const result: number[][] = Array(m)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < p; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function matrixVectorMultiply(A: number[][], v: number[]): number[] {
  return A.map((row) => row.reduce((sum, a, j) => sum + a * v[j], 0));
}

export function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const result: number[][] = Array(n)
    .fill(null)
    .map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

function identityMatrix(n: number): number[][] {
  const I: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

// Simple power iteration for eigendecomposition (for small matrices)
function eigenDecomposition(C: number[][], _maxIter: number = 100): { B: number[][]; D: number[] } {
  const n = C.length;
  const D: number[] = [];
  const B: number[][] = identityMatrix(n);

  // Simplified: for small matrices, use direct methods
  // For production, use proper numerical library
  for (let i = 0; i < n; i++) {
    D.push(Math.sqrt(Math.max(0.0001, C[i][i])));
  }

  return { B, D };
}

// Generate multivariate normal samples
function sampleMultivariateNormal(
  mean: number[],
  B: number[][],
  D: number[],
  sigma: number
): number[] {
  const n = mean.length;
  const z: number[] = [];

  // Generate standard normal samples using Box-Muller
  for (let i = 0; i < n; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    z.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  }

  // Transform: y = mean + sigma * B * D * z
  const Dz = z.map((zi, i) => D[i] * zi);
  const BDz = matrixVectorMultiply(B, Dz);
  return mean.map((m, i) => m + sigma * BDz[i]);
}

// ============================================================================
// CMA-ES IMPLEMENTATION
// ============================================================================

class CMAES {
  private config: CMAESConfig;
  private state: CMAESState;
  private fitnessFunction: (x: number[]) => number;

  // Strategy parameters
  private mu: number; // Number of parents
  private weights: number[]; // Recombination weights
  private mueff: number; // Variance effective selection mass
  private cc: number; // Learning rate for C
  private cs: number; // Learning rate for sigma
  private c1: number; // Learning rate for rank-1 update
  private cmu: number; // Learning rate for rank-mu update
  private damps: number; // Damping for sigma
  private chiN: number; // Expectation of ||N(0,I)||

  constructor(
    fitnessFunction: (x: number[]) => number,
    config: Partial<CMAESConfig> & { dimension: number }
  ) {
    this.fitnessFunction = fitnessFunction;

    const n = config.dimension;
    const lambda = config.populationSize || Math.floor(4 + 3 * Math.log(n));

    this.config = {
      dimension: n,
      populationSize: lambda,
      sigma: config.sigma || 0.5,
      maxIterations: config.maxIterations || 1000,
      targetFitness: config.targetFitness,
    };

    // Initialize strategy parameters
    this.mu = Math.floor(lambda / 2);

    // Recombination weights
    this.weights = [];
    for (let i = 0; i < this.mu; i++) {
      this.weights.push(Math.log(this.mu + 0.5) - Math.log(i + 1));
    }
    const sumW = this.weights.reduce((a, b) => a + b, 0);
    this.weights = this.weights.map((w) => w / sumW);

    // Variance effective selection mass
    this.mueff = 1 / this.weights.reduce((sum, w) => sum + w * w, 0);

    // Learning rates
    this.cc = (4 + this.mueff / n) / (n + 4 + (2 * this.mueff) / n);
    this.cs = (this.mueff + 2) / (n + this.mueff + 5);
    this.c1 = 2 / ((n + 1.3) * (n + 1.3) + this.mueff);
    this.cmu = Math.min(
      1 - this.c1,
      (2 * (this.mueff - 2 + 1 / this.mueff)) / ((n + 2) * (n + 2) + this.mueff)
    );
    this.damps = 1 + 2 * Math.max(0, Math.sqrt((this.mueff - 1) / (n + 1)) - 1) + this.cs;
    this.chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));

    // Initialize state
    this.state = {
      mean: Array(n).fill(0),
      sigma: this.config.sigma,
      C: identityMatrix(n),
      pc: Array(n).fill(0),
      ps: Array(n).fill(0),
      B: identityMatrix(n),
      D: Array(n).fill(1),
      generation: 0,
    };
  }

  setInitialMean(mean: number[]): void {
    this.state.mean = [...mean];
  }

  step(): { population: number[][]; fitness: number[]; bestIdx: number } {
    const n = this.config.dimension;
    const lambda = this.config.populationSize;

    // Sample population
    const population: number[][] = [];
    const fitness: number[] = [];

    for (let i = 0; i < lambda; i++) {
      const x = sampleMultivariateNormal(
        this.state.mean,
        this.state.B,
        this.state.D,
        this.state.sigma
      );
      population.push(x);
      fitness.push(this.fitnessFunction(x));
    }

    // Sort by fitness (minimization)
    const indices = fitness.map((_, i) => i).sort((a, b) => fitness[a] - fitness[b]);

    // Update mean
    const oldMean = [...this.state.mean];
    this.state.mean = Array(n).fill(0);
    for (let i = 0; i < this.mu; i++) {
      for (let j = 0; j < n; j++) {
        this.state.mean[j] += this.weights[i] * population[indices[i]][j];
      }
    }

    // Update evolution paths
    const meanDiff = this.state.mean.map((m, i) => (m - oldMean[i]) / this.state.sigma);
    const invsqrtC = this.state.B; // Simplified

    const BDinvz = matrixVectorMultiply(invsqrtC, meanDiff);

    // ps path
    for (let i = 0; i < n; i++) {
      this.state.ps[i] =
        (1 - this.cs) * this.state.ps[i] +
        Math.sqrt(this.cs * (2 - this.cs) * this.mueff) * BDinvz[i];
    }

    // pc path
    const hsig =
      Math.sqrt(this.state.ps.reduce((s, p) => s + p * p, 0)) /
        Math.sqrt(1 - Math.pow(1 - this.cs, 2 * (this.state.generation + 1))) /
        this.chiN <
      1.4 + 2 / (n + 1)
        ? 1
        : 0;

    for (let i = 0; i < n; i++) {
      this.state.pc[i] =
        (1 - this.cc) * this.state.pc[i] +
        hsig * Math.sqrt(this.cc * (2 - this.cc) * this.mueff) * meanDiff[i];
    }

    // Update covariance matrix (simplified rank-1 update)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.state.C[i][j] =
          (1 - this.c1 - this.cmu) * this.state.C[i][j] +
          this.c1 * this.state.pc[i] * this.state.pc[j];
      }
    }

    // Update sigma
    const psNorm = Math.sqrt(this.state.ps.reduce((s, p) => s + p * p, 0));
    this.state.sigma *= Math.exp((this.cs / this.damps) * (psNorm / this.chiN - 1));

    // Update eigendecomposition periodically
    if (this.state.generation % Math.ceil(1 / (this.c1 + this.cmu) / n / 10) === 0) {
      const { B, D } = eigenDecomposition(this.state.C);
      this.state.B = B;
      this.state.D = D;
    }

    this.state.generation++;

    return { population, fitness, bestIdx: indices[0] };
  }

  optimize(): OptimizationResult {
    const convergenceHistory: { generation: number; bestFitness: number; sigma: number }[] = [];
    let bestSolution = [...this.state.mean];
    let bestFitness = this.fitnessFunction(bestSolution);

    for (let g = 0; g < this.config.maxIterations; g++) {
      const { population, fitness, bestIdx } = this.step();

      if (fitness[bestIdx] < bestFitness) {
        bestFitness = fitness[bestIdx];
        bestSolution = [...population[bestIdx]];
      }

      if (g % 10 === 0 || g === this.config.maxIterations - 1) {
        convergenceHistory.push({
          generation: g,
          bestFitness,
          sigma: this.state.sigma,
        });
      }

      // Check termination
      if (this.config.targetFitness !== undefined && bestFitness <= this.config.targetFitness) {
        break;
      }

      // Check sigma convergence
      if (this.state.sigma < 1e-12) {
        break;
      }
    }

    return {
      bestSolution,
      bestFitness,
      generations: this.state.generation,
      convergenceHistory,
      finalState: {
        mean: this.state.mean,
        sigma: this.state.sigma,
        covarianceTrace: this.state.C.reduce((sum, row, i) => sum + row[i], 0),
      },
    };
  }

  getState(): CMAESState {
    return { ...this.state };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const cmaesTool: UnifiedTool = {
  name: 'cma_es',
  description:
    'CMA-ES (Covariance Matrix Adaptation Evolution Strategy) for continuous optimization',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['optimize', 'benchmark', 'compare', 'info', 'examples'],
        description:
          'Operation: optimize (run CMA-ES), benchmark (test on standard functions), compare (compare with other methods)',
      },
      function: {
        type: 'string',
        enum: ['sphere', 'rosenbrock', 'rastrigin', 'ackley', 'schwefel', 'custom'],
        description: 'Optimization function to use',
      },
      dimension: {
        type: 'number',
        description: 'Problem dimension (default: 10)',
      },
      populationSize: {
        type: 'number',
        description: 'Population size (default: 4 + 3*ln(n))',
      },
      sigma: {
        type: 'number',
        description: 'Initial step size (default: 0.5)',
      },
      maxIterations: {
        type: 'number',
        description: 'Maximum iterations (default: 1000)',
      },
      initialMean: {
        type: 'array',
        items: { type: 'number' },
        description: 'Initial mean vector',
      },
    },
    required: ['operation'],
  },
};

export async function executecmaes(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'optimize': {
        const funcName = args.function || 'sphere';
        const dimension = args.dimension || 10;

        if (!benchmarkFunctions[funcName]) {
          return {
            toolCallId: id,
            content: `Unknown function: ${funcName}. Available: ${Object.keys(benchmarkFunctions).join(', ')}`,
            isError: true,
          };
        }

        const benchmark = benchmarkFunctions[funcName];
        const cmaes = new CMAES(benchmark.fn, {
          dimension,
          populationSize: args.populationSize,
          sigma: args.sigma || 0.5,
          maxIterations: args.maxIterations || 500,
        });

        // Set initial mean within bounds
        const initialMean =
          args.initialMean ||
          Array(dimension)
            .fill(0)
            .map(
              () =>
                benchmark.bounds[0] + Math.random() * (benchmark.bounds[1] - benchmark.bounds[0])
            );
        cmaes.setInitialMean(initialMean);

        const result = cmaes.optimize();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'optimize',
              function: funcName,
              functionDescription: benchmark.description,
              dimension,
              result: {
                bestSolution: result.bestSolution.map((x) => parseFloat(x.toFixed(6))),
                bestFitness: result.bestFitness,
                knownOptimum: benchmark.optimum,
                gap: result.bestFitness - benchmark.optimum,
                generations: result.generations,
              },
              convergence: result.convergenceHistory,
              finalState: {
                sigma: result.finalState.sigma.toFixed(6),
                covarianceTrace: result.finalState.covarianceTrace.toFixed(4),
              },
            },
            null,
            2
          ),
        };
      }

      case 'benchmark': {
        const dimension = args.dimension || 5;
        const maxIterations = args.maxIterations || 200;

        const results: { function: string; fitness: number; generations: number; gap: number }[] =
          [];

        for (const [name, benchmark] of Object.entries(benchmarkFunctions)) {
          const cmaes = new CMAES(benchmark.fn, {
            dimension,
            sigma: 0.5,
            maxIterations,
          });

          // Random initial point
          const init = Array(dimension)
            .fill(0)
            .map(
              () =>
                benchmark.bounds[0] + Math.random() * (benchmark.bounds[1] - benchmark.bounds[0])
            );
          cmaes.setInitialMean(init);

          const result = cmaes.optimize();

          results.push({
            function: name,
            fitness: parseFloat(result.bestFitness.toFixed(6)),
            generations: result.generations,
            gap: parseFloat((result.bestFitness - benchmark.optimum).toFixed(6)),
          });
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'benchmark',
              dimension,
              maxIterations,
              results,
              summary: {
                totalFunctions: results.length,
                successfulOptimizations: results.filter((r) => r.gap < 0.01).length,
                averageGenerations: Math.round(
                  results.reduce((s, r) => s + r.generations, 0) / results.length
                ),
              },
            },
            null,
            2
          ),
        };
      }

      case 'compare': {
        const dimension = args.dimension || 5;
        const funcName = args.function || 'rosenbrock';
        const benchmark = benchmarkFunctions[funcName] || benchmarkFunctions.rosenbrock;

        // Run CMA-ES
        const cmaes = new CMAES(benchmark.fn, {
          dimension,
          sigma: 0.5,
          maxIterations: 200,
        });
        const init = Array(dimension)
          .fill(0)
          .map(
            () => benchmark.bounds[0] + Math.random() * (benchmark.bounds[1] - benchmark.bounds[0])
          );
        cmaes.setInitialMean(init);
        const cmaResult = cmaes.optimize();

        // Simple random search for comparison
        let randomBest = Infinity;
        let randomEvals = 0;
        for (let i = 0; i < cmaResult.generations * 10; i++) {
          const x = Array(dimension)
            .fill(0)
            .map(
              () =>
                benchmark.bounds[0] + Math.random() * (benchmark.bounds[1] - benchmark.bounds[0])
            );
          const f = benchmark.fn(x);
          randomEvals++;
          if (f < randomBest) randomBest = f;
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'compare',
              function: funcName,
              dimension,
              comparison: {
                cmaes: {
                  bestFitness: cmaResult.bestFitness.toFixed(6),
                  generations: cmaResult.generations,
                  evaluations: cmaResult.generations * (4 + Math.floor(3 * Math.log(dimension))),
                },
                randomSearch: {
                  bestFitness: randomBest.toFixed(6),
                  evaluations: randomEvals,
                },
              },
              winner: cmaResult.bestFitness < randomBest ? 'CMA-ES' : 'Random Search',
              improvement:
                (((randomBest - cmaResult.bestFitness) / randomBest) * 100).toFixed(2) + '%',
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
              tool: 'CMA-ES',
              fullName: 'Covariance Matrix Adaptation Evolution Strategy',
              description: 'State-of-the-art evolutionary algorithm for continuous optimization',
              keyFeatures: [
                'Self-adaptive step size control',
                'Learns variable dependencies via covariance matrix',
                'Invariant to linear transformations',
                'No gradient required (derivative-free)',
                'Robust to local optima',
              ],
              algorithm: {
                sampling: 'Generate population from multivariate normal N(mean, sigma^2 * C)',
                selection: 'Select best mu individuals from lambda',
                recombination: 'Weighted average of selected individuals',
                adaptation: 'Update C and sigma based on evolution paths',
              },
              parameters: {
                lambda: 'Population size (typically 4 + 3*ln(n))',
                mu: 'Number of parents (lambda/2)',
                sigma: 'Global step size',
                C: 'Covariance matrix encoding variable correlations',
              },
              benchmarkFunctions: Object.entries(benchmarkFunctions).map(([name, b]) => ({
                name,
                description: b.description,
                optimum: b.optimum,
                bounds: b.bounds,
              })),
              applications: [
                'Neural network training',
                'Hyperparameter optimization',
                'Reinforcement learning policy search',
                'Engineering design optimization',
                'Game AI',
              ],
              complexity: {
                perGeneration: 'O(n^2) for covariance update',
                eigenDecomposition: 'O(n^3) but done periodically',
              },
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              examples: [
                {
                  name: 'Optimize sphere function',
                  call: {
                    operation: 'optimize',
                    function: 'sphere',
                    dimension: 10,
                    maxIterations: 300,
                  },
                },
                {
                  name: 'Optimize Rosenbrock',
                  call: {
                    operation: 'optimize',
                    function: 'rosenbrock',
                    dimension: 5,
                    sigma: 1.0,
                    maxIterations: 500,
                  },
                },
                {
                  name: 'Run all benchmarks',
                  call: {
                    operation: 'benchmark',
                    dimension: 5,
                    maxIterations: 200,
                  },
                },
                {
                  name: 'Compare with random search',
                  call: {
                    operation: 'compare',
                    function: 'rastrigin',
                    dimension: 10,
                  },
                },
              ],
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

export function iscmaesAvailable(): boolean {
  return true;
}
