import { describe, it, expect } from 'vitest';
import { grantProposalTool, executeGrantProposal, isGrantProposalAvailable } from './grant-proposal-tool';

describe('GrantProposalTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(grantProposalTool.name).toBe('create_grant_proposal');
    });

    it('should have a description', () => {
      expect(grantProposalTool.description).toBeTruthy();
    });

    it('should require project_title, organization, executive_summary, and budget_total', () => {
      expect(grantProposalTool.parameters.required).toEqual(['project_title', 'organization', 'executive_summary', 'budget_total']);
    });
  });

  describe('isGrantProposalAvailable', () => {
    it('should return true', () => {
      expect(isGrantProposalAvailable()).toBe(true);
    });
  });

  describe('executeGrantProposal', () => {
    it('should create a grant proposal with valid input', async () => {
      const result = await executeGrantProposal({
        id: 'test-1',
        name: 'create_grant_proposal',
        arguments: {
          project_title: 'AI Literacy for Rural Schools',
          organization: 'Education First Foundation',
          executive_summary: 'This project will bring AI education tools to 50 rural school districts.',
          budget_total: '$250,000',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.toolCallId).toBe('test-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.formatted_output).toContain('AI Literacy for Rural Schools');
      expect(parsed.formatted_output).toContain('Education First Foundation');
      expect(parsed.formatted_output).toContain('$250,000');
    });

    it('should create an HTML format grant proposal', async () => {
      const result = await executeGrantProposal({
        id: 'test-2',
        name: 'create_grant_proposal',
        arguments: {
          project_title: 'Community Health Initiative',
          organization: 'Health Alliance',
          executive_summary: 'Expanding access to healthcare in underserved communities.',
          budget_total: '$500,000',
          format: 'html',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('html');
      expect(parsed.formatted_output).toContain('Community Health Initiative');
      expect(parsed.formatted_output).toContain('Health Alliance');
    });

    it('should create a markdown format grant proposal', async () => {
      const result = await executeGrantProposal({
        id: 'test-3',
        name: 'create_grant_proposal',
        arguments: {
          project_title: 'Clean Water Project',
          organization: 'Water Works NGO',
          executive_summary: 'Installing water purification systems in 100 villages.',
          budget_total: '$150,000',
          format: 'markdown',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('markdown');
      expect(parsed.formatted_output).toContain('Clean Water Project');
    });

    it('should error when project_title is missing', async () => {
      const result = await executeGrantProposal({
        id: 'test-4',
        name: 'create_grant_proposal',
        arguments: {
          organization: 'Test Org',
          executive_summary: 'Summary',
          budget_total: '$100',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when organization is missing', async () => {
      const result = await executeGrantProposal({
        id: 'test-5',
        name: 'create_grant_proposal',
        arguments: {
          project_title: 'Test Project',
          executive_summary: 'Summary',
          budget_total: '$100',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when executive_summary is missing', async () => {
      const result = await executeGrantProposal({
        id: 'test-6',
        name: 'create_grant_proposal',
        arguments: {
          project_title: 'Test Project',
          organization: 'Test Org',
          budget_total: '$100',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should return toolCallId on error', async () => {
      const result = await executeGrantProposal({
        id: 'err-id',
        name: 'create_grant_proposal',
        arguments: {},
      });

      expect(result.toolCallId).toBe('err-id');
      expect(result.isError).toBe(true);
    });
  });
});
