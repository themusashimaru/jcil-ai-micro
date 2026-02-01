// ============================================================================
// CELLULAR AUTOMATA TOOL - TIER GODMODE
// ============================================================================
// Conway's Game of Life, Elementary Cellular Automata (Wolfram), Langton's Ant,
// and other cellular automata simulations.
// Pure TypeScript implementation.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type Grid = boolean[][];
type Rule = number; // 0-255 for elementary CA

interface CAState {
  grid: Grid;
  generation: number;
  population: number;
}

interface Pattern {
  name: string;
  cells: [number, number][];
  description: string;
}

// ============================================================================
// GAME OF LIFE
// ============================================================================

function createGrid(width: number, height: number, random: boolean = false): Grid {
  const grid: Grid = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(random ? Math.random() < 0.3 : false);
    }
    grid.push(row);
  }
  return grid;
}

function countNeighbors(grid: Grid, x: number, y: number): number {
  const height = grid.length;
  const width = grid[0].length;
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const ny = (y + dy + height) % height;
      const nx = (x + dx + width) % width;

      if (grid[ny][nx]) count++;
    }
  }

  return count;
}

function stepGameOfLife(grid: Grid): Grid {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid: Grid = [];

  for (let y = 0; y < height; y++) {
    const newRow: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const neighbors = countNeighbors(grid, x, y);
      const alive = grid[y][x];

      // Conway's rules
      if (alive) {
        newRow.push(neighbors === 2 || neighbors === 3);
      } else {
        newRow.push(neighbors === 3);
      }
    }
    newGrid.push(newRow);
  }

  return newGrid;
}

function runGameOfLife(
  initialGrid: Grid,
  generations: number
): { history: CAState[]; stable: boolean; period?: number } {
  const history: CAState[] = [];
  const grid = initialGrid;

  // Track seen states for cycle detection
  const seenStates = new Map<string, number>();

  for (let gen = 0; gen <= generations; gen++) {
    const population = grid.flat().filter((c) => c).length;
    history.push({ grid: grid.map((row) => [...row]), generation: gen, population });

    const stateKey = grid.map((row) => row.map((c) => (c ? '1' : '0')).join('')).join('|');

    if (seenStates.has(stateKey)) {
      const cycleStart = seenStates.get(stateKey)!;
      return {
        history,
        stable: true,
        period: gen - cycleStart,
      };
    }

    seenStates.set(stateKey, gen);

    if (gen < generations) {
      grid = stepGameOfLife(grid);
    }
  }

  return { history, stable: false };
}

function placePattern(grid: Grid, pattern: [number, number][], centerX: number, centerY: number): Grid {
  const newGrid = grid.map((row) => [...row]);
  for (const [dx, dy] of pattern) {
    const x = (centerX + dx + grid[0].length) % grid[0].length;
    const y = (centerY + dy + grid.length) % grid.length;
    newGrid[y][x] = true;
  }
  return newGrid;
}

