# Environment Variables for 100K User Scale

**IMPORTANT:** Set these in Vercel Dashboard → Settings → Environment Variables

## Queue Configuration (Critical)

```bash
# Increase from 50 to 500 concurrent requests
QUEUE_MAX_CONCURRENT=500

# Increase timeout from 30s to 60s
QUEUE_TIMEOUT_MS=60000
```

## Rate Limits (Per-Tier)

```bash
# Hourly limits by plan
RATE_LIMIT_FREE_HOURLY=60
RATE_LIMIT_PLUS_HOURLY=600
RATE_LIMIT_PRO_HOURLY=1200
RATE_LIMIT_EXEC_HOURLY=2400

# Per-minute burst limits
RATE_LIMIT_FREE_PER_MIN=10
RATE_LIMIT_PLUS_PER_MIN=60
RATE_LIMIT_PRO_PER_MIN=120
RATE_LIMIT_EXEC_PER_MIN=240
```

## Anthropic API Keys (Target: 30 keys)

```bash
# Primary Pool (20 keys for load distribution)
ANTHROPIC_API_KEY_1=sk-ant-api03-...
ANTHROPIC_API_KEY_2=sk-ant-api03-...
ANTHROPIC_API_KEY_3=sk-ant-api03-...
ANTHROPIC_API_KEY_4=sk-ant-api03-...
ANTHROPIC_API_KEY_5=sk-ant-api03-...
ANTHROPIC_API_KEY_6=sk-ant-api03-...
ANTHROPIC_API_KEY_7=sk-ant-api03-...
ANTHROPIC_API_KEY_8=sk-ant-api03-...
ANTHROPIC_API_KEY_9=sk-ant-api03-...
ANTHROPIC_API_KEY_10=sk-ant-api03-...
ANTHROPIC_API_KEY_11=sk-ant-api03-...
ANTHROPIC_API_KEY_12=sk-ant-api03-...
ANTHROPIC_API_KEY_13=sk-ant-api03-...
ANTHROPIC_API_KEY_14=sk-ant-api03-...
ANTHROPIC_API_KEY_15=sk-ant-api03-...
ANTHROPIC_API_KEY_16=sk-ant-api03-...
ANTHROPIC_API_KEY_17=sk-ant-api03-...
ANTHROPIC_API_KEY_18=sk-ant-api03-...
ANTHROPIC_API_KEY_19=sk-ant-api03-...
ANTHROPIC_API_KEY_20=sk-ant-api03-...

# Fallback Pool (10 keys for emergency)
ANTHROPIC_API_KEY_FALLBACK_1=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_2=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_3=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_4=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_5=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_6=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_7=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_8=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_9=sk-ant-api03-...
ANTHROPIC_API_KEY_FALLBACK_10=sk-ant-api03-...
```

## Redis Configuration (Upstash)

```bash
# Primary Redis (required)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# For BullMQ (if using standard Redis connection)
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
```

## Database Connection Pooling

```bash
# Use Supabase pooler URL (Transaction mode)
# Get this from: Supabase Dashboard → Settings → Database → Connection Pooling
DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Keep direct connection for migrations
DATABASE_URL_DIRECT=postgres://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres
```

## Cron Job Secret

```bash
# Required for cleanup cron jobs
CRON_SECRET=your-secure-random-string-here
```

## Monitoring (Optional but Recommended)

```bash
# OpenTelemetry (if using)
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector.com
OTEL_SERVICE_NAME=jcil-ai

# Sentry (if using)
SENTRY_DSN=https://your-sentry-dsn

# Custom alerts
ALERT_WEBHOOK_URL=https://your-slack-or-discord-webhook
```

## Vercel Configuration

```bash
# Function configuration
VERCEL_FUNCTIONS_MEMORY=1024
VERCEL_FUNCTIONS_MAX_DURATION=300
```

---

## Checklist Before Going Live

- [ ] Set QUEUE_MAX_CONCURRENT=500
- [ ] Set QUEUE_TIMEOUT_MS=60000
- [ ] Configure at least 10 Anthropic API keys
- [ ] Enable Supabase connection pooling
- [ ] Set DATABASE_URL to pooler URL
- [ ] Configure CRON_SECRET for cleanup jobs
- [ ] Verify Redis is configured and working
- [ ] Test with load to verify settings

## Capacity Planning

| Setting                  | Value           | Capacity Impact  |
| ------------------------ | --------------- | ---------------- |
| QUEUE_MAX_CONCURRENT=500 | 500 slots       | ~2,500 req/min   |
| 20 API keys              | 20 × 200 RPM    | 4,000 RPM        |
| Connection pooling       | 100 connections | 10K+ queries/sec |

**Expected capacity with these settings:** 5,000-10,000 concurrent users
