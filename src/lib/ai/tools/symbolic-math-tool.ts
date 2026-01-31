/**
 * SYMBOLIC MATH TOOL (Computer Algebra System)
 *
 * Symbolic mathematics using nerdamer.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Symbolic differentiation and integration
 * - Equation solving (algebraic, systems)
 * - Expression simplification
 * - Polynomial operations
 * - Trigonometric identities
 * - Limits and series expansion
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nerdamer: any = null;

async function initNerdamer(): Promise<boolean> {
  if (nerdamer) return true;
  try {
    const mod = await import('nerdamer');
    // Load all nerdamer modules
    await import('nerdamer/Algebra');
    await import('nerdamer/Calculus');
    await import('nerdamer/Solve');
    nerdamer = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const symbolicMathTool: UnifiedTool = {
  name: 'symbolic_math',
  description: `Perform symbolic mathematics (Computer Algebra System).

Operations:
- simplify: Simplify algebraic expressions
- expand: Expand expressions (distribute, FOIL)
- factor: Factor polynomials
- differentiate: Symbolic differentiation (d/dx)
- integrate: Symbolic integration (∫)
- solve: Solve equations for a variable
- solve_system: Solve systems of equations
- evaluate: Evaluate expression with variable values
- limit: Calculate limits
- series: Taylor/Maclaurin series expansion

Use cases:
- Calculus homework and verification
- Engineering formula manipulation
- Scientific equation solving
- Mathematical proofs and simplification`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'simplify',
          'expand',
          'factor',
          'differentiate',
          'integrate',
          'solve',
          'solve_system',
          'evaluate',
          'limit',
          'series',
        ],
        description: 'Symbolic math operation',
      },
      expression: {
        type: 'string',
        description: 'Mathematical expression (e.g., "x^2 + 2*x + 1", "sin(x)^2 + cos(x)^2")',
      },
      variable: {
        type: 'string',
        description: 'Variable for differentiation/integration/solving (default: x)',
      },
      equations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of equations for solve_system',
      },
      values: {
        type: 'object',
        description: 'Variable values for evaluation: {x: 2, y: 3}',
      },
      point: {
        type: 'number',
        description: 'Point for limit or series expansion',
      },
      order: {
        type: 'number',
        description: 'Order for series expansion (default: 5)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSymbolicMathAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeSymbolicMath(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    expression?: string;
    variable?: string;
    equations?: string[];
    values?: Record<string, number>;
    point?: number;
    order?: number;
  };

  const { operation, expression, variable = 'x', equations, values, point = 0, order = 5 } = args;

  try {
    const initialized = await initNerdamer();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize nerdamer library' }),
        isError: true,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simplify': {
        if (!expression) throw new Error('Expression required for simplify');
        result = {
          operation: 'simplify',
          input: expression,
          result: nerdamer(expression).toString(),
          latex: nerdamer(expression).toTeX(),
        };
        break;
      }

      case 'expand': {
        if (!expression) throw new Error('Expression required for expand');
        const expanded = nerdamer.expand(expression);
        result = {
          operation: 'expand',
          input: expression,
          result: expanded.toString(),
          latex: expanded.toTeX(),
        };
        break;
      }

      case 'factor': {
        if (!expression) throw new Error('Expression required for factor');
        const factored = nerdamer.factor(expression);
        result = {
          operation: 'factor',
          input: expression,
          result: factored.toString(),
          latex: factored.toTeX(),
        };
        break;
      }

      case 'differentiate': {
        if (!expression) throw new Error('Expression required for differentiate');
        const derivative = nerdamer.diff(expression, variable);
        result = {
          operation: 'differentiate',
          input: expression,
          variable,
          derivative: derivative.toString(),
          latex: derivative.toTeX(),
          notation: `d/d${variable}(${expression}) = ${derivative.toString()}`,
        };
        break;
      }

      case 'integrate': {
        if (!expression) throw new Error('Expression required for integrate');
        const integral = nerdamer.integrate(expression, variable);
        result = {
          operation: 'integrate',
          input: expression,
          variable,
          integral: integral.toString(),
          latex: integral.toTeX(),
          notation: `∫${expression} d${variable} = ${integral.toString()} + C`,
        };
        break;
      }

      case 'solve': {
        if (!expression) throw new Error('Expression/equation required for solve');
        const solutions = nerdamer.solve(expression, variable);
        result = {
          operation: 'solve',
          equation: expression,
          variable,
          solutions: solutions.toString(),
          solutionArray: solutions.symbol
            ? [solutions.toString()]
            : solutions.toString().split(','),
        };
        break;
      }

      case 'solve_system': {
        if (!equations || equations.length < 2) {
          throw new Error('At least 2 equations required for solve_system');
        }
        const systemSolutions = nerdamer.solveEquations(equations);
        result = {
          operation: 'solve_system',
          equations,
          solutions: systemSolutions,
        };
        break;
      }

      case 'evaluate': {
        if (!expression) throw new Error('Expression required for evaluate');
        if (!values) throw new Error('Values required for evaluation');
        let evaluated = nerdamer(expression);
        for (const [varName, varValue] of Object.entries(values)) {
          evaluated = evaluated.evaluate({ [varName]: varValue });
        }
        result = {
          operation: 'evaluate',
          expression,
          values,
          result: evaluated.toString(),
          numeric: parseFloat(evaluated.text()),
        };
        break;
      }

      case 'limit': {
        if (!expression) throw new Error('Expression required for limit');
        // Nerdamer doesn't have built-in limits, approximate numerically
        const epsilon = 1e-10;
        const leftVal = nerdamer(expression).evaluate({ [variable]: point - epsilon });
        const rightVal = nerdamer(expression).evaluate({ [variable]: point + epsilon });
        result = {
          operation: 'limit',
          expression,
          variable,
          point,
          leftLimit: parseFloat(leftVal.text()),
          rightLimit: parseFloat(rightVal.text()),
          limit: (parseFloat(leftVal.text()) + parseFloat(rightVal.text())) / 2,
          notation: `lim(${variable}→${point}) ${expression}`,
        };
        break;
      }

      case 'series': {
        if (!expression) throw new Error('Expression required for series');
        // Taylor series expansion using differentiation
        const terms: string[] = [];
        let factorial = 1;
        for (let n = 0; n <= order; n++) {
          let deriv = nerdamer(expression);
          for (let i = 0; i < n; i++) {
            deriv = nerdamer.diff(deriv.toString(), variable);
          }
          const coeff = deriv.evaluate({ [variable]: point });
          if (n > 0) factorial *= n;
          const coeffVal = parseFloat(coeff.text()) / factorial;
          if (Math.abs(coeffVal) > 1e-10) {
            if (n === 0) {
              terms.push(coeffVal.toFixed(6));
            } else if (n === 1) {
              terms.push(`${coeffVal.toFixed(6)}*(${variable}-${point})`);
            } else {
              terms.push(`${coeffVal.toFixed(6)}*(${variable}-${point})^${n}`);
            }
          }
        }
        result = {
          operation: 'series',
          expression,
          variable,
          point,
          order,
          series: terms.join(' + '),
          terms,
        };
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
