import { describe, it, expect } from 'vitest';
import { caseStudyTool, executeCaseStudy, isCaseStudyAvailable } from './case-study-tool';

describe('CaseStudyTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(caseStudyTool.name).toBe('create_case_study');
    });

    it('should have a description', () => {
      expect(caseStudyTool.description).toBeTruthy();
    });

    it('should require title, client_name, challenge, solution, and results', () => {
      expect(caseStudyTool.parameters.required).toEqual(['title', 'client_name', 'challenge', 'solution', 'results']);
    });
  });

  describe('isCaseStudyAvailable', () => {
    it('should return true', () => {
      expect(isCaseStudyAvailable()).toBe(true);
    });
  });

  describe('executeCaseStudy', () => {
    it('should create a case study with valid input', async () => {
      const result = await executeCaseStudy({
        id: 'test-1',
        name: 'create_case_study',
        arguments: {
          title: 'How Acme Corp Reduced Costs by 40%',
          client_name: 'Acme Corp',
          challenge: 'Acme Corp was struggling with high operational costs and inefficient workflows.',
          solution: 'We implemented an AI-powered automation platform that streamlined their processes.',
          results: [
            '40% reduction in operational costs',
            '60% faster processing times',
            '95% employee satisfaction rate',
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.toolCallId).toBe('test-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.formatted_output).toContain('Acme Corp');
      expect(parsed.formatted_output).toContain('40%');
    });

    it('should create an HTML format case study', async () => {
      const result = await executeCaseStudy({
        id: 'test-2',
        name: 'create_case_study',
        arguments: {
          title: 'Digital Transformation Success',
          client_name: 'Beta Inc',
          challenge: 'Legacy systems were slowing down innovation.',
          solution: 'Cloud migration and modernization of core systems.',
          results: ['3x faster deployment cycles'],
          format: 'html',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('html');
      expect(parsed.formatted_output).toContain('Digital Transformation Success');
      expect(parsed.formatted_output).toContain('Beta Inc');
    });

    it('should create a markdown format case study', async () => {
      const result = await executeCaseStudy({
        id: 'test-3',
        name: 'create_case_study',
        arguments: {
          title: 'Customer Retention Improvement',
          client_name: 'Gamma LLC',
          challenge: 'High customer churn rate.',
          solution: 'Implemented predictive analytics for customer engagement.',
          results: ['25% reduction in churn'],
          format: 'markdown',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('markdown');
      expect(parsed.formatted_output).toContain('Customer Retention Improvement');
    });

    it('should error when title is missing', async () => {
      const result = await executeCaseStudy({
        id: 'test-4',
        name: 'create_case_study',
        arguments: {
          client_name: 'Test',
          challenge: 'Test challenge',
          solution: 'Test solution',
          results: ['Result 1'],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when client_name is missing', async () => {
      const result = await executeCaseStudy({
        id: 'test-5',
        name: 'create_case_study',
        arguments: {
          title: 'Test Study',
          challenge: 'Test challenge',
          solution: 'Test solution',
          results: ['Result 1'],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when required fields are missing', async () => {
      const result = await executeCaseStudy({
        id: 'test-6',
        name: 'create_case_study',
        arguments: {
          title: 'Test Study',
          client_name: 'Test Client',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should return toolCallId on error', async () => {
      const result = await executeCaseStudy({
        id: 'err-id',
        name: 'create_case_study',
        arguments: {},
      });

      expect(result.toolCallId).toBe('err-id');
      expect(result.isError).toBe(true);
    });
  });
});
