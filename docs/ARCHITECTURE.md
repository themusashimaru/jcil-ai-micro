# System Architecture

> JCIL.AI Technical Architecture — Enterprise-Grade AI Platform Design

---

## Overview

JCIL.AI is a modern, cloud-native AI platform built on Next.js 14 with a multi-agent architecture. The system is designed for scalability, security, and reliability.

### Design Principles

1. **Safety First** — Built exclusively on Anthropic Claude for AI safety
2. **Security by Default** — Defense in depth across all layers
3. **Scalability** — Serverless-first with Redis-backed state management
4. **Reliability** — Graceful degradation, fallbacks, and retry logic
5. **Developer Experience** — TypeScript strict mode, comprehensive testing

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JCIL.AI PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   CLIENTS   │     │   VERCEL    │     │  EXTERNAL   │                   │
│  │  Web/Mobile │────▶│    EDGE     │────▶│  SERVICES   │                   │
│  └─────────────┘     └──────┬──────┘     └─────────────┘                   │
│                             │                    │                          │
│                             ▼                    │                          │
│  ┌──────────────────────────────────────────────┴───────────────────────┐  │
│  │                         NEXT.JS APPLICATION                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                      MIDDLEWARE LAYER                            │ │  │
│  │  │  Security Headers │ Request Size │ Rate Limiting │ CSRF         │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                │                                      │  │
│  │  ┌─────────────────────────────┴─────────────────────────────────┐   │  │
│  │  │                        API ROUTES                              │   │  │
│  │  │  /api/chat │ /api/code-lab │ /api/admin │ /api/stripe │ ...   │   │  │
│  │  └─────────────────────────────┬─────────────────────────────────┘   │  │
│  │                                │                                      │  │
│  │  ┌─────────────────────────────┴─────────────────────────────────┐   │  │
│  │  │                      CORE LIBRARIES                            │   │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │   │  │
│  │  │  │ Anthropic│  │  Queue   │  │  Cache   │  │ Validation│      │   │  │
│  │  │  │  Client  │  │  System  │  │  Layer   │  │  Schemas │      │   │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │   │  │
│  │  └───────────────────────────────────────────────────────────────┘   │  │
│  │                                │                                      │  │
│  │  ┌─────────────────────────────┴─────────────────────────────────┐   │  │
│  │  │                      AGENT SYSTEM                              │   │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │   │  │
│  │  │  │ Research │  │   Code   │  │ Document │                    │   │  │
│  │  │  │  Agent   │  │  Agent   │  │  Agent   │                    │   │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                    │   │  │
│  │  └───────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DATA LAYER                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Supabase │  │  Redis   │  │   E2B    │  │  Stripe  │            │   │
│  │  │ Postgres │  │ (Upstash)│  │ Sandbox  │  │ Payments │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Middleware Layer

The middleware layer processes all incoming requests:

```typescript
// middleware.ts - Global request processing
export function middleware(request: NextRequest) {
  // 1. Security headers on all responses
  // 2. Request size validation for POST/PUT/PATCH
  // 3. Early rejection of oversized payloads
}
```

**Responsibilities:**
- Add security headers (X-Frame-Options, CSP, etc.)
- Validate request sizes before processing
- Route-specific size limits

### 2. API Routes

API routes follow a consistent pattern:

```typescript
export async function POST(request: NextRequest) {
  // 1. CSRF validation
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response;

  // 2. Request queue management
  const slotAcquired = await acquireSlot(requestId);

  // 3. Input validation with Zod
  const validation = schema.safeParse(await request.json());

  // 4. Authentication check
  const user = await getAuthenticatedUser(request);

  // 5. Rate limiting
  const rateLimit = await checkRateLimit(user.id);

  // 6. Business logic
  const result = await processRequest(validation.data);

  // 7. Response
  return Response.json(result);
}
```

### 3. Anthropic Client

