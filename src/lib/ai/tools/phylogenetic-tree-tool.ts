/**
 * PHYLOGENETIC-TREE TOOL
 * Phylogenetic tree construction with real algorithms
 * Implements UPGMA, Neighbor-Joining, and tree analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const phylogenetictreeTool: UnifiedTool = {
  name: 'phylogenetic_tree',
  description: 'Phylogenetic tree construction and analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['build', 'analyze', 'visualize', 'distance_matrix', 'info'], description: 'Operation' },
      method: { type: 'string', enum: ['neighbor_joining', 'UPGMA', 'maximum_parsimony'], description: 'Method' },
      sequences: { type: 'array', items: { type: 'string' }, description: 'Input sequences' },
      names: { type: 'array', items: { type: 'string' }, description: 'Taxon names' },
      distance_matrix: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Precomputed distance matrix' }
    },
    required: ['operation']
  }
};

// Tree node structure
interface TreeNode {
  name: string;
  children: TreeNode[];
  branchLength: number;
  isLeaf: boolean;
}

// Calculate sequence distance (simple p-distance)
function pDistance(seq1: string, seq2: string): number {
  const len = Math.min(seq1.length, seq2.length);
  if (len === 0) return 0;

  let mismatches = 0;
  for (let i = 0; i < len; i++) {
    if (seq1[i].toUpperCase() !== seq2[i].toUpperCase()) {
      mismatches++;
    }
  }
  return mismatches / len;
}

// Jukes-Cantor distance correction
function jukesCantor(pDist: number): number {
  if (pDist >= 0.75) return 3; // Maximum distance
  const d = -0.75 * Math.log(1 - (4 / 3) * pDist);
  return Math.max(0, d);
}

// Calculate distance matrix from sequences
function calculateDistanceMatrix(sequences: string[], useJC: boolean = true): number[][] {
  const n = sequences.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = pDistance(sequences[i], sequences[j]);
      const d = useJC ? jukesCantor(p) : p;
      matrix[i][j] = matrix[j][i] = d;
    }
  }

  return matrix;
}

// UPGMA (Unweighted Pair Group Method with Arithmetic Mean)
function buildUPGMA(distMatrix: number[][], names: string[]): TreeNode {
  const n = names.length;

  // Create initial clusters (each taxon is a cluster)
  let clusters: { node: TreeNode; size: number; indices: number[] }[] = names.map((name, i) => ({
    node: { name, children: [], branchLength: 0, isLeaf: true },
    size: 1,
    indices: [i]
  }));

  // Copy distance matrix
  const D: number[][] = distMatrix.map(row => [...row]);
  const active: boolean[] = Array(n).fill(true);
  const heights: number[] = Array(n).fill(0);

  while (clusters.filter((_, i) => active[i]).length > 1) {
    // Find minimum distance
    let minDist = Infinity;
    let mini = -1, minj = -1;

    for (let i = 0; i < n; i++) {
      if (!active[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!active[j]) continue;
        if (D[i][j] < minDist) {
          minDist = D[i][j];
          mini = i;
          minj = j;
        }
      }
    }

    if (mini === -1) break;

    // Calculate branch lengths
    const newHeight = minDist / 2;
    clusters[mini].node.branchLength = newHeight - heights[mini];
    clusters[minj].node.branchLength = newHeight - heights[minj];

    // Create new cluster
    const newNode: TreeNode = {
      name: `(${clusters[mini].node.name},${clusters[minj].node.name})`,
      children: [clusters[mini].node, clusters[minj].node],
      branchLength: 0,
      isLeaf: false
    };

    const newSize = clusters[mini].size + clusters[minj].size;

    // Update distances
    for (let k = 0; k < n; k++) {
      if (!active[k] || k === mini || k === minj) continue;
      const dik = D[mini][k];
      const djk = D[minj][k];
      const newDist = (dik * clusters[mini].size + djk * clusters[minj].size) / newSize;
      D[mini][k] = D[k][mini] = newDist;
    }

    // Merge clusters
    clusters[mini] = { node: newNode, size: newSize, indices: [...clusters[mini].indices, ...clusters[minj].indices] };
    heights[mini] = newHeight;
    active[minj] = false;
  }

  // Find root
  const rootIdx = active.findIndex(a => a);
  return clusters[rootIdx].node;
}

// Neighbor-Joining algorithm
function buildNeighborJoining(distMatrix: number[][], names: string[]): TreeNode {
  const n = names.length;
  if (n <= 1) {
    return { name: names[0] || 'root', children: [], branchLength: 0, isLeaf: true };
  }

  // Create initial nodes
  let nodes: TreeNode[] = names.map(name => ({
    name,
    children: [],
    branchLength: 0,
    isLeaf: true
  }));

  // Copy distance matrix
  const D: number[][] = distMatrix.map(row => [...row]);
  const active: boolean[] = Array(n).fill(true);
  let activeCount = n;

  while (activeCount > 2) {
    // Calculate r values (sum of distances to all other taxa)
    const r: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (!active[i]) continue;
      for (let j = 0; j < n; j++) {
        if (!active[j] || i === j) continue;
        r[i] += D[i][j];
      }
    }

    // Find pair that minimizes Q
    let minQ = Infinity;
    let mini = -1, minj = -1;

    for (let i = 0; i < n; i++) {
      if (!active[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!active[j]) continue;
        const Q = (activeCount - 2) * D[i][j] - r[i] - r[j];
        if (Q < minQ) {
          minQ = Q;
          mini = i;
          minj = j;
        }
      }
    }

    if (mini === -1) break;

    // Calculate branch lengths
    const branchI = D[mini][minj] / 2 + (r[mini] - r[minj]) / (2 * (activeCount - 2));
    const branchJ = D[mini][minj] - branchI;

    nodes[mini].branchLength = Math.max(0, branchI);
    nodes[minj].branchLength = Math.max(0, branchJ);

    // Create new node
    const newNode: TreeNode = {
      name: `(${nodes[mini].name},${nodes[minj].name})`,
      children: [nodes[mini], nodes[minj]],
      branchLength: 0,
      isLeaf: false
    };

    // Update distances
    for (let k = 0; k < n; k++) {
      if (!active[k] || k === mini || k === minj) continue;
      const newDist = (D[mini][k] + D[minj][k] - D[mini][minj]) / 2;
      D[mini][k] = D[k][mini] = Math.max(0, newDist);
    }

    // Update
    nodes[mini] = newNode;
    active[minj] = false;
    activeCount--;
  }

  // Connect final two nodes
  const remaining = active.map((a, i) => a ? i : -1).filter(i => i >= 0);
  if (remaining.length === 2) {
    const [i, j] = remaining;
    nodes[i].branchLength = D[i][j] / 2;
    nodes[j].branchLength = D[i][j] / 2;

    return {
      name: 'root',
      children: [nodes[i], nodes[j]],
      branchLength: 0,
      isLeaf: false
    };
  }

  return nodes[remaining[0]];
}

// Convert tree to Newick format
function toNewick(node: TreeNode): string {
  if (node.isLeaf) {
    return node.branchLength > 0
      ? `${node.name}:${node.branchLength.toFixed(4)}`
      : node.name;
  }

  const childStrings = node.children.map(c => toNewick(c));
  const inner = `(${childStrings.join(',')})`;
  return node.branchLength > 0
    ? `${inner}:${node.branchLength.toFixed(4)}`
    : inner;
}

// Create ASCII tree visualization
function visualizeTree(node: TreeNode, prefix: string = '', isLast: boolean = true): string[] {
  const lines: string[] = [];
  const connector = isLast ? '└── ' : '├── ';
  const branchInfo = node.branchLength > 0 ? ` (${node.branchLength.toFixed(3)})` : '';

  lines.push(prefix + connector + node.name + branchInfo);

  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  node.children.forEach((child, i) => {
    const childLines = visualizeTree(child, childPrefix, i === node.children.length - 1);
    lines.push(...childLines);
  });

  return lines;
}

// Calculate tree statistics
function analyzeTree(node: TreeNode): {
  leafCount: number;
  internalCount: number;
  totalBranchLength: number;
  maxDepth: number;
  avgBranchLength: number;
} {
  let leafCount = 0;
  let internalCount = 0;
  let totalBranchLength = 0;
  let branchCount = 0;

  function traverse(n: TreeNode, depth: number): number {
    totalBranchLength += n.branchLength;
    if (n.branchLength > 0) branchCount++;

    if (n.isLeaf) {
      leafCount++;
      return depth;
    }

    internalCount++;
    return Math.max(...n.children.map(c => traverse(c, depth + 1)));
  }

  const maxDepth = traverse(node, 0);

  return {
    leafCount,
    internalCount,
    totalBranchLength,
    maxDepth,
    avgBranchLength: branchCount > 0 ? totalBranchLength / branchCount : 0
  };
}

// Get leaf names
function getLeaves(node: TreeNode): string[] {
  if (node.isLeaf) return [node.name];
  return node.children.flatMap(c => getLeaves(c));
}

export async function executephylogenetictree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'phylogenetic-tree',
        description: 'Construct and analyze evolutionary trees from sequence data',

        methods: {
          UPGMA: {
            name: 'Unweighted Pair Group Method with Arithmetic Mean',
            type: 'Distance-based',
            assumption: 'Molecular clock (constant evolutionary rate)',
            complexity: 'O(n³)',
            produces: 'Ultrametric tree (all leaves equidistant from root)'
          },
          neighbor_joining: {
            name: 'Neighbor-Joining',
            type: 'Distance-based',
            assumption: 'Minimum evolution principle',
            complexity: 'O(n³)',
            produces: 'Additive tree (branch lengths represent evolutionary distance)'
          },
          maximum_parsimony: {
            name: 'Maximum Parsimony',
            type: 'Character-based',
            principle: 'Minimize total evolutionary changes',
            note: 'NP-hard, heuristics used for large datasets'
          },
          maximum_likelihood: {
            name: 'Maximum Likelihood',
            type: 'Statistical',
            principle: 'Find tree that maximizes probability of observed data',
            note: 'Computationally intensive but statistically rigorous'
          }
        },

        distanceMetrics: {
          pDistance: 'Proportion of differing sites',
          jukesCantor: 'Corrects for multiple substitutions at same site',
          kimura2p: 'Separate rates for transitions and transversions'
        },

        concepts: {
          monophyletic: 'Clade containing ancestor and ALL descendants',
          paraphyletic: 'Ancestor and SOME descendants',
          polyphyletic: 'Taxa with multiple origins (not a natural group)',
          outgroup: 'Taxon used to root the tree',
          bootstrap: 'Statistical support for branches (resampling)'
        },

        outputFormats: {
          newick: '((A:0.1,B:0.2):0.3,C:0.4);',
          nexus: 'Extended format with metadata',
          phyloXML: 'XML format for complex annotations'
        }
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Default demo sequences (simplified for demonstration)
    const defaultSequences = [
      'ATGCGATCGATCG',  // Human
      'ATGCGATTGATCG',  // Chimp
      'ATGCGATCAATCG',  // Gorilla
      'ATGTGATCGATCG',  // Mouse
      'CTGCGATCGATCG'   // Rat
    ];
    const defaultNames = ['Human', 'Chimp', 'Gorilla', 'Mouse', 'Rat'];

    const sequences = args.sequences || defaultSequences;
    const names = args.names || defaultNames.slice(0, sequences.length);
    const method = args.method || 'neighbor_joining';

    if (operation === 'distance_matrix') {
      const matrix = args.distance_matrix || calculateDistanceMatrix(sequences);

      // Format matrix for display
      const matrixDisplay = ['Distance Matrix:'];
      const header = '        ' + names.map(n => n.substring(0, 6).padEnd(8)).join('');
      matrixDisplay.push(header);

      for (let i = 0; i < names.length; i++) {
        const row = names[i].substring(0, 6).padEnd(8) +
          matrix[i].map(d => d.toFixed(4).padStart(8)).join('');
        matrixDisplay.push(row);
      }

      const output = {
        operation: 'distance_matrix',
        taxa: names,
        distanceMetric: 'Jukes-Cantor corrected p-distance',

        matrix: matrix.map(row => row.map(d => Number(d.toFixed(4)))),

        display: matrixDisplay.join('\n'),

        statistics: {
          minDistance: Number(Math.min(...matrix.flat().filter(d => d > 0)).toFixed(4)),
          maxDistance: Number(Math.max(...matrix.flat()).toFixed(4)),
          avgDistance: Number((matrix.flat().filter(d => d > 0).reduce((a, b) => a + b, 0) /
            matrix.flat().filter(d => d > 0).length).toFixed(4))
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'build') {
      // Calculate distance matrix
      const matrix = args.distance_matrix || calculateDistanceMatrix(sequences);

      // Build tree
      let tree: TreeNode;
      if (method === 'UPGMA') {
        tree = buildUPGMA(matrix, names);
      } else {
        tree = buildNeighborJoining(matrix, names);
      }

      // Generate Newick format
      const newick = toNewick(tree) + ';';

      // Create visualization
      const visualization = visualizeTree(tree);

      // Analyze tree
      const stats = analyzeTree(tree);

      const output = {
        operation: 'build_tree',
        method,
        inputTaxa: names,

        tree: {
          newick,
          visualization: visualization.join('\n')
        },

        statistics: {
          leafCount: stats.leafCount,
          internalNodes: stats.internalCount,
          totalBranchLength: Number(stats.totalBranchLength.toFixed(4)),
          averageBranchLength: Number(stats.avgBranchLength.toFixed(4)),
          treeDepth: stats.maxDepth
        },

        interpretation: method === 'UPGMA'
          ? 'UPGMA assumes a molecular clock - all taxa evolve at same rate'
          : 'Neighbor-Joining does not assume a molecular clock'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'analyze') {
      // Build tree first
      const matrix = args.distance_matrix || calculateDistanceMatrix(sequences);
      const tree = method === 'UPGMA'
        ? buildUPGMA(matrix, names)
        : buildNeighborJoining(matrix, names);

      const stats = analyzeTree(tree);
      const leaves = getLeaves(tree);

      // Find closest pair
      let closestPair = { taxa: ['', ''], distance: Infinity };
      for (let i = 0; i < matrix.length; i++) {
        for (let j = i + 1; j < matrix.length; j++) {
          if (matrix[i][j] < closestPair.distance) {
            closestPair = { taxa: [names[i], names[j]], distance: matrix[i][j] };
          }
        }
      }

      // Find most distant pair
      let mostDistant = { taxa: ['', ''], distance: 0 };
      for (let i = 0; i < matrix.length; i++) {
        for (let j = i + 1; j < matrix.length; j++) {
          if (matrix[i][j] > mostDistant.distance) {
            mostDistant = { taxa: [names[i], names[j]], distance: matrix[i][j] };
          }
        }
      }

      const output = {
        operation: 'analyze_tree',
        method,

        treeStructure: {
          taxa: leaves,
          totalTaxa: stats.leafCount,
          internalNodes: stats.internalCount,
          treeDepth: stats.maxDepth
        },

        branchStatistics: {
          totalLength: Number(stats.totalBranchLength.toFixed(4)),
          averageLength: Number(stats.avgBranchLength.toFixed(4)),
          branchCount: stats.leafCount + stats.internalCount - 1
        },

        relationships: {
          closestPair: {
            taxa: closestPair.taxa,
            distance: Number(closestPair.distance.toFixed(4))
          },
          mostDistantPair: {
            taxa: mostDistant.taxa,
            distance: Number(mostDistant.distance.toFixed(4))
          }
        },

        newick: toNewick(tree) + ';',

        biologicalInterpretation: `The tree suggests ${closestPair.taxa.join(' and ')} are most closely related, ` +
          `while ${mostDistant.taxa.join(' and ')} are most distantly related.`
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'visualize') {
      const matrix = args.distance_matrix || calculateDistanceMatrix(sequences);
      const tree = method === 'UPGMA'
        ? buildUPGMA(matrix, names)
        : buildNeighborJoining(matrix, names);

      const visualization = visualizeTree(tree);
      const newick = toNewick(tree) + ';';

      // Create cladogram-style ASCII art
      const cladogram: string[] = ['Cladogram:', ''];
      const leaves = getLeaves(tree);
      const indent = '    ';

      for (let i = 0; i < leaves.length; i++) {
        const branch = i < leaves.length - 1 ? '├' : '└';
        cladogram.push(indent + branch + '───' + leaves[i]);
      }

      const output = {
        operation: 'visualize',
        method,

        treeVisualization: visualization.join('\n'),

        simpleCladogram: cladogram.join('\n'),

        newickFormat: newick,

        legend: {
          branchValues: 'Numbers in parentheses are branch lengths (evolutionary distance)',
          treeReading: 'Taxa connected by shorter branches are more closely related',
          root: method === 'UPGMA'
            ? 'Root represents common ancestor (tree is ultrametric)'
            : 'Root placement is arbitrary without outgroup'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isphylogenetictreeAvailable(): boolean { return true; }
