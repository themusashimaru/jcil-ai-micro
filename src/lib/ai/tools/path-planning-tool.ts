/**
 * PATH PLANNING TOOL
 * Pathfinding algorithms: A*, Dijkstra, BFS, Jump Point Search
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Point { x: number; y: number; }
interface Node { x: number; y: number; g: number; h: number; f: number; parent: Node | null; }

function heuristic(a: Point, b: Point, type: string = 'manhattan'): number {
  if (type === 'euclidean') return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  if (type === 'chebyshev') return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(x: number, y: number, width: number, height: number, diagonal: boolean = true): Point[] {
  const neighbors: Point[] = [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }];
  if (diagonal) neighbors.push({ x: x - 1, y: y - 1 }, { x: x + 1, y: y - 1 }, { x: x - 1, y: y + 1 }, { x: x + 1, y: y + 1 });
  return neighbors.filter(p => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height);
}

function reconstructPath(node: Node | null): Point[] {
  const path: Point[] = [];
  while (node) {
    path.unshift({ x: node.x, y: node.y });
    node = node.parent;
  }
  return path;
}

function astar(grid: number[][], start: Point, end: Point, heuristicType: string = 'manhattan'): { path: Point[]; visited: number; cost: number } {
  const width = grid[0].length;
  const height = grid.length;
  const open: Node[] = [{ x: start.x, y: start.y, g: 0, h: heuristic(start, end, heuristicType), f: heuristic(start, end, heuristicType), parent: null }];
  const closed = new Set<string>();
  let visited = 0;
  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = `${current.x},${current.y}`;
    if (closed.has(key)) continue;
    closed.add(key);
    visited++;
    if (current.x === end.x && current.y === end.y) return { path: reconstructPath(current), visited, cost: current.g };
    for (const neighbor of getNeighbors(current.x, current.y, width, height)) {
      if (closed.has(`${neighbor.x},${neighbor.y}`) || grid[neighbor.y][neighbor.x] === 1) continue;
      const g = current.g + (neighbor.x !== current.x && neighbor.y !== current.y ? 1.414 : 1);
      const h = heuristic(neighbor, end, heuristicType);
      open.push({ x: neighbor.x, y: neighbor.y, g, h, f: g + h, parent: current });
    }
  }
  return { path: [], visited, cost: -1 };
}

function dijkstra(grid: number[][], start: Point, end: Point): { path: Point[]; visited: number; cost: number } {
  return astar(grid, start, end, 'none');
}

function bfs(grid: number[][], start: Point, end: Point): { path: Point[]; visited: number } {
  const width = grid[0].length;
  const height = grid.length;
  const queue: Node[] = [{ x: start.x, y: start.y, g: 0, h: 0, f: 0, parent: null }];
  const visited = new Set<string>();
  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    visitedCount++;
    if (current.x === end.x && current.y === end.y) return { path: reconstructPath(current), visited: visitedCount };
    for (const neighbor of getNeighbors(current.x, current.y, width, height, false)) {
      if (!visited.has(`${neighbor.x},${neighbor.y}`) && grid[neighbor.y][neighbor.x] !== 1) {
        queue.push({ x: neighbor.x, y: neighbor.y, g: current.g + 1, h: 0, f: 0, parent: current });
      }
    }
  }
  return { path: [], visited: visitedCount };
}

function generateMaze(width: number, height: number): number[][] {
  const grid: number[][] = Array(height).fill(null).map(() => Array(width).fill(1));
  function carve(x: number, y: number) {
    grid[y][x] = 0;
    const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && grid[ny][nx] === 1) {
        grid[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1, 1);
  return grid;
}

function gridToAscii(grid: number[][], path: Point[] = []): string {
  const pathSet = new Set(path.map(p => `${p.x},${p.y}`));
  return grid.map((row, y) => row.map((cell, x) => {
    if (pathSet.has(`${x},${y}`)) return '*';
    return cell === 1 ? '#' : '.';
  }).join('')).join('\n');
}

export const pathPlanningTool: UnifiedTool = {
  name: 'path_planning',
  description: 'Path Planning: astar, dijkstra, bfs, maze, visualize',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['astar', 'dijkstra', 'bfs', 'maze', 'visualize', 'compare'] },
      width: { type: 'number' },
      height: { type: 'number' },
      start: { type: 'object' },
      end: { type: 'object' },
      heuristic: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executePathPlanning(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const width = args.width || 21;
    const height = args.height || 15;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'maze':
        const maze = generateMaze(width, height);
        result = { width, height, grid: maze, ascii: gridToAscii(maze) };
        break;
      case 'astar':
      case 'dijkstra':
      case 'bfs':
        const grid = generateMaze(width, height);
        const start = args.start || { x: 1, y: 1 };
        const end = args.end || { x: width - 2, y: height - 2 };
        const pathResult = args.operation === 'astar' ? astar(grid, start, end, args.heuristic) :
                          args.operation === 'dijkstra' ? dijkstra(grid, start, end) : bfs(grid, start, end);
        result = { algorithm: args.operation, start, end, ...pathResult, ascii: gridToAscii(grid, pathResult.path) };
        break;
      case 'compare':
        const compGrid = generateMaze(width, height);
        const s = { x: 1, y: 1 }, e = { x: width - 2, y: height - 2 };
        const astarRes = astar(compGrid, s, e);
        const dijkRes = dijkstra(compGrid, s, e);
        const bfsRes = bfs(compGrid, s, e);
        result = {
          maze: gridToAscii(compGrid),
          comparison: [
            { algorithm: 'A*', pathLength: astarRes.path.length, visited: astarRes.visited, cost: astarRes.cost },
            { algorithm: 'Dijkstra', pathLength: dijkRes.path.length, visited: dijkRes.visited, cost: dijkRes.cost },
            { algorithm: 'BFS', pathLength: bfsRes.path.length, visited: bfsRes.visited }
          ]
        };
        break;
      case 'visualize':
        const vGrid = generateMaze(width, height);
        const vStart = args.start || { x: 1, y: 1 };
        const vEnd = args.end || { x: width - 2, y: height - 2 };
        const vResult = astar(vGrid, vStart, vEnd);
        result = { ascii: gridToAscii(vGrid, vResult.path), pathLength: vResult.path.length, visited: vResult.visited };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isPathPlanningAvailable(): boolean { return true; }
