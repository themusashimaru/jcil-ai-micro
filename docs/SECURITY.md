# Security Policy

> JCIL.AI Security Documentation — Enterprise-Grade Protection for AI Applications

---

## Our Security Commitment

JCIL.AI is committed to maintaining the highest standards of security for our users and their data. We have implemented comprehensive security controls across all layers of our platform, aligned with industry best practices and working toward SOC 2 Type II certification.

### Why We Chose Anthropic

Our exclusive use of Anthropic's Claude models is a deliberate security decision:

- **No Training on User Data**: Anthropic does not train on API customer data
- **SOC 2 Type II Certified**: Anthropic maintains enterprise-grade compliance
- **HIPAA Eligible**: Infrastructure supports healthcare data requirements
- **Constitutional AI**: Built-in safety and alignment guarantees
- **Transparent Research**: Published safety research and model cards

---

## Security Architecture

### Defense in Depth

We implement multiple layers of security controls:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: PERIMETER                                          │   │
│  │  • TLS 1.3 encryption for all traffic                       │   │
│  │  • Vercel Edge DDoS protection                              │   │
│  │  • Security headers (CSP, HSTS, X-Frame-Options)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: APPLICATION                                        │   │
│  │  • CSRF protection on state-changing requests               │   │
│  │  • Input validation with Zod schemas                        │   │
│  │  • Rate limiting (Redis-backed)                             │   │
│  │  • Request size limits                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: DATA                                               │   │
│  │  • AES-256-GCM encryption for tokens                        │   │
│  │  • Row-Level Security (RLS) policies                        │   │
│  │  • PII redaction in logs                                    │   │
│  │  • Encrypted database connections                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: EXECUTION                                          │   │
│  │  • E2B sandboxed VMs for code execution                     │   │
│  │  • Command injection prevention                              │   │
│  │  • Path traversal protection                                 │   │
│  │  • Session ownership verification                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Security Controls

### 1. Authentication & Authorization

| Control                 | Implementation                    | Status    |
| ----------------------- | --------------------------------- | --------- |
| OAuth 2.0               | Google OAuth via Supabase         | ✅ Active |
| WebAuthn/Passkeys       | FIDO2 passwordless authentication | ✅ Active |
| Session Management      | JWT with secure cookies           | ✅ Active |
| Row-Level Security      | Database-enforced access control  | ✅ Active |
| Admin Role Verification | Server-side role checks           | ✅ Active |

**Implementation Details:**

- Sessions expire after 7 days of inactivity
- Refresh tokens rotate on each use
- Admin actions require re-authentication
- All auth state changes are logged

### 2. Input Validation

We validate all user input using Zod schemas before processing:

```typescript
// Example: Chat request validation
const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  conversationId: uuidSchema.optional(),
  searchMode: z.enum(['none', 'search', 'factcheck', 'research']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(128000).optional(),
});
```

**Validation Coverage:**

- 50+ Zod schemas for all API endpoints
- Type-safe validation with detailed error messages
- Automatic sanitization of dangerous characters
- Size limits enforced at middleware and route level

### 3. CSRF Protection

All state-changing requests (POST, PUT, DELETE, PATCH) are protected:

```typescript
// CSRF validation on every mutating request
const csrfCheck = validateCSRF(request);
if (!csrfCheck.valid) return csrfCheck.response;
```

**How it works:**

- Validates Origin and Referer headers
- Rejects requests without origin information
- Logs blocked attempts for security monitoring
- Configurable allowed origins per environment

### 4. Rate Limiting

Multi-tier rate limiting protects against abuse with subscription-aware limits:

| Tier      | Messages/Minute | Messages/Hour | Scope    |
| --------- | --------------- | ------------- | -------- |
| Free      | 5               | 30            | Per User |
| Basic     | 10              | 100           | Per User |
| Pro       | 20              | 200           | Per User |
| Executive | 50              | 500           | Per User |
| Admin     | Unlimited       | Unlimited     | Per User |

**Implementation:**

- Redis-backed for distributed environments
- **Fail-closed security**: If Redis unavailable, requests are denied (not allowed)
- Automatic cleanup of expired entries
- Subscription-aware tier checking
- Correlation ID tracking for request tracing

**Rate Limit Types:**
| Type | Requests | Window | Use Case |
|------|----------|--------|----------|
| Standard | 60 | 60s | General API endpoints |
| Strict | 30 | 60s | Regeneration, sensitive ops |
| Auth | 10 | 60s | Login/signup attempts |

