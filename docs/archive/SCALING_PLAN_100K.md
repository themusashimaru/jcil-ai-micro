# JCIL.AI Scaling Plan: 100,000 Concurrent Users

**Target:** 100,000 concurrent users
**Current Capacity:** ~15-20 concurrent users
**Gap:** 5,000x improvement needed

---

## Executive Summary

This plan outlines the infrastructure changes required to scale JCIL.AI from ~20 concurrent users to 100,000. The changes are organized in 4 phases, each building on the previous.

**Current Bottlenecks (in order of failure):**

1. Queue System (50 slots) - fails at ~150 req/min
2. Database Connections (no pooling) - fails at ~100 connections
3. Redis (single Upstash instance) - fails at ~10K ops/sec
4. Anthropic API (10 keys) - fails when all rate-limited

---

## Phase 1: Quick Wins (Day 1-3)

**Target: 500 concurrent users**
**Effort: Environment variables only**

### 1.1 Increase Queue Limits

```bash
# Vercel Environment Variables
QUEUE_MAX_CONCURRENT=500        # Up from 50
QUEUE_TIMEOUT_MS=60000          # Up from 30000 (60 seconds)
```

**Impact:** 10x throughput immediately

### 1.2 Increase Rate Limits

```bash
# Adjust per-tier limits
RATE_LIMIT_FREE_HOURLY=60       # Up from 30
RATE_LIMIT_PLUS_HOURLY=600      # Up from 300
RATE_LIMIT_PRO_HOURLY=1200      # Up from 600
RATE_LIMIT_EXEC_HOURLY=2400     # Up from 1200
```

### 1.3 Add More Anthropic API Keys

You have 5 primary + 5 fallback = 10 keys. For 100K users, you need more:

```bash
# Target: 20 primary + 10 fallback = 30 keys
ANTHROPIC_API_KEY_1=sk-ant-...
ANTHROPIC_API_KEY_2=sk-ant-...
# ... through ...
ANTHROPIC_API_KEY_20=sk-ant-...

ANTHROPIC_API_KEY_FALLBACK_1=sk-ant-...
# ... through ...
ANTHROPIC_API_KEY_FALLBACK_10=sk-ant-...
```

**Anthropic Enterprise Request:**

- Request Level 5 or Enterprise tier
- Target: 4,000+ RPM per key
- With 30 keys: 120,000 RPM capacity

### 1.4 Verify Redis Configuration

```bash
# Ensure Upstash is properly configured
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Phase 2: Database & Connection Pooling (Week 1)

**Target: 2,000 concurrent users**
**Effort: Code changes + Supabase config**

### 2.1 Enable Supabase Connection Pooling

**Supabase Dashboard:**

1. Go to Project Settings → Database
2. Enable "Connection Pooling"
3. Set mode to "Transaction" (best for serverless)
4. Note the pooler connection string

**Environment Update:**

```bash
# Use pooler URL instead of direct connection
DATABASE_URL=postgres://postgres.[ref]:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 2.2 Optimize Database Queries

**Add indexes for hot paths:**

```sql
-- Rate limits table (queried on every request)
CREATE INDEX idx_rate_limits_user_key ON rate_limits(user_id, key);
CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);

-- Messages table (queried frequently)
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);

-- Conversations table
CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);
```

### 2.3 Add Rate Limit Cleanup Job

**New cron job in `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-rate-limits",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Create `/app/api/cron/cleanup-rate-limits/route.ts`:**

- Delete rate_limit entries older than 2 hours
- Vacuum the table monthly

### 2.4 Update Supabase Client with Pooling

```typescript
// src/lib/supabase/client.ts
export const createServerClient = () => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-pool': 'true',
        },
      },
    }
  );
};
```

---

## Phase 3: Queue Architecture Overhaul (Week 2-3)

**Target: 10,000 concurrent users**
**Effort: Major code changes**

### 3.1 Replace Simple Queue with Bull/BullMQ

**Current Problem:**

- Simple Redis SET-based queue
- No persistence across failures
- No priority queuing
- Limited observability

**New Architecture:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────▶│  Bull Queue │────▶│   Workers   │
│   Handler   │     │  (Redis)    │     │  (Process)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Dashboard  │
                    │  (Bull UI)  │
                    └─────────────┘
```

