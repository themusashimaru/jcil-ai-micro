/**
 * NOSQL SCHEMA TOOL
 * Design NoSQL schemas for MongoDB, DynamoDB, Redis, Cassandra
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designMongoDBSchema(config: {
  collection: string;
  fields: Array<{ name: string; type: string; required?: boolean; index?: boolean; unique?: boolean }>;
  embedded?: Array<{ name: string; type: string; fields: Array<{ name: string; type: string }> }>;
  references?: Array<{ field: string; collection: string }>;
}): Record<string, unknown> {
  const { collection, fields, embedded = [], references = [] } = config;

  // Generate Mongoose schema
  const schemaFields = fields.map(f => {
    let fieldDef = `    ${f.name}: {\n      type: ${mapMongoType(f.type)}`;
    if (f.required) fieldDef += ',\n      required: true';
    if (f.unique) fieldDef += ',\n      unique: true';
    if (f.index) fieldDef += ',\n      index: true';
    fieldDef += '\n    }';
    return fieldDef;
  }).join(',\n');

  const embeddedSchemas = embedded.map(e => {
    const embFields = e.fields.map(f => `      ${f.name}: ${mapMongoType(f.type)}`).join(',\n');
    return `    ${e.name}: ${e.type === 'array' ? '[{' : '{'}\n${embFields}\n    ${e.type === 'array' ? '}]' : '}'}`;
  }).join(',\n');

  const refFields = references.map(r =>
    `    ${r.field}: { type: Schema.Types.ObjectId, ref: '${r.collection}' }`
  ).join(',\n');

  const allFields = [schemaFields, embeddedSchemas, refFields].filter(Boolean).join(',\n');

  const schema = `import { Schema, model } from 'mongoose';

const ${collection}Schema = new Schema({
${allFields}
}, {
  timestamps: true,
  collection: '${collection.toLowerCase()}s'
});

// Indexes
${fields.filter(f => f.index).map(f => `${collection}Schema.index({ ${f.name}: 1 });`).join('\n')}

// Virtual for URL
${collection}Schema.virtual('url').get(function() {
  return \`/${collection.toLowerCase()}s/\${this._id}\`;
});

export const ${collection} = model('${collection}', ${collection}Schema);`;

  return {
    schema,
    validationSchema: generateMongoValidation(collection, fields),
    indexes: generateIndexRecommendations(fields, 'mongodb'),
    bestPractices: [
      'Embed data that is accessed together',
      'Use references for large or frequently changing data',
      'Create compound indexes for common query patterns',
      'Use sparse indexes for optional fields',
      'Consider TTL indexes for expiring data'
    ]
  };
}

function mapMongoType(type: string): string {
  const mapping: Record<string, string> = {
    'string': 'String',
    'number': 'Number',
    'boolean': 'Boolean',
    'date': 'Date',
    'objectid': 'Schema.Types.ObjectId',
    'buffer': 'Buffer',
    'mixed': 'Schema.Types.Mixed',
    'array': 'Array',
    'map': 'Map'
  };
  return mapping[type.toLowerCase()] || 'String';
}

function generateMongoValidation(collection: string, fields: Array<{ name: string; type: string; required?: boolean }>): string {
  return `db.createCollection("${collection.toLowerCase()}s", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [${fields.filter(f => f.required).map(f => `"${f.name}"`).join(', ')}],
      properties: {
${fields.map(f => `        ${f.name}: {
          bsonType: "${f.type.toLowerCase()}",
          description: "must be a ${f.type}"
        }`).join(',\n')}
      }
    }
  }
})`;
}

function designDynamoDBSchema(config: {
  tableName: string;
  partitionKey: { name: string; type: 'S' | 'N' | 'B' };
  sortKey?: { name: string; type: 'S' | 'N' | 'B' };
  attributes: Array<{ name: string; type: 'S' | 'N' | 'B' | 'L' | 'M' | 'BOOL' }>;
  gsis?: Array<{ name: string; pk: string; sk?: string }>;
  lsis?: Array<{ name: string; sk: string }>;
}): Record<string, unknown> {
  const { tableName, partitionKey, sortKey, attributes, gsis = [], lsis = [] } = config;

  const keySchema = [
    { AttributeName: partitionKey.name, KeyType: 'HASH' }
  ];
  if (sortKey) {
    keySchema.push({ AttributeName: sortKey.name, KeyType: 'RANGE' });
  }

  const attrDefs = [
    { AttributeName: partitionKey.name, AttributeType: partitionKey.type }
  ];
  if (sortKey) {
    attrDefs.push({ AttributeName: sortKey.name, AttributeType: sortKey.type });
  }
  gsis.forEach(gsi => {
    if (!attrDefs.find(a => a.AttributeName === gsi.pk)) {
      const attr = attributes.find(a => a.name === gsi.pk);
      if (attr) attrDefs.push({ AttributeName: gsi.pk, AttributeType: attr.type as 'S' | 'N' | 'B' });
    }
    if (gsi.sk && !attrDefs.find(a => a.AttributeName === gsi.sk)) {
      const attr = attributes.find(a => a.name === gsi.sk);
      if (attr) attrDefs.push({ AttributeName: gsi.sk, AttributeType: attr.type as 'S' | 'N' | 'B' });
    }
  });

  const tableDefinition = {
    TableName: tableName,
    KeySchema: keySchema,
    AttributeDefinitions: attrDefs,
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: gsis.length > 0 ? gsis.map(gsi => ({
      IndexName: gsi.name,
      KeySchema: [
        { AttributeName: gsi.pk, KeyType: 'HASH' },
        ...(gsi.sk ? [{ AttributeName: gsi.sk, KeyType: 'RANGE' }] : [])
      ],
      Projection: { ProjectionType: 'ALL' }
    })) : undefined,
    LocalSecondaryIndexes: lsis.length > 0 ? lsis.map(lsi => ({
      IndexName: lsi.name,
      KeySchema: [
        { AttributeName: partitionKey.name, KeyType: 'HASH' },
        { AttributeName: lsi.sk, KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' }
    })) : undefined
  };

  // Remove undefined properties
  Object.keys(tableDefinition).forEach(key => {
    if (tableDefinition[key as keyof typeof tableDefinition] === undefined) {
      delete tableDefinition[key as keyof typeof tableDefinition];
    }
  });

  return {
    tableDefinition,
    accessPatterns: generateAccessPatterns(tableName, partitionKey, sortKey, gsis),
    singleTableDesign: generateSingleTableExample(tableName, partitionKey.name, sortKey?.name),
    awsCli: `aws dynamodb create-table --cli-input-json '${JSON.stringify(tableDefinition)}'`,
    bestPractices: [
      'Design for access patterns, not data relationships',
      'Use composite sort keys for hierarchical data',
      'Prefer GSIs over scans',
      'Use sparse indexes when applicable',
      'Consider single-table design for related entities'
    ]
  };
}

function generateAccessPatterns(
  tableName: string,
  pk: { name: string },
  sk?: { name: string },
  gsis: Array<{ name: string; pk: string; sk?: string }> = []
): Array<{ pattern: string; query: string }> {
  const patterns = [
    { pattern: `Get ${tableName} by ${pk.name}`, query: `pk = :${pk.name}` }
  ];

  if (sk) {
    patterns.push(
      { pattern: `Get ${tableName} by ${pk.name} and ${sk.name}`, query: `pk = :${pk.name} AND sk = :${sk.name}` },
      { pattern: `Get ${tableName} by ${pk.name} with ${sk.name} prefix`, query: `pk = :${pk.name} AND begins_with(sk, :prefix)` }
    );
  }

  gsis.forEach(gsi => {
    patterns.push({
      pattern: `Query by ${gsi.pk}${gsi.sk ? ` and ${gsi.sk}` : ''}`,
      query: `GSI: ${gsi.name}`
    });
  });

  return patterns;
}

function generateSingleTableExample(_tableName: string, pk: string, sk?: string): string {
  return `// Single Table Design Example
{
  // User entity
  "${pk}": "USER#123",
  ${sk ? `"${sk}": "PROFILE",` : ''}
  "email": "user@example.com",
  "name": "John Doe",
  "type": "USER"
}

{
  // Order entity (related to user)
  "${pk}": "USER#123",
  ${sk ? `"${sk}": "ORDER#2024-001",` : ''}
  "total": 99.99,
  "status": "shipped",
  "type": "ORDER"
}

// Query all orders for user:
// pk = "USER#123" AND begins_with(sk, "ORDER#")`;
}

function designRedisSchema(config: {
  useCase: 'cache' | 'session' | 'leaderboard' | 'rate_limit' | 'pub_sub' | 'queue';
  entityName: string;
  fields?: string[];
}): Record<string, unknown> {
  const { useCase, entityName } = config;

  const patterns: Record<string, Record<string, unknown>> = {
    cache: {
      keyPattern: `cache:${entityName}:{id}`,
      dataType: 'STRING or HASH',
      operations: [
        `SET cache:${entityName}:123 '{"data": "value"}' EX 3600`,
        `GET cache:${entityName}:123`,
        `HSET cache:${entityName}:123 field1 value1 field2 value2`,
        `HGETALL cache:${entityName}:123`
      ],
      ttlStrategy: 'Set TTL based on data freshness requirements',
      eviction: 'volatile-lru or allkeys-lru'
    },
    session: {
      keyPattern: `session:{session_id}`,
      dataType: 'HASH',
      operations: [
        `HSET session:abc123 user_id 456 created_at 1704067200 data '{"cart": []}'`,
        `HGET session:abc123 user_id`,
        `EXPIRE session:abc123 86400`,
        `DEL session:abc123`
      ],
      ttlStrategy: 'Set session expiry (e.g., 24 hours)',
      security: 'Use secure session IDs, consider encryption'
    },
    leaderboard: {
      keyPattern: `leaderboard:${entityName}`,
      dataType: 'SORTED SET',
      operations: [
        `ZADD leaderboard:${entityName} 100 user:123`,
        `ZINCRBY leaderboard:${entityName} 10 user:123`,
        `ZREVRANGE leaderboard:${entityName} 0 9 WITHSCORES`,
        `ZRANK leaderboard:${entityName} user:123`,
        `ZREVRANK leaderboard:${entityName} user:123`
      ],
      queries: [
        'Top N players',
        'Player rank',
        'Players in score range'
      ]
    },
    rate_limit: {
      keyPattern: `ratelimit:{identifier}:{window}`,
      dataType: 'STRING with INCR or Sorted Set',
      operations: [
        '// Fixed window',
        `INCR ratelimit:user:123:${Math.floor(Date.now() / 60000)}`,
        `EXPIRE ratelimit:user:123:${Math.floor(Date.now() / 60000)} 60`,
        '',
        '// Sliding window with sorted set',
        `ZADD ratelimit:user:123 ${Date.now()} ${Date.now()}`,
        `ZREMRANGEBYSCORE ratelimit:user:123 0 ${Date.now() - 60000}`,
        `ZCARD ratelimit:user:123`
      ],
      algorithms: ['Fixed Window', 'Sliding Window', 'Token Bucket', 'Leaky Bucket']
    },
    pub_sub: {
      keyPattern: `channel:${entityName}`,
      dataType: 'Pub/Sub Channel',
      operations: [
        `SUBSCRIBE channel:${entityName}`,
        `PUBLISH channel:${entityName} '{"event": "update", "data": {}}'`,
        `PSUBSCRIBE channel:${entityName}:*`
      ],
      patterns: ['Broadcast', 'Fan-out', 'Event notifications']
    },
    queue: {
      keyPattern: `queue:${entityName}`,
      dataType: 'LIST or STREAM',
      operations: [
        '// List-based queue',
        `LPUSH queue:${entityName} '{"job": "data"}'`,
        `BRPOP queue:${entityName} 0`,
        '',
        '// Stream-based queue (recommended)',
        `XADD stream:${entityName} * job data`,
        `XREAD COUNT 1 BLOCK 0 STREAMS stream:${entityName} $`,
        `XREADGROUP GROUP mygroup consumer1 COUNT 1 STREAMS stream:${entityName} >`,
        `XACK stream:${entityName} mygroup message_id`
      ],
      features: ['Consumer groups', 'Message acknowledgment', 'Dead letter queue']
    }
  };

  return {
    useCase,
    pattern: patterns[useCase],
    nodeCode: generateRedisNodeCode(useCase, entityName),
    bestPractices: [
      'Use meaningful key prefixes',
      'Set appropriate TTLs',
      'Use pipelining for multiple operations',
      'Consider memory limits',
      'Use Lua scripts for atomic operations'
    ]
  };
}

function generateRedisNodeCode(useCase: string, entityName: string): string {
  const codes: Record<string, string> = {
    cache: `import Redis from 'ioredis';

const redis = new Redis();

async function cacheGet(id: string) {
  const cached = await redis.get(\`cache:${entityName}:\${id}\`);
  return cached ? JSON.parse(cached) : null;
}

async function cacheSet(id: string, data: unknown, ttl = 3600) {
  await redis.setex(\`cache:${entityName}:\${id}\`, ttl, JSON.stringify(data));
}`,
    leaderboard: `import Redis from 'ioredis';

const redis = new Redis();

async function addScore(userId: string, score: number) {
  await redis.zadd('leaderboard:${entityName}', score, userId);
}

async function getTopPlayers(count = 10) {
  return redis.zrevrange('leaderboard:${entityName}', 0, count - 1, 'WITHSCORES');
}

async function getRank(userId: string) {
  return redis.zrevrank('leaderboard:${entityName}', userId);
}`,
    rate_limit: `import Redis from 'ioredis';

const redis = new Redis();

async function checkRateLimit(identifier: string, limit: number, windowSec: number) {
  const key = \`ratelimit:\${identifier}:\${Math.floor(Date.now() / 1000 / windowSec)}\`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSec);
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
    reset: Math.ceil(Date.now() / 1000 / windowSec) * windowSec
  };
}`
  };

  return codes[useCase] || codes.cache;
}

function designCassandraSchema(config: {
  keyspace: string;
  table: string;
  partitionKey: string[];
  clusteringColumns?: Array<{ name: string; order?: 'ASC' | 'DESC' }>;
  columns: Array<{ name: string; type: string }>;
  queries: string[];
}): Record<string, unknown> {
  const { keyspace, table, partitionKey, clusteringColumns = [], columns, queries } = config;

  const pkStr = partitionKey.length > 1 ? `(${partitionKey.join(', ')})` : partitionKey[0];
  const ccStr = clusteringColumns.map(c => c.name).join(', ');
  const primaryKey = ccStr ? `(${pkStr}, ${ccStr})` : `(${pkStr})`;

  const clusteringOrder = clusteringColumns.length > 0
    ? `WITH CLUSTERING ORDER BY (${clusteringColumns.map(c => `${c.name} ${c.order || 'ASC'}`).join(', ')})`
    : '';

  const cql = `CREATE KEYSPACE IF NOT EXISTS ${keyspace}
  WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 3};

USE ${keyspace};

CREATE TABLE IF NOT EXISTS ${table} (
${columns.map(c => `    ${c.name} ${c.type},`).join('\n')}
    PRIMARY KEY ${primaryKey}
) ${clusteringOrder};`;

  return {
    cql,
    dataModel: {
      keyspace,
      table,
      partitionKey,
      clusteringColumns,
      columns
    },
    queryPatterns: queries.map(q => ({
      query: q,
      cql: generateCassandraCQL(table, q, partitionKey, clusteringColumns)
    })),
    bestPractices: [
      'Design tables for specific queries (query-first design)',
      'Keep partition sizes under 100MB',
      'Avoid large partitions (wide rows)',
      'Use appropriate data types',
      'Consider denormalization',
      'Use TTL for time-series data'
    ]
  };
}

function generateCassandraCQL(
  table: string,
  query: string,
  pk: string[],
  cc: Array<{ name: string }>
): string {
  if (query.includes('by id')) {
    return `SELECT * FROM ${table} WHERE ${pk[0]} = ?;`;
  }
  if (query.includes('range')) {
    return `SELECT * FROM ${table} WHERE ${pk[0]} = ? AND ${cc[0]?.name || 'created_at'} >= ? AND ${cc[0]?.name || 'created_at'} <= ?;`;
  }
  if (query.includes('latest')) {
    return `SELECT * FROM ${table} WHERE ${pk[0]} = ? ORDER BY ${cc[0]?.name || 'created_at'} DESC LIMIT 10;`;
  }
  return `SELECT * FROM ${table} WHERE ${pk[0]} = ?;`;
}

function generateIndexRecommendations(fields: Array<{ name: string; index?: boolean }>, db: string): string[] {
  const recommendations: string[] = [];

  fields.filter(f => f.index).forEach(f => {
    recommendations.push(`Create index on ${f.name}`);
  });

  recommendations.push(
    'Index fields used in WHERE clauses',
    'Index fields used in ORDER BY',
    'Consider compound indexes for multi-field queries',
    `Avoid over-indexing (${db === 'mongodb' ? 'max ~64 indexes' : 'balance read vs write performance'})`
  );

  return recommendations;
}

export const nosqlSchemaTool: UnifiedTool = {
  name: 'nosql_schema',
  description: 'NoSQL Schema: mongodb, dynamodb, redis, cassandra',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['mongodb', 'dynamodb', 'redis', 'cassandra'] },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeNosqlSchema(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'mongodb':
        result = designMongoDBSchema(args.config || {
          collection: 'User',
          fields: [
            { name: 'email', type: 'string', required: true, unique: true, index: true },
            { name: 'name', type: 'string', required: true },
            { name: 'age', type: 'number' },
            { name: 'isActive', type: 'boolean' }
          ],
          embedded: [
            { name: 'address', type: 'object', fields: [
              { name: 'street', type: 'string' },
              { name: 'city', type: 'string' },
              { name: 'zip', type: 'string' }
            ]}
          ],
          references: [
            { field: 'orders', collection: 'Order' }
          ]
        });
        break;
      case 'dynamodb':
        result = designDynamoDBSchema(args.config || {
          tableName: 'Users',
          partitionKey: { name: 'pk', type: 'S' },
          sortKey: { name: 'sk', type: 'S' },
          attributes: [
            { name: 'email', type: 'S' },
            { name: 'createdAt', type: 'N' }
          ],
          gsis: [
            { name: 'EmailIndex', pk: 'email' }
          ]
        });
        break;
      case 'redis':
        result = designRedisSchema(args.config || {
          useCase: 'cache',
          entityName: 'user',
          fields: ['id', 'email', 'name']
        });
        break;
      case 'cassandra':
        result = designCassandraSchema(args.config || {
          keyspace: 'myapp',
          table: 'user_events',
          partitionKey: ['user_id'],
          clusteringColumns: [{ name: 'event_time', order: 'DESC' }],
          columns: [
            { name: 'user_id', type: 'uuid' },
            { name: 'event_time', type: 'timestamp' },
            { name: 'event_type', type: 'text' },
            { name: 'data', type: 'text' }
          ],
          queries: ['Get events by user', 'Get latest events', 'Get events in time range']
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isNosqlSchemaAvailable(): boolean { return true; }
