/**
 * BAYESIAN NETWORK TOOL
 *
 * Probabilistic graphical models for reasoning under uncertainty.
 * Implements belief propagation, variable elimination, and learning.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface Node {
  name: string;
  states: string[];
  parents: string[];
  cpt: number[][]; // Conditional probability table
}

interface BayesianNetwork {
  nodes: Map<string, Node>;
  edges: Array<[string, string]>;
}

interface Evidence {
  [variable: string]: string;
}

interface QueryResult {
  variable: string;
  distribution: Record<string, number>;
  entropy: number;
  mostLikely: string;
  confidence: number;
}

// ============================================================================
// CLASSIC BAYESIAN NETWORK EXAMPLES
// ============================================================================

const EXAMPLE_NETWORKS: Record<string, { nodes: Node[]; description: string }> = {
  alarm: {
    description: 'Classic alarm network: Burglary/Earthquake -> Alarm -> John/Mary calls',
    nodes: [
      {
        name: 'Burglary',
        states: ['true', 'false'],
        parents: [],
        cpt: [[0.001], [0.999]]
      },
      {
        name: 'Earthquake',
        states: ['true', 'false'],
        parents: [],
        cpt: [[0.002], [0.998]]
      },
      {
        name: 'Alarm',
        states: ['true', 'false'],
        parents: ['Burglary', 'Earthquake'],
        // P(A|B,E): B=T,E=T; B=T,E=F; B=F,E=T; B=F,E=F
        cpt: [
          [0.95, 0.94, 0.29, 0.001],
          [0.05, 0.06, 0.71, 0.999]
        ]
      },
      {
        name: 'JohnCalls',
        states: ['true', 'false'],
        parents: ['Alarm'],
        cpt: [
          [0.90, 0.05],
          [0.10, 0.95]
        ]
      },
      {
        name: 'MaryCalls',
        states: ['true', 'false'],
        parents: ['Alarm'],
        cpt: [
          [0.70, 0.01],
          [0.30, 0.99]
        ]
      }
    ]
  },
  sprinkler: {
    description: 'Weather network: Cloudy -> Sprinkler/Rain -> WetGrass',
    nodes: [
      {
        name: 'Cloudy',
        states: ['true', 'false'],
        parents: [],
        cpt: [[0.5], [0.5]]
      },
      {
        name: 'Sprinkler',
        states: ['true', 'false'],
        parents: ['Cloudy'],
        cpt: [
          [0.1, 0.5],
          [0.9, 0.5]
        ]
      },
      {
        name: 'Rain',
        states: ['true', 'false'],
        parents: ['Cloudy'],
        cpt: [
          [0.8, 0.2],
          [0.2, 0.8]
        ]
      },
      {
        name: 'WetGrass',
        states: ['true', 'false'],
        parents: ['Sprinkler', 'Rain'],
        // P(W|S,R): S=T,R=T; S=T,R=F; S=F,R=T; S=F,R=F
        cpt: [
          [0.99, 0.90, 0.90, 0.00],
          [0.01, 0.10, 0.10, 1.00]
        ]
      }
    ]
  },
  medical: {
    description: 'Simple medical diagnosis: Smoking -> Cancer/Bronchitis -> Dyspnea/Xray',
    nodes: [
      {
        name: 'Smoking',
        states: ['true', 'false'],
        parents: [],
        cpt: [[0.3], [0.7]]
      },
      {
        name: 'Cancer',
        states: ['true', 'false'],
        parents: ['Smoking'],
        cpt: [
          [0.03, 0.001],
          [0.97, 0.999]
        ]
      },
      {
        name: 'Bronchitis',
        states: ['true', 'false'],
        parents: ['Smoking'],
        cpt: [
          [0.45, 0.05],
          [0.55, 0.95]
        ]
      },
      {
        name: 'Dyspnea',
        states: ['true', 'false'],
        parents: ['Cancer', 'Bronchitis'],
        cpt: [
          [0.90, 0.70, 0.65, 0.30],
          [0.10, 0.30, 0.35, 0.70]
        ]
      },
      {
        name: 'PositiveXray',
        states: ['true', 'false'],
        parents: ['Cancer'],
        cpt: [
          [0.90, 0.02],
          [0.10, 0.98]
        ]
      }
    ]
  }
};

// ============================================================================
// PROBABILITY OPERATIONS
// ============================================================================

function createNetwork(nodes: Node[]): BayesianNetwork {
  const network: BayesianNetwork = {
    nodes: new Map(),
    edges: []
  };

  for (const node of nodes) {
    network.nodes.set(node.name, node);
    for (const parent of node.parents) {
      network.edges.push([parent, node.name]);
    }
  }

  return network;
}

function getTopologicalOrder(network: BayesianNetwork): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function dfs(nodeName: string) {
    if (visited.has(nodeName)) return;
    visited.add(nodeName);

    const node = network.nodes.get(nodeName);
    if (node) {
      for (const parent of node.parents) {
        dfs(parent);
      }
    }
    order.push(nodeName);
  }

  for (const nodeName of network.nodes.keys()) {
    dfs(nodeName);
  }

  return order;
}

function getCPTIndex(node: Node, parentStates: Record<string, string>, network: BayesianNetwork): number {
  if (node.parents.length === 0) return 0;

  let index = 0;
  let multiplier = 1;

  // Process parents in reverse order for correct indexing
  for (let i = node.parents.length - 1; i >= 0; i--) {
    const parentName = node.parents[i];
    const parentNode = network.nodes.get(parentName);
    if (!parentNode) continue;

    const stateIndex = parentNode.states.indexOf(parentStates[parentName]);
    index += stateIndex * multiplier;
    multiplier *= parentNode.states.length;
  }

  return index;
}

function getProbability(
  node: Node,
  state: string,
  parentStates: Record<string, string>,
  network: BayesianNetwork
): number {
  const stateIndex = node.states.indexOf(state);
  const cptIndex = getCPTIndex(node, parentStates, network);
  return node.cpt[stateIndex][cptIndex];
}

// ============================================================================
// INFERENCE ALGORITHMS
// ============================================================================

// Variable Elimination for exact inference
function variableElimination(
  network: BayesianNetwork,
  queryVar: string,
  evidence: Evidence
): Record<string, number> {
  const order = getTopologicalOrder(network);
  const hiddenVars = order.filter(v => v !== queryVar && !(v in evidence));

  // Initialize factors from CPTs
  type Factor = {
    variables: string[];
    values: Map<string, number>;
  };

  const factors: Factor[] = [];

  for (const [_nodeName, node] of network.nodes) {
    const factor: Factor = {
      variables: [node.name, ...node.parents],
      values: new Map()
    };

    // Generate all combinations
    const allVars = [node.name, ...node.parents];
    const combinations = generateCombinations(allVars, network);

    for (const combo of combinations) {
      const parentStates: Record<string, string> = {};
      for (const parent of node.parents) {
        parentStates[parent] = combo[parent];
      }
      const prob = getProbability(node, combo[node.name], parentStates, network);
      factor.values.set(JSON.stringify(combo), prob);
    }

    factors.push(factor);
  }

  // Apply evidence by restricting factors
  for (const factor of factors) {
    const restrictedValues = new Map<string, number>();
    for (const [key, value] of factor.values) {
      const assignment = JSON.parse(key);
      let consistent = true;
      for (const [ev, state] of Object.entries(evidence)) {
        if (assignment[ev] !== undefined && assignment[ev] !== state) {
          consistent = false;
          break;
        }
      }
      if (consistent) {
        restrictedValues.set(key, value);
      }
    }
    factor.values = restrictedValues;
  }

  // Eliminate hidden variables one by one
  for (const hiddenVar of hiddenVars) {
    // Find factors containing this variable
    const relevantFactors = factors.filter(f => f.variables.includes(hiddenVar));
    if (relevantFactors.length === 0) continue;

    // Remove these factors
    for (const rf of relevantFactors) {
      const idx = factors.indexOf(rf);
      if (idx !== -1) factors.splice(idx, 1);
    }

    // Multiply relevant factors and marginalize out hidden variable
    const newFactor = multiplyAndMarginalize(relevantFactors, hiddenVar, network);
    factors.push(newFactor);
  }

  // Multiply remaining factors
  const result = multiplyFactors(factors);

  // Normalize
  let sum = 0;
  for (const value of result.values.values()) {
    sum += value;
  }

  const distribution: Record<string, number> = {};
  const queryNode = network.nodes.get(queryVar);
  if (queryNode) {
    for (const state of queryNode.states) {
      let prob = 0;
      for (const [key, value] of result.values) {
        const assignment = JSON.parse(key);
        if (assignment[queryVar] === state) {
          prob += value;
        }
      }
      distribution[state] = sum > 0 ? prob / sum : 0;
    }
  }

  return distribution;
}

function generateCombinations(
  variables: string[],
  network: BayesianNetwork
): Array<Record<string, string>> {
  if (variables.length === 0) return [{}];

  const [first, ...rest] = variables;
  const node = network.nodes.get(first);
  if (!node) return generateCombinations(rest, network);

  const restCombinations = generateCombinations(rest, network);
  const result: Array<Record<string, string>> = [];

  for (const state of node.states) {
    for (const combo of restCombinations) {
      result.push({ ...combo, [first]: state });
    }
  }

  return result;
}

function multiplyAndMarginalize(
  factors: Array<{ variables: string[]; values: Map<string, number> }>,
  marginVar: string,
  network: BayesianNetwork
): { variables: string[]; values: Map<string, number> } {
  // Combine all variables except the one being marginalized
  const allVars = new Set<string>();
  for (const f of factors) {
    for (const v of f.variables) {
      if (v !== marginVar) allVars.add(v);
    }
  }

  const resultVars = Array.from(allVars);
  const resultValues = new Map<string, number>();

  // Generate combinations of remaining variables
  const combinations = generateCombinations(resultVars, network);
  const marginNode = network.nodes.get(marginVar);
  if (!marginNode) {
    return { variables: resultVars, values: resultValues };
  }

  for (const combo of combinations) {
    let sum = 0;

    // Sum over all states of marginalized variable
    for (const marginState of marginNode.states) {
      const fullAssignment = { ...combo, [marginVar]: marginState };

      // Multiply values from all factors
      let product = 1;
      for (const factor of factors) {
        // Find matching entry in factor
        for (const [key, value] of factor.values) {
          const factorAssignment = JSON.parse(key);
          let matches = true;
          for (const v of factor.variables) {
            if (factorAssignment[v] !== fullAssignment[v]) {
              matches = false;
              break;
            }
          }
          if (matches) {
            product *= value;
            break;
          }
        }
      }
      sum += product;
    }

    resultValues.set(JSON.stringify(combo), sum);
  }

  return { variables: resultVars, values: resultValues };
}

function multiplyFactors(
  factors: Array<{ variables: string[]; values: Map<string, number> }>
): { variables: string[]; values: Map<string, number> } {
  if (factors.length === 0) {
    return { variables: [], values: new Map([['{}', 1]]) };
  }
  if (factors.length === 1) return factors[0];

  let result = factors[0];
  for (let i = 1; i < factors.length; i++) {
    const allVars = new Set([...result.variables, ...factors[i].variables]);
    const newValues = new Map<string, number>();

    for (const [key1, val1] of result.values) {
      const assign1 = JSON.parse(key1);
      for (const [key2, val2] of factors[i].values) {
        const assign2 = JSON.parse(key2);

        // Check consistency
        let consistent = true;
        for (const v of result.variables) {
          if (factors[i].variables.includes(v) && assign1[v] !== assign2[v]) {
            consistent = false;
            break;
          }
        }

        if (consistent) {
          const merged = { ...assign1, ...assign2 };
          const key = JSON.stringify(merged);
          newValues.set(key, (newValues.get(key) || 0) + val1 * val2);
        }
      }
    }

    result = { variables: Array.from(allVars), values: newValues };
  }

  return result;
}

// Likelihood Weighting for approximate inference
function likelihoodWeighting(
  network: BayesianNetwork,
  queryVar: string,
  evidence: Evidence,
  numSamples: number = 1000
): Record<string, number> {
  const order = getTopologicalOrder(network);
  const queryNode = network.nodes.get(queryVar);
  if (!queryNode) return {};

  const counts: Record<string, number> = {};
  for (const state of queryNode.states) {
    counts[state] = 0;
  }

  for (let i = 0; i < numSamples; i++) {
    const sample: Record<string, string> = {};
    let weight = 1.0;

    for (const varName of order) {
      const node = network.nodes.get(varName);
      if (!node) continue;

      const parentStates: Record<string, string> = {};
      for (const parent of node.parents) {
        parentStates[parent] = sample[parent];
      }

      if (varName in evidence) {
        // Evidence variable - use as-is and update weight
        sample[varName] = evidence[varName];
        weight *= getProbability(node, evidence[varName], parentStates, network);
      } else {
        // Sample from distribution
        let cumProb = 0;
        const rand = Math.random();

        for (const state of node.states) {
          cumProb += getProbability(node, state, parentStates, network);
          if (rand <= cumProb) {
            sample[varName] = state;
            break;
          }
        }

        if (!sample[varName]) {
          sample[varName] = node.states[node.states.length - 1];
        }
      }
    }

    counts[sample[queryVar]] += weight;
  }

  // Normalize
  let total = 0;
  for (const count of Object.values(counts)) {
    total += count;
  }

  const distribution: Record<string, number> = {};
  for (const [state, count] of Object.entries(counts)) {
    distribution[state] = total > 0 ? count / total : 0;
  }

  return distribution;
}

// Gibbs Sampling for approximate inference
function gibbsSampling(
  network: BayesianNetwork,
  queryVar: string,
  evidence: Evidence,
  numSamples: number = 1000,
  burnIn: number = 100
): Record<string, number> {
  const order = getTopologicalOrder(network);
  const nonEvidenceVars = order.filter(v => !(v in evidence));
  const queryNode = network.nodes.get(queryVar);
  if (!queryNode) return {};

  // Initialize sample
  const sample: Record<string, string> = { ...evidence };
  for (const varName of nonEvidenceVars) {
    const node = network.nodes.get(varName);
    if (node) {
      sample[varName] = node.states[Math.floor(Math.random() * node.states.length)];
    }
  }

  const counts: Record<string, number> = {};
  for (const state of queryNode.states) {
    counts[state] = 0;
  }

  for (let i = 0; i < numSamples + burnIn; i++) {
    // Resample each non-evidence variable
    for (const varName of nonEvidenceVars) {
      const node = network.nodes.get(varName);
      if (!node) continue;

      // Compute P(X | Markov blanket)
      const probs: number[] = [];

      for (const state of node.states) {
        sample[varName] = state;

        // P(X | parents)
        const parentStates: Record<string, string> = {};
        for (const parent of node.parents) {
          parentStates[parent] = sample[parent];
        }
        let prob = getProbability(node, state, parentStates, network);

        // Multiply by P(children | X, other parents)
        for (const [childName, childNode] of network.nodes) {
          if (childNode.parents.includes(varName)) {
            const childParentStates: Record<string, string> = {};
            for (const p of childNode.parents) {
              childParentStates[p] = sample[p];
            }
            prob *= getProbability(childNode, sample[childName], childParentStates, network);
          }
        }

        probs.push(prob);
      }

      // Normalize and sample
      const total = probs.reduce((a, b) => a + b, 0);
      const rand = Math.random() * total;
      let cumProb = 0;

      for (let j = 0; j < node.states.length; j++) {
        cumProb += probs[j];
        if (rand <= cumProb) {
          sample[varName] = node.states[j];
          break;
        }
      }
    }

    // Collect sample after burn-in
    if (i >= burnIn) {
      counts[sample[queryVar]]++;
    }
  }

  // Normalize
  const distribution: Record<string, number> = {};
  for (const [state, count] of Object.entries(counts)) {
    distribution[state] = count / numSamples;
  }

  return distribution;
}

// ============================================================================
// STRUCTURE LEARNING
// ============================================================================

function computeMutualInformation(
  data: Array<Record<string, string>>,
  var1: string,
  var2: string
): number {
  const joint: Record<string, Record<string, number>> = {};
  const margin1: Record<string, number> = {};
  const margin2: Record<string, number> = {};
  const n = data.length;

  // Count occurrences
  for (const row of data) {
    const v1 = row[var1];
    const v2 = row[var2];

    if (!joint[v1]) joint[v1] = {};
    joint[v1][v2] = (joint[v1][v2] || 0) + 1;
    margin1[v1] = (margin1[v1] || 0) + 1;
    margin2[v2] = (margin2[v2] || 0) + 1;
  }

  // Compute MI
  let mi = 0;
  for (const [v1, innerMap] of Object.entries(joint)) {
    for (const [v2, count] of Object.entries(innerMap)) {
      const pxy = count / n;
      const px = margin1[v1] / n;
      const py = margin2[v2] / n;
      if (pxy > 0 && px > 0 && py > 0) {
        mi += pxy * Math.log2(pxy / (px * py));
      }
    }
  }

  return mi;
}

function learnChowLiuTree(
  data: Array<Record<string, string>>,
  variables: string[]
): Array<[string, string]> {
  // Compute pairwise mutual information
  const edges: Array<{ from: string; to: string; weight: number }> = [];

  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const mi = computeMutualInformation(data, variables[i], variables[j]);
      edges.push({ from: variables[i], to: variables[j], weight: mi });
    }
  }

  // Sort by weight (descending)
  edges.sort((a, b) => b.weight - a.weight);

  // Build MST using Kruskal's algorithm
  const parent: Record<string, string> = {};
  const rank: Record<string, number> = {};

  function find(x: string): string {
    if (!parent[x]) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: string, y: string): boolean {
    const px = find(x);
    const py = find(y);
    if (px === py) return false;

    if (!rank[px]) rank[px] = 0;
    if (!rank[py]) rank[py] = 0;

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

  const treeEdges: Array<[string, string]> = [];
  for (const edge of edges) {
    if (union(edge.from, edge.to)) {
      treeEdges.push([edge.from, edge.to]);
      if (treeEdges.length === variables.length - 1) break;
    }
  }

  return treeEdges;
}

// ============================================================================
// PARAMETER LEARNING
// ============================================================================

function learnCPT(
  data: Array<Record<string, string>>,
  node: Node,
  laplacePrior: number = 1
): number[][] {
  const numStates = node.states.length;
  const numParentConfigs = node.parents.length === 0 ? 1 :
    node.parents.reduce((acc, p) => acc * 2, 1); // Assuming binary

  // Initialize counts with Laplace smoothing
  const counts: number[][] = [];
  for (let i = 0; i < numStates; i++) {
    counts.push(new Array(numParentConfigs).fill(laplacePrior));
  }

  // Count occurrences
  for (const row of data) {
    const stateIdx = node.states.indexOf(row[node.name]);
    if (stateIdx < 0) continue;

    let parentConfig = 0;
    let multiplier = 1;
    for (let i = node.parents.length - 1; i >= 0; i--) {
      const parentVal = row[node.parents[i]] === 'true' ? 1 : 0;
      parentConfig += parentVal * multiplier;
      multiplier *= 2;
    }

    counts[stateIdx][parentConfig]++;
  }

  // Normalize to probabilities
  const cpt: number[][] = [];
  for (let i = 0; i < numStates; i++) {
    cpt.push([]);
    for (let j = 0; j < numParentConfigs; j++) {
      let total = 0;
      for (let k = 0; k < numStates; k++) {
        total += counts[k][j];
      }
      cpt[i].push(counts[i][j] / total);
    }
  }

  return cpt;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function computeEntropy(distribution: Record<string, number>): number {
  let entropy = 0;
  for (const prob of Object.values(distribution)) {
    if (prob > 0) {
      entropy -= prob * Math.log2(prob);
    }
  }
  return entropy;
}

function findMostLikely(distribution: Record<string, number>): { state: string; prob: number } {
  let maxProb = 0;
  let maxState = '';
  for (const [state, prob] of Object.entries(distribution)) {
    if (prob > maxProb) {
      maxProb = prob;
      maxState = state;
    }
  }
  return { state: maxState, prob: maxProb };
}

function analyzeNetworkStructure(network: BayesianNetwork): Record<string, unknown> {
  const nodes = Array.from(network.nodes.keys());
  const rootNodes = nodes.filter(n => network.nodes.get(n)!.parents.length === 0);
  const leafNodes = nodes.filter(n => {
    for (const [_nodeName, node] of network.nodes) {
      if (node.parents.includes(n)) return false;
    }
    return true;
  });

  // Compute Markov blankets
  const markovBlankets: Record<string, string[]> = {};
  for (const nodeName of nodes) {
    const node = network.nodes.get(nodeName)!;
    const blanket = new Set<string>(node.parents);

    // Add children and children's parents
    for (const [childName, childNode] of network.nodes) {
      if (childNode.parents.includes(nodeName)) {
        blanket.add(childName);
        for (const p of childNode.parents) {
          if (p !== nodeName) blanket.add(p);
        }
      }
    }

    markovBlankets[nodeName] = Array.from(blanket);
  }

  return {
    numNodes: nodes.length,
    numEdges: network.edges.length,
    rootNodes,
    leafNodes,
    averageDegree: (2 * network.edges.length) / nodes.length,
    markovBlankets,
    isTree: network.edges.length === nodes.length - 1
  };
}

function dSeparation(
  network: BayesianNetwork,
  x: string,
  y: string,
  z: string[]
): boolean {
  // Simplified d-separation test using reachability
  const zSet = new Set(z);

  // BFS to find if x can reach y without going through z
  const visited = new Set<string>();
  const queue: Array<{ node: string; direction: 'up' | 'down' }> = [
    { node: x, direction: 'up' },
    { node: x, direction: 'down' }
  ];

  while (queue.length > 0) {
    const { node, direction } = queue.shift()!;
    const key = `${node}:${direction}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (node === y) return false; // Path found, not d-separated

    const nodeData = network.nodes.get(node);
    if (!nodeData) continue;

    if (direction === 'up') {
      // Going up to parents
      if (!zSet.has(node)) {
        for (const parent of nodeData.parents) {
          queue.push({ node: parent, direction: 'up' });
        }
        // Can also go down to children
        for (const [childName, childNode] of network.nodes) {
          if (childNode.parents.includes(node)) {
            queue.push({ node: childName, direction: 'down' });
          }
        }
      }
    } else {
      // Going down to children
      if (!zSet.has(node)) {
        for (const [childName, childNode] of network.nodes) {
          if (childNode.parents.includes(node)) {
            queue.push({ node: childName, direction: 'down' });
          }
        }
      }
      // At v-structure - can go up only if node or descendant is in Z
      // Simplified: always allow going up through v-structures
      for (const parent of nodeData.parents) {
        queue.push({ node: parent, direction: 'up' });
      }
    }
  }

  return true; // No path found, d-separated
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export const bayesiannetworkTool: UnifiedTool = {
  name: 'bayesian_network',
  description: `Bayesian Network probabilistic inference and learning. Operations:
- create: Build network from nodes/edges or use examples (alarm, sprinkler, medical)
- query: Compute P(query | evidence) using variable elimination
- sample: Approximate inference via likelihood weighting or Gibbs sampling
- analyze: Network structure analysis (roots, leaves, Markov blankets)
- d_separation: Test conditional independence X ⊥ Y | Z
- learn_structure: Learn tree structure from data (Chow-Liu algorithm)
- learn_parameters: Learn CPTs from data with Laplace smoothing
- info: Documentation and examples`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'query', 'sample', 'analyze', 'd_separation', 'learn_structure', 'learn_parameters', 'info', 'examples'],
        description: 'Operation to perform'
      },
      network: {
        type: 'string',
        enum: ['alarm', 'sprinkler', 'medical'],
        description: 'Predefined network name'
      },
      nodes: {
        type: 'array',
        description: 'Custom node definitions'
      },
      query: {
        type: 'string',
        description: 'Query variable name'
      },
      evidence: {
        type: 'object',
        description: 'Evidence as {variable: state}'
      },
      method: {
        type: 'string',
        enum: ['exact', 'likelihood_weighting', 'gibbs'],
        description: 'Inference method'
      },
      numSamples: {
        type: 'number',
        description: 'Number of samples for approximate inference'
      },
      x: { type: 'string', description: 'First variable for d-separation' },
      y: { type: 'string', description: 'Second variable for d-separation' },
      z: { type: 'array', items: { type: 'string' }, description: 'Conditioning set' },
      data: { type: 'array', description: 'Training data for learning' },
      variables: { type: 'array', items: { type: 'string' }, description: 'Variable names for learning' }
    },
    required: ['operation']
  }
};

export async function executebayesiannetwork(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    switch (args.operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Bayesian Network',
            description: 'Probabilistic graphical models for reasoning under uncertainty',
            capabilities: [
              'Exact inference via variable elimination',
              'Approximate inference via likelihood weighting and Gibbs sampling',
              'Structure learning (Chow-Liu tree)',
              'Parameter learning with Laplace smoothing',
              'd-separation tests for conditional independence',
              'Network structure analysis'
            ],
            predefinedNetworks: Object.entries(EXAMPLE_NETWORKS).map(([name, net]) => ({
              name,
              description: net.description,
              nodes: net.nodes.map(n => n.name)
            })),
            inferenceComplexity: {
              exact: 'O(n * d^w) where w is treewidth',
              approximate: 'O(samples * nodes)'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                description: 'Query probability of burglary given John and Mary both called',
                call: {
                  operation: 'query',
                  network: 'alarm',
                  query: 'Burglary',
                  evidence: { JohnCalls: 'true', MaryCalls: 'true' }
                }
              },
              {
                description: 'Approximate inference using Gibbs sampling',
                call: {
                  operation: 'sample',
                  network: 'sprinkler',
                  query: 'Rain',
                  evidence: { WetGrass: 'true' },
                  method: 'gibbs',
                  numSamples: 5000
                }
              },
              {
                description: 'Test d-separation',
                call: {
                  operation: 'd_separation',
                  network: 'alarm',
                  x: 'Burglary',
                  y: 'Earthquake',
                  z: []
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'create': {
        const networkName = args.network || 'alarm';
        const networkDef = EXAMPLE_NETWORKS[networkName];
        if (!networkDef) {
          throw new Error(`Unknown network: ${networkName}. Available: ${Object.keys(EXAMPLE_NETWORKS).join(', ')}`);
        }

        const network = createNetwork(networkDef.nodes);
        const structure = analyzeNetworkStructure(network);

        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkName,
            description: networkDef.description,
            nodes: networkDef.nodes.map(n => ({
              name: n.name,
              states: n.states,
              parents: n.parents
            })),
            structure
          }, null, 2)
        };
      }

      case 'query': {
        const networkName = args.network || 'alarm';
        const networkDef = EXAMPLE_NETWORKS[networkName];
        if (!networkDef) throw new Error(`Unknown network: ${networkName}`);

        const network = createNetwork(networkDef.nodes);
        const queryVar = args.query;
        const evidence = args.evidence || {};

        if (!network.nodes.has(queryVar)) {
          throw new Error(`Unknown variable: ${queryVar}`);
        }

        const distribution = variableElimination(network, queryVar, evidence);
        const entropy = computeEntropy(distribution);
        const { state: mostLikely, prob: confidence } = findMostLikely(distribution);

        const result: QueryResult = {
          variable: queryVar,
          distribution,
          entropy,
          mostLikely,
          confidence
        };

        return {
          toolCallId: id,
          content: JSON.stringify({
            query: `P(${queryVar} | ${Object.entries(evidence).map(([k, v]) => `${k}=${v}`).join(', ') || 'no evidence'})`,
            method: 'variable_elimination',
            result,
            interpretation: `Most likely: ${mostLikely} with probability ${(confidence * 100).toFixed(2)}%`
          }, null, 2)
        };
      }

      case 'sample': {
        const networkName = args.network || 'alarm';
        const networkDef = EXAMPLE_NETWORKS[networkName];
        if (!networkDef) throw new Error(`Unknown network: ${networkName}`);

        const network = createNetwork(networkDef.nodes);
        const queryVar = args.query;
        const evidence = args.evidence || {};
        const method = args.method || 'likelihood_weighting';
        const numSamples = args.numSamples || 1000;

        if (!network.nodes.has(queryVar)) {
          throw new Error(`Unknown variable: ${queryVar}`);
        }

        let distribution: Record<string, number>;
        if (method === 'gibbs') {
          distribution = gibbsSampling(network, queryVar, evidence, numSamples);
        } else {
          distribution = likelihoodWeighting(network, queryVar, evidence, numSamples);
        }

        const entropy = computeEntropy(distribution);
        const { state: mostLikely, prob: confidence } = findMostLikely(distribution);

        return {
          toolCallId: id,
          content: JSON.stringify({
            query: `P(${queryVar} | ${Object.entries(evidence).map(([k, v]) => `${k}=${v}`).join(', ') || 'no evidence'})`,
            method,
            numSamples,
            result: {
              variable: queryVar,
              distribution,
              entropy,
              mostLikely,
              confidence
            },
            note: 'Approximate inference - results may vary between runs'
          }, null, 2)
        };
      }

      case 'analyze': {
        const networkName = args.network || 'alarm';
        const networkDef = EXAMPLE_NETWORKS[networkName];
        if (!networkDef) throw new Error(`Unknown network: ${networkName}`);

        const network = createNetwork(networkDef.nodes);
        const structure = analyzeNetworkStructure(network);

        return {
          toolCallId: id,
          content: JSON.stringify({
            network: networkName,
            structure,
            topologicalOrder: getTopologicalOrder(network)
          }, null, 2)
        };
      }

      case 'd_separation': {
        const networkName = args.network || 'alarm';
        const networkDef = EXAMPLE_NETWORKS[networkName];
        if (!networkDef) throw new Error(`Unknown network: ${networkName}`);

        const network = createNetwork(networkDef.nodes);
        const x = args.x;
        const y = args.y;
        const z = args.z || [];

        if (!network.nodes.has(x) || !network.nodes.has(y)) {
          throw new Error('Variables x and y must exist in the network');
        }

        const separated = dSeparation(network, x, y, z);

        return {
          toolCallId: id,
          content: JSON.stringify({
            test: `${x} ⊥ ${y} | {${z.join(', ')}}`,
            dSeparated: separated,
            interpretation: separated
              ? `${x} and ${y} are conditionally independent given {${z.join(', ')}}`
              : `${x} and ${y} are NOT conditionally independent given {${z.join(', ')}}`
          }, null, 2)
        };
      }

      case 'learn_structure': {
        const data = args.data;
        const variables = args.variables;

        if (!data || !Array.isArray(data) || data.length === 0) {
          // Generate sample data
          const sampleData = [
            { A: 'true', B: 'true', C: 'true' },
            { A: 'true', B: 'true', C: 'false' },
            { A: 'true', B: 'false', C: 'true' },
            { A: 'false', B: 'true', C: 'true' },
            { A: 'false', B: 'false', C: 'false' }
          ];
          const sampleVars = ['A', 'B', 'C'];
          const edges = learnChowLiuTree(sampleData, sampleVars);

          return {
            toolCallId: id,
            content: JSON.stringify({
              note: 'Using sample data - provide your own data for real learning',
              variables: sampleVars,
              learnedEdges: edges,
              algorithm: 'Chow-Liu tree (maximum spanning tree of mutual information)'
            }, null, 2)
          };
        }

        const edges = learnChowLiuTree(data, variables);

        return {
          toolCallId: id,
          content: JSON.stringify({
            variables,
            numDataPoints: data.length,
            learnedEdges: edges,
            algorithm: 'Chow-Liu tree'
          }, null, 2)
        };
      }

      case 'learn_parameters': {
        const networkName = args.network || 'alarm';
        const networkDef = EXAMPLE_NETWORKS[networkName];
        if (!networkDef) throw new Error(`Unknown network: ${networkName}`);

        const data = args.data;

        if (!data || !Array.isArray(data) || data.length === 0) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              note: 'Provide training data to learn parameters',
              expectedFormat: 'Array of objects with variable assignments',
              example: [
                { Burglary: 'true', Earthquake: 'false', Alarm: 'true', JohnCalls: 'true', MaryCalls: 'false' }
              ],
              currentCPTs: networkDef.nodes.map(n => ({
                node: n.name,
                parents: n.parents,
                cpt: n.cpt
              }))
            }, null, 2)
          };
        }

        const learnedCPTs = networkDef.nodes.map(node => ({
          node: node.name,
          parents: node.parents,
          cpt: learnCPT(data, node)
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            numDataPoints: data.length,
            algorithm: 'Maximum likelihood with Laplace smoothing',
            learnedCPTs
          }, null, 2)
        };
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}. Use 'info' for available operations.`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isbayesiannetworkAvailable(): boolean {
  return true;
}
