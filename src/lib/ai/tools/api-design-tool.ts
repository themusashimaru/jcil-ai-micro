/**
 * API DESIGN TOOL
 * RESTful API design patterns and best practices
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generateOpenApiSpec(config: {
  title: string;
  version?: string;
  basePath?: string;
  resources: Array<{
    name: string;
    operations?: string[];
    fields?: Record<string, string>;
  }>;
}): string {
  const { title, version = '1.0.0', basePath = '/api/v1', resources } = config;

  const paths: Record<string, Record<string, unknown>> = {};
  const schemas: Record<string, unknown> = {};

  for (const resource of resources) {
    const resourcePath = `${basePath}/${resource.name.toLowerCase()}s`;
    const singlePath = `${resourcePath}/{id}`;

    const operations = resource.operations || ['list', 'create', 'get', 'update', 'delete'];
    const schemaName = resource.name.charAt(0).toUpperCase() + resource.name.slice(1);

    // Generate schema
    schemas[schemaName] = {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        ...(resource.fields || { name: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } })
      }
    };

    // Collection endpoints
    if (operations.includes('list') || operations.includes('create')) {
      paths[resourcePath] = {};
      if (operations.includes('list')) {
        paths[resourcePath].get = {
          summary: `List ${resource.name}s`,
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
          ],
          responses: {
            '200': { description: 'Success', content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } } } } }
          }
        };
      }
      if (operations.includes('create')) {
        paths[resourcePath].post = {
          summary: `Create ${resource.name}`,
          requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
          responses: { '201': { description: 'Created' } }
        };
      }
    }

    // Single resource endpoints
    if (operations.includes('get') || operations.includes('update') || operations.includes('delete')) {
      paths[singlePath] = {};
      if (operations.includes('get')) {
        paths[singlePath].get = {
          summary: `Get ${resource.name}`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Success' }, '404': { description: 'Not found' } }
        };
      }
      if (operations.includes('update')) {
        paths[singlePath].put = {
          summary: `Update ${resource.name}`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } }
        };
      }
      if (operations.includes('delete')) {
        paths[singlePath].delete = {
          summary: `Delete ${resource.name}`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } }
        };
      }
    }
  }

  return JSON.stringify({
    openapi: '3.0.3',
    info: { title, version },
    servers: [{ url: basePath }],
    paths,
    components: { schemas }
  }, null, 2);
}

function analyzeApiDesign(spec: Record<string, unknown>): Record<string, unknown> {
  const issues: Array<{ severity: string; issue: string; path?: string }> = [];
  const paths = spec.paths as Record<string, unknown> || {};

  for (const [path, methods] of Object.entries(paths)) {
    // Check for versioning
    if (!path.includes('/v1') && !path.includes('/v2')) {
      issues.push({ severity: 'medium', issue: 'No API versioning in path', path });
    }

    // Check for plural nouns
    const resource = path.split('/').filter(Boolean).pop() || '';
    if (resource && !resource.endsWith('s') && !resource.includes('{')) {
      issues.push({ severity: 'low', issue: 'Resource should use plural noun', path });
    }

    // Check HTTP methods
    const methodKeys = Object.keys(methods as object);
    for (const method of methodKeys) {
      const methodSpec = (methods as Record<string, Record<string, unknown>>)[method];

      // Check for response codes
      if (!methodSpec.responses) {
        issues.push({ severity: 'high', issue: 'Missing response definitions', path: `${method.toUpperCase()} ${path}` });
      }

      // Check for error responses
      const responses = methodSpec.responses as Record<string, unknown> || {};
      if (!responses['400'] && !responses['404'] && !responses['500']) {
        issues.push({ severity: 'medium', issue: 'Missing error response definitions', path: `${method.toUpperCase()} ${path}` });
      }
    }
  }

  return {
    totalEndpoints: Object.keys(paths).length,
    issues,
    score: Math.max(0, 100 - issues.filter(i => i.severity === 'high').length * 20 - issues.filter(i => i.severity === 'medium').length * 10 - issues.filter(i => i.severity === 'low').length * 5)
  };
}

function suggestEndpoints(resource: string): Record<string, unknown> {
  const plural = resource.endsWith('s') ? resource : resource + 's';
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;

  return {
    resource,
    endpoints: [
      { method: 'GET', path: `/${plural}`, description: `List all ${plural}`, queryParams: ['page', 'limit', 'sort', 'filter'] },
      { method: 'POST', path: `/${plural}`, description: `Create a new ${singular}` },
      { method: 'GET', path: `/${plural}/{id}`, description: `Get a specific ${singular}` },
      { method: 'PUT', path: `/${plural}/{id}`, description: `Update a ${singular}` },
      { method: 'PATCH', path: `/${plural}/{id}`, description: `Partial update a ${singular}` },
      { method: 'DELETE', path: `/${plural}/{id}`, description: `Delete a ${singular}` },
    ],
    nestedResources: [
      { method: 'GET', path: `/${plural}/{id}/comments`, description: `List ${singular}'s comments` },
      { method: 'POST', path: `/${plural}/{id}/comments`, description: `Add comment to ${singular}` }
    ],
    conventions: {
      naming: 'Use plural nouns (users, not user)',
      filtering: 'GET /users?status=active&role=admin',
      sorting: 'GET /users?sort=-createdAt,name',
      pagination: 'GET /users?page=1&limit=20',
      versioning: '/api/v1/users'
    }
  };
}

function generateErrorResponses(): Record<string, unknown> {
  return {
    errorFormat: {
      error: {
        code: 'ERROR_CODE',
        message: 'Human readable message',
        details: [{ field: 'email', message: 'Invalid email format' }],
        requestId: 'req_abc123'
      }
    },
    standardCodes: {
      '400': { name: 'Bad Request', use: 'Invalid input, validation errors' },
      '401': { name: 'Unauthorized', use: 'Missing or invalid authentication' },
      '403': { name: 'Forbidden', use: 'Authenticated but not authorized' },
      '404': { name: 'Not Found', use: 'Resource does not exist' },
      '409': { name: 'Conflict', use: 'Resource conflict (duplicate, version)' },
      '422': { name: 'Unprocessable Entity', use: 'Semantic validation errors' },
      '429': { name: 'Too Many Requests', use: 'Rate limit exceeded' },
      '500': { name: 'Internal Server Error', use: 'Unexpected server error' },
      '503': { name: 'Service Unavailable', use: 'Temporary unavailability' }
    }
  };
}

function designPagination(style: 'offset' | 'cursor' | 'keyset'): Record<string, unknown> {
  const strategies = {
    offset: {
      description: 'Traditional page-based pagination',
      request: 'GET /users?page=2&limit=20',
      response: {
        data: ['...'],
        pagination: { page: 2, limit: 20, total: 150, totalPages: 8 }
      },
      pros: ['Simple to implement', 'Allows jumping to any page'],
      cons: ['Performance degrades with large offsets', 'Inconsistent with real-time data']
    },
    cursor: {
      description: 'Cursor-based pagination using opaque tokens',
      request: 'GET /users?cursor=eyJpZCI6MTIzfQ&limit=20',
      response: {
        data: ['...'],
        pagination: { nextCursor: 'eyJpZCI6MTQzfQ', prevCursor: 'eyJpZCI6MTAzfQ', hasMore: true }
      },
      pros: ['Consistent results', 'Good for real-time data'],
      cons: ['Cannot jump to arbitrary pages', 'More complex to implement']
    },
    keyset: {
      description: 'Uses last item values for pagination',
      request: 'GET /users?after_id=123&limit=20',
      response: {
        data: ['...'],
        pagination: { lastId: 143, hasMore: true }
      },
      pros: ['Best performance', 'Consistent results'],
      cons: ['Requires stable sort order', 'Cannot jump pages']
    }
  };

  return strategies[style];
}

function generateRateLimitHeaders(): Record<string, unknown> {
  return {
    headers: {
      'X-RateLimit-Limit': { description: 'Max requests per window', example: '1000' },
      'X-RateLimit-Remaining': { description: 'Requests remaining', example: '999' },
      'X-RateLimit-Reset': { description: 'Window reset time (Unix timestamp)', example: '1640000000' },
      'Retry-After': { description: 'Seconds to wait when rate limited', example: '60' }
    },
    response429: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please retry after 60 seconds.',
        retryAfter: 60
      }
    },
    strategies: {
      fixedWindow: 'Simple, resets at fixed intervals',
      slidingWindow: 'More accurate, rolling time window',
      tokenBucket: 'Allows bursts while maintaining average rate',
      leakyBucket: 'Smooth output rate regardless of input'
    }
  };
}

export const apiDesignTool: UnifiedTool = {
  name: 'api_design',
  description: 'API Design: generate_openapi, analyze, suggest_endpoints, error_responses, pagination, rate_limiting',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate_openapi', 'analyze', 'suggest_endpoints', 'error_responses', 'pagination', 'rate_limiting'] },
      title: { type: 'string' },
      resources: { type: 'array' },
      resource: { type: 'string' },
      spec: { type: 'object' },
      style: { type: 'string' }
    },
    required: ['operation']
  },
};

export async function executeApiDesign(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    switch (args.operation) {
      case 'generate_openapi':
        result = generateOpenApiSpec({
          title: args.title || 'My API',
          version: args.version,
          basePath: args.basePath,
          resources: args.resources || [{ name: 'user', operations: ['list', 'create', 'get', 'update', 'delete'] }]
        });
        break;
      case 'analyze':
        result = analyzeApiDesign(args.spec || { paths: { '/users': { get: {} } } });
        break;
      case 'suggest_endpoints':
        result = suggestEndpoints(args.resource || 'user');
        break;
      case 'error_responses':
        result = generateErrorResponses();
        break;
      case 'pagination':
        result = designPagination(args.style || 'cursor');
        break;
      case 'rate_limiting':
        result = generateRateLimitHeaders();
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isApiDesignAvailable(): boolean { return true; }
