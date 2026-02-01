/**
 * COMPUTATIONAL COMPLEXITY TOOL
 *
 * Big-O analysis, recurrence relations, complexity classes,
 * and algorithm runtime analysis.
 *
 * Part of TIER ADVANCED SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// COMPLEXITY CLASSES
// ============================================================================

interface ComplexityClass {
  name: string;
  notation: string;
  description: string;
  growth: string;
  examples: string[];
}

const COMPLEXITY_CLASSES: Record<string, ComplexityClass> = {
  'O(1)': {
    name: 'Constant',
    notation: 'O(1)',
    description: 'Independent of input size',
    growth: 'Flat line',
    examples: ['Array access', 'Hash table lookup', 'Stack push/pop'],
  },
  'O(log n)': {
    name: 'Logarithmic',
    notation: 'O(log n)',
    description: 'Grows slowly with input size',
    growth: 'Slow growth, eventually flattens',
    examples: ['Binary search', 'Balanced BST operations', 'Finding GCD'],
  },
  'O(n)': {
    name: 'Linear',
    notation: 'O(n)',
    description: 'Proportional to input size',
    growth: 'Straight diagonal line',
    examples: ['Linear search', 'Array traversal', 'Finding max/min'],
  },
  'O(n log n)': {
    name: 'Linearithmic',
    notation: 'O(n log n)',
    description: 'Common for efficient sorting',
    growth: 'Slightly above linear',
    examples: ['Merge sort', 'Heap sort', 'Quick sort (average)'],
  },
  'O(n²)': {
    name: 'Quadratic',
    notation: 'O(n²)',
    description: 'Nested loops over input',
    growth: 'Parabolic curve',
    examples: ['Bubble sort', 'Selection sort', 'Simple matrix ops'],
  },
  'O(n³)': {
    name: 'Cubic',
    notation: 'O(n³)',
    description: 'Triple nested loops',
    growth: 'Steep curve',
    examples: ['Matrix multiplication (naive)', '3D array operations'],
  },
  'O(2^n)': {
    name: 'Exponential',
    notation: 'O(2^n)',
    description: 'Doubles with each input increase',
    growth: 'Explodes rapidly',
    examples: ['Subsets generation', 'Fibonacci (naive)', 'Tower of Hanoi'],
  },
  'O(n!)': {
    name: 'Factorial',
    notation: 'O(n!)',
    description: 'All permutations',
    growth: 'Explodes extremely fast',
    examples: ['Permutation generation', 'TSP brute force', 'Bogosort'],
  },
};

// ============================================================================
// GROWTH CALCULATIONS
// ============================================================================

function evaluateComplexity(notation: string, n: number): number {
  switch (notation) {
    case 'O(1)': return 1;
    case 'O(log n)': return Math.log2(n);
    case 'O(√n)': return Math.sqrt(n);
    case 'O(n)': return n;
    case 'O(n log n)': return n * Math.log2(n);
    case 'O(n²)': return n * n;
    case 'O(n³)': return n * n * n;
    case 'O(2^n)': return Math.pow(2, n);
    case 'O(n!)': return factorial(n);
    default: return n;
  }
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  if (n > 20) return Infinity; // Prevent overflow
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function compareComplexities(c1: string, c2: string, n: number): { ratio: number; faster: string } {
  const v1 = evaluateComplexity(c1, n);
  const v2 = evaluateComplexity(c2, n);
  const ratio = v1 / v2;
  return {
    ratio: Math.round(ratio * 1000) / 1000,
    faster: ratio < 1 ? c1 : c2,
  };
}

// ============================================================================
// RECURRENCE RELATIONS
// ============================================================================

interface RecurrenceSolution {
  recurrence: string;
  solution: string;
  method: string;
  explanation: string;
}

function solveRecurrence(a: number, b: number, f: string): RecurrenceSolution {
  // T(n) = a*T(n/b) + f(n)
  // Master theorem
  const logbA = Math.log(a) / Math.log(b);
  const logbARounded = Math.round(logbA * 1000) / 1000;

  let solution: string;
  let explanation: string;

  if (f === 'O(1)' || f === 'O(n^0)') {
    // f(n) = Θ(1)
    if (a === 1) {
      solution = 'O(log n)';
      explanation = 'T(n) = T(n/b) + O(1) → O(log n)';
    } else {
      solution = `O(n^${logbARounded})`;
      explanation = `Case 1: f(n) = O(n^c) where c < log_b(a), so T(n) = Θ(n^log_b(a))`;
    }
  } else if (f === 'O(n)') {
    if (logbA < 1) {
      solution = 'O(n)';
      explanation = 'Case 3: f(n) dominates';
    } else if (Math.abs(logbA - 1) < 0.01) {
      solution = 'O(n log n)';
      explanation = 'Case 2: f(n) = Θ(n^log_b(a)), so T(n) = Θ(n log n)';
    } else {
      solution = `O(n^${logbARounded})`;
      explanation = 'Case 1: Recursive work dominates';
    }
  } else if (f === 'O(n^2)') {
    if (logbA < 2) {
      solution = 'O(n²)';
      explanation = 'Case 3: f(n) = Θ(n²) dominates';
    } else if (Math.abs(logbA - 2) < 0.01) {
      solution = 'O(n² log n)';
      explanation = 'Case 2: f(n) = Θ(n^log_b(a))';
    } else {
      solution = `O(n^${logbARounded})`;
      explanation = 'Case 1: Recursive work dominates';
    }
  } else {
    solution = `~O(n^${logbARounded})`;
    explanation = 'Using Master theorem approximation';
  }

  return {
    recurrence: `T(n) = ${a}T(n/${b}) + ${f}`,
    solution,
    method: 'Master Theorem',
    explanation,
  };
}

// ============================================================================
// COMMON ALGORITHM COMPLEXITIES
// ============================================================================

interface AlgorithmComplexity {
  name: string;
  best: string;
  average: string;
  worst: string;
  space: string;
  stable?: boolean;
}

const SORTING_ALGORITHMS: AlgorithmComplexity[] = [
  { name: 'Bubble Sort', best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
  { name: 'Selection Sort', best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: false },
  { name: 'Insertion Sort', best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
  { name: 'Merge Sort', best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true },
  { name: 'Quick Sort', best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: false },
  { name: 'Heap Sort', best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)', stable: false },
  { name: 'Counting Sort', best: 'O(n+k)', average: 'O(n+k)', worst: 'O(n+k)', space: 'O(k)' },
  { name: 'Radix Sort', best: 'O(nk)', average: 'O(nk)', worst: 'O(nk)', space: 'O(n+k)' },
  { name: 'Tim Sort', best: 'O(n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true },
];

const DATA_STRUCTURE_OPS: { structure: string; operation: string; average: string; worst: string }[] = [
  { structure: 'Array', operation: 'Access', average: 'O(1)', worst: 'O(1)' },
  { structure: 'Array', operation: 'Search', average: 'O(n)', worst: 'O(n)' },
  { structure: 'Array', operation: 'Insert', average: 'O(n)', worst: 'O(n)' },
  { structure: 'Array', operation: 'Delete', average: 'O(n)', worst: 'O(n)' },
  { structure: 'Linked List', operation: 'Access', average: 'O(n)', worst: 'O(n)' },
  { structure: 'Linked List', operation: 'Search', average: 'O(n)', worst: 'O(n)' },
  { structure: 'Linked List', operation: 'Insert', average: 'O(1)', worst: 'O(1)' },
  { structure: 'Linked List', operation: 'Delete', average: 'O(1)', worst: 'O(1)' },
  { structure: 'Hash Table', operation: 'Search', average: 'O(1)', worst: 'O(n)' },
  { structure: 'Hash Table', operation: 'Insert', average: 'O(1)', worst: 'O(n)' },
  { structure: 'Hash Table', operation: 'Delete', average: 'O(1)', worst: 'O(n)' },
  { structure: 'BST', operation: 'Search', average: 'O(log n)', worst: 'O(n)' },
  { structure: 'BST', operation: 'Insert', average: 'O(log n)', worst: 'O(n)' },
  { structure: 'BST', operation: 'Delete', average: 'O(log n)', worst: 'O(n)' },
  { structure: 'AVL Tree', operation: 'Search', average: 'O(log n)', worst: 'O(log n)' },
  { structure: 'AVL Tree', operation: 'Insert', average: 'O(log n)', worst: 'O(log n)' },
  { structure: 'AVL Tree', operation: 'Delete', average: 'O(log n)', worst: 'O(log n)' },
  { structure: 'Red-Black Tree', operation: 'Search', average: 'O(log n)', worst: 'O(log n)' },
  { structure: 'Red-Black Tree', operation: 'Insert', average: 'O(log n)', worst: 'O(log n)' },
  { structure: 'Red-Black Tree', operation: 'Delete', average: 'O(log n)', worst: 'O(log n)' },
];

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeGrowth(complexities: string[], maxN: number = 16): string {
  const lines: string[] = ['Growth Comparison:', ''];
  const _width = 50; // reserved for future bar chart expansion
  void _width;

  for (const c of complexities) {
    const values: number[] = [];
    for (let n = 1; n <= maxN; n++) {
      values.push(evaluateComplexity(c, n));
    }
    const maxVal = Math.max(...values.filter(v => isFinite(v)));

    let line = `${c.padEnd(12)} │`;
    for (const v of values) {
      if (!isFinite(v) || v > maxVal * 10) {
        line += '∞';
      } else {
        const height = Math.min(Math.ceil((v / maxVal) * 8), 8);
        const chars = ' ▁▂▃▄▅▆▇█';
        line += chars[height];
      }
    }
    lines.push(line);
  }

  lines.push(`${''.padEnd(12)} └${'─'.repeat(maxN)}`);
  lines.push(`${''.padEnd(12)}  1${' '.repeat(maxN - 4)}${maxN}`);

  return lines.join('\n');
}

function visualizeComplexityTable(): string {
  const lines: string[] = [
    'Common Complexities (Operations at n=1000):',
    '',
    'Complexity      | n=10    | n=100   | n=1000  | n=10000',
    '─────────────────────────────────────────────────────────',
  ];

  const complexities = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2^n)'];

  for (const c of complexities) {
    const v10 = evaluateComplexity(c, 10);
    const v100 = evaluateComplexity(c, 100);
    const v1000 = evaluateComplexity(c, 1000);
    const v10000 = evaluateComplexity(c, 10000);

    const format = (v: number) => {
      if (!isFinite(v)) return '∞'.padStart(7);
      if (v > 1e12) return '>10^12'.padStart(7);
      if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`.padStart(7);
      if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`.padStart(7);
      return v.toFixed(0).padStart(7);
    };

    lines.push(`${c.padEnd(15)} | ${format(v10)} | ${format(v100)} | ${format(v1000)} | ${format(v10000)}`);
  }

  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const computationalComplexityTool: UnifiedTool = {
  name: 'computational_complexity',
  description: `Big-O analysis and algorithm complexity.

Operations:
- analyze: Analyze complexity class
- compare: Compare two complexities
- recurrence: Solve recurrence with Master theorem
- growth: Visualize growth rates
- sorting: Compare sorting algorithms
- data_structures: Data structure operation costs
- table: Show complexity reference table`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'compare', 'recurrence', 'growth', 'sorting', 'data_structures', 'table'],
        description: 'Complexity analysis operation',
      },
      complexity: { type: 'string', description: 'Complexity notation (O(n), O(n²), etc.)' },
      complexity1: { type: 'string', description: 'First complexity to compare' },
      complexity2: { type: 'string', description: 'Second complexity to compare' },
      n: { type: 'number', description: 'Input size' },
      a: { type: 'number', description: 'Recurrence: number of subproblems' },
      b: { type: 'number', description: 'Recurrence: subproblem size divisor' },
      f: { type: 'string', description: 'Recurrence: additional work f(n)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeComputationalComplexity(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'analyze': {
        const complexity = args.complexity || 'O(n log n)';
        const info = COMPLEXITY_CLASSES[complexity];

        if (info) {
          result = {
            operation: 'analyze',
            ...info,
            at_n_10: evaluateComplexity(complexity, 10),
            at_n_100: evaluateComplexity(complexity, 100),
            at_n_1000: evaluateComplexity(complexity, 1000),
          };
        } else {
          result = {
            operation: 'analyze',
            complexity,
            known: false,
            at_n_10: evaluateComplexity(complexity, 10),
            at_n_100: evaluateComplexity(complexity, 100),
            at_n_1000: evaluateComplexity(complexity, 1000),
            available_classes: Object.keys(COMPLEXITY_CLASSES),
          };
        }
        break;
      }

      case 'compare': {
        const c1 = args.complexity1 || 'O(n)';
        const c2 = args.complexity2 || 'O(n²)';
        const n = args.n || 1000;

        const comparison = compareComplexities(c1, c2, n);
        const v1 = evaluateComplexity(c1, n);
        const v2 = evaluateComplexity(c2, n);

        result = {
          operation: 'compare',
          complexity1: c1,
          complexity2: c2,
          at_n: n,
          value1: Math.round(v1 * 1000) / 1000,
          value2: Math.round(v2 * 1000) / 1000,
          ratio: comparison.ratio,
          faster: comparison.faster,
          speedup: `${c1} is ${comparison.ratio < 1 ? Math.round(1 / comparison.ratio) : 1}x faster than ${c2}`,
          visualization: visualizeGrowth([c1, c2], Math.min(n, 20)),
        };
        break;
      }

      case 'recurrence': {
        const a = args.a || 2;
        const b = args.b || 2;
        const f = args.f || 'O(n)';

        const solution = solveRecurrence(a, b, f);

        result = {
          operation: 'recurrence',
          a,
          b,
          f,
          ...solution,
          log_b_a: Math.round(Math.log(a) / Math.log(b) * 1000) / 1000,
        };
        break;
      }

      case 'growth': {
        const complexities = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'];
        const maxN = args.n || 16;

        result = {
          operation: 'growth',
          complexities,
          max_n: maxN,
          visualization: visualizeGrowth(complexities, maxN),
          table: visualizeComplexityTable(),
        };
        break;
      }

      case 'sorting': {
        result = {
          operation: 'sorting',
          algorithms: SORTING_ALGORITHMS,
          recommendation: 'For general purpose: Tim Sort or Merge Sort. For in-place: Quick Sort with good pivot selection.',
        };
        break;
      }

      case 'data_structures': {
        const structure = args.structure;
        let ops = DATA_STRUCTURE_OPS;

        if (structure) {
          ops = ops.filter(o => o.structure.toLowerCase().includes(structure.toLowerCase()));
        }

        result = {
          operation: 'data_structures',
          filter: structure || 'all',
          operations: ops,
        };
        break;
      }

      case 'table': {
        result = {
          operation: 'table',
          table: visualizeComplexityTable(),
          classes: Object.keys(COMPLEXITY_CLASSES),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Complexity Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isComputationalComplexityAvailable(): boolean { return true; }
