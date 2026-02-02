/**
 * AGENT-BASED-MODEL TOOL
 * Agent-based modeling for complex systems with emergent behaviors
 * Includes classic models: Schelling, Boids, Conway's Game of Life, etc.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const agentbasedmodelTool: UnifiedTool = {
  name: 'agent_based_model',
  description: 'Agent-based modeling for complex systems simulation with emergent behaviors',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'simulate', 'step', 'analyze', 'schelling', 'boids', 'game_of_life', 'ant_colony', 'epidemic', 'demonstrate'],
        description: 'Operation to perform'
      },
      model: { type: 'string', description: 'Model type' },
      agent_count: { type: 'number', description: 'Number of agents' },
      grid_size: { type: 'number', description: 'Grid size for spatial models' },
      steps: { type: 'number', description: 'Number of simulation steps' },
      parameters: { type: 'object', description: 'Model-specific parameters' }
    },
    required: ['operation']
  }
};

// ===== AGENT TYPES =====

interface Agent {
  id: number;
  x: number;
  y: number;
  type?: string | number;
  state?: Record<string, any>;
  velocity?: { vx: number; vy: number };
}

interface Grid {
  width: number;
  height: number;
  cells: (Agent | null)[][];
}

// ===== SCHELLING SEGREGATION MODEL =====

function createSchellingModel(
  gridSize: number,
  density: number = 0.8,
  typeRatio: number = 0.5,
  threshold: number = 0.3
): { grid: Grid; agents: Agent[] } {
  const grid: Grid = {
    width: gridSize,
    height: gridSize,
    cells: Array(gridSize).fill(null).map(() => Array(gridSize).fill(null))
  };

  const agents: Agent[] = [];
  let id = 0;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (Math.random() < density) {
        const type = Math.random() < typeRatio ? 0 : 1;
        const agent: Agent = { id: id++, x, y, type, state: { happy: false } };
        agents.push(agent);
        grid.cells[y][x] = agent;
      }
    }
  }

  return { grid, agents };
}

function getNeighbors(grid: Grid, x: number, y: number): Agent[] {
  const neighbors: Agent[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = (x + dx + grid.width) % grid.width;
      const ny = (y + dy + grid.height) % grid.height;
      const cell = grid.cells[ny][nx];
      if (cell) neighbors.push(cell);
    }
  }
  return neighbors;
}

function isHappy(agent: Agent, neighbors: Agent[], threshold: number): boolean {
  if (neighbors.length === 0) return true;
  const sameType = neighbors.filter(n => n.type === agent.type).length;
  return sameType / neighbors.length >= threshold;
}

function stepSchelling(grid: Grid, agents: Agent[], threshold: number): { moves: number; happiness: number } {
  // Find unhappy agents
  const unhappyAgents: Agent[] = [];
  let happyCount = 0;

  for (const agent of agents) {
    const neighbors = getNeighbors(grid, agent.x, agent.y);
    const happy = isHappy(agent, neighbors, threshold);
    agent.state!.happy = happy;
    if (happy) {
      happyCount++;
    } else {
      unhappyAgents.push(agent);
    }
  }

  // Find empty cells
  const emptyCells: { x: number; y: number }[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.cells[y][x]) emptyCells.push({ x, y });
    }
  }

  // Shuffle unhappy agents
  for (let i = unhappyAgents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unhappyAgents[i], unhappyAgents[j]] = [unhappyAgents[j], unhappyAgents[i]];
  }

  // Move unhappy agents
  let moves = 0;
  for (const agent of unhappyAgents) {
    if (emptyCells.length === 0) break;

    // Find a cell where agent would be happy
    let moved = false;
    for (let i = 0; i < emptyCells.length && !moved; i++) {
      const cell = emptyCells[i];
      const newNeighbors = getNeighbors(grid, cell.x, cell.y);
      if (isHappy(agent, newNeighbors, threshold)) {
        // Move agent
        grid.cells[agent.y][agent.x] = null;
        emptyCells.push({ x: agent.x, y: agent.y });
        agent.x = cell.x;
        agent.y = cell.y;
        grid.cells[agent.y][agent.x] = agent;
        emptyCells.splice(i, 1);
        moves++;
        moved = true;
      }
    }

    // If no happy cell found, move to random empty cell
    if (!moved && emptyCells.length > 0) {
      const idx = Math.floor(Math.random() * emptyCells.length);
      const cell = emptyCells[idx];
      grid.cells[agent.y][agent.x] = null;
      emptyCells.push({ x: agent.x, y: agent.y });
      agent.x = cell.x;
      agent.y = cell.y;
      grid.cells[agent.y][agent.x] = agent;
      emptyCells.splice(idx, 1);
      moves++;
    }
  }

  return { moves, happiness: happyCount / agents.length };
}

function calculateSegregation(grid: Grid, agents: Agent[]): number {
  let totalSimilar = 0;
  let totalNeighbors = 0;

  for (const agent of agents) {
    const neighbors = getNeighbors(grid, agent.x, agent.y);
    const similar = neighbors.filter(n => n.type === agent.type).length;
    totalSimilar += similar;
    totalNeighbors += neighbors.length;
  }

  return totalNeighbors > 0 ? totalSimilar / totalNeighbors : 0;
}

// ===== BOIDS FLOCKING MODEL =====

interface Boid extends Agent {
  velocity: { vx: number; vy: number };
}

function createBoids(count: number, width: number, height: number): Boid[] {
  const boids: Boid[] = [];
  for (let i = 0; i < count; i++) {
    boids.push({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      velocity: {
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2
      }
    });
  }
  return boids;
}

function stepBoids(
  boids: Boid[],
  width: number,
  height: number,
  params: {
    separationWeight: number;
    alignmentWeight: number;
    cohesionWeight: number;
    visualRange: number;
    minDistance: number;
    maxSpeed: number;
  }
): void {
  const { separationWeight, alignmentWeight, cohesionWeight, visualRange, minDistance, maxSpeed } = params;

  for (const boid of boids) {
    let sepX = 0, sepY = 0;
    let alignX = 0, alignY = 0;
    let cohX = 0, cohY = 0;
    let neighborCount = 0;
    let closeCount = 0;

    for (const other of boids) {
      if (other.id === boid.id) continue;

      const dx = other.x - boid.x;
      const dy = other.y - boid.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < visualRange) {
        neighborCount++;

        // Alignment
        alignX += other.velocity.vx;
        alignY += other.velocity.vy;

        // Cohesion
        cohX += other.x;
        cohY += other.y;

        // Separation
        if (dist < minDistance && dist > 0) {
          closeCount++;
          sepX -= dx / dist;
          sepY -= dy / dist;
        }
      }
    }

    if (neighborCount > 0) {
      // Alignment: steer towards average heading
      alignX /= neighborCount;
      alignY /= neighborCount;
      boid.velocity.vx += (alignX - boid.velocity.vx) * alignmentWeight;
      boid.velocity.vy += (alignY - boid.velocity.vy) * alignmentWeight;

      // Cohesion: steer towards center of mass
      cohX = cohX / neighborCount - boid.x;
      cohY = cohY / neighborCount - boid.y;
      boid.velocity.vx += cohX * cohesionWeight;
      boid.velocity.vy += cohY * cohesionWeight;
    }

    // Separation
    if (closeCount > 0) {
      boid.velocity.vx += sepX * separationWeight;
      boid.velocity.vy += sepY * separationWeight;
    }

    // Limit speed
    const speed = Math.sqrt(boid.velocity.vx ** 2 + boid.velocity.vy ** 2);
    if (speed > maxSpeed) {
      boid.velocity.vx = (boid.velocity.vx / speed) * maxSpeed;
      boid.velocity.vy = (boid.velocity.vy / speed) * maxSpeed;
    }

    // Update position with wrapping
    boid.x = (boid.x + boid.velocity.vx + width) % width;
    boid.y = (boid.y + boid.velocity.vy + height) % height;
  }
}

function calculateFlockOrder(boids: Boid[]): number {
  // Order parameter: alignment of velocities (0 = chaotic, 1 = perfectly aligned)
  let sumVx = 0, sumVy = 0;
  for (const boid of boids) {
    const speed = Math.sqrt(boid.velocity.vx ** 2 + boid.velocity.vy ** 2);
    if (speed > 0) {
      sumVx += boid.velocity.vx / speed;
      sumVy += boid.velocity.vy / speed;
    }
  }
  return Math.sqrt(sumVx ** 2 + sumVy ** 2) / boids.length;
}

// ===== CONWAY'S GAME OF LIFE =====

function createGameOfLife(width: number, height: number, density: number = 0.3): boolean[][] {
  return Array(height).fill(null).map(() =>
    Array(width).fill(null).map(() => Math.random() < density)
  );
}

function countLiveNeighborsGoL(grid: boolean[][], x: number, y: number): number {
  const height = grid.length;
  const width = grid[0].length;
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = (x + dx + width) % width;
      const ny = (y + dy + height) % height;
      if (grid[ny][nx]) count++;
    }
  }
  return count;
}

function stepGameOfLife(grid: boolean[][]): { newGrid: boolean[][]; births: number; deaths: number } {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid = Array(height).fill(null).map(() => Array(width).fill(false));
  let births = 0, deaths = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const neighbors = countLiveNeighborsGoL(grid, x, y);
      const alive = grid[y][x];

      if (alive) {
        // Survival: 2 or 3 neighbors
        if (neighbors === 2 || neighbors === 3) {
          newGrid[y][x] = true;
        } else {
          deaths++;
        }
      } else {
        // Birth: exactly 3 neighbors
        if (neighbors === 3) {
          newGrid[y][x] = true;
          births++;
        }
      }
    }
  }

  return { newGrid, births, deaths };
}

function countLiveCells(grid: boolean[][]): number {
  return grid.reduce((sum, row) => sum + row.filter(c => c).length, 0);
}

function gridToString(grid: boolean[][], maxSize: number = 20): string {
  const height = Math.min(grid.length, maxSize);
  const width = Math.min(grid[0].length, maxSize);
  return grid.slice(0, height).map(row =>
    row.slice(0, width).map(c => c ? '█' : '·').join('')
  ).join('\n');
}

// ===== ANT COLONY OPTIMIZATION =====

interface Ant {
  id: number;
  path: number[];
  totalDistance: number;
}

function createAntColony(
  distances: number[][],
  antCount: number,
  alpha: number = 1,
  beta: number = 2,
  evaporation: number = 0.5,
  Q: number = 100
): { pheromones: number[][]; ants: Ant[] } {
  const n = distances.length;
  const pheromones = Array(n).fill(null).map(() => Array(n).fill(1));
  const ants: Ant[] = Array(antCount).fill(null).map((_, i) => ({
    id: i,
    path: [],
    totalDistance: 0
  }));

  return { pheromones, ants };
}

function antTour(
  ant: Ant,
  distances: number[][],
  pheromones: number[][],
  alpha: number,
  beta: number
): void {
  const n = distances.length;
  const visited = new Set<number>();

  // Start from random city
  let current = Math.floor(Math.random() * n);
  ant.path = [current];
  visited.add(current);
  ant.totalDistance = 0;

  while (visited.size < n) {
    // Calculate probabilities
    const probs: { city: number; prob: number }[] = [];
    let total = 0;

    for (let next = 0; next < n; next++) {
      if (!visited.has(next)) {
        const tau = Math.pow(pheromones[current][next], alpha);
        const eta = Math.pow(1 / distances[current][next], beta);
        const prob = tau * eta;
        probs.push({ city: next, prob });
        total += prob;
      }
    }

    // Roulette wheel selection
    let r = Math.random() * total;
    let nextCity = probs[0].city;
    for (const p of probs) {
      r -= p.prob;
      if (r <= 0) {
        nextCity = p.city;
        break;
      }
    }

    ant.totalDistance += distances[current][nextCity];
    current = nextCity;
    ant.path.push(current);
    visited.add(current);
  }

  // Return to start
  ant.totalDistance += distances[current][ant.path[0]];
  ant.path.push(ant.path[0]);
}

function updatePheromones(
  pheromones: number[][],
  ants: Ant[],
  evaporation: number,
  Q: number
): void {
  const n = pheromones.length;

  // Evaporation
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      pheromones[i][j] *= (1 - evaporation);
    }
  }

  // Deposit pheromones
  for (const ant of ants) {
    const deposit = Q / ant.totalDistance;
    for (let i = 0; i < ant.path.length - 1; i++) {
      const from = ant.path[i];
      const to = ant.path[i + 1];
      pheromones[from][to] += deposit;
      pheromones[to][from] += deposit;
    }
  }
}

// ===== EPIDEMIC MODEL (SIR with spatial) =====

interface SIRAgent extends Agent {
  state: { status: 'S' | 'I' | 'R'; daysSick?: number };
}

function createSIRAgents(
  count: number,
  gridSize: number,
  initialInfected: number = 5
): SIRAgent[] {
  const agents: SIRAgent[] = [];

  for (let i = 0; i < count; i++) {
    agents.push({
      id: i,
      x: Math.random() * gridSize,
      y: Math.random() * gridSize,
      state: { status: i < initialInfected ? 'I' : 'S', daysSick: i < initialInfected ? 0 : undefined }
    });
  }

  return agents;
}

function stepSIRAgents(
  agents: SIRAgent[],
  gridSize: number,
  infectionRadius: number,
  infectionProb: number,
  recoveryDays: number,
  mobility: number
): { S: number; I: number; R: number; newInfections: number } {
  let newInfections = 0;

  // Movement
  for (const agent of agents) {
    agent.x = (agent.x + (Math.random() - 0.5) * mobility + gridSize) % gridSize;
    agent.y = (agent.y + (Math.random() - 0.5) * mobility + gridSize) % gridSize;
  }

  // Infection spread
  const susceptible = agents.filter(a => a.state.status === 'S');
  const infected = agents.filter(a => a.state.status === 'I');

  for (const sus of susceptible) {
    for (const inf of infected) {
      const dx = sus.x - inf.x;
      const dy = sus.y - inf.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < infectionRadius && Math.random() < infectionProb) {
        sus.state.status = 'I';
        sus.state.daysSick = 0;
        newInfections++;
        break;
      }
    }
  }

  // Recovery
  for (const agent of agents) {
    if (agent.state.status === 'I') {
      agent.state.daysSick!++;
      if (agent.state.daysSick! >= recoveryDays) {
        agent.state.status = 'R';
      }
    }
  }

  return {
    S: agents.filter(a => a.state.status === 'S').length,
    I: agents.filter(a => a.state.status === 'I').length,
    R: agents.filter(a => a.state.status === 'R').length,
    newInfections
  };
}

// ===== MAIN EXECUTION =====

export async function executeagentbasedmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'agent_based_model',
            description: 'Agent-based modeling for studying emergent behaviors from simple rules',
            concepts: {
              agents: 'Individual entities with states and behaviors',
              environment: 'Space where agents exist and interact',
              rules: 'Simple behaviors that each agent follows',
              emergence: 'Complex patterns arising from simple individual behaviors',
              heterogeneity: 'Agents can have different characteristics'
            },
            models: {
              schelling: 'Segregation dynamics from mild preferences',
              boids: 'Flocking behavior (separation, alignment, cohesion)',
              game_of_life: 'Conway\'s cellular automaton',
              ant_colony: 'Swarm intelligence for optimization',
              epidemic: 'Spatial disease spread with mobile agents'
            },
            applications: [
              'Urban dynamics and segregation',
              'Traffic and crowd simulation',
              'Epidemiology',
              'Ecology and animal behavior',
              'Market dynamics',
              'Social network effects'
            ],
            operations: [
              'info - Tool information',
              'schelling - Schelling segregation model',
              'boids - Boid flocking simulation',
              'game_of_life - Conway\'s Game of Life',
              'ant_colony - Ant colony optimization',
              'epidemic - Spatial SIR epidemic',
              'demonstrate - Run demonstrations'
            ]
          }, null, 2)
        };
      }

      case 'schelling': {
        const gridSize = args.grid_size || 20;
        const density = args.parameters?.density || 0.8;
        const threshold = args.parameters?.threshold || 0.3;
        const steps = args.steps || 100;

        const { grid, agents } = createSchellingModel(gridSize, density, 0.5, threshold);

        const history: { step: number; moves: number; happiness: number; segregation: number }[] = [];

        let totalMoves = 0;
        for (let step = 0; step < steps; step++) {
          const result = stepSchelling(grid, agents, threshold);
          totalMoves += result.moves;

          if (step % 10 === 0 || result.moves === 0) {
            history.push({
              step,
              moves: result.moves,
              happiness: Math.round(result.happiness * 100) / 100,
              segregation: Math.round(calculateSegregation(grid, agents) * 100) / 100
            });
          }

          if (result.moves === 0) break;
        }

        // Generate small grid visualization
        const vis: string[] = [];
        const visSize = Math.min(gridSize, 15);
        for (let y = 0; y < visSize; y++) {
          let row = '';
          for (let x = 0; x < visSize; x++) {
            const cell = grid.cells[y][x];
            row += cell ? (cell.type === 0 ? '●' : '○') : ' ';
          }
          vis.push(row);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: 'Schelling Segregation',
            parameters: {
              grid_size: gridSize,
              density,
              threshold,
              agent_count: agents.length,
              type_distribution: {
                type_0: agents.filter(a => a.type === 0).length,
                type_1: agents.filter(a => a.type === 1).length
              }
            },
            results: {
              steps_to_equilibrium: history[history.length - 1].step,
              total_moves: totalMoves,
              final_happiness: history[history.length - 1].happiness,
              final_segregation: history[history.length - 1].segregation
            },
            history: history.slice(0, 10),
            visualization: vis.join('\n'),
            insight: 'Even mild preferences (threshold < 0.5) can lead to high segregation. This demonstrates how individual preferences can produce collective outcomes that no one explicitly desires.'
          }, null, 2)
        };
      }

      case 'boids': {
        const count = args.agent_count || 50;
        const width = args.grid_size || 100;
        const height = args.grid_size || 100;
        const steps = args.steps || 100;

        const params = {
          separationWeight: args.parameters?.separation || 0.05,
          alignmentWeight: args.parameters?.alignment || 0.05,
          cohesionWeight: args.parameters?.cohesion || 0.01,
          visualRange: args.parameters?.visual_range || 20,
          minDistance: args.parameters?.min_distance || 5,
          maxSpeed: args.parameters?.max_speed || 3
        };

        const boids = createBoids(count, width, height);

        const history: { step: number; order: number; centerX: number; centerY: number }[] = [];

        for (let step = 0; step < steps; step++) {
          stepBoids(boids, width, height, params);

          if (step % 10 === 0) {
            const order = calculateFlockOrder(boids);
            const centerX = boids.reduce((s, b) => s + b.x, 0) / count;
            const centerY = boids.reduce((s, b) => s + b.y, 0) / count;
            history.push({
              step,
              order: Math.round(order * 100) / 100,
              centerX: Math.round(centerX),
              centerY: Math.round(centerY)
            });
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: 'Boids Flocking',
            parameters: {
              boid_count: count,
              world_size: { width, height },
              ...params
            },
            rules: {
              separation: 'Avoid crowding neighbors',
              alignment: 'Steer towards average heading of neighbors',
              cohesion: 'Steer towards average position of neighbors'
            },
            results: {
              initial_order: history[0].order,
              final_order: history[history.length - 1].order,
              order_change: Math.round((history[history.length - 1].order - history[0].order) * 100) / 100
            },
            history: history.slice(0, 12),
            sample_positions: boids.slice(0, 5).map(b => ({
              id: b.id,
              x: Math.round(b.x),
              y: Math.round(b.y),
              heading: Math.round(Math.atan2(b.velocity.vy, b.velocity.vx) * 180 / Math.PI)
            })),
            insight: 'Three simple rules create realistic flocking behavior. Order parameter measures collective alignment (1 = perfect flock, 0 = random).'
          }, null, 2)
        };
      }

      case 'game_of_life': {
        const width = args.grid_size || 30;
        const height = args.grid_size || 30;
        const density = args.parameters?.density || 0.3;
        const steps = args.steps || 100;

        let grid = createGameOfLife(width, height, density);

        const history: { step: number; live: number; births: number; deaths: number }[] = [];
        history.push({ step: 0, live: countLiveCells(grid), births: 0, deaths: 0 });

        const initialGrid = gridToString(grid, 20);

        for (let step = 1; step <= steps; step++) {
          const { newGrid, births, deaths } = stepGameOfLife(grid);
          grid = newGrid;

          if (step % 10 === 0 || step === steps) {
            history.push({
              step,
              live: countLiveCells(grid),
              births,
              deaths
            });
          }
        }

        const finalGrid = gridToString(grid, 20);

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: "Conway's Game of Life",
            rules: {
              birth: 'Dead cell with exactly 3 neighbors becomes alive',
              survival: 'Live cell with 2-3 neighbors survives',
              death: 'Live cell with < 2 neighbors dies (underpopulation)',
              overcrowding: 'Live cell with > 3 neighbors dies (overcrowding)'
            },
            parameters: {
              grid_size: `${width}×${height}`,
              initial_density: density
            },
            results: {
              initial_population: history[0].live,
              final_population: history[history.length - 1].live,
              population_change: history[history.length - 1].live - history[0].live
            },
            history: history.slice(0, 12),
            initial_state: initialGrid,
            final_state: finalGrid,
            insight: 'Simple rules create complex patterns including still lifes, oscillators, and gliders. Demonstrates how complexity emerges from simplicity.'
          }, null, 2)
        };
      }

      case 'ant_colony': {
        // Create a small TSP instance
        const cityCount = args.parameters?.cities || 8;
        const antCount = args.agent_count || 10;
        const iterations = args.steps || 50;

        // Generate random city positions
        const cities: { x: number; y: number }[] = [];
        for (let i = 0; i < cityCount; i++) {
          cities.push({ x: Math.random() * 100, y: Math.random() * 100 });
        }

        // Calculate distance matrix
        const distances: number[][] = Array(cityCount).fill(null).map(() => Array(cityCount).fill(0));
        for (let i = 0; i < cityCount; i++) {
          for (let j = 0; j < cityCount; j++) {
            const dx = cities[i].x - cities[j].x;
            const dy = cities[i].y - cities[j].y;
            distances[i][j] = Math.sqrt(dx * dx + dy * dy);
          }
        }

        const alpha = args.parameters?.alpha || 1;
        const beta = args.parameters?.beta || 2;
        const evaporation = args.parameters?.evaporation || 0.5;
        const Q = 100;

        const { pheromones, ants } = createAntColony(distances, antCount, alpha, beta, evaporation, Q);

        let bestPath: number[] = [];
        let bestDistance = Infinity;
        const history: { iteration: number; best: number; average: number }[] = [];

        for (let iter = 0; iter < iterations; iter++) {
          // All ants tour
          for (const ant of ants) {
            antTour(ant, distances, pheromones, alpha, beta);
            if (ant.totalDistance < bestDistance) {
              bestDistance = ant.totalDistance;
              bestPath = [...ant.path];
            }
          }

          // Update pheromones
          updatePheromones(pheromones, ants, evaporation, Q);

          if (iter % 5 === 0) {
            const avg = ants.reduce((s, a) => s + a.totalDistance, 0) / antCount;
            history.push({
              iteration: iter,
              best: Math.round(bestDistance * 10) / 10,
              average: Math.round(avg * 10) / 10
            });
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: 'Ant Colony Optimization',
            problem: 'Traveling Salesman Problem (TSP)',
            parameters: {
              cities: cityCount,
              ants: antCount,
              iterations,
              alpha: `${alpha} (pheromone importance)`,
              beta: `${beta} (distance importance)`,
              evaporation
            },
            results: {
              best_distance: Math.round(bestDistance * 10) / 10,
              best_path: bestPath,
              improvement: Math.round((history[0].best - bestDistance) / history[0].best * 100) + '%'
            },
            history: history.slice(0, 12),
            city_positions: cities.map((c, i) => ({ city: i, x: Math.round(c.x), y: Math.round(c.y) })),
            insight: 'Ants deposit pheromones on good paths, reinforcing them. Evaporation prevents convergence to local optima. Demonstrates swarm intelligence solving NP-hard problems.'
          }, null, 2)
        };
      }

      case 'epidemic': {
        const population = args.agent_count || 200;
        const gridSize = args.grid_size || 100;
        const steps = args.steps || 100;
        const initialInfected = args.parameters?.initial_infected || 5;

        const params = {
          infectionRadius: args.parameters?.infection_radius || 3,
          infectionProb: args.parameters?.infection_prob || 0.3,
          recoveryDays: args.parameters?.recovery_days || 14,
          mobility: args.parameters?.mobility || 2
        };

        const agents = createSIRAgents(population, gridSize, initialInfected);

        const history: { day: number; S: number; I: number; R: number; newInfections: number }[] = [];
        history.push({ day: 0, S: population - initialInfected, I: initialInfected, R: 0, newInfections: initialInfected });

        let peakInfections = initialInfected;
        let peakDay = 0;
        let totalInfections = initialInfected;

        for (let day = 1; day <= steps; day++) {
          const result = stepSIRAgents(
            agents, gridSize,
            params.infectionRadius, params.infectionProb,
            params.recoveryDays, params.mobility
          );

          totalInfections += result.newInfections;

          if (result.I > peakInfections) {
            peakInfections = result.I;
            peakDay = day;
          }

          if (day % 5 === 0 || result.I === 0) {
            history.push({ day, ...result });
          }

          if (result.I === 0) break;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: 'Spatial SIR Epidemic',
            parameters: {
              population,
              grid_size: gridSize,
              initial_infected: initialInfected,
              ...params
            },
            results: {
              total_infected: totalInfections,
              attack_rate: Math.round(totalInfections / population * 100) + '%',
              peak_infections: peakInfections,
              peak_day: peakDay,
              epidemic_duration: history[history.length - 1].day
            },
            history: history.slice(0, 15),
            insight: 'Spatial structure and mobility significantly affect epidemic dynamics. Reducing mobility (social distancing) can flatten the curve and reduce total infections.'
          }, null, 2)
        };
      }

      case 'demonstrate': {
        // Quick demos of each model
        const schellingDemo = (() => {
          const { grid, agents } = createSchellingModel(10, 0.8, 0.5, 0.3);
          const initial = calculateSegregation(grid, agents);
          for (let i = 0; i < 50; i++) {
            const { moves } = stepSchelling(grid, agents, 0.3);
            if (moves === 0) break;
          }
          return { initial: Math.round(initial * 100), final: Math.round(calculateSegregation(grid, agents) * 100) };
        })();

        const boidsDemo = (() => {
          const boids = createBoids(30, 50, 50);
          const initial = calculateFlockOrder(boids);
          for (let i = 0; i < 50; i++) {
            stepBoids(boids, 50, 50, {
              separationWeight: 0.05, alignmentWeight: 0.05, cohesionWeight: 0.01,
              visualRange: 15, minDistance: 3, maxSpeed: 2
            });
          }
          return { initial: Math.round(initial * 100), final: Math.round(calculateFlockOrder(boids) * 100) };
        })();

        const golDemo = (() => {
          let grid = createGameOfLife(20, 20, 0.3);
          const initial = countLiveCells(grid);
          for (let i = 0; i < 50; i++) {
            const { newGrid } = stepGameOfLife(grid);
            grid = newGrid;
          }
          return { initial, final: countLiveCells(grid) };
        })();

        return {
          toolCallId: id,
          content: JSON.stringify({
            demonstration: 'Agent-Based Modeling',
            models: [
              {
                name: 'Schelling Segregation',
                description: 'Mild preferences lead to high segregation',
                result: `Segregation: ${schellingDemo.initial}% → ${schellingDemo.final}%`
              },
              {
                name: 'Boids Flocking',
                description: 'Three simple rules create realistic flocking',
                result: `Order: ${boidsDemo.initial}% → ${boidsDemo.final}%`
              },
              {
                name: "Conway's Game of Life",
                description: 'Four rules create complex emergent patterns',
                result: `Population: ${golDemo.initial} → ${golDemo.final}`
              }
            ],
            key_insights: [
              'Simple individual rules → complex collective behavior',
              'Emergence: whole is greater than sum of parts',
              'Heterogeneity and randomness create realistic dynamics',
              'Small changes in rules can lead to dramatically different outcomes'
            ],
            applications: [
              'Urban planning and traffic',
              'Epidemiology and public health',
              'Financial markets',
              'Ecology and population dynamics',
              'Social dynamics and opinion formation'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            available_operations: ['info', 'schelling', 'boids', 'game_of_life', 'ant_colony', 'epidemic', 'demonstrate']
          }, null, 2)
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isagentbasedmodelAvailable(): boolean { return true; }
