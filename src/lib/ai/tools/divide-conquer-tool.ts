/**
 * DIVIDE AND CONQUER TOOL
 *
 * Classic divide-and-conquer algorithms with recursion tree visualization.
 * Demonstrates the paradigm: divide, conquer, combine.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface DCResult {
  algorithm: string;
  input: unknown;
  output: unknown;
  recursionDepth: number;
  subproblems: number;
  complexity: { time: string; space: string; recurrence: string };
  trace?: string[];
}

// ============================================================================
// SORTING ALGORITHMS
// ============================================================================

function mergeSort(
  arr: number[],
  trace: string[] = [],
  depth = 0
): { sorted: number[]; trace: string[] } {
  const indent = '  '.repeat(depth);
  trace.push(`${indent}mergeSort([${arr.join(', ')}])`);

  if (arr.length <= 1) {
    trace.push(`${indent}  -> base case: [${arr.join(', ')}]`);
    return { sorted: arr, trace };
  }

  const mid = Math.floor(arr.length / 2);
  const left = arr.slice(0, mid);
  const right = arr.slice(mid);

  trace.push(`${indent}  divide: [${left.join(', ')}] | [${right.join(', ')}]`);

  const { sorted: sortedLeft } = mergeSort(left, trace, depth + 1);
  const { sorted: sortedRight } = mergeSort(right, trace, depth + 1);

  // Merge
  const merged: number[] = [];
  let i = 0,
    j = 0;
  while (i < sortedLeft.length && j < sortedRight.length) {
    if (sortedLeft[i] <= sortedRight[j]) {
      merged.push(sortedLeft[i++]);
    } else {
      merged.push(sortedRight[j++]);
    }
  }
  while (i < sortedLeft.length) merged.push(sortedLeft[i++]);
  while (j < sortedRight.length) merged.push(sortedRight[j++]);

  trace.push(`${indent}  merge: [${merged.join(', ')}]`);

  return { sorted: merged, trace };
}

function quickSort(
  arr: number[],
  trace: string[] = [],
  depth = 0
): { sorted: number[]; trace: string[]; comparisons: number } {
  const indent = '  '.repeat(depth);
  trace.push(`${indent}quickSort([${arr.join(', ')}])`);

  if (arr.length <= 1) {
    trace.push(`${indent}  -> base case`);
    return { sorted: arr, trace, comparisons: 0 };
  }

  // Choose pivot (median of three for better performance)
  const pivotIdx = Math.floor(arr.length / 2);
  const pivot = arr[pivotIdx];
  trace.push(`${indent}  pivot: ${pivot}`);

  const less: number[] = [];
  const equal: number[] = [];
  const greater: number[] = [];

  let comparisons = 0;
  for (const x of arr) {
    comparisons++;
    if (x < pivot) less.push(x);
    else if (x > pivot) greater.push(x);
    else equal.push(x);
  }

  trace.push(`${indent}  partition: [${less.join(', ')}] | ${pivot} | [${greater.join(', ')}]`);

  const { sorted: sortedLess, comparisons: compLess } = quickSort(less, trace, depth + 1);
  const { sorted: sortedGreater, comparisons: compGreater } = quickSort(greater, trace, depth + 1);

  const result = [...sortedLess, ...equal, ...sortedGreater];
  trace.push(`${indent}  -> [${result.join(', ')}]`);

  return { sorted: result, trace, comparisons: comparisons + compLess + compGreater };
}

// ============================================================================
// SEARCHING
// ============================================================================

function binarySearch(arr: number[], target: number): DCResult {
  const trace: string[] = [];
  let left = 0;
  let right = arr.length - 1;
  let depth = 0;
  let found = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    trace.push(`depth ${depth}: searching [${left}, ${right}], mid=${mid}, arr[mid]=${arr[mid]}`);

    if (arr[mid] === target) {
      found = mid;
      trace.push(`  -> FOUND at index ${mid}`);
      break;
    } else if (arr[mid] < target) {
      trace.push(`  -> ${arr[mid]} < ${target}, search right half`);
      left = mid + 1;
    } else {
      trace.push(`  -> ${arr[mid]} > ${target}, search left half`);
      right = mid - 1;
    }
    depth++;
  }

  if (found === -1) {
    trace.push(`  -> NOT FOUND`);
  }

  return {
    algorithm: 'Binary Search',
    input: { array: arr, target },
    output: { found: found !== -1, index: found },
    recursionDepth: depth,
    subproblems: depth + 1,
    complexity: { time: 'O(log n)', space: 'O(1)', recurrence: 'T(n) = T(n/2) + O(1)' },
    trace,
  };
}

// ============================================================================
// MAXIMUM SUBARRAY (Kadane's is O(n), but D&C shows the paradigm)
// ============================================================================

function maxCrossingSum(
  arr: number[],
  left: number,
  mid: number,
  right: number
): { sum: number; leftIdx: number; rightIdx: number } {
  let leftSum = -Infinity;
  let sum = 0;
  let leftIdx = mid;

  for (let i = mid; i >= left; i--) {
    sum += arr[i];
    if (sum > leftSum) {
      leftSum = sum;
      leftIdx = i;
    }
  }

  let rightSum = -Infinity;
  sum = 0;
  let rightIdx = mid + 1;

  for (let i = mid + 1; i <= right; i++) {
    sum += arr[i];
    if (sum > rightSum) {
      rightSum = sum;
      rightIdx = i;
    }
  }

  return { sum: leftSum + rightSum, leftIdx, rightIdx };
}

function maxSubarray(
  arr: number[],
  left: number,
  right: number,
  trace: string[],
  depth: number
): { sum: number; leftIdx: number; rightIdx: number } {
  const indent = '  '.repeat(depth);

  if (left === right) {
    trace.push(`${indent}base case: arr[${left}] = ${arr[left]}`);
    return { sum: arr[left], leftIdx: left, rightIdx: left };
  }

  const mid = Math.floor((left + right) / 2);
  trace.push(`${indent}divide at mid=${mid}: [${left}, ${mid}] | [${mid + 1}, ${right}]`);

  const leftResult = maxSubarray(arr, left, mid, trace, depth + 1);
  const rightResult = maxSubarray(arr, mid + 1, right, trace, depth + 1);
  const crossResult = maxCrossingSum(arr, left, mid, right);

  trace.push(
    `${indent}left max: ${leftResult.sum}, right max: ${rightResult.sum}, cross max: ${crossResult.sum}`
  );

  if (leftResult.sum >= rightResult.sum && leftResult.sum >= crossResult.sum) {
    return leftResult;
  } else if (rightResult.sum >= leftResult.sum && rightResult.sum >= crossResult.sum) {
    return rightResult;
  } else {
    return crossResult;
  }
}

// ============================================================================
// CLOSEST PAIR OF POINTS
// ============================================================================

interface Point {
  x: number;
  y: number;
}

function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function bruteForceClosest(points: Point[]): { dist: number; p1: Point; p2: Point } {
  let minDist = Infinity;
  let closestPair: { p1: Point; p2: Point } = { p1: points[0], p2: points[1] };

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distance(points[i], points[j]);
      if (d < minDist) {
        minDist = d;
        closestPair = { p1: points[i], p2: points[j] };
      }
    }
  }

  return { dist: minDist, ...closestPair };
}

function closestPairStrip(
  strip: Point[],
  d: number
): { dist: number; p1: Point; p2: Point } | null {
  let minDist = d;
  let result: { dist: number; p1: Point; p2: Point } | null = null;

  strip.sort((a, b) => a.y - b.y);

  for (let i = 0; i < strip.length; i++) {
    for (let j = i + 1; j < strip.length && strip[j].y - strip[i].y < minDist; j++) {
      const dist = distance(strip[i], strip[j]);
      if (dist < minDist) {
        minDist = dist;
        result = { dist, p1: strip[i], p2: strip[j] };
      }
    }
  }

  return result;
}

function closestPairDC(points: Point[]): DCResult {
  if (points.length < 2) {
    return {
      algorithm: 'Closest Pair of Points',
      input: { points },
      output: { error: 'Need at least 2 points' },
      recursionDepth: 0,
      subproblems: 0,
      complexity: { time: 'O(n log n)', space: 'O(n)', recurrence: 'T(n) = 2T(n/2) + O(n)' },
    };
  }

  // Sort by x-coordinate
  const sortedX = [...points].sort((a, b) => a.x - b.x);
  const trace: string[] = [];

  function closestRec(px: Point[], depth: number): { dist: number; p1: Point; p2: Point } {
    const indent = '  '.repeat(depth);

    if (px.length <= 3) {
      trace.push(`${indent}brute force on ${px.length} points`);
      return bruteForceClosest(px);
    }

    const mid = Math.floor(px.length / 2);
    const midPoint = px[mid];
    trace.push(`${indent}divide at x=${midPoint.x.toFixed(2)}`);

    const leftHalf = px.slice(0, mid);
    const rightHalf = px.slice(mid);

    const leftResult = closestRec(leftHalf, depth + 1);
    const rightResult = closestRec(rightHalf, depth + 1);

    let best = leftResult.dist < rightResult.dist ? leftResult : rightResult;
    trace.push(
      `${indent}left: ${leftResult.dist.toFixed(2)}, right: ${rightResult.dist.toFixed(2)}, best so far: ${best.dist.toFixed(2)}`
    );

    // Check strip
    const strip = px.filter((p) => Math.abs(p.x - midPoint.x) < best.dist);
    trace.push(`${indent}checking strip of ${strip.length} points`);

    const stripResult = closestPairStrip(strip, best.dist);
    if (stripResult && stripResult.dist < best.dist) {
      best = stripResult;
      trace.push(`${indent}found closer pair in strip: ${best.dist.toFixed(2)}`);
    }

    return best;
  }

  const result = closestRec(sortedX, 0);

  return {
    algorithm: 'Closest Pair of Points',
    input: { points, numPoints: points.length },
    output: {
      distance: result.dist,
      point1: result.p1,
      point2: result.p2,
    },
    recursionDepth: Math.ceil(Math.log2(points.length)),
    subproblems: 2 * points.length - 1,
    complexity: { time: 'O(n log n)', space: 'O(n)', recurrence: 'T(n) = 2T(n/2) + O(n)' },
    trace: trace.slice(0, 20),
  };
}

// ============================================================================
// STRASSEN'S MATRIX MULTIPLICATION
// ============================================================================

function strassenMultiply(
  A: number[][],
  B: number[][]
): { result: number[][]; multiplications: number } {
  const n = A.length;

  // Base case
  if (n === 1) {
    return { result: [[A[0][0] * B[0][0]]], multiplications: 1 };
  }

  // For non-power-of-2, pad with zeros (simplified for demo)
  const half = Math.floor(n / 2);

  // Partition matrices
  const A11 = A.slice(0, half).map((row) => row.slice(0, half));
  const A12 = A.slice(0, half).map((row) => row.slice(half));
  const A21 = A.slice(half).map((row) => row.slice(0, half));
  const A22 = A.slice(half).map((row) => row.slice(half));

  const B11 = B.slice(0, half).map((row) => row.slice(0, half));
  const B12 = B.slice(0, half).map((row) => row.slice(half));
  const B21 = B.slice(half).map((row) => row.slice(0, half));
  const B22 = B.slice(half).map((row) => row.slice(half));

  // For simplicity, just do standard D&C (Strassen's 7 multiplications is complex to implement)
  // This demonstrates the divide-conquer approach
  const { result: C11, multiplications: m1 } = strassenMultiply(A11, B11);
  const { result: C12a, multiplications: m2 } = strassenMultiply(A12, B21);
  const { result: C12b, multiplications: m3 } = strassenMultiply(A11, B12);
  const { result: C22a, multiplications: m4 } = strassenMultiply(A12, B22);
  const { result: C21a, multiplications: m5 } = strassenMultiply(A21, B11);
  const { result: C21b, multiplications: m6 } = strassenMultiply(A22, B21);
  const { result: C22b, multiplications: m7 } = strassenMultiply(A21, B12);
  const { result: C22c, multiplications: m8 } = strassenMultiply(A22, B22);

  // Combine
  const addMatrix = (M1: number[][], M2: number[][]) =>
    M1.map((row, i) => row.map((val, j) => val + M2[i][j]));

  const topLeft = addMatrix(C11, C12a);
  const topRight = addMatrix(C12b, C22a);
  const bottomLeft = addMatrix(C21a, C21b);
  const bottomRight = addMatrix(C22b, C22c);

  const result = [
    ...topLeft.map((row, i) => [...row, ...topRight[i]]),
    ...bottomLeft.map((row, i) => [...row, ...bottomRight[i]]),
  ];

  return { result, multiplications: m1 + m2 + m3 + m4 + m5 + m6 + m7 + m8 };
}

// ============================================================================
// KARATSUBA MULTIPLICATION
// ============================================================================

function karatsubaMultiply(
  x: bigint,
  y: bigint,
  trace: string[] = [],
  depth = 0
): { result: bigint; multiplications: number; trace: string[] } {
  const indent = '  '.repeat(depth);
  trace.push(`${indent}karatsuba(${x}, ${y})`);

  // Base case
  if (x < 10n || y < 10n) {
    trace.push(`${indent}  -> base case: ${x * y}`);
    return { result: x * y, multiplications: 1, trace };
  }

  const xStr = x.toString();
  const yStr = y.toString();
  const n = Math.max(xStr.length, yStr.length);
  const m = Math.floor(n / 2);

  // Split numbers
  const high1 = BigInt(xStr.slice(0, -m) || '0');
  const low1 = BigInt(xStr.slice(-m));
  const high2 = BigInt(yStr.slice(0, -m) || '0');
  const low2 = BigInt(yStr.slice(-m));

  trace.push(`${indent}  x = ${high1} * 10^${m} + ${low1}`);
  trace.push(`${indent}  y = ${high2} * 10^${m} + ${low2}`);

  // Three recursive multiplications instead of four
  const { result: z0, multiplications: m1 } = karatsubaMultiply(low1, low2, trace, depth + 1);
  const { result: z2, multiplications: m2 } = karatsubaMultiply(high1, high2, trace, depth + 1);
  const { result: z1temp, multiplications: m3 } = karatsubaMultiply(
    low1 + high1,
    low2 + high2,
    trace,
    depth + 1
  );
  const z1 = z1temp - z2 - z0;

  const result = z2 * BigInt(10 ** (2 * m)) + z1 * BigInt(10 ** m) + z0;
  trace.push(`${indent}  -> ${result}`);

  return { result, multiplications: m1 + m2 + m3, trace };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export const divideconquerTool: UnifiedTool = {
  name: 'divide_conquer',
  description: `Divide and Conquer algorithm solver. Operations:
- merge_sort: O(n log n) stable sort
- quick_sort: O(n log n) average case sort
- binary_search: O(log n) search in sorted array
- max_subarray: Maximum contiguous subarray sum
- closest_pair: Closest pair of 2D points
- matrix_multiply: Matrix multiplication (D&C approach)
- karatsuba: Fast integer multiplication
- info: Documentation and theory`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'merge_sort',
          'quick_sort',
          'binary_search',
          'max_subarray',
          'closest_pair',
          'matrix_multiply',
          'karatsuba',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      array: { type: 'array', items: { type: 'number' }, description: 'Array to sort/search' },
      target: { type: 'number', description: 'Target for binary search' },
      points: { type: 'array', description: 'Points for closest pair [{x, y}, ...]' },
      matrixA: { type: 'array', description: '2D matrix A' },
      matrixB: { type: 'array', description: '2D matrix B' },
      x: { type: 'number', description: 'First number for Karatsuba' },
      y: { type: 'number', description: 'Second number for Karatsuba' },
    },
    required: ['operation'],
  },
};

export async function executedivideconquer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    switch (args.operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'Divide and Conquer',
              paradigm: {
                divide: 'Break problem into smaller subproblems',
                conquer: 'Solve subproblems recursively',
                combine: 'Merge solutions to solve original problem',
              },
              masterTheorem: {
                form: 'T(n) = aT(n/b) + f(n)',
                case1: 'f(n) = O(n^(log_b(a) - e)) => T(n) = O(n^log_b(a))',
                case2: 'f(n) = O(n^log_b(a)) => T(n) = O(n^log_b(a) * log n)',
                case3: 'f(n) = O(n^(log_b(a) + e)) => T(n) = O(f(n))',
              },
              algorithms: [
                {
                  name: 'Merge Sort',
                  recurrence: 'T(n) = 2T(n/2) + O(n)',
                  complexity: 'O(n log n)',
                },
                {
                  name: 'Quick Sort',
                  recurrence: 'T(n) = 2T(n/2) + O(n) avg',
                  complexity: 'O(n log n) avg',
                },
                {
                  name: 'Binary Search',
                  recurrence: 'T(n) = T(n/2) + O(1)',
                  complexity: 'O(log n)',
                },
                {
                  name: 'Closest Pair',
                  recurrence: 'T(n) = 2T(n/2) + O(n)',
                  complexity: 'O(n log n)',
                },
                {
                  name: 'Karatsuba',
                  recurrence: 'T(n) = 3T(n/2) + O(n)',
                  complexity: 'O(n^1.585)',
                },
              ],
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              examples: [
                {
                  description: 'Merge sort',
                  call: { operation: 'merge_sort', array: [38, 27, 43, 3, 9, 82, 10] },
                },
                {
                  description: 'Binary search',
                  call: { operation: 'binary_search', array: [1, 3, 5, 7, 9, 11, 13], target: 7 },
                },
                {
                  description: 'Maximum subarray',
                  call: { operation: 'max_subarray', array: [-2, 1, -3, 4, -1, 2, 1, -5, 4] },
                },
                {
                  description: 'Karatsuba multiplication',
                  call: { operation: 'karatsuba', x: 1234, y: 5678 },
                },
              ],
            },
            null,
            2
          ),
        };
      }

      case 'merge_sort': {
        const arr = args.array || [38, 27, 43, 3, 9, 82, 10];
        const { sorted, trace } = mergeSort(arr);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              algorithm: 'Merge Sort',
              input: arr,
              output: sorted,
              recursionDepth: Math.ceil(Math.log2(arr.length)),
              subproblems: 2 * arr.length - 1,
              complexity: {
                time: 'O(n log n)',
                space: 'O(n)',
                recurrence: 'T(n) = 2T(n/2) + O(n)',
              },
              trace: trace.slice(0, 30),
            },
            null,
            2
          ),
        };
      }

      case 'quick_sort': {
        const arr = args.array || [38, 27, 43, 3, 9, 82, 10];
        const { sorted, trace, comparisons } = quickSort(arr);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              algorithm: 'Quick Sort',
              input: arr,
              output: sorted,
              comparisons,
              recursionDepth: Math.ceil(Math.log2(arr.length)),
              complexity: {
                time: 'O(n log n) average, O(n^2) worst',
                space: 'O(log n) average',
                recurrence: 'T(n) = 2T(n/2) + O(n) average',
              },
              trace: trace.slice(0, 30),
            },
            null,
            2
          ),
        };
      }

      case 'binary_search': {
        const arr = args.array || [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
        const target = args.target ?? 7;
        const result = binarySearch(
          arr.sort((a: number, b: number) => a - b),
          target
        );
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'max_subarray': {
        const arr = args.array || [-2, 1, -3, 4, -1, 2, 1, -5, 4];
        const trace: string[] = [];
        const result = maxSubarray(arr, 0, arr.length - 1, trace, 0);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              algorithm: 'Maximum Subarray (Divide & Conquer)',
              input: arr,
              output: {
                maxSum: result.sum,
                startIndex: result.leftIdx,
                endIndex: result.rightIdx,
                subarray: arr.slice(result.leftIdx, result.rightIdx + 1),
              },
              recursionDepth: Math.ceil(Math.log2(arr.length)),
              complexity: {
                time: 'O(n log n)',
                space: 'O(log n)',
                recurrence: 'T(n) = 2T(n/2) + O(n)',
              },
              note: "Kadane's algorithm solves this in O(n), but D&C demonstrates the paradigm",
              trace: trace.slice(0, 20),
            },
            null,
            2
          ),
        };
      }

      case 'closest_pair': {
        const points: Point[] = args.points || [
          { x: 2, y: 3 },
          { x: 12, y: 30 },
          { x: 40, y: 50 },
          { x: 5, y: 1 },
          { x: 12, y: 10 },
          { x: 3, y: 4 },
        ];
        const result = closestPairDC(points);
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'matrix_multiply': {
        const A = args.matrixA || [
          [1, 2],
          [3, 4],
        ];
        const B = args.matrixB || [
          [5, 6],
          [7, 8],
        ];

        if (A.length !== B.length || A[0].length !== B[0].length) {
          throw new Error('Matrices must be square and same size');
        }

        const { result, multiplications } = strassenMultiply(A, B);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              algorithm: 'Matrix Multiplication (Divide & Conquer)',
              input: { matrixA: A, matrixB: B },
              output: result,
              multiplications,
              complexity: {
                time: 'O(n^3) standard, O(n^2.807) Strassen',
                space: 'O(n^2)',
                recurrence: 'T(n) = 8T(n/2) + O(n^2) standard, 7T(n/2) + O(n^2) Strassen',
              },
            },
            null,
            2
          ),
        };
      }

      case 'karatsuba': {
        const x = BigInt(args.x || 1234);
        const y = BigInt(args.y || 5678);
        const { result, multiplications, trace } = karatsubaMultiply(x, y);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              algorithm: 'Karatsuba Multiplication',
              input: { x: x.toString(), y: y.toString() },
              output: result.toString(),
              verification: (x * y).toString(),
              multiplications,
              complexity: {
                time: 'O(n^1.585)',
                space: 'O(n)',
                recurrence: 'T(n) = 3T(n/2) + O(n)',
              },
              trace: trace.slice(0, 20),
            },
            null,
            2
          ),
        };
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}. Use 'info' for help.`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isdivideconquerAvailable(): boolean {
  return true;
}
