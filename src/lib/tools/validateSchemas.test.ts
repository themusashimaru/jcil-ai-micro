import { describe, it, expect } from 'vitest';
import {
  assertNoAdditionalProperties,
  assertRequired,
  validateToolSchema,
  validateAllToolSchemas,
  createToolSchema,
  type ToolSchema,
  type ValidationError,
} from './validateSchemas';

describe('validateSchemas', () => {
  // ── assertNoAdditionalProperties ──────────────────────────────

  describe('assertNoAdditionalProperties', () => {
    it('passes when additionalProperties is false on top-level parameters', () => {
      const schema: ToolSchema = {
        parameters: { additionalProperties: false },
      };
      expect(() => assertNoAdditionalProperties(schema, 'test')).not.toThrow();
    });

    it('passes when additionalProperties is false on function.parameters', () => {
      const schema: ToolSchema = {
        function: { parameters: { additionalProperties: false } },
      };
      expect(() => assertNoAdditionalProperties(schema, 'test')).not.toThrow();
    });

    it('throws when additionalProperties is missing', () => {
      const schema: ToolSchema = {
        parameters: { type: 'object' },
      };
      expect(() => assertNoAdditionalProperties(schema, 'myTool')).toThrow(
        'Tool schema "myTool" must set parameters.additionalProperties=false'
      );
    });

    it('throws when additionalProperties is true', () => {
      const schema: ToolSchema = {
        parameters: { additionalProperties: true as unknown as boolean },
      };
      expect(() => assertNoAdditionalProperties(schema, 'myTool')).toThrow();
    });

    it('throws when no parameters exist', () => {
      const schema: ToolSchema = { name: 'empty' };
      expect(() => assertNoAdditionalProperties(schema, 'empty')).toThrow();
    });
  });

  // ── assertRequired ────────────────────────────────────────────

  describe('assertRequired', () => {
    it('passes when required array is non-empty', () => {
      const schema: ToolSchema = {
        parameters: {
          properties: { foo: {} },
          required: ['foo'],
        },
      };
      expect(() => assertRequired(schema, 'test')).not.toThrow();
    });

    it('passes when there are no properties (nothing to require)', () => {
      const schema: ToolSchema = {
        parameters: { type: 'object' },
      };
      expect(() => assertRequired(schema, 'test')).not.toThrow();
    });

    it('throws when properties exist but required is empty', () => {
      const schema: ToolSchema = {
        parameters: {
          properties: { foo: {} },
          required: [],
        },
      };
      expect(() => assertRequired(schema, 'myTool')).toThrow(
        'Tool schema "myTool" must define non-empty "required" array'
      );
    });

    it('throws when properties exist but required is missing', () => {
      const schema: ToolSchema = {
        parameters: {
          properties: { foo: {} },
        },
      };
      expect(() => assertRequired(schema, 'myTool')).toThrow();
    });

    it('works with function.parameters', () => {
      const schema: ToolSchema = {
        function: {
          parameters: {
            properties: { a: {} },
            required: ['a'],
          },
        },
      };
      expect(() => assertRequired(schema, 'test')).not.toThrow();
    });
  });

  // ── validateToolSchema ────────────────────────────────────────

  describe('validateToolSchema', () => {
    it('returns empty array for valid schema', () => {
      const schema: ToolSchema = {
        function: {
          name: 'validTool',
          parameters: {
            type: 'object',
            properties: { input: { type: 'string' } },
            required: ['input'],
            additionalProperties: false,
          },
        },
      };
      expect(validateToolSchema(schema)).toEqual([]);
    });

    it('returns error when parameters are missing', () => {
      const schema: ToolSchema = { name: 'noParams' };
      const errors = validateToolSchema(schema);
      expect(errors).toHaveLength(1);
      expect(errors[0].issue).toContain('Missing parameters definition');
    });

    it('returns error for missing additionalProperties', () => {
      const schema: ToolSchema = {
        name: 'badSchema',
        parameters: {
          type: 'object',
          properties: { x: {} },
          required: ['x'],
        },
      };
      const errors = validateToolSchema(schema);
      expect(errors.some((e) => e.issue.includes('additionalProperties'))).toBe(true);
    });

    it('returns error for empty required array when properties exist', () => {
      const schema: ToolSchema = {
        name: 'noRequired',
        parameters: {
          type: 'object',
          properties: { x: {} },
          required: [],
          additionalProperties: false,
        },
      };
      const errors = validateToolSchema(schema);
      expect(errors.some((e) => e.issue.includes('required'))).toBe(true);
    });

    it('returns error when required field not in properties', () => {
      const schema: ToolSchema = {
        name: 'mismatch',
        parameters: {
          type: 'object',
          properties: { a: {} },
          required: ['a', 'b'],
          additionalProperties: false,
        },
      };
      const errors = validateToolSchema(schema);
      expect(errors.some((e) => e.issue.includes('"b"'))).toBe(true);
    });

    it('uses function.name over name', () => {
      const schema: ToolSchema = {
        name: 'outerName',
        function: { name: 'innerName', parameters: {} },
      };
      const errors = validateToolSchema(schema);
      expect(errors[0].name).toBe('innerName');
    });

    it('uses "unnamed" when no name is provided', () => {
      const schema: ToolSchema = { parameters: {} };
      const errors = validateToolSchema(schema);
      expect(errors[0].name).toBe('unnamed');
    });

    it('can return multiple errors for one schema', () => {
      const schema: ToolSchema = {
        name: 'badTool',
        parameters: {
          type: 'object',
          properties: { x: {} },
          required: ['x', 'y'],
          // missing additionalProperties: false
        },
      };
      const errors = validateToolSchema(schema);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── validateAllToolSchemas ────────────────────────────────────

  describe('validateAllToolSchemas', () => {
    const validSchema: ToolSchema = {
      function: {
        name: 'good',
        parameters: {
          type: 'object',
          properties: { a: {} },
          required: ['a'],
          additionalProperties: false,
        },
      },
    };

    it('returns valid:true for all valid schemas', () => {
      const result = validateAllToolSchemas([validSchema, validSchema], false);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('throws by default when schemas are invalid', () => {
      const bad: ToolSchema = { name: 'bad', parameters: {} };
      expect(() => validateAllToolSchemas([bad])).toThrow('Tool schema validation failed');
    });

    it('returns errors without throwing when throwOnError is false', () => {
      const bad: ToolSchema = { name: 'bad', parameters: {} };
      const result = validateAllToolSchemas([bad], false);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles empty array', () => {
      const result = validateAllToolSchemas([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('collects errors from multiple schemas', () => {
      const bad1: ToolSchema = { name: 'bad1', parameters: {} };
      const bad2: ToolSchema = { name: 'bad2', parameters: {} };
      const result = validateAllToolSchemas([bad1, bad2], false);
      expect(result.errors.some((e) => e.name === 'bad1')).toBe(true);
      expect(result.errors.some((e) => e.name === 'bad2')).toBe(true);
    });
  });

  // ── createToolSchema ──────────────────────────────────────────

  describe('createToolSchema', () => {
    it('creates a properly structured schema', () => {
      const schema = createToolSchema({
        name: 'myTool',
        description: 'A test tool',
        properties: { input: { type: 'string' } },
        required: ['input'],
      });

      expect(schema.name).toBe('myTool');
      expect(schema.function?.name).toBe('myTool');
      expect(schema.function?.description).toBe('A test tool');
      expect(schema.function?.parameters?.type).toBe('object');
      expect(schema.function?.parameters?.additionalProperties).toBe(false);
      expect(schema.function?.parameters?.required).toEqual(['input']);
      expect(schema.function?.parameters?.properties).toEqual({ input: { type: 'string' } });
    });

    it('created schemas pass validation', () => {
      const schema = createToolSchema({
        name: 'valid',
        description: 'desc',
        properties: { x: { type: 'number' } },
        required: ['x'],
      });
      const errors = validateToolSchema(schema);
      expect(errors).toHaveLength(0);
    });

    it('handles multiple properties and required fields', () => {
      const schema = createToolSchema({
        name: 'multi',
        description: 'multi-prop',
        properties: {
          a: { type: 'string' },
          b: { type: 'number' },
          c: { type: 'boolean' },
        },
        required: ['a', 'b'],
      });
      expect(schema.function?.parameters?.required).toEqual(['a', 'b']);
      expect(Object.keys(schema.function?.parameters?.properties || {})).toHaveLength(3);
    });
  });

  // ── Type exports ──────────────────────────────────────────────

  describe('type exports', () => {
    it('ToolSchema type works correctly', () => {
      const schema: ToolSchema = {
        name: 'test',
        function: {
          name: 'test',
          description: 'desc',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      };
      expect(schema).toBeDefined();
    });

    it('ValidationError type works correctly', () => {
      const error: ValidationError = {
        name: 'tool',
        issue: 'something wrong',
      };
      expect(error.name).toBe('tool');
      expect(error.issue).toBe('something wrong');
    });
  });
});
