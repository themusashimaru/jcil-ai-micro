import { describe, it, expect } from 'vitest';
import { executeRaciMatrix, isRaciMatrixAvailable, raciMatrixTool } from './raci-matrix-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_raci_matrix', arguments: args };
}

function basicArgs(overrides?: Record<string, unknown>) {
  return {
    title: 'Website Redesign Project',
    roles: ['Project Manager', 'Designer', 'Developer'],
    tasks: [
      {
        task: 'Create wireframes',
        assignments: [
          { role: 'Project Manager', raci: 'A' },
          { role: 'Designer', raci: 'R' },
          { role: 'Developer', raci: 'I' },
        ],
      },
    ],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('raciMatrixTool metadata', () => {
  it('should have correct name', () => {
    expect(raciMatrixTool.name).toBe('create_raci_matrix');
  });

  it('should have a description', () => {
    expect(raciMatrixTool.description).toBeTruthy();
  });

  it('should require title, roles, tasks', () => {
    expect(raciMatrixTool.parameters.required).toContain('title');
    expect(raciMatrixTool.parameters.required).toContain('roles');
    expect(raciMatrixTool.parameters.required).toContain('tasks');
  });
});

describe('isRaciMatrixAvailable', () => {
  it('should return true', () => {
    expect(isRaciMatrixAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Execution — valid input
// -------------------------------------------------------------------
describe('executeRaciMatrix - creation', () => {
  it('should create RACI matrix with valid input', async () => {
    const res = await executeRaciMatrix(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Website Redesign');
    expect(res.content).toContain('Create wireframes');
  });

  it('should include role assignments', async () => {
    const res = await executeRaciMatrix(makeCall(basicArgs()));
    expect(res.content).toContain('Project Manager');
    expect(res.content).toContain('Designer');
  });

  it('should support html format', async () => {
    const res = await executeRaciMatrix(makeCall(basicArgs({ format: 'html' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('<');
  });

  it('should default to markdown format', async () => {
    const res = await executeRaciMatrix(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('#');
  });

  it('should handle multiple tasks', async () => {
    const res = await executeRaciMatrix(
      makeCall(
        basicArgs({
          tasks: [
            { task: 'Task A', assignments: [{ role: 'Designer', raci: 'R' }] },
            { task: 'Task B', assignments: [{ role: 'Developer', raci: 'R' }] },
          ],
        })
      )
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Task A');
    expect(res.content).toContain('Task B');
  });

  it('should return toolCallId', async () => {
    const res = await executeRaciMatrix({
      id: 'my-id',
      name: 'create_raci_matrix',
      arguments: basicArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });
});

// -------------------------------------------------------------------
// Validation — missing fields
// -------------------------------------------------------------------
describe('executeRaciMatrix - validation', () => {
  it('should error without title', async () => {
    const res = await executeRaciMatrix(makeCall({ roles: ['PM'], tasks: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error without roles', async () => {
    const res = await executeRaciMatrix(makeCall({ title: 'Test', tasks: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty arguments', async () => {
    const res = await executeRaciMatrix({
      id: 'test',
      name: 'create_raci_matrix',
      arguments: {},
    });
    expect(res.isError).toBe(true);
  });
});
