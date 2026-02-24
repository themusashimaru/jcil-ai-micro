import { describe, it, expect } from 'vitest';
import { executeConstraint, isConstraintAvailable, constraintTool } from './constraint-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'solve_constraints', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeConstraint(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('constraintTool metadata', () => {
  it('should have correct name', () => {
    expect(constraintTool.name).toBe('solve_constraints');
  });

  it('should require operation and variables', () => {
    expect(constraintTool.parameters.required).toContain('operation');
    expect(constraintTool.parameters.required).toContain('variables');
  });
});

describe('isConstraintAvailable', () => {
  it('should return true', () => {
    expect(isConstraintAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// satisfy operation
// -------------------------------------------------------------------
describe('executeConstraint - satisfy', () => {
  it('should find a solution with no constraints', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b', 'c'],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.solution).toBeDefined();
    expect(result.solution.assignment).toBeDefined();
  });

  it('should satisfy exactly_one constraint', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b', 'c'],
      constraints: [{ type: 'exactly_one', vars: ['a', 'b', 'c'] }],
    });
    expect(result.satisfiable).toBe(true);
    const trueVars = result.solution.true_variables;
    expect(trueVars).toHaveLength(1);
  });

  it('should satisfy required_true', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b'],
      required_true: ['a'],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.solution.assignment.a).toBe(true);
  });

  it('should satisfy required_false', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b'],
      required_false: ['a'],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.solution.assignment.a).toBe(false);
  });

  it('should satisfy implies constraint', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b'],
      constraints: [{ type: 'implies', from: 'a', to: 'b' }],
      required_true: ['a'],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.solution.assignment.a).toBe(true);
    expect(result.solution.assignment.b).toBe(true);
  });

  it('should detect unsatisfiable constraints', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a'],
      required_true: ['a'],
      required_false: ['a'],
    });
    expect(result.satisfiable).toBe(false);
  });
});

// -------------------------------------------------------------------
// check operation
// -------------------------------------------------------------------
describe('executeConstraint - check', () => {
  it('should check satisfiability', async () => {
    const result = await getResult({
      operation: 'check',
      variables: ['x', 'y'],
      constraints: [{ type: 'at_least_one', vars: ['x', 'y'] }],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.operation).toBe('check');
  });
});

// -------------------------------------------------------------------
// all_solutions operation
// -------------------------------------------------------------------
describe('executeConstraint - all_solutions', () => {
  it('should find all solutions', async () => {
    const result = await getResult({
      operation: 'all_solutions',
      variables: ['a', 'b'],
      constraints: [{ type: 'exactly_one', vars: ['a', 'b'] }],
    });
    expect(result.operation).toBe('all_solutions');
    expect(result.solution_count).toBe(2);
    expect(result.solutions).toHaveLength(2);
  });

  it('should respect max_solutions', async () => {
    const result = await getResult({
      operation: 'all_solutions',
      variables: ['a', 'b', 'c'],
      max_solutions: 2,
    });
    expect(result.solution_count).toBeLessThanOrEqual(2);
  });
});

// -------------------------------------------------------------------
// constraint types
// -------------------------------------------------------------------
describe('executeConstraint - constraint types', () => {
  it('should handle at_most_one', async () => {
    const result = await getResult({
      operation: 'all_solutions',
      variables: ['a', 'b'],
      constraints: [{ type: 'at_most_one', vars: ['a', 'b'] }],
    });
    expect(result.satisfiable !== false).toBe(true);
    // Should have 3 solutions: neither, a only, b only
    for (const sol of result.solutions) {
      const trueCount = Object.values(sol).filter(Boolean).length;
      expect(trueCount).toBeLessThanOrEqual(1);
    }
  });

  it('should handle and constraint', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b'],
      constraints: [{ type: 'and', vars: ['a', 'b'] }],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.solution.assignment.a).toBe(true);
    expect(result.solution.assignment.b).toBe(true);
  });

  it('should handle not constraint', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b'],
      constraints: [{ type: 'not', var: 'a' }],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.solution.assignment.a).toBe(false);
  });
});

// -------------------------------------------------------------------
// minimize/maximize
// -------------------------------------------------------------------
describe('executeConstraint - optimize', () => {
  it('should find solution for minimize', async () => {
    const result = await getResult({
      operation: 'minimize',
      variables: ['a', 'b'],
    });
    expect(result.satisfiable).toBe(true);
    expect(result.operation).toBe('minimize');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeConstraint - errors', () => {
  it('should return toolCallId', async () => {
    const res = await executeConstraint({
      id: 'my-id',
      name: 'solve_constraints',
      arguments: { operation: 'satisfy', variables: ['a'] },
    });
    expect(res.toolCallId).toBe('my-id');
  });

  it('should report variables and constraints count', async () => {
    const result = await getResult({
      operation: 'satisfy',
      variables: ['a', 'b', 'c'],
      constraints: [{ type: 'exactly_one', vars: ['a', 'b', 'c'] }],
    });
    expect(result.variables_count).toBe(3);
    expect(result.constraints_count).toBe(1);
  });
});