The AI client implements enterprise-grade reliability:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ANTHROPIC CLIENT ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    API KEY MANAGEMENT                        │   │
│  │                                                               │   │
│  │  PRIMARY POOL                    FALLBACK POOL               │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐       ┌─────┐ ┌─────┐              │   │
│  │  │Key 1│ │Key 2│ │Key n│       │FB 1 │ │FB n │              │   │
│  │  └─────┘ └─────┘ └─────┘       └─────┘ └─────┘              │   │
│  │      │       │       │             │       │                 │   │
│  │      └───────┴───────┴─────────────┴───────┘                 │   │
│  │                      │                                        │   │
│  │              Random Selection                                 │   │
│  │              (Serverless-safe)                               │   │
│  │                      │                                        │   │
│  │                      ▼                                        │   │
│  │              ┌───────────────┐                               │   │
│  │              │ Rate Limit    │                               │   │
│  │              │ Tracking      │                               │   │
│  │              └───────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MODEL ROUTING                             │   │
│  │                                                               │   │
│  │  User Query ───► Intent Analysis ───► Model Selection        │   │
│  │                                              │                │   │
│  │                         ┌────────────────────┴────────────┐  │   │
│  │                         │                                  │  │   │
│  │                         ▼                                  ▼  │   │
│  │                  ┌───────────┐                    ┌───────────┐│   │
│  │                  │  HAIKU    │                    │  SONNET   ││   │
│  │                  │  4.5      │                    │    4      ││   │
│  │                  │           │                    │           ││   │
│  │                  │ • Simple  │                    │ • Complex ││   │
│  │                  │ • Fast    │                    │ • Deep    ││   │
│  │                  │ • Cheap   │                    │ • Research││   │
│  │                  └───────────┘                    └───────────┘│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    STREAMING RELIABILITY                     │   │
│  │                                                               │   │
│  │  • 15-second keepalive heartbeat                            │   │
│  │  • 60-second chunk timeout detection                        │   │
│  │  • Automatic retry with key rotation                        │   │
│  │  • Graceful error messages to users                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Agent System

The multi-agent architecture enables autonomous task execution:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AGENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      BASE AGENT                              │   │
│  │                                                               │   │
│  │  • Execution tracking (start, iterations, duration)         │   │
│  │  • Source tracking (which services used)                    │   │
│  │  • Streaming progress callbacks                             │   │
│  │  • Success/failure result handling                          │   │
│  └───────────────────────────┬─────────────────────────────────┘   │
│                              │                                       │
│          ┌───────────────────┼───────────────────┐                  │
│          │                   │                   │                  │
│          ▼                   ▼                   ▼                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │RESEARCH AGENT │  │  CODE AGENT   │  │DOCUMENT AGENT │           │
│  │               │  │               │  │               │           │
│  │ Brain:        │  │ Brain:        │  │ Brain:        │           │
│  │ • Intent      │  │ • Intent      │  │ • Template    │           │
│  │ • Strategy    │  │ • Codebase    │  │ • Formatting  │           │
│  │ • Evaluator   │  │ • Generator   │  │ • Export      │           │
│  │ • Synthesizer │  │ • Analyzer    │  │               │           │
│  │               │  │               │  │               │           │
│  │ Executor:     │  │ Executor:     │  │ Generator:    │           │
│  │ • Perplexity  │  │ • E2B Sandbox │  │ • PDF         │           │
│  │               │  │ • GitHub      │  │ • DOCX        │           │
│  │               │  │               │  │ • XLSX        │           │
│  └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Research Agent Flow:**
```
User Query
    │
    ▼
┌──────────────┐
│Intent Analyzer│ ─── Understands what user needs
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Strategy Gen  │ ─── Creates research plan (1-10 queries)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Perplexity    │ ─── Executes searches in parallel
│Executor      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Result        │ ─── Evaluates coverage and quality
│Evaluator     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Synthesizer   │ ─── Creates final research report
└──────────────┘
```

### 5. Queue System

The queue system prevents API overload in serverless environments:

```typescript
// Request Queue Configuration
MAX_CONCURRENT_REQUESTS = 50      // Parallel requests allowed
QUEUE_TIMEOUT_MS = 30000          // Wait time before rejection
REQUEST_TTL_SECONDS = 120         // Auto-expire stuck requests

// Flow
Request ───► acquireSlot() ───► Process ───► releaseSlot()
                │
                ▼ (if full)
         Queue with timeout
                │
                ▼ (if timeout)
         503 "Server Busy"
```

**Implementation:**
- Redis-backed for distributed state
- In-memory fallback for single instances
- Automatic cleanup of stale requests
- Configurable limits via environment

