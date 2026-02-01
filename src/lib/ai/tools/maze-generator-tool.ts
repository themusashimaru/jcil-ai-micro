/**
 * MAZE GENERATOR TOOL
 * Generate mazes using various algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type Cell = { x: number; y: number; walls: { n: boolean; s: boolean; e: boolean; w: boolean }; visited: boolean };
type Maze = Cell[][];

function createGrid(width: number, height: number): Maze {
  const grid: Maze = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = { x, y, walls: { n: true, s: true, e: true, w: true }, visited: false };
    }
  }
  return grid;
}

function getNeighbors(grid: Maze, cell: Cell, unvisitedOnly: boolean = true): Cell[] {
  const { x, y } = cell;
  const neighbors: Cell[] = [];
  if (y > 0) neighbors.push(grid[y - 1][x]);
  if (y < grid.length - 1) neighbors.push(grid[y + 1][x]);
  if (x > 0) neighbors.push(grid[y][x - 1]);
  if (x < grid[0].length - 1) neighbors.push(grid[y][x + 1]);
  return unvisitedOnly ? neighbors.filter(n => !n.visited) : neighbors;
}

function removeWall(a: Cell, b: Cell): void {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 1) { a.walls.e = false; b.walls.w = false; }
  if (dx === -1) { a.walls.w = false; b.walls.e = false; }
  if (dy === 1) { a.walls.s = false; b.walls.n = false; }
  if (dy === -1) { a.walls.n = false; b.walls.s = false; }
}

function dfs(width: number, height: number): Maze {
  const grid = createGrid(width, height);
  const stack: Cell[] = [];
  let current = grid[0][0];
  current.visited = true;
  stack.push(current);

  while (stack.length > 0) {
    const neighbors = getNeighbors(grid, current);
    if (neighbors.length > 0) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      removeWall(current, next);
      next.visited = true;
      stack.push(current);
      current = next;
    } else {
      current = stack.pop()!;
    }
  }
  return grid;
}

function prims(width: number, height: number): Maze {
  const grid = createGrid(width, height);
  const walls: Array<{ cell: Cell; neighbor: Cell }> = [];

  const start = grid[0][0];
  start.visited = true;
  getNeighbors(grid, start, false).forEach(n => walls.push({ cell: start, neighbor: n }));

  while (walls.length > 0) {
    const idx = Math.floor(Math.random() * walls.length);
    const { cell, neighbor } = walls.splice(idx, 1)[0];
    if (!neighbor.visited) {
      removeWall(cell, neighbor);
      neighbor.visited = true;
      getNeighbors(grid, neighbor, true).forEach(n => walls.push({ cell: neighbor, neighbor: n }));
    }
  }
  return grid;
}

function kruskals(width: number, height: number): Maze {
  const grid = createGrid(width, height);
  const sets = new Map<string, Set<string>>();
  const edges: Array<{ a: Cell; b: Cell }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      sets.set(key, new Set([key]));
      if (x < width - 1) edges.push({ a: grid[y][x], b: grid[y][x + 1] });
      if (y < height - 1) edges.push({ a: grid[y][x], b: grid[y + 1][x] });
    }
  }

  // Shuffle edges
  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }

  for (const { a, b } of edges) {
    const keyA = `${a.x},${a.y}`, keyB = `${b.x},${b.y}`;
    const setA = [...sets.entries()].find(([, s]) => s.has(keyA))?.[1];
    const setB = [...sets.entries()].find(([, s]) => s.has(keyB))?.[1];
    if (setA && setB && setA !== setB) {
      removeWall(a, b);
      setB.forEach(k => setA.add(k));
      sets.forEach((s, key) => { if (s === setB) sets.delete(key); });
    }
  }
  return grid;
}

function recursiveDivision(width: number, height: number): Maze {
  const grid = createGrid(width, height);
  // Remove all walls first
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < width - 1) { grid[y][x].walls.e = false; grid[y][x + 1].walls.w = false; }
      if (y < height - 1) { grid[y][x].walls.s = false; grid[y + 1][x].walls.n = false; }
    }
  }

  function divide(x: number, y: number, w: number, h: number, horizontal: boolean): void {
    if (w < 2 || h < 2) return;

    if (horizontal) {
      const py = y + Math.floor(Math.random() * (h - 1));
      const px = x + Math.floor(Math.random() * w);
      for (let i = x; i < x + w; i++) {
        if (i !== px) {
          grid[py][i].walls.s = true;
          grid[py + 1][i].walls.n = true;
        }
      }
      divide(x, y, w, py - y + 1, w > py - y + 1);
      divide(x, py + 1, w, y + h - py - 1, w > y + h - py - 1);
    } else {
      const px = x + Math.floor(Math.random() * (w - 1));
      const py = y + Math.floor(Math.random() * h);
      for (let i = y; i < y + h; i++) {
        if (i !== py) {
          grid[i][px].walls.e = true;
          grid[i][px + 1].walls.w = true;
        }
      }
      divide(x, y, px - x + 1, h, px - x + 1 > h);
      divide(px + 1, y, x + w - px - 1, h, x + w - px - 1 > h);
    }
  }

  divide(0, 0, width, height, width < height);
  return grid;
}

function mazeToAscii(grid: Maze): string {
  const height = grid.length, width = grid[0].length;
  const lines: string[] = [];

  // Top border
  lines.push('+' + grid[0].map(() => '---+').join(''));

  for (let y = 0; y < height; y++) {
    let row = '|';
    let bottom = '+';
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      row += '   ' + (cell.walls.e ? '|' : ' ');
      bottom += (cell.walls.s ? '---' : '   ') + '+';
    }
    lines.push(row);
    lines.push(bottom);
  }
  return lines.join('\n');
}

function mazeToGrid(grid: Maze): number[][] {
  const height = grid.length, width = grid[0].length;
  const result: number[][] = [];
  for (let y = 0; y < height * 2 + 1; y++) result[y] = [];

  for (let y = 0; y <= height * 2; y++) {
    for (let x = 0; x <= width * 2; x++) {
      if (y % 2 === 0 || x % 2 === 0) result[y][x] = 1; // Wall
      else result[y][x] = 0; // Path
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      if (!cell.walls.e && x < width - 1) result[y * 2 + 1][x * 2 + 2] = 0;
      if (!cell.walls.s && y < height - 1) result[y * 2 + 2][x * 2 + 1] = 0;
    }
  }
  return result;
}

export const mazeGeneratorTool: UnifiedTool = {
  name: 'maze_generator',
  description: 'Maze Generator: dfs, prims, kruskals, recursive_division, ascii, grid',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['dfs', 'prims', 'kruskals', 'recursive_division', 'ascii', 'grid'] },
      width: { type: 'number' },
      height: { type: 'number' },
      algorithm: { type: 'string', enum: ['dfs', 'prims', 'kruskals', 'recursive_division'] }
    },
    required: ['operation']
  }
};

export async function executeMazeGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const w = args.width || 10, h = args.height || 10;
    const algo = args.algorithm || 'dfs';
    let maze: Maze;

    const generate = (): Maze => {
      switch (algo) {
        case 'prims': return prims(w, h);
        case 'kruskals': return kruskals(w, h);
        case 'recursive_division': return recursiveDivision(w, h);
        default: return dfs(w, h);
      }
    };

    switch (args.operation) {
      case 'dfs': maze = dfs(w, h); break;
      case 'prims': maze = prims(w, h); break;
      case 'kruskals': maze = kruskals(w, h); break;
      case 'recursive_division': maze = recursiveDivision(w, h); break;
      case 'ascii': maze = generate(); return { toolCallId: id, content: mazeToAscii(maze) };
      case 'grid': maze = generate(); return { toolCallId: id, content: JSON.stringify({ grid: mazeToGrid(maze) }, null, 2) };
      default: throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify({ algorithm: algo, width: w, height: h, ascii: mazeToAscii(maze) }, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isMazeGeneratorAvailable(): boolean { return true; }
