import { describe, it, expect } from 'vitest';

import {
  swotAnalysisTool,
  isSwotAnalysisAvailable,
  executeSwotAnalysis,
} from './swot-analysis-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('swotAnalysisTool definition', () => {
  it('should have correct name', () => {
    expect(swotAnalysisTool.name).toBe('create_swot_analysis');
  });

  it('should have a description', () => {
    expect(swotAnalysisTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(swotAnalysisTool.parameters).toBeDefined();
    expect(swotAnalysisTool.parameters.type).toBe('object');
  });

  it('should require correct parameters', () => {
    expect(swotAnalysisTool.parameters.required).toContain('title');
    expect(swotAnalysisTool.parameters.required).toContain('company_or_project');
    expect(swotAnalysisTool.parameters.required).toContain('strengths');
    expect(swotAnalysisTool.parameters.required).toContain('weaknesses');
    expect(swotAnalysisTool.parameters.required).toContain('opportunities');
    expect(swotAnalysisTool.parameters.required).toContain('threats');
  });
});

describe('isSwotAnalysisAvailable', () => {
  it('should return true', () => {
    expect(isSwotAnalysisAvailable()).toBe(true);
  });
});

// ============================================================================
// EXECUTOR - VALID INPUT
// ============================================================================

describe('executeSwotAnalysis', () => {
  it('should generate markdown SWOT analysis with valid input', async () => {
    const result = await executeSwotAnalysis({
      id: 'test-1',
      name: 'create_swot_analysis',
      arguments: {
        title: 'Q2 Market Analysis',
        company_or_project: 'Acme Corp',
        strengths: ['Strong brand', 'Loyal customer base'],
        weaknesses: ['Limited R&D budget'],
        opportunities: ['Expanding market'],
        threats: ['New competitors'],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('markdown');
    expect(data.formatted_output).toContain('Q2 Market Analysis');
    expect(data.formatted_output).toContain('Strong brand');
    expect(data.formatted_output).toContain('New competitors');
  });

  it('should generate HTML format when requested', async () => {
    const result = await executeSwotAnalysis({
      id: 'test-2',
      name: 'create_swot_analysis',
      arguments: {
        title: 'HTML SWOT Test',
        company_or_project: 'TestCo',
        strengths: ['Speed'],
        weaknesses: ['Cost'],
        opportunities: ['Growth'],
        threats: ['Regulation'],
        format: 'html',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('html');
    expect(data.formatted_output).toContain('<');
    expect(data.formatted_output).toContain('HTML SWOT Test');
  });

  it('should include action items when provided', async () => {
    const result = await executeSwotAnalysis({
      id: 'test-3',
      name: 'create_swot_analysis',
      arguments: {
        title: 'Action Plan SWOT',
        company_or_project: 'Startup Inc',
        strengths: ['Agility'],
        weaknesses: ['Funding'],
        opportunities: ['AI market'],
        threats: ['Big tech'],
        action_items: [
          { priority: 'high', action: 'Secure Series A', owner: 'CEO', deadline: '2026-06-01' },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Secure Series A');
  });

  // ============================================================================
  // EXECUTOR - ERROR CASES
  // ============================================================================

  it('should error when title is missing', async () => {
    const result = await executeSwotAnalysis({
      id: 'test-4',
      name: 'create_swot_analysis',
      arguments: {
        company_or_project: 'Acme',
        strengths: ['A'],
        weaknesses: ['B'],
        opportunities: ['C'],
        threats: ['D'],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when strengths array is missing', async () => {
    const result = await executeSwotAnalysis({
      id: 'test-5',
      name: 'create_swot_analysis',
      arguments: {
        title: 'Missing Strengths',
        company_or_project: 'Acme',
        weaknesses: ['B'],
        opportunities: ['C'],
        threats: ['D'],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when company_or_project is missing', async () => {
    const result = await executeSwotAnalysis({
      id: 'test-6',
      name: 'create_swot_analysis',
      arguments: {
        title: 'Missing Company',
        strengths: ['A'],
        weaknesses: ['B'],
        opportunities: ['C'],
        threats: ['D'],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeSwotAnalysis({
      id: 'my-swot-id',
      name: 'create_swot_analysis',
      arguments: {
        title: 'ToolCallId Test',
        company_or_project: 'Test',
        strengths: ['A'],
        weaknesses: ['B'],
        opportunities: ['C'],
        threats: ['D'],
      },
    });

    expect(result.toolCallId).toBe('my-swot-id');
  });

  it('should include summary counts in response', async () => {
    const result = await executeSwotAnalysis({
      id: 'test-7',
      name: 'create_swot_analysis',
      arguments: {
        title: 'Summary Test',
        company_or_project: 'TestCo',
        strengths: ['A', 'B'],
        weaknesses: ['C'],
        opportunities: ['D', 'E', 'F'],
        threats: ['G'],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.summary.strengths_count).toBe(2);
    expect(data.summary.weaknesses_count).toBe(1);
    expect(data.summary.opportunities_count).toBe(3);
    expect(data.summary.threats_count).toBe(1);
  });
});
