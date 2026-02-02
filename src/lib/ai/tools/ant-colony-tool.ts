/**
 * ANT-COLONY TOOL
 * Ant Colony Optimization (ACO) for combinatorial optimization
 * Supports TSP, graph coloring, and general optimization problems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface City {
  x: number;
  y: number;
  name?: string;
}

interface ACOConfig {
  numAnts: number;
  numIterations: number;
  alpha: number;        // Pheromone importance
  beta: number;         // Heuristic importance
  evaporationRate: number;
  Q: number;           // Pheromone deposit factor
  elitistWeight?: number;
}

interface ACOResult {
  bestTour: number[];
  bestDistance: number;
  convergenceHistory: { iteration: number; bestDistance: number; avgDistance: number }[];
  finalPheromones?: number[][];
  executionStats: {
    totalIterations: number;
    totalAnts: number;
    improvementIterations: number[];
  };
}

interface AntPath {
  tour: number[];
  distance: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateDistance(city1: City, city2: City): number {
  const dx = city1.x - city2.x;
  const dy = city1.y - city2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function createDistanceMatrix(cities: City[]): number[][] {
  const n = cities.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      matrix[i][j] = i === j ? Infinity : calculateDistance(cities[i], cities[j]);
    }
  }

  return matrix;
}

function calculateTourDistance(tour: number[], distMatrix: number[][]): number {
  let distance = 0;
  for (let i = 0; i < tour.length - 1; i++) {
    distance += distMatrix[tour[i]][tour[i + 1]];
  }
  distance += distMatrix[tour[tour.length - 1]][tour[0]]; // Return to start
  return distance;
}

// ============================================================================
// ANT COLONY OPTIMIZATION
// ============================================================================

class AntColonyOptimizer {
  private cities: City[];
  private distMatrix: number[][];
  private pheromones: number[][];
  private config: ACOConfig;
  private n: number;

  constructor(cities: City[], config: Partial<ACOConfig> = {}) {
    this.cities = cities;
    this.n = cities.length;
    this.distMatrix = createDistanceMatrix(cities);

    this.config = {
      numAnts: config.numAnts || cities.length,
      numIterations: config.numIterations || 100,
      alpha: config.alpha || 1.0,        // Pheromone importance
      beta: config.beta || 2.0,          // Distance importance
      evaporationRate: config.evaporationRate || 0.5,
      Q: config.Q || 100,
      elitistWeight: config.elitistWeight || 0
    };

    // Initialize pheromones
    const initialPheromone = 1.0 / this.n;
    this.pheromones = Array(this.n).fill(null).map(() =>
      Array(this.n).fill(initialPheromone)
    );
  }

  /**
   * Select next city based on pheromone and heuristic information
   */
  private selectNextCity(currentCity: number, visited: Set<number>): number {
    const unvisited: number[] = [];
    for (let i = 0; i < this.n; i++) {
      if (!visited.has(i)) {
        unvisited.push(i);
      }
    }

    if (unvisited.length === 0) return -1;

    // Calculate probabilities
    const probabilities: number[] = [];
    let totalProb = 0;

    for (const city of unvisited) {
      const pheromone = Math.pow(this.pheromones[currentCity][city], this.config.alpha);
      const heuristic = Math.pow(1.0 / this.distMatrix[currentCity][city], this.config.beta);
      const prob = pheromone * heuristic;
      probabilities.push(prob);
      totalProb += prob;
    }

    // Normalize and select using roulette wheel
    const random = Math.random() * totalProb;
    let cumulative = 0;

    for (let i = 0; i < unvisited.length; i++) {
      cumulative += probabilities[i];
      if (random <= cumulative) {
        return unvisited[i];
      }
    }

    return unvisited[unvisited.length - 1];
  }

  /**
   * Construct a tour for a single ant
   */
  private constructTour(startCity: number): AntPath {
    const tour: number[] = [startCity];
    const visited = new Set<number>([startCity]);

    while (tour.length < this.n) {
      const currentCity = tour[tour.length - 1];
      const nextCity = this.selectNextCity(currentCity, visited);
      if (nextCity === -1) break;
      tour.push(nextCity);
      visited.add(nextCity);
    }

    const distance = calculateTourDistance(tour, this.distMatrix);
    return { tour, distance };
  }

  /**
   * Update pheromones based on ant tours
   */
  private updatePheromones(antPaths: AntPath[], bestPath: AntPath): void {
    // Evaporation
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        this.pheromones[i][j] *= (1 - this.config.evaporationRate);
        // Ensure minimum pheromone level
        this.pheromones[i][j] = Math.max(this.pheromones[i][j], 0.0001);
      }
    }

    // Deposit pheromones from all ants
    for (const path of antPaths) {
      const deposit = this.config.Q / path.distance;
      for (let i = 0; i < path.tour.length - 1; i++) {
        const from = path.tour[i];
        const to = path.tour[i + 1];
        this.pheromones[from][to] += deposit;
        this.pheromones[to][from] += deposit;
      }
      // Close the tour
      const last = path.tour[path.tour.length - 1];
      const first = path.tour[0];
      this.pheromones[last][first] += deposit;
      this.pheromones[first][last] += deposit;
    }

    // Elitist strategy: extra pheromone on best tour
    if (this.config.elitistWeight && this.config.elitistWeight > 0) {
      const eliteDeposit = this.config.elitistWeight * this.config.Q / bestPath.distance;
      for (let i = 0; i < bestPath.tour.length - 1; i++) {
        const from = bestPath.tour[i];
        const to = bestPath.tour[i + 1];
        this.pheromones[from][to] += eliteDeposit;
        this.pheromones[to][from] += eliteDeposit;
      }
    }
  }

  /**
   * Run the optimization
   */
  optimize(): ACOResult {
    let bestTour: number[] = [];
    let bestDistance = Infinity;
    const convergenceHistory: { iteration: number; bestDistance: number; avgDistance: number }[] = [];
    const improvementIterations: number[] = [];

    for (let iter = 0; iter < this.config.numIterations; iter++) {
      const antPaths: AntPath[] = [];

      // Each ant constructs a tour
      for (let ant = 0; ant < this.config.numAnts; ant++) {
        const startCity = ant % this.n;
        const path = this.constructTour(startCity);
        antPaths.push(path);

        if (path.distance < bestDistance) {
          bestDistance = path.distance;
          bestTour = [...path.tour];
          improvementIterations.push(iter);
        }
      }

      // Calculate average distance for this iteration
      const avgDistance = antPaths.reduce((sum, p) => sum + p.distance, 0) / antPaths.length;

      convergenceHistory.push({
        iteration: iter,
        bestDistance,
        avgDistance
      });

      // Update pheromones
      this.updatePheromones(antPaths, { tour: bestTour, distance: bestDistance });
    }

    return {
      bestTour: [...bestTour, bestTour[0]], // Include return to start
      bestDistance,
      convergenceHistory: convergenceHistory.filter((_, i) => i % 10 === 0 || i === convergenceHistory.length - 1),
      finalPheromones: this.pheromones.map(row =>
        row.map(v => parseFloat(v.toFixed(4)))
      ),
      executionStats: {
        totalIterations: this.config.numIterations,
        totalAnts: this.config.numAnts * this.config.numIterations,
        improvementIterations
      }
    };
  }
}

