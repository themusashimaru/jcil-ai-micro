/**
 * GRAPHQL SCHEMA TOOL
 * Generate and analyze GraphQL schemas
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generateSchema(config: {
  types: Array<{
    name: string;
    fields: Record<string, string>;
    relations?: Record<string, string>;
  }>;
  queries?: string[];
  mutations?: string[];
}): string {
  const { types, queries = [], mutations = [] } = config;

  let schema = '';

  // Generate types
  for (const type of types) {
    schema += `type ${type.name} {\n`;
    schema += `  id: ID!\n`;

    for (const [field, fieldType] of Object.entries(type.fields)) {
      schema += `  ${field}: ${fieldType}\n`;
    }

    if (type.relations) {
      for (const [field, relatedType] of Object.entries(type.relations)) {
        schema += `  ${field}: ${relatedType}\n`;
      }
    }

    schema += `  createdAt: DateTime!\n`;
    schema += `  updatedAt: DateTime!\n`;
    schema += `}\n\n`;

    // Generate input types
    schema += `input ${type.name}Input {\n`;
    for (const [field, fieldType] of Object.entries(type.fields)) {
      const inputType = fieldType.replace('!', '').replace('[', '').replace(']', '');
      schema += `  ${field}: ${inputType}\n`;
    }
    schema += `}\n\n`;
  }

  // Generate Query type
  schema += `type Query {\n`;
  for (const type of types) {
    const typeName = type.name;
    const pluralName = typeName.toLowerCase() + 's';
    schema += `  ${typeName.toLowerCase()}(id: ID!): ${typeName}\n`;
    schema += `  ${pluralName}(filter: ${typeName}Filter, pagination: PaginationInput): ${typeName}Connection!\n`;
  }
  for (const query of queries) {
    schema += `  ${query}\n`;
  }
  schema += `}\n\n`;

  // Generate Mutation type
  schema += `type Mutation {\n`;
  for (const type of types) {
    const typeName = type.name;
    schema += `  create${typeName}(input: ${typeName}Input!): ${typeName}!\n`;
    schema += `  update${typeName}(id: ID!, input: ${typeName}Input!): ${typeName}!\n`;
    schema += `  delete${typeName}(id: ID!): Boolean!\n`;
  }
  for (const mutation of mutations) {
    schema += `  ${mutation}\n`;
  }
  schema += `}\n\n`;

  // Common types
  schema += `scalar DateTime

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
}
`;

  // Generate Connection types for each type
  for (const type of types) {
    schema += `
type ${type.name}Edge {
  node: ${type.name}!
  cursor: String!
}

type ${type.name}Connection {
  edges: [${type.name}Edge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

input ${type.name}Filter {
  AND: [${type.name}Filter!]
  OR: [${type.name}Filter!]
  id: IDFilter
${Object.keys(type.fields).map(f => `  ${f}: StringFilter`).join('\n')}
}
`;
  }

  schema += `
input IDFilter {
  eq: ID
  ne: ID
  in: [ID!]
}

input StringFilter {
  eq: String
  ne: String
  contains: String
  startsWith: String
  in: [String!]
}
`;

  return schema;
}

function generateResolvers(types: Array<{ name: string; fields: Record<string, string> }>): string {
  let resolvers = `const resolvers = {\n`;

  resolvers += `  Query: {\n`;
  for (const type of types) {
    const name = type.name;
    const lowerName = name.toLowerCase();
    resolvers += `    ${lowerName}: async (_, { id }, { dataSources }) => {
      return dataSources.${lowerName}API.get(id);
    },
    ${lowerName}s: async (_, { filter, pagination }, { dataSources }) => {
      return dataSources.${lowerName}API.list(filter, pagination);
    },\n`;
  }
  resolvers += `  },\n\n`;

  resolvers += `  Mutation: {\n`;
  for (const type of types) {
    const name = type.name;
    const lowerName = name.toLowerCase();
    resolvers += `    create${name}: async (_, { input }, { dataSources }) => {
      return dataSources.${lowerName}API.create(input);
    },
    update${name}: async (_, { id, input }, { dataSources }) => {
      return dataSources.${lowerName}API.update(id, input);
    },
    delete${name}: async (_, { id }, { dataSources }) => {
      return dataSources.${lowerName}API.delete(id);
    },\n`;
  }
  resolvers += `  },\n`;

  resolvers += `};\n\nexport default resolvers;`;

  return resolvers;
}

function analyzeSchema(schema: string): Record<string, unknown> {
  const issues: Array<{ severity: string; issue: string; suggestion: string }> = [];

  // Check for N+1 potential
  const relationMatches = schema.match(/\[(\w+)!?\]/g) || [];
  if (relationMatches.length > 3) {
    issues.push({
      severity: 'high',
      issue: 'Multiple list relations detected - N+1 query risk',
      suggestion: 'Use DataLoader for batching related queries'
    });
  }

  // Check for missing pagination
  const listTypes = schema.match(/\[(\w+)!?\]!/g) || [];
  const hasConnections = schema.includes('Connection');
  if (listTypes.length > 2 && !hasConnections) {
    issues.push({
      severity: 'medium',
      issue: 'List types without pagination',
      suggestion: 'Use Relay-style connections for pagination'
    });
  }

  // Check for missing input validation
  if (!schema.includes('@constraint') && !schema.includes('@length')) {
    issues.push({
      severity: 'low',
      issue: 'No input validation directives',
      suggestion: 'Add validation directives like @constraint for input validation'
    });
  }

  // Check for nullable types
  const nullableFields = (schema.match(/:\s*\w+[^!]\n/g) || []).length;
  if (nullableFields > 10) {
    issues.push({
      severity: 'low',
      issue: `${nullableFields} nullable fields - consider explicit nullability`,
      suggestion: 'Be explicit about which fields can be null'
    });
  }

  const typeCount = (schema.match(/^type\s+\w+/gm) || []).length;
  const queryCount = (schema.match(/^\s+\w+\([^)]*\):/gm) || []).length;

  return {
    stats: {
      types: typeCount,
      queries: queryCount,
      relationships: relationMatches.length
    },
    issues,
    score: Math.max(0, 100 - issues.filter(i => i.severity === 'high').length * 20 - issues.filter(i => i.severity === 'medium').length * 10)
  };
}

function generateFromRest(endpoints: Array<{
  method: string;
  path: string;
  params?: string[];
  body?: Record<string, string>;
  response: string;
}>): string {
  const types = new Map<string, Record<string, string>>();
  const queries: string[] = [];
  const mutations: string[] = [];

  for (const endpoint of endpoints) {
    const resourceMatch = endpoint.path.match(/\/(\w+)s?(?:\/|$)/);
    const resource = resourceMatch ? resourceMatch[1] : 'Resource';
    const typeName = resource.charAt(0).toUpperCase() + resource.slice(1);

    if (!types.has(typeName)) {
      types.set(typeName, {});
    }

    if (endpoint.body) {
      const typeFields = types.get(typeName)!;
      for (const [field, type] of Object.entries(endpoint.body)) {
        typeFields[field] = type === 'string' ? 'String' : type === 'number' ? 'Int' : type === 'boolean' ? 'Boolean' : 'String';
      }
    }

    const hasIdParam = endpoint.path.includes('{id}') || endpoint.path.includes(':id');

    switch (endpoint.method.toUpperCase()) {
      case 'GET':
        if (hasIdParam) {
          queries.push(`${resource}(id: ID!): ${typeName}`);
        } else {
          queries.push(`${resource}s(filter: ${typeName}Filter): [${typeName}!]!`);
        }
        break;
      case 'POST':
        mutations.push(`create${typeName}(input: ${typeName}Input!): ${typeName}!`);
        break;
      case 'PUT':
      case 'PATCH':
        mutations.push(`update${typeName}(id: ID!, input: ${typeName}Input!): ${typeName}!`);
        break;
      case 'DELETE':
        mutations.push(`delete${typeName}(id: ID!): Boolean!`);
        break;
    }
  }

  let schema = '';
  for (const [typeName, fields] of types) {
    schema += `type ${typeName} {\n  id: ID!\n`;
    for (const [field, type] of Object.entries(fields)) {
      schema += `  ${field}: ${type}\n`;
    }
    schema += `}\n\n`;
  }

  schema += `type Query {\n${queries.map(q => `  ${q}`).join('\n')}\n}\n\n`;
  schema += `type Mutation {\n${mutations.map(m => `  ${m}`).join('\n')}\n}`;

  return schema;
}

function generateDataLoader(typeName: string): string {
  return `import DataLoader from 'dataloader';
import { ${typeName} } from './types';
import { db } from './db';

export function create${typeName}Loader() {
  return new DataLoader<string, ${typeName}>(async (ids) => {
    const items = await db.${typeName.toLowerCase()}.findMany({
      where: { id: { in: [...ids] } }
    });

    const itemMap = new Map(items.map(item => [item.id, item]));
    return ids.map(id => itemMap.get(id) || null);
  });
}

// Usage in context:
// context: ({ req }) => ({
//   loaders: {
//     ${typeName.toLowerCase()}: create${typeName}Loader()
//   }
// })

// Usage in resolver:
// ${typeName.toLowerCase()}: (parent, _, { loaders }) => {
//   return loaders.${typeName.toLowerCase()}.load(parent.${typeName.toLowerCase()}Id);
// }
`;
}

export const graphqlSchemaTool: UnifiedTool = {
  name: 'graphql_schema',
  description: 'GraphQL Schema: generate, resolvers, analyze, from_rest, dataloader',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'resolvers', 'analyze', 'from_rest', 'dataloader'] },
      types: { type: 'array' },
      schema: { type: 'string' },
      endpoints: { type: 'array' },
      typeName: { type: 'string' }
    },
    required: ['operation']
  },
};

export async function executeGraphqlSchema(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    const sampleTypes = [
      { name: 'User', fields: { email: 'String!', name: 'String' }, relations: { posts: '[Post!]!' } },
      { name: 'Post', fields: { title: 'String!', content: 'String' }, relations: { author: 'User!' } }
    ];

    switch (args.operation) {
      case 'generate':
        result = generateSchema({ types: args.types || sampleTypes });
        break;
      case 'resolvers':
        result = generateResolvers(args.types || sampleTypes);
        break;
      case 'analyze':
        result = analyzeSchema(args.schema || 'type User { id: ID! posts: [Post] }');
        break;
      case 'from_rest':
        result = generateFromRest(args.endpoints || [
          { method: 'GET', path: '/users', response: 'User[]' },
          { method: 'GET', path: '/users/:id', response: 'User' },
          { method: 'POST', path: '/users', body: { email: 'string', name: 'string' }, response: 'User' }
        ]);
        break;
      case 'dataloader':
        result = generateDataLoader(args.typeName || 'User');
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isGraphqlSchemaAvailable(): boolean { return true; }
