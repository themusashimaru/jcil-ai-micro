// ============================================================================
// GENETIC ALGORITHM TOOL - TIER INFINITY
// ============================================================================
// Evolutionary optimization: genetic algorithms, crossover, mutation,
// fitness functions, and population evolution.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Individual {
  genes: number[];
  fitness: number;
}

interface EvolutionResult {
  best_solution: number[];
  best_fitness: number;
  generations: number;
  final_population_size: number;
  convergence_history: { generation: number; best_fitness: number; avg_fitness: number }[];
}

// ============================================================================
// CORE GA FUNCTIONS
// ============================================================================

// Random number in range
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Initialize population
function initializePopulation(
  size: number,
  geneLength: number,
  geneMin: number,
  geneMax: number
): Individual[] {
  const population: Individual[] = [];
  for (let i = 0; i < size; i++) {
    const genes = Array(geneLength)
      .fill(0)
      .map(() => randomInRange(geneMin, geneMax));
    population.push({ genes, fitness: 0 });
  }
  return population;
}

// Fitness functions
type FitnessFunction = (genes: number[]) => number;

const FITNESS_FUNCTIONS: Record<string, FitnessFunction> = {
  // Sphere function: minimize sum of x_i^2
  sphere: (genes) => -genes.reduce((sum, g) => sum + g * g, 0),

  // Rastrigin function: global minimum at origin
  rastrigin: (genes) => {
    const A = 10;
    const n = genes.length;
    const sum = genes.reduce((s, x) => s + x * x - A * Math.cos(2 * Math.PI * x), 0);
    return -(A * n + sum);
  },

  // Rosenbrock function: global minimum at (1,1,...,1)
  rosenbrock: (genes) => {
    let sum = 0;
    for (let i = 0; i < genes.length - 1; i++) {
      sum += 100 * Math.pow(genes[i + 1] - genes[i] * genes[i], 2) + Math.pow(1 - genes[i], 2);
    }
    return -sum;
  },

  // Ackley function
  ackley: (genes) => {
    const n = genes.length;
    const sumSq = genes.reduce((s, x) => s + x * x, 0);
    const sumCos = genes.reduce((s, x) => s + Math.cos(2 * Math.PI * x), 0);
    const result = -20 * Math.exp(-0.2 * Math.sqrt(sumSq / n)) - Math.exp(sumCos / n) + 20 + Math.E;
    return -result;
  },

  // Custom sum (maximize sum of genes)
  maximize_sum: (genes) => genes.reduce((s, g) => s + g, 0),

  // Custom product
  maximize_product: (genes) => genes.reduce((p, g) => p * Math.abs(g), 1),

  // TSP-like (minimize path length for 2D points interpreted as x,y pairs)
  tsp_path: (genes) => {
    if (genes.length < 4 || genes.length % 2 !== 0) return 0;
    let dist = 0;
    for (let i = 0; i < genes.length - 2; i += 2) {
      const dx = genes[i + 2] - genes[i];
      const dy = genes[i + 3] - genes[i + 1];
      dist += Math.sqrt(dx * dx + dy * dy);
    }
    return -dist;
  },
};

// Tournament selection
function tournamentSelect(population: Individual[], tournamentSize: number): Individual {
  let best: Individual | null = null;
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (!best || population[idx].fitness > best.fitness) {
      best = population[idx];
    }
  }
  return best!;
}

// Single-point crossover
function singlePointCrossover(parent1: number[], parent2: number[]): [number[], number[]] {
  const point = Math.floor(Math.random() * (parent1.length - 1)) + 1;
  const child1 = [...parent1.slice(0, point), ...parent2.slice(point)];
  const child2 = [...parent2.slice(0, point), ...parent1.slice(point)];
  return [child1, child2];
}

