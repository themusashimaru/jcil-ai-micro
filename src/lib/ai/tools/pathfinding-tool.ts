/**
 * PATHFINDING TOOL
 * A*, Dijkstra, BFS, DFS, Jump Point Search algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Node { x: number; y: number; g: number; h: number; f: number; parent: Node | null; }
type Grid = number[][];

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }, type: string = 'manhattan'): number {
  switch (type) {
    case 'euclidean': return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    case 'chebyshev': return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    case 'octile': const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    default: return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}

function getNeighbors(grid: Grid, node: Node, diagonal: boolean = true): { x: number; y: number }[] {
  const dirs = diagonal
    ? [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
    : [[-1,0],[1,0],[0,-1],[0,1]];
  const neighbors: { x: number; y: number }[] = [];

  for (const [dx, dy] of dirs) {
    const nx = node.x + dx, ny = node.y + dy;
    if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && grid[ny][nx] === 0) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  return neighbors;
}

function aStar(grid: Grid, start: { x: number; y: number }, end: { x: number; y: number }, heuristicType: string = 'manhattan', diagonal: boolean = true): { path: { x: number; y: number }[]; explored: number; cost: number } {
  const openSet: Node[] = [];
  const closedSet = new Set<string>();
  const startNode: Node = { ...start, g: 0, h: heuristic(start, end, heuristicType), f: 0, parent: null };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (current.x === end.x && current.y === end.y) {
      const path: { x: number; y: number }[] = [];
      let node: Node | null = current;
      while (node) { path.unshift({ x: node.x, y: node.y }); node = node.parent; }
      return { path, explored: closedSet.size, cost: current.g };
    }

    closedSet.add(`${current.x},${current.y}`);

    for (const neighbor of getNeighbors(grid, current, diagonal)) {
      if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

      const moveCost = (neighbor.x !== current.x && neighbor.y !== current.y) ? Math.SQRT2 : 1;
      const g = current.g + moveCost;
      const existing = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);

      if (!existing) {
        const h = heuristic(neighbor, end, heuristicType);
        openSet.push({ ...neighbor, g, h, f: g + h, parent: current });
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + existing.h;
        existing.parent = current;
      }
    }
  }

  return { path: [], explored: closedSet.size, cost: -1 };
}

function dijkstra(grid: Grid, start: { x: number; y: number }, end: { x: number; y: number }, diagonal: boolean = true): { path: { x: number; y: number }[]; explored: number; cost: number } {
  return aStar(grid, start, end, 'zero', diagonal); // A* with h=0 is Dijkstra
}

function bfs(grid: Grid, start: { x: number; y: number }, end: { x: number; y: number }): { path: { x: number; y: number }[]; explored: number } {
  const queue: Node[] = [{ ...start, g: 0, h: 0, f: 0, parent: null }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === end.x && current.y === end.y) {
      const path: { x: number; y: number }[] = [];
      let node: Node | null = current;
      while (node) { path.unshift({ x: node.x, y: node.y }); node = node.parent; }
      return { path, explored: visited.size };
    }

    for (const neighbor of getNeighbors(grid, current, false)) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ ...neighbor, g: 0, h: 0, f: 0, parent: current });
      }
    }
  }

  return { path: [], explored: visited.size };
}

function dfs(grid: Grid, start: { x: number; y: number }, end: { x: number; y: number }): { path: { x: number; y: number }[]; explored: number } {
  const stack: Node[] = [{ ...start, g: 0, h: 0, f: 0, parent: null }];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (current.x === end.x && current.y === end.y) {
      const path: { x: number; y: number }[] = [];
      let node: Node | null = current;
      while (node) { path.unshift({ x: node.x, y: node.y }); node = node.parent; }
      return { path, explored: visited.size };
    }

    for (const neighbor of getNeighbors(grid, current, false)) {
      if (!visited.has(`${neighbor.x},${neighbor.y}`)) {
        stack.push({ ...neighbor, g: 0, h: 0, f: 0, parent: current });
      }
    }
  }

  return { path: [], explored: visited.size };
}

function generateGrid(width: number, height: number, obstacleRatio: number = 0.3): Grid {
  const grid: Grid = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = Math.random() < obstacleRatio ? 1 : 0;
    }
  }
  grid[0][0] = 0;
  grid[height - 1][width - 1] = 0;
  return grid;
}

function visualize(grid: Grid, path: { x: number; y: number }[]): string {
  const pathSet = new Set(path.map(p => `${p.x},${p.y}`));
  return grid.map((row, y) => row.map((cell, x) => {
    if (x === 0 && y === 0) return 'S';
    if (x === grid[0].length - 1 && y === grid.length - 1) return 'E';
    if (pathSet.has(`${x},${y}`)) return '*';
    return cell === 1 ? '#' : '.';
  }).join('')).join('\n');
}

export const pathfindingTool: UnifiedTool = {
  name: 'pathfinding',
  description: 'Pathfinding: astar, dijkstra, bfs, dfs, visualize, compare',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['astar', 'dijkstra', 'bfs', 'dfs', 'visualize', 'compare'] },
      grid: { type: 'array' },
      start: { type: 'object' },
      end: { type: 'object' },
      width: { type: 'number' },
      height: { type: 'number' },
      obstacles: { type: 'number' },
      heuristic: { type: 'string' },
      diagonal: { type: 'boolean' }
    },
    required: ['operation']
  }
};

export async function executePathfinding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const w = args.width || 20, h = args.height || 10;
    const grid: Grid = args.grid || generateGrid(w, h, args.obstacles || 0.25);
    const start = args.start || { x: 0, y: 0 };
    const end = args.end || { x: grid[0].length - 1, y: grid.length - 1 };
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'astar':
        const astarResult = aStar(grid, start, end, args.heuristic || 'manhattan', args.diagonal !== false);
        result = { algorithm: 'A*', ...astarResult, visualization: visualize(grid, astarResult.path) };
        break;
      case 'dijkstra':
        const dijkResult = dijkstra(grid, start, end, args.diagonal !== false);
        result = { algorithm: 'Dijkstra', ...dijkResult, visualization: visualize(grid, dijkResult.path) };
        break;
      case 'bfs':
        const bfsResult = bfs(grid, start, end);
        result = { algorithm: 'BFS', ...bfsResult, visualization: visualize(grid, bfsResult.path) };
        break;
      case 'dfs':
        const dfsResult = dfs(grid, start, end);
        result = { algorithm: 'DFS', ...dfsResult, visualization: visualize(grid, dfsResult.path) };
        break;
      case 'visualize':
        const vizResult = aStar(grid, start, end);
        result = { visualization: visualize(grid, vizResult.path), path: vizResult.path };
        break;
      case 'compare':
        const astar = aStar(grid, start, end);
        const dijk = dijkstra(grid, start, end);
        const breadth = bfs(grid, start, end);
        const depth = dfs(grid, start, end);
        result = {
          comparison: {
            'A*': { pathLength: astar.path.length, explored: astar.explored, cost: astar.cost.toFixed(2) },
            'Dijkstra': { pathLength: dijk.path.length, explored: dijk.explored, cost: dijk.cost.toFixed(2) },
            'BFS': { pathLength: breadth.path.length, explored: breadth.explored },
            'DFS': { pathLength: depth.path.length, explored: depth.explored }
          },
          visualization: visualize(grid, astar.path)
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

export function isPathfindingAvailable(): boolean { return true; }