// Famous patterns
const PATTERNS: Record<string, Pattern> = {
  glider: {
    name: 'Glider',
    cells: [
      [0, -1],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ],
    description: 'The smallest spaceship - moves diagonally',
  },
  blinker: {
    name: 'Blinker',
    cells: [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    description: 'Period-2 oscillator',
  },
  toad: {
    name: 'Toad',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ],
    description: 'Period-2 oscillator',
  },
  beacon: {
    name: 'Beacon',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [3, 2],
      [2, 3],
      [3, 3],
    ],
    description: 'Period-2 oscillator',
  },
  pulsar: {
    name: 'Pulsar',
    cells: [
      // Top left quadrant (mirrored)
      [-2, -4], [-3, -4], [-4, -4],
      [-4, -2], [-4, -3],
      [-2, -1], [-3, -1], [-4, -1],
      [-1, -2], [-1, -3], [-1, -4],
      // Top right
      [2, -4], [3, -4], [4, -4],
      [4, -2], [4, -3],
      [2, -1], [3, -1], [4, -1],
      [1, -2], [1, -3], [1, -4],
      // Bottom left
      [-2, 4], [-3, 4], [-4, 4],
      [-4, 2], [-4, 3],
      [-2, 1], [-3, 1], [-4, 1],
      [-1, 2], [-1, 3], [-1, 4],
      // Bottom right
      [2, 4], [3, 4], [4, 4],
      [4, 2], [4, 3],
      [2, 1], [3, 1], [4, 1],
      [1, 2], [1, 3], [1, 4],
    ],
    description: 'Period-3 oscillator',
  },
  block: {
    name: 'Block',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    description: 'Still life - stable pattern',
  },
  beehive: {
    name: 'Beehive',
    cells: [
      [0, -1],
      [1, -1],
      [-1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    description: 'Still life - stable pattern',
  },
  lwss: {
    name: 'Lightweight Spaceship',
    cells: [
      [0, 0],
      [3, 0],
      [4, 1],
      [0, 2],
      [4, 2],
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 3],
    ],
    description: 'Spaceship that moves horizontally',
  },
  rpentomino: {
    name: 'R-pentomino',
    cells: [
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [0, 1],
    ],
    description: 'Methuselah - takes 1103 generations to stabilize',
  },
  acorn: {
    name: 'Acorn',
    cells: [
      [-3, 0],
      [-2, 0],
      [-2, -2],
      [0, -1],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    description: 'Methuselah - takes 5206 generations to stabilize',
  },
  gosper_glider_gun: {
    name: 'Gosper Glider Gun',
    cells: [
      // Left square
      [0, 4], [0, 5], [1, 4], [1, 5],
      // Left part
      [10, 4], [10, 5], [10, 6],
      [11, 3], [11, 7],
      [12, 2], [12, 8],
      [13, 2], [13, 8],
      [14, 5],
      [15, 3], [15, 7],
      [16, 4], [16, 5], [16, 6],
      [17, 5],
      // Right part
      [20, 2], [20, 3], [20, 4],
      [21, 2], [21, 3], [21, 4],
      [22, 1], [22, 5],
      [24, 0], [24, 1], [24, 5], [24, 6],
      // Right square
      [34, 2], [34, 3], [35, 2], [35, 3],
    ],
    description: 'First discovered gun - emits gliders',
  },
};

// ============================================================================
// ELEMENTARY CELLULAR AUTOMATA (1D)
// ============================================================================

function applyRule(left: boolean, center: boolean, right: boolean, rule: Rule): boolean {
  const index = (left ? 4 : 0) + (center ? 2 : 0) + (right ? 1 : 0);
  return ((rule >> index) & 1) === 1;
}

function stepElementaryCA(row: boolean[], rule: Rule): boolean[] {
  const width = row.length;
  const newRow: boolean[] = [];

  for (let i = 0; i < width; i++) {
    const left = row[(i - 1 + width) % width];
    const center = row[i];
    const right = row[(i + 1) % width];
    newRow.push(applyRule(left, center, right, rule));
  }

  return newRow;
}

function runElementaryCA(
  width: number,
  rule: Rule,
  generations: number,
  initialState?: boolean[]
): boolean[][] {
  const history: boolean[][] = [];

  // Initial state: single cell in center, or provided state
  let row: boolean[];
  if (initialState) {
    row = initialState;
  } else {
    row = new Array(width).fill(false);
    row[Math.floor(width / 2)] = true;
  }

  history.push([...row]);

  for (let gen = 0; gen < generations; gen++) {
    row = stepElementaryCA(row, rule);
    history.push([...row]);
  }

  return history;
}

function getRuleDescription(rule: Rule): string {
  const famous: Record<number, string> = {
    30: 'Chaotic - used for random number generation',
    90: 'Sierpinski triangle pattern',
    110: 'Turing complete - capable of universal computation',
    184: 'Traffic flow model',
    250: 'Simple growth pattern',
    54: 'Complex nested patterns',
    60: 'Sierpinski-like with asymmetry',
    150: 'Reversible rule (with its inverse)',
  };

  return famous[rule] || 'Custom rule';
}

// ============================================================================
// LANGTON'S ANT
// ============================================================================

type Direction = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left

interface AntState {
  x: number;
  y: number;
  direction: Direction;
}

function stepLangtonsAnt(
  grid: Grid,
  ant: AntState
): { grid: Grid; ant: AntState } {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid = grid.map((row) => [...row]);

  // Turn based on current cell color
  const currentCell = grid[ant.y][ant.x];
  let newDirection: Direction;

  if (currentCell) {
    // White cell: turn left
    newDirection = ((ant.direction + 3) % 4) as Direction;
  } else {
    // Black cell: turn right
    newDirection = ((ant.direction + 1) % 4) as Direction;
  }

  // Flip cell color
  newGrid[ant.y][ant.x] = !currentCell;

  // Move forward
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];

  const newX = (ant.x + dx[newDirection] + width) % width;
  const newY = (ant.y + dy[newDirection] + height) % height;

  return {
    grid: newGrid,
    ant: { x: newX, y: newY, direction: newDirection },
  };
}

