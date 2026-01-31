/**
 * COMBINATORICS TOOL
 *
 * Combinatorial mathematics using js-combinatorics.
 * Runs entirely locally - no external API costs.
 *
 * Functions:
 * - Permutations and combinations
 * - Factorial and binomial coefficients
 * - Partitions and compositions
 * - Cartesian products
 * - Power sets
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Combinatorics: any = null;

async function initCombinatorics(): Promise<boolean> {
  if (Combinatorics) return true;
  try {
    const mod = await import('js-combinatorics');
    Combinatorics = mod;
    return true;
  } catch {
    return false;
  }
}

// Factorial with BigInt for large numbers
function factorial(n: number): bigint {
  if (n < 0) throw new Error('Factorial not defined for negative numbers');
  if (n <= 1) return 1n;
  let result = 1n;
  for (let i = 2n; i <= BigInt(n); i++) {
    result *= i;
  }
  return result;
}

// Binomial coefficient C(n, k)
function binomial(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  // Use symmetry for efficiency
  if (k > n - k) k = n - k;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

// Multinomial coefficient
function multinomial(n: number, ...ks: number[]): bigint {
  const sum = ks.reduce((a, b) => a + b, 0);
  if (sum !== n) throw new Error('Sum of ks must equal n');
  let result = factorial(n);
  for (const k of ks) {
    result /= factorial(k);
  }
  return result;
}

// Catalan number
function catalan(n: number): bigint {
  return binomial(2 * n, n) / BigInt(n + 1);
}

// Stirling number of second kind S(n, k)
function stirling2(n: number, k: number): bigint {
  if (n === 0 && k === 0) return 1n;
  if (n === 0 || k === 0 || k > n) return 0n;

  let sum = 0n;
  for (let j = 0; j <= k; j++) {
    const term = binomial(k, j) * BigInt(Math.pow(k - j, n));
    sum += BigInt(Math.pow(-1, j)) * term;
  }
  return sum / factorial(k);
}

// Bell number B(n)
function bell(n: number): bigint {
  if (n === 0) return 1n;
  let sum = 0n;
  for (let k = 0; k <= n; k++) {
    sum += stirling2(n, k);
  }
  return sum;
}

// Derangement D(n) - permutations with no fixed points
function derangement(n: number): bigint {
  if (n === 0) return 1n;
  if (n === 1) return 0n;
  // D(n) = (n-1) * (D(n-1) + D(n-2))
  let prev2 = 1n; // D(0)
  let prev1 = 0n; // D(1)
  for (let i = 2; i <= n; i++) {
    const current = BigInt(i - 1) * (prev1 + prev2);
    prev2 = prev1;
    prev1 = current;
  }
  return prev1;
}

// Partition function P(n) - number of ways to partition n
function partitionCount(n: number): bigint {
  const p: bigint[] = [1n];
  for (let i = 1; i <= n; i++) {
    p[i] = 0n;
    let k = 1;
    let sign = 1n;
    while (true) {
      const pent1 = (k * (3 * k - 1)) / 2;
      const pent2 = (k * (3 * k + 1)) / 2;
      if (pent1 > i) break;
      p[i] += sign * p[i - pent1];
      if (pent2 <= i) {
        p[i] += sign * p[i - pent2];
      }
      sign *= -1n;
      k++;
    }
  }
  return p[n];
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const combinatoricsTool: UnifiedTool = {
  name: 'combinatorics',
  description: `Compute combinatorial quantities and generate combinatorial structures.

Available operations:
- factorial: n!
- binomial: C(n,k) combinations
- multinomial: Multinomial coefficient
- permutation_count: P(n,k) = n!/(n-k)!
- catalan: Catalan number C_n
- stirling2: Stirling number of second kind S(n,k)
- bell: Bell number B_n
- derangement: D_n (permutations with no fixed points)
- partition_count: Number of partitions of n

Generate structures:
- permutations: All permutations of elements
- combinations: All k-combinations
- power_set: All subsets
- cartesian: Cartesian product

Used in: Probability, counting problems, algorithm analysis, discrete math`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'factorial',
          'binomial',
          'multinomial',
          'permutation_count',
          'catalan',
          'stirling2',
          'bell',
          'derangement',
          'partition_count',
          'permutations',
          'combinations',
          'power_set',
          'cartesian',
        ],
        description: 'Combinatorial operation',
      },
      n: {
        type: 'number',
        description: 'Primary parameter (size)',
      },
      k: {
        type: 'number',
        description: 'Secondary parameter (selection size)',
      },
      ks: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of group sizes for multinomial',
      },
      elements: {
        type: 'array',
        description: 'Elements to generate permutations/combinations from',
      },
      sets: {
        type: 'array',
        description: 'Arrays for Cartesian product',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCombinatoricsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeCombinatorics(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    n?: number;
    k?: number;
    ks?: number[];
    elements?: unknown[];
    sets?: unknown[][];
    limit?: number;
  };

  const { operation, n, k, ks, elements, sets, limit = 100 } = args;

  try {
    const initialized = await initCombinatorics();
    if (
      !initialized &&
      ['permutations', 'combinations', 'power_set', 'cartesian'].includes(operation)
    ) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize js-combinatorics library' }),
        isError: true,
      };
    }

    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'factorial':
        if (n === undefined) throw new Error('n is required for factorial');
        result.value = factorial(n).toString();
        result.n = n;
        break;

      case 'binomial':
        if (n === undefined || k === undefined) throw new Error('n and k required for binomial');
        result.value = binomial(n, k).toString();
        result.n = n;
        result.k = k;
        result.formula = `C(${n},${k}) = ${n}! / (${k}! × ${n - k}!)`;
        break;

      case 'multinomial':
        if (n === undefined || !ks) throw new Error('n and ks required for multinomial');
        result.value = multinomial(n, ...ks).toString();
        result.n = n;
        result.ks = ks;
        break;

      case 'permutation_count':
        if (n === undefined) throw new Error('n is required');
        const kVal = k ?? n;
        result.value = (factorial(n) / factorial(n - kVal)).toString();
        result.n = n;
        result.k = kVal;
        result.formula = `P(${n},${kVal}) = ${n}! / ${n - kVal}!`;
        break;

      case 'catalan':
        if (n === undefined) throw new Error('n is required for catalan');
        result.value = catalan(n).toString();
        result.n = n;
        result.formula = `C_${n} = C(2n,n) / (n+1)`;
        break;

      case 'stirling2':
        if (n === undefined || k === undefined) throw new Error('n and k required for stirling2');
        result.value = stirling2(n, k).toString();
        result.n = n;
        result.k = k;
        result.description = `Ways to partition ${n} elements into ${k} non-empty subsets`;
        break;

      case 'bell':
        if (n === undefined) throw new Error('n is required for bell');
        result.value = bell(n).toString();
        result.n = n;
        result.description = `Number of partitions of a set with ${n} elements`;
        break;

      case 'derangement':
        if (n === undefined) throw new Error('n is required for derangement');
        result.value = derangement(n).toString();
        result.n = n;
        result.description = `Permutations of ${n} elements with no fixed points`;
        break;

      case 'partition_count':
        if (n === undefined) throw new Error('n is required for partition_count');
        result.value = partitionCount(n).toString();
        result.n = n;
        result.description = `Number of ways to write ${n} as sum of positive integers`;
        break;

      case 'permutations': {
        if (!elements) throw new Error('elements required for permutations');
        const elems = elements.slice(0, 10); // Limit input size
        const permGen = Combinatorics.permutation(elems, k || elems.length);
        const perms = [];
        let count = 0;
        for (const p of permGen) {
          if (count >= limit) break;
          perms.push([...p]);
          count++;
        }
        result.permutations = perms;
        result.returned = perms.length;
        result.total = Number(permGen.length);
        break;
      }

      case 'combinations': {
        if (!elements || k === undefined)
          throw new Error('elements and k required for combinations');
        const combGen = Combinatorics.combination(elements.slice(0, 20), k);
        const combs = [];
        let count = 0;
        for (const c of combGen) {
          if (count >= limit) break;
          combs.push([...c]);
          count++;
        }
        result.combinations = combs;
        result.returned = combs.length;
        result.total = Number(combGen.length);
        break;
      }

      case 'power_set': {
        if (!elements) throw new Error('elements required for power_set');
        const elems = elements.slice(0, 15); // Limit to prevent huge output
        const psGen = Combinatorics.power(elems);
        const ps = [];
        let count = 0;
        for (const s of psGen) {
          if (count >= limit) break;
          ps.push([...s]);
          count++;
        }
        result.subsets = ps;
        result.returned = ps.length;
        result.total = Math.pow(2, elems.length);
        break;
      }

      case 'cartesian': {
        if (!sets || sets.length === 0) throw new Error('sets required for cartesian');
        const cpGen = Combinatorics.cartesian(...sets.slice(0, 5));
        const products = [];
        let count = 0;
        for (const p of cpGen) {
          if (count >= limit) break;
          products.push([...p]);
          count++;
        }
        result.products = products;
        result.returned = products.length;
        result.total = sets.reduce((acc, s) => acc * s.length, 1);
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