### 6. Caching Layer

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CACHING ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Request ───► Cache Check ───► Hit? ───► Return Cached              │
│                    │                                                 │
│                    ▼ (Miss)                                         │
│              Fetch Fresh                                             │
│                    │                                                 │
│                    ▼                                                 │
│              Store in Cache                                          │
│                    │                                                 │
│                    ▼                                                 │
│              Return Fresh                                            │
│                                                                      │
│  Cache Backends:                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PRIMARY: Upstash Redis                                       │  │
│  │  • Distributed across serverless instances                   │  │
│  │  • TTL-based expiration                                      │  │
│  │  • Auto-JSON parsing                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  FALLBACK: In-Memory Map                                      │  │
│  │  • Per-instance (not shared)                                 │  │
│  │  • TTL tracking in object                                    │  │
│  │  • Automatic cleanup                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Architecture

### Database Schema (Supabase PostgreSQL)

```sql
-- Core Tables
users                 -- User accounts
conversations        -- Chat conversations
messages             -- Individual messages
code_lab_sessions    -- Code Lab workspaces

-- Security Tables
rate_limits          -- Rate limiting records
audit_logs           -- Security audit trail

-- Business Tables
subscriptions        -- Stripe subscription data
support_tickets      -- Customer support
admin_messages       -- System notifications
```

### Row-Level Security

All tables implement RLS policies:

```sql
-- Example: Users can only access their own conversations
CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all conversations"
ON conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);
```

---

## Security Architecture

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

### Key Security Components

```
src/lib/security/
├── csrf.ts              # CSRF protection
├── rate-limit.ts        # Rate limiting
├── request-size.ts      # Payload limits
├── validation.ts        # Input sanitization
└── postgrest.ts         # SQL injection prevention

src/lib/validation/
└── schemas.ts           # 50+ Zod validation schemas

src/lib/workspace/
└── security.ts          # Code execution security
```

---

## Reliability Patterns

### 1. Graceful Degradation

```typescript
// Redis unavailable? Use in-memory fallback
async function getRedis() {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      return Redis.fromEnv();
    } catch {
      log.warn('Redis unavailable, using in-memory fallback');
    }
  }
  return createInMemoryFallback();
}
```

### 2. Retry with Backoff

```typescript
// API call with retry
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await apiCall();
  } catch (error) {
    if (isRateLimitError(error)) {
      markKeyRateLimited(currentKey);
      continue; // Try next key
    }
    throw error;
  }
}
```

### 3. Idempotency

```typescript
// Prevent duplicate operations
const isFirstTime = await seenIdempotent(key);
if (!isFirstTime) {
  return existingResult; // Already processed
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  GitHub ───► Vercel CI/CD ───► Production                           │
│                  │                                                   │
│                  ├── Build: next build                              │
│                  ├── Test: vitest run                               │
│                  ├── Lint: next lint                                │
│                  └── Deploy: Vercel Edge                            │
│                                                                      │
│  Infrastructure:                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  VERCEL                                                     │    │
│  │  • Edge Functions (middleware)                             │    │
│  │  • Serverless Functions (API routes)                       │    │
│  │  • Static Assets (CDN)                                     │    │
│  │  • Automatic HTTPS                                         │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  SUPABASE                                                   │    │
│  │  • PostgreSQL Database                                     │    │
│  │  • Authentication                                          │    │
│  │  • Storage                                                 │    │
│  │  • Realtime (future)                                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  UPSTASH                                                    │    │
│  │  • Redis (rate limiting, caching, queue)                   │    │
│  │  • Serverless-compatible                                   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Performance Characteristics

### Latency Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| API Response (cached) | < 100ms | ~50ms |
| API Response (uncached) | < 500ms | ~300ms |
| AI Streaming Start | < 2s | ~1.5s |
| Code Execution | < 30s | Varies |

### Scalability Limits

| Resource | Limit | Configurable |
|----------|-------|--------------|
| Concurrent Requests | 50 | Yes (QUEUE_MAX_CONCURRENT) |
| Request Size | 1-10 MB | Yes (by route) |
| Rate Limit (auth) | 120/hour | Yes (RATE_LIMIT_AUTH) |
| Rate Limit (anon) | 30/hour | Yes (RATE_LIMIT_ANON) |

---

## Future Architecture Considerations

### Planned Improvements

1. **Horizontal Scaling**
   - Database read replicas
   - Multi-region deployment
   - Edge caching

2. **Observability**
   - Distributed tracing
   - APM integration
   - Real-time alerting

3. **Enterprise Features**
   - SSO (SAML/OIDC)
   - Multi-tenancy
   - On-premise deployment

---

*Last Updated: January 2025*
*Version: 1.0*
