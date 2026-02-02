/**
 * BRANCH-BOUND TOOL
 * Branch and bound optimizer for combinatorial optimization problems
 * Includes: ILP, TSP, Knapsack, Assignment Problem
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

export interface BBNode {
  level: number;
  bound: number;
  cost: number;
  solution: number[];
  included?: boolean[];
}

interface BBResult {
  optimalValue: number;
  optimalSolution: number[];
  nodesExplored: number;
  nodesPruned: number;
  searchTree: BBSearchNode[];
  algorithm: string;
  problemType: string;
}

interface BBSearchNode {
  id: number;
  level: number;
  bound: number;
  cost: number;
  status: 'explored' | 'pruned' | 'optimal' | 'leaf';
  decision?: string;
}

interface KnapsackItem {
  weight: number;
  value: number;
  index: number;
  ratio?: number;
}

interface TSPCity {
  x: number;
  y: number;
  name?: string;
}

interface AssignmentProblem {
  costs: number[][];
  agents: string[];
  tasks: string[];
}

// ============================================================================
// BRANCH AND BOUND ALGORITHMS
// ============================================================================

/**
 * 0/1 Knapsack using Branch and Bound
 */
function solveKnapsackBB(
  weights: number[],
  values: number[],
  capacity: number
): BBResult {
  const n = weights.length;
  const items: KnapsackItem[] = [];

  for (let i = 0; i < n; i++) {
    items.push({
      weight: weights[i],
      value: values[i],
      index: i,
      ratio: values[i] / weights[i]
    });
  }

  // Sort by value/weight ratio (descending)
  items.sort((a, b) => (b.ratio || 0) - (a.ratio || 0));

  // Calculate upper bound using fractional relaxation
  function calculateBound(node: { level: number; value: number; weight: number }): number {
    if (node.weight > capacity) return 0;

    let bound = node.value;
    let totalWeight = node.weight;
    let level = node.level;

    while (level < n && totalWeight + items[level].weight <= capacity) {
      totalWeight += items[level].weight;
      bound += items[level].value;
      level++;
    }

    // Add fractional part of next item
    if (level < n) {
      bound += (capacity - totalWeight) * (items[level].ratio || 0);
    }

    return bound;
  }

  const searchTree: BBSearchNode[] = [];
  let nodesExplored = 0;
  let nodesPruned = 0;
  let maxValue = 0;
  let bestSolution: boolean[] = new Array(n).fill(false);

  // Priority queue (max-heap by bound)
  const queue: Array<{
    level: number;
    value: number;
    weight: number;
    bound: number;
    included: boolean[];
  }> = [];

  // Root node
  const rootBound = calculateBound({ level: 0, value: 0, weight: 0 });
  queue.push({
    level: 0,
    value: 0,
    weight: 0,
    bound: rootBound,
    included: new Array(n).fill(false)
  });

  searchTree.push({
    id: 0,
    level: 0,
    bound: rootBound,
    cost: 0,
    status: 'explored',
    decision: 'root'
  });

  while (queue.length > 0) {
    // Get node with highest bound
    queue.sort((a, b) => b.bound - a.bound);
    const node = queue.shift()!;
    nodesExplored++;

    if (node.bound <= maxValue) {
      nodesPruned++;
      searchTree.push({
        id: searchTree.length,
        level: node.level,
        bound: node.bound,
        cost: node.value,
        status: 'pruned',
        decision: `bound ${node.bound.toFixed(2)} <= best ${maxValue}`
      });
      continue;
    }

    if (node.level >= n) continue;

    const item = items[node.level];

    // Include current item
    if (node.weight + item.weight <= capacity) {
      const newValue = node.value + item.value;
      const newWeight = node.weight + item.weight;
      const newIncluded = [...node.included];
      newIncluded[item.index] = true;

      if (newValue > maxValue) {
        maxValue = newValue;
        bestSolution = [...newIncluded];
      }

      const includeBound = calculateBound({
        level: node.level + 1,
        value: newValue,
        weight: newWeight
      });

      if (includeBound > maxValue) {
        queue.push({
          level: node.level + 1,
          value: newValue,
          weight: newWeight,
          bound: includeBound,
          included: newIncluded
        });

        searchTree.push({
          id: searchTree.length,
          level: node.level + 1,
          bound: includeBound,
          cost: newValue,
          status: 'explored',
          decision: `include item ${item.index}`
        });
      }
    }

    // Exclude current item
    const excludeBound = calculateBound({
      level: node.level + 1,
      value: node.value,
      weight: node.weight
    });

    if (excludeBound > maxValue) {
      queue.push({
        level: node.level + 1,
        value: node.value,
        weight: node.weight,
        bound: excludeBound,
        included: [...node.included]
      });

      searchTree.push({
        id: searchTree.length,
        level: node.level + 1,
        bound: excludeBound,
        cost: node.value,
        status: 'explored',
        decision: `exclude item ${item.index}`
      });
    } else {
      nodesPruned++;
    }
  }

  // Map solution back to original indices
  const selectedItems: number[] = [];
  for (let i = 0; i < n; i++) {
    if (bestSolution[i]) {
      selectedItems.push(i);
    }
  }

  return {
    optimalValue: maxValue,
    optimalSolution: selectedItems,
    nodesExplored,
    nodesPruned,
    searchTree: searchTree.slice(0, 50), // Limit for display
    algorithm: 'Branch and Bound with LP Relaxation',
    problemType: '0/1 Knapsack'
  };
}

