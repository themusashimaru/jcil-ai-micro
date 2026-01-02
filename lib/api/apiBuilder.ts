/**
 * API BUILDER
 *
 * PURPOSE:
 * - Generate REST API endpoints
 * - Add validation with Zod
 * - Generate OpenAPI documentation
 * - CRUD operations
 */

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description: string;
  requestBody?: {
    type: string;
    schema: Record<string, FieldSchema>;
  };
  responseBody?: {
    type: string;
    schema: Record<string, FieldSchema>;
  };
  auth: boolean;
  rateLimit?: number;
}

export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
}

export interface ApiSpec {
  name: string;
  version: string;
  description: string;
  basePath: string;
  endpoints: ApiEndpoint[];
}

// Generate Zod schema for validation
export function generateZodSchema(name: string, fields: Record<string, FieldSchema>): string {
  const fieldDefs = Object.entries(fields).map(([fieldName, field]) => {
    let zodType = '';

    switch (field.type) {
      case 'string':
        zodType = 'z.string()';
        if (field.minLength) zodType += `.min(${field.minLength})`;
        if (field.maxLength) zodType += `.max(${field.maxLength})`;
        if (field.pattern) zodType += `.regex(/${field.pattern}/)`;
        break;
      case 'number':
        zodType = 'z.number()';
        if (field.min !== undefined) zodType += `.min(${field.min})`;
        if (field.max !== undefined) zodType += `.max(${field.max})`;
        break;
      case 'boolean':
        zodType = 'z.boolean()';
        break;
      case 'array':
        zodType = `z.array(${field.items ? 'z.any()' : 'z.unknown()'})`;
        break;
      case 'object':
        zodType = 'z.object({})';
        break;
      default:
        zodType = 'z.unknown()';
    }

    if (!field.required) zodType += '.optional()';
    if (field.description) zodType += ` // ${field.description}`;

    return `  ${fieldName}: ${zodType}`;
  });

  return `export const ${name}Schema = z.object({\n${fieldDefs.join(',\n')}\n});

export type ${name} = z.infer<typeof ${name}Schema>;`;
}

// Generate Next.js API route
export function generateApiRoute(endpoint: ApiEndpoint, resourceName: string): string {
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);

  let code = `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

`;

  // Add request schema if needed
  if (hasBody && endpoint.requestBody) {
    code += generateZodSchema(
      `${resourceName}${endpoint.method}Request`,
      endpoint.requestBody.schema
    );
    code += '\n\n';
  }

  // Generate handler
  code += `export async function ${endpoint.method}(request: NextRequest) {
  try {`;

  // Auth check
  if (endpoint.auth) {
    code += `
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
`;
  }

  // Parse body
  if (hasBody) {
    code += `
    // Parse and validate request body
    const body = await request.json();
    const validation = ${resourceName}${endpoint.method}RequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    const data = validation.data;
`;
  }

  // Database operation based on method
  switch (endpoint.method) {
    case 'GET':
      code += `
    // Fetch data
    const { data, error } = await supabase
      .from('${resourceName.toLowerCase()}s')
      .select('*');

    if (error) throw error;
    return NextResponse.json(data);
`;
      break;
    case 'POST':
      code += `
    // Create record
    const { data: created, error } = await supabase
      .from('${resourceName.toLowerCase()}s')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(created, { status: 201 });
`;
      break;
    case 'PUT':
    case 'PATCH':
      code += `
    // Update record
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('${resourceName.toLowerCase()}s')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(updated);
`;
      break;
    case 'DELETE':
      code += `
    // Delete record
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('${resourceName.toLowerCase()}s')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
`;
      break;
  }

  code += `  } catch (error) {
    console.error('[${endpoint.path}] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
`;

  return code;
}

// Generate OpenAPI specification
export function generateOpenApiSpec(spec: ApiSpec): object {
  const paths: Record<string, Record<string, object>> = {};

  for (const endpoint of spec.endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }

    const operation: Record<string, unknown> = {
      summary: endpoint.description,
      responses: {
        '200': {
          description: 'Successful response',
          content: endpoint.responseBody
            ? {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${endpoint.responseBody.type}` },
                },
              }
            : undefined,
        },
        '400': { description: 'Bad request' },
        '401': endpoint.auth ? { description: 'Unauthorized' } : undefined,
        '500': { description: 'Server error' },
      },
    };

    if (endpoint.requestBody) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${endpoint.requestBody.type}` },
          },
        },
      };
    }

    if (endpoint.auth) {
      operation.security = [{ bearerAuth: [] }];
    }

    paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
  }

  return {
    openapi: '3.0.0',
    info: {
      title: spec.name,
      version: spec.version,
      description: spec.description,
    },
    servers: [{ url: spec.basePath }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
      schemas: {},
    },
  };
}

// Generate CRUD endpoints for a resource
export function generateCrudEndpoints(resourceName: string, fields: Record<string, FieldSchema>): ApiEndpoint[] {
  const basePath = `/api/${resourceName.toLowerCase()}s`;

  return [
    {
      path: basePath,
      method: 'GET',
      description: `Get all ${resourceName}s`,
      responseBody: {
        type: `${resourceName}List`,
        schema: {
          items: {
            type: 'array',
            required: true,
            items: { type: 'object', required: true, properties: fields },
          },
        },
      },
      auth: true,
    },
    {
      path: basePath,
      method: 'POST',
      description: `Create a new ${resourceName}`,
      requestBody: {
        type: `${resourceName}Create`,
        schema: fields,
      },
      responseBody: {
        type: resourceName,
        schema: fields,
      },
      auth: true,
    },
    {
      path: `${basePath}/[id]`,
      method: 'GET',
      description: `Get a single ${resourceName}`,
      responseBody: {
        type: resourceName,
        schema: fields,
      },
      auth: true,
    },
    {
      path: `${basePath}/[id]`,
      method: 'PUT',
      description: `Update a ${resourceName}`,
      requestBody: {
        type: `${resourceName}Update`,
        schema: fields,
      },
      responseBody: {
        type: resourceName,
        schema: fields,
      },
      auth: true,
    },
    {
      path: `${basePath}/[id]`,
      method: 'DELETE',
      description: `Delete a ${resourceName}`,
      auth: true,
    },
  ];
}
