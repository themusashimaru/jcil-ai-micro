/**
 * DYNAMIC PROGRAMMING TOOL
 *
 * Classic DP algorithms with step-by-step memoization visualization.
 * Includes optimal substructure analysis and complexity breakdown.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CLASSIC DP PROBLEMS
// ============================================================================

interface DPResult {
  problem: string;
  solution: unknown;
  optimalValue?: number;
  complexity: { time: string; space: string };
  dpTable?: unknown[][];
  reconstructedPath?: unknown;
  subproblems: number;
}

// Fibonacci with memoization
function fibonacci(n: number): DPResult {
  const dp: number[] = new Array(n + 1).fill(0);
  dp[0] = 0;
  if (n > 0) dp[1] = 1;

  for (let i = 2; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
  }

  return {
    problem: 'Fibonacci',
    solution: dp[n],
    complexity: { time: 'O(n)', space: 'O(n) or O(1) with space optimization' },
    dpTable: [dp.slice(0, Math.min(n + 1, 20))],
    subproblems: n + 1
  };
}

// 0/1 Knapsack
function knapsack(weights: number[], values: number[], capacity: number): DPResult {
  const n = weights.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(
          dp[i - 1][w],
          dp[i - 1][w - weights[i - 1]] + values[i - 1]
        );
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Reconstruct selected items
  const selected: number[] = [];
  let w = capacity;
  for (let i = n; i > 0 && w > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(i - 1);
      w -= weights[i - 1];
    }
  }
  selected.reverse();

  return {
    problem: '0/1 Knapsack',
    solution: {
      maxValue: dp[n][capacity],
      selectedItems: selected,
      selectedWeights: selected.map(i => weights[i]),
      selectedValues: selected.map(i => values[i]),
      totalWeight: selected.reduce((sum, i) => sum + weights[i], 0)
    },
    optimalValue: dp[n][capacity],
    complexity: { time: 'O(n * W)', space: 'O(n * W)' },
    dpTable: dp.slice(0, Math.min(n + 1, 10)).map(row => row.slice(0, Math.min(capacity + 1, 15))),
    reconstructedPath: selected,
    subproblems: (n + 1) * (capacity + 1)
  };
}

// Longest Common Subsequence
function lcs(s1: string, s2: string): DPResult {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct LCS
  let lcsStr = '';
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (s1[i - 1] === s2[j - 1]) {
      lcsStr = s1[i - 1] + lcsStr;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return {
    problem: 'Longest Common Subsequence',
    solution: {
      length: dp[m][n],
      lcs: lcsStr,
      string1: s1,
      string2: s2
    },
    optimalValue: dp[m][n],
    complexity: { time: 'O(m * n)', space: 'O(m * n)' },
    dpTable: dp.slice(0, Math.min(m + 1, 12)).map(row => row.slice(0, Math.min(n + 1, 12))),
    reconstructedPath: lcsStr,
    subproblems: (m + 1) * (n + 1)
  };
}

// Edit Distance (Levenshtein)
function editDistance(s1: string, s2: string): DPResult {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  // Base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // delete
          dp[i][j - 1],     // insert
          dp[i - 1][j - 1]  // replace
        );
      }
    }
  }

  // Reconstruct operations
  const operations: string[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) {
      operations.unshift(`keep '${s1[i - 1]}'`);
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      operations.unshift(`replace '${s1[i - 1]}' with '${s2[j - 1]}'`);
      i--;
      j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      operations.unshift(`insert '${s2[j - 1]}'`);
      j--;
    } else if (i > 0) {
      operations.unshift(`delete '${s1[i - 1]}'`);
      i--;
    }
  }

  return {
    problem: 'Edit Distance (Levenshtein)',
    solution: {
      distance: dp[m][n],
      from: s1,
      to: s2,
      operations: operations.filter(op => !op.startsWith('keep'))
    },
    optimalValue: dp[m][n],
    complexity: { time: 'O(m * n)', space: 'O(m * n)' },
    dpTable: dp.slice(0, Math.min(m + 1, 12)).map(row => row.slice(0, Math.min(n + 1, 12))),
    reconstructedPath: operations,
    subproblems: (m + 1) * (n + 1)
  };
}

// Coin Change (minimum coins)
function coinChange(coins: number[], amount: number): DPResult {
  const dp: number[] = new Array(amount + 1).fill(Infinity);
  const parent: number[] = new Array(amount + 1).fill(-1);
  dp[0] = 0;

  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i && dp[i - coin] + 1 < dp[i]) {
        dp[i] = dp[i - coin] + 1;
        parent[i] = coin;
      }
    }
  }

  // Reconstruct coin selection
  const usedCoins: number[] = [];
  let remaining = amount;
  while (remaining > 0 && parent[remaining] !== -1) {
    usedCoins.push(parent[remaining]);
    remaining -= parent[remaining];
  }

  const coinCounts: Record<number, number> = {};
  for (const c of usedCoins) {
    coinCounts[c] = (coinCounts[c] || 0) + 1;
  }

  return {
    problem: 'Coin Change (Minimum Coins)',
    solution: {
      minCoins: dp[amount] === Infinity ? -1 : dp[amount],
      coinsUsed: usedCoins,
      breakdown: coinCounts,
      amount
    },
    optimalValue: dp[amount] === Infinity ? -1 : dp[amount],
    complexity: { time: 'O(amount * coins)', space: 'O(amount)' },
    dpTable: [dp.slice(0, Math.min(amount + 1, 25))],
    reconstructedPath: usedCoins,
    subproblems: amount + 1
  };
}

// Longest Increasing Subsequence
function longestIncreasingSubsequence(arr: number[]): DPResult {
  const n = arr.length;
  if (n === 0) {
    return {
      problem: 'Longest Increasing Subsequence',
      solution: { length: 0, subsequence: [] },
      optimalValue: 0,
      complexity: { time: 'O(n^2)', space: 'O(n)' },
      subproblems: 0
    };
  }

  const dp: number[] = new Array(n).fill(1);
  const parent: number[] = new Array(n).fill(-1);

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[j] < arr[i] && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1;
        parent[i] = j;
      }
    }
  }

  // Find the index with maximum length
  let maxLen = 0;
  let maxIdx = 0;
  for (let i = 0; i < n; i++) {
    if (dp[i] > maxLen) {
      maxLen = dp[i];
      maxIdx = i;
    }
  }

  // Reconstruct LIS
  const lis: number[] = [];
  let idx = maxIdx;
  while (idx !== -1) {
    lis.unshift(arr[idx]);
    idx = parent[idx];
  }

  return {
    problem: 'Longest Increasing Subsequence',
    solution: {
      length: maxLen,
      subsequence: lis,
      originalArray: arr
    },
    optimalValue: maxLen,
    complexity: { time: 'O(n^2) naive, O(n log n) optimized', space: 'O(n)' },
    dpTable: [dp],
    reconstructedPath: lis,
    subproblems: n
  };
}

// Matrix Chain Multiplication
function matrixChainMultiplication(dimensions: number[]): DPResult {
  const n = dimensions.length - 1; // Number of matrices
  const dp: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const split: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // l is chain length
  for (let l = 2; l <= n; l++) {
    for (let i = 0; i < n - l + 1; i++) {
      const j = i + l - 1;
      dp[i][j] = Infinity;

      for (let k = i; k < j; k++) {
        const cost = dp[i][k] + dp[k + 1][j] + dimensions[i] * dimensions[k + 1] * dimensions[j + 1];
        if (cost < dp[i][j]) {
          dp[i][j] = cost;
          split[i][j] = k;
        }
      }
    }
  }

  // Reconstruct optimal parenthesization
  function parenthesize(i: number, j: number): string {
    if (i === j) return `M${i}`;
    const k = split[i][j];
    return `(${parenthesize(i, k)} * ${parenthesize(k + 1, j)})`;
  }

  return {
    problem: 'Matrix Chain Multiplication',
    solution: {
      minMultiplications: dp[0][n - 1],
      optimalParenthesization: parenthesize(0, n - 1),
      matrixDimensions: dimensions.slice(0, -1).map((d, i) => `M${i}: ${d}x${dimensions[i + 1]}`)
    },
    optimalValue: dp[0][n - 1],
    complexity: { time: 'O(n^3)', space: 'O(n^2)' },
    dpTable: dp,
    reconstructedPath: parenthesize(0, n - 1),
    subproblems: n * n
  };
}

// Rod Cutting
function rodCutting(prices: number[], length: number): DPResult {
  const dp: number[] = new Array(length + 1).fill(0);
  const cuts: number[] = new Array(length + 1).fill(0);

  for (let i = 1; i <= length; i++) {
    for (let j = 1; j <= Math.min(i, prices.length); j++) {
      if (dp[i - j] + prices[j - 1] > dp[i]) {
        dp[i] = dp[i - j] + prices[j - 1];
        cuts[i] = j;
      }
    }
  }

  // Reconstruct cuts
  const pieceLengths: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    pieceLengths.push(cuts[remaining]);
    remaining -= cuts[remaining];
  }

  return {
    problem: 'Rod Cutting',
    solution: {
      maxRevenue: dp[length],
      pieces: pieceLengths,
      rodLength: length
    },
    optimalValue: dp[length],
    complexity: { time: 'O(n^2)', space: 'O(n)' },
    dpTable: [dp],
    reconstructedPath: pieceLengths,
    subproblems: length + 1
  };
}

// Subset Sum
function subsetSum(nums: number[], target: number): DPResult {
  const n = nums.length;
  const dp: boolean[][] = Array.from({ length: n + 1 }, () => new Array(target + 1).fill(false));

  // Empty set can make sum 0
  for (let i = 0; i <= n; i++) dp[i][0] = true;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= target; j++) {
      if (nums[i - 1] <= j) {
        dp[i][j] = dp[i - 1][j] || dp[i - 1][j - nums[i - 1]];
      } else {
        dp[i][j] = dp[i - 1][j];
      }
    }
  }

  // Reconstruct subset if possible
  const subset: number[] = [];
  if (dp[n][target]) {
    let i = n, j = target;
    while (i > 0 && j > 0) {
      if (dp[i][j] !== dp[i - 1][j]) {
        subset.push(nums[i - 1]);
        j -= nums[i - 1];
      }
      i--;
    }
    subset.reverse();
  }

  return {
    problem: 'Subset Sum',
    solution: {
      isPossible: dp[n][target],
      subset: subset,
      target,
      numbers: nums
    },
    optimalValue: dp[n][target] ? 1 : 0,
    complexity: { time: 'O(n * target)', space: 'O(n * target)' },
    dpTable: dp.slice(0, Math.min(n + 1, 10)).map(row =>
      row.slice(0, Math.min(target + 1, 15)).map(v => v ? 1 : 0)
    ),
    reconstructedPath: subset,
    subproblems: (n + 1) * (target + 1)
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export const dynamicprogrammingTool: UnifiedTool = {
  name: 'dynamic_programming',
  description: `Dynamic Programming algorithm solver with step-by-step visualization. Operations:
- fibonacci: Nth Fibonacci number with O(n) DP
- knapsack: 0/1 Knapsack problem
- lcs: Longest Common Subsequence
- edit_distance: Levenshtein distance between strings
- coin_change: Minimum coins to make amount
- lis: Longest Increasing Subsequence
- matrix_chain: Optimal matrix multiplication order
- rod_cutting: Maximize rod cutting revenue
- subset_sum: Can subset sum to target?
- info: Documentation and theory`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['fibonacci', 'knapsack', 'lcs', 'edit_distance', 'coin_change', 'lis', 'matrix_chain', 'rod_cutting', 'subset_sum', 'info', 'examples'],
        description: 'Operation to perform'
      },
      n: { type: 'number', description: 'For fibonacci: compute F(n)' },
      weights: { type: 'array', items: { type: 'number' }, description: 'Item weights for knapsack' },
      values: { type: 'array', items: { type: 'number' }, description: 'Item values for knapsack' },
      capacity: { type: 'number', description: 'Knapsack capacity' },
      string1: { type: 'string', description: 'First string for LCS/edit distance' },
      string2: { type: 'string', description: 'Second string for LCS/edit distance' },
      coins: { type: 'array', items: { type: 'number' }, description: 'Coin denominations' },
      amount: { type: 'number', description: 'Target amount for coin change' },
      array: { type: 'array', items: { type: 'number' }, description: 'Array for LIS' },
      dimensions: { type: 'array', items: { type: 'number' }, description: 'Matrix dimensions' },
      prices: { type: 'array', items: { type: 'number' }, description: 'Rod prices by length' },
      length: { type: 'number', description: 'Rod length' },
      numbers: { type: 'array', items: { type: 'number' }, description: 'Numbers for subset sum' },
      target: { type: 'number', description: 'Target sum' }
    },
    required: ['operation']
  }
};

export async function executedynamicprogramming(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    switch (args.operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Dynamic Programming',
            description: 'Optimal substructure + overlapping subproblems = DP',
            principles: {
              optimal_substructure: 'Optimal solution contains optimal solutions to subproblems',
              overlapping_subproblems: 'Same subproblems are solved repeatedly',
              memoization: 'Top-down: cache results of recursive calls',
              tabulation: 'Bottom-up: fill table iteratively'
            },
            availableProblems: [
              { name: 'fibonacci', type: '1D DP', complexity: 'O(n)' },
              { name: 'knapsack', type: '2D DP', complexity: 'O(n*W)' },
              { name: 'lcs', type: '2D DP', complexity: 'O(m*n)' },
              { name: 'edit_distance', type: '2D DP', complexity: 'O(m*n)' },
              { name: 'coin_change', type: '1D DP', complexity: 'O(n*amount)' },
              { name: 'lis', type: '1D DP', complexity: 'O(n^2) or O(n log n)' },
              { name: 'matrix_chain', type: 'Interval DP', complexity: 'O(n^3)' },
              { name: 'rod_cutting', type: '1D DP', complexity: 'O(n^2)' },
              { name: 'subset_sum', type: '2D DP', complexity: 'O(n*target)' }
            ]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              { description: '0/1 Knapsack', call: { operation: 'knapsack', weights: [2, 3, 4, 5], values: [3, 4, 5, 6], capacity: 8 } },
              { description: 'LCS of two strings', call: { operation: 'lcs', string1: 'AGGTAB', string2: 'GXTXAYB' } },
              { description: 'Coin change', call: { operation: 'coin_change', coins: [1, 5, 10, 25], amount: 67 } },
              { description: 'Longest increasing subsequence', call: { operation: 'lis', array: [10, 22, 9, 33, 21, 50, 41, 60] } }
            ]
          }, null, 2)
        };
      }

      case 'fibonacci': {
        const n = args.n || 10;
        const result = fibonacci(n);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'knapsack': {
        const weights = args.weights || [2, 3, 4, 5];
        const values = args.values || [3, 4, 5, 6];
        const capacity = args.capacity || 8;
        const result = knapsack(weights, values, capacity);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'lcs': {
        const s1 = args.string1 || 'AGGTAB';
        const s2 = args.string2 || 'GXTXAYB';
        const result = lcs(s1, s2);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'edit_distance': {
        const s1 = args.string1 || 'kitten';
        const s2 = args.string2 || 'sitting';
        const result = editDistance(s1, s2);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'coin_change': {
        const coins = args.coins || [1, 5, 10, 25];
        const amount = args.amount || 67;
        const result = coinChange(coins, amount);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'lis': {
        const arr = args.array || [10, 22, 9, 33, 21, 50, 41, 60];
        const result = longestIncreasingSubsequence(arr);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'matrix_chain': {
        const dimensions = args.dimensions || [30, 35, 15, 5, 10, 20, 25];
        const result = matrixChainMultiplication(dimensions);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'rod_cutting': {
        const prices = args.prices || [1, 5, 8, 9, 10, 17, 17, 20];
        const length = args.length || 8;
        const result = rodCutting(prices, length);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'subset_sum': {
        const nums = args.numbers || [3, 34, 4, 12, 5, 2];
        const target = args.target || 9;
        const result = subsetSum(nums, target);
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

export function isdynamicprogrammingAvailable(): boolean {
  return true;
}
