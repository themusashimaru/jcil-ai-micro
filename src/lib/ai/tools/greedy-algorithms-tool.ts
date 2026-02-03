/**
 * GREEDY ALGORITHMS TOOL
 *
 * Classic greedy algorithms with optimality proofs and exchange arguments.
 * Demonstrates the greedy choice property and optimal substructure.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface GreedyResult {
  algorithm: string;
  input: unknown;
  output: unknown;
  optimalityGuarantee: string;
  complexity: { time: string; space: string };
  greedyChoices: string[];
}

// ============================================================================
// ACTIVITY SELECTION
// ============================================================================

interface Activity {
  id: number;
  start: number;
  finish: number;
}

function activitySelection(activities: Activity[]): GreedyResult {
  // Sort by finish time (greedy choice: earliest finish first)
  const sorted = [...activities].sort((a, b) => a.finish - b.finish);
  const choices: string[] = [];

  const selected: Activity[] = [];
  let lastFinish = 0;

  for (const activity of sorted) {
    if (activity.start >= lastFinish) {
      selected.push(activity);
      choices.push(`Select activity ${activity.id} [${activity.start}, ${activity.finish}] - earliest finish that doesn't overlap`);
      lastFinish = activity.finish;
    } else {
      choices.push(`Skip activity ${activity.id} [${activity.start}, ${activity.finish}] - overlaps with selected`);
    }
  }

  return {
    algorithm: 'Activity Selection',
    input: { activities, count: activities.length },
    output: {
      selectedActivities: selected,
      count: selected.length,
      totalTime: selected.reduce((sum, a) => sum + (a.finish - a.start), 0)
    },
    optimalityGuarantee: 'Optimal - exchange argument: replacing any selected activity with an overlapping one cannot improve the solution',
    complexity: { time: 'O(n log n) for sorting', space: 'O(n)' },
    greedyChoices: choices.slice(0, 15)
  };
}

// ============================================================================
// FRACTIONAL KNAPSACK
// ============================================================================

interface Item {
  id: number;
  weight: number;
  value: number;
}

function fractionalKnapsack(items: Item[], capacity: number): GreedyResult {
  // Sort by value/weight ratio (greedy choice: best value per unit weight)
  const sorted = [...items].map(item => ({
    ...item,
    ratio: item.value / item.weight
  })).sort((a, b) => b.ratio - a.ratio);

  const choices: string[] = [];
  let remainingCapacity = capacity;
  let totalValue = 0;
  const selected: Array<{ item: Item; fraction: number; value: number }> = [];

  for (const item of sorted) {
    if (remainingCapacity === 0) break;

    if (item.weight <= remainingCapacity) {
      // Take whole item
      selected.push({ item, fraction: 1.0, value: item.value });
      totalValue += item.value;
      remainingCapacity -= item.weight;
      choices.push(`Take 100% of item ${item.id} (ratio: ${item.ratio.toFixed(2)}) - adds ${item.value} value`);
    } else {
      // Take fraction
      const fraction = remainingCapacity / item.weight;
      const fractionalValue = item.value * fraction;
      selected.push({ item, fraction, value: fractionalValue });
      totalValue += fractionalValue;
      choices.push(`Take ${(fraction * 100).toFixed(1)}% of item ${item.id} (ratio: ${item.ratio.toFixed(2)}) - adds ${fractionalValue.toFixed(2)} value`);
      remainingCapacity = 0;
    }
  }

  return {
    algorithm: 'Fractional Knapsack',
    input: { items, capacity },
    output: {
      totalValue: totalValue.toFixed(2),
      selectedItems: selected.map(s => ({
        itemId: s.item.id,
        fractionTaken: (s.fraction * 100).toFixed(1) + '%',
        valueGained: s.value.toFixed(2)
      })),
      capacityUsed: capacity - remainingCapacity
    },
    optimalityGuarantee: 'Optimal - taking items with best value/weight ratio first maximizes value',
    complexity: { time: 'O(n log n) for sorting', space: 'O(n)' },
    greedyChoices: choices
  };
}

// ============================================================================
// HUFFMAN CODING
// ============================================================================

interface HuffmanNode {
  char?: string;
  freq: number;
  left?: HuffmanNode;
  right?: HuffmanNode;
}

function huffmanCoding(frequencies: Record<string, number>): GreedyResult {
  const choices: string[] = [];

  // Create leaf nodes
  const nodes: HuffmanNode[] = Object.entries(frequencies).map(([char, freq]) => ({
    char,
    freq
  }));

  choices.push(`Initial nodes: ${nodes.map(n => `${n.char}:${n.freq}`).join(', ')}`);

  // Build Huffman tree
  while (nodes.length > 1) {
    // Sort by frequency (greedy choice: combine two lowest frequencies)
    nodes.sort((a, b) => a.freq - b.freq);

    const left = nodes.shift()!;
    const right = nodes.shift()!;

    const newNode: HuffmanNode = {
      freq: left.freq + right.freq,
      left,
      right
    };

    choices.push(`Combine [${left.char || 'internal'}:${left.freq}] + [${right.char || 'internal'}:${right.freq}] = [internal:${newNode.freq}]`);

    nodes.push(newNode);
  }

  const root = nodes[0];

  // Generate codes
  const codes: Record<string, string> = {};

  function generateCodes(node: HuffmanNode, code: string) {
    if (node.char) {
      codes[node.char] = code || '0';
      return;
    }
    if (node.left) generateCodes(node.left, code + '0');
    if (node.right) generateCodes(node.right, code + '1');
  }

  generateCodes(root, '');

  // Calculate compression
  const originalBits = Object.entries(frequencies).reduce((sum, [, freq]) => sum + freq * 8, 0);
  const compressedBits = Object.entries(frequencies).reduce(
    (sum, [char, freq]) => sum + freq * codes[char].length,
    0
  );

  return {
    algorithm: 'Huffman Coding',
    input: { frequencies },
    output: {
      codes,
      compressionRatio: ((1 - compressedBits / originalBits) * 100).toFixed(2) + '%',
      originalBits,
      compressedBits,
      averageCodeLength: (compressedBits / Object.values(frequencies).reduce((a, b) => a + b, 0)).toFixed(2)
    },
    optimalityGuarantee: 'Optimal - produces minimum average code length for given frequencies',
    complexity: { time: 'O(n log n) with heap', space: 'O(n)' },
    greedyChoices: choices
  };
}

// ============================================================================
// MINIMUM SPANNING TREE - PRIM'S
// ============================================================================

interface Edge {
  u: number;
  v: number;
  weight: number;
}

function primMST(numVertices: number, edges: Edge[]): GreedyResult {
  const choices: string[] = [];
  const adj: Map<number, Array<{ to: number; weight: number }>> = new Map();

  // Build adjacency list
  for (let i = 0; i < numVertices; i++) {
    adj.set(i, []);
  }
  for (const edge of edges) {
    adj.get(edge.u)!.push({ to: edge.v, weight: edge.weight });
    adj.get(edge.v)!.push({ to: edge.u, weight: edge.weight });
  }

  const inMST = new Set<number>();
  const mstEdges: Edge[] = [];
  let totalWeight = 0;

  // Start from vertex 0
  inMST.add(0);
  choices.push('Start from vertex 0');

  while (inMST.size < numVertices) {
    // Find minimum weight edge crossing the cut
    let minEdge: Edge | null = null;
    let minWeight = Infinity;

    for (const u of inMST) {
      for (const { to: v, weight } of adj.get(u)!) {
        if (!inMST.has(v) && weight < minWeight) {
          minWeight = weight;
          minEdge = { u, v, weight };
        }
      }
    }

    if (minEdge) {
      inMST.add(minEdge.v);
      mstEdges.push(minEdge);
      totalWeight += minEdge.weight;
      choices.push(`Add edge (${minEdge.u}, ${minEdge.v}) with weight ${minEdge.weight} - minimum crossing cut`);
    } else {
      break; // Graph not connected
    }
  }

  return {
    algorithm: 'Prim\'s MST',
    input: { numVertices, numEdges: edges.length },
    output: {
      mstEdges: mstEdges.map(e => `(${e.u}, ${e.v}): ${e.weight}`),
      totalWeight,
      numEdges: mstEdges.length
    },
    optimalityGuarantee: 'Optimal - cut property: lightest edge crossing any cut must be in MST',
    complexity: { time: 'O(E log V) with binary heap', space: 'O(V + E)' },
    greedyChoices: choices
  };
}

// ============================================================================
// MINIMUM SPANNING TREE - KRUSKAL'S
// ============================================================================

function kruskalMST(numVertices: number, edges: Edge[]): GreedyResult {
  const choices: string[] = [];

  // Union-Find data structure
  const parent: number[] = Array.from({ length: numVertices }, (_, i) => i);
  const rank: number[] = new Array(numVertices).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]); // Path compression
    }
    return parent[x];
  }

  function union(x: number, y: number): boolean {
    const px = find(x);
    const py = find(y);
    if (px === py) return false;

    if (rank[px] < rank[py]) {
      parent[px] = py;
    } else if (rank[px] > rank[py]) {
      parent[py] = px;
    } else {
      parent[py] = px;
      rank[px]++;
    }
    return true;
  }

  // Sort edges by weight (greedy choice: lightest edge first)
  const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
  choices.push(`Sort edges by weight: ${sortedEdges.map(e => `(${e.u},${e.v}):${e.weight}`).join(', ')}`);

  const mstEdges: Edge[] = [];
  let totalWeight = 0;

  for (const edge of sortedEdges) {
    if (union(edge.u, edge.v)) {
      mstEdges.push(edge);
      totalWeight += edge.weight;
      choices.push(`Add edge (${edge.u}, ${edge.v}) with weight ${edge.weight} - no cycle created`);

      if (mstEdges.length === numVertices - 1) break;
    } else {
      choices.push(`Skip edge (${edge.u}, ${edge.v}) with weight ${edge.weight} - would create cycle`);
    }
  }

  return {
    algorithm: 'Kruskal\'s MST',
    input: { numVertices, numEdges: edges.length },
    output: {
      mstEdges: mstEdges.map(e => `(${e.u}, ${e.v}): ${e.weight}`),
      totalWeight,
      numEdges: mstEdges.length
    },
    optimalityGuarantee: 'Optimal - cycle property: heaviest edge in any cycle cannot be in MST',
    complexity: { time: 'O(E log E) for sorting + O(E * alpha(V)) for union-find', space: 'O(V)' },
    greedyChoices: choices
  };
}

// ============================================================================
// DIJKSTRA'S SHORTEST PATH
// ============================================================================

function dijkstra(numVertices: number, edges: Edge[], source: number): GreedyResult {
  const choices: string[] = [];
  const adj: Map<number, Array<{ to: number; weight: number }>> = new Map();

  for (let i = 0; i < numVertices; i++) {
    adj.set(i, []);
  }
  for (const edge of edges) {
    adj.get(edge.u)!.push({ to: edge.v, weight: edge.weight });
    adj.get(edge.v)!.push({ to: edge.u, weight: edge.weight });
  }

  const dist: number[] = new Array(numVertices).fill(Infinity);
  const prev: number[] = new Array(numVertices).fill(-1);
  const visited = new Set<number>();

  dist[source] = 0;
  choices.push(`Initialize: distance to source ${source} = 0, all others = infinity`);

  while (visited.size < numVertices) {
    // Find unvisited vertex with minimum distance (greedy choice)
    let minDist = Infinity;
    let u = -1;
    for (let i = 0; i < numVertices; i++) {
      if (!visited.has(i) && dist[i] < minDist) {
        minDist = dist[i];
        u = i;
      }
    }

    if (u === -1) break;

    visited.add(u);
    choices.push(`Visit vertex ${u} with distance ${dist[u]} - minimum unvisited`);

    // Relax edges
    for (const { to: v, weight } of adj.get(u)!) {
      if (!visited.has(v) && dist[u] + weight < dist[v]) {
        dist[v] = dist[u] + weight;
        prev[v] = u;
        choices.push(`  Relax edge (${u}, ${v}): update dist[${v}] = ${dist[v]}`);
      }
    }
  }

  // Reconstruct paths
  const paths: Record<number, number[]> = {};
  for (let i = 0; i < numVertices; i++) {
    if (i !== source && dist[i] !== Infinity) {
      const path: number[] = [];
      let current = i;
      while (current !== -1) {
        path.unshift(current);
        current = prev[current];
      }
      paths[i] = path;
    }
  }

  return {
    algorithm: 'Dijkstra\'s Shortest Path',
    input: { numVertices, numEdges: edges.length, source },
    output: {
      distances: dist.map((d, i) => ({ vertex: i, distance: d === Infinity ? 'unreachable' : d })),
      paths: Object.entries(paths).map(([v, path]) => ({ to: Number(v), path: path.join(' -> ') }))
    },
    optimalityGuarantee: 'Optimal for non-negative weights - vertex with minimum distance is finalized',
    complexity: { time: 'O(V^2) naive, O(E + V log V) with Fibonacci heap', space: 'O(V)' },
    greedyChoices: choices.slice(0, 20)
  };
}

// ============================================================================
// JOB SCHEDULING WITH DEADLINES
// ============================================================================

interface Job {
  id: number;
  deadline: number;
  profit: number;
}

function jobScheduling(jobs: Job[]): GreedyResult {
  const choices: string[] = [];

  // Sort by profit (greedy choice: highest profit first)
  const sorted = [...jobs].sort((a, b) => b.profit - a.profit);
  choices.push(`Sort by profit: ${sorted.map(j => `Job${j.id}(profit:${j.profit})`).join(', ')}`);

  const maxDeadline = Math.max(...jobs.map(j => j.deadline));
  const slots: (Job | null)[] = new Array(maxDeadline).fill(null);

  const scheduled: Job[] = [];
  let totalProfit = 0;

  for (const job of sorted) {
    // Find latest available slot before deadline
    for (let t = Math.min(job.deadline, maxDeadline) - 1; t >= 0; t--) {
      if (slots[t] === null) {
        slots[t] = job;
        scheduled.push(job);
        totalProfit += job.profit;
        choices.push(`Schedule Job${job.id} (profit:${job.profit}, deadline:${job.deadline}) at slot ${t + 1}`);
        break;
      }
    }
  }

  return {
    algorithm: 'Job Scheduling with Deadlines',
    input: { jobs, maxDeadline },
    output: {
      scheduledJobs: scheduled.map(j => ({ id: j.id, profit: j.profit, deadline: j.deadline })),
      totalProfit,
      schedule: slots.map((s, i) => ({ slot: i + 1, job: s ? `Job${s.id}` : 'empty' }))
    },
    optimalityGuarantee: 'Optimal - scheduling highest profit jobs first maximizes total profit',
    complexity: { time: 'O(n^2) naive, O(n log n) with union-find', space: 'O(n)' },
    greedyChoices: choices
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export const greedyalgorithmsTool: UnifiedTool = {
  name: 'greedy_algorithms',
  description: `Greedy algorithm solver with optimality proofs. Operations:
- activity_selection: Maximum non-overlapping activities
- fractional_knapsack: Maximum value with item fractions
- huffman: Optimal prefix-free coding
- prim_mst: Minimum spanning tree (grow from vertex)
- kruskal_mst: Minimum spanning tree (add edges)
- dijkstra: Shortest paths from source
- job_scheduling: Maximum profit job sequence
- info: Documentation and theory`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['activity_selection', 'fractional_knapsack', 'huffman', 'prim_mst', 'kruskal_mst', 'dijkstra', 'job_scheduling', 'info', 'examples'],
        description: 'Operation to perform'
      },
      activities: { type: 'array', description: 'Activities [{id, start, finish}, ...]' },
      items: { type: 'array', description: 'Items [{id, weight, value}, ...]' },
      capacity: { type: 'number', description: 'Knapsack capacity' },
      frequencies: { type: 'object', description: 'Character frequencies {char: freq}' },
      numVertices: { type: 'number', description: 'Number of vertices in graph' },
      edges: { type: 'array', description: 'Edges [{u, v, weight}, ...]' },
      source: { type: 'number', description: 'Source vertex for Dijkstra' },
      jobs: { type: 'array', description: 'Jobs [{id, deadline, profit}, ...]' }
    },
    required: ['operation']
  }
};

export async function executegreedyalgorithms(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    switch (args.operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Greedy Algorithms',
            principle: 'Make locally optimal choice at each step, hoping for global optimum',
            requirements: {
              greedy_choice_property: 'Locally optimal choice leads to globally optimal solution',
              optimal_substructure: 'Optimal solution contains optimal solutions to subproblems'
            },
            proving_optimality: [
              'Exchange argument: show swapping choices doesn\'t improve solution',
              'Stay ahead: show greedy is always at least as good as optimal',
              'Structural argument: relate greedy choices to optimal structure'
            ],
            algorithms: [
              { name: 'Activity Selection', guarantee: 'Optimal', key: 'earliest finish time' },
              { name: 'Fractional Knapsack', guarantee: 'Optimal', key: 'best value/weight ratio' },
              { name: 'Huffman Coding', guarantee: 'Optimal', key: 'lowest frequency first' },
              { name: 'Prim\'s MST', guarantee: 'Optimal', key: 'lightest edge from tree' },
              { name: 'Kruskal\'s MST', guarantee: 'Optimal', key: 'lightest edge without cycle' },
              { name: 'Dijkstra', guarantee: 'Optimal (non-neg weights)', key: 'closest unvisited' }
            ],
            notOptimal: [
              '0/1 Knapsack (use DP instead)',
              'Traveling Salesman (NP-hard)',
              'Set Cover (approximation only)'
            ]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                description: 'Activity selection',
                call: {
                  operation: 'activity_selection',
                  activities: [
                    { id: 1, start: 1, finish: 4 },
                    { id: 2, start: 3, finish: 5 },
                    { id: 3, start: 0, finish: 6 },
                    { id: 4, start: 5, finish: 7 },
                    { id: 5, start: 5, finish: 9 },
                    { id: 6, start: 8, finish: 9 }
                  ]
                }
              },
              {
                description: 'Huffman coding',
                call: {
                  operation: 'huffman',
                  frequencies: { a: 5, b: 9, c: 12, d: 13, e: 16, f: 45 }
                }
              },
              {
                description: 'Dijkstra shortest path',
                call: {
                  operation: 'dijkstra',
                  numVertices: 5,
                  edges: [
                    { u: 0, v: 1, weight: 4 },
                    { u: 0, v: 2, weight: 1 },
                    { u: 2, v: 1, weight: 2 },
                    { u: 1, v: 3, weight: 1 },
                    { u: 2, v: 3, weight: 5 },
                    { u: 3, v: 4, weight: 3 }
                  ],
                  source: 0
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'activity_selection': {
        const activities = args.activities || [
          { id: 1, start: 1, finish: 4 },
          { id: 2, start: 3, finish: 5 },
          { id: 3, start: 0, finish: 6 },
          { id: 4, start: 5, finish: 7 },
          { id: 5, start: 5, finish: 9 },
          { id: 6, start: 8, finish: 9 }
        ];
        const result = activitySelection(activities);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'fractional_knapsack': {
        const items = args.items || [
          { id: 1, weight: 10, value: 60 },
          { id: 2, weight: 20, value: 100 },
          { id: 3, weight: 30, value: 120 }
        ];
        const capacity = args.capacity || 50;
        const result = fractionalKnapsack(items, capacity);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'huffman': {
        const frequencies = args.frequencies || { a: 5, b: 9, c: 12, d: 13, e: 16, f: 45 };
        const result = huffmanCoding(frequencies);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'prim_mst': {
        const numVertices = args.numVertices || 5;
        const edges = args.edges || [
          { u: 0, v: 1, weight: 2 },
          { u: 0, v: 3, weight: 6 },
          { u: 1, v: 2, weight: 3 },
          { u: 1, v: 3, weight: 8 },
          { u: 1, v: 4, weight: 5 },
          { u: 2, v: 4, weight: 7 },
          { u: 3, v: 4, weight: 9 }
        ];
        const result = primMST(numVertices, edges);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'kruskal_mst': {
        const numVertices = args.numVertices || 5;
        const edges = args.edges || [
          { u: 0, v: 1, weight: 2 },
          { u: 0, v: 3, weight: 6 },
          { u: 1, v: 2, weight: 3 },
          { u: 1, v: 3, weight: 8 },
          { u: 1, v: 4, weight: 5 },
          { u: 2, v: 4, weight: 7 },
          { u: 3, v: 4, weight: 9 }
        ];
        const result = kruskalMST(numVertices, edges);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'dijkstra': {
        const numVertices = args.numVertices || 5;
        const edges = args.edges || [
          { u: 0, v: 1, weight: 4 },
          { u: 0, v: 2, weight: 1 },
          { u: 2, v: 1, weight: 2 },
          { u: 1, v: 3, weight: 1 },
          { u: 2, v: 3, weight: 5 },
          { u: 3, v: 4, weight: 3 }
        ];
        const source = args.source ?? 0;
        const result = dijkstra(numVertices, edges, source);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'job_scheduling': {
        const jobs = args.jobs || [
          { id: 1, deadline: 2, profit: 100 },
          { id: 2, deadline: 1, profit: 19 },
          { id: 3, deadline: 2, profit: 27 },
          { id: 4, deadline: 1, profit: 25 },
          { id: 5, deadline: 3, profit: 15 }
        ];
        const result = jobScheduling(jobs);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}. Use 'info' for help.`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isgreedyalgorithmsAvailable(): boolean {
  return true;
}
