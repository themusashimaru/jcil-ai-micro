/**
 * SEQUENCE ANALYSIS TOOL
 *
 * Analyze integer sequences, find patterns, and identify known sequences.
 * Runs entirely locally - no external API costs.
 *
 * Features:
 * - Pattern detection (arithmetic, geometric, polynomial)
 * - Sequence generation
 * - Known sequence identification
 * - Recurrence relation detection
 * - Generating function computation
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Known sequences database (partial OEIS)
const KNOWN_SEQUENCES: Record<string, { name: string; formula: string; terms: number[] }> = {
  A000040: {
    name: 'Prime numbers',
    formula: 'n-th prime',
    terms: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47],
  },
  A000045: {
    name: 'Fibonacci numbers',
    formula: 'F(n) = F(n-1) + F(n-2)',
    terms: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377],
  },
  A000079: {
    name: 'Powers of 2',
    formula: '2^n',
    terms: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096],
  },
  A000290: {
    name: 'Square numbers',
    formula: 'n^2',
    terms: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196],
  },
  A000578: {
    name: 'Cube numbers',
    formula: 'n^3',
    terms: [0, 1, 8, 27, 64, 125, 216, 343, 512, 729, 1000, 1331],
  },
  A000142: {
    name: 'Factorial numbers',
    formula: 'n!',
    terms: [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800],
  },
  A000217: {
    name: 'Triangular numbers',
    formula: 'n(n+1)/2',
    terms: [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105],
  },
  A000292: {
    name: 'Tetrahedral numbers',
    formula: 'n(n+1)(n+2)/6',
    terms: [0, 1, 4, 10, 20, 35, 56, 84, 120, 165, 220, 286],
  },
  A001477: {
    name: 'Non-negative integers',
    formula: 'n',
    terms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  A000027: {
    name: 'Positive integers',
    formula: 'n',
    terms: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  },
  A000012: {
    name: 'Constant sequence 1',
    formula: '1',
    terms: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  A000035: {
    name: 'Period 2: 0,1',
    formula: 'n mod 2',
    terms: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
  A000108: {
    name: 'Catalan numbers',
    formula: 'C(2n,n)/(n+1)',
    terms: [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862, 16796],
  },
  A000041: {
    name: 'Partition numbers',
    formula: 'p(n)',
    terms: [1, 1, 2, 3, 5, 7, 11, 15, 22, 30, 42, 56, 77, 101, 135],
  },
  A000110: {
    name: 'Bell numbers',
    formula: 'B(n)',
    terms: [1, 1, 2, 5, 15, 52, 203, 877, 4140, 21147, 115975],
  },
  A000032: {
    name: 'Lucas numbers',
    formula: 'L(n) = L(n-1) + L(n-2)',
    terms: [2, 1, 3, 4, 7, 11, 18, 29, 47, 76, 123, 199, 322],
  },
  A001113: {
    name: 'Decimal expansion of e',
    formula: 'e digits',
    terms: [2, 7, 1, 8, 2, 8, 1, 8, 2, 8, 4, 5, 9, 0, 4],
  },
  A000796: {
    name: 'Decimal expansion of Pi',
    formula: 'Pi digits',
    terms: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9],
  },
};

// Check if sequence matches known sequence
function findKnownSequence(
  terms: number[]
): { id: string; name: string; formula: string; confidence: number }[] {
  const matches: { id: string; name: string; formula: string; confidence: number }[] = [];

  for (const [id, seq] of Object.entries(KNOWN_SEQUENCES)) {
    let matchCount = 0;
    const compareLength = Math.min(terms.length, seq.terms.length);

    // Check for direct match
    for (let i = 0; i < compareLength; i++) {
      if (terms[i] === seq.terms[i]) matchCount++;
    }

    if (matchCount >= 3 && matchCount / compareLength >= 0.9) {
      matches.push({
        id,
        name: seq.name,
        formula: seq.formula,
        confidence: matchCount / compareLength,
      });
    }

    // Check for shifted match (offset by 1)
    if (terms.length >= 3 && seq.terms.length >= 4) {
      let shiftedMatch = 0;
      for (let i = 0; i < Math.min(terms.length, seq.terms.length - 1); i++) {
        if (terms[i] === seq.terms[i + 1]) shiftedMatch++;
      }
      if (shiftedMatch >= 3 && shiftedMatch / compareLength >= 0.9) {
        matches.push({
          id,
          name: `${seq.name} (offset by 1)`,
          formula: seq.formula,
          confidence: (shiftedMatch / compareLength) * 0.95,
        });
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

// Detect arithmetic progression
function detectArithmetic(terms: number[]): {
  isArithmetic: boolean;
  firstTerm?: number;
  commonDiff?: number;
} {
  if (terms.length < 2) return { isArithmetic: false };

  const diff = terms[1] - terms[0];
  for (let i = 2; i < terms.length; i++) {
    if (terms[i] - terms[i - 1] !== diff) return { isArithmetic: false };
  }

  return { isArithmetic: true, firstTerm: terms[0], commonDiff: diff };
}

// Detect geometric progression
function detectGeometric(terms: number[]): {
  isGeometric: boolean;
  firstTerm?: number;
  commonRatio?: number;
} {
  if (terms.length < 2) return { isGeometric: false };
  if (terms.some((t) => t === 0)) return { isGeometric: false };

  const ratio = terms[1] / terms[0];
  for (let i = 2; i < terms.length; i++) {
    if (Math.abs(terms[i] / terms[i - 1] - ratio) > 1e-10) return { isGeometric: false };
  }

  return { isGeometric: true, firstTerm: terms[0], commonRatio: ratio };
}

// Compute differences (finite differences method)
function computeDifferences(terms: number[]): number[][] {
  const diffs: number[][] = [terms];

  while (diffs[diffs.length - 1].length > 1) {
    const last = diffs[diffs.length - 1];
    const newDiff: number[] = [];
    for (let i = 1; i < last.length; i++) {
      newDiff.push(last[i] - last[i - 1]);
    }
    diffs.push(newDiff);

    // Check if all zeros (polynomial detected)
    if (newDiff.every((d) => d === 0)) break;
    if (diffs.length > 10) break; // Prevent infinite loops
  }

  return diffs;
}

// Detect polynomial pattern using finite differences
function detectPolynomial(terms: number[]): {
  isPolynomial: boolean;
  degree?: number;
  coefficients?: number[];
} {
  if (terms.length < 3) return { isPolynomial: false };

  const diffs = computeDifferences(terms);

  // Find the constant difference row
  let degree = -1;
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i].every((d, _, arr) => d === arr[0])) {
      degree = i;
      break;
    }
  }

  if (degree === -1 || degree > 6) return { isPolynomial: false };

  // Reconstruct polynomial coefficients using Newton forward differences
  const coefficients: number[] = [];
  for (let i = 0; i <= degree; i++) {
    coefficients.push(diffs[i][0]);
  }

  return { isPolynomial: true, degree, coefficients };
}

// Detect recurrence relation (linear)
function detectRecurrence(
  terms: number[],
  maxOrder: number = 4
): { hasRecurrence: boolean; order?: number; coefficients?: number[] } {
  if (terms.length < 6) return { hasRecurrence: false };

  for (let order = 2; order <= Math.min(maxOrder, Math.floor(terms.length / 2)); order++) {
    // Try to find coefficients for a(n) = c1*a(n-1) + c2*a(n-2) + ... + ck*a(n-k)
    // Set up system of equations
    const equations: number[][] = [];
    const rhs: number[] = [];

    for (let i = order; i < Math.min(terms.length, order + order + 2); i++) {
      const row: number[] = [];
      for (let j = 1; j <= order; j++) {
        row.push(terms[i - j]);
      }
      equations.push(row);
      rhs.push(terms[i]);
    }

    // Solve using simple substitution for small systems
    if (order === 2 && equations.length >= 2) {
      // a(n) = c1*a(n-1) + c2*a(n-2)
      const det = equations[0][0] * equations[1][1] - equations[0][1] * equations[1][0];
      if (Math.abs(det) > 1e-10) {
        const c1 = (rhs[0] * equations[1][1] - rhs[1] * equations[0][1]) / det;
        const c2 = (equations[0][0] * rhs[1] - equations[1][0] * rhs[0]) / det;

        // Verify
        let valid = true;
        for (let i = 2; i < terms.length && valid; i++) {
          const predicted = c1 * terms[i - 1] + c2 * terms[i - 2];
          if (Math.abs(predicted - terms[i]) > 1e-6) valid = false;
        }

        if (
          valid &&
          (Number.isInteger(c1) || Math.abs(c1 - Math.round(c1)) < 1e-10) &&
          (Number.isInteger(c2) || Math.abs(c2 - Math.round(c2)) < 1e-10)
        ) {
          return {
            hasRecurrence: true,
            order: 2,
            coefficients: [Math.round(c1), Math.round(c2)],
          };
        }
      }
    }
  }

  return { hasRecurrence: false };
}

// Generate sequence from formula
function generateSequence(formula: string, start: number, count: number): number[] {
  const terms: number[] = [];

  switch (formula.toLowerCase()) {
    case 'fibonacci':
      terms.push(0, 1);
      for (let i = 2; i < count; i++) terms.push(terms[i - 1] + terms[i - 2]);
      break;
    case 'lucas':
      terms.push(2, 1);
      for (let i = 2; i < count; i++) terms.push(terms[i - 1] + terms[i - 2]);
      break;
    case 'primes':
      for (let n = 2; terms.length < count; n++) {
        let isPrime = true;
        for (let i = 2; i * i <= n; i++) {
          if (n % i === 0) {
            isPrime = false;
            break;
          }
        }
        if (isPrime) terms.push(n);
      }
      break;
    case 'triangular':
      for (let n = start; terms.length < count; n++) terms.push((n * (n + 1)) / 2);
      break;
    case 'squares':
      for (let n = start; terms.length < count; n++) terms.push(n * n);
      break;
    case 'cubes':
      for (let n = start; terms.length < count; n++) terms.push(n * n * n);
      break;
    case 'factorial':
      let fact = 1;
      terms.push(1);
      for (let n = 1; terms.length < count; n++) {
        fact *= n;
        terms.push(fact);
      }
      break;
    case 'powers_of_2':
      for (let n = 0; terms.length < count; n++) terms.push(Math.pow(2, n));
      break;
    case 'catalan':
      terms.push(1);
      for (let n = 1; terms.length < count; n++) {
        terms.push((terms[n - 1] * 2 * (2 * n - 1)) / (n + 1));
      }
      break;
    default:
      // Try to evaluate as JS expression
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('n', 'Math', `return ${formula};`);
        for (let n = start; terms.length < count; n++) {
          const val = fn(n, Math);
          if (!isFinite(val)) break;
          terms.push(Math.round(val));
        }
      } catch {
        throw new Error(`Unknown formula: ${formula}`);
      }
  }

  return terms.slice(0, count);
}

// Compute partial sums
function partialSums(terms: number[]): number[] {
  const sums: number[] = [];
  let total = 0;
  for (const t of terms) {
    total += t;
    sums.push(total);
  }
  return sums;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const sequenceAnalyzeTool: UnifiedTool = {
  name: 'sequence_analyze',
  description: `Analyze integer sequences to find patterns, formulas, and known sequences.

Available operations:
- analyze: Full analysis of a sequence (pattern detection, known sequence matching)
- differences: Compute finite differences
- generate: Generate terms of a named sequence
- partial_sums: Compute cumulative sums
- identify: Match against OEIS-like database
- extend: Predict next terms based on detected pattern

Named sequences: fibonacci, lucas, primes, triangular, squares, cubes, factorial, powers_of_2, catalan

Used in: Mathematics research, combinatorics, algorithm analysis, puzzles`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'differences', 'generate', 'partial_sums', 'identify', 'extend'],
        description: 'Sequence operation',
      },
      terms: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input sequence terms (e.g., [1, 1, 2, 3, 5, 8])',
      },
      formula: {
        type: 'string',
        description: 'Named formula or JS expression with n (for generate)',
      },
      count: {
        type: 'number',
        description: 'Number of terms to generate (default: 15)',
      },
      start: {
        type: 'number',
        description: 'Starting index for generation (default: 0)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSequenceAnalyzeAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeSequenceAnalyze(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    terms?: number[];
    formula?: string;
    count?: number;
    start?: number;
  };

  const { operation, terms = [], formula, count = 15, start = 0 } = args;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'analyze': {
        if (terms.length < 3) throw new Error('Need at least 3 terms for analysis');

        result.input_terms = terms;
        result.length = terms.length;

        // Check arithmetic progression
        const arithmetic = detectArithmetic(terms);
        if (arithmetic.isArithmetic) {
          result.pattern = 'arithmetic_progression';
          result.arithmetic = arithmetic;
        }

        // Check geometric progression
        const geometric = detectGeometric(terms);
        if (geometric.isGeometric) {
          result.pattern = result.pattern || 'geometric_progression';
          result.geometric = geometric;
        }

        // Check polynomial pattern
        const polynomial = detectPolynomial(terms);
        if (polynomial.isPolynomial) {
          result.pattern = result.pattern || 'polynomial';
          result.polynomial = {
            degree: polynomial.degree,
            newton_coefficients: polynomial.coefficients,
            note: 'Coefficients are Newton forward difference coefficients',
          };
        }

        // Check recurrence relation
        const recurrence = detectRecurrence(terms);
        if (recurrence.hasRecurrence) {
          result.pattern = result.pattern || 'linear_recurrence';
          result.recurrence = {
            order: recurrence.order,
            coefficients: recurrence.coefficients,
            formula: `a(n) = ${recurrence.coefficients?.map((c, i) => `${c}*a(n-${i + 1})`).join(' + ')}`,
          };
        }

        // Match against known sequences
        const known = findKnownSequence(terms);
        if (known.length > 0) {
          result.known_sequences = known.slice(0, 5);
        }

        // Compute differences
        result.differences = computeDifferences(terms).slice(0, 5);

        // Basic statistics
        result.statistics = {
          sum: terms.reduce((a, b) => a + b, 0),
          min: Math.min(...terms),
          max: Math.max(...terms),
          mean: terms.reduce((a, b) => a + b, 0) / terms.length,
        };

        if (!result.pattern) {
          result.pattern = 'no_simple_pattern_detected';
        }
        break;
      }

      case 'differences': {
        if (terms.length < 2) throw new Error('Need at least 2 terms');

        const diffs = computeDifferences(terms);
        result.input_terms = terms;
        result.difference_table = diffs;

        const constantRow = diffs.findIndex((row) => row.every((d, _, arr) => d === arr[0]));
        if (constantRow >= 0) {
          result.polynomial_degree = constantRow;
          result.constant_value = diffs[constantRow][0];
        }
        break;
      }

      case 'generate': {
        if (!formula) throw new Error('formula is required');

        const generated = generateSequence(formula, start, count);
        result.formula = formula;
        result.start_index = start;
        result.terms = generated;
        result.count = generated.length;
        break;
      }

      case 'partial_sums': {
        if (terms.length < 1) throw new Error('Need at least 1 term');

        result.input_terms = terms;
        result.partial_sums = partialSums(terms);
        result.total = partialSums(terms).slice(-1)[0];
        break;
      }

      case 'identify': {
        if (terms.length < 3) throw new Error('Need at least 3 terms');

        const matches = findKnownSequence(terms);
        result.input_terms = terms;
        result.matches = matches;
        result.best_match = matches.length > 0 ? matches[0] : null;
        result.note =
          matches.length === 0
            ? 'No known sequence matched. Try OEIS.org for more comprehensive search.'
            : `Found ${matches.length} potential matches`;
        break;
      }

      case 'extend': {
        if (terms.length < 3) throw new Error('Need at least 3 terms');

        const predictions: { method: string; next_terms: number[] }[] = [];

        // Try arithmetic extension
        const arith = detectArithmetic(terms);
        if (arith.isArithmetic && arith.commonDiff !== undefined) {
          const nextTerms: number[] = [];
          let last = terms[terms.length - 1];
          for (let i = 0; i < 5; i++) {
            last += arith.commonDiff;
            nextTerms.push(last);
          }
          predictions.push({ method: 'arithmetic', next_terms: nextTerms });
        }

        // Try geometric extension
        const geom = detectGeometric(terms);
        if (geom.isGeometric && geom.commonRatio !== undefined) {
          const nextTerms: number[] = [];
          let last = terms[terms.length - 1];
          for (let i = 0; i < 5; i++) {
            last *= geom.commonRatio;
            nextTerms.push(Math.round(last));
          }
          predictions.push({ method: 'geometric', next_terms: nextTerms });
        }

        // Try recurrence extension
        const rec = detectRecurrence(terms);
        if (rec.hasRecurrence && rec.coefficients) {
          const nextTerms: number[] = [];
          const workingTerms = [...terms];
          for (let i = 0; i < 5; i++) {
            let next = 0;
            for (let j = 0; j < rec.coefficients.length; j++) {
              next += rec.coefficients[j] * workingTerms[workingTerms.length - 1 - j];
            }
            workingTerms.push(Math.round(next));
            nextTerms.push(Math.round(next));
          }
          predictions.push({ method: 'linear_recurrence', next_terms: nextTerms });
        }

        // Try polynomial extension using differences
        const poly = detectPolynomial(terms);
        if (poly.isPolynomial && poly.coefficients) {
          const diffs = computeDifferences(terms);
          const nextTerms: number[] = [];
          const workingDiffs = diffs.map((row) => [...row]);

          for (let i = 0; i < 5; i++) {
            // Extend each difference row
            for (let d = workingDiffs.length - 1; d >= 0; d--) {
              if (d === workingDiffs.length - 1) {
                // Constant row - just repeat
                workingDiffs[d].push(workingDiffs[d][0]);
              } else {
                // Add previous difference
                const lastIdx = workingDiffs[d].length - 1;
                workingDiffs[d].push(workingDiffs[d][lastIdx] + workingDiffs[d + 1][lastIdx]);
              }
            }
            nextTerms.push(workingDiffs[0][workingDiffs[0].length - 1]);
          }
          predictions.push({ method: 'polynomial_differences', next_terms: nextTerms });
        }

        result.input_terms = terms;
        result.predictions = predictions;
        result.best_prediction = predictions.length > 0 ? predictions[0] : null;
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
