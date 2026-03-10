/**
 * Tool Schema Validation
 *
 * Enforces strict schema requirements for all tool definitions:
 * - additionalProperties: false (prevent unexpected fields)
 * - Non-empty required array (explicit required fields)
 *
 * Run at boot to fail fast on schema issues.
 */

export interface ToolSchema {
  name?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
  parameters?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ValidationError {
  name: string;
  issue: string;
}

/**
 * Assert that a tool schema has additionalProperties: false
 */
export function assertNoAdditionalProperties(schema: ToolSchema, name: string): void {
  const params = schema.function?.parameters || schema.parameters;
  const hasAdditionalPropertiesFalse = params?.additionalProperties === false;

  if (!hasAdditionalPropertiesFalse) {
    throw new Error(
      `Tool schema "${name}" must set parameters.additionalProperties=false to prevent unexpected fields`
    );
  }
}

/**
 * Assert that a tool schema has a non-empty required array
 */
export function assertRequired(schema: ToolSchema, name: string): void {
  const params = schema.function?.parameters || schema.parameters;
  const hasRequired = Array.isArray(params?.required) && params.required.length > 0;

  // Only enforce if there are properties defined
  const hasProperties = params?.properties && Object.keys(params.properties).length > 0;

  if (hasProperties && !hasRequired) {
    throw new Error(
      `Tool schema "${name}" must define non-empty "required" array to explicitly declare required fields`
    );
  }
}

/**
 * Validate a single tool schema
 * Returns array of issues found (empty if valid)
 */
export function validateToolSchema(schema: ToolSchema): ValidationError[] {
  const errors: ValidationError[] = [];
  const name = schema.function?.name || schema.name || 'unnamed';
  const params = schema.function?.parameters || schema.parameters;

  if (!params) {
    errors.push({ name, issue: 'Missing parameters definition' });
    return errors;
  }

  // Check additionalProperties
  if (params.additionalProperties !== false) {
    errors.push({
      name,
      issue: 'Missing or incorrect additionalProperties (must be false)',
    });
  }

  // Check required array (only if properties exist)
  const hasProperties = params.properties && Object.keys(params.properties).length > 0;
  if (hasProperties && (!Array.isArray(params.required) || params.required.length === 0)) {
    errors.push({
      name,
      issue: 'Missing or empty required array',
    });
  }

  // Validate required fields exist in properties
  if (Array.isArray(params.required) && params.properties) {
    for (const field of params.required) {
      if (!(field in params.properties)) {
        errors.push({
          name,
          issue: `Required field "${field}" not defined in properties`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate an array of tool schemas
 * Throws if any schema is invalid (for boot-time validation)
 */
export function validateAllToolSchemas(
  schemas: ToolSchema[],
  throwOnError = true
): { valid: boolean; errors: ValidationError[] } {
  const allErrors: ValidationError[] = [];

  for (const schema of schemas) {
    const errors = validateToolSchema(schema);
    allErrors.push(...errors);
  }

  if (throwOnError && allErrors.length > 0) {
    const errorMessage = allErrors
      .map(e => `  - ${e.name}: ${e.issue}`)
      .join('\n');
    throw new Error(`Tool schema validation failed:\n${errorMessage}`);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Create a valid tool schema with required fields
 * Helper function to ensure schemas are created correctly
 */
export function createToolSchema(config: {
  name: string;
  description: string;
  properties: Record<string, unknown>;
  required: string[];
}): ToolSchema {
  return {
    name: config.name,
    function: {
      name: config.name,
      description: config.description,
      parameters: {
        type: 'object',
        properties: config.properties,
        required: config.required,
        additionalProperties: false,
      },
    },
  };
}

// Example tool schemas can be added here using createToolSchema()
