import { describe, it, expect } from 'vitest';
import {
  executeRiskAssessment,
  isRiskAssessmentAvailable,
  riskAssessmentTool,
} from './risk-assessment-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_risk_assessment', arguments: args };
}

function basicArgs(overrides?: Record<string, unknown>) {
  return {
    title: 'Q3 Product Launch Risk Assessment',
    risks: [
      {
        name: 'Supply chain delay',
        description: 'Vendor may not deliver components on time',
        likelihood: 3,
        impact: 4,
      },
    ],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('riskAssessmentTool metadata', () => {
  it('should have correct name', () => {
    expect(riskAssessmentTool.name).toBe('create_risk_assessment');
  });

  it('should have a description', () => {
    expect(riskAssessmentTool.description).toBeTruthy();
  });

  it('should require title and risks', () => {
    expect(riskAssessmentTool.parameters.required).toContain('title');
    expect(riskAssessmentTool.parameters.required).toContain('risks');
  });
});

describe('isRiskAssessmentAvailable', () => {
  it('should return true', () => {
    expect(isRiskAssessmentAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Execution — valid input
// -------------------------------------------------------------------
describe('executeRiskAssessment - creation', () => {
  it('should create risk assessment with valid input', async () => {
    const res = await executeRiskAssessment(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Q3 Product Launch');
    expect(res.content).toContain('Supply chain delay');
  });

  it('should include risk scores', async () => {
    const res = await executeRiskAssessment(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    // Likelihood 3 * Impact 4 = 12
    expect(res.content).toContain('12');
  });

  it('should support html format', async () => {
    const res = await executeRiskAssessment(makeCall(basicArgs({ format: 'html' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('<');
  });

  it('should default to markdown format', async () => {
    const res = await executeRiskAssessment(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('#');
  });

  it('should handle multiple risks', async () => {
    const res = await executeRiskAssessment(
      makeCall(
        basicArgs({
          risks: [
            { name: 'Risk A', description: 'Desc A', likelihood: 2, impact: 3 },
            { name: 'Risk B', description: 'Desc B', likelihood: 5, impact: 5 },
          ],
        })
      )
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Risk A');
    expect(res.content).toContain('Risk B');
  });

  it('should return toolCallId', async () => {
    const res = await executeRiskAssessment({
      id: 'my-id',
      name: 'create_risk_assessment',
      arguments: basicArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });
});

// -------------------------------------------------------------------
// Validation — missing fields
// -------------------------------------------------------------------
describe('executeRiskAssessment - validation', () => {
  it('should error without title', async () => {
    const res = await executeRiskAssessment(makeCall({ risks: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error without risks', async () => {
    const res = await executeRiskAssessment(makeCall({ title: 'Test' }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty arguments', async () => {
    const res = await executeRiskAssessment({
      id: 'test',
      name: 'create_risk_assessment',
      arguments: {},
    });
    expect(res.isError).toBe(true);
  });
});
