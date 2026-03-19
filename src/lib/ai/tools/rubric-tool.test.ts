import { describe, it, expect } from 'vitest';

import {
  rubricTool,
  isRubricAvailable,
  executeRubric,
} from './rubric-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('rubricTool definition', () => {
  it('should have correct name', () => {
    expect(rubricTool.name).toBe('create_rubric');
  });

  it('should have a description', () => {
    expect(rubricTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(rubricTool.parameters).toBeDefined();
    expect(rubricTool.parameters.type).toBe('object');
  });

  it('should require title and criteria', () => {
    expect(rubricTool.parameters.required).toContain('title');
    expect(rubricTool.parameters.required).toContain('criteria');
  });
});

describe('isRubricAvailable', () => {
  it('should return true', () => {
    expect(isRubricAvailable()).toBe(true);
  });
});

// ============================================================================
// EXECUTOR - VALID INPUT
// ============================================================================

describe('executeRubric', () => {
  it('should generate markdown rubric with valid input', async () => {
    const result = await executeRubric({
      id: 'test-1',
      name: 'create_rubric',
      arguments: {
        title: 'Research Paper Rubric',
        criteria: [
          {
            name: 'Thesis Statement',
            descriptions: [
              { level: 'Excellent', points: 4, description: 'Clear and compelling thesis' },
              { level: 'Good', points: 3, description: 'Clear thesis' },
              { level: 'Needs Work', points: 1, description: 'Unclear thesis' },
            ],
          },
          {
            name: 'Evidence',
            descriptions: [
              { level: 'Excellent', points: 4, description: 'Strong evidence from multiple sources' },
              { level: 'Good', points: 3, description: 'Adequate evidence' },
              { level: 'Needs Work', points: 1, description: 'Insufficient evidence' },
            ],
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('markdown');
    expect(data.formatted_output).toContain('Research Paper Rubric');
    expect(data.formatted_output).toContain('Thesis Statement');
    expect(data.formatted_output).toContain('Evidence');
  });

  it('should generate HTML format when requested', async () => {
    const result = await executeRubric({
      id: 'test-2',
      name: 'create_rubric',
      arguments: {
        title: 'HTML Rubric Test',
        criteria: [
          {
            name: 'Creativity',
            descriptions: [
              { level: 'Excellent', points: 5, description: 'Highly creative work' },
              { level: 'Average', points: 3, description: 'Some creativity shown' },
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
    expect(data.formatted_output).toContain('HTML Rubric Test');
  });

  it('should include grade scale when provided', async () => {
    const result = await executeRubric({
      id: 'test-3',
      name: 'create_rubric',
      arguments: {
        title: 'Graded Rubric',
        criteria: [
          {
            name: 'Quality',
            descriptions: [
              { level: 'A', points: 10, description: 'Outstanding' },
              { level: 'B', points: 7, description: 'Good' },
              { level: 'F', points: 2, description: 'Failing' },
            ],
          },
        ],
        grade_scale: [
          { grade: 'A', min_points: 9, max_points: 10 },
          { grade: 'B', min_points: 6, max_points: 8 },
          { grade: 'F', min_points: 0, max_points: 5 },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Grade');
  });

  // ============================================================================
  // EXECUTOR - ERROR CASES
  // ============================================================================

  it('should error when title is missing', async () => {
    const result = await executeRubric({
      id: 'test-4',
      name: 'create_rubric',
      arguments: {
        criteria: [
          {
            name: 'Test',
            descriptions: [
              { level: 'Good', points: 3, description: 'Good work' },
            ],
          },
        ],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when criteria array is empty', async () => {
    const result = await executeRubric({
      id: 'test-5',
      name: 'create_rubric',
      arguments: {
        title: 'Empty Rubric',
        criteria: [],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeRubric({
      id: 'my-rubric-id',
      name: 'create_rubric',
      arguments: {
        title: 'ToolCallId Test',
        criteria: [
          {
            name: 'Test',
            descriptions: [
              { level: 'Pass', points: 1, description: 'Passing' },
            ],
          },
        ],
      },
    });

    expect(result.toolCallId).toBe('my-rubric-id');
  });

  it('should include summary with criteria count', async () => {
    const result = await executeRubric({
      id: 'test-6',
      name: 'create_rubric',
      arguments: {
        title: 'Summary Rubric',
        criteria: [
          {
            name: 'Criterion A',
            descriptions: [
              { level: 'Good', points: 3, description: 'Good' },
            ],
          },
          {
            name: 'Criterion B',
            descriptions: [
              { level: 'Good', points: 3, description: 'Good' },
            ],
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.summary).toBeDefined();
    expect(data.summary.criteria_count).toBe(2);
  });
});
