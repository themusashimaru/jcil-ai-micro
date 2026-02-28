// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

import { BaseTool } from '../BaseTool';

// ---------------------------------------------------------------------------
// Concrete implementation for testing
// ---------------------------------------------------------------------------

class TestTool extends BaseTool {
  name = 'test-tool';
  description = 'A test tool';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          input: { type: 'string', description: 'The input' },
        },
        required: ['input'],
      },
    };
  }

  async execute(input) {
    const error = this.validateInput(input, ['input']);
    if (error) {
      return { success: false, error };
    }
    return { success: true, result: `Executed: ${input.input}` };
  }

  // Expose protected methods
  public testValidateInput(input, required) {
    return this.validateInput(input, required);
  }

  public testFormatForStream(action, detail) {
    return this.formatForStream(action, detail);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseTool', () => {
  const tool = new TestTool();

  describe('properties', () => {
    it('should have name', () => {
      expect(tool.name).toBe('test-tool');
    });

    it('should have description', () => {
      expect(tool.description).toBe('A test tool');
    });
  });

  describe('getDefinition', () => {
    it('should return definition with name', () => {
      expect(tool.getDefinition().name).toBe('test-tool');
    });

    it('should return definition with parameters', () => {
      const def = tool.getDefinition();
      expect(def.parameters.type).toBe('object');
      expect(def.parameters.properties.input).toBeDefined();
    });

    it('should have required fields', () => {
      expect(tool.getDefinition().parameters.required).toContain('input');
    });
  });

  describe('execute', () => {
    it('should return success for valid input', async () => {
      const result = await tool.execute({ input: 'hello' });
      expect(result.success).toBe(true);
      expect(result.result).toBe('Executed: hello');
    });

    it('should return error for missing required field', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field');
    });
  });

  describe('validateInput', () => {
    it('should return null for valid input', () => {
      expect(tool.testValidateInput({ input: 'x' }, ['input'])).toBeNull();
    });

    it('should return error for missing field', () => {
      const error = tool.testValidateInput({}, ['input']);
      expect(error).toContain('input');
    });

    it('should return error for null field', () => {
      const error = tool.testValidateInput({ input: null }, ['input']);
      expect(error).toContain('input');
    });

    it('should return error for undefined field', () => {
      const error = tool.testValidateInput({ input: undefined }, ['input']);
      expect(error).toContain('input');
    });

    it('should accept 0 as valid', () => {
      expect(tool.testValidateInput({ input: 0 }, ['input'])).toBeNull();
    });

    it('should accept empty string as valid', () => {
      expect(tool.testValidateInput({ input: '' }, ['input'])).toBeNull();
    });

    it('should accept false as valid', () => {
      expect(tool.testValidateInput({ input: false }, ['input'])).toBeNull();
    });

    it('should check all required fields', () => {
      const error = tool.testValidateInput({ a: 1 }, ['a', 'b', 'c']);
      expect(error).toContain('b');
    });

    it('should return null when all required fields present', () => {
      expect(tool.testValidateInput({ a: 1, b: 2, c: 3 }, ['a', 'b', 'c'])).toBeNull();
    });

    it('should handle empty required array', () => {
      expect(tool.testValidateInput({}, [])).toBeNull();
    });
  });

  describe('formatForStream', () => {
    it('should include tool name in uppercase', () => {
      const result = tool.testFormatForStream('read', '/file.ts');
      expect(result).toContain('TEST-TOOL');
    });

    it('should include action', () => {
      const result = tool.testFormatForStream('reading', 'file.ts');
      expect(result).toContain('reading');
    });

    it('should include detail', () => {
      const result = tool.testFormatForStream('read', '/src/app.ts');
      expect(result).toContain('/src/app.ts');
    });

    it('should include formatting markers', () => {
      const result = tool.testFormatForStream('read', 'file');
      expect(result).toContain('TOOL:');
    });
  });
});
