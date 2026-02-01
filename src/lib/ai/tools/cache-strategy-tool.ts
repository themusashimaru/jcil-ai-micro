/**
 * CACHE STRATEGY TOOL
 * Caching layer design and optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const CACHE_PATTERNS = {
  cacheAside: {
    name: 'Cache-Aside (Lazy Loading)',
    description: 'Application manages cache explicitly',
    flow: ['1. Check cache', '2. If miss, fetch from DB', '3. Store in cache', '4. Return data'],
    pros: ['Simple implementation', 'Only requested data cached', 'Works with any data store'],
    cons: ['Cache misses hit DB', 'Possible stale data', 'Application complexity'],
    useCase: 'General purpose, read-heavy workloads',
    code: `async function getData(key) {
  let data = await cache.get(key);
  if (!data) {
    data = await db.find(key);
    await cache.set(key, data, TTL);
  }
  return data;
}`
  },
  writeThrough: {
    name: 'Write-Through',
    description: 'Write to cache and DB synchronously',
    flow: ['1. Write to cache', '2. Cache writes to DB', '3. Return success'],
    pros: ['Data always consistent', 'No stale data', 'Simple read path'],
    cons: ['Write latency', 'Cache full of unread data', 'Requires cache-DB integration'],
    useCase: 'Write-heavy, consistency critical',
    code: `async function setData(key, value) {
  await cache.set(key, value);
  await db.save(key, value); // Sync write
  return value;
}`
  },
  writeBehind: {
    name: 'Write-Behind (Write-Back)',
    description: 'Write to cache, async write to DB',
    flow: ['1. Write to cache', '2. Return immediately', '3. Async batch write to DB'],
    pros: ['Fast writes', 'Reduced DB load', 'Batch optimization'],
    cons: ['Data loss risk', 'Eventual consistency', 'Complex implementation'],
    useCase: 'High write throughput, eventual consistency OK',
    code: `async function setData(key, value) {
  await cache.set(key, value);
  writeQueue.push({ key, value }); // Async
  return value;
}
// Background job flushes queue to DB`
  },
  readThrough: {
    name: 'Read-Through',
    description: 'Cache handles DB fetching',
    flow: ['1. Request from cache', '2. Cache fetches from DB on miss', '3. Returns data'],
    pros: ['Simple application code', 'Cache manages consistency'],
    cons: ['First read always slow', 'Requires cache provider support'],
    useCase: 'Read-heavy, simplified application code',
    code: `// Cache provider handles DB fetch
const data = await cache.get(key, {
  loader: () => db.find(key)
});`
  },
  refreshAhead: {
    name: 'Refresh-Ahead',
    description: 'Proactively refresh before expiry',
    flow: ['1. Track access patterns', '2. Refresh frequently accessed before TTL', '3. Never miss on hot data'],
    pros: ['No cache misses for hot data', 'Consistent low latency'],
    cons: ['Complex implementation', 'May refresh unused data'],
    useCase: 'Predictable access patterns, latency critical',
    code: `// Refresh when TTL < 20% remaining
if (cache.ttlRemaining(key) < TTL * 0.2) {
  refreshInBackground(key);
}
return cache.get(key);`
  }
};

function calculateCacheSize(config: {
  uniqueItems: number;
  avgItemSizeKB: number;
  hitRateTarget: number;
}): Record<string, unknown> {
  const { uniqueItems, avgItemSizeKB, hitRateTarget } = config;

  // Working set estimation based on Pareto principle
  const hotItems = Math.ceil(uniqueItems * 0.2); // 20% items = 80% access
  const warmItems = Math.ceil(uniqueItems * 0.3);

  const minCacheMB = (hotItems * avgItemSizeKB) / 1024;
  const recommendedMB = ((hotItems + warmItems) * avgItemSizeKB) / 1024;
  const fullCacheMB = (uniqueItems * avgItemSizeKB) / 1024;

  // Hit rate estimation
  const estimatedHitRate = (size: number) => {
    const coverage = Math.min(size / fullCacheMB, 1);
    return 0.5 + (coverage * 0.5); // 50% base + 50% from coverage
  };

  return {
    uniqueItems,
    avgItemSizeKB,
    sizing: {
      minimum: { sizeMB: Math.round(minCacheMB), estimatedHitRate: `${Math.round(estimatedHitRate(minCacheMB) * 100)}%` },
      recommended: { sizeMB: Math.round(recommendedMB), estimatedHitRate: `${Math.round(estimatedHitRate(recommendedMB) * 100)}%` },
      full: { sizeMB: Math.round(fullCacheMB), estimatedHitRate: '99%+' }
    },
    targetHitRate: `${hitRateTarget}%`,
    recommendation: hitRateTarget > 90 ? 'recommended' : 'minimum',
    redisNodes: Math.ceil(recommendedMB / 5000) // ~5GB per node rule of thumb
  };
}

function designEvictionPolicy(config: {
  pattern: 'lru' | 'lfu' | 'fifo' | 'random' | 'ttl';
  constraints?: string[];
}): Record<string, unknown> {
  const policies: Record<string, Record<string, unknown>> = {
    lru: {
      name: 'Least Recently Used',
      algorithm: 'Evict items not accessed for longest time',
      pros: ['Good for temporal locality', 'Simple to implement'],
      cons: ['Scan pollution (full scans evict hot data)', 'Memory for timestamps'],
      bestFor: 'Most web applications, session data',
      redisPolicy: 'allkeys-lru or volatile-lru'
    },
    lfu: {
      name: 'Least Frequently Used',
      algorithm: 'Evict items with lowest access count',
      pros: ['Keeps truly popular items', 'Resistant to scan pollution'],
      cons: ['New items vulnerable', 'Counter overhead'],
      bestFor: 'CDN caching, static assets',
      redisPolicy: 'allkeys-lfu or volatile-lfu'
    },
    fifo: {
      name: 'First In First Out',
      algorithm: 'Evict oldest items first',
      pros: ['Very simple', 'Predictable'],
      cons: ['Ignores access patterns', 'May evict hot data'],
      bestFor: 'Event logs, time-series preview',
      redisPolicy: 'N/A (implement with sorted sets)'
    },
    random: {
      name: 'Random Eviction',
      algorithm: 'Randomly select items to evict',
      pros: ['O(1) eviction', 'No tracking overhead'],
      cons: ['Unpredictable', 'May evict hot data'],
      bestFor: 'Large caches, uniform access',
      redisPolicy: 'allkeys-random or volatile-random'
    },
    ttl: {
      name: 'Time-To-Live Based',
      algorithm: 'Evict items closest to expiration',
      pros: ['Automatic cleanup', 'Bounded staleness'],
      cons: ['TTL tuning required', 'May evict hot items'],
      bestFor: 'Session data, tokens, rate limits',
      redisPolicy: 'volatile-ttl'
    }
  };

  return {
    recommended: policies[config.pattern],
    allPolicies: Object.keys(policies),
    implementation: config.pattern === 'lru' ? {
      dataStructure: 'HashMap + Doubly Linked List',
      operations: { get: 'O(1)', set: 'O(1)', evict: 'O(1)' }
    } : null
  };
}

function optimizeCacheKey(examples: string[]): Record<string, unknown> {
  const analysis = examples.map(key => ({
    key,
    length: key.length,
    segments: key.split(/[:/_-]/).length,
    hasTimestamp: /\d{10,13}/.test(key),
    hasUUID: /[a-f0-9]{8}-[a-f0-9]{4}/.test(key)
  }));

  const avgLength = analysis.reduce((s, a) => s + a.length, 0) / analysis.length;

  return {
    analysis,
    recommendations: [
      avgLength > 100 ? 'Keys too long - consider hashing or shortening' : 'Key length acceptable',
      'Use consistent delimiter (prefer colon :)',
      'Include version prefix for cache invalidation: v1:user:123',
      'Group related keys with common prefix for scanning'
    ],
    bestPractices: {
      pattern: '{service}:{version}:{entity}:{id}:{field}',
      example: 'api:v1:user:12345:profile',
      maxLength: 128,
      avoid: ['Spaces', 'Special characters', 'Very long IDs']
    },
    optimized: examples.map(key =>
      key.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9:_-]/g, '').substring(0, 128)
    )
  };
}

function calculateHitRate(stats: {
  hits: number;
  misses: number;
  evictions?: number;
}): Record<string, unknown> {
  const { hits, misses, evictions = 0 } = stats;
  const total = hits + misses;
  const hitRate = hits / total;
  const missRate = misses / total;

  return {
    hitRate: `${(hitRate * 100).toFixed(2)}%`,
    missRate: `${(missRate * 100).toFixed(2)}%`,
    total,
    evictions,
    health: hitRate >= 0.95 ? 'Excellent' : hitRate >= 0.85 ? 'Good' : hitRate >= 0.70 ? 'Fair' : 'Poor',
    recommendations: hitRate < 0.85 ? [
      'Increase cache size',
      'Review TTL settings',
      'Check for cache key issues',
      'Consider warming cache on startup'
    ] : ['Cache performing well'],
    costSavings: {
      dbQueriesAvoided: hits,
      estimatedLatencyReduction: `${Math.round(hitRate * 100)}ms avg (assuming 100ms DB latency)`
    }
  };
}

function generateRedisConfig(requirements: {
  maxMemory: string;
  evictionPolicy: string;
  persistence?: boolean;
  cluster?: boolean;
}): string {
  const { maxMemory, evictionPolicy, persistence = false, cluster = false } = requirements;

  return `# Redis Configuration
# Generated for production use

# Memory
maxmemory ${maxMemory}
maxmemory-policy ${evictionPolicy}
maxmemory-samples 10

# Persistence
${persistence ? `
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
` : `
save ""
appendonly no
`}

# Performance
tcp-keepalive 300
timeout 0
tcp-backlog 511

${cluster ? `
# Cluster
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
` : ''}

# Security
# requirepass your-password-here
# rename-command FLUSHALL ""

# Limits
maxclients 10000`;
}

export const cacheStrategyTool: UnifiedTool = {
  name: 'cache_strategy',
  description: 'Cache Strategy: patterns, calculate_size, eviction_policy, optimize_keys, hit_rate, redis_config',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['patterns', 'calculate_size', 'eviction_policy', 'optimize_keys', 'hit_rate', 'redis_config'] },
      pattern: { type: 'string' },
      config: { type: 'object' },
      examples: { type: 'array' },
      stats: { type: 'object' },
      requirements: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeCacheStrategy(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    switch (args.operation) {
      case 'patterns':
        if (args.pattern && args.pattern in CACHE_PATTERNS) {
          result = CACHE_PATTERNS[args.pattern as keyof typeof CACHE_PATTERNS];
        } else {
          result = { patterns: CACHE_PATTERNS };
        }
        break;
      case 'calculate_size':
        result = calculateCacheSize(args.config || { uniqueItems: 100000, avgItemSizeKB: 2, hitRateTarget: 90 });
        break;
      case 'eviction_policy':
        result = designEvictionPolicy(args.config || { pattern: 'lru' });
        break;
      case 'optimize_keys':
        result = optimizeCacheKey(args.examples || ['user_profile_12345', 'session:abc-123:data', 'api/v1/users/999']);
        break;
      case 'hit_rate':
        result = calculateHitRate(args.stats || { hits: 8500, misses: 1500, evictions: 200 });
        break;
      case 'redis_config':
        result = { config: generateRedisConfig(args.requirements || {
          maxMemory: '2gb',
          evictionPolicy: 'allkeys-lru',
          persistence: true,
          cluster: false
        })};
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCacheStrategyAvailable(): boolean { return true; }