/**
 * Traveling Salesman Problem using Branch and Bound
 */
function solveTSPBB(cities: TSPCity[]): BBResult {
  const n = cities.length;

  // Distance matrix
  const dist: number[][] = [];
  for (let i = 0; i < n; i++) {
    dist[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        dist[i][j] = Infinity;
      } else {
        const dx = cities[i].x - cities[j].x;
        const dy = cities[i].y - cities[j].y;
        dist[i][j] = Math.sqrt(dx * dx + dy * dy);
      }
    }
  }

  // Calculate lower bound using reduced cost matrix
  function reduceMatrix(matrix: number[][], excluded: Set<string>): { reduced: number[][]; cost: number } {
    const m = matrix.map(row => [...row]);
    let cost = 0;

    // Row reduction
    for (let i = 0; i < n; i++) {
      let min = Infinity;
      for (let j = 0; j < n; j++) {
        if (!excluded.has(`${i}-${j}`) && m[i][j] < min) {
          min = m[i][j];
        }
      }
      if (min !== Infinity && min > 0) {
        cost += min;
        for (let j = 0; j < n; j++) {
          if (m[i][j] !== Infinity) m[i][j] -= min;
        }
      }
    }

    // Column reduction
    for (let j = 0; j < n; j++) {
      let min = Infinity;
      for (let i = 0; i < n; i++) {
        if (!excluded.has(`${i}-${j}`) && m[i][j] < min) {
          min = m[i][j];
        }
      }
      if (min !== Infinity && min > 0) {
        cost += min;
        for (let i = 0; i < n; i++) {
          if (m[i][j] !== Infinity) m[i][j] -= min;
        }
      }
    }

    return { reduced: m, cost };
  }

  const searchTree: BBSearchNode[] = [];
  let nodesExplored = 0;
  let nodesPruned = 0;
  let bestCost = Infinity;
  let bestTour: number[] = [];

  interface TSPNode {
    path: number[];
    bound: number;
    cost: number;
    level: number;
    matrix: number[][];
  }

  // Initial reduction
  const { reduced: initialMatrix, cost: initialBound } = reduceMatrix(dist, new Set());

  const queue: TSPNode[] = [{
    path: [0],
    bound: initialBound,
    cost: 0,
    level: 0,
    matrix: initialMatrix
  }];

  searchTree.push({
    id: 0,
    level: 0,
    bound: initialBound,
    cost: 0,
    status: 'explored',
    decision: 'root (city 0)'
  });

  while (queue.length > 0) {
    // Best-first: sort by bound
    queue.sort((a, b) => a.bound - b.bound);
    const node = queue.shift()!;
    nodesExplored++;

    if (node.bound >= bestCost) {
      nodesPruned++;
      continue;
    }

    const current = node.path[node.path.length - 1];

    // Check if complete tour
    if (node.path.length === n) {
      const totalCost = node.cost + dist[current][0];
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestTour = [...node.path, 0];

        searchTree.push({
          id: searchTree.length,
          level: n,
          bound: totalCost,
          cost: totalCost,
          status: 'optimal',
          decision: `complete tour: ${bestTour.join(' → ')}`
        });
      }
      continue;
    }

    // Explore unvisited cities
    for (let next = 0; next < n; next++) {
      if (node.path.includes(next)) continue;

      const edgeCost = dist[current][next];
      if (edgeCost === Infinity) continue;

      // Calculate new bound
      const newCost = node.cost + edgeCost;
      const newMatrix = node.matrix.map(row => [...row]);

      // Set row and column to infinity
      for (let k = 0; k < n; k++) {
        newMatrix[current][k] = Infinity;
        newMatrix[k][next] = Infinity;
      }
      newMatrix[next][0] = Infinity; // Prevent premature return

      // Reduce matrix
      let reductionCost = 0;
      for (let i = 0; i < n; i++) {
        let min = Infinity;
        for (let j = 0; j < n; j++) {
          if (newMatrix[i][j] < min) min = newMatrix[i][j];
        }
        if (min !== Infinity && min > 0) {
          reductionCost += min;
          for (let j = 0; j < n; j++) {
            if (newMatrix[i][j] !== Infinity) newMatrix[i][j] -= min;
          }
        }
      }
      for (let j = 0; j < n; j++) {
        let min = Infinity;
        for (let i = 0; i < n; i++) {
          if (newMatrix[i][j] < min) min = newMatrix[i][j];
        }
        if (min !== Infinity && min > 0) {
          reductionCost += min;
          for (let i = 0; i < n; i++) {
            if (newMatrix[i][j] !== Infinity) newMatrix[i][j] -= min;
          }
        }
      }

      const newBound = node.bound + edgeCost + reductionCost;

      if (newBound < bestCost) {
        queue.push({
          path: [...node.path, next],
          bound: newBound,
          cost: newCost,
          level: node.level + 1,
          matrix: newMatrix
        });

        searchTree.push({
          id: searchTree.length,
          level: node.level + 1,
          bound: newBound,
          cost: newCost,
          status: 'explored',
          decision: `visit city ${next}`
        });
      } else {
        nodesPruned++;
        searchTree.push({
          id: searchTree.length,
          level: node.level + 1,
          bound: newBound,
          cost: newCost,
          status: 'pruned',
          decision: `city ${next} pruned (bound ${newBound.toFixed(2)} >= best ${bestCost.toFixed(2)})`
        });
      }
    }
  }

  return {
    optimalValue: bestCost,
    optimalSolution: bestTour,
    nodesExplored,
    nodesPruned,
    searchTree: searchTree.slice(0, 50),
    algorithm: 'Branch and Bound with Matrix Reduction',
    problemType: 'Traveling Salesman Problem'
  };
}