### 5. Request Size Limits

Route-specific payload limits prevent resource exhaustion:

| Route Pattern         | Limit  |
| --------------------- | ------ |
| `/api/chat`           | 500 KB |
| `/api/upload`         | 10 MB  |
| `/api/admin/*`        | 5 MB   |
| `/api/stripe/webhook` | 5 MB   |
| Default               | 1 MB   |

### 6. Encryption

**Data at Rest:**

- Database encryption via Supabase (AES-256)
- Sensitive tokens encrypted with AES-256-GCM
- Encryption keys stored in environment variables

**Data in Transit:**

- TLS 1.3 for all connections
- HSTS enabled with long max-age
- Certificate pinning for API calls

### 7. Code Execution Sandboxing

Code Lab uses E2B for isolated execution:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    E2B SANDBOX ISOLATION                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User Code ───► E2B API ───► Isolated VM                            │
│                                │                                     │
│                                ▼                                     │
│                    ┌───────────────────────┐                        │
│                    │  SANDBOX ENVIRONMENT  │                        │
│                    │  • No network egress  │                        │
│                    │  • No host access     │                        │
│                    │  • Resource limits    │                        │
│                    │  • Time limits        │                        │
│                    └───────────────────────┘                        │
│                                │                                     │
│                                ▼                                     │
│                         Output ───► User                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Sandbox Properties:**

- Complete isolation from host system
- No access to other user sessions
- Automatic cleanup after execution
- Resource and time limits enforced

### 8. Injection Prevention

**Command Injection:**

```typescript
// All shell arguments are sanitized
export function sanitizeShellArg(input: string): string {
  let sanitized = input.replace(/\0/g, '');
  sanitized = sanitized.replace(/'/g, "'\\''");
  return `'${sanitized}'`;
}
```

**Path Traversal:**

```typescript
// File paths are validated against allowed directories
const allowedPrefixes = ['/workspace', '/tmp', '/home'];
const isAllowed = allowedPrefixes.some((prefix) => sanitized.startsWith(prefix));
```

**SQL Injection:**

- All queries use parameterized statements
- Row-Level Security provides additional protection
- No raw SQL execution from user input

---

## Logging & Monitoring

### Correlation ID Tracking

Every request is assigned a unique correlation ID for end-to-end tracing:

```typescript
// Correlation ID is included in all logs and responses
X-Correlation-ID: uuid-v4-format

// Flow tracking through system
Client Request → API Handler → AI Service → Database → Response
       │              │             │           │          │
       └──────────────┴─────────────┴───────────┴──────────┘
                    Same Correlation ID
```

**Benefits:**

- Debug issues across distributed services
- Audit trail for security investigations
- Performance monitoring per request
- User support escalation

### Structured Logging

All security events are logged with:

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string;
  message: string;
  correlationId?: string; // Request tracking
  context?: object; // Automatically redacted
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}
```

### PII Redaction

Sensitive fields are automatically redacted:

```typescript
const redactedFields = [
  'password',
  'token',
  'api_key',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'email',
  'phone',
  'ssn',
  'credit_card',
];
```

### Security Events Logged

- Authentication attempts (success/failure)
- CSRF validation failures
- Rate limit violations
- Input validation errors
- Sandbox execution events
- Admin actions

---

## Vulnerability Management

### Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

**Email:** security@jcil.ai

**Please include:**

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Any suggested remediation

**Our Commitment:**

- Acknowledge receipt within 24 hours
- Provide initial assessment within 72 hours
- Keep you informed of remediation progress
- Credit reporters (with permission) in security advisories

### Dependency Management

- Automated vulnerability scanning via Dependabot
- Regular dependency updates (weekly review)
- Lock file integrity verification
- No known critical vulnerabilities policy

---

## Compliance

### Current Status

| Framework     | Status      | Details                              |
| ------------- | ----------- | ------------------------------------ |
| SOC 2 Type II | In Progress | Target Q2 2025                       |
| GDPR          | Compliant   | Full data subject rights implemented |
| CCPA          | Compliant   | Privacy policy updated               |
| HIPAA         | Eligible    | Via Anthropic infrastructure         |

### GDPR Data Subject Rights

Full implementation of user data rights:

| Right                  | Implementation              | API Endpoint                               |
| ---------------------- | --------------------------- | ------------------------------------------ |
| Right to Access        | Export all user data        | `/api/user/data`                           |
| Right to Deletion      | Delete account and all data | `/api/user/delete`                         |
| Right to Rectification | Edit messages               | `/api/conversations/[id]/messages/[msgId]` |
| Right to Portability   | JSON export                 | `/api/user/export`                         |

**Deletion Cascade:**

```
User Deletion Request
       │
       ▼
