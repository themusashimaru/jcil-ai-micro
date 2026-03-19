import { describe, it, expect } from 'vitest';

import {
  quizTool,
  isQuizAvailable,
  executeQuiz,
} from './quiz-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('quizTool definition', () => {
  it('should have correct name', () => {
    expect(quizTool.name).toBe('create_quiz');
  });

  it('should have a description', () => {
    expect(quizTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(quizTool.parameters).toBeDefined();
    expect(quizTool.parameters.type).toBe('object');
  });

  it('should require title and questions', () => {
    expect(quizTool.parameters.required).toContain('title');
    expect(quizTool.parameters.required).toContain('questions');
  });
});

describe('isQuizAvailable', () => {
  it('should return true', () => {
    expect(isQuizAvailable()).toBe(true);
  });
});

// ============================================================================
// EXECUTOR - VALID INPUT
// ============================================================================

describe('executeQuiz', () => {
  it('should generate markdown quiz with multiple choice questions', async () => {
    const result = await executeQuiz({
      id: 'test-1',
      name: 'create_quiz',
      arguments: {
        title: 'Biology Chapter 5 Quiz',
        questions: [
          {
            question: 'What is the powerhouse of the cell?',
            type: 'multiple_choice',
            options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
            correct_answer: 'Mitochondria',
            points: 2,
          },
          {
            question: 'DNA stands for deoxyribonucleic acid.',
            type: 'true_false',
            correct_answer: 'True',
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('markdown');
    expect(data.formatted_output).toContain('Biology Chapter 5 Quiz');
    expect(data.formatted_output).toContain('powerhouse of the cell');
    expect(data.formatted_output).toContain('Mitochondria');
  });

  it('should generate HTML format when requested', async () => {
    const result = await executeQuiz({
      id: 'test-2',
      name: 'create_quiz',
      arguments: {
        title: 'HTML Quiz Test',
        questions: [
          {
            question: 'What is 2 + 2?',
            type: 'short_answer',
            correct_answer: '4',
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
    expect(data.formatted_output).toContain('HTML Quiz Test');
  });

  it('should support essay question type', async () => {
    const result = await executeQuiz({
      id: 'test-3',
      name: 'create_quiz',
      arguments: {
        title: 'Essay Quiz',
        questions: [
          {
            question: 'Explain the significance of the Renaissance.',
            type: 'essay',
            points: 10,
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Renaissance');
  });

  it('should include answer key by default', async () => {
    const result = await executeQuiz({
      id: 'test-4',
      name: 'create_quiz',
      arguments: {
        title: 'Answer Key Quiz',
        questions: [
          {
            question: 'What color is the sky?',
            type: 'short_answer',
            correct_answer: 'Blue',
          },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Answer Key');
    expect(data.formatted_output).toContain('Blue');
  });

  // ============================================================================
  // EXECUTOR - ERROR CASES
  // ============================================================================

  it('should error when title is missing', async () => {
    const result = await executeQuiz({
      id: 'test-5',
      name: 'create_quiz',
      arguments: {
        questions: [
          { question: 'Test?', type: 'short_answer' },
        ],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when questions array is empty', async () => {
    const result = await executeQuiz({
      id: 'test-6',
      name: 'create_quiz',
      arguments: {
        title: 'Empty Quiz',
        questions: [],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeQuiz({
      id: 'my-quiz-id',
      name: 'create_quiz',
      arguments: {
        title: 'ToolCallId Test',
        questions: [
          { question: 'Test?', type: 'true_false', correct_answer: 'True' },
        ],
      },
    });

    expect(result.toolCallId).toBe('my-quiz-id');
  });

  it('should calculate total points automatically', async () => {
    const result = await executeQuiz({
      id: 'test-7',
      name: 'create_quiz',
      arguments: {
        title: 'Points Quiz',
        questions: [
          { question: 'Q1', type: 'short_answer', points: 5 },
          { question: 'Q2', type: 'true_false', points: 3 },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.summary).toBeDefined();
    expect(data.summary.total_points).toBe(8);
  });
});
