/**
 * COMPLEX NUMBERS TOOL
 *
 * Complex number arithmetic and operations using complex.js.
 * Runs entirely locally - no external API costs.
 *
 * Operations:
 * - Basic arithmetic (+, -, *, /)
 * - Powers and roots
 * - Trigonometric and hyperbolic functions
 * - Exponential and logarithmic functions
 * - Polar form conversion
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Complex: any = null;

async function initComplex(): Promise<boolean> {
  if (Complex) return true;
  try {
    const mod = await import('complex.js');
    Complex = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const complexMathTool: UnifiedTool = {
  name: 'complex_math',
  description: `Perform complex number operations and calculations.

Operations available:
- Arithmetic: add, subtract, multiply, divide, negate, conjugate
- Powers: pow, sqrt, exp, log, log10
- Trigonometric: sin, cos, tan, asin, acos, atan
- Hyperbolic: sinh, cosh, tanh, asinh, acosh, atanh
- Conversion: toPolar, fromPolar, abs, arg
- Roots: nthRoots (find all n roots of unity)

Complex numbers can be specified as:
- Object: { re: 3, im: 4 }
- String: "3+4i" or "3-4i"
- Array: [3, 4]

Used in: Electrical engineering, quantum mechanics, signal processing, control systems`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'add',
          'subtract',
          'multiply',
          'divide',
          'negate',
          'conjugate',
          'pow',
          'sqrt',
          'exp',
          'log',
          'log10',
          'sin',
          'cos',
          'tan',
          'asin',
          'acos',
          'atan',
          'sinh',
          'cosh',
          'tanh',
          'asinh',
          'acosh',
          'atanh',
          'abs',
          'arg',
          'toPolar',
          'fromPolar',
          'nthRoots',
        ],
        description: 'Operation to perform',
      },
      z1: {
        type: 'object',
        description: 'First complex number: {re: number, im: number} or "a+bi" string or [a, b]',
      },
      z2: {
        type: 'object',
        description: 'Second complex number (for binary operations)',
      },
      n: {
        type: 'number',
        description: 'Exponent for pow, or number of roots for nthRoots',
      },
      r: {
        type: 'number',
        description: 'Magnitude for fromPolar',
      },
      phi: {
        type: 'number',
        description: 'Phase angle in radians for fromPolar',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isComplexMathAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeComplexMath(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    z1?: { re: number; im: number } | string | number[];
    z2?: { re: number; im: number } | string | number[];
    n?: number;
    r?: number;
    phi?: number;
  };

  const { operation, z1, z2, n, r, phi } = args;

  try {
    const initialized = await initComplex();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize complex.js library' }),
        isError: true,
      };
    }

    // Parse complex numbers
    const parseComplex = (z: { re: number; im: number } | string | number[] | undefined) => {
      if (!z) return null;
      if (Array.isArray(z)) return new Complex(z[0], z[1]);
      if (typeof z === 'object' && 're' in z) return new Complex(z.re, z.im || 0);
      return new Complex(z);
    };

    const c1 = parseComplex(z1);
    const c2 = parseComplex(z2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    let resultType = 'complex';

    switch (operation) {
      // Arithmetic
      case 'add':
        if (!c1 || !c2) throw new Error('add requires z1 and z2');
        result = c1.add(c2);
        break;
      case 'subtract':
        if (!c1 || !c2) throw new Error('subtract requires z1 and z2');
        result = c1.sub(c2);
        break;
      case 'multiply':
        if (!c1 || !c2) throw new Error('multiply requires z1 and z2');
        result = c1.mul(c2);
        break;
      case 'divide':
        if (!c1 || !c2) throw new Error('divide requires z1 and z2');
        result = c1.div(c2);
        break;
      case 'negate':
        if (!c1) throw new Error('negate requires z1');
        result = c1.neg();
        break;
      case 'conjugate':
        if (!c1) throw new Error('conjugate requires z1');
        result = c1.conjugate();
        break;

      // Powers and exponentials
      case 'pow':
        if (!c1) throw new Error('pow requires z1');
        result = c1.pow(c2 || n || 2);
        break;
      case 'sqrt':
        if (!c1) throw new Error('sqrt requires z1');
        result = c1.sqrt();
        break;
      case 'exp':
        if (!c1) throw new Error('exp requires z1');
        result = c1.exp();
        break;
      case 'log':
        if (!c1) throw new Error('log requires z1');
        result = c1.log();
        break;
      case 'log10':
        if (!c1) throw new Error('log10 requires z1');
        result = c1.log().div(new Complex(Math.LN10, 0));
        break;

      // Trigonometric
      case 'sin':
        if (!c1) throw new Error('sin requires z1');
        result = c1.sin();
        break;
      case 'cos':
        if (!c1) throw new Error('cos requires z1');
        result = c1.cos();
        break;
      case 'tan':
        if (!c1) throw new Error('tan requires z1');
        result = c1.tan();
        break;
      case 'asin':
        if (!c1) throw new Error('asin requires z1');
        result = c1.asin();
        break;
      case 'acos':
        if (!c1) throw new Error('acos requires z1');
        result = c1.acos();
        break;
      case 'atan':
        if (!c1) throw new Error('atan requires z1');
        result = c1.atan();
        break;

      // Hyperbolic
      case 'sinh':
        if (!c1) throw new Error('sinh requires z1');
        result = c1.sinh();
        break;
      case 'cosh':
        if (!c1) throw new Error('cosh requires z1');
        result = c1.cosh();
        break;
      case 'tanh':
        if (!c1) throw new Error('tanh requires z1');
        result = c1.tanh();
        break;
      case 'asinh':
        if (!c1) throw new Error('asinh requires z1');
        result = c1.asinh();
        break;
      case 'acosh':
        if (!c1) throw new Error('acosh requires z1');
        result = c1.acosh();
        break;
      case 'atanh':
        if (!c1) throw new Error('atanh requires z1');
        result = c1.atanh();
        break;

      // Conversion and properties
      case 'abs':
        if (!c1) throw new Error('abs requires z1');
        result = c1.abs();
        resultType = 'real';
        break;
      case 'arg':
        if (!c1) throw new Error('arg requires z1');
        result = c1.arg();
        resultType = 'real';
        break;
      case 'toPolar':
        if (!c1) throw new Error('toPolar requires z1');
        result = { r: c1.abs(), phi: c1.arg(), phi_degrees: (c1.arg() * 180) / Math.PI };
        resultType = 'polar';
        break;
      case 'fromPolar':
        if (r === undefined || phi === undefined) throw new Error('fromPolar requires r and phi');
        result = Complex.fromPolar(r, phi);
        break;

      // Find all n-th roots
      case 'nthRoots': {
        if (!c1) throw new Error('nthRoots requires z1');
        const rootN = n || 2;
        const magnitude = Math.pow(c1.abs(), 1 / rootN);
        const baseArg = c1.arg() / rootN;
        const roots = [];
        for (let k = 0; k < rootN; k++) {
          const angle = baseArg + (2 * Math.PI * k) / rootN;
          roots.push({
            re: magnitude * Math.cos(angle),
            im: magnitude * Math.sin(angle),
            polar: { r: magnitude, phi: angle },
          });
        }
        result = roots;
        resultType = 'roots';
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Format output
    let output: Record<string, unknown>;

    if (resultType === 'real') {
      output = { result, operation, type: 'real' };
    } else if (resultType === 'polar') {
      output = { result, operation, type: 'polar' };
    } else if (resultType === 'roots') {
      output = { roots: result, operation, n: n || 2, type: 'array' };
    } else {
      output = {
        result: {
          re: result.re,
          im: result.im,
          string: result.toString(),
          magnitude: result.abs(),
          phase: result.arg(),
          phase_degrees: (result.arg() * 180) / Math.PI,
        },
        operation,
        type: 'complex',
      };
    }

    if (c1) {
      output.input = { z1: { re: c1.re, im: c1.im } };
      if (c2) {
        (output.input as Record<string, unknown>).z2 = { re: c2.re, im: c2.im };
      }
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(output, null, 2),
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