// ============================================================================
// MAX-MIN ANT SYSTEM (MMAS)
// ============================================================================

class MaxMinAntSystem extends AntColonyOptimizer {
  private pheromoneMin: number;
  private pheromoneMax: number;

  constructor(cities: City[], config: Partial<ACOConfig> = {}) {
    super(cities, config);

    // MMAS specific bounds
    const n = cities.length;
    const tau0 = 1.0 / (n * this.calculateNearestNeighborTour());
    this.pheromoneMax = tau0;
    this.pheromoneMin = this.pheromoneMax / (2 * n);
  }

  private calculateNearestNeighborTour(): number {
    // Quick nearest neighbor heuristic for initial bound
    const n = this.cities.length;
    const visited = new Set<number>([0]);
    let current = 0;
    let distance = 0;

    while (visited.size < n) {
      let nearest = -1;
      let nearestDist = Infinity;

      for (let i = 0; i < n; i++) {
        if (!visited.has(i)) {
          const d = calculateDistance(this.cities[current], this.cities[i]);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = i;
          }
        }
      }

      if (nearest !== -1) {
        distance += nearestDist;
        visited.add(nearest);
        current = nearest;
      }
    }

    distance += calculateDistance(this.cities[current], this.cities[0]);
    return distance;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const antcolonyTool: UnifiedTool = {
  name: 'ant_colony',
  description: 'Ant Colony Optimization (ACO) for combinatorial optimization problems like TSP',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['tsp', 'optimize', 'demo', 'compare_params', 'info', 'examples'],
        description: 'Operation: tsp (solve TSP), optimize (general), demo (run demonstration), compare_params (compare parameters)'
      },
      cities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            name: { type: 'string' }
          }
        },
        description: 'City coordinates for TSP'
      },
      numAnts: {
        type: 'number',
        description: 'Number of ants (default: number of cities)'
      },
      numIterations: {
        type: 'number',
        description: 'Number of iterations (default: 100)'
      },
      alpha: {
        type: 'number',
        description: 'Pheromone importance factor (default: 1.0)'
      },
      beta: {
        type: 'number',
        description: 'Heuristic (distance) importance factor (default: 2.0)'
      },
      evaporationRate: {
        type: 'number',
        description: 'Pheromone evaporation rate 0-1 (default: 0.5)'
      },
      elitist: {
        type: 'boolean',
        description: 'Use elitist ant system'
      }
    },
    required: ['operation']
  }
};