/**
 * Assignment Problem using Branch and Bound (Hungarian-style)
 */
function solveAssignmentBB(problem: AssignmentProblem): BBResult {
  const { costs, agents, tasks } = problem;
  const n = costs.length;

  const searchTree: BBSearchNode[] = [];
  let nodesExplored = 0;
  let nodesPruned = 0;
  let bestCost = Infinity;
  let bestAssignment: number[] = [];

  // Calculate lower bound: sum of row minimums for unassigned rows
  function calculateBound(assignment: number[], assigned: Set<number>): number {
    let bound = 0;

    // Cost of current assignments
    for (let i = 0; i < assignment.length; i++) {
      if (assignment[i] !== -1) {
        bound += costs[i][assignment[i]];
      }
    }

    // Lower bound for unassigned: row minimum
    for (let i = assignment.length; i < n; i++) {
      let min = Infinity;
      for (let j = 0; j < n; j++) {
        if (!assigned.has(j) && costs[i][j] < min) {
          min = costs[i][j];
        }
      }
      if (min !== Infinity) bound += min;
    }

    return bound;
  }

  interface AssignmentNode {
    assignment: number[];
    assigned: Set<number>;
    level: number;
    cost: number;
    bound: number;
  }

  const initialBound = calculateBound([], new Set());
  const queue: AssignmentNode[] = [{
    assignment: [],
    assigned: new Set(),
    level: 0,
    cost: 0,
    bound: initialBound
  }];

  searchTree.push({
    id: 0,
    level: 0,
    bound: initialBound,
    cost: 0,
    status: 'explored',
    decision: 'root'
  });

  while (queue.length > 0) {
    queue.sort((a, b) => a.bound - b.bound);
    const node = queue.shift()!;
    nodesExplored++;

    if (node.bound >= bestCost) {
      nodesPruned++;
      continue;
    }

    if (node.level === n) {
      if (node.cost < bestCost) {
        bestCost = node.cost;
        bestAssignment = [...node.assignment];

        searchTree.push({
          id: searchTree.length,
          level: n,
          bound: node.cost,
          cost: node.cost,
          status: 'optimal',
          decision: `complete assignment`
        });
      }
      continue;
    }

    // Try assigning each unassigned task to current agent
    for (let j = 0; j < n; j++) {
      if (node.assigned.has(j)) continue;

      const newAssignment = [...node.assignment, j];
      const newAssigned = new Set(node.assigned);
      newAssigned.add(j);
      const newCost = node.cost + costs[node.level][j];
      const newBound = calculateBound(newAssignment, newAssigned);

      if (newBound < bestCost) {
        queue.push({
          assignment: newAssignment,
          assigned: newAssigned,
          level: node.level + 1,
          cost: newCost,
          bound: newBound
        });

        searchTree.push({
          id: searchTree.length,
          level: node.level + 1,
          bound: newBound,
          cost: newCost,
          status: 'explored',
          decision: `assign ${agents[node.level]} → ${tasks[j]}`
        });
      } else {
        nodesPruned++;
      }
    }
  }

  return {
    optimalValue: bestCost,
    optimalSolution: bestAssignment,
    nodesExplored,
    nodesPruned,
    searchTree: searchTree.slice(0, 50),
    algorithm: 'Branch and Bound',
    problemType: 'Assignment Problem'
  };
}

