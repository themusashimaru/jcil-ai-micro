/**
 * ARTIFICIAL LIFE TOOL
 * Cellular automata, evolution simulation, and emergent behavior
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Creature { id: number; x: number; y: number; energy: number; genes: number[]; age: number; generation: number; }
interface World { width: number; height: number; creatures: Creature[]; food: Array<{ x: number; y: number; energy: number }>; generation: number; }

// Conway's Game of Life
function createLifeGrid(width: number, height: number, density: number = 0.3): boolean[][] {
  return Array(height).fill(null).map(() =>
    Array(width).fill(null).map(() => Math.random() < density)
  );
}

function countNeighbors(grid: boolean[][], x: number, y: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ny = (y + dy + grid.length) % grid.length;
      const nx = (x + dx + grid[0].length) % grid[0].length;
      if (grid[ny][nx]) count++;
    }
  }
  return count;
}

function stepLife(grid: boolean[][]): boolean[][] {
  return grid.map((row, y) =>
    row.map((cell, x) => {
      const neighbors = countNeighbors(grid, x, y);
      return neighbors === 3 || (cell && neighbors === 2);
    })
  );
}

function runLife(width: number, height: number, steps: number): { initial: string; final: string; population: number[] } {
  let grid = createLifeGrid(width, height, 0.25);
  const initial = gridToAscii(grid);
  const population: number[] = [];

  for (let i = 0; i < steps; i++) {
    grid = stepLife(grid);
    population.push(grid.flat().filter(c => c).length);
  }

  return { initial, final: gridToAscii(grid), population };
}

function gridToAscii(grid: boolean[][]): string {
  return grid.map(row => row.map(cell => cell ? '█' : ' ').join('')).join('\n');
}

// Langton's Ant
function runLangtonsAnt(width: number, height: number, steps: number): string {
  const grid: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  let x = Math.floor(width / 2);
  let y = Math.floor(height / 2);
  let dir = 0; // 0=up, 1=right, 2=down, 3=left
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];

  for (let i = 0; i < steps; i++) {
    if (grid[y][x]) {
      dir = (dir + 3) % 4; // Turn left
    } else {
      dir = (dir + 1) % 4; // Turn right
    }
    grid[y][x] = !grid[y][x];
    x = (x + dx[dir] + width) % width;
    y = (y + dy[dir] + height) % height;
  }

  // Mark ant position
  const result: string[][] = grid.map(row => [...row.map(c => c ? '█' : ' ')]);
  result[y][x] = '▲';
  return result.map(row => row.join('')).join('\n');
}

// Elementary cellular automata (Rule 30, 110, etc.)
function elementaryCA(rule: number, width: number, steps: number): string {
  const ruleBits = rule.toString(2).padStart(8, '0').split('').map(b => b === '1');
  let state = Array(width).fill(false);
  state[Math.floor(width / 2)] = true;

  const lines: string[] = [state.map(c => c ? '█' : ' ').join('')];

  for (let s = 0; s < steps - 1; s++) {
    const newState = Array(width).fill(false);
    for (let i = 0; i < width; i++) {
      const left = state[(i - 1 + width) % width] ? 4 : 0;
      const center = state[i] ? 2 : 0;
      const right = state[(i + 1) % width] ? 1 : 0;
      const index = 7 - (left + center + right);
      newState[i] = ruleBits[index];
    }
    state = newState;
    lines.push(state.map(c => c ? '█' : ' ').join(''));
  }

  return lines.join('\n');
}

// Artificial Life Evolution Simulation
function createWorld(width: number, height: number, numCreatures: number, numFood: number): World {
  const creatures: Creature[] = [];
  for (let i = 0; i < numCreatures; i++) {
    creatures.push({
      id: i,
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      energy: 100,
      genes: Array(5).fill(0).map(() => Math.random()),
      age: 0,
      generation: 1
    });
  }

  const food: Array<{ x: number; y: number; energy: number }> = [];
  for (let i = 0; i < numFood; i++) {
    food.push({
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      energy: 20 + Math.floor(Math.random() * 30)
    });
  }

  return { width, height, creatures, food, generation: 1 };
}

function stepWorld(world: World): World {
  const newCreatures: Creature[] = [];
  const newFood = [...world.food];

  for (const creature of world.creatures) {
    // Move based on genes
    const speed = creature.genes[0] * 3;
    const angle = creature.genes[1] * Math.PI * 2;
    creature.x = (creature.x + Math.cos(angle) * speed + world.width) % world.width;
    creature.y = (creature.y + Math.sin(angle) * speed + world.height) % world.height;

    // Consume energy
    creature.energy -= 1 + creature.genes[0]; // Faster = more energy cost
    creature.age++;

    // Eat food
    for (let i = newFood.length - 1; i >= 0; i--) {
      const f = newFood[i];
      const dist = Math.sqrt(Math.pow(creature.x - f.x, 2) + Math.pow(creature.y - f.y, 2));
      if (dist < 2) {
        creature.energy += f.energy;
        newFood.splice(i, 1);
      }
    }

    // Reproduce if enough energy
    if (creature.energy > 150) {
      creature.energy -= 75;
      const child: Creature = {
        id: world.creatures.length + newCreatures.length,
        x: creature.x + (Math.random() - 0.5) * 5,
        y: creature.y + (Math.random() - 0.5) * 5,
        energy: 75,
        genes: creature.genes.map(g => g + (Math.random() - 0.5) * 0.1),
        age: 0,
        generation: creature.generation + 1
      };
      newCreatures.push(child);
    }

    // Survive?
    if (creature.energy > 0 && creature.age < 500) {
      newCreatures.push(creature);
    }
  }

  // Spawn new food
  while (newFood.length < 50) {
    newFood.push({
      x: Math.floor(Math.random() * world.width),
      y: Math.floor(Math.random() * world.height),
      energy: 20 + Math.floor(Math.random() * 30)
    });
  }

  return {
    ...world,
    creatures: newCreatures,
    food: newFood,
    generation: world.generation + 1
  };
}

function runEvolution(steps: number): { stats: Array<{ gen: number; pop: number; avgGen: number; avgEnergy: number }>; finalCreatures: number } {
  let world = createWorld(100, 100, 20, 50);
  const stats: Array<{ gen: number; pop: number; avgGen: number; avgEnergy: number }> = [];

  for (let i = 0; i < steps; i++) {
    world = stepWorld(world);
    if (i % 10 === 0) {
      const avgGen = world.creatures.reduce((s, c) => s + c.generation, 0) / (world.creatures.length || 1);
      const avgEnergy = world.creatures.reduce((s, c) => s + c.energy, 0) / (world.creatures.length || 1);
      stats.push({
        gen: world.generation,
        pop: world.creatures.length,
        avgGen: Math.round(avgGen * 10) / 10,
        avgEnergy: Math.round(avgEnergy)
      });
    }
  }

  return { stats, finalCreatures: world.creatures.length };
}

function worldToAscii(world: World): string {
  const grid: string[][] = Array(Math.min(world.height, 30)).fill(null).map(() =>
    Array(Math.min(world.width, 60)).fill(' ')
  );

  // Draw food
  for (const f of world.food) {
    const x = Math.floor(f.x * 60 / world.width);
    const y = Math.floor(f.y * 30 / world.height);
    if (y >= 0 && y < 30 && x >= 0 && x < 60) grid[y][x] = '.';
  }

  // Draw creatures
  for (const c of world.creatures) {
    const x = Math.floor(c.x * 60 / world.width);
    const y = Math.floor(c.y * 30 / world.height);
    if (y >= 0 && y < 30 && x >= 0 && x < 60) grid[y][x] = '●';
  }

  return grid.map(row => row.join('')).join('\n');
}

export const artificialLifeTool: UnifiedTool = {
  name: 'artificial_life',
  description: 'Artificial Life: game_of_life, langtons_ant, elementary_ca, evolve, world_sim',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['game_of_life', 'langtons_ant', 'elementary_ca', 'evolve', 'world_sim', 'patterns', 'info'] },
      width: { type: 'number' },
      height: { type: 'number' },
      steps: { type: 'number' },
      rule: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeArtificialLife(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'game_of_life':
        const life = runLife(args.width || 40, args.height || 20, args.steps || 50);
        result = {
          name: "Conway's Game of Life",
          rules: 'B3/S23 (born with 3, survive with 2-3 neighbors)',
          steps: args.steps || 50,
          finalPopulation: life.population[life.population.length - 1],
          grid: life.final
        };
        break;
      case 'langtons_ant':
        const ant = runLangtonsAnt(args.width || 50, args.height || 30, args.steps || 5000);
        result = {
          name: "Langton's Ant",
          rules: 'Turn right on white, turn left on black, flip color, move forward',
          steps: args.steps || 5000,
          grid: ant,
          note: 'Emergent highway behavior appears around 10000 steps'
        };
        break;
      case 'elementary_ca':
        const rule = args.rule || 30;
        const ca = elementaryCA(rule, args.width || 60, args.steps || 30);
        result = {
          name: `Elementary CA Rule ${rule}`,
          rule: rule.toString(2).padStart(8, '0'),
          grid: ca,
          famousRules: { 30: 'Chaotic', 110: 'Turing complete', 90: 'Sierpinski triangle' }
        };
        break;
      case 'evolve':
        const evolution = runEvolution(args.steps || 200);
        result = {
          simulation: 'Artificial Life Evolution',
          generations: args.steps || 200,
          finalPopulation: evolution.finalCreatures,
          stats: evolution.stats.slice(-10),
          observation: 'Watch average generation increase as fit creatures reproduce'
        };
        break;
      case 'world_sim':
        let world = createWorld(100, 100, 15, 40);
        for (let i = 0; i < (args.steps || 50); i++) world = stepWorld(world);
        result = {
          simulation: 'Creature World',
          generation: world.generation,
          creatures: world.creatures.length,
          food: world.food.length,
          visualization: worldToAscii(world),
          legend: '● = creature, . = food'
        };
        break;
      case 'patterns':
        result = {
          gameOfLife: {
            stillLifes: ['Block', 'Beehive', 'Loaf', 'Boat'],
            oscillators: ['Blinker', 'Toad', 'Beacon', 'Pulsar'],
            spaceships: ['Glider', 'LWSS', 'MWSS', 'HWSS'],
            guns: ['Gosper Glider Gun']
          },
          elementaryCA: {
            chaotic: [30, 45, 73, 86],
            complex: [110, 124],
            periodic: [90, 150]
          }
        };
        break;
      case 'info':
        result = {
          description: 'Artificial life and cellular automata simulations',
          simulations: {
            game_of_life: "Conway's classic cellular automaton",
            langtons_ant: '2D Turing machine with emergent behavior',
            elementary_ca: '1D cellular automata (Wolfram rules)',
            evolve: 'Creature evolution with genetic inheritance'
          },
          concepts: ['Emergence', 'Self-organization', 'Complexity from simple rules']
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isArtificialLifeAvailable(): boolean { return true; }
