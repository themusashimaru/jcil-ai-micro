import { describe, it, expect } from 'vitest';
import { executeCarePlan, isCarePlanAvailable, carePlanTool } from './care-plan-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_care_plan', arguments: args };
}

function basicArgs(overrides?: Record<string, unknown>) {
  return {
    patient_id: 'PT-001',
    diagnosis: 'Type 2 Diabetes Mellitus',
    goals: [
      {
        goal: 'Maintain HbA1c below 7%',
        target_date: '2026-06-01',
        interventions: ['Blood glucose monitoring', 'Dietary counseling'],
      },
    ],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('carePlanTool metadata', () => {
  it('should have correct name', () => {
    expect(carePlanTool.name).toBe('create_care_plan');
  });

  it('should have a description', () => {
    expect(carePlanTool.description).toBeTruthy();
  });

  it('should require patient_id, diagnosis, goals', () => {
    expect(carePlanTool.parameters.required).toContain('patient_id');
    expect(carePlanTool.parameters.required).toContain('diagnosis');
    expect(carePlanTool.parameters.required).toContain('goals');
  });
});

describe('isCarePlanAvailable', () => {
  it('should return true', () => {
    expect(isCarePlanAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Execution — valid input
// -------------------------------------------------------------------
describe('executeCarePlan - creation', () => {
  it('should create care plan with valid input', async () => {
    const res = await executeCarePlan(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('PT-001');
    expect(res.content).toContain('Diabetes');
  });

  it('should include goals in output', async () => {
    const res = await executeCarePlan(makeCall(basicArgs()));
    expect(res.content).toContain('HbA1c');
    expect(res.content).toContain('Blood glucose monitoring');
  });

  it('should support html format', async () => {
    const res = await executeCarePlan(makeCall(basicArgs({ format: 'html' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('<');
  });

  it('should default to markdown format', async () => {
    const res = await executeCarePlan(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    // Markdown uses # headings, not HTML tags
    expect(res.content).toContain('#');
  });

  it('should handle multiple goals', async () => {
    const res = await executeCarePlan(
      makeCall(
        basicArgs({
          goals: [
            { goal: 'Goal 1', target_date: '2026-06-01', interventions: ['Intervention A'] },
            { goal: 'Goal 2', target_date: '2026-07-01', interventions: ['Intervention B'] },
          ],
        })
      )
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Goal 1');
    expect(res.content).toContain('Goal 2');
  });

  it('should return toolCallId', async () => {
    const res = await executeCarePlan({
      id: 'my-id',
      name: 'create_care_plan',
      arguments: basicArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });
});

// -------------------------------------------------------------------
// Validation — missing fields
// -------------------------------------------------------------------
describe('executeCarePlan - validation', () => {
  it('should error without patient_id', async () => {
    const res = await executeCarePlan(makeCall({ diagnosis: 'Test', goals: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error without diagnosis', async () => {
    const res = await executeCarePlan(makeCall({ patient_id: 'PT-001', goals: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty arguments', async () => {
    const res = await executeCarePlan({
      id: 'test',
      name: 'create_care_plan',
      arguments: {},
    });
    expect(res.isError).toBe(true);
  });
});
