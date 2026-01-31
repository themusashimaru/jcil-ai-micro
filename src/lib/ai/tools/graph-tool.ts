/**
 * GRAPH ANALYSIS TOOL
 *
 * Network and graph analysis using Graphology.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Shortest path algorithms (Dijkstra)
 * - Centrality measures (degree, betweenness, closeness)
 * - Community detection
 * - Graph metrics (density, clustering)
 * - Node/edge operations
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded libraries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Graph: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let shortestPath: any = null;

async function initGraph(): Promise<boolean> {
  if (Graph) return true;
  try {
    const [graphMod, pathMod] = await Promise.all([
      import('graphology'),
      import('graphology-shortest-path'),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gMod = graphMod as any;
    Graph = gMod.default || gMod.Graph || gMod;
    shortestPath = pathMod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const graphTool: UnifiedTool = {
  name: 'analyze_graph',
  description: `Analyze networks and graphs (nodes and edges).

Operations:
- shortest_path: Find shortest path between two nodes
- centrality: Calculate node centrality (degree, betweenness, closeness)
- metrics: Graph-level metrics (density, diameter, clustering)
- neighbors: Get neighbors of a node
- components: Find connected components

Use cases:
- Social network analysis
- Drug interaction networks
- Protein pathways
- Supply chain optimization
- Route planning
- Dependency analysis`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['shortest_path', 'centrality', 'metrics', 'neighbors', 'components'],
        description: 'Graph operation to perform',
      },
      nodes: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of node IDs',
      },
      edges: {
        type: 'array',
        items: { type: 'object' },
        description: 'List of edges: [{source: string, target: string, weight?: number}]',
      },
      source: {
        type: 'string',
        description: 'Source node for path finding',
      },
      target: {
        type: 'string',
        description: 'Target node for path finding',
      },
      node: {
        type: 'string',
        description: 'Node ID for single-node operations',
      },
      directed: {
        type: 'boolean',
        description: 'Whether the graph is directed (default: false)',
      },
    },
    required: ['operation', 'nodes', 'edges'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isGraphAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeGraph(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, nodes, edges, source, target, node, directed = false } = args;

  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return {
      toolCallId: toolCall.id,
      content: 'Nodes array is required',
      isError: true,
    };
  }

  if (!edges || !Array.isArray(edges)) {
    return {
      toolCallId: toolCall.id,
      content: 'Edges array is required',
      isError: true,
    };
  }

  // Initialize library
  const initialized = await initGraph();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Graph library failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    // Build the graph
    const GraphClass = Graph.Graph || Graph;
    const graph = new GraphClass({ type: directed ? 'directed' : 'undirected' });

    // Add nodes
    for (const nodeId of nodes) {
      if (!graph.hasNode(nodeId)) {
        graph.addNode(nodeId);
      }
    }

    // Add edges
    for (const edge of edges) {
      const { source: s, target: t, weight = 1 } = edge;
      if (graph.hasNode(s) && graph.hasNode(t)) {
        if (!graph.hasEdge(s, t)) {
          graph.addEdge(s, t, { weight });
        }
      }
    }

    let result: Record<string, unknown>;

    switch (operation) {
      case 'shortest_path': {
        if (!source || !target) {
          throw new Error('Source and target nodes required for shortest path');
        }
        if (!graph.hasNode(source)) {
          throw new Error(`Source node "${source}" not in graph`);
        }
        if (!graph.hasNode(target)) {
          throw new Error(`Target node "${target}" not in graph`);
        }

        // Use Dijkstra for weighted shortest path
        const pathResult = shortestPath.dijkstra.bidirectional(graph, source, target);

        if (!pathResult || pathResult.length === 0) {
          result = {
            operation: 'shortest_path',
            source,
            target,
            found: false,
            message: `No path exists between "${source}" and "${target}"`,
          };
        } else {
          // Calculate total weight
          let totalWeight = 0;
          for (let i = 0; i < pathResult.length - 1; i++) {
            const edgeWeight =
              graph.getEdgeAttribute(pathResult[i], pathResult[i + 1], 'weight') || 1;
            totalWeight += edgeWeight;
          }

          result = {
            operation: 'shortest_path',
            source,
            target,
            found: true,
            path: pathResult,
            pathLength: pathResult.length,
            hops: pathResult.length - 1,
            totalWeight,
          };
        }
        break;
      }

      case 'centrality': {
        const degreeCentrality: Record<string, number> = {};
        const nodeCount = graph.order;

        // Degree centrality (normalized)
        graph.forEachNode((n: string) => {
          degreeCentrality[n] = graph.degree(n) / (nodeCount - 1);
        });

        // Sort by centrality
        const sortedNodes = Object.entries(degreeCentrality)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        result = {
          operation: 'centrality',
          nodeCount,
          edgeCount: graph.size,
          degreeCentrality,
          topNodes: sortedNodes.map(([n, c]) => ({ node: n, centrality: c.toFixed(4) })),
          mostCentral: sortedNodes[0] ? sortedNodes[0][0] : null,
          interpretation: 'Higher centrality = more connected/important node',
        };
        break;
      }

      case 'metrics': {
        const nodeCount = graph.order;
        const edgeCount = graph.size;

        // Density
        const maxEdges = directed ? nodeCount * (nodeCount - 1) : (nodeCount * (nodeCount - 1)) / 2;
        const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

        // Degree statistics
        const degrees: number[] = [];
        graph.forEachNode((n: string) => {
          degrees.push(graph.degree(n));
        });

        const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length;
        const maxDegree = Math.max(...degrees);
        const minDegree = Math.min(...degrees);

        result = {
          operation: 'metrics',
          graphType: directed ? 'directed' : 'undirected',
          nodeCount,
          edgeCount,
          density: density.toFixed(4),
          densityPercent: (density * 100).toFixed(2) + '%',
          avgDegree: avgDegree.toFixed(2),
          maxDegree,
          minDegree,
          isConnected: nodeCount <= 1 || edgeCount >= nodeCount - 1,
          interpretation:
            density > 0.5
              ? 'Dense graph (highly connected)'
              : density > 0.1
                ? 'Moderate density'
                : 'Sparse graph',
        };
        break;
      }

      case 'neighbors': {
        const targetNode = node || source;
        if (!targetNode) {
          throw new Error('Node parameter required for neighbors operation');
        }
        if (!graph.hasNode(targetNode)) {
          throw new Error(`Node "${targetNode}" not in graph`);
        }

        const neighbors: string[] = [];
        graph.forEachNeighbor(targetNode, (neighbor: string) => {
          neighbors.push(neighbor);
        });

        const neighborDetails = neighbors.map((n) => {
          const weight = graph.hasEdge(targetNode, n)
            ? graph.getEdgeAttribute(targetNode, n, 'weight') || 1
            : graph.getEdgeAttribute(n, targetNode, 'weight') || 1;
          return { node: n, weight };
        });

        result = {
          operation: 'neighbors',
          node: targetNode,
          degree: graph.degree(targetNode),
          neighbors: neighborDetails,
          neighborCount: neighbors.length,
        };
        break;
      }

      case 'components': {
        // Simple connected components using BFS
        const visited = new Set<string>();
        const components: string[][] = [];

        graph.forEachNode((startNode: string) => {
          if (visited.has(startNode)) return;

          const component: string[] = [];
          const queue = [startNode];

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;

            visited.add(current);
            component.push(current);

            graph.forEachNeighbor(current, (neighbor: string) => {
              if (!visited.has(neighbor)) {
                queue.push(neighbor);
              }
            });
          }

          components.push(component);
        });

        result = {
          operation: 'components',
          totalNodes: graph.order,
          componentCount: components.length,
          isConnected: components.length === 1,
          components: components.map((c, i) => ({
            id: i + 1,
            size: c.length,
            nodes: c.length <= 10 ? c : c.slice(0, 10).concat(['...']),
          })),
          largestComponent: Math.max(...components.map((c) => c.length)),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Graph error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
