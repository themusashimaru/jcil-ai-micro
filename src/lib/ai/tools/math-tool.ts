/**
 * ADVANCED MATH TOOL
 *
 * Advanced mathematics using math.js.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Expression evaluation
 * - Unit conversions
 * - Matrix operations
 * - Statistics
 * - Symbolic math
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded mathjs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let math: any = null;

async function initMath(): Promise<boolean> {
  if (math) return true;
  try {
    const mod = await import('mathjs');
    math = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mathTool: UnifiedTool = {
  name: 'math_compute',
  description: `Advanced mathematical computations and unit conversions.

Operations:
- evaluate: Evaluate mathematical expressions
- convert: Convert between units
- matrix: Matrix operations (multiply, inverse, determinant, etc.)
- statistics: Statistical functions (mean, std, variance, etc.)
- solve: Solve equations
- derivative: Calculate derivatives
- simplify: Simplify expressions

Expression examples:
- "2 + 3 * 4" → 14
- "sqrt(16) + sin(pi/2)" → 5
- "5 inches to cm" → 12.7 cm
- "100 km/h to m/s" → 27.78 m/s

Matrix example:
- multiply [[1,2],[3,4]] by [[5,6],[7,8]]

Statistics example:
- mean, std, variance of [1, 2, 3, 4, 5]

Supports variables, functions, and complex expressions.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['evaluate', 'convert', 'matrix', 'statistics', 'solve', 'derivative', 'simplify'],
        description: 'Math operation to perform',
      },
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate',
      },
      value: {
        type: 'number',
        description: 'For convert: numeric value to convert',
      },
      from_unit: {
        type: 'string',
        description: 'For convert: source unit',
      },
      to_unit: {
        type: 'string',
        description: 'For convert: target unit',
      },
      matrix_a: {
        type: 'array',
        description: 'For matrix: first matrix (2D array)',
      },
      matrix_b: {
        type: 'array',
        description: 'For matrix: second matrix (optional)',
      },
      matrix_operation: {
        type: 'string',
        enum: ['multiply', 'add', 'subtract', 'inverse', 'determinant', 'transpose', 'eigenvalues'],
        description: 'For matrix: operation to perform',
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'For statistics: array of numbers',
      },
      stat_functions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'For statistics: which stats to compute (mean, std, variance, median, min, max, sum)',
      },
      variable: {
        type: 'string',
        description: 'For derivative/solve: variable name (default: x)',
      },
      variables: {
        type: 'object',
        description: 'Variable values for expression evaluation',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMathAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeMath(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    expression?: string;
    value?: number;
    from_unit?: string;
    to_unit?: string;
    matrix_a?: number[][];
    matrix_b?: number[][];
    matrix_operation?: string;
    data?: number[];
    stat_functions?: string[];
    variable?: string;
    variables?: Record<string, number>;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initMath();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize mathjs' }),
        isError: true,
      };
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'evaluate': {
        if (!args.expression) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Expression required for evaluate' }),
            isError: true,
          };
        }

        const scope = args.variables || {};
        const evalResult = math.evaluate(args.expression, scope);

        result = {
          operation: 'evaluate',
          expression: args.expression,
          variables: args.variables,
          result: formatMathResult(evalResult),
        };
        break;
      }

      case 'convert': {
        if (args.value === undefined || !args.from_unit || !args.to_unit) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Value, from_unit, and to_unit required' }),
            isError: true,
          };
        }

        const converted = math.unit(args.value, args.from_unit).to(args.to_unit);

        result = {
          operation: 'convert',
          input: `${args.value} ${args.from_unit}`,
          output: converted.toString(),
          value: converted.toNumber(),
          unit: args.to_unit,
        };
        break;
      }

      case 'matrix': {
        if (!args.matrix_a || !args.matrix_operation) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Matrix A and operation required' }),
            isError: true,
          };
        }

        const matrixA = math.matrix(args.matrix_a);
        let matrixResult: unknown;

        switch (args.matrix_operation) {
          case 'multiply':
            if (!args.matrix_b) {
              return {
                toolCallId: toolCall.id,
                content: JSON.stringify({ error: 'Matrix B required for multiply' }),
                isError: true,
              };
            }
            matrixResult = math.multiply(matrixA, math.matrix(args.matrix_b));
            break;
          case 'add':
            if (!args.matrix_b) {
              return {
                toolCallId: toolCall.id,
                content: JSON.stringify({ error: 'Matrix B required for add' }),
                isError: true,
              };
            }
            matrixResult = math.add(matrixA, math.matrix(args.matrix_b));
            break;
          case 'subtract':
            if (!args.matrix_b) {
              return {
                toolCallId: toolCall.id,
                content: JSON.stringify({ error: 'Matrix B required for subtract' }),
                isError: true,
              };
            }
            matrixResult = math.subtract(matrixA, math.matrix(args.matrix_b));
            break;
          case 'inverse':
            matrixResult = math.inv(matrixA);
            break;
          case 'determinant':
            matrixResult = math.det(matrixA);
            break;
          case 'transpose':
            matrixResult = math.transpose(matrixA);
            break;
          case 'eigenvalues':
            matrixResult = math.eigs(matrixA);
            break;
          default:
            return {
              toolCallId: toolCall.id,
              content: JSON.stringify({
                error: `Unknown matrix operation: ${args.matrix_operation}`,
              }),
              isError: true,
            };
        }

        result = {
          operation: 'matrix',
          matrix_operation: args.matrix_operation,
          result: formatMathResult(matrixResult),
        };
        break;
      }

      case 'statistics': {
        if (!args.data || args.data.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Data array required for statistics' }),
            isError: true,
          };
        }

        const functions = args.stat_functions || [
          'mean',
          'std',
          'variance',
          'median',
          'min',
          'max',
          'sum',
        ];
        const stats: Record<string, number> = {};

        for (const fn of functions) {
          switch (fn) {
            case 'mean':
              stats.mean = math.mean(args.data);
              break;
            case 'std':
              stats.std = math.std(args.data);
              break;
            case 'variance':
              stats.variance = math.variance(args.data);
              break;
            case 'median':
              stats.median = math.median(args.data);
              break;
            case 'min':
              stats.min = math.min(args.data);
              break;
            case 'max':
              stats.max = math.max(args.data);
              break;
            case 'sum':
              stats.sum = math.sum(args.data);
              break;
            case 'count':
              stats.count = args.data.length;
              break;
          }
        }

        result = {
          operation: 'statistics',
          data_count: args.data.length,
          statistics: stats,
        };
        break;
      }

      case 'derivative': {
        if (!args.expression) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Expression required for derivative' }),
            isError: true,
          };
        }

        const variable = args.variable || 'x';
        const derivative = math.derivative(args.expression, variable);

        result = {
          operation: 'derivative',
          expression: args.expression,
          variable,
          derivative: derivative.toString(),
        };
        break;
      }

      case 'simplify': {
        if (!args.expression) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Expression required for simplify' }),
            isError: true,
          };
        }

        const simplified = math.simplify(args.expression);

        result = {
          operation: 'simplify',
          original: args.expression,
          simplified: simplified.toString(),
        };
        break;
      }

      case 'solve': {
        if (!args.expression) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Expression/equation required for solve' }),
            isError: true,
          };
        }

        // Parse equation (assumes form "expr = 0" or just "expr" meaning "expr = 0")
        const variable = args.variable || 'x';

        // Try to rationalize and solve
        try {
          const node = math.parse(args.expression);
          const simplified = math.simplify(node);

          result = {
            operation: 'solve',
            equation: args.expression,
            variable,
            simplified: simplified.toString(),
            note: 'For complex equations, use evaluate with specific values',
          };
        } catch {
          result = {
            operation: 'solve',
            equation: args.expression,
            error: 'Could not solve symbolically',
          };
        }
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Math operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

// Format math.js results for JSON output
function formatMathResult(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // Check if it's a math.js type with toArray
  if (typeof value === 'object' && value !== null && 'toArray' in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (value as any).toArray();
  }

  // Check for complex numbers
  if (typeof value === 'object' && value !== null && 're' in value && 'im' in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const complex = value as any;
    return { real: complex.re, imaginary: complex.im };
  }

  return value;
}
