import { describe, it, expect } from 'vitest';
import {
  executeTrainingManual,
  isTrainingManualAvailable,
  trainingManualTool,
} from './training-manual-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_training_manual', arguments: args };
}

function basicArgs(overrides?: Record<string, unknown>) {
  return {
    title: 'New Employee Onboarding Guide',
    modules: [
      {
        title: 'Company Overview',
        objective: 'Understand company mission, values, and organizational structure',
        content: 'Founded in 2010, our company has grown to serve customers worldwide.',
      },
      {
        title: 'IT Systems Training',
        objective: 'Learn to use internal tools and communication platforms',
        content: 'All employees are provided with a laptop and access to our tool suite.',
      },
    ],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('trainingManualTool metadata', () => {
  it('should have correct name', () => {
    expect(trainingManualTool.name).toBe('create_training_manual');
  });

  it('should have a description', () => {
    expect(trainingManualTool.description).toBeTruthy();
  });

  it('should require title and modules', () => {
    expect(trainingManualTool.parameters.required).toContain('title');
    expect(trainingManualTool.parameters.required).toContain('modules');
  });
});

describe('isTrainingManualAvailable', () => {
  it('should return true', () => {
    expect(isTrainingManualAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Execution — valid input
// -------------------------------------------------------------------
describe('executeTrainingManual - creation', () => {
  it('should create training manual with valid input', async () => {
    const res = await executeTrainingManual(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('New Employee Onboarding');
  });

  it('should include module titles and content', async () => {
    const res = await executeTrainingManual(makeCall(basicArgs()));
    expect(res.content).toContain('Company Overview');
    expect(res.content).toContain('IT Systems Training');
  });

  it('should include module objectives', async () => {
    const res = await executeTrainingManual(makeCall(basicArgs()));
    expect(res.content).toContain('company mission');
  });

  it('should support html format', async () => {
    const res = await executeTrainingManual(makeCall(basicArgs({ format: 'html' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('<');
  });

  it('should default to markdown format', async () => {
    const res = await executeTrainingManual(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('#');
  });

  it('should handle optional organization field', async () => {
    const res = await executeTrainingManual(
      makeCall(basicArgs({ organization: 'Acme Corp' }))
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Acme Corp');
  });

  it('should return toolCallId', async () => {
    const res = await executeTrainingManual({
      id: 'my-id',
      name: 'create_training_manual',
      arguments: basicArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });
});

// -------------------------------------------------------------------
// Validation — missing fields
// -------------------------------------------------------------------
describe('executeTrainingManual - validation', () => {
  it('should error without title', async () => {
    const res = await executeTrainingManual(makeCall({ modules: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error without modules', async () => {
    const res = await executeTrainingManual(makeCall({ title: 'Test' }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty arguments', async () => {
    const res = await executeTrainingManual({
      id: 'test',
      name: 'create_training_manual',
      arguments: {},
    });
    expect(res.isError).toBe(true);
  });
});
