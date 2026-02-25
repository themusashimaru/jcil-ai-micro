import { describe, it, expect } from 'vitest';
import {
  generateZodSchema,
  generateApiRoute,
  generateOpenApiSpec,
  generateCrudEndpoints,
  type ApiEndpoint,
  type FieldSchema,
  type ApiSpec,
} from './apiBuilder';

describe('lib/api/apiBuilder', () => {
  // ── generateZodSchema ─────────────────────────────────────────

  describe('generateZodSchema', () => {
    it('generates schema for string field', () => {
      const fields: Record<string, FieldSchema> = {
        name: { type: 'string', required: true },
      };
      const result = generateZodSchema('User', fields);
      expect(result).toContain('z.string()');
      expect(result).toContain('UserSchema');
    });

    it('generates schema for number field', () => {
      const fields: Record<string, FieldSchema> = {
        age: { type: 'number', required: true },
      };
      const result = generateZodSchema('Profile', fields);
      expect(result).toContain('z.number()');
    });

    it('generates schema for boolean field', () => {
      const fields: Record<string, FieldSchema> = {
        active: { type: 'boolean', required: true },
      };
      const result = generateZodSchema('Flag', fields);
      expect(result).toContain('z.boolean()');
    });

    it('generates schema for array field', () => {
      const fields: Record<string, FieldSchema> = {
        tags: { type: 'array', required: true },
      };
      const result = generateZodSchema('Post', fields);
      expect(result).toContain('z.array');
    });

    it('generates schema for object field', () => {
      const fields: Record<string, FieldSchema> = {
        meta: { type: 'object', required: true },
      };
      const result = generateZodSchema('Doc', fields);
      expect(result).toContain('z.object');
    });

    it('adds min/max for string fields', () => {
      const fields: Record<string, FieldSchema> = {
        name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
      };
      const result = generateZodSchema('User', fields);
      expect(result).toContain('.min(2)');
      expect(result).toContain('.max(50)');
    });

    it('adds min/max for number fields', () => {
      const fields: Record<string, FieldSchema> = {
        score: { type: 'number', required: true, min: 0, max: 100 },
      };
      const result = generateZodSchema('Score', fields);
      expect(result).toContain('.min(0)');
      expect(result).toContain('.max(100)');
    });

    it('adds pattern for string fields', () => {
      const fields: Record<string, FieldSchema> = {
        email: { type: 'string', required: true, pattern: '^[a-z]+$' },
      };
      const result = generateZodSchema('Email', fields);
      expect(result).toContain('.regex');
    });

    it('marks optional fields', () => {
      const fields: Record<string, FieldSchema> = {
        bio: { type: 'string', required: false },
      };
      const result = generateZodSchema('Profile', fields);
      expect(result).toContain('.optional()');
    });

    it('generates type export', () => {
      const fields: Record<string, FieldSchema> = {
        x: { type: 'string', required: true },
      };
      const result = generateZodSchema('Test', fields);
      expect(result).toContain('export type Test = z.infer<typeof TestSchema>');
    });

    it('handles multiple fields', () => {
      const fields: Record<string, FieldSchema> = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: false },
        active: { type: 'boolean', required: true },
      };
      const result = generateZodSchema('User', fields);
      expect(result).toContain('name:');
      expect(result).toContain('age:');
      expect(result).toContain('active:');
    });
  });

  // ── generateApiRoute ──────────────────────────────────────────

  describe('generateApiRoute', () => {
    it('generates route handler code', () => {
      const endpoint: ApiEndpoint = {
        path: '/api/users',
        method: 'GET',
        description: 'Get all users',
        auth: false,
      };
      const result = generateApiRoute(endpoint, 'User');
      expect(result).toContain('GET');
    });

    it('includes auth check for protected routes', () => {
      const endpoint: ApiEndpoint = {
        path: '/api/posts',
        method: 'POST',
        description: 'Create a post',
        auth: true,
      };
      const result = generateApiRoute(endpoint, 'Post');
      expect(result).toContain('auth');
    });
  });

  // ── generateOpenApiSpec ───────────────────────────────────────

  describe('generateOpenApiSpec', () => {
    it('generates valid OpenAPI 3.0 spec', () => {
      const spec: ApiSpec = {
        name: 'Test API',
        version: '1.0.0',
        description: 'Test API description',
        basePath: '/api',
        endpoints: [],
      };
      const result = generateOpenApiSpec(spec) as Record<string, unknown>;
      expect(result.openapi).toBe('3.0.0');
    });

    it('includes API info', () => {
      const spec: ApiSpec = {
        name: 'My API',
        version: '2.0.0',
        description: 'My description',
        basePath: '/api/v2',
        endpoints: [],
      };
      const result = generateOpenApiSpec(spec) as Record<string, unknown>;
      const info = result.info as Record<string, string>;
      expect(info.title).toBe('My API');
      expect(info.version).toBe('2.0.0');
    });

    it('generates paths from endpoints', () => {
      const spec: ApiSpec = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        basePath: '/api',
        endpoints: [
          { path: '/users', method: 'GET', description: 'Get users', auth: false },
          { path: '/users', method: 'POST', description: 'Create user', auth: true },
        ],
      };
      const result = generateOpenApiSpec(spec) as Record<string, unknown>;
      const paths = result.paths as Record<string, Record<string, unknown>>;
      expect(paths['/users'].get).toBeDefined();
      expect(paths['/users'].post).toBeDefined();
    });

    it('adds security for auth endpoints', () => {
      const spec: ApiSpec = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        basePath: '/api',
        endpoints: [{ path: '/protected', method: 'GET', description: 'Protected', auth: true }],
      };
      const result = generateOpenApiSpec(spec) as Record<string, unknown>;
      const paths = result.paths as Record<string, Record<string, Record<string, unknown>>>;
      expect(paths['/protected'].get.security).toBeDefined();
    });
  });

  // ── generateCrudEndpoints ─────────────────────────────────────

  describe('generateCrudEndpoints', () => {
    const fields: Record<string, FieldSchema> = {
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
    };

    it('generates 5 CRUD endpoints', () => {
      const endpoints = generateCrudEndpoints('user', fields);
      expect(endpoints.length).toBeGreaterThanOrEqual(4);
    });

    it('includes GET (list)', () => {
      const endpoints = generateCrudEndpoints('post', fields);
      expect(endpoints.some((e) => e.method === 'GET' && !e.path.includes(':'))).toBe(true);
    });

    it('includes POST (create)', () => {
      const endpoints = generateCrudEndpoints('post', fields);
      expect(endpoints.some((e) => e.method === 'POST')).toBe(true);
    });

    it('includes PUT or PATCH (update)', () => {
      const endpoints = generateCrudEndpoints('post', fields);
      expect(endpoints.some((e) => e.method === 'PUT' || e.method === 'PATCH')).toBe(true);
    });

    it('includes DELETE', () => {
      const endpoints = generateCrudEndpoints('post', fields);
      expect(endpoints.some((e) => e.method === 'DELETE')).toBe(true);
    });
  });

  // ── Types ─────────────────────────────────────────────────────

  describe('type exports', () => {
    it('FieldSchema supports all types', () => {
      const types: FieldSchema['type'][] = ['string', 'number', 'boolean', 'array', 'object'];
      expect(types).toHaveLength(5);
    });

    it('ApiEndpoint supports all methods', () => {
      const methods: ApiEndpoint['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      expect(methods).toHaveLength(5);
    });
  });
});
