# JCIL.AI

> **Enterprise-Grade AI Platform** — Built Exclusively on Anthropic Claude for Safety, Security, and Privacy

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Anthropic](https://img.shields.io/badge/Powered%20by-Anthropic%20Claude-orange)](https://anthropic.com/)
[![Tests](https://img.shields.io/badge/Tests-685%20Passing-brightgreen)]()
[![Security](https://img.shields.io/badge/Security-Enterprise%20Grade-green)]()
[![SOC 2](https://img.shields.io/badge/SOC%202-In%20Progress-yellow)]()

---

## Why Anthropic Exclusively

JCIL.AI is built **exclusively** on [Anthropic's Claude](https://anthropic.com/) models. This is a deliberate choice rooted in our core values:

| Principle             | Why Anthropic                                                             |
| --------------------- | ------------------------------------------------------------------------- |
| **Safety First**      | Anthropic leads the industry in AI safety research with Constitutional AI |
| **Privacy by Design** | No training on user data, enterprise-grade data handling                  |
| **Security**          | SOC 2 Type II certified, HIPAA eligible infrastructure                    |
| **Transparency**      | Published safety research, clear model documentation                      |
| **Alignment**         | Constitutional AI ensures responses align with human values               |

We believe the future of AI must be built on a foundation of trust. Anthropic shares our commitment to developing AI that is helpful, harmless, and honest.

---

## Platform Overview

JCIL.AI is a comprehensive AI platform featuring **agentic AI capabilities** that go beyond simple chat:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        JCIL.AI PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  AI CHAT     │  │  CODE LAB    │  │  RESEARCH    │              │
│  │  Claude 4    │  │  Agentic IDE │  │  AGENT       │              │
│  │  Haiku/Sonnet│  │  30+ Tools   │  │  Multi-source│              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  DOCUMENT    │  │  WEBSITE     │  │  30+ TOOLS   │              │
│  │  GENERATION  │  │  BUILDER     │  │  Specialized │              │
│  │  PDF/DOCX/XLS│  │  AI-Powered  │  │  Workflows   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Products

| Product                | Description                          | Capabilities                                          |
| ---------------------- | ------------------------------------ | ----------------------------------------------------- |
| **AI Chat**            | Intelligent assistant with Claude 4  | Context-aware, faith-grounded, document generation    |
| **Code Lab**           | Agentic IDE with sandboxed execution | 30+ tools, GitHub integration, persistent workspaces  |
| **Research Agent**     | Multi-source research synthesis      | Dynamic queries, source evaluation, citations         |
| **Document Generator** | Professional document creation       | PDF invoices, Word docs, Excel spreadsheets           |
| **Memory Agent**       | Persistent personalization           | Learns preferences, remembers context across sessions |

---

## Agentic Architecture

Our platform is built on a sophisticated **multi-agent architecture** that enables autonomous task execution:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AGENTIC AI SYSTEM                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  USER REQUEST                                                        │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────┐                                                │
│  │  INTENT ANALYZER │ ◄── Understands user goals                    │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ STRATEGY ENGINE │ ◄── Plans execution approach                   │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────┐                │
│  │              AGENT ORCHESTRATOR                   │                │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │                │
│  │  │ Research │  │   Code   │  │ Document │       │                │
│  │  │  Agent   │  │  Agent   │  │  Agent   │       │                │
│  │  └──────────┘  └──────────┘  └──────────┘       │                │
│  │               ┌──────────┐                       │                │
│  │               │  Memory  │ ◄── Persistent       │                │
│  │               │  Agent   │     context across   │                │
│  │               └──────────┘     conversations    │                │
│  └────────┬────────────────────────────────────────┘                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │   SYNTHESIZER   │ ◄── Combines results into coherent output      │
│  └─────────────────┘                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Capabilities

| Agent              | Capabilities                                                     | Use Cases                                                     |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| **Research Agent** | Multi-source search, fact verification, citation generation      | Market research, fact-checking, academic research             |
| **Code Agent**     | Code analysis, generation, refactoring, security scanning        | Software development, code review, debugging                  |
| **Document Agent** | Template-based generation, formatting, export                    | Invoices, reports, contracts, presentations                   |
| **Memory Agent**   | Cross-conversation context, preference learning, personalization | Personalized assistance, context continuity, user preferences |

---

## Security & Compliance

### Enterprise-Grade Security

We implement defense-in-depth security across all layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LAYER 1: NETWORK                                                    │
│  ├── TLS 1.3 encryption in transit                                  │
│  ├── Security headers (CSP, HSTS, X-Frame-Options)                  │
│  └── DDoS protection via Vercel Edge                                │
│                                                                      │
│  LAYER 2: APPLICATION                                                │
│  ├── CSRF protection on all state-changing requests                 │
│  ├── Input validation with 50+ Zod schemas                          │
│  ├── Rate limiting (Redis-backed)                                   │
│  └── Request size limits per route                                  │
│                                                                      │
│  LAYER 3: DATA                                                       │
│  ├── AES-256-GCM encryption for sensitive tokens                    │
│  ├── Row-Level Security (RLS) in Supabase                           │
│  ├── PII redaction in logs                                          │
│  └── No plaintext secrets in code                                   │
│                                                                      │
│  LAYER 4: EXECUTION                                                  │
│  ├── E2B sandboxed VMs for code execution                           │
│  ├── Command injection prevention                                    │
│  ├── Path traversal protection                                       │
│  └── Session ownership verification                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Security Features

| Feature                  | Implementation                        | Status      |
| ------------------------ | ------------------------------------- | ----------- |
| CSRF Protection          | Origin/Referer validation             | ✅ Complete |
| Input Validation         | 50+ Zod schemas                       | ✅ Complete |
| Rate Limiting            | Redis + database-backed               | ✅ Complete |
| Request Size Limits      | Middleware + route-specific           | ✅ Complete |
| SQL Injection Prevention | Parameterized queries + RLS           | ✅ Complete |
| XSS Prevention           | Content sanitization + CSP            | ✅ Complete |
| Encryption               | AES-256-GCM for tokens                | ✅ Complete |
| Audit Logging            | Structured logging with PII redaction | ✅ Complete |

### SOC 2 Readiness

We are actively working toward SOC 2 Type II certification:

| Control Area         | Status   | Details                                     |
| -------------------- | -------- | ------------------------------------------- |
| Security             | 🟢 Ready | Comprehensive security controls implemented |
| Availability         | 🟢 Ready | Queue management, failover, monitoring      |
| Processing Integrity | 🟢 Ready | Input validation, idempotency               |
| Confidentiality      | 🟢 Ready | Encryption, access controls                 |
| Privacy              | 🟢 Ready | PII handling, data minimization             |

See [SOC2_READINESS.md](./docs/SOC2_READINESS.md) for detailed compliance documentation.

---

## Technical Architecture

### Technology Stack

| Layer           | Technology                              | Purpose                            |
| --------------- | --------------------------------------- | ---------------------------------- |
| **Frontend**    | Next.js 14, React 18, TypeScript 5.4    | Server-side rendering, type safety |
| **AI Provider** | Anthropic Claude (Haiku 4.5 + Sonnet 4) | Chat, reasoning, code generation   |
| **Database**    | Supabase PostgreSQL                     | User data, conversations, sessions |
| **Cache**       | Upstash Redis                           | Rate limiting, queue, idempotency  |
| **Auth**        | Supabase Auth + WebAuthn                | OAuth, passkey authentication      |
| **Payments**    | Stripe                                  | Subscriptions, billing             |
| **Sandboxing**  | E2B                                     | Isolated code execution            |
| **Search**      | Perplexity                              | Web search, fact verification      |

### Reliability & Performance

```typescript
// Dual-pool API key rotation for high availability
Primary Pool → Round-robin load distribution
Fallback Pool → Emergency reserve on rate limits

// Request queue management
MAX_CONCURRENT_REQUESTS = 50
QUEUE_TIMEOUT_MS = 30000
REQUEST_TTL_SECONDS = 120

// Intelligent model routing
Simple queries → Claude Haiku 4.5 (fast, cost-effective)
Complex queries → Claude Sonnet 4 (deep reasoning)
```

### Quality Metrics

| Metric            | Value     | Target |
| ----------------- | --------- | ------ |
| TypeScript Errors | 0         | 0      |
| ESLint Warnings   | 0         | 0      |
| Test Coverage     | 685 tests | 700+   |
| Build Warnings    | 0         | 0      |
| Uptime Target     | 99.9%     | 99.9%  |

---

## Code Lab

A Claude Code-inspired development environment with 30+ agentic tools:

### Feature Comparison

| Feature               | Claude Code | JCIL Code Lab  |
| --------------------- | ----------- | -------------- |
| Shell execution       | ✅          | ✅             |
| File operations       | ✅          | ✅             |
| Git integration       | ✅          | ✅             |
| GitHub PRs            | ✅          | ✅             |
| Planning mode         | ✅          | ✅             |
| MCP servers           | ✅          | ✅             |
| Hooks system          | ✅          | ✅             |
| Project memory        | ✅          | ✅             |
| Background tasks      | ✅          | ✅             |
| Sandboxed execution   | Local       | ✅ Cloud (E2B) |
| Web-based             | ❌          | ✅             |
| Persistent workspaces | Local       | ✅ Cloud       |

### Available Tools (30+)

```
File Operations     Shell & Execution    Code Intelligence
─────────────────   ─────────────────    ─────────────────
read_file           execute_shell        search_files
write_file          bg_run               search_code
edit_file           bg_output            analyze_codebase
list_directory      bg_kill              get_file_info
delete_file         bg_list
move_file
copy_file

Git & GitHub        Testing & Build      Planning & Memory
─────────────────   ─────────────────    ─────────────────
git_status          run_tests            enter_plan_mode
git_diff            run_build            write_plan
git_commit          run_lint             exit_plan_mode
git_log                                  memory_read
git_branch                               memory_create
git_checkout                             memory_update
git_push
git_pull
create_pr
```

---

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 8+ (recommended) or npm
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

# Build for production
pnpm build
```

### Environment Configuration

See [.env.example](./.env.example) for all required and optional environment variables.

**Required:**

- `ANTHROPIC_API_KEY` - Claude API access
- `NEXT_PUBLIC_SUPABASE_URL` - Database URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Database public key
- `SUPABASE_SERVICE_ROLE_KEY` - Database admin key

**Recommended:**

- `UPSTASH_REDIS_REST_URL` - Redis for caching/rate limiting
- `E2B_API_KEY` - Sandboxed code execution
- `PERPLEXITY_API_KEY` - Web search capabilities

---

## Documentation

| Document                                      | Description                            |
| --------------------------------------------- | -------------------------------------- |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md)     | System design and component overview   |
| [MEMORY_SYSTEM.md](./docs/MEMORY_SYSTEM.md)   | Persistent Memory Agent technical spec |
| [SECURITY.md](./docs/SECURITY.md)             | Security policies and implementation   |
| [SOC2_READINESS.md](./docs/SOC2_READINESS.md) | Compliance checklist and status        |
| [CONTRIBUTING.md](./CONTRIBUTING.md)          | Development guidelines                 |
| [API.md](./docs/API.md)                       | API documentation                      |

---

## Subscription Plans

| Plan          | Tokens/Month      | Features                               | Price  |
| ------------- | ----------------- | -------------------------------------- | ------ |
| **Free**      | 10,000 (one-time) | Basic chat, web search                 | $0     |
| **Plus**      | 1,000,000         | All features, Code Lab                 | $18/mo |
| **Pro**       | 3,000,000         | Priority support, higher limits        | $30/mo |
| **Executive** | 5,000,000         | Enterprise features, dedicated support | $99/mo |

---

## Roadmap

### Completed

- [x] Multi-agent architecture (Research, Code, Document, Memory)
- [x] **Persistent Memory Agent** - Cross-conversation personalization
- [x] Code Lab with 30+ tools and Claude Code parity
- [x] Enterprise security (CSRF, validation, rate limiting)
- [x] 685+ automated tests
- [x] Document generation (PDF, DOCX, XLSX)
- [x] WebAuthn/Passkey authentication
- [x] GDPR-compliant memory management (right to erasure)

### In Progress

- [ ] SOC 2 Type II certification
- [ ] API access for developers
- [ ] Team workspaces with RBAC

### Planned

- [ ] Enterprise SSO (SAML, OIDC)
- [ ] On-premise deployment option
- [ ] Mobile applications
- [ ] VS Code extension

---

## Support & Contact

- **Documentation**: [jcil.ai/docs](https://jcil.ai/docs)
- **Support**: support@jcil.ai
- **Security Issues**: security@jcil.ai

---

## License

Proprietary - All Rights Reserved

Copyright (c) 2024-2025 JCIL.AI

---

<div align="center">

**Built with Anthropic Claude** | **Enterprise-Grade Security** | **SOC 2 In Progress**

[Website](https://jcil.ai) · [Code Lab](https://jcil.ai/code-lab) · [Documentation](https://jcil.ai/docs)

</div>
