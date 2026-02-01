/**
 * SYSTEM DESIGN TOOL
 * System design patterns and architecture helpers
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const DESIGN_PATTERNS = {
  microservices: {
    description: 'Decompose application into loosely coupled services',
    when: ['Large teams', 'Independent deployment needs', 'Different scaling requirements', 'Technology diversity needed'],
    components: ['API Gateway', 'Service Registry', 'Load Balancer', 'Message Queue', 'Service Mesh'],
    tradeoffs: {
      pros: ['Independent scaling', 'Technology flexibility', 'Fault isolation', 'Team autonomy'],
      cons: ['Distributed complexity', 'Network latency', 'Data consistency challenges', 'Operational overhead']
    }
  },
  eventDriven: {
    description: 'Components communicate through events',
    when: ['Asynchronous processing', 'Loose coupling needed', 'Audit/replay requirements', 'Real-time updates'],
    components: ['Event Bus', 'Event Store', 'Producers', 'Consumers', 'Schema Registry'],
    tradeoffs: {
      pros: ['Loose coupling', 'Scalability', 'Audit trail', 'Resilience'],
      cons: ['Eventual consistency', 'Debugging complexity', 'Event ordering', 'Schema evolution']
    }
  },
  cqrs: {
    description: 'Separate read and write models',
    when: ['Different read/write patterns', 'Complex queries needed', 'Event sourcing desired', 'High read/write ratio'],
    components: ['Command Handler', 'Event Store', 'Read Model', 'Projections', 'Query Handler'],
    tradeoffs: {
      pros: ['Optimized read/write', 'Scalability', 'Flexibility', 'Complex queries'],
      cons: ['Complexity', 'Eventual consistency', 'More code', 'Sync challenges']
    }
  },
  serverless: {
    description: 'Functions as a Service with managed infrastructure',
    when: ['Variable workloads', 'Cost optimization', 'Quick deployment', 'Event-driven workloads'],
    components: ['Functions', 'API Gateway', 'Event Sources', 'Managed Services', 'Cold Start Handler'],
    tradeoffs: {
      pros: ['No server management', 'Auto-scaling', 'Pay per use', 'Quick deployment'],
      cons: ['Cold starts', 'Vendor lock-in', 'Limited execution time', 'Debugging difficulty']
    }
  }
};

function analyzeRequirements(requirements: {
  users?: number;
  requestsPerSecond?: number;
  dataSize?: string;
  availability?: string;
  latency?: string;
}): Record<string, unknown> {
  const {
    requestsPerSecond = 100,
    dataSize = '10GB',
    availability = '99.9%',
    latency = '100ms'
  } = requirements;

  const dataSizeGB = parseFloat(dataSize.replace(/[^0-9.]/g, ''));
  const latencyMs = parseFloat(latency.replace(/[^0-9.]/g, ''));
  const availabilityPercent = parseFloat(availability.replace(/[^0-9.]/g, ''));

  const recommendations: string[] = [];
  const components: string[] = [];

  // Scale recommendations
  if (requestsPerSecond > 1000) {
    recommendations.push('Consider horizontal scaling with load balancers');
    components.push('Load Balancer', 'Auto-scaling Group');
  }

  if (requestsPerSecond > 10000) {
    recommendations.push('Implement caching layer (Redis/Memcached)');
    components.push('Distributed Cache');
  }

  // Data recommendations
  if (dataSizeGB > 100) {
    recommendations.push('Consider database sharding');
    components.push('Sharded Database');
  }

  if (dataSizeGB > 1000) {
    recommendations.push('Implement data lake for analytics');
    components.push('Data Lake', 'ETL Pipeline');
  }

  // Availability recommendations
  if (availabilityPercent >= 99.99) {
    recommendations.push('Multi-region deployment required');
    recommendations.push('Implement circuit breakers and fallbacks');
    components.push('Multi-Region Setup', 'Circuit Breaker', 'Fallback Services');
  }

  // Latency recommendations
  if (latencyMs <= 50) {
    recommendations.push('Edge caching with CDN');
    recommendations.push('Consider in-memory data stores');
    components.push('CDN', 'In-Memory Cache');
  }

  // Calculate infrastructure estimates
  const estimatedServers = Math.ceil(requestsPerSecond / 500);
  const estimatedCacheSize = Math.ceil(dataSizeGB * 0.1);
  const downtimePerYear = (1 - availabilityPercent / 100) * 525600; // minutes

  return {
    requirements,
    recommendations,
    components,
    estimates: {
      minimumServers: estimatedServers,
      cacheSizeGB: estimatedCacheSize,
      allowedDowntimeMinutesPerYear: Math.round(downtimePerYear)
    },
    suggestedArchitecture: requestsPerSecond > 1000 ? 'microservices' : 'monolith'
  };
}

function generateArchitectureDiagram(components: string[]): string {
  let mermaid = 'graph TB\n';

  // Standard components
  const componentMap: Record<string, { id: string; label: string; connections: string[] }> = {
    'Client': { id: 'client', label: 'Client', connections: ['lb'] },
    'Load Balancer': { id: 'lb', label: 'Load Balancer', connections: ['api'] },
    'API Gateway': { id: 'api', label: 'API Gateway', connections: ['auth', 'service'] },
    'Auth Service': { id: 'auth', label: 'Auth Service', connections: ['cache', 'db'] },
    'Service': { id: 'service', label: 'Service', connections: ['cache', 'db', 'queue'] },
    'Cache': { id: 'cache', label: 'Redis Cache', connections: [] },
    'Database': { id: 'db', label: 'Database', connections: [] },
    'Message Queue': { id: 'queue', label: 'Message Queue', connections: ['worker'] },
    'Worker': { id: 'worker', label: 'Worker', connections: ['db'] },
    'CDN': { id: 'cdn', label: 'CDN', connections: ['client'] }
  };

  // Add nodes
  const usedComponents = new Set<string>();
  for (const comp of components) {
    const mapping = componentMap[comp];
    if (mapping) {
      usedComponents.add(comp);
      mermaid += `    ${mapping.id}["${mapping.label}"]\n`;
    }
  }

  // Add default components if none specified
  if (usedComponents.size === 0) {
    mermaid += '    client["Client"]\n';
    mermaid += '    lb["Load Balancer"]\n';
    mermaid += '    api["API"]\n';
    mermaid += '    db[("Database")]\n';
    mermaid += '    client --> lb --> api --> db\n';
  } else {
    // Add connections
    for (const comp of usedComponents) {
      const mapping = componentMap[comp];
      if (mapping) {
        for (const conn of mapping.connections) {
          const targetComp = Object.entries(componentMap).find(([, v]) => v.id === conn);
          if (targetComp && usedComponents.has(targetComp[0])) {
            mermaid += `    ${mapping.id} --> ${conn}\n`;
          }
        }
      }
    }
  }

  return mermaid;
}

function capacityPlanning(config: {
  dailyActiveUsers: number;
  peakMultiplier?: number;
  avgRequestsPerUser?: number;
  avgResponseSizeKB?: number;
  growthRatePercent?: number;
}): Record<string, unknown> {
  const {
    dailyActiveUsers,
    peakMultiplier = 3,
    avgRequestsPerUser = 50,
    avgResponseSizeKB = 10,
    growthRatePercent = 20
  } = config;

  const dailyRequests = dailyActiveUsers * avgRequestsPerUser;
  const avgRPS = dailyRequests / 86400;
  const peakRPS = avgRPS * peakMultiplier;

  const dailyDataTransferGB = (dailyRequests * avgResponseSizeKB) / 1024 / 1024;
  const monthlyDataTransferGB = dailyDataTransferGB * 30;

  // Server estimation (assuming 500 RPS per server)
  const serversNeeded = Math.ceil(peakRPS / 500);

  // Database estimation
  const dbConnectionsNeeded = serversNeeded * 20; // 20 connections per server
  const dbStorageMonthlyGB = (dailyDataTransferGB * 0.01) * 30; // 1% of traffic stored

  // Growth projections
  const projections = [1, 2, 3, 4].map(years => ({
    years,
    users: Math.round(dailyActiveUsers * Math.pow(1 + growthRatePercent / 100, years)),
    peakRPS: Math.round(peakRPS * Math.pow(1 + growthRatePercent / 100, years)),
    servers: Math.ceil((peakRPS * Math.pow(1 + growthRatePercent / 100, years)) / 500)
  }));

  return {
    current: {
      dailyActiveUsers,
      dailyRequests,
      avgRPS: Math.round(avgRPS),
      peakRPS: Math.round(peakRPS),
      dailyDataTransferGB: Math.round(dailyDataTransferGB * 100) / 100,
      monthlyDataTransferGB: Math.round(monthlyDataTransferGB)
    },
    infrastructure: {
      applicationServers: serversNeeded,
      databaseConnections: dbConnectionsNeeded,
      estimatedDbStorageGB: Math.round(dbStorageMonthlyGB),
      recommendedCacheSizeGB: Math.ceil(serversNeeded * 2),
      loadBalancers: serversNeeded > 10 ? 2 : 1
    },
    projections,
    recommendations: [
      serversNeeded > 5 ? 'Consider auto-scaling groups' : 'Fixed server count acceptable',
      peakRPS > 1000 ? 'Implement request queuing for traffic spikes' : 'Standard load balancing sufficient',
      dbConnectionsNeeded > 100 ? 'Use connection pooling (PgBouncer, ProxySQL)' : 'Direct connections acceptable'
    ]
  };
}

function suggestTechStack(requirements: {
  type: 'web' | 'api' | 'mobile' | 'data' | 'realtime';
  scale: 'small' | 'medium' | 'large';
  team: 'small' | 'medium' | 'large';
}): Record<string, unknown> {
  const stacks: Record<string, Record<string, unknown>> = {
    'web-small': {
      frontend: ['Next.js', 'Tailwind CSS'],
      backend: ['Next.js API Routes', 'Prisma'],
      database: ['PostgreSQL', 'Redis'],
      hosting: ['Vercel', 'Supabase'],
      rationale: 'Full-stack framework minimizes operational overhead'
    },
    'web-large': {
      frontend: ['React', 'TypeScript', 'Redux Toolkit'],
      backend: ['Node.js', 'Express', 'GraphQL'],
      database: ['PostgreSQL', 'Elasticsearch', 'Redis'],
      hosting: ['Kubernetes', 'AWS'],
      rationale: 'Scalable microservices with type safety'
    },
    'api-medium': {
      backend: ['Node.js', 'Fastify', 'TypeScript'],
      database: ['PostgreSQL', 'Redis'],
      documentation: ['OpenAPI', 'Swagger UI'],
      hosting: ['AWS ECS', 'RDS'],
      rationale: 'High-performance API with good DX'
    },
    'realtime-medium': {
      backend: ['Node.js', 'Socket.io', 'Redis Pub/Sub'],
      database: ['PostgreSQL', 'Redis'],
      queue: ['BullMQ'],
      hosting: ['AWS', 'ElastiCache'],
      rationale: 'WebSocket support with scalable pub/sub'
    },
    'data-large': {
      processing: ['Apache Spark', 'Airflow'],
      storage: ['S3', 'Delta Lake'],
      database: ['Snowflake', 'PostgreSQL'],
      orchestration: ['Kubernetes', 'Argo'],
      rationale: 'Enterprise data platform'
    }
  };

  const key = `${requirements.type}-${requirements.scale}`;
  return stacks[key] || stacks['web-small'];
}

export const systemDesignTool: UnifiedTool = {
  name: 'system_design',
  description: 'System Design: patterns, analyze_requirements, architecture_diagram, capacity_planning, tech_stack',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['patterns', 'analyze_requirements', 'architecture_diagram', 'capacity_planning', 'tech_stack'] },
      pattern: { type: 'string' },
      requirements: { type: 'object' },
      components: { type: 'array' },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeSystemDesign(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    switch (args.operation) {
      case 'patterns':
        if (args.pattern && args.pattern in DESIGN_PATTERNS) {
          result = DESIGN_PATTERNS[args.pattern as keyof typeof DESIGN_PATTERNS];
        } else {
          result = { availablePatterns: Object.keys(DESIGN_PATTERNS), patterns: DESIGN_PATTERNS };
        }
        break;
      case 'analyze_requirements':
        result = analyzeRequirements(args.requirements || { users: 100000, requestsPerSecond: 500 });
        break;
      case 'architecture_diagram':
        result = { mermaid: generateArchitectureDiagram(args.components || ['Load Balancer', 'API Gateway', 'Service', 'Cache', 'Database']) };
        break;
      case 'capacity_planning':
        result = capacityPlanning(args.config || { dailyActiveUsers: 50000 });
        break;
      case 'tech_stack':
        result = suggestTechStack(args.requirements || { type: 'web', scale: 'medium', team: 'small' });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isSystemDesignAvailable(): boolean { return true; }
