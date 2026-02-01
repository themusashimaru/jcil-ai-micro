// ============================================================================
// PATHFINDER TOOL - TIER INFINITY
// ============================================================================
// Advanced pathfinding and routing: A* algorithm, Dijkstra, TSP solver,
// vehicle routing, waypoint optimization, and graph traversal.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Node {
  id: string;
  x?: number;
  y?: number;
}

interface Edge {
  from: string;
  to: string;
  weight: number;
  bidirectional?: boolean;
}

interface PathResult {
  path: string[];
  distance: number;
  visited_count: number;
}

// ============================================================================
// CORE ALGORITHMS
// ============================================================================

class PriorityQueue<T> {
  private items: { element: T; priority: number }[] = [];

  enqueue(element: T, priority: number): void {
    this.items.push({ element, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift()?.element;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

function buildAdjacencyList(edges: Edge[]): Map<string, { neighbor: string; weight: number }[]> {
  const adj = new Map<string, { neighbor: string; weight: number }[]>();

  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push({ neighbor: edge.to, weight: edge.weight });

    if (edge.bidirectional !== false) {
      if (!adj.has(edge.to)) adj.set(edge.to, []);
      adj.get(edge.to)!.push({ neighbor: edge.from, weight: edge.weight });
    }
  }

  return adj;
}

function euclideanDistance(nodes: Map<string, Node>, a: string, b: string): number {
  const nodeA = nodes.get(a);
  const nodeB = nodes.get(b);
  if (!nodeA || !nodeB || nodeA.x === undefined || nodeB.x === undefined) return 0;
  return Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow((nodeA.y || 0) - (nodeB.y || 0), 2));
}

function manhattanDistance(nodes: Map<string, Node>, a: string, b: string): number {
  const nodeA = nodes.get(a);
  const nodeB = nodes.get(b);
  if (!nodeA || !nodeB || nodeA.x === undefined || nodeB.x === undefined) return 0;
  return Math.abs(nodeA.x - nodeB.x) + Math.abs((nodeA.y || 0) - (nodeB.y || 0));
}

function dijkstra(
  adj: Map<string, { neighbor: string; weight: number }[]>,
  start: string,
  end: string
): PathResult {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pq = new PriorityQueue<string>();
  let visited = 0;

  for (const node of adj.keys()) {
    dist.set(node, Infinity);
    prev.set(node, null);
  }
  dist.set(start, 0);
  pq.enqueue(start, 0);

  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    visited++;

    if (current === end) break;

    const neighbors = adj.get(current) || [];
    for (const { neighbor, weight } of neighbors) {
      const alt = (dist.get(current) || Infinity) + weight;
      if (alt < (dist.get(neighbor) || Infinity)) {
        dist.set(neighbor, alt);
        prev.set(neighbor, current);
        pq.enqueue(neighbor, alt);
      }
    }
  }

  const path: string[] = [];
  let current: string | null = end;
  while (current) {
    path.unshift(current);
    current = prev.get(current) || null;
  }

  return {
    path: path[0] === start ? path : [],
    distance: dist.get(end) || Infinity,
    visited_count: visited,
  };
}

function astar(
  adj: Map<string, { neighbor: string; weight: number }[]>,
  nodes: Map<string, Node>,
  start: string,
  end: string,
  heuristic: 'euclidean' | 'manhattan' = 'euclidean'
): PathResult {
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pq = new PriorityQueue<string>();
  const closed = new Set<string>();
  let visited = 0;

  const h = heuristic === 'manhattan' ? manhattanDistance : euclideanDistance;

  gScore.set(start, 0);
  fScore.set(start, h(nodes, start, end));
  pq.enqueue(start, fScore.get(start)!);

  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;

    if (closed.has(current)) continue;
    closed.add(current);
    visited++;

    if (current === end) break;

    const neighbors = adj.get(current) || [];
    for (const { neighbor, weight } of neighbors) {
      if (closed.has(neighbor)) continue;

      const tentativeG = (gScore.get(current) || Infinity) + weight;
      if (tentativeG < (gScore.get(neighbor) || Infinity)) {
        prev.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + h(nodes, neighbor, end));
        pq.enqueue(neighbor, fScore.get(neighbor)!);
      }
    }
  }

  const path: string[] = [];
  let current: string | null = end;
  while (current) {
    path.unshift(current);
    current = prev.get(current) || null;
  }

  return {
    path: path[0] === start ? path : [],
    distance: gScore.get(end) || Infinity,
    visited_count: visited,
  };
}

function tspNearestNeighbor(
  nodes: string[],
  distMatrix: number[][]
): { tour: string[]; distance: number } {
  const n = nodes.length;
  const visited = new Set<number>();
  const tour: number[] = [0];
  visited.add(0);
  let totalDist = 0;

  while (visited.size < n) {
    const current = tour[tour.length - 1];
    let nearest = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distMatrix[current][i] < nearestDist) {
        nearest = i;
        nearestDist = distMatrix[current][i];
      }
    }

    if (nearest !== -1) {
      tour.push(nearest);
      visited.add(nearest);
      totalDist += nearestDist;
    }
  }

  totalDist += distMatrix[tour[tour.length - 1]][0];
  tour.push(0);

  return { tour: tour.map((i) => nodes[i]), distance: totalDist };
}

