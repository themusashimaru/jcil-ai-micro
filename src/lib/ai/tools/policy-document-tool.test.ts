import { describe, it, expect } from 'vitest';
import { policyDocumentTool, executePolicyDocument, isPolicyDocumentAvailable } from './policy-document-tool';

describe('PolicyDocumentTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(policyDocumentTool.name).toBe('create_policy_document');
    });

    it('should have a description', () => {
      expect(policyDocumentTool.description).toBeTruthy();
    });

    it('should require title, policy_type, and sections', () => {
      expect(policyDocumentTool.parameters.required).toEqual(['title', 'policy_type', 'sections']);
    });
  });

  describe('isPolicyDocumentAvailable', () => {
    it('should return true', () => {
      expect(isPolicyDocumentAvailable()).toBe(true);
    });
  });

  describe('executePolicyDocument', () => {
    it('should create a policy document with valid input', async () => {
      const result = await executePolicyDocument({
        id: 'test-1',
        name: 'create_policy_document',
        arguments: {
          title: 'Acceptable Use Policy',
          policy_type: 'acceptable_use',
          sections: [
            { heading: 'Purpose', content: 'This policy defines acceptable use of company IT resources.' },
            { heading: 'Scope', content: 'Applies to all employees and contractors.' },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.toolCallId).toBe('test-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.formatted_output).toContain('Acceptable Use Policy');
      expect(parsed.formatted_output).toContain('Purpose');
    });

    it('should create an HTML format policy document', async () => {
      const result = await executePolicyDocument({
        id: 'test-2',
        name: 'create_policy_document',
        arguments: {
          title: 'Privacy Policy',
          policy_type: 'privacy',
          sections: [
            { heading: 'Data Collection', content: 'We collect minimal personal data.' },
          ],
          format: 'html',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('html');
      expect(parsed.formatted_output).toContain('Privacy Policy');
      expect(parsed.formatted_output).toContain('Data Collection');
    });

    it('should create a markdown format policy document', async () => {
      const result = await executePolicyDocument({
        id: 'test-3',
        name: 'create_policy_document',
        arguments: {
          title: 'Code of Conduct',
          policy_type: 'code_of_conduct',
          sections: [
            { heading: 'Respect', content: 'Treat all colleagues with respect.' },
          ],
          format: 'markdown',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('markdown');
      expect(parsed.formatted_output).toContain('Code of Conduct');
    });

    it('should error when title is missing', async () => {
      const result = await executePolicyDocument({
        id: 'test-4',
        name: 'create_policy_document',
        arguments: {
          policy_type: 'general',
          sections: [{ heading: 'A', content: 'B' }],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when policy_type is missing', async () => {
      const result = await executePolicyDocument({
        id: 'test-5',
        name: 'create_policy_document',
        arguments: {
          title: 'Test Policy',
          sections: [{ heading: 'A', content: 'B' }],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when sections is missing', async () => {
      const result = await executePolicyDocument({
        id: 'test-6',
        name: 'create_policy_document',
        arguments: {
          title: 'Test Policy',
          policy_type: 'general',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should return toolCallId on error', async () => {
      const result = await executePolicyDocument({
        id: 'err-id',
        name: 'create_policy_document',
        arguments: {},
      });

      expect(result.toolCallId).toBe('err-id');
      expect(result.isError).toBe(true);
    });
  });
});
