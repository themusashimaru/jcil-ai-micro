import { describe, it, expect } from 'vitest';
import { performanceReviewTool, executePerformanceReview, isPerformanceReviewAvailable } from './performance-review-tool';

describe('PerformanceReviewTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(performanceReviewTool.name).toBe('create_performance_review');
    });

    it('should have a description', () => {
      expect(performanceReviewTool.description).toBeTruthy();
    });

    it('should require employee_name, review_period, and competencies', () => {
      expect(performanceReviewTool.parameters.required).toEqual(['employee_name', 'review_period', 'competencies']);
    });
  });

  describe('isPerformanceReviewAvailable', () => {
    it('should return true', () => {
      expect(isPerformanceReviewAvailable()).toBe(true);
    });
  });

  describe('executePerformanceReview', () => {
    it('should create a performance review with valid input', async () => {
      const result = await executePerformanceReview({
        id: 'test-1',
        name: 'create_performance_review',
        arguments: {
          employee_name: 'John Smith',
          review_period: 'Q1 2026',
          competencies: [
            { name: 'Communication', rating: 4, comments: 'Excellent verbal and written skills.' },
            { name: 'Technical Skills', rating: 5, comments: 'Outstanding problem-solving ability.' },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.toolCallId).toBe('test-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.formatted_output).toContain('John Smith');
      expect(parsed.formatted_output).toContain('Q1 2026');
      expect(parsed.formatted_output).toContain('Communication');
    });

    it('should create an HTML format review', async () => {
      const result = await executePerformanceReview({
        id: 'test-2',
        name: 'create_performance_review',
        arguments: {
          employee_name: 'Jane Doe',
          review_period: 'Annual 2025',
          competencies: [
            { name: 'Leadership', rating: 3, comments: 'Meets expectations.' },
          ],
          format: 'html',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('html');
      expect(parsed.formatted_output).toContain('Jane Doe');
      expect(parsed.formatted_output).toContain('Leadership');
    });

    it('should create a markdown format review', async () => {
      const result = await executePerformanceReview({
        id: 'test-3',
        name: 'create_performance_review',
        arguments: {
          employee_name: 'Bob Jones',
          review_period: 'H2 2025',
          competencies: [
            { name: 'Teamwork', rating: 4, comments: 'Collaborates well with peers.' },
          ],
          format: 'markdown',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('markdown');
      expect(parsed.formatted_output).toContain('Bob Jones');
    });

    it('should error when employee_name is missing', async () => {
      const result = await executePerformanceReview({
        id: 'test-4',
        name: 'create_performance_review',
        arguments: {
          review_period: 'Q1 2026',
          competencies: [{ name: 'A', rating: 3, comments: 'OK' }],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when review_period is missing', async () => {
      const result = await executePerformanceReview({
        id: 'test-5',
        name: 'create_performance_review',
        arguments: {
          employee_name: 'Test User',
          competencies: [{ name: 'A', rating: 3, comments: 'OK' }],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when competencies is missing', async () => {
      const result = await executePerformanceReview({
        id: 'test-6',
        name: 'create_performance_review',
        arguments: {
          employee_name: 'Test User',
          review_period: 'Q1 2026',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should return toolCallId on error', async () => {
      const result = await executePerformanceReview({
        id: 'err-id',
        name: 'create_performance_review',
        arguments: {},
      });

      expect(result.toolCallId).toBe('err-id');
      expect(result.isError).toBe(true);
    });
  });
});
