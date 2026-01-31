/**
 * POLYNOMIAL OPERATIONS TOOL
 *
 * Polynomial arithmetic, evaluation, and root finding.
 * Runs entirely locally - no external API costs.
 *
 * Operations:
 * - Arithmetic: add, subtract, multiply, divide
 * - Evaluation and derivatives
 * - Root finding (Newton's method, companion matrix)
 * - Interpolation (Lagrange)
 * - GCD of polynomials
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Polynomial is represented as array of coefficients [a0, a1, a2, ...] for a0 + a1*x + a2*x^2 + ...

// Remove trailing zeros
function trimPoly(p: number[]): number[] {
  const result = [...p];
  while (result.length > 1 && Math.abs(result[result.length - 1]) < 1e-15) {
    result.pop();
  }
  return result;
}

// Evaluate polynomial at x using Horner's method
function evaluate(poly: number[], x: number): number {
  let result = 0;
  for (let i = poly.length - 1; i >= 0; i--) {
    result = result * x + poly[i];
  }
  return result;
}

// Polynomial addition
function add(p1: number[], p2: number[]): number[] {
  const maxLen = Math.max(p1.length, p2.length);
  const result = new Array(maxLen).fill(0);
  for (let i = 0; i < p1.length; i++) result[i] += p1[i];
  for (let i = 0; i < p2.length; i++) result[i] += p2[i];
  return trimPoly(result);
}

// Polynomial subtraction
function subtract(p1: number[], p2: number[]): number[] {
  const maxLen = Math.max(p1.length, p2.length);
  const result = new Array(maxLen).fill(0);
  for (let i = 0; i < p1.length; i++) result[i] += p1[i];
  for (let i = 0; i < p2.length; i++) result[i] -= p2[i];
  return trimPoly(result);
}

// Polynomial multiplication
function multiply(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] += p1[i] * p2[j];
    }
  }
  return trimPoly(result);
}

// Polynomial division - returns [quotient, remainder]
function divide(dividend: number[], divisor: number[]): [number[], number[]] {
  divisor = trimPoly(divisor);
  if (divisor.length === 1 && divisor[0] === 0) {
    throw new Error('Division by zero polynomial');
  }

  let remainder = [...dividend];
  const quotient: number[] = [];

  while (remainder.length >= divisor.length) {
    const coeff = remainder[remainder.length - 1] / divisor[divisor.length - 1];
    const degDiff = remainder.length - divisor.length;
    quotient[degDiff] = coeff;

    for (let i = 0; i < divisor.length; i++) {
      remainder[degDiff + i] -= coeff * divisor[i];
    }
    remainder = trimPoly(remainder);
  }

  // Fill in zeros for quotient
  for (let i = 0; i < quotient.length; i++) {
    if (quotient[i] === undefined) quotient[i] = 0;
  }

  return [trimPoly(quotient), trimPoly(remainder)];
}

// Polynomial derivative
function derivative(poly: number[]): number[] {
  if (poly.length <= 1) return [0];
  const result: number[] = [];
  for (let i = 1; i < poly.length; i++) {
    result.push(i * poly[i]);
  }
  return trimPoly(result);
}

// Polynomial integral (indefinite, C = 0)
function integral(poly: number[]): number[] {
  const result = [0];
  for (let i = 0; i < poly.length; i++) {
    result.push(poly[i] / (i + 1));
  }
  return result;
}

// Definite integral from a to b
function definiteIntegral(poly: number[], a: number, b: number): number {
  const antiderivative = integral(poly);
  return evaluate(antiderivative, b) - evaluate(antiderivative, a);
}

// GCD of two polynomials using Euclidean algorithm
function gcd(p1: number[], p2: number[]): number[] {
  p1 = trimPoly(p1);
  p2 = trimPoly(p2);

  while (p2.length > 1 || (p2.length === 1 && Math.abs(p2[0]) > 1e-10)) {
    const [, remainder] = divide(p1, p2);
    p1 = p2;
    p2 = remainder;
  }

  // Normalize (make leading coefficient 1)
  const lead = p1[p1.length - 1];
  return p1.map((c) => c / lead);
}

// Find roots using Newton-Raphson (for real roots)
function findRootsNewton(poly: number[], maxRoots: number = 10): number[] {
  const roots: number[] = [];
  let currentPoly = [...poly];
  const deriv = derivative(poly);

  for (let i = 0; i < maxRoots && currentPoly.length > 1; i++) {
    // Try multiple starting points
    let root: number | null = null;

    for (const x0 of [-10, -5, -2, -1, -0.5, 0, 0.5, 1, 2, 5, 10]) {
      let x = x0;
      let converged = false;

      for (let iter = 0; iter < 100; iter++) {
        const fx = evaluate(currentPoly, x);
        const dfx = evaluate(deriv, x);

        if (Math.abs(dfx) < 1e-15) break;

        const xNew = x - fx / dfx;
        if (Math.abs(xNew - x) < 1e-10 && Math.abs(fx) < 1e-8) {
          converged = true;
          x = xNew;
          break;
        }
        x = xNew;
      }

      if (converged && !roots.some((r) => Math.abs(r - x) < 1e-6)) {
        root = x;
        break;
      }
    }

    if (root === null) break;

    roots.push(root);

    // Deflate: divide by (x - root)
    const [quotient] = divide(currentPoly, [-root, 1]);
    currentPoly = quotient;
  }

  return roots.sort((a, b) => a - b);
}

// Convert polynomial to string
function polyToString(poly: number[]): string {
  if (poly.length === 0 || (poly.length === 1 && poly[0] === 0)) return '0';

  const terms: string[] = [];
  for (let i = poly.length - 1; i >= 0; i--) {
    const coeff = poly[i];
    if (Math.abs(coeff) < 1e-15) continue;

    let term = '';
    const absCoeff = Math.abs(coeff);
    const sign = coeff >= 0 ? '+' : '-';

    if (i === 0) {
      term = absCoeff.toString();
    } else if (absCoeff === 1) {
      term = i === 1 ? 'x' : `x^${i}`;
    } else {
      term = i === 1 ? `${absCoeff}x` : `${absCoeff}x^${i}`;
    }

    if (terms.length === 0) {
      terms.push(coeff < 0 ? `-${term}` : term);
    } else {
      terms.push(`${sign} ${term}`);
    }
  }

  return terms.join(' ') || '0';
}

// Create polynomial from roots
function fromRoots(roots: number[]): number[] {
  let result = [1];
  for (const r of roots) {
    result = multiply(result, [-r, 1]);
  }
  return result;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const polynomialOpsTool: UnifiedTool = {
  name: 'polynomial_ops',
  description: `Perform operations on polynomials.

Polynomials are represented as coefficient arrays [a0, a1, a2, ...] for a0 + a1*x + a2*x² + ...
Example: [1, 0, -1] represents 1 - x² (or -x² + 1)

Operations:
- evaluate: Evaluate p(x) at a point
- add, subtract, multiply, divide: Arithmetic operations
- derivative, integral: Calculus operations
- definite_integral: ∫[a,b] p(x) dx
- find_roots: Find real roots using Newton's method
- from_roots: Create polynomial from its roots
- gcd: Greatest common divisor of two polynomials
- to_string: Pretty print polynomial

Used in: Control systems, signal processing, numerical analysis`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'evaluate',
          'add',
          'subtract',
          'multiply',
          'divide',
          'derivative',
          'integral',
          'definite_integral',
          'find_roots',
          'from_roots',
          'gcd',
          'to_string',
        ],
        description: 'Operation to perform',
      },
      poly: {
        type: 'array',
        items: { type: 'number' },
        description: 'Polynomial coefficients [a0, a1, a2, ...] for a0 + a1*x + a2*x² + ...',
      },
      poly2: {
        type: 'array',
        items: { type: 'number' },
        description: 'Second polynomial (for binary operations)',
      },
      x: {
        type: 'number',
        description: 'Value to evaluate at',
      },
      a: {
        type: 'number',
        description: 'Lower bound (for definite integral)',
      },
      b: {
        type: 'number',
        description: 'Upper bound (for definite integral)',
      },
      roots: {
        type: 'array',
        items: { type: 'number' },
        description: 'Roots to create polynomial from',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPolynomialOpsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executePolynomialOps(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    poly?: number[];
    poly2?: number[];
    x?: number;
    a?: number;
    b?: number;
    roots?: number[];
  };

  const { operation, poly, poly2, x, a, b, roots } = args;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'evaluate':
        if (!poly || x === undefined) throw new Error('poly and x required for evaluate');
        result.value = evaluate(poly, x);
        result.polynomial = polyToString(poly);
        result.x = x;
        break;

      case 'add':
        if (!poly || !poly2) throw new Error('poly and poly2 required');
        result.result = add(poly, poly2);
        result.result_string = polyToString(result.result as number[]);
        break;

      case 'subtract':
        if (!poly || !poly2) throw new Error('poly and poly2 required');
        result.result = subtract(poly, poly2);
        result.result_string = polyToString(result.result as number[]);
        break;

      case 'multiply':
        if (!poly || !poly2) throw new Error('poly and poly2 required');
        result.result = multiply(poly, poly2);
        result.result_string = polyToString(result.result as number[]);
        break;

      case 'divide':
        if (!poly || !poly2) throw new Error('poly and poly2 required');
        const [quotient, remainder] = divide(poly, poly2);
        result.quotient = quotient;
        result.remainder = remainder;
        result.quotient_string = polyToString(quotient);
        result.remainder_string = polyToString(remainder);
        break;

      case 'derivative':
        if (!poly) throw new Error('poly required');
        result.derivative = derivative(poly);
        result.original = polyToString(poly);
        result.derivative_string = polyToString(result.derivative as number[]);
        break;

      case 'integral':
        if (!poly) throw new Error('poly required');
        result.integral = integral(poly);
        result.original = polyToString(poly);
        result.integral_string = polyToString(result.integral as number[]) + ' + C';
        break;

      case 'definite_integral':
        if (!poly || a === undefined || b === undefined) {
          throw new Error('poly, a, and b required for definite_integral');
        }
        result.value = definiteIntegral(poly, a, b);
        result.polynomial = polyToString(poly);
        result.bounds = { a, b };
        result.expression = `∫[${a},${b}] (${polyToString(poly)}) dx`;
        break;

      case 'find_roots':
        if (!poly) throw new Error('poly required');
        const foundRoots = findRootsNewton(poly);
        result.roots = foundRoots;
        result.polynomial = polyToString(poly);
        result.degree = poly.length - 1;
        // Verify roots
        result.verification = foundRoots.map((r) => ({
          root: r,
          p_of_root: evaluate(poly, r),
        }));
        break;

      case 'from_roots':
        if (!roots) throw new Error('roots required');
        const polyFromRoots = fromRoots(roots);
        result.polynomial = polyFromRoots;
        result.polynomial_string = polyToString(polyFromRoots);
        result.roots = roots;
        break;

      case 'gcd':
        if (!poly || !poly2) throw new Error('poly and poly2 required');
        result.gcd = gcd(poly, poly2);
        result.gcd_string = polyToString(result.gcd as number[]);
        break;

      case 'to_string':
        if (!poly) throw new Error('poly required');
        result.string = polyToString(poly);
        result.coefficients = poly;
        result.degree = poly.length - 1;
        break;

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