function runLangtonsAnt(
  width: number,
  height: number,
  steps: number
): { grid: Grid; antPath: { x: number; y: number }[]; highwayDetected: boolean } {
  const grid = createGrid(width, height);
  let ant: AntState = {
    x: Math.floor(width / 2),
    y: Math.floor(height / 2),
    direction: 0,
  };

  const antPath: { x: number; y: number }[] = [{ x: ant.x, y: ant.y }];

  // Track for highway detection
  let consecutiveDirection = 0;
  let lastDirection = ant.direction;

  for (let i = 0; i < steps; i++) {
    const result = stepLangtonsAnt(grid, ant);
    grid = result.grid;
    ant = result.ant;
    antPath.push({ x: ant.x, y: ant.y });

    // Highway detection (after ~10000 steps, ant builds a highway)
    if (ant.direction === lastDirection) {
      consecutiveDirection++;
    } else {
      consecutiveDirection = 0;
    }
    lastDirection = ant.direction;
  }

  return {
    grid,
    antPath,
    highwayDetected: consecutiveDirection > 100,
  };
}

// ============================================================================
// WIREWORLD
// ============================================================================

type WireWorldCell = 'empty' | 'wire' | 'head' | 'tail';

function stepWireWorld(grid: WireWorldCell[][]): WireWorldCell[][] {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid: WireWorldCell[][] = [];

  for (let y = 0; y < height; y++) {
    const newRow: WireWorldCell[] = [];
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];

      if (cell === 'empty') {
        newRow.push('empty');
      } else if (cell === 'head') {
        newRow.push('tail');
      } else if (cell === 'tail') {
        newRow.push('wire');
      } else {
        // Wire: count electron heads in neighborhood
        let heads = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              if (grid[ny][nx] === 'head') heads++;
            }
          }
        }
        newRow.push(heads === 1 || heads === 2 ? 'head' : 'wire');
      }
    }
    newGrid.push(newRow);
  }

  return newGrid;
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function gridToAscii(grid: Grid, alive: string = '█', dead: string = '·'): string {
  return grid.map((row) => row.map((c) => (c ? alive : dead)).join('')).join('\n');
}

function __gridToCompact(grid: Grid): string {
  return grid.map((row) => row.map((c) => (c ? '1' : '0')).join('')).join('\n');
}