export async function executeantcolony(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'tsp':
      case 'optimize': {
        const cities: City[] = args.cities || [
          { x: 0, y: 0, name: 'A' },
          { x: 2, y: 4, name: 'B' },
          { x: 5, y: 2, name: 'C' },
          { x: 7, y: 1, name: 'D' },
          { x: 8, y: 4, name: 'E' },
          { x: 6, y: 6, name: 'F' },
          { x: 3, y: 5, name: 'G' }
        ];

        const config: Partial<ACOConfig> = {
          numAnts: args.numAnts,
          numIterations: args.numIterations || 50,
          alpha: args.alpha,
          beta: args.beta,
          evaporationRate: args.evaporationRate,
          elitistWeight: args.elitist ? 2 : 0
        };

        const aco = new AntColonyOptimizer(cities, config);
        const result = aco.optimize();

        // Map tour indices to city names
        const tourNames = result.bestTour.map(i =>
          cities[i].name || `City ${i}`
        );

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'tsp',
            problem: {
              numCities: cities.length,
              cities: cities.map((c, i) => ({
                index: i,
                name: c.name || `City ${i}`,
                coordinates: { x: c.x, y: c.y }
              }))
            },
            solution: {
              bestTour: result.bestTour,
              tourPath: tourNames.join(' → '),
              totalDistance: result.bestDistance.toFixed(4)
            },
            convergence: {
              history: result.convergenceHistory,
              improvementIterations: result.executionStats.improvementIterations
            },
            parameters: config,
            executionStats: result.executionStats
          }, null, 2)
        };
      }

      case 'demo': {
        // Demo with classic TSP benchmark
        const demoCities: City[] = [
          { x: 60, y: 200, name: 'A' },
          { x: 180, y: 200, name: 'B' },
          { x: 80, y: 180, name: 'C' },
          { x: 140, y: 180, name: 'D' },
          { x: 20, y: 160, name: 'E' },
          { x: 100, y: 160, name: 'F' },
          { x: 200, y: 160, name: 'G' },
          { x: 140, y: 140, name: 'H' },
          { x: 40, y: 120, name: 'I' },
          { x: 100, y: 120, name: 'J' }
        ];

        // Run with different configurations
        const results: { config: string; distance: number; tour: string }[] = [];

        // Standard ACO
        const acoStandard = new AntColonyOptimizer(demoCities, {
          numIterations: 30,
          alpha: 1,
          beta: 2,
          evaporationRate: 0.5
        });
        const resultStandard = acoStandard.optimize();
        results.push({
          config: 'Standard (α=1, β=2, ρ=0.5)',
          distance: resultStandard.bestDistance,
          tour: resultStandard.bestTour.map(i => demoCities[i].name).join('→')
        });

        // High pheromone importance
        const acoHighAlpha = new AntColonyOptimizer(demoCities, {
          numIterations: 30,
          alpha: 2,
          beta: 1,
          evaporationRate: 0.5
        });
        const resultHighAlpha = acoHighAlpha.optimize();
        results.push({
          config: 'High Pheromone (α=2, β=1)',
          distance: resultHighAlpha.bestDistance,
          tour: resultHighAlpha.bestTour.map(i => demoCities[i].name).join('→')
        });

        // High heuristic importance
        const acoHighBeta = new AntColonyOptimizer(demoCities, {
          numIterations: 30,
          alpha: 1,
          beta: 5,
          evaporationRate: 0.5
        });
        const resultHighBeta = acoHighBeta.optimize();
        results.push({
          config: 'High Heuristic (α=1, β=5)',
          distance: resultHighBeta.bestDistance,
          tour: resultHighBeta.bestTour.map(i => demoCities[i].name).join('→')
        });

        // Elitist
        const acoElitist = new AntColonyOptimizer(demoCities, {
          numIterations: 30,
          alpha: 1,
          beta: 2,
          evaporationRate: 0.5,
          elitistWeight: 2
        });
        const resultElitist = acoElitist.optimize();
        results.push({
          config: 'Elitist (weight=2)',
          distance: resultElitist.bestDistance,
          tour: resultElitist.bestTour.map(i => demoCities[i].name).join('→')
        });

        const bestResult = results.reduce((best, r) =>
          r.distance < best.distance ? r : best
        );

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'Comparison of ACO configurations on 10-city TSP',
            cities: demoCities.map((c, i) => ({
              index: i,
              name: c.name,
              x: c.x,
              y: c.y
            })),
            results: results.map(r => ({
              ...r,
              distance: r.distance.toFixed(4)
            })),
            best: {
              configuration: bestResult.config,
              distance: bestResult.distance.toFixed(4),
              tour: bestResult.tour
            },
            insights: {
              alphaBetaBalance: 'Higher β favors greedy choices; higher α follows pheromone trails',
              evaporation: 'Higher evaporation = more exploration, lower = more exploitation',
              elitist: 'Elitist reinforces best solutions but may converge prematurely'
            }
          }, null, 2)
        };
      }

      case 'compare_params': {
        const cities: City[] = args.cities || [
          { x: 0, y: 0 }, { x: 1, y: 3 }, { x: 4, y: 3 },
          { x: 6, y: 1 }, { x: 3, y: 0 }, { x: 2, y: 2 }
        ];

        const alphaValues = [0.5, 1.0, 2.0];
        const betaValues = [1.0, 2.0, 5.0];
        const results: { alpha: number; beta: number; distance: number }[] = [];

        for (const alpha of alphaValues) {
          for (const beta of betaValues) {
            const aco = new AntColonyOptimizer(cities, {
              numIterations: 30,
              alpha,
              beta,
              evaporationRate: 0.5
            });
            const result = aco.optimize();
            results.push({
              alpha,
              beta,
              distance: parseFloat(result.bestDistance.toFixed(4))
            });
          }
        }

        // Find best combination
        const best = results.reduce((b, r) => r.distance < b.distance ? r : b);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare_params',
            numCities: cities.length,
            parameterGrid: {
              alpha: alphaValues,
              beta: betaValues
            },
            results,
            bestConfiguration: {
              alpha: best.alpha,
              beta: best.beta,
              distance: best.distance
            },
            parameterGuide: {
              alpha: 'Controls pheromone trail influence (0 = ignore trails, high = follow trails)',
              beta: 'Controls distance heuristic influence (0 = ignore distance, high = greedy)',
              typical: 'α=1, β=2-5 often works well',
              tradeoff: 'α/β ratio determines exploration vs exploitation'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Ant Colony Optimization',
            description: 'Probabilistic metaheuristic inspired by ant foraging behavior',
            algorithm: {
              inspiration: 'Real ants deposit pheromones to mark good paths',
              mechanism: 'Artificial ants build solutions probabilistically based on pheromone and heuristic info',
              learning: 'Good solutions reinforce pheromone trails'
            },
            parameters: {
              alpha: {
                description: 'Pheromone importance factor',
                typical: '1.0',
                effect: 'Higher = more trail following'
              },
              beta: {
                description: 'Heuristic importance factor',
                typical: '2.0-5.0',
                effect: 'Higher = more greedy choices'
              },
              evaporationRate: {
                description: 'Pheromone decay rate per iteration',
                typical: '0.1-0.5',
                effect: 'Higher = more exploration'
              },
              Q: {
                description: 'Pheromone deposit amount',
                typical: '1-100',
                effect: 'Scales pheromone updates'
              }
            },
            variants: [
              { name: 'Ant System (AS)', description: 'Original algorithm by Dorigo' },
              { name: 'Elitist AS', description: 'Extra pheromone on best-so-far tour' },
              { name: 'Max-Min AS (MMAS)', description: 'Bounded pheromone levels' },
              { name: 'Ant Colony System (ACS)', description: 'Local pheromone update' }
            ],
            applications: [
              'Traveling Salesman Problem',
              'Vehicle Routing',
              'Job Shop Scheduling',
              'Network Routing',
              'Graph Coloring',
              'Protein Folding'
            ],
            complexity: {
              perIteration: 'O(n² × m) where n=cities, m=ants',
              space: 'O(n²) for pheromone matrix'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Solve TSP with 6 cities',
                call: {
                  operation: 'tsp',
                  cities: [
                    { x: 0, y: 0, name: 'Start' },
                    { x: 3, y: 4, name: 'A' },
                    { x: 6, y: 1, name: 'B' },
                    { x: 8, y: 5, name: 'C' },
                    { x: 5, y: 8, name: 'D' },
                    { x: 2, y: 6, name: 'E' }
                  ],
                  numIterations: 50
                }
              },
              {
                name: 'Custom parameters',
                call: {
                  operation: 'tsp',
                  cities: [
                    { x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 1 },
                    { x: 4, y: 3 }, { x: 2, y: 4 }
                  ],
                  alpha: 1.5,
                  beta: 3.0,
                  evaporationRate: 0.3,
                  numIterations: 100
                }
              },
              {
                name: 'Elitist ant system',
                call: {
                  operation: 'tsp',
                  elitist: true,
                  numIterations: 50
                }
              },
              {
                name: 'Run demonstration',
                call: { operation: 'demo' }
              },
              {
                name: 'Compare parameters',
                call: { operation: 'compare_params' }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isantcolonyAvailable(): boolean { return true; }
