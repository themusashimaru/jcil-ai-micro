/**
 * SOCIAL-NETWORK TOOL
 * Social network analysis and graph metrics
 *
 * Implements network analysis including:
 * - Centrality measures (degree, betweenness, closeness, PageRank)
 * - Community detection
 * - Influence and diffusion models
 * - Network statistics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Graph representation
interface Node {
  id: string;
  attributes?: Record<string, unknown>;
}

interface Edge {
  source: string;
  target: string;
  weight?: number;
}

interface Graph {
  nodes: Node[];
  edges: Edge[];
  directed: boolean;
}

// Create adjacency list from graph
function buildAdjacencyList(graph: Graph): Map<string, { neighbors: string[]; weights: number[] }> {
  const adj = new Map<string, { neighbors: string[]; weights: number[] }>();

  for (const node of graph.nodes) {
    adj.set(node.id, { neighbors: [], weights: [] });
  }

  for (const edge of graph.edges) {
    const sourceData = adj.get(edge.source)!;
    sourceData.neighbors.push(edge.target);
    sourceData.weights.push(edge.weight || 1);

    if (!graph.directed) {
      const targetData = adj.get(edge.target)!;
      targetData.neighbors.push(edge.source);
      targetData.weights.push(edge.weight || 1);
    }
  }

  return adj;
}

// Degree centrality
function degreeCentrality(graph: Graph): Map<string, number> {
  const adj = buildAdjacencyList(graph);
  const centrality = new Map<string, number>();
  const n = graph.nodes.length;

  for (const [nodeId, data] of adj) {
    // Normalized by n-1
    centrality.set(nodeId, data.neighbors.length / (n - 1));
  }

  return centrality;
}

// BFS to find shortest paths from source
function bfsShortestPaths(adj: Map<string, { neighbors: string[] }>, source: string): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: string[] = [source];
  distances.set(source, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current)!;
    const neighbors = adj.get(current)?.neighbors || [];

    for (const neighbor of neighbors) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }

  return distances;
}

// Closeness centrality
function closenessCentrality(graph: Graph): Map<string, number> {
  const adj = buildAdjacencyList(graph);
  const centrality = new Map<string, number>();
  const n = graph.nodes.length;

  for (const node of graph.nodes) {
    const distances = bfsShortestPaths(adj, node.id);
    let totalDist = 0;
    let reachable = 0;

    for (const [targetId, dist] of distances) {
      if (targetId !== node.id) {
        totalDist += dist;
        reachable++;
      }
    }

    if (reachable > 0 && totalDist > 0) {
      // Wasserman and Faust formula for disconnected graphs
      centrality.set(node.id, (reachable / (n - 1)) * (reachable / totalDist));
    } else {
      centrality.set(node.id, 0);
    }
  }

  return centrality;
}

// Betweenness centrality (Brandes algorithm simplified)
function betweennessCentrality(graph: Graph): Map<string, number> {
  const adj = buildAdjacencyList(graph);
  const centrality = new Map<string, number>();

  for (const node of graph.nodes) {
    centrality.set(node.id, 0);
  }

  for (const source of graph.nodes) {
    // BFS from source
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    const delta = new Map<string, number>();

    for (const node of graph.nodes) {
      pred.set(node.id, []);
      sigma.set(node.id, 0);
      dist.set(node.id, -1);
      delta.set(node.id, 0);
    }

    sigma.set(source.id, 1);
    dist.set(source.id, 0);
    const queue = [source.id];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      const neighbors = adj.get(v)?.neighbors || [];

      for (const w of neighbors) {
        // Path discovery
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        // Path counting
        if (dist.get(w)! === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }

    // Accumulation
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        const contribution = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
        delta.set(v, delta.get(v)! + contribution);
      }
      if (w !== source.id) {
        centrality.set(w, centrality.get(w)! + delta.get(w)!);
      }
    }
  }

  // Normalize
  const n = graph.nodes.length;
  const scale = graph.directed ? 1 / ((n - 1) * (n - 2)) : 2 / ((n - 1) * (n - 2));

  for (const [nodeId, value] of centrality) {
    centrality.set(nodeId, value * scale);
  }

  return centrality;
}

// PageRank
function pageRank(
  graph: Graph,
  damping: number = 0.85,
  iterations: number = 100,
  tolerance: number = 1e-6
): Map<string, number> {
  const adj = buildAdjacencyList(graph);
  const n = graph.nodes.length;

  // Initialize
  let rank = new Map<string, number>();
  for (const node of graph.nodes) {
    rank.set(node.id, 1 / n);
  }

  // Compute out-degree
  const outDegree = new Map<string, number>();
  for (const [nodeId, data] of adj) {
    outDegree.set(nodeId, data.neighbors.length);
  }

  // Iterate
  for (let iter = 0; iter < iterations; iter++) {
    const newRank = new Map<string, number>();
    let maxDiff = 0;

    for (const node of graph.nodes) {
      let sum = 0;

      // Find all nodes that link to this node
      for (const [sourceId, data] of adj) {
        if (data.neighbors.includes(node.id)) {
          const sourceOutDegree = outDegree.get(sourceId) || 1;
          sum += rank.get(sourceId)! / sourceOutDegree;
        }
      }

      const newValue = (1 - damping) / n + damping * sum;
      newRank.set(node.id, newValue);
      maxDiff = Math.max(maxDiff, Math.abs(newValue - rank.get(node.id)!));
    }

    rank = newRank;
    if (maxDiff < tolerance) break;
  }

  return rank;
}

// Eigenvector centrality (power iteration)
function eigenvectorCentrality(graph: Graph, iterations: number = 100): Map<string, number> {
  const adj = buildAdjacencyList(graph);
  const n = graph.nodes.length;

  // Initialize
  let centrality = new Map<string, number>();
  for (const node of graph.nodes) {
    centrality.set(node.id, 1 / Math.sqrt(n));
  }

  // Power iteration
  for (let iter = 0; iter < iterations; iter++) {
    const newCentrality = new Map<string, number>();

    for (const node of graph.nodes) {
      let sum = 0;
      const neighbors = adj.get(node.id)?.neighbors || [];
      for (const neighbor of neighbors) {
        sum += centrality.get(neighbor)!;
      }
      newCentrality.set(node.id, sum);
    }

    // Normalize
    let norm = 0;
    for (const value of newCentrality.values()) {
      norm += value * value;
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (const [nodeId, value] of newCentrality) {
        newCentrality.set(nodeId, value / norm);
      }
    }

    centrality = newCentrality;
  }

  return centrality;
}

// Community detection using label propagation
function labelPropagation(graph: Graph, maxIterations: number = 100): Map<string, number> {
  const adj = buildAdjacencyList(graph);
  const labels = new Map<string, number>();

  // Initialize each node with unique label
  let labelId = 0;
  for (const node of graph.nodes) {
    labels.set(node.id, labelId++);
  }

  // Iterate
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    const nodeOrder = [...graph.nodes].sort(() => Math.random() - 0.5);

    for (const node of nodeOrder) {
      const neighbors = adj.get(node.id)?.neighbors || [];
      if (neighbors.length === 0) continue;

      // Count neighbor labels
      const labelCounts = new Map<number, number>();
      for (const neighbor of neighbors) {
        const label = labels.get(neighbor)!;
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }

      // Find most common label
      let maxCount = 0;
      let bestLabel = labels.get(node.id)!;
      for (const [label, count] of labelCounts) {
        if (count > maxCount) {
          maxCount = count;
          bestLabel = label;
        }
      }

      if (bestLabel !== labels.get(node.id)) {
        labels.set(node.id, bestLabel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return labels;
}

// Get communities from labels
function getCommunities(labels: Map<string, number>): Map<number, string[]> {
  const communities = new Map<number, string[]>();

  for (const [nodeId, label] of labels) {
    if (!communities.has(label)) {
      communities.set(label, []);
    }
    communities.get(label)!.push(nodeId);
  }

  return communities;
}

// Network statistics
function calculateNetworkStats(graph: Graph): {
  nodes: number;
  edges: number;
  density: number;
  avgDegree: number;
  components: number;
  diameter: number | null;
  avgClustering: number;
} {
  const adj = buildAdjacencyList(graph);
  const n = graph.nodes.length;
  const m = graph.edges.length;

  // Density
  const maxEdges = graph.directed ? n * (n - 1) : n * (n - 1) / 2;
  const density = m / maxEdges;

  // Average degree
  let totalDegree = 0;
  for (const data of adj.values()) {
    totalDegree += data.neighbors.length;
  }
  const avgDegree = totalDegree / n;

  // Connected components (BFS)
  const visited = new Set<string>();
  let components = 0;

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      components++;
      const queue = [node.id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const neighbors = adj.get(current)?.neighbors || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }
  }

  // Diameter (only for connected graphs)
  let diameter: number | null = null;
  if (components === 1) {
    diameter = 0;
    for (const node of graph.nodes) {
      const distances = bfsShortestPaths(adj, node.id);
      for (const dist of distances.values()) {
        diameter = Math.max(diameter!, dist);
      }
    }
  }

  // Clustering coefficient
  let totalClustering = 0;
  for (const node of graph.nodes) {
    const neighbors = adj.get(node.id)?.neighbors || [];
    const k = neighbors.length;
    if (k < 2) continue;

    let triangles = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const ni = neighbors[i];
        const nj = neighbors[j];
        if (adj.get(ni)?.neighbors.includes(nj)) {
          triangles++;
        }
      }
    }

    const possibleTriangles = k * (k - 1) / 2;
    totalClustering += triangles / possibleTriangles;
  }
  const avgClustering = totalClustering / n;

  return { nodes: n, edges: m, density, avgDegree, components, diameter, avgClustering };
}

// Information diffusion simulation (Independent Cascade model)
function simulateDiffusion(
  graph: Graph,
  seeds: string[],
  probability: number = 0.1,
  steps: number = 10
): { step: number; active: string[] }[] {
  const adj = buildAdjacencyList(graph);
  const active = new Set<string>(seeds);
  const history: { step: number; active: string[] }[] = [
    { step: 0, active: Array.from(active) }
  ];

  for (let step = 1; step <= steps; step++) {
    const newlyActive = new Set<string>();
    const previousActive = Array.from(active);

    for (const node of previousActive) {
      const neighbors = adj.get(node)?.neighbors || [];
      for (const neighbor of neighbors) {
        if (!active.has(neighbor) && Math.random() < probability) {
          newlyActive.add(neighbor);
        }
      }
    }

    if (newlyActive.size === 0) break;

    for (const node of newlyActive) {
      active.add(node);
    }

    history.push({ step, active: Array.from(newlyActive) });
  }

  return history;
}

// Example networks
function createExampleNetwork(type: string): Graph {
  switch (type) {
    case 'karate':
      // Zachary's Karate Club (simplified)
      return {
        directed: false,
        nodes: Array.from({ length: 10 }, (_, i) => ({ id: `n${i + 1}` })),
        edges: [
          { source: 'n1', target: 'n2' }, { source: 'n1', target: 'n3' },
          { source: 'n1', target: 'n4' }, { source: 'n2', target: 'n3' },
          { source: 'n2', target: 'n5' }, { source: 'n3', target: 'n4' },
          { source: 'n4', target: 'n5' }, { source: 'n5', target: 'n6' },
          { source: 'n6', target: 'n7' }, { source: 'n6', target: 'n8' },
          { source: 'n7', target: 'n8' }, { source: 'n7', target: 'n9' },
          { source: 'n8', target: 'n10' }, { source: 'n9', target: 'n10' }
        ]
      };

    case 'star':
      return {
        directed: false,
        nodes: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}` })),
        edges: Array.from({ length: 5 }, (_, i) => ({
          source: 'n0', target: `n${i + 1}`
        }))
      };

    case 'ring':
      const ringNodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}` }));
      return {
        directed: false,
        nodes: ringNodes,
        edges: Array.from({ length: 8 }, (_, i) => ({
          source: `n${i}`, target: `n${(i + 1) % 8}`
        }))
      };

    case 'complete':
      const completeNodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}` }));
      const completeEdges: Edge[] = [];
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          completeEdges.push({ source: `n${i}`, target: `n${j}` });
        }
      }
      return { directed: false, nodes: completeNodes, edges: completeEdges };

    default:
      return createExampleNetwork('karate');
  }
}

export const socialnetworkTool: UnifiedTool = {
  name: 'social_network',
  description: `Social network analysis for graphs and networks.

Computes centrality measures:
- Degree centrality: number of connections
- Closeness centrality: average distance to all nodes
- Betweenness centrality: fraction of shortest paths through node
- Eigenvector centrality: connection to well-connected nodes
- PageRank: importance via random walk

Features:
- Community detection (label propagation)
- Network statistics (density, clustering, components)
- Information diffusion simulation
- Example networks (karate club, star, ring, complete)`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['centrality', 'community', 'statistics', 'diffusion', 'pagerank', 'create', 'examples', 'info'],
        description: 'Operation to perform'
      },
      metric: {
        type: 'string',
        enum: ['degree', 'betweenness', 'closeness', 'eigenvector', 'pagerank', 'all'],
        description: 'Centrality metric (default: all)'
      },
      network: {
        type: 'string',
        enum: ['karate', 'star', 'ring', 'complete'],
        description: 'Example network to use'
      },
      nodes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Custom node IDs'
      },
      edges: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'string' }
        },
        description: 'Custom edges as [[source, target], ...]'
      },
      directed: { type: 'boolean', description: 'Is the graph directed? (default: false)' },
      seeds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Seed nodes for diffusion'
      },
      probability: { type: 'number', description: 'Diffusion probability (default: 0.1)' },
      damping: { type: 'number', description: 'PageRank damping factor (default: 0.85)' }
    },
    required: ['operation']
  }
};

export async function executesocialnetwork(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, metric = 'all', network: networkType, nodes: customNodes, edges: customEdges, directed = false, seeds, probability = 0.1, damping = 0.85 } = args;

    // Get or create graph
    let graph: Graph;

    if (customNodes && customEdges) {
      graph = {
        directed,
        nodes: customNodes.map((id: string) => ({ id })),
        edges: customEdges.map(([source, target]: [string, string]) => ({ source, target }))
      };
    } else {
      graph = createExampleNetwork(networkType || 'karate');
    }

    switch (operation) {
      case 'centrality': {
        const results: Record<string, Record<string, number>> = {};

        if (metric === 'all' || metric === 'degree') {
          const deg = degreeCentrality(graph);
          results.degree = Object.fromEntries(deg);
        }

        if (metric === 'all' || metric === 'closeness') {
          const close = closenessCentrality(graph);
          results.closeness = Object.fromEntries(close);
        }

        if (metric === 'all' || metric === 'betweenness') {
          const between = betweennessCentrality(graph);
          results.betweenness = Object.fromEntries(between);
        }

        if (metric === 'all' || metric === 'eigenvector') {
          const eigen = eigenvectorCentrality(graph);
          results.eigenvector = Object.fromEntries(eigen);
        }

        if (metric === 'all' || metric === 'pagerank') {
          const pr = pageRank(graph, damping);
          results.pagerank = Object.fromEntries(pr);
        }

        // Find most central node for each metric
        const mostCentral: Record<string, { node: string; value: number }> = {};
        for (const [metricName, values] of Object.entries(results)) {
          let maxNode = '';
          let maxValue = -Infinity;
          for (const [node, value] of Object.entries(values)) {
            if (value > maxValue) {
              maxValue = value;
              maxNode = node;
            }
          }
          mostCentral[metricName] = { node: maxNode, value: maxValue };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkType || 'custom',
            nodes: graph.nodes.length,
            edges: graph.edges.length,
            centrality_scores: results,
            most_central: mostCentral
          }, null, 2)
        };
      }

      case 'community': {
        const labels = labelPropagation(graph);
        const communities = getCommunities(labels);

        const communityList = Array.from(communities.entries()).map(([label, members]) => ({
          community_id: label,
          size: members.length,
          members
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkType || 'custom',
            algorithm: 'Label Propagation',
            num_communities: communities.size,
            communities: communityList,
            modularity_note: 'Communities detected by iterative label voting'
          }, null, 2)
        };
      }

      case 'statistics': {
        const stats = calculateNetworkStats(graph);

        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkType || 'custom',
            statistics: {
              nodes: stats.nodes,
              edges: stats.edges,
              density: stats.density.toFixed(4),
              average_degree: stats.avgDegree.toFixed(4),
              connected_components: stats.components,
              diameter: stats.diameter ?? 'N/A (disconnected)',
              average_clustering_coefficient: stats.avgClustering.toFixed(4)
            },
            interpretation: {
              density: 'Fraction of possible edges present',
              clustering: 'Tendency of neighbors to be connected',
              diameter: 'Longest shortest path in network'
            }
          }, null, 2)
        };
      }

      case 'diffusion': {
        const seedNodes = seeds || [graph.nodes[0].id];
        const history = simulateDiffusion(graph, seedNodes, probability);

        const finalActive = new Set<string>();
        for (const step of history) {
          for (const node of step.active) {
            finalActive.add(node);
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkType || 'custom',
            model: 'Independent Cascade',
            parameters: {
              seed_nodes: seedNodes,
              transmission_probability: probability
            },
            diffusion_history: history,
            summary: {
              total_steps: history.length - 1,
              total_activated: finalActive.size,
              coverage: (finalActive.size / graph.nodes.length).toFixed(4)
            }
          }, null, 2)
        };
      }

      case 'pagerank': {
        const pr = pageRank(graph, damping);

        // Sort by rank
        const ranked = Array.from(pr.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([node, score], rank) => ({
            rank: rank + 1,
            node,
            score: score.toFixed(6)
          }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkType || 'custom',
            algorithm: 'PageRank',
            damping_factor: damping,
            rankings: ranked,
            interpretation: 'Higher score = more important node in random walk sense'
          }, null, 2)
        };
      }

      case 'create': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkType || 'custom',
            graph: {
              directed: graph.directed,
              nodes: graph.nodes.map(n => n.id),
              edges: graph.edges.map(e => [e.source, e.target])
            },
            visualization: createAsciiGraph(graph)
          }, null, 2)
        };
      }

      case 'examples': {
        const examples = ['karate', 'star', 'ring', 'complete'].map(type => {
          const g = createExampleNetwork(type);
          return {
            name: type,
            nodes: g.nodes.length,
            edges: g.edges.length,
            description: type === 'karate' ? 'Social network of karate club members'
              : type === 'star' ? 'Central hub connected to all others'
              : type === 'ring' ? 'Circular connection pattern'
              : 'Every node connected to every other'
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            example_networks: examples,
            usage: 'Use network parameter to select these networks'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'social_network',
            description: 'Social network analysis and graph metrics',
            centrality_measures: {
              degree: 'Number of direct connections (normalized)',
              closeness: 'Inverse of average distance to all nodes',
              betweenness: 'Fraction of shortest paths passing through node',
              eigenvector: 'Centrality from connections to central nodes',
              pagerank: 'Random walk probability of visiting node'
            },
            operations: {
              centrality: 'Compute centrality measures',
              community: 'Detect communities using label propagation',
              statistics: 'Calculate network-level statistics',
              diffusion: 'Simulate information spread',
              pagerank: 'Compute PageRank rankings',
              create: 'Display network structure',
              examples: 'List example networks'
            },
            applications: [
              'Identifying influential users',
              'Detecting communities/groups',
              'Analyzing information spread',
              'Finding bridge nodes'
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

// Simple ASCII graph visualization
function createAsciiGraph(graph: Graph): string {
  if (graph.nodes.length > 10) {
    return `Network too large for ASCII visualization (${graph.nodes.length} nodes)`;
  }

  const adj = buildAdjacencyList(graph);
  let result = 'Adjacency List:\n';

  for (const [node, data] of adj) {
    result += `${node} -> [${data.neighbors.join(', ')}]\n`;
  }

  return result;
}

export function issocialnetworkAvailable(): boolean {
  return true;
}