**Install dependencies:**

```bash
pnpm add bullmq ioredis
```

**Create new queue system:**

```typescript
// src/lib/queue/bull-queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const chatQueue = new Queue('chat-requests', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Worker processes jobs
export const chatWorker = new Worker(
  'chat-requests',
  async (job) => {
    // Process chat request
    return await processChat(job.data);
  },
  {
    connection,
    concurrency: 100, // Process 100 jobs simultaneously
    limiter: {
      max: 1000,
      duration: 60000, // 1000 jobs per minute max
    },
  }
);
```

### 3.2 Implement Request Queuing API

**Modify `/app/api/chat/route.ts`:**

```typescript
// Instead of immediate processing:
export async function POST(request: Request) {
  const { messages, conversationId } = await request.json();

  // Add to queue
  const job = await chatQueue.add(
    'chat',
    {
      messages,
      conversationId,
      userId: user.id,
    },
    {
      priority: getPriority(user.plan), // Premium users first
    }
  );

  // Return job ID for polling
  return Response.json({ jobId: job.id });
}
```

### 3.3 Add Job Status Endpoint

**Create `/app/api/chat/status/[jobId]/route.ts`:**

```typescript
export async function GET(request: Request, { params }: { params: { jobId: string } }) {
  const job = await chatQueue.getJob(params.jobId);

  if (!job) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const state = await job.getState();

  return Response.json({
    status: state,
    progress: job.progress,
    result: state === 'completed' ? job.returnvalue : null,
    error: state === 'failed' ? job.failedReason : null,
  });
}
```

### 3.4 Implement Server-Sent Events for Real-time Updates

**Create `/app/api/chat/stream/[jobId]/route.ts`:**