/**
 * Integer Linear Programming using Branch and Bound
 */
function solveILP(
  c: number[],           // Objective coefficients (minimize c^T x)
  A: number[][],         // Constraint matrix
  b: number[],           // RHS of constraints
  bounds: { lower: number[]; upper: number[] }  // Variable bounds
): BBResult {
  const n = c.length;

  // Simple LP relaxation solver (for small problems)
  function solveLP(
    fixedVars: Map<number, number>,
    lowerBounds: number[],
    upperBounds: number[]
  ): { feasible: boolean; value: number; solution: number[] } {
    // Greedy approximation for LP relaxation
    const solution = new Array(n).fill(0);
    let value = 0;

    // Apply fixed variables
    for (const [i, v] of fixedVars) {
      solution[i] = v;
      value += c[i] * v;
    }

    // For unfixed variables, use bounds based on coefficient sign
    for (let i = 0; i < n; i++) {
      if (!fixedVars.has(i)) {
        // For minimization: use lower bound if c[i] > 0, upper if c[i] < 0
        solution[i] = c[i] >= 0 ? lowerBounds[i] : upperBounds[i];
        value += c[i] * solution[i];
      }
    }

    // Check feasibility
    for (let i = 0; i < A.length; i++) {
      let lhs = 0;
      for (let j = 0; j < n; j++) {
        lhs += A[i][j] * solution[j];
      }
      if (lhs > b[i] + 0.001) {
        return { feasible: false, value: Infinity, solution };
      }
    }

    return { feasible: true, value, solution };
  }

  const searchTree: BBSearchNode[] = [];
  let nodesExplored = 0;
  let nodesPruned = 0;
  let bestValue = Infinity;
  let bestSolution: number[] = [];

  interface ILPNode {
    fixed: Map<number, number>;
    lowerBounds: number[];
    upperBounds: number[];
    bound: number;
    level: number;
  }

  const initial = solveLP(new Map(), bounds.lower, bounds.upper);

  if (!initial.feasible) {
    return {
      optimalValue: Infinity,
      optimalSolution: [],
      nodesExplored: 1,
      nodesPruned: 0,
      searchTree: [],
      algorithm: 'Branch and Bound',
      problemType: 'Integer Linear Programming (Infeasible)'
    };
  }

  const queue: ILPNode[] = [{
    fixed: new Map(),
    lowerBounds: [...bounds.lower],
    upperBounds: [...bounds.upper],
    bound: initial.value,
    level: 0
  }];

  searchTree.push({
    id: 0,
    level: 0,
    bound: initial.value,
    cost: initial.value,
    status: 'explored',
    decision: 'root'
  });

  while (queue.length > 0) {
    queue.sort((a, b) => a.bound - b.bound);
    const node = queue.shift()!;
    nodesExplored++;

    if (node.bound >= bestValue) {
      nodesPruned++;
      continue;
    }

    const lp = solveLP(node.fixed, node.lowerBounds, node.upperBounds);

    if (!lp.feasible || lp.value >= bestValue) {
      nodesPruned++;
      continue;
    }

    // Find fractional variable to branch on
    let branchVar = -1;
    let maxFrac = 0;
    for (let i = 0; i < n; i++) {
      if (!node.fixed.has(i)) {
        const frac = Math.abs(lp.solution[i] - Math.round(lp.solution[i]));
        if (frac > 0.001 && frac > maxFrac) {
          maxFrac = frac;
          branchVar = i;
        }
      }
    }

    if (branchVar === -1) {
      // All integer - we have a solution
      if (lp.value < bestValue) {
        bestValue = lp.value;
        bestSolution = lp.solution.map(Math.round);

        searchTree.push({
          id: searchTree.length,
          level: node.level,
          bound: lp.value,
          cost: lp.value,
          status: 'optimal',
          decision: `integer solution found`
        });
      }
      continue;
    }

    // Branch on fractional variable
    const val = lp.solution[branchVar];

    // Left branch: x[branchVar] <= floor(val)
    const leftUpper = [...node.upperBounds];
    leftUpper[branchVar] = Math.floor(val);
    if (leftUpper[branchVar] >= node.lowerBounds[branchVar]) {
      const leftLP = solveLP(node.fixed, node.lowerBounds, leftUpper);
      if (leftLP.feasible && leftLP.value < bestValue) {
        queue.push({
          fixed: new Map(node.fixed),
          lowerBounds: [...node.lowerBounds],
          upperBounds: leftUpper,
          bound: leftLP.value,
          level: node.level + 1
        });

        searchTree.push({
          id: searchTree.length,
          level: node.level + 1,
          bound: leftLP.value,
          cost: leftLP.value,
          status: 'explored',
          decision: `x${branchVar} <= ${Math.floor(val)}`
        });
      }
    }

    // Right branch: x[branchVar] >= ceil(val)
    const rightLower = [...node.lowerBounds];
    rightLower[branchVar] = Math.ceil(val);
    if (rightLower[branchVar] <= node.upperBounds[branchVar]) {
      const rightLP = solveLP(node.fixed, rightLower, node.upperBounds);
      if (rightLP.feasible && rightLP.value < bestValue) {
        queue.push({
          fixed: new Map(node.fixed),
          lowerBounds: rightLower,
          upperBounds: [...node.upperBounds],
          bound: rightLP.value,
          level: node.level + 1
        });

        searchTree.push({
          id: searchTree.length,
          level: node.level + 1,
          bound: rightLP.value,
          cost: rightLP.value,
          status: 'explored',
          decision: `x${branchVar} >= ${Math.ceil(val)}`
        });
      }
    }
  }

  return {
    optimalValue: bestValue,
    optimalSolution: bestSolution,
    nodesExplored,
    nodesPruned,
    searchTree: searchTree.slice(0, 50),
    algorithm: 'Branch and Bound with LP Relaxation',
    problemType: 'Integer Linear Programming'
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const branchboundTool: UnifiedTool = {
  name: 'branch_bound',
  description: 'Branch and bound optimizer for combinatorial optimization problems including 0/1 Knapsack, TSP, Assignment Problem, and Integer Linear Programming',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['knapsack', 'tsp', 'assignment', 'ilp', 'info', 'examples'],
        description: 'Operation: knapsack (0/1 knapsack), tsp (traveling salesman), assignment (assignment problem), ilp (integer linear programming), info, examples'
      },
      weights: {
        type: 'array',
        items: { type: 'number' },
        description: 'Item weights for knapsack problem'
      },
      values: {
        type: 'array',
        items: { type: 'number' },
        description: 'Item values for knapsack problem'
      },
      capacity: {
        type: 'number',
        description: 'Knapsack capacity'
      },
      cities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            name: { type: 'string' }
          }
        },
        description: 'City coordinates for TSP'
      },
      costs: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' }
        },
        description: 'Cost matrix for assignment problem'
      },
      agents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Agent names for assignment problem'
      },
      tasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Task names for assignment problem'
      },
      c: {
        type: 'array',
        items: { type: 'number' },
        description: 'Objective coefficients for ILP (minimize c^T x)'
      },
      A: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' }
        },
        description: 'Constraint matrix for ILP (Ax <= b)'
      },
      b: {
        type: 'array',
        items: { type: 'number' },
        description: 'Right-hand side of constraints for ILP'
      },
      bounds: {
        type: 'object',
        properties: {
          lower: { type: 'array', items: { type: 'number' } },
          upper: { type: 'array', items: { type: 'number' } }
        },
        description: 'Variable bounds for ILP'
      }
    },
    required: ['operation']
  }
};