┌─────────────────────────────────┐
│  Delete user's conversations    │
│  Delete user's messages         │
│  Delete user's uploads          │
│  Delete user's audit logs       │
│  Delete user account            │
└─────────────────────────────────┘
       │
       ▼
  Confirmation Email Sent
```

### Data Handling

**Data Retention:**

- Conversation data: User-controlled deletion
- Soft-deleted data: 90-day recovery window
- Logs: 90-day retention
- Audit logs: 1-year retention
- Backups: 30-day retention

**Data Location:**

- Primary: United States (Vercel, Supabase)
- AI Processing: Anthropic infrastructure
- CDN: Global edge locations

---

## Scaling Security (100K+ Users)

### Enterprise Infrastructure Security

The platform implements security controls designed for 100,000+ concurrent users:

#### Queue System Security

| Control            | Implementation           | Purpose                         |
| ------------------ | ------------------------ | ------------------------------- |
| Job Authentication | User ID embedded in jobs | Prevent unauthorized processing |
| Priority Isolation | Separate queues by tier  | Prevent priority manipulation   |
| Rate Limiting      | Per-user, per-IP limits  | Prevent resource exhaustion     |
| Circuit Breakers   | Auto-trip on failures    | Prevent cascade failures        |

#### Cron Job Security

All cron jobs require CRON_SECRET authentication:

```typescript
// Required header for cron endpoints
Authorization: Bearer ${CRON_SECRET}
```

Protected cron endpoints:

- `/api/cron/cleanup-rate-limits` - Hourly cleanup
- `/api/cron/cleanup-stale-queue` - 5-minute cleanup
- `/api/cron/health-check` - 10-minute health monitoring

#### Database Connection Security

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONNECTION POOLING SECURITY                       │
├─────────────────────────────────────────────────────────────────────┤
│  • pgBouncer transaction mode (prevents connection hijacking)       │
│  • 30-second connection timeouts                                    │
│  • Singleton pattern prevents connection exhaustion                 │
│  • Row-Level Security enforced on all pooled connections            │
└─────────────────────────────────────────────────────────────────────┘
```

#### Redis Security

- TLS encryption for all Redis connections
- Password authentication required
- Key expiration prevents data accumulation
- Rate limit keys auto-expire after 2 hours

#### Circuit Breaker Protection

Prevents cascade failures when services are unhealthy:

| Service       | Timeout | Error Threshold | Recovery Time |
| ------------- | ------- | --------------- | ------------- |
| Anthropic API | 120s    | 50%             | 30s           |
| Database      | 30s     | 60%             | 10s           |
| Redis         | 5s      | 70%             | 5s            |

### Monitoring & Alerting

Security events at scale are monitored via:

- **Health Check Cron**: Every 10 minutes
- **Queue Status API**: Real-time monitoring
- **Circuit Breaker Events**: Logged and alerted
- **Rate Limit Violations**: Tracked per user/IP

Alert webhook integration for critical events:

- Circuit breaker state changes
- High queue utilization (>80%)
- API key exhaustion
- Database connection issues

---

## Security Checklist

### For Developers

- [ ] All user input validated with Zod schemas
- [ ] CSRF protection on state-changing endpoints
- [ ] Rate limiting configured appropriately
- [ ] Sensitive data encrypted before storage
- [ ] No secrets in code or logs
- [ ] Error messages don't leak implementation details
- [ ] Tests cover security controls

### For Operations

- [ ] TLS certificates valid and auto-renewing
- [ ] Security headers configured correctly
- [ ] Rate limits tuned for traffic patterns
- [ ] Log aggregation and alerting configured
- [ ] Backup and recovery tested
- [ ] Incident response plan documented

---

## Contact

**Security Team:** security@jcil.ai

**For urgent security matters:** Include "URGENT" in subject line

---

_Last Updated: January 2026_
_Version: 2.0_