function elementaryCAToAscii(history: boolean[][]): string {
  return history.map((row) => row.map((c) => (c ? '█' : ' ')).join('')).join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const cellularAutomataTool: UnifiedTool = {
  name: 'cellular_automata',
  description: `Cellular automata simulations including Conway's Game of Life, Elementary CA, and more.

Operations:
- game_of_life: Run Conway's Game of Life simulation
- elementary_ca: Run 1D elementary cellular automaton (Wolfram rules)
- langtons_ant: Run Langton's Ant simulation
- place_pattern: Place a famous pattern on the grid
- list_patterns: List available Game of Life patterns
- analyze: Analyze a Game of Life configuration
- wireworld: Run Wireworld simulation

Famous Rules (Elementary CA):
- Rule 30: Chaotic, used for RNG
- Rule 90: Sierpinski triangle
- Rule 110: Turing complete!
- Rule 184: Traffic flow`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'game_of_life',
          'elementary_ca',
          'langtons_ant',
          'place_pattern',
          'list_patterns',
          'analyze',
          'wireworld',
        ],
        description: 'Type of cellular automaton',
      },
      width: { type: 'number', description: 'Grid width' },
      height: { type: 'number', description: 'Grid height' },
      generations: { type: 'number', description: 'Number of generations to simulate' },
      rule: { type: 'number', description: 'Rule number for elementary CA (0-255)' },
      pattern: {
        type: 'string',
        description: 'Pattern name (glider, blinker, pulsar, etc.)',
      },
      random: { type: 'boolean', description: 'Initialize with random cells' },
      initial_cells: {
        type: 'string',
        description: 'Initial live cells as JSON array [[x,y], [x,y], ...]',
      },
      steps: { type: 'number', description: 'Number of steps for Langton\'s Ant' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeCellularAutomata(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'game_of_life': {
        const width = Math.min(args.width || 20, 50);
        const height = Math.min(args.height || 20, 50);
        const generations = Math.min(args.generations || 10, 100);
        const random = args.random || false;
        const initialCells = args.initial_cells as [number, number][] | undefined;

        const grid = createGrid(width, height, random);

        if (initialCells && !random) {
          for (const [x, y] of initialCells) {
            if (y >= 0 && y < height && x >= 0 && x < width) {
              grid[y][x] = true;
            }
          }
        }

        const simulation = runGameOfLife(grid, generations);

        // Sample some generations for output
        const sampleIndices = [0, Math.floor(generations / 2), generations].filter(
          (i) => i < simulation.history.length
        );
        const samples = sampleIndices.map((i) => ({
          generation: i,
          population: simulation.history[i].population,
          grid_ascii: gridToAscii(simulation.history[i].grid),
        }));

        result = {
          operation: 'game_of_life',
          dimensions: { width, height },
          generations_simulated: simulation.history.length - 1,
          stable: simulation.stable,
          period: simulation.period,
          initial_population: simulation.history[0].population,
          final_population: simulation.history[simulation.history.length - 1].population,
          samples,
        };
        break;
      }

      case 'elementary_ca': {
        const width = Math.min(args.width || 61, 101);
        const rule = (args.rule ?? 30) as Rule;
        const generations = Math.min(args.generations || 30, 60);

        if (rule < 0 || rule > 255) {
          throw new Error('Rule must be 0-255');
        }

        const history = runElementaryCA(width, rule, generations);

        result = {
          operation: 'elementary_ca',
          rule,
          rule_description: getRuleDescription(rule),
          rule_binary: rule.toString(2).padStart(8, '0'),
          width,
          generations,
          pattern: elementaryCAToAscii(history),
          note: 'Each row is one generation. Rule determines how cells evolve based on their neighborhood.',
        };
        break;
      }

      case 'langtons_ant': {
        const width = Math.min(args.width || 40, 80);
        const height = Math.min(args.height || 40, 80);
        const steps = Math.min(args.steps || 1000, 15000);

        const simulation = runLangtonsAnt(width, height, steps);

        result = {
          operation: 'langtons_ant',
          dimensions: { width, height },
          steps,
          highway_detected: simulation.highwayDetected,
          final_grid: gridToAscii(simulation.grid),
          path_length: simulation.antPath.length,
          note: simulation.highwayDetected
            ? 'Highway behavior detected! After ~10000 steps, the ant builds an infinite diagonal highway.'
            : 'Ant is still in chaotic phase. Run more steps to see highway emergence.',
        };
        break;
      }

      case 'place_pattern': {
        const patternName = args.pattern?.toLowerCase() || 'glider';
        const width = Math.min(args.width || 20, 50);
        const height = Math.min(args.height || 20, 50);
        const generations = Math.min(args.generations || 20, 100);

        const pattern = PATTERNS[patternName];
        if (!pattern) {
          throw new Error(
            `Unknown pattern: ${patternName}. Available: ${Object.keys(PATTERNS).join(', ')}`
          );
        }

        const grid = createGrid(width, height);
        grid = placePattern(grid, pattern.cells, Math.floor(width / 2), Math.floor(height / 2));

        const simulation = runGameOfLife(grid, generations);

        // Show first few and last
        const samples = [0, 1, 2, 3, generations]
          .filter((i) => i < simulation.history.length)
          .map((i) => ({
            generation: i,
            grid: gridToAscii(simulation.history[i].grid),
          }));

        result = {
          operation: 'place_pattern',
          pattern: pattern.name,
          description: pattern.description,
          generations,
          stable: simulation.stable,
          period: simulation.period,
          samples,
        };
        break;
      }

      case 'list_patterns': {
        result = {
          operation: 'list_patterns',
          patterns: Object.entries(PATTERNS).map(([key, p]) => ({
            id: key,
            name: p.name,
            description: p.description,
            cells: p.cells.length,
          })),
          categories: {
            still_lifes: ['block', 'beehive'],
            oscillators: ['blinker', 'toad', 'beacon', 'pulsar'],
            spaceships: ['glider', 'lwss'],
            methuselahs: ['rpentomino', 'acorn'],
            guns: ['gosper_glider_gun'],
          },
        };
        break;
      }

      case 'analyze': {
        const initialCells = args.initial_cells as [number, number][] | undefined;
        if (!initialCells || initialCells.length === 0) {
          throw new Error('initial_cells required for analysis');
        }

        // Determine grid size from cells
        const maxX = Math.max(...initialCells.map((c) => c[0])) + 5;
        const maxY = Math.max(...initialCells.map((c) => c[1])) + 5;
        const minX = Math.min(...initialCells.map((c) => c[0])) - 5;
        const minY = Math.min(...initialCells.map((c) => c[1])) - 5;

        const width = Math.min(Math.max(maxX - minX, 20), 50);
        const height = Math.min(Math.max(maxY - minY, 20), 50);

        const grid = createGrid(width, height);
        for (const [x, y] of initialCells) {
          const gx = x - minX;
          const gy = y - minY;
          if (gy >= 0 && gy < height && gx >= 0 && gx < width) {
            grid[gy][gx] = true;
          }
        }

        const simulation = runGameOfLife(grid, 500);

        let classification: string;
        if (simulation.period === 1) {
          classification = 'Still Life (stable pattern)';
        } else if (simulation.period && simulation.period > 1) {
          classification = `Oscillator (period ${simulation.period})`;
        } else {
          classification = 'Complex/Growing pattern';
        }

        result = {
          operation: 'analyze',
          initial_cells: initialCells.length,
          classification,
          generations_to_stabilize: simulation.stable ? simulation.history.length - 1 : 'not stable within 500 generations',
          period: simulation.period,
          final_population: simulation.history[simulation.history.length - 1].population,
          growth_ratio:
            simulation.history[simulation.history.length - 1].population /
            simulation.history[0].population,
        };
        break;
      }

      case 'wireworld': {
        // Simple demo of wireworld
        const width = 20;
        const height = 5;

        // Create a simple wire with electron
        const grid: WireWorldCell[][] = [];
        for (let y = 0; y < height; y++) {
          const row: WireWorldCell[] = [];
          for (let x = 0; x < width; x++) {
            if (y === 2) {
              if (x === 0) row.push('head');
              else if (x === 1) row.push('tail');
              else row.push('wire');
            } else {
              row.push('empty');
            }
          }
          grid.push(row);
        }

        const generations = 10;
        const history: string[] = [];
        let currentGrid = grid;

        for (let g = 0; g <= generations; g++) {
          const ascii = currentGrid
            .map((row) =>
              row
                .map((c) => {
                  switch (c) {
                    case 'empty':
                      return ' ';
                    case 'wire':
                      return '─';
                    case 'head':
                      return '●';
                    case 'tail':
                      return '○';
                  }
                })
                .join('')
            )
            .join('\n');
          history.push(`Gen ${g}:\n${ascii}`);
          currentGrid = stepWireWorld(currentGrid);
        }

        result = {
          operation: 'wireworld',
          description:
            'Wireworld: A cellular automaton for simulating electronic circuits',
          cells: {
            empty: 'Nothing',
            wire: 'Conductor (─)',
            head: 'Electron head (●)',
            tail: 'Electron tail (○)',
          },
          rules: [
            'Empty → Empty',
            'Electron head → Electron tail',
            'Electron tail → Wire',
            'Wire → Electron head if exactly 1 or 2 neighbors are electron heads',
          ],
          simulation: history.join('\n\n'),
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

export function isCellularAutomataAvailable(): boolean {
  return true;
}
void __gridToCompact; // reserved for compact output