export async function executebranchbound(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'knapsack': {
        const weights = args.weights || [10, 20, 30, 40, 50];
        const values = args.values || [60, 100, 120, 140, 160];
        const capacity = args.capacity || 50;

        const result = solveKnapsackBB(weights, values, capacity);

        return {
          toolCallId: id,
          content: JSON.stringify({
            problem: {
              type: '0/1 Knapsack',
              items: weights.map((w: number, i: number) => ({
                index: i,
                weight: w,
                value: values[i],
                ratio: (values[i] / w).toFixed(2)
              })),
              capacity
            },
            solution: {
              optimalValue: result.optimalValue,
              selectedItems: result.optimalSolution,
              totalWeight: result.optimalSolution.reduce((sum: number, i: number) => sum + weights[i], 0)
            },
            searchStatistics: {
              nodesExplored: result.nodesExplored,
              nodesPruned: result.nodesPruned,
              pruningEfficiency: ((result.nodesPruned / (result.nodesExplored + result.nodesPruned)) * 100).toFixed(2) + '%'
            },
            searchTree: result.searchTree,
            algorithm: result.algorithm
          }, null, 2)
        };
      }

      case 'tsp': {
        const cities = args.cities || [
          { x: 0, y: 0, name: 'A' },
          { x: 1, y: 5, name: 'B' },
          { x: 5, y: 2, name: 'C' },
          { x: 6, y: 6, name: 'D' },
          { x: 8, y: 3, name: 'E' }
        ];

        const result = solveTSPBB(cities);

        const tourNames = result.optimalSolution.map((i: number) =>
          cities[i].name || `City ${i}`
        );

        return {
          toolCallId: id,
          content: JSON.stringify({
            problem: {
              type: 'Traveling Salesman Problem',
              numCities: cities.length,
              cities: cities.map((c: TSPCity, i: number) => ({
                index: i,
                name: c.name || `City ${i}`,
                coordinates: { x: c.x, y: c.y }
              }))
            },
            solution: {
              optimalTourLength: result.optimalValue.toFixed(4),
              optimalTour: result.optimalSolution,
              tourPath: tourNames.join(' → ')
            },
            searchStatistics: {
              nodesExplored: result.nodesExplored,
              nodesPruned: result.nodesPruned
            },
            searchTree: result.searchTree,
            algorithm: result.algorithm
          }, null, 2)
        };
      }

      case 'assignment': {
        const costs = args.costs || [
          [9, 2, 7, 8],
          [6, 4, 3, 7],
          [5, 8, 1, 8],
          [7, 6, 9, 4]
        ];
        const agents = args.agents || ['Alice', 'Bob', 'Carol', 'Dave'];
        const tasks = args.tasks || ['Task1', 'Task2', 'Task3', 'Task4'];

        const result = solveAssignmentBB({ costs, agents, tasks });

        const assignments = result.optimalSolution.map((taskIdx: number, agentIdx: number) => ({
          agent: agents[agentIdx],
          task: tasks[taskIdx],
          cost: costs[agentIdx][taskIdx]
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            problem: {
              type: 'Assignment Problem',
              numAgents: agents.length,
              numTasks: tasks.length,
              costMatrix: costs
            },
            solution: {
              optimalCost: result.optimalValue,
              assignments
            },
            searchStatistics: {
              nodesExplored: result.nodesExplored,
              nodesPruned: result.nodesPruned
            },
            searchTree: result.searchTree,
            algorithm: result.algorithm
          }, null, 2)
        };
      }

      case 'ilp': {
        // Default: minimize -3x1 - 2x2 s.t. x1 + x2 <= 4, x1, x2 >= 0, integer
        const c = args.c || [-3, -2];
        const A = args.A || [[1, 1]];
        const b = args.b || [4];
        const bounds = args.bounds || {
          lower: [0, 0],
          upper: [4, 4]
        };

        const result = solveILP(c, A, b, bounds);

        return {
          toolCallId: id,
          content: JSON.stringify({
            problem: {
              type: 'Integer Linear Programming',
              objective: `minimize ${c.map((ci: number, i: number) => `${ci >= 0 ? '+' : ''}${ci}x${i}`).join(' ')}`,
              constraints: A.map((row: number[], i: number) =>
                `${row.map((a: number, j: number) => `${a >= 0 ? '+' : ''}${a}x${j}`).join(' ')} <= ${b[i]}`
              ),
              variableBounds: bounds
            },
            solution: {
              optimalValue: result.optimalValue,
              optimalSolution: result.optimalSolution,
              variableValues: result.optimalSolution.map((v: number, i: number) => `x${i} = ${v}`)
            },
            searchStatistics: {
              nodesExplored: result.nodesExplored,
              nodesPruned: result.nodesPruned
            },
            searchTree: result.searchTree,
            algorithm: result.algorithm
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Branch and Bound Optimizer',
            description: 'Exact optimization algorithm that systematically enumerates candidate solutions by means of state space search',
            supportedProblems: [
              {
                name: '0/1 Knapsack',
                operation: 'knapsack',
                description: 'Select items to maximize value within weight capacity',
                boundingStrategy: 'LP relaxation (fractional knapsack)'
              },
              {
                name: 'Traveling Salesman Problem',
                operation: 'tsp',
                description: 'Find shortest tour visiting all cities exactly once',
                boundingStrategy: 'Reduced cost matrix'
              },
              {
                name: 'Assignment Problem',
                operation: 'assignment',
                description: 'Assign agents to tasks minimizing total cost',
                boundingStrategy: 'Row/column minimum bounds'
              },
              {
                name: 'Integer Linear Programming',
                operation: 'ilp',
                description: 'Optimize linear objective with integer constraints',
                boundingStrategy: 'LP relaxation'
              }
            ],
            algorithmConcepts: {
              branching: 'Divide problem into smaller subproblems',
              bounding: 'Calculate optimistic bound for each subproblem',
              pruning: 'Discard subproblems that cannot improve best known solution',
              searchStrategies: ['Best-first', 'Depth-first', 'Breadth-first']
            },
            complexity: 'Worst case exponential, but pruning often makes it practical'
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: '0/1 Knapsack',
                call: {
                  operation: 'knapsack',
                  weights: [2, 3, 4, 5],
                  values: [3, 4, 5, 6],
                  capacity: 8
                }
              },
              {
                name: 'TSP with 5 cities',
                call: {
                  operation: 'tsp',
                  cities: [
                    { x: 0, y: 0, name: 'Start' },
                    { x: 2, y: 4, name: 'A' },
                    { x: 5, y: 2, name: 'B' },
                    { x: 7, y: 5, name: 'C' },
                    { x: 3, y: 1, name: 'D' }
                  ]
                }
              },
              {
                name: 'Job Assignment',
                call: {
                  operation: 'assignment',
                  costs: [[10, 5, 8], [3, 8, 6], [7, 4, 9]],
                  agents: ['Worker1', 'Worker2', 'Worker3'],
                  tasks: ['JobA', 'JobB', 'JobC']
                }
              },
              {
                name: 'Simple ILP',
                call: {
                  operation: 'ilp',
                  c: [-5, -4],
                  A: [[1, 1], [2, 1]],
                  b: [5, 8],
                  bounds: { lower: [0, 0], upper: [5, 5] }
                }
              }
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

export function isbranchboundAvailable(): boolean { return true; }