```typescript
export async function GET(request: Request, { params }: { params: { jobId: string } }) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const events = new QueueEvents('chat-requests', { connection });

      events.on('completed', ({ jobId, returnvalue }) => {
        if (jobId === params.jobId) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(returnvalue)}\n\n`));
          controller.close();
        }
      });

      events.on('progress', ({ jobId, data }) => {
        if (jobId === params.jobId) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 3.5 Priority Queuing by Plan

```typescript
function getPriority(plan: string): number {
  switch (plan) {
    case 'executive':
      return 1; // Highest priority
    case 'pro':
      return 2;
    case 'plus':
      return 3;
    case 'free':
      return 4; // Lowest priority
    default:
      return 5;
  }
}
```

---

## Phase 4: Enterprise Infrastructure (Week 4-8)

**Target: 100,000 concurrent users**
**Effort: Infrastructure + architecture changes**

### 4.1 Upgrade Redis to Cluster

**Option A: Upstash Enterprise**

- Request enterprise tier
- Multi-region replication
- Higher ops/sec limits

**Option B: Self-managed Redis Cluster**

```
┌─────────────────────────────────────────────┐
│              Redis Cluster (6 nodes)        │
├─────────────┬─────────────┬─────────────────┤
│  Master 1   │  Master 2   │    Master 3     │
│  Replica 1  │  Replica 2  │    Replica 3    │
└─────────────┴─────────────┴─────────────────┘
```

### 4.2 Multi-Region Deployment

**Vercel Configuration:**

```json
// vercel.json
{
  "regions": ["iad1", "sfo1", "cdg1", "hnd1"],
  "functions": {
    "app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 300
    }
  }
}
```

**Edge Functions for Static:**

- Move rate limiting to edge
- Cache responses at edge
- Geo-route to nearest region

### 4.3 Database Read Replicas

**Supabase Pro:**

1. Enable read replicas
2. Configure read/write splitting

```typescript
// src/lib/supabase/client.ts
const writeClient = createClient(SUPABASE_URL, SERVICE_KEY);
const readClient = createClient(SUPABASE_REPLICA_URL, SERVICE_KEY);

export const db = {
  write: writeClient,
  read: readClient,
};

// Usage
const messages = await db.read.from('messages').select('*');
await db.write.from('messages').insert(newMessage);
```

### 4.4 Implement Caching Layers

```
┌─────────────────────────────────────────────────────┐
│                    Cache Hierarchy                  │
├─────────────────────────────────────────────────────┤
│  L1: Edge Cache (Vercel)     │ TTL: 60s            │
│  L2: Redis Cache             │ TTL: 5min           │
│  L3: Database                │ Source of truth     │
└─────────────────────────────────────────────────────┘
```

**Edge Caching:**

```typescript
// app/api/chat/route.ts
export const runtime = 'edge';

export async function GET(request: Request) {
  return new Response(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

**Redis Caching:**

```typescript
// Cache conversation metadata
const cacheKey = `conv:${conversationId}`;
let conversation = await redis.get(cacheKey);

if (!conversation) {
  conversation = await db.read.from('conversations').select('*').eq('id', conversationId).single();
  await redis.set(cacheKey, JSON.stringify(conversation), { ex: 300 });
}
```

### 4.5 Implement Circuit Breakers

```typescript
// src/lib/circuit-breaker.ts
import CircuitBreaker from 'opossum';

const anthropicBreaker = new CircuitBreaker(callAnthropic, {
  timeout: 60000, // 60s timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // Try again after 30s
  volumeThreshold: 10, // Min requests before tripping
});

anthropicBreaker.on('open', () => {
  log.error('Anthropic circuit breaker OPEN - too many failures');
  // Alert on-call
});

anthropicBreaker.on('halfOpen', () => {
  log.info('Anthropic circuit breaker testing...');
});

anthropicBreaker.on('close', () => {
  log.info('Anthropic circuit breaker CLOSED - recovered');
});
```

### 4.6 Observability Stack

**Add monitoring:**

```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-node
```

**Key Metrics to Track:**
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Queue depth | < 100 | > 500 |
| P99 latency | < 5s | > 10s |
| Error rate | < 1% | > 5% |
| API key usage | balanced | > 80% on any key |
| Database connections | < 80% pool | > 90% |
| Redis ops/sec | < 80% limit | > 90% |

**Dashboard (Grafana/Datadog):**

```
┌─────────────────────────────────────────────────────┐
│  JCIL.AI Production Dashboard                       │
├─────────────────────────────────────────────────────┤
│  Active Users: 45,230    │  Queue Depth: 127       │
│  Req/min: 8,450          │  Avg Latency: 2.3s      │
│  Error Rate: 0.3%        │  API Keys: 18/30 avail  │
├─────────────────────────────────────────────────────┤
│  [Chart: Requests over time]                        │
│  [Chart: Latency percentiles]                       │
│  [Chart: Error breakdown]                           │
└─────────────────────────────────────────────────────┘
```

---

## Anthropic Enterprise API Requirements

### Current State (Level 4)

- ~60-100 requests/second
- 10 API keys configured

### Required for 100K Users

**Request from Anthropic:**

1. Enterprise API access
2. Target: 4,000+ RPM per key
3. Request 30 API keys total
4. Dedicated capacity pool (if available)

**Email Template:**

```
Subject: Enterprise API Access Request - JCIL.AI

Hi Anthropic Team,

We're scaling JCIL.AI, a faith-based AI platform, to support 100K+
concurrent users. Current infrastructure:
- 10 API keys (5 primary + 5 fallback)
- Level 4 access

We request:
1. Enterprise tier access
2. 30 total API keys
3. 4,000+ RPM per key capacity
4. Priority support SLA

Expected usage:
- 100K concurrent users
- ~500K requests/hour at peak
- Average 15-20 tokens/request
- Streaming responses

Thank you,
[Your name]
```

---

## Cost Estimates

### Current (20 users)

| Service       | Cost/month  |
| ------------- | ----------- |
| Vercel Pro    | $20         |
| Supabase Pro  | $25         |
| Upstash Redis | $10         |
| Anthropic API | ~$500       |
| **Total**     | ~$555/month |

### At 100K Users

| Service               | Cost/month             |
| --------------------- | ---------------------- |
| Vercel Enterprise     | $500+                  |
| Supabase Pro (scaled) | $100-300               |
| Redis Cluster         | $200-500               |
| Anthropic API         | $50,000-100,000+       |
| Monitoring            | $200-500               |
| **Total**             | ~$51,000-101,000/month |

**Note:** Anthropic costs scale with usage. At 100K concurrent users doing ~10 messages/day each, expect 1M+ messages/day = significant API costs.

---

## Implementation Timeline

```
Week 1: Phase 1 (Quick Wins)
├── Day 1: Update env variables
├── Day 2: Request Anthropic enterprise
├── Day 3: Add more API keys
└── Target: 500 concurrent users

Week 2: Phase 2 (Database)
├── Enable connection pooling
├── Add database indexes
├── Implement cleanup crons
└── Target: 2,000 concurrent users

Week 3-4: Phase 3 (Queue Overhaul)
├── Install BullMQ
├── Implement job queue
├── Add priority queuing
├── Update frontend for async
└── Target: 10,000 concurrent users

Week 5-8: Phase 4 (Enterprise)
├── Multi-region deployment
├── Redis cluster
├── Database replicas
├── Full observability
└── Target: 100,000 concurrent users
```

---

## Risk Mitigation

| Risk                | Impact | Mitigation                         |
| ------------------- | ------ | ---------------------------------- |
| Anthropic API quota | High   | Pre-negotiate enterprise limits    |
| Database overload   | High   | Connection pooling + read replicas |
| Redis failure       | High   | Cluster mode + fallback            |
| Vercel cold starts  | Medium | Keep-warm functions + edge         |
| Cost overrun        | Medium | Usage alerts + auto-scaling limits |
| DDoS attack         | High   | Cloudflare + rate limiting         |

---

## Success Criteria

**Phase 1 Complete:**

- [ ] 500 concurrent users without 503 errors
- [ ] Queue depth < 100 at steady state
- [ ] P99 latency < 10s

**Phase 2 Complete:**

- [ ] 2,000 concurrent users stable
- [ ] Database connections < 80% pool
- [ ] Zero connection timeout errors

**Phase 3 Complete:**

- [ ] 10,000 concurrent users stable
- [ ] Job queue processing 1000+ jobs/min
- [ ] Premium users get priority

**Phase 4 Complete:**

- [ ] 100,000 concurrent users stable
- [ ] Multi-region active
- [ ] Full observability dashboard
- [ ] < 1% error rate

---

## Files to Modify

### Phase 1 (No code changes)

- Vercel environment variables only

### Phase 2

- `src/lib/supabase/client.ts` - Add pooling config
- `vercel.json` - Add cleanup cron
- `app/api/cron/cleanup-rate-limits/route.ts` - New file
- Database migrations for indexes

### Phase 3

- `src/lib/queue/bull-queue.ts` - New file
- `src/lib/queue/workers.ts` - New file
- `app/api/chat/route.ts` - Refactor for async
- `app/api/chat/status/[jobId]/route.ts` - New file
- `app/api/chat/stream/[jobId]/route.ts` - New file
- `app/chat/ChatClient.tsx` - Update for job polling

### Phase 4

- Infrastructure changes (Vercel/Supabase/Redis configs)
- `src/lib/observability/` - New directory
- Multiple API routes for edge functions
- Circuit breaker implementations

---

## Next Steps

1. **Today:** Update environment variables (Phase 1.1-1.2)
2. **This Week:** Contact Anthropic for enterprise access
3. **Next Week:** Begin Phase 2 database optimizations
4. **Ongoing:** Monitor metrics and adjust

**Questions to Resolve:**

- [ ] Confirm Anthropic enterprise pricing
- [ ] Decide: Upstash Enterprise vs self-managed Redis
- [ ] Set budget limits for scaling
- [ ] Define on-call rotation for production
