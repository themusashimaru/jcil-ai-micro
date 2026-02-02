/**
 * QAOA TOOL
 * Quantum Approximate Optimization Algorithm
 * Hybrid quantum-classical algorithm for combinatorial optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const qaoaTool: UnifiedTool = {
  name: 'qaoa',
  description: 'Quantum Approximate Optimization Algorithm for combinatorial problems',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['optimize', 'max_cut', 'graph_partition', 'circuit', 'demo', 'info'],
        description: 'Operation to perform'
      },
      depth: {
        type: 'number',
        description: 'Circuit depth p (default: 2)'
      },
      graph: {
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
        description: 'Adjacency matrix or edge list for graph problems'
      },
      num_qubits: {
        type: 'number',
        description: 'Number of qubits (nodes in graph)'
      },
      gamma: {
        type: 'array',
        items: { type: 'number' },
        description: 'Phase separation angles (length = p)'
      },
      beta: {
        type: 'array',
        items: { type: 'number' },
        description: 'Mixing angles (length = p)'
      }
    },
    required: ['operation']
  }
};

// Complex number type
interface Complex {
  re: number;
  im: number;
}

function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cScale(c: Complex, s: number): Complex {
  return { re: c.re * s, im: c.im * s };
}

function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

function cAbs2(c: Complex): number {
  return c.re * c.re + c.im * c.im;
}

// Graph representation
interface Graph {
  nodes: number;
  edges: Array<[number, number, number]>; // [i, j, weight]
}

// Parse graph input
function parseGraph(input: number[][] | undefined, numNodes: number): Graph {
  if (!input || input.length === 0) {
    // Default: simple cycle graph
    const edges: Array<[number, number, number]> = [];
    for (let i = 0; i < numNodes; i++) {
      edges.push([i, (i + 1) % numNodes, 1]);
    }
    return { nodes: numNodes, edges };
  }

  // Check if adjacency matrix or edge list
  if (input[0].length === input.length) {
    // Adjacency matrix
    const edges: Array<[number, number, number]> = [];
    for (let i = 0; i < input.length; i++) {
      for (let j = i + 1; j < input[i].length; j++) {
        if (input[i][j] !== 0) {
          edges.push([i, j, input[i][j]]);
        }
      }
    }
    return { nodes: input.length, edges };
  } else {
    // Edge list: [i, j] or [i, j, weight]
    const edges: Array<[number, number, number]> = input.map(e => [e[0], e[1], e[2] ?? 1]);
    const maxNode = Math.max(...edges.flatMap(e => [e[0], e[1]])) + 1;
    return { nodes: Math.max(numNodes, maxNode), edges };
  }
}

// Compute MaxCut cost for a bitstring
function maxCutCost(graph: Graph, bitstring: number): number {
  let cost = 0;
  for (const [i, j, w] of graph.edges) {
    const bi = (bitstring >> i) & 1;
    const bj = (bitstring >> j) & 1;
    if (bi !== bj) cost += w;
  }
  return cost;
}

// Create uniform superposition state
function createUniformState(n: number): Complex[] {
  const N = Math.pow(2, n);
  const amp = 1 / Math.sqrt(N);
  return new Array(N).fill(null).map(() => complex(amp));
}

// Apply phase separation unitary exp(-i γ C)
function applyPhaseSeparation(state: Complex[], graph: Graph, gamma: number): Complex[] {
  const N = state.length;
  const result: Complex[] = [];

  for (let x = 0; x < N; x++) {
    const cost = maxCutCost(graph, x);
    const phase = cExp(-gamma * cost);
    result.push(cMul(state[x], phase));
  }

  return result;
}

// Apply mixing unitary exp(-i β B) where B = Σ Xi
function applyMixing(state: Complex[], beta: number): Complex[] {
  const N = state.length;
  const n = Math.log2(N);
  let result = [...state];

  // Apply Rx(2β) to each qubit
  const cos_beta = Math.cos(beta);
  const sin_beta = Math.sin(beta);

  for (let q = 0; q < n; q++) {
    const newResult: Complex[] = new Array(N).fill(null).map(() => complex(0));

    for (let x = 0; x < N; x++) {
      const x_flipped = x ^ (1 << q);

      // Rx(2β) = [[cos β, -i sin β], [-i sin β, cos β]]
      newResult[x] = cAdd(
        newResult[x],
        cScale(result[x], cos_beta)
      );
      newResult[x] = cAdd(
        newResult[x],
        cMul(result[x_flipped], complex(0, -sin_beta))
      );
    }

    result = newResult;
  }

  return result;
}

// Run QAOA circuit
function runQAOA(
  graph: Graph,
  p: number,
  gamma: number[],
  beta: number[]
): { state: Complex[]; expectation: number; probabilities: number[] } {
  let state = createUniformState(graph.nodes);

  // Apply p layers
  for (let layer = 0; layer < p; layer++) {
    state = applyPhaseSeparation(state, graph, gamma[layer]);
    state = applyMixing(state, beta[layer]);
  }

  // Compute expectation value and probabilities
  const N = state.length;
  let expectation = 0;
  const probabilities: number[] = [];

  for (let x = 0; x < N; x++) {
    const prob = cAbs2(state[x]);
    probabilities.push(prob);
    expectation += prob * maxCutCost(graph, x);
  }

  return { state, expectation, probabilities };
}

// Simple optimization using grid search
function optimizeQAOA(
  graph: Graph,
  p: number,
  gridSize: number = 10
): {
  best_gamma: number[];
  best_beta: number[];
  best_expectation: number;
  optimization_path: Array<{ gamma: number[]; beta: number[]; expectation: number }>;
} {
  let bestGamma: number[] = [];
  let bestBeta: number[] = [];
  let bestExpectation = -Infinity;
  const path: Array<{ gamma: number[]; beta: number[]; expectation: number }> = [];

  // Simple grid search for p=1
  if (p === 1) {
    for (let gi = 0; gi <= gridSize; gi++) {
      for (let bi = 0; bi <= gridSize; bi++) {
        const gamma = [gi * Math.PI / gridSize];
        const beta = [bi * Math.PI / (2 * gridSize)];

        const { expectation } = runQAOA(graph, 1, gamma, beta);

        if (expectation > bestExpectation) {
          bestExpectation = expectation;
          bestGamma = gamma;
          bestBeta = beta;
        }

        if (path.length < 20) {
          path.push({ gamma, beta, expectation });
        }
      }
    }
  } else {
    // For p > 1, use random search
    for (let iter = 0; iter < 100; iter++) {
      const gamma = Array.from({ length: p }, () => Math.random() * Math.PI);
      const beta = Array.from({ length: p }, () => Math.random() * Math.PI / 2);

      const { expectation } = runQAOA(graph, p, gamma, beta);

      if (expectation > bestExpectation) {
        bestExpectation = expectation;
        bestGamma = gamma;
        bestBeta = beta;
      }

      if (path.length < 20) {
        path.push({ gamma, beta, expectation });
      }
    }
  }

  return {
    best_gamma: bestGamma,
    best_beta: bestBeta,
    best_expectation: bestExpectation,
    optimization_path: path
  };
}

// Generate QAOA circuit description
function generateQAOACircuit(graph: Graph, p: number): string {
  const lines: string[] = [];
  const n = graph.nodes;

  lines.push(`QAOA Circuit for ${n} qubits, depth p=${p}`);
  lines.push('='.repeat(50));
  lines.push('');
  lines.push('1. Initial state preparation:');
  lines.push('   Apply H to all qubits → |+⟩^⊗n');
  lines.push('');

  for (let layer = 0; layer < p; layer++) {
    lines.push(`Layer ${layer + 1}:`);
    lines.push(`  2a. Phase separation exp(-iγ${layer + 1}C):`);
    for (const [i, j, w] of graph.edges) {
      lines.push(`      CNOT(q${i}, q${j}) → Rz(γ${layer + 1}×${w}) → CNOT(q${i}, q${j})`);
    }
    lines.push(`  2b. Mixing exp(-iβ${layer + 1}B):`);
    for (let q = 0; q < n; q++) {
      lines.push(`      Rx(2β${layer + 1}) on q${q}`);
    }
    lines.push('');
  }

  lines.push('3. Measurement in computational basis');

  return lines.join('\n');
}

// Visualize results
function visualizeResults(
  graph: Graph,
  probabilities: number[],
  expectation: number
): string {
  const lines: string[] = [];
  const N = probabilities.length;
  const n = Math.log2(N);

  // Find optimal classical solution
  let optimalCost = 0;
  let optimalBitstring = 0;
  for (let x = 0; x < N; x++) {
    const cost = maxCutCost(graph, x);
    if (cost > optimalCost) {
      optimalCost = cost;
      optimalBitstring = x;
    }
  }

  lines.push('MaxCut Results:');
  lines.push('-'.repeat(40));
  lines.push(`Optimal classical solution: ${optimalCost} (bitstring: ${optimalBitstring.toString(2).padStart(n, '0')})`);
  lines.push(`QAOA expectation value: ${expectation.toFixed(4)}`);
  lines.push(`Approximation ratio: ${(expectation / optimalCost).toFixed(4)}`);
  lines.push('');
  lines.push('Top measurement outcomes:');

  // Sort by probability
  const indexed = probabilities.map((p, i) => ({ prob: p, bitstring: i, cost: maxCutCost(graph, i) }));
  indexed.sort((a, b) => b.prob - a.prob);

  for (let i = 0; i < Math.min(8, N); i++) {
    const { prob, bitstring, cost } = indexed[i];
    const bs = bitstring.toString(2).padStart(n, '0');
    const bar = '█'.repeat(Math.round(prob * 30));
    lines.push(`  |${bs}⟩ cost=${cost}: ${(prob * 100).toFixed(2)}% ${bar}`);
  }

  return lines.join('\n');
}

export async function executeqaoa(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      depth = 2,
      graph: graphInput,
      num_qubits = 4,
      gamma: inputGamma,
      beta: inputBeta
    } = args;

    if (operation === 'info') {
      const info = {
        tool: 'qaoa',
        description: 'Quantum Approximate Optimization Algorithm - hybrid quantum-classical algorithm for combinatorial optimization',
        operations: {
          optimize: 'Run QAOA optimization to find best parameters',
          max_cut: 'Solve MaxCut problem on a graph',
          graph_partition: 'Solve graph partitioning problem',
          circuit: 'Show QAOA circuit structure',
          demo: 'Demonstrate QAOA on example problems'
        },
        theory: {
          ansatz: '|ψ(γ,β)⟩ = Π[exp(-iβ_p B)exp(-iγ_p C)]|+⟩^n',
          cost_operator: 'C encodes the objective function',
          mixer_operator: 'B = Σ Xi provides transitions between states',
          variational: 'Classical optimizer finds optimal γ, β'
        },
        parameters: {
          p: 'Circuit depth - more layers allow better approximation',
          gamma: 'Phase separation angles (one per layer)',
          beta: 'Mixing angles (one per layer)'
        },
        applications: [
          'MaxCut problem',
          'Graph partitioning',
          'Traveling salesman (TSP)',
          'Satisfiability (SAT)',
          'Portfolio optimization'
        ],
        performance: {
          p1_maxcut: 'Guarantees approximation ratio ≥ 0.6924',
          scaling: 'Performance improves with depth p'
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      // Demo on a small triangle graph
      const triangleGraph: Graph = {
        nodes: 3,
        edges: [[0, 1, 1], [1, 2, 1], [0, 2, 1]]
      };

      // Demo on a 4-node graph
      const squareGraph: Graph = {
        nodes: 4,
        edges: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 0, 1], [0, 2, 1]]
      };

      const p = Math.min(depth, 2);

      const triangleOpt = optimizeQAOA(triangleGraph, p, 15);
      const triangleResult = runQAOA(triangleGraph, p, triangleOpt.best_gamma, triangleOpt.best_beta);

      const squareOpt = optimizeQAOA(squareGraph, p, 15);
      const squareResult = runQAOA(squareGraph, p, squareOpt.best_gamma, squareOpt.best_beta);

      const result = {
        operation: 'demo',
        depth: p,
        examples: [
          {
            name: 'Triangle graph (3 nodes)',
            graph: { nodes: 3, edges: triangleGraph.edges },
            optimal_parameters: {
              gamma: triangleOpt.best_gamma.map(g => g.toFixed(4)),
              beta: triangleOpt.best_beta.map(b => b.toFixed(4))
            },
            expectation: triangleOpt.best_expectation.toFixed(4),
            visualization: visualizeResults(triangleGraph, triangleResult.probabilities, triangleResult.expectation)
          },
          {
            name: 'Square with diagonal (4 nodes)',
            graph: { nodes: 4, edges: squareGraph.edges },
            optimal_parameters: {
              gamma: squareOpt.best_gamma.map(g => g.toFixed(4)),
              beta: squareOpt.best_beta.map(b => b.toFixed(4))
            },
            expectation: squareOpt.best_expectation.toFixed(4),
            visualization: visualizeResults(squareGraph, squareResult.probabilities, squareResult.expectation)
          }
        ],
        circuit: generateQAOACircuit(squareGraph, p)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    const n = Math.min(num_qubits, 8);
    const p = Math.min(depth, 5);
    const graph = parseGraph(graphInput, n);

    if (operation === 'circuit') {
      const result = {
        operation: 'circuit',
        num_qubits: graph.nodes,
        depth: p,
        graph: { nodes: graph.nodes, edges: graph.edges },
        circuit: generateQAOACircuit(graph, p),
        gate_count: {
          hadamards: graph.nodes,
          cnots_per_layer: graph.edges.length * 2,
          rotations_per_layer: graph.edges.length + graph.nodes,
          total_per_layer: graph.edges.length * 2 + graph.edges.length + graph.nodes,
          total: graph.nodes + p * (graph.edges.length * 3 + graph.nodes)
        }
      };
      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'optimize' || operation === 'max_cut' || operation === 'graph_partition') {
      const optResult = optimizeQAOA(graph, p, 15);
      const { state, expectation, probabilities } = runQAOA(
        graph, p, optResult.best_gamma, optResult.best_beta
      );

      // Find classical optimal
      const N = Math.pow(2, graph.nodes);
      let optimalCost = 0;
      for (let x = 0; x < N; x++) {
        optimalCost = Math.max(optimalCost, maxCutCost(graph, x));
      }

      const result = {
        operation: operation === 'graph_partition' ? 'graph_partition' : 'max_cut',
        num_qubits: graph.nodes,
        depth: p,
        graph: { nodes: graph.nodes, edges: graph.edges },
        optimal_parameters: {
          gamma: optResult.best_gamma.map(g => Math.round(g * 10000) / 10000),
          beta: optResult.best_beta.map(b => Math.round(b * 10000) / 10000)
        },
        results: {
          qaoa_expectation: Math.round(expectation * 10000) / 10000,
          classical_optimal: optimalCost,
          approximation_ratio: Math.round(expectation / optimalCost * 10000) / 10000
        },
        visualization: visualizeResults(graph, probabilities, expectation),
        optimization_samples: optResult.optimization_path.slice(0, 5).map(p => ({
          gamma: p.gamma.map(g => g.toFixed(3)),
          beta: p.beta.map(b => b.toFixed(3)),
          expectation: p.expectation.toFixed(4)
        }))
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return {
      toolCallId: id,
      content: `Error: Unknown operation '${operation}'`,
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isqaoaAvailable(): boolean { return true; }
