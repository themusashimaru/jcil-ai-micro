/**
 * WAVE FUNCTION COLLAPSE TOOL
 * Procedural generation using WFC algorithm for tiles, textures, patterns
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Tile { id: string; edges: [string, string, string, string]; weight?: number; }
interface Cell { collapsed: boolean; options: string[]; }

function createGrid(width: number, height: number, tiles: Tile[]): Cell[][] {
  const allIds = tiles.map(t => t.id);
  return Array(height).fill(null).map(() =>
    Array(width).fill(null).map(() => ({ collapsed: false, options: [...allIds] }))
  );
}

function getEntropy(cell: Cell): number {
  return cell.collapsed ? Infinity : cell.options.length;
}

function findLowestEntropy(grid: Cell[][]): { x: number; y: number } | null {
  let minEntropy = Infinity;
  const candidates: { x: number; y: number }[] = [];

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (!grid[y][x].collapsed) {
        const entropy = getEntropy(grid[y][x]);
        if (entropy < minEntropy) {
          minEntropy = entropy;
          candidates.length = 0;
          candidates.push({ x, y });
        } else if (entropy === minEntropy) {
          candidates.push({ x, y });
        }
      }
    }
  }

  return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

function collapse(cell: Cell, tiles: Tile[]): string {
  const weights = cell.options.map(id => tiles.find(t => t.id === id)?.weight || 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < cell.options.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      const chosen = cell.options[i];
      cell.collapsed = true;
      cell.options = [chosen];
      return chosen;
    }
  }

  const chosen = cell.options[0];
  cell.collapsed = true;
  cell.options = [chosen];
  return chosen;
}

function propagate(grid: Cell[][], x: number, y: number, tiles: Tile[]): boolean {
  const stack: { x: number; y: number }[] = [{ x, y }];
  const directions = [
    { dx: 0, dy: -1, edge: 0, opposite: 2 }, // up
    { dx: 1, dy: 0, edge: 1, opposite: 3 },  // right
    { dx: 0, dy: 1, edge: 2, opposite: 0 },  // down
    { dx: -1, dy: 0, edge: 3, opposite: 1 }  // left
  ];

  while (stack.length > 0) {
    const { x: cx, y: cy } = stack.pop()!;
    const currentCell = grid[cy][cx];

    for (const dir of directions) {
      const nx = cx + dir.dx;
      const ny = cy + dir.dy;

      if (nx < 0 || nx >= grid[0].length || ny < 0 || ny >= grid.length) continue;

      const neighbor = grid[ny][nx];
      if (neighbor.collapsed) continue;

      const validEdges = new Set<string>();
      for (const optionId of currentCell.options) {
        const tile = tiles.find(t => t.id === optionId);
        if (tile) validEdges.add(tile.edges[dir.edge]);
      }

      const newOptions = neighbor.options.filter(optionId => {
        const tile = tiles.find(t => t.id === optionId);
        return tile && validEdges.has(tile.edges[dir.opposite]);
      });

      if (newOptions.length === 0) return false; // Contradiction

      if (newOptions.length < neighbor.options.length) {
        neighbor.options = newOptions;
        stack.push({ x: nx, y: ny });
      }
    }
  }

  return true;
}

function wfc(width: number, height: number, tiles: Tile[], maxIterations: number = 10000): string[][] | null {
  const grid = createGrid(width, height, tiles);
  let iterations = 0;

  while (iterations < maxIterations) {
    const cell = findLowestEntropy(grid);
    if (!cell) break; // All collapsed

    collapse(grid[cell.y][cell.x], tiles);
    const success = propagate(grid, cell.x, cell.y, tiles);

    if (!success) return null; // Contradiction
    iterations++;
  }

  return grid.map(row => row.map(cell => cell.options[0] || '?'));
}

const TILE_PRESETS: Record<string, Tile[]> = {
  pipes: [
    { id: '┼', edges: ['1', '1', '1', '1'], weight: 1 },
    { id: '─', edges: ['0', '1', '0', '1'], weight: 3 },
    { id: '│', edges: ['1', '0', '1', '0'], weight: 3 },
    { id: '┌', edges: ['0', '1', '1', '0'], weight: 2 },
    { id: '┐', edges: ['0', '0', '1', '1'], weight: 2 },
    { id: '└', edges: ['1', '1', '0', '0'], weight: 2 },
    { id: '┘', edges: ['1', '0', '0', '1'], weight: 2 },
    { id: '├', edges: ['1', '1', '1', '0'], weight: 1 },
    { id: '┤', edges: ['1', '0', '1', '1'], weight: 1 },
    { id: '┬', edges: ['0', '1', '1', '1'], weight: 1 },
    { id: '┴', edges: ['1', '1', '0', '1'], weight: 1 },
    { id: ' ', edges: ['0', '0', '0', '0'], weight: 5 }
  ],
  terrain: [
    { id: '~', edges: ['w', 'w', 'w', 'w'], weight: 3 }, // water
    { id: '.', edges: ['g', 'g', 'g', 'g'], weight: 5 }, // grass
    { id: '^', edges: ['m', 'm', 'm', 'm'], weight: 2 }, // mountain
    { id: '#', edges: ['f', 'f', 'f', 'f'], weight: 3 }, // forest
    { id: '≈', edges: ['w', 'g', 'w', 'g'], weight: 1 }, // coast
    { id: '/', edges: ['g', 'm', 'g', 'm'], weight: 1 }  // foothills
  ],
  dungeon: [
    { id: '#', edges: ['w', 'w', 'w', 'w'], weight: 4 }, // wall
    { id: '.', edges: ['f', 'f', 'f', 'f'], weight: 3 }, // floor
    { id: '+', edges: ['w', 'f', 'w', 'f'], weight: 1 }, // door h
    { id: '=', edges: ['f', 'w', 'f', 'w'], weight: 1 }, // door v
    { id: '░', edges: ['w', 'f', 'f', 'w'], weight: 2 }, // corner
    { id: '▓', edges: ['f', 'w', 'w', 'f'], weight: 2 }  // corner
  ]
};

function gridToString(grid: string[][]): string {
  return grid.map(row => row.join('')).join('\n');
}

function analyzePattern(grid: string[][]): Record<string, unknown> {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const row of grid) {
    for (const cell of row) {
      counts[cell] = (counts[cell] || 0) + 1;
      total++;
    }
  }

  return {
    dimensions: { width: grid[0].length, height: grid.length },
    tileDistribution: Object.entries(counts).map(([tile, count]) => ({
      tile,
      count,
      percentage: ((count / total) * 100).toFixed(1) + '%'
    })),
    totalTiles: total
  };
}

export const waveFunctionCollapseTool: UnifiedTool = {
  name: 'wave_function_collapse',
  description: 'Wave Function Collapse: generate, presets, analyze, custom tiles',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'presets', 'analyze', 'custom'] },
      preset: { type: 'string' },
      width: { type: 'number' },
      height: { type: 'number' },
      tiles: { type: 'array' },
      maxIterations: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeWaveFunctionCollapse(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const w = args.width || 20;
    const h = args.height || 10;

    switch (args.operation) {
      case 'generate':
        const tiles = TILE_PRESETS[args.preset || 'pipes'] || TILE_PRESETS.pipes;
        const grid = wfc(w, h, tiles, args.maxIterations || 10000);
        if (grid) {
          result = { preset: args.preset || 'pipes', output: gridToString(grid), analysis: analyzePattern(grid) };
        } else {
          result = { error: 'Generation failed due to contradiction', suggestion: 'Try different dimensions or preset' };
        }
        break;
      case 'presets':
        result = {
          presets: Object.keys(TILE_PRESETS),
          details: Object.entries(TILE_PRESETS).map(([name, tiles]) => ({
            name,
            tileCount: tiles.length,
            tiles: tiles.map(t => ({ id: t.id, edges: t.edges, weight: t.weight }))
          }))
        };
        break;
      case 'analyze':
        const analyzeTiles = TILE_PRESETS[args.preset || 'pipes'];
        const analyzeGrid = wfc(w, h, analyzeTiles);
        result = analyzeGrid ? analyzePattern(analyzeGrid) : { error: 'Analysis failed' };
        break;
      case 'custom':
        const customTiles: Tile[] = args.tiles || TILE_PRESETS.pipes;
        const customGrid = wfc(w, h, customTiles, args.maxIterations || 10000);
        result = customGrid
          ? { output: gridToString(customGrid), analysis: analyzePattern(customGrid) }
          : { error: 'Generation failed with custom tiles' };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isWaveFunctionCollapseAvailable(): boolean { return true; }