// Two-point crossover
function twoPointCrossover(parent1: number[], parent2: number[]): [number[], number[]] {
  let point1 = Math.floor(Math.random() * parent1.length);
  let point2 = Math.floor(Math.random() * parent1.length);
  if (point1 > point2) [point1, point2] = [point2, point1];

  const child1 = [
    ...parent1.slice(0, point1),
    ...parent2.slice(point1, point2),
    ...parent1.slice(point2),
  ];
  const child2 = [
    ...parent2.slice(0, point1),
    ...parent1.slice(point1, point2),
    ...parent2.slice(point2),
  ];
  return [child1, child2];
}

// Uniform crossover
function uniformCrossover(parent1: number[], parent2: number[]): [number[], number[]] {
  const child1: number[] = [];
  const child2: number[] = [];
  for (let i = 0; i < parent1.length; i++) {
    if (Math.random() < 0.5) {
      child1.push(parent1[i]);
      child2.push(parent2[i]);
    } else {
      child1.push(parent2[i]);
      child2.push(parent1[i]);
    }
  }
  return [child1, child2];
}

// Blend crossover (BLX-alpha)
function blendCrossover(
  parent1: number[],
  parent2: number[],
  alpha: number = 0.5
): [number[], number[]] {
  const child1: number[] = [];
  const child2: number[] = [];
  for (let i = 0; i < parent1.length; i++) {
    const min = Math.min(parent1[i], parent2[i]);
    const max = Math.max(parent1[i], parent2[i]);
    const range = max - min;
    const low = min - alpha * range;
    const high = max + alpha * range;
    child1.push(randomInRange(low, high));
    child2.push(randomInRange(low, high));
  }
  return [child1, child2];
}

// Gaussian mutation
function gaussianMutation(genes: number[], mutationRate: number, sigma: number): number[] {
  return genes.map((g) => {
    if (Math.random() < mutationRate) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return g + sigma * z;
    }
    return g;
  });
}

// Uniform mutation
function uniformMutation(
  genes: number[],
  mutationRate: number,
  geneMin: number,
  geneMax: number
): number[] {
  return genes.map((g) => {
    if (Math.random() < mutationRate) {
      return randomInRange(geneMin, geneMax);
    }
    return g;
  });
}

// Elitism: keep best individuals
function elitism(population: Individual[], count: number): Individual[] {
  return [...population].sort((a, b) => b.fitness - a.fitness).slice(0, count);
}

