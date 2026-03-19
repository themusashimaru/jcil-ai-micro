import { describe, it, expect } from 'vitest';

import {
  lessonPlanTool,
  isLessonPlanAvailable,
  executeLessonPlan,
} from './lesson-plan-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('lessonPlanTool definition', () => {
  it('should have correct name', () => {
    expect(lessonPlanTool.name).toBe('create_lesson_plan');
  });

  it('should have a description', () => {
    expect(lessonPlanTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(lessonPlanTool.parameters).toBeDefined();
    expect(lessonPlanTool.parameters.type).toBe('object');
  });

  it('should require title, subject, grade_level, and objectives', () => {
    expect(lessonPlanTool.parameters.required).toContain('title');
    expect(lessonPlanTool.parameters.required).toContain('subject');
    expect(lessonPlanTool.parameters.required).toContain('grade_level');
    expect(lessonPlanTool.parameters.required).toContain('objectives');
  });
});

describe('isLessonPlanAvailable', () => {
  it('should return true', () => {
    expect(isLessonPlanAvailable()).toBe(true);
  });
});

// ============================================================================
// EXECUTOR - VALID INPUT
// ============================================================================

describe('executeLessonPlan', () => {
  it('should generate markdown lesson plan with valid input', async () => {
    const result = await executeLessonPlan({
      id: 'test-1',
      name: 'create_lesson_plan',
      arguments: {
        title: 'Introduction to Fractions',
        subject: 'Mathematics',
        grade_level: '4th Grade',
        objectives: [
          'Identify numerator and denominator',
          'Compare simple fractions',
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('markdown');
    expect(data.formatted_output).toContain('Introduction to Fractions');
    expect(data.formatted_output).toContain('Mathematics');
    expect(data.formatted_output).toContain('4th Grade');
  });

  it('should generate HTML format when requested', async () => {
    const result = await executeLessonPlan({
      id: 'test-2',
      name: 'create_lesson_plan',
      arguments: {
        title: 'HTML Lesson Test',
        subject: 'Science',
        grade_level: '6th Grade',
        objectives: ['Understand the water cycle'],
        format: 'html',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('html');
    expect(data.formatted_output).toContain('<');
    expect(data.formatted_output).toContain('HTML Lesson Test');
  });

  it('should include activities with Bloom taxonomy levels', async () => {
    const result = await executeLessonPlan({
      id: 'test-3',
      name: 'create_lesson_plan',
      arguments: {
        title: 'Activities Lesson',
        subject: 'English',
        grade_level: '8th Grade',
        objectives: ['Analyze character development'],
        activities: [
          { name: 'Warm-up Discussion', duration: '10 minutes', description: 'Discuss characters', blooms_level: 'remember' },
          { name: 'Group Analysis', duration: '20 minutes', description: 'Analyze motivations', blooms_level: 'analyze' },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Warm-up Discussion');
    expect(data.formatted_output).toContain('Group Analysis');
  });

  it('should include differentiation strategies when provided', async () => {
    const result = await executeLessonPlan({
      id: 'test-4',
      name: 'create_lesson_plan',
      arguments: {
        title: 'Differentiated Lesson',
        subject: 'Math',
        grade_level: '5th Grade',
        objectives: ['Solve multi-step problems'],
        differentiation: {
          advanced: 'Provide challenge problems',
          struggling: 'Use visual aids',
          ell: 'Provide bilingual glossary',
        },
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Differentiation');
  });

  // ============================================================================
  // EXECUTOR - ERROR CASES
  // ============================================================================

  it('should error when title is missing', async () => {
    const result = await executeLessonPlan({
      id: 'test-5',
      name: 'create_lesson_plan',
      arguments: {
        subject: 'Math',
        grade_level: '3rd Grade',
        objectives: ['Learn addition'],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when objectives array is empty', async () => {
    const result = await executeLessonPlan({
      id: 'test-6',
      name: 'create_lesson_plan',
      arguments: {
        title: 'Empty Objectives',
        subject: 'Science',
        grade_level: '7th Grade',
        objectives: [],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeLessonPlan({
      id: 'my-lesson-id',
      name: 'create_lesson_plan',
      arguments: {
        title: 'ToolCallId Test',
        subject: 'Art',
        grade_level: '2nd Grade',
        objectives: ['Draw shapes'],
      },
    });

    expect(result.toolCallId).toBe('my-lesson-id');
  });

  it('should include summary in response', async () => {
    const result = await executeLessonPlan({
      id: 'test-7',
      name: 'create_lesson_plan',
      arguments: {
        title: 'Summary Test',
        subject: 'History',
        grade_level: '10th Grade',
        objectives: ['Understand civil rights movement', 'Analyze primary sources'],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.summary).toBeDefined();
    expect(data.summary.title).toBe('Summary Test');
    expect(data.summary.subject).toBe('History');
  });
});
