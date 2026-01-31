/**
 * CONSTRAINT SOLVER TOOL
 *
 * Constraint satisfaction and SAT solving using logic-solver.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Boolean satisfiability (SAT)
 * - Constraint satisfaction problems
 * - Logic puzzles (Sudoku-style)
 * - Scheduling constraints
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Logic: any = null;

async function initLogic(): Promise<boolean> {
  if (Logic) return true;
  try {
    const mod = await import('logic-solver');
    Logic = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const constraintTool: UnifiedTool = {
  name: 'solve_constraints',
  description: `Solve constraint satisfaction and logic problems.

Operations:
- satisfy: Find a solution that satisfies all constraints
- all_solutions: Find all solutions (up to a limit)
- check: Check if a set of constraints is satisfiable
- minimize/maximize: Optimize while satisfying constraints

Constraint types:
- exactly_one: Exactly one of the variables is true
- at_most_one: At most one variable is true
- at_least_one: At least one variable is true
- implies: If A then B
- equiv: A if and only if B
- and/or/not: Boolean operations

Use cases:
- Scheduling (assign tasks to slots)
- Sudoku and logic puzzles
- Resource allocation
- Configuration validation
- Timetabling`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['satisfy', 'all_solutions', 'check', 'minimize', 'maximize'],
        description: 'Solver operation',
      },
      variables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Variable names',
      },
      constraints: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Constraints: [{type: "exactly_one", vars: ["a","b","c"]}, {type: "implies", from: "a", to: "b"}]',
      },
      required_true: {
        type: 'array',
        items: { type: 'string' },
        description: 'Variables that must be true',
      },
      required_false: {
        type: 'array',
        items: { type: 'string' },
        description: 'Variables that must be false',
      },
      max_solutions: {
        type: 'number',
        description: 'Maximum solutions to find (default: 10)',
      },
      optimize_var: {
        type: 'string',
        description: 'Variable to minimize/maximize',
      },
    },
    required: ['operation', 'variables'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isConstraintAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeConstraint(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    variables: string[];
    constraints?: Array<{
      type: string;
      vars?: string[];
      from?: string;
      to?: string;
      var?: string;
    }>;
    required_true?: string[];
    required_false?: string[];
    max_solutions?: number;
    optimize_var?: string;
  };

  const {
    operation,
    variables,
    constraints = [],
    required_true = [],
    required_false = [],
    max_solutions = 10,
  } = args;

  try {
    const initialized = await initLogic();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize logic-solver library' }),
        isError: true,
      };
    }

    const solver = new Logic.Solver();

    // Add constraints
    for (const constraint of constraints) {
      switch (constraint.type) {
        case 'exactly_one':
          if (constraint.vars) {
            solver.require(Logic.exactlyOne(...constraint.vars));
          }
          break;
        case 'at_most_one':
          if (constraint.vars) {
            solver.require(Logic.atMostOne(...constraint.vars));
          }
          break;
        case 'at_least_one':
          if (constraint.vars) {
            solver.require(Logic.or(...constraint.vars));
          }
          break;
        case 'implies':
          if (constraint.from && constraint.to) {
            solver.require(Logic.implies(constraint.from, constraint.to));
          }
          break;
        case 'equiv':
          if (constraint.from && constraint.to) {
            solver.require(Logic.equiv(constraint.from, constraint.to));
          }
          break;
        case 'and':
          if (constraint.vars) {
            solver.require(Logic.and(...constraint.vars));
          }
          break;
        case 'or':
          if (constraint.vars) {
            solver.require(Logic.or(...constraint.vars));
          }
          break;
        case 'not':
          if (constraint.var) {
            solver.require(Logic.not(constraint.var));
          }
          break;
        case 'xor':
          if (constraint.vars && constraint.vars.length === 2) {
            solver.require(Logic.xor(constraint.vars[0], constraint.vars[1]));
          }
          break;
      }
    }

    // Add required true/false
    for (const v of required_true) {
      solver.require(v);
    }
    for (const v of required_false) {
      solver.require(Logic.not(v));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'satisfy':
      case 'check': {
        const solution = solver.solve();

        if (solution) {
          const trueVars = variables.filter((v) => solution.getTrueVars().includes(v));
          const falseVars = variables.filter((v) => !solution.getTrueVars().includes(v));

          result = {
            operation,
            satisfiable: true,
            solution: {
              true_variables: trueVars,
              false_variables: falseVars,
              assignment: Object.fromEntries(variables.map((v) => [v, trueVars.includes(v)])),
            },
          };
        } else {
          result = {
            operation,
            satisfiable: false,
            message: 'No solution exists that satisfies all constraints',
          };
        }
        break;
      }

      case 'all_solutions': {
        const solutions: Array<Record<string, boolean>> = [];
        let count = 0;

        while (count < max_solutions) {
          const solution = solver.solve();
          if (!solution) break;

          const assignment: Record<string, boolean> = {};
          for (const v of variables) {
            assignment[v] = solution.getTrueVars().includes(v);
          }
          solutions.push(assignment);

          // Add constraint to exclude this solution
          const clause = variables.map((v) => (assignment[v] ? Logic.not(v) : v));
          solver.require(Logic.or(...clause));
          count++;
        }

        result = {
          operation: 'all_solutions',
          solution_count: solutions.length,
          exhaustive: count < max_solutions,
          solutions,
        };
        break;
      }

      case 'minimize':
      case 'maximize': {
        // For min/max, we'd need weighted constraints
        // Simplified: just find a solution
        const solution = solver.solve();

        if (solution) {
          result = {
            operation,
            message:
              'Optimization found a satisfying solution (exact optimization requires weighted solver)',
            satisfiable: true,
            solution: {
              true_variables: variables.filter((v) => solution.getTrueVars().includes(v)),
            },
          };
        } else {
          result = {
            operation,
            satisfiable: false,
            message: 'No satisfying solution exists',
          };
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(
        {
          ...result,
          variables_count: variables.length,
          constraints_count: constraints.length + required_true.length + required_false.length,
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
        operation,
      }),
      isError: true,
    };
  }
}
