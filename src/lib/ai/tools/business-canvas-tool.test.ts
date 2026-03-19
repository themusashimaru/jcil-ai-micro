import { describe, it, expect } from 'vitest';

import {
  businessCanvasTool,
  isBusinessCanvasAvailable,
  executeBusinessCanvas,
} from './business-canvas-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('businessCanvasTool definition', () => {
  it('should have correct name', () => {
    expect(businessCanvasTool.name).toBe('create_business_canvas');
  });

  it('should have a description', () => {
    expect(businessCanvasTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(businessCanvasTool.parameters).toBeDefined();
    expect(businessCanvasTool.parameters.type).toBe('object');
  });

  it('should require business_name and value_propositions', () => {
    expect(businessCanvasTool.parameters.required).toContain('business_name');
    expect(businessCanvasTool.parameters.required).toContain('value_propositions');
  });
});

describe('isBusinessCanvasAvailable', () => {
  it('should return true', () => {
    expect(isBusinessCanvasAvailable()).toBe(true);
  });
});

// ============================================================================
// EXECUTOR - VALID INPUT
// ============================================================================

describe('executeBusinessCanvas', () => {
  it('should generate markdown canvas with minimal input', async () => {
    const result = await executeBusinessCanvas({
      id: 'test-1',
      name: 'create_business_canvas',
      arguments: {
        business_name: 'JCIL AI',
        value_propositions: ['AI-powered education', 'Personalized learning'],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('markdown');
    expect(data.formatted_output).toContain('JCIL AI');
    expect(data.formatted_output).toContain('Value Propositions');
  });

  it('should generate HTML format when requested', async () => {
    const result = await executeBusinessCanvas({
      id: 'test-2',
      name: 'create_business_canvas',
      arguments: {
        business_name: 'HTML Canvas Test',
        value_propositions: ['Fast delivery'],
        format: 'html',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('html');
    expect(data.formatted_output).toContain('<');
    expect(data.formatted_output).toContain('HTML Canvas Test');
  });

  it('should include all 9 building blocks when provided', async () => {
    const result = await executeBusinessCanvas({
      id: 'test-3',
      name: 'create_business_canvas',
      arguments: {
        business_name: 'Full Canvas',
        value_propositions: ['Quality products'],
        customer_segments: ['Enterprise'],
        channels: ['Direct sales'],
        customer_relationships: ['Dedicated support'],
        revenue_streams: ['Subscriptions'],
        key_resources: ['Engineering team'],
        key_activities: ['Product development'],
        key_partnerships: ['Cloud providers'],
        cost_structure: ['Salaries', 'Infrastructure'],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Key Partnerships');
    expect(data.formatted_output).toContain('Cloud providers');
    expect(data.formatted_output).toContain('Revenue');
  });

  // ============================================================================
  // EXECUTOR - ERROR CASES
  // ============================================================================

  it('should error when business_name is missing', async () => {
    const result = await executeBusinessCanvas({
      id: 'test-4',
      name: 'create_business_canvas',
      arguments: {
        value_propositions: ['Something'],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when value_propositions is missing', async () => {
    const result = await executeBusinessCanvas({
      id: 'test-5',
      name: 'create_business_canvas',
      arguments: {
        business_name: 'No VP',
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeBusinessCanvas({
      id: 'my-canvas-id',
      name: 'create_business_canvas',
      arguments: {
        business_name: 'ToolCallId Test',
        value_propositions: ['Test'],
      },
    });

    expect(result.toolCallId).toBe('my-canvas-id');
  });

  it('should include summary in response', async () => {
    const result = await executeBusinessCanvas({
      id: 'test-6',
      name: 'create_business_canvas',
      arguments: {
        business_name: 'Summary Test',
        value_propositions: ['VP1', 'VP2'],
        customer_segments: ['Seg1'],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.summary).toBeDefined();
    expect(data.summary.business_name).toBe('Summary Test');
  });
});