function tsp2Opt(
  nodes: string[],
  distMatrix: number[][],
  initialTour: number[]
): { tour: string[]; distance: number } {
  const n = nodes.length;
  let tour = [...initialTour];
  let improved = true;

  const tourDistance = (t: number[]): number => {
    let d = 0;
    for (let i = 0; i < t.length - 1; i++) {
      d += distMatrix[t[i]][t[i + 1]];
    }
    return d;
  };

  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const newTour = [
          ...tour.slice(0, i),
          ...tour.slice(i, j + 1).reverse(),
          ...tour.slice(j + 1),
        ];
        if (tourDistance(newTour) < tourDistance(tour)) {
          tour = newTour;
          improved = true;
        }
      }
    }
  }

  return { tour: tour.map((i) => nodes[i]), distance: tourDistance(tour) };
}

function buildDistanceMatrix(nodes: Node[]): number[][] {
  const n = nodes.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        const dx = (nodes[i].x || 0) - (nodes[j].x || 0);
        const dy = (nodes[i].y || 0) - (nodes[j].y || 0);
        matrix[i][j] = Math.sqrt(dx * dx + dy * dy);
      }
    }
  }

  return matrix;
}

function bfs(
  adj: Map<string, { neighbor: string; weight: number }[]>,
  start: string,
  end: string
): PathResult {
  const visited = new Set<string>();
  const prev = new Map<string, string | null>();
  const queue: string[] = [start];
  visited.add(start);
  let visitedCount = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    visitedCount++;

    if (current === end) break;

    const neighbors = adj.get(current) || [];
    for (const { neighbor } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        prev.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  const path: string[] = [];
  let current: string | null = end;
  while (current) {
    path.unshift(current);
    current = prev.get(current) || null;
  }

  const dist = path.length > 1 ? path.length - 1 : Infinity;

  return { path: path[0] === start ? path : [], distance: dist, visited_count: visitedCount };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const pathfinderTool: UnifiedTool = {
  name: 'pathfinder',
  description: `Advanced pathfinding and routing algorithms.

Operations:
- dijkstra: Shortest path using Dijkstra's algorithm
- astar: A* pathfinding with heuristics
- bfs: Breadth-first search for unweighted graphs
- tsp: Traveling Salesman Problem solver
- all_pairs: Find all shortest paths (Floyd-Warshall)
- reachable: Find all reachable nodes from a start`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['dijkstra', 'astar', 'bfs', 'tsp', 'all_pairs', 'reachable'],
        description: 'Algorithm to use',
      },
      nodes: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of nodes [{id: string, x?: number, y?: number}]',
      },
      edges: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Array of edges [{from: string, to: string, weight?: number, bidirectional?: boolean}]',
      },
      start: { type: 'string', description: 'Start node ID' },
      end: { type: 'string', description: 'End/target node ID' },
      heuristic: {
        type: 'string',
        enum: ['euclidean', 'manhattan'],
        description: 'Heuristic for A*',
      },
      optimize: { type: 'boolean', description: 'For TSP, apply 2-opt optimization' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executePathfinder(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    const nodeMap = new Map<string, Node>();
    if (args.nodes) {
      for (const node of args.nodes) {
        nodeMap.set(node.id, node);
      }
    }

    const edges: Edge[] = (args.edges || []).map(
      (e: { from: string; to: string; weight?: number; bidirectional?: boolean }) => ({
        from: e.from,
        to: e.to,
        weight: e.weight ?? 1,
        bidirectional: e.bidirectional ?? true,
      })
    );

    for (const edge of edges) {
      if (!nodeMap.has(edge.from)) nodeMap.set(edge.from, { id: edge.from });
      if (!nodeMap.has(edge.to)) nodeMap.set(edge.to, { id: edge.to });
    }

    const adj = buildAdjacencyList(edges);

    let result: Record<string, unknown>;

    switch (operation) {
      case 'dijkstra': {
        const { start, end } = args;
        if (!start || !end) {
          throw new Error('dijkstra requires start and end nodes');
        }

        const pathResult = dijkstra(adj, start, end);

        result = {
          operation: 'dijkstra',
          inputs: { start, end, num_nodes: nodeMap.size, num_edges: edges.length },
          results: {
            path: pathResult.path,
            path_length: pathResult.path.length,
            total_distance: pathResult.distance,
            nodes_visited: pathResult.visited_count,
            path_found: pathResult.path.length > 0,
          },
        };
        break;
      }

      case 'astar': {
        const { start, end, heuristic } = args;
        if (!start || !end) {
          throw new Error('astar requires start and end nodes');
        }

        const pathResult = astar(adj, nodeMap, start, end, heuristic || 'euclidean');

        result = {
          operation: 'astar',
          inputs: { start, end, heuristic: heuristic || 'euclidean' },
          results: {
            path: pathResult.path,
            path_length: pathResult.path.length,
            total_distance: pathResult.distance,
            nodes_visited: pathResult.visited_count,
            path_found: pathResult.path.length > 0,
          },
          note: 'A* typically visits fewer nodes than Dijkstra when coordinates are provided',
        };
        break;
      }

      case 'bfs': {
        const { start, end } = args;
        if (!start || !end) {
          throw new Error('bfs requires start and end nodes');
        }

        const pathResult = bfs(adj, start, end);

        result = {
          operation: 'bfs',
          inputs: { start, end },
          results: {
            path: pathResult.path,
            path_length: pathResult.path.length,
            edge_count: pathResult.distance,
            nodes_visited: pathResult.visited_count,
            path_found: pathResult.path.length > 0,
          },
          note: 'BFS finds shortest path by edge count (ignores weights)',
        };
        break;
      }

      case 'tsp': {
        const nodes = Array.from(nodeMap.values());
        if (nodes.length < 2) {
          throw new Error('TSP requires at least 2 nodes');
        }

        const hasCoords = nodes.every((n) => n.x !== undefined);
        let distMatrix: number[][];

        if (hasCoords) {
          distMatrix = buildDistanceMatrix(nodes);
        } else {
          const nodeIds = nodes.map((n) => n.id);
          const idxMap = new Map(nodeIds.map((id, i) => [id, i]));
          distMatrix = nodes.map(() => nodes.map(() => Infinity));
          for (let i = 0; i < nodes.length; i++) distMatrix[i][i] = 0;

          for (const edge of edges) {
            const i = idxMap.get(edge.from);
            const j = idxMap.get(edge.to);
            if (i !== undefined && j !== undefined) {
              distMatrix[i][j] = Math.min(distMatrix[i][j], edge.weight);
              if (edge.bidirectional !== false) {
                distMatrix[j][i] = Math.min(distMatrix[j][i], edge.weight);
              }
            }
          }
        }

        const nodeIds = nodes.map((n) => n.id);
        let tspResult = tspNearestNeighbor(nodeIds, distMatrix);

        if (args.optimize !== false) {
          const tourIndices = tspResult.tour.slice(0, -1).map((id) => nodeIds.indexOf(id));
          tourIndices.push(tourIndices[0]);
          const optimized = tsp2Opt(nodeIds, distMatrix, tourIndices);
          tspResult = optimized;
        }

        result = {
          operation: 'tsp',
          inputs: { num_cities: nodes.length, optimized: args.optimize !== false },
          results: {
            tour: tspResult.tour,
            total_distance: tspResult.distance,
            tour_length: tspResult.tour.length,
          },
          note: 'Uses nearest neighbor heuristic with 2-opt improvement (not guaranteed optimal for large problems)',
        };
        break;
      }

      case 'all_pairs': {
        const nodeIds = Array.from(nodeMap.keys());
        const n = nodeIds.length;
        const idxMap = new Map(nodeIds.map((id, i) => [id, i]));

        const dist: number[][] = [];
        const next: (string | null)[][] = [];
        for (let i = 0; i < n; i++) {
          dist[i] = Array(n).fill(Infinity);
          next[i] = Array(n).fill(null);
          dist[i][i] = 0;
        }

        for (const edge of edges) {
          const i = idxMap.get(edge.from)!;
          const j = idxMap.get(edge.to)!;
          dist[i][j] = edge.weight;
          next[i][j] = nodeIds[j];
          if (edge.bidirectional !== false) {
            dist[j][i] = edge.weight;
            next[j][i] = nodeIds[i];
          }
        }

        for (let k = 0; k < n; k++) {
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
              if (dist[i][k] + dist[k][j] < dist[i][j]) {
                dist[i][j] = dist[i][k] + dist[k][j];
                next[i][j] = next[i][k];
              }
            }
          }
        }

        const pairs: { from: string; to: string; distance: number }[] = [];
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i !== j && dist[i][j] !== Infinity) {
              pairs.push({ from: nodeIds[i], to: nodeIds[j], distance: dist[i][j] });
            }
          }
        }

        result = {
          operation: 'all_pairs',
          inputs: { num_nodes: n },
          results: {
            pairs_count: pairs.length,
            shortest_paths: pairs.slice(0, 50),
            truncated: pairs.length > 50,
          },
        };
        break;
      }

      case 'reachable': {
        const { start } = args;
        if (!start) {
          throw new Error('reachable requires a start node');
        }

        const visited = new Set<string>();
        const queue = [start];
        visited.add(start);
        const distances: Record<string, number> = { [start]: 0 };

        while (queue.length > 0) {
          const current = queue.shift()!;
          const neighbors = adj.get(current) || [];

          for (const { neighbor, weight } of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
              distances[neighbor] = (distances[current] || 0) + weight;
            }
          }
        }

        result = {
          operation: 'reachable',
          inputs: { start },
          results: {
            reachable_count: visited.size,
            reachable_nodes: Array.from(visited),
            distances,
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

export function isPathfinderAvailable(): boolean {
  return true;
}
