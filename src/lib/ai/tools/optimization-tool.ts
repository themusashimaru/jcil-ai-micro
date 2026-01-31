/**
 * OPTIMIZATION TOOL (Linear Programming)
 *
 * Linear programming and optimization using javascript-lp-solver.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Linear programming (LP)
 * - Mixed integer programming (MIP)
 * - Resource allocation
 * - Scheduling optimization
 * - Diet/blending problems
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let solver: any = null;

async function initSolver(): Promise<boolean> {
  if (solver) return true;
  try {
    const mod = await import('javascript-lp-solver');
    solver = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const optimizationTool: UnifiedTool = {
  name: 'optimize',
  description: `Solve linear programming and optimization problems.

Problem types:
- Maximize/minimize objective functions
- Subject to linear constraints
- Integer and binary variables supported

Common use cases:
- Resource allocation (budget, time, materials)
- Production planning (maximize profit, minimize cost)
- Diet problems (minimize cost meeting nutritional requirements)
- Transportation/logistics (minimize shipping costs)
- Scheduling (staff, machines, tasks)
- Portfolio optimization

Model format:
- optimize: variable to maximize/minimize
- opType: "max" or "min"
- constraints: { constraint_name: { min/max: value } }
- variables: { var_name: { constraint_contributions, cost/profit } }
- ints/binaries: for integer/binary variables`,
  parameters: {
    type: 'object',
    properties: {
      model: {
        type: 'object',
        description: 'LP model with optimize, opType, constraints, variables',
      },
      optimize: {
        type: 'string',
        description: 'Name of value to optimize (alternative to model.optimize)',
      },
      opType: {
        type: 'string',
        enum: ['max', 'min'],
        description: 'Optimization type: maximize or minimize',
      },
      constraints: {
        type: 'object',
        description: 'Constraints object: { name: { min: N, max: M } }',
      },
      variables: {
        type: 'object',
        description: 'Variables object: { name: { constraint: coeff, objective: coeff } }',
      },
      ints: {
        type: 'object',
        description: 'Integer variables: { varName: 1 }',
      },
      binaries: {
        type: 'object',
        description: 'Binary (0/1) variables: { varName: 1 }',
      },
    },
    required: [],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isOptimizationAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeOptimization(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    model?: Record<string, unknown>;
    optimize?: string;
    opType?: string;
    constraints?: Record<string, { min?: number; max?: number; equal?: number }>;
    variables?: Record<string, Record<string, number>>;
    ints?: Record<string, number>;
    binaries?: Record<string, number>;
  };

  try {
    const initialized = await initSolver();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize LP solver' }),
        isError: true,
      };
    }

    // Build model either from provided model or individual components
    let model: Record<string, unknown>;

    if (args.model) {
      model = args.model;
    } else {
      model = {
        optimize: args.optimize,
        opType: args.opType || 'max',
        constraints: args.constraints || {},
        variables: args.variables || {},
      };
      if (args.ints) model.ints = args.ints;
      if (args.binaries) model.binaries = args.binaries;
    }

    // Validate model
    if (!model.optimize) {
      throw new Error('Model must specify what to optimize');
    }
    if (!model.variables || Object.keys(model.variables as object).length === 0) {
      throw new Error('Model must have at least one variable');
    }

    // Solve
    const results = solver.Solve(model);

    // Analyze results
    const variableValues: Record<string, number> = {};
    const constraintSlack: Record<string, number> = {};

    for (const [key, value] of Object.entries(results)) {
      if (key === 'feasible' || key === 'result' || key === 'bounded') continue;
      if (typeof value === 'number') {
        variableValues[key] = value;
      }
    }

    // Calculate constraint usage
    const constraints = model.constraints as Record<string, { min?: number; max?: number }>;
    const variables = model.variables as Record<string, Record<string, number>>;

    for (const [constraintName, constraint] of Object.entries(constraints)) {
      let usage = 0;
      for (const [varName, varValue] of Object.entries(variableValues)) {
        const varDef = variables[varName];
        if (varDef && varDef[constraintName]) {
          usage += varDef[constraintName] * varValue;
        }
      }
      const limit = constraint.max ?? constraint.min ?? 0;
      constraintSlack[constraintName] = {
        used: usage,
        limit,
        slack: limit - usage,
      } as unknown as number;
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(
        {
          feasible: results.feasible,
          bounded: results.bounded,
          optimal_value: results.result,
          optimization: {
            type: model.opType,
            objective: model.optimize,
          },
          solution: variableValues,
          constraint_analysis: constraintSlack,
          raw_result: results,
        },
        null,
        2
      ),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      isError: true,
    };
  }
}