// Main evolution loop
function evolve(
  fitnessFunc: FitnessFunction,
  geneLength: number,
  populationSize: number,
  generations: number,
  geneMin: number,
  geneMax: number,
  mutationRate: number,
  crossoverRate: number,
  elitismCount: number,
  tournamentSize: number,
  crossoverType: 'single' | 'two_point' | 'uniform' | 'blend',
  mutationType: 'gaussian' | 'uniform'
): EvolutionResult {
  // Initialize
  let population = initializePopulation(populationSize, geneLength, geneMin, geneMax);

  // Evaluate initial fitness
  for (const ind of population) {
    ind.fitness = fitnessFunc(ind.genes);
  }

  const history: { generation: number; best_fitness: number; avg_fitness: number }[] = [];
  let bestEver: Individual = { ...population[0], genes: [...population[0].genes] };

  for (let gen = 0; gen < generations; gen++) {
    // Track best
    const best = population.reduce((a, b) => (a.fitness > b.fitness ? a : b));
    if (best.fitness > bestEver.fitness) {
      bestEver = { ...best, genes: [...best.genes] };
    }

    const avgFitness = population.reduce((s, p) => s + p.fitness, 0) / population.length;
    if (gen % Math.max(1, Math.floor(generations / 50)) === 0) {
      history.push({ generation: gen, best_fitness: best.fitness, avg_fitness: avgFitness });
    }

    // Create new population
    const newPopulation: Individual[] = [];

    // Elitism
    const elite = elitism(population, elitismCount);
    newPopulation.push(...elite.map((e) => ({ ...e, genes: [...e.genes] })));

    // Fill rest with offspring
    while (newPopulation.length < populationSize) {
      // Selection
      const parent1 = tournamentSelect(population, tournamentSize);
      const parent2 = tournamentSelect(population, tournamentSize);

      let child1Genes: number[], child2Genes: number[];

      // Crossover
      if (Math.random() < crossoverRate) {
        switch (crossoverType) {
          case 'two_point':
            [child1Genes, child2Genes] = twoPointCrossover(parent1.genes, parent2.genes);
            break;
          case 'uniform':
            [child1Genes, child2Genes] = uniformCrossover(parent1.genes, parent2.genes);
            break;
          case 'blend':
            [child1Genes, child2Genes] = blendCrossover(parent1.genes, parent2.genes);
            break;
          default:
            [child1Genes, child2Genes] = singlePointCrossover(parent1.genes, parent2.genes);
        }
      } else {
        child1Genes = [...parent1.genes];
        child2Genes = [...parent2.genes];
      }

      // Mutation
      if (mutationType === 'gaussian') {
        const sigma = (geneMax - geneMin) * 0.1;
        child1Genes = gaussianMutation(child1Genes, mutationRate, sigma);
        child2Genes = gaussianMutation(child2Genes, mutationRate, sigma);
      } else {
        child1Genes = uniformMutation(child1Genes, mutationRate, geneMin, geneMax);
        child2Genes = uniformMutation(child2Genes, mutationRate, geneMin, geneMax);
      }

      // Clamp to bounds
      child1Genes = child1Genes.map((g) => Math.max(geneMin, Math.min(geneMax, g)));
      child2Genes = child2Genes.map((g) => Math.max(geneMin, Math.min(geneMax, g)));

      // Evaluate and add
      const child1 = { genes: child1Genes, fitness: fitnessFunc(child1Genes) };
      const child2 = { genes: child2Genes, fitness: fitnessFunc(child2Genes) };

      newPopulation.push(child1);
      if (newPopulation.length < populationSize) {
        newPopulation.push(child2);
      }
    }

    population = newPopulation;
  }

  // Final best
  const finalBest = population.reduce((a, b) => (a.fitness > b.fitness ? a : b));
  if (finalBest.fitness > bestEver.fitness) {
    bestEver = finalBest;
  }

  history.push({
    generation: generations,
    best_fitness: bestEver.fitness,
    avg_fitness: population.reduce((s, p) => s + p.fitness, 0) / population.length,
  });

  return {
    best_solution: bestEver.genes,
    best_fitness: bestEver.fitness,
    generations,
    final_population_size: population.length,
    convergence_history: history,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const geneticAlgorithmTool: UnifiedTool = {
  name: 'genetic_algorithm',
  description: `Genetic algorithm optimization.

Operations:
- optimize: Run genetic algorithm optimization
- benchmark: Test on standard benchmark functions
- functions: List available fitness functions
- explain: Explain GA parameters and operators`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['optimize', 'benchmark', 'functions', 'explain'],
        description: 'Operation to perform',
      },
      fitness_function: { type: 'string', description: 'Fitness function name' },
      gene_length: { type: 'number', description: 'Number of genes per individual' },
      population_size: { type: 'number', description: 'Population size' },
      generations: { type: 'number', description: 'Number of generations' },
      gene_min: { type: 'number', description: 'Minimum gene value' },
      gene_max: { type: 'number', description: 'Maximum gene value' },
      mutation_rate: { type: 'number', description: 'Mutation probability (0-1)' },
      crossover_rate: { type: 'number', description: 'Crossover probability (0-1)' },
      elitism_count: { type: 'number', description: 'Number of elite individuals' },
      tournament_size: { type: 'number', description: 'Tournament selection size' },
      crossover_type: { type: 'string', enum: ['single', 'two_point', 'uniform', 'blend'] },
      mutation_type: { type: 'string', enum: ['gaussian', 'uniform'] },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeGeneticAlgorithm(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'optimize': {
        const fitnessFuncName = args.fitness_function || 'sphere';
        const fitnessFunc = FITNESS_FUNCTIONS[fitnessFuncName];

        if (!fitnessFunc) {
          throw new Error(
            `Unknown fitness function: ${fitnessFuncName}. Use 'functions' to list available.`
          );
        }

        const geneLength = args.gene_length || 10;
        const popSize = args.population_size || 100;
        const gens = args.generations || 100;
        const geneMin = args.gene_min ?? -5;
        const geneMax = args.gene_max ?? 5;
        const mutRate = args.mutation_rate ?? 0.1;
        const crossRate = args.crossover_rate ?? 0.8;
        const eliteCount = args.elitism_count ?? 2;
        const tournSize = args.tournament_size ?? 3;
        const crossType = args.crossover_type || 'blend';
        const mutType = args.mutation_type || 'gaussian';

        const evolutionResult = evolve(
          fitnessFunc,
          geneLength,
          popSize,
          gens,
          geneMin,
          geneMax,
          mutRate,
          crossRate,
          eliteCount,
          tournSize,
          crossType,
          mutType
        );

        result = {
          operation: 'optimize',
          parameters: {
            fitness_function: fitnessFuncName,
            gene_length: geneLength,
            population_size: popSize,
            generations: gens,
            gene_range: [geneMin, geneMax],
            mutation_rate: mutRate,
            crossover_rate: crossRate,
            crossover_type: crossType,
            mutation_type: mutType,
          },
          results: {
            best_solution: evolutionResult.best_solution.map((g) => parseFloat(g.toFixed(6))),
            best_fitness: evolutionResult.best_fitness,
            improvement:
              evolutionResult.convergence_history.length > 1
                ? evolutionResult.best_fitness - evolutionResult.convergence_history[0].best_fitness
                : 0,
          },
          convergence: evolutionResult.convergence_history,
        };
        break;
      }

      case 'benchmark': {
        const benchmarks = ['sphere', 'rastrigin', 'rosenbrock', 'ackley'];
        const results: Record<string, { best_fitness: number; best_solution: number[] }> = {};

        for (const fn of benchmarks) {
          const fitnessFunc = FITNESS_FUNCTIONS[fn];
          const evolutionResult = evolve(
            fitnessFunc,
            5, // gene length
            50, // population
            50, // generations
            -5,
            5, // bounds
            0.1,
            0.8,
            2,
            3,
            'blend',
            'gaussian'
          );
          results[fn] = {
            best_fitness: evolutionResult.best_fitness,
            best_solution: evolutionResult.best_solution.map((g) => parseFloat(g.toFixed(4))),
          };
        }

        result = {
          operation: 'benchmark',
          note: 'Running 50 generations on 5D problems',
          results,
        };
        break;
      }

      case 'functions': {
        result = {
          operation: 'functions',
          available: Object.keys(FITNESS_FUNCTIONS).map((name) => ({
            name,
            description:
              name === 'sphere'
                ? 'Minimize sum of squares (optimum at origin)'
                : name === 'rastrigin'
                  ? 'Highly multimodal (optimum at origin)'
                  : name === 'rosenbrock'
                    ? 'Valley function (optimum at [1,1,...,1])'
                    : name === 'ackley'
                      ? 'Multimodal with many local minima'
                      : name === 'maximize_sum'
                        ? 'Maximize sum of genes'
                        : name === 'maximize_product'
                          ? 'Maximize product of gene magnitudes'
                          : 'Custom function',
          })),
        };
        break;
      }

      case 'explain': {
        result = {
          operation: 'explain',
          parameters: {
            population_size: 'Number of candidate solutions in each generation',
            generations: 'Number of evolution cycles',
            mutation_rate: 'Probability of each gene mutating (0.01-0.2 typical)',
            crossover_rate: 'Probability of crossover vs cloning (0.6-0.9 typical)',
            elitism_count: 'Best individuals copied unchanged (1-5 typical)',
            tournament_size: 'Selection pressure (2-7 typical)',
          },
          crossover_types: {
            single: 'One random cut point, swap tails',
            two_point: 'Two cut points, swap middle section',
            uniform: 'Each gene randomly from either parent',
            blend: 'Interpolate between parents with extension',
          },
          mutation_types: {
            gaussian: 'Add normally distributed noise',
            uniform: 'Replace with random value in range',
          },
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

export function isGeneticAlgorithmAvailable(): boolean {
  return true;
}
