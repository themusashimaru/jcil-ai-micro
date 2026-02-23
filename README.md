# JCIL.AI

> **AI-Powered Platform** — Built on Anthropic Claude

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Anthropic](https://img.shields.io/badge/Powered%20by-Anthropic%20Claude-orange)](https://anthropic.com/)

---

## Overview

JCIL.AI is an AI-powered platform featuring a chat interface, browser-based code lab, document generation, and research agents. Built on Next.js 14, Supabase PostgreSQL, and Anthropic Claude.

### Core Features

| Feature | Description | Status |
|---|---|---|
| **AI Chat** | Conversational interface powered by Claude | Active |
| **Code Lab** | Browser-based coding environment with E2B sandboxing | Active |
| **Web Search** | Real-time search via Brave API | Active |
| **Web Scraping** | URL content extraction and parsing | Active |
| **Code Execution** | Sandboxed code execution environment | Active |
| **Document Generation** | Resume builder with DOCX/PDF output | Active |
| **Deep Strategy** | Multi-agent research orchestration | Active |

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14, React 18, TypeScript 5.4 | SSR, type safety |
| AI | Anthropic Claude (Haiku/Sonnet/Opus) | Agentic AI |
| Database | Supabase PostgreSQL | User data, sessions, RLS |
| Cache | Upstash Redis | Rate limiting |
| Auth | Supabase Auth + WebAuthn | OAuth, passkeys |
| Payments | Stripe | Subscriptions |
| Sandboxing | E2B | Isolated code execution |
| Hosting | Vercel | Production deployment |

---

## Getting Started

### Prerequisites

- Node.js 20.x+
- pnpm 8+
- Supabase project
- Anthropic API key

### Installation

```bash
# Clone repository
git clone https://github.com/themusashimaru/jcil-ai-micro.git
cd jcil-ai-micro

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
pnpm dev

# Run tests
pnpm test
```

### Required Environment Variables

```bash
ANTHROPIC_API_KEY=              # Claude API access
NEXT_PUBLIC_SUPABASE_URL=       # Database URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Database public key
SUPABASE_SERVICE_ROLE_KEY=      # Database admin key
```

### Optional

```bash
E2B_API_KEY=                    # Sandboxed code execution
UPSTASH_REDIS_REST_URL=         # Rate limiting
UPSTASH_REDIS_REST_TOKEN=       # Rate limiting
GITHUB_TOKEN=                   # GitHub integration
VERCEL_TOKEN=                   # Vercel deployments
STRIPE_SECRET_KEY=              # Payment processing
```

---

## Architecture

```
app/
  (auth)/                    # Authentication pages
  (chat)/                    # Chat interface
  api/
    chat/                    # Main AI chat endpoint
    code-lab/                # Code lab API routes
    documents/               # Document generation
    stripe/                  # Payment webhooks
    memory/                  # Memory agent

components/                  # React components
  code-lab/                  # Code lab UI

lib/
  ai/                        # AI provider integration
  db/                        # Database operations
  security/                  # Security utilities (CSRF, rate limiting, validation)
  tools/                     # Tool implementations
  supabase/                  # Supabase client

src/
  lib/                       # Additional libraries
  agents/                    # AI agent implementations
  components/                # Additional components
```

---

## Security

| Feature | Implementation |
|---|---|
| Row-Level Security | Supabase RLS policies on all tables |
| Input Validation | Zod schemas (50+) |
| CSRF Protection | Origin/Referer validation |
| Rate Limiting | Redis-backed sliding window |
| HTML Sanitization | DOMPurify |
| Auth Guards | `requireUser`/`requireAdmin` pattern |
| Sandboxed Execution | E2B isolated VMs |

---

## Development

### Running Tests

```bash
pnpm test              # Run tests
pnpm test -- --coverage # Run with coverage report
```

### Build Verification

```bash
npx tsc --noEmit       # Type check
pnpm lint              # ESLint
pnpm build             # Production build
```

### Commit Convention

```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, security, perf, chore
```

---

## Project Status

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for current verified metrics and state.

See [TASK_TRACKER.md](./TASK_TRACKER.md) for the full roadmap and progress.

See [APP_ASSESSMENT_AND_RECOMMENDATIONS.md](./APP_ASSESSMENT_AND_RECOMMENDATIONS.md) for the comprehensive assessment.

---

## Documentation

| Document | Description |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Session instructions and standards |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Current verified metrics |
| [TASK_TRACKER.md](./TASK_TRACKER.md) | Master task list |
| [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) | Cross-session continuity |
| [APP_ASSESSMENT_AND_RECOMMENDATIONS.md](./APP_ASSESSMENT_AND_RECOMMENDATIONS.md) | Full assessment report |
| [CTO_ASSESSMENT_REPORT.md](./CTO_ASSESSMENT_REPORT.md) | CTO-level technical review |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development guide |

---

## Subscription Plans

| Plan | Features | Price |
|---|---|---|
| **Free** | Basic chat, limited tokens | $0 |
| **Plus** | All features, Code Lab | $18/mo |
| **Pro** | Priority support, higher limits | $30/mo |
| **Executive** | Enterprise features | $99/mo |

---

## License

Proprietary - All Rights Reserved

Copyright (c) 2024-2026 JCIL.AI

---

## Support

- **Documentation**: [jcil.ai/docs](https://jcil.ai/docs)
- **Support**: support@jcil.ai
- **Security Issues**: security@jcil.ai

---

_Last updated: February 22, 2026_
