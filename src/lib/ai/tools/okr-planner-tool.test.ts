import { describe, it, expect } from 'vitest';

import {
  okrPlannerTool,
  isOkrPlannerAvailable,
  executeOkrPlanner,
} from './okr-planner-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('okrPlannerTool definition', () => {
  it('should have correct name', () => {
    expect(okrPlannerTool.name).toBe('create_okr_plan');
  });

  it('should have a description', () => {
    expect(okrPlannerTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(okrPlannerTool.parameters).toBeDefined();
    expect(okrPlannerTool.parameters.type).toBe('object');
  });

  it('should require title, period, and objectives', () => {
    expect(okrPlannerTool.parameters.required).toContain('title');
    expect(okrPlannerTool.parameters.required).toContain('period');
    expect(okrPlannerTool.parameters.required).toContain('objectives');
  });
});

describe('isOkrPlannerAvailable', () => {
  it('should return true', () => {
    expect(isOkrPlannerAvailable()).toBe(true);
  });
});

// ============================================================================
// EXECUTOR - VALID INPUT
// ============================================================================

describe('executeOkrPlanner', () => {
  it('should generate markdown OKR plan with valid input', async () => {
    const result = await executeOkrPlanner({
      id: 'test-1',
      name: 'create_okr_plan',
      arguments: {
        title: 'Engineering OKRs',
        period: 'Q2 2026',
        objectives: [
          {
            objective: 'Improve platform reliability',
            key_results: [
              { description: 'Achieve 99.9% uptime', target: '99.9' },
              { description: 'Reduce P1 incidents to zero', target: '0' },
            ],
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('markdown');
    expect(data.formatted_output).toContain('Engineering OKRs');
    expect(data.formatted_output).toContain('Q2 2026');
    expect(data.formatted_output).toContain('99.9');
  });

  it('should generate HTML format when requested', async () => {
    const result = await executeOkrPlanner({
      id: 'test-2',
      name: 'create_okr_plan',
      arguments: {
        title: 'HTML OKR Test',
        period: 'Q3 2026',
        objectives: [
          {
            objective: 'Grow revenue',
            key_results: [
              { description: 'Reach $1M ARR', target: '1000000' },
            ],
          },
        ],
        format: 'html',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('html');
    expect(data.formatted_output).toContain('<');
    expect(data.formatted_output).toContain('HTML OKR Test');
  });

  it('should include progress tracking when current values provided', async () => {
    const result = await executeOkrPlanner({
      id: 'test-3',
      name: 'create_okr_plan',
      arguments: {
        title: 'Progress OKRs',
        period: 'Q1 2026',
        objectives: [
          {
            objective: 'Scale user base',
            key_results: [
              { description: 'Reach 10k users', target: '10000', current: '7000' },
            ],
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('10000');
  });

  // ============================================================================
  // EXECUTOR - ERROR CASES
  // ============================================================================

  it('should error when title is missing', async () => {
    const result = await executeOkrPlanner({
      id: 'test-4',
      name: 'create_okr_plan',
      arguments: {
        period: 'Q2 2026',
        objectives: [
          {
            objective: 'Test',
            key_results: [{ description: 'KR', target: '100' }],
          },
        ],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when objectives array is empty', async () => {
    const result = await executeOkrPlanner({
      id: 'test-5',
      name: 'create_okr_plan',
      arguments: {
        title: 'Empty OKRs',
        period: 'Q2 2026',
        objectives: [],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when period is missing', async () => {
    const result = await executeOkrPlanner({
      id: 'test-6',
      name: 'create_okr_plan',
      arguments: {
        title: 'No Period',
        objectives: [
          {
            objective: 'Test',
            key_results: [{ description: 'KR1', target: '100' }],
          },
        ],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeOkrPlanner({
      id: 'my-okr-id',
      name: 'create_okr_plan',
      arguments: {
        title: 'ToolCallId Test',
        period: 'Q1',
        objectives: [
          {
            objective: 'Test',
            key_results: [{ description: 'KR1', target: '100' }],
          },
        ],
      },
    });

    expect(result.toolCallId).toBe('my-okr-id');
  });
});
