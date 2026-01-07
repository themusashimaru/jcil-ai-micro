# JCIL.AI

> **AI-Powered Development Platform** — Chat, Code Lab, Website Builder, and 30+ Tools

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![E2B](https://img.shields.io/badge/E2B-Sandbox-orange)](https://e2b.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## Overview

JCIL.AI is a comprehensive AI platform featuring **Code Lab** — a Claude Code competitor with sandboxed code execution, 30+ development tools, and ~90% feature parity with Claude Code. The platform also includes AI-powered chat, website building, and specialized tools for research, writing, and creative tasks.

### Key Products

| Product | Description | Status |
|---------|-------------|--------|
| **Code Lab** | Full IDE with AI agent, sandboxed execution, GitHub integration | ✅ Live |
| **AI Chat** | Contextual AI chat with Christian values lens | ✅ Live |
| **Website Builder** | AI-generated websites from descriptions | ✅ Live |
| **API Access** | Programmatic access to JCIL.AI capabilities | 🔜 Coming Soon |

---

## 🔬 Code Lab

A Claude Code-like development environment in your browser with isolated E2B sandboxes.

### Features at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│  CODE LAB - 90% CLAUDE CODE PARITY                              │
├─────────────────────────────────────────────────────────────────┤
│  ⚡ Shell Execution    │  📄 File Operations   │  🔍 Code Search │
│  ✏️ Smart Editing      │  📦 Git Integration   │  🧪 Test Runner │
│  🏗️ Build System       │  📋 Planning Mode     │  🔌 MCP Servers │
│  🪝 Hooks System       │  💾 Project Memory    │  ⏳ Background  │
│  🔐 Isolated Sandbox   │  💿 Persistent State  │  🐙 GitHub PRs  │
└─────────────────────────────────────────────────────────────────┘
```

### 30+ Workspace Tools

| Category | Tools |
|----------|-------|
| **File Operations** | `read_file`, `write_file`, `edit_file`, `list_directory`, `delete_file`, `move_file`, `copy_file` |
| **Shell & Execution** | `execute_shell`, `bg_run`, `bg_output`, `bg_kill`, `bg_list` |
| **Code Intelligence** | `search_files`, `search_code`, `analyze_codebase`, `get_file_info` |
| **Git & GitHub** | `git_status`, `git_diff`, `git_commit`, `git_log`, `git_branch`, `git_checkout`, `git_push`, `git_pull`, `create_pr`, `list_prs` |
| **Testing & Build** | `run_tests`, `run_build`, `run_lint` |
| **Planning Mode** | `enter_plan_mode`, `write_plan`, `exit_plan_mode` |
| **MCP Servers** | `mcp_list_servers`, `mcp_enable_server`, `mcp_disable_server` |
| **Hooks** | `hooks_list`, `hooks_enable`, `hooks_disable`, `hooks_create` |
| **Memory** | `memory_read`, `memory_create`, `memory_update`, `memory_add_section` |

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         JCIL.AI Platform                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│   │   Next.js   │    │   Anthropic  │    │    E2B Sandbox      │ │
│   │   Frontend  │───▶│   Claude AI  │───▶│    (Isolated VM)    │ │
│   │             │    │              │    │                     │ │
│   └─────────────┘    └──────────────┘    │  ┌───────────────┐  │ │
│         │                                │  │ /workspace    │  │ │
│         │            ┌──────────────┐    │  │  ├── .git/    │  │ │
│         └───────────▶│   Supabase   │    │  │  ├── src/     │  │ │
│                      │   Database   │    │  │  └── ...      │  │ │
│                      └──────────────┘    │  └───────────────┘  │ │
│                                          └─────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Claude Code Parity Comparison

| Feature | Claude Code | Code Lab |
|---------|-------------|----------|
| Shell execution | ✅ | ✅ |
| File read/write/edit | ✅ | ✅ |
| Git operations | ✅ | ✅ |
| GitHub PRs | ✅ | ✅ |
| Planning mode | ✅ | ✅ |
| MCP servers | ✅ | ✅ |
| Hooks system | ✅ | ✅ |
| Project memory | ✅ | ✅ (CODELAB.md) |
| Background tasks | ✅ | ✅ |
| Test runner | ✅ | ✅ |
| Build system | ✅ | ✅ |
| Sandboxed execution | Local | ✅ E2B Cloud |
| Persistent workspaces | Local | ✅ Cloud |
| Web-based | ❌ | ✅ |

---

## Tech Stack

### Core

- **Framework**: Next.js 14 (App Router), TypeScript 5, Tailwind CSS
- **AI**: Anthropic Claude (Haiku + Sonnet), Perplexity (web search)
- **Sandboxing**: E2B Code Interpreter (isolated cloud VMs)
- **Auth**: Supabase (Google OAuth)
- **Database**: Supabase Postgres with RLS
- **Storage**: Supabase Storage
- **Caching**: Upstash Redis / Vercel KV
- **Payments**: Stripe Subscriptions

### APIs & Integrations

- GitHub API (OAuth, repos, PRs)
- Google Maps, Places, Geocoding, Weather
- Model Context Protocol (MCP) servers

---

## Quick Start

### Prerequisites

- Node.js 20.x
- pnpm 8+
- Supabase project
- API keys (Anthropic, E2B, Perplexity, Stripe)

### Installation

```bash
# Clone repository
git clone https://github.com/themusashimaru/jcil-ai-micro.git
cd jcil-ai-micro

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Run development server
pnpm dev
```

### Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
ANTHROPIC_API_KEY=sk-ant-xxx
PERPLEXITY_API_KEY=pplx-xxx
E2B_API_KEY=e2b_xxx

# Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# GitHub (for Code Lab)
GITHUB_APP_ID=xxx
GITHUB_APP_PRIVATE_KEY=xxx

# Token Encryption
ENCRYPTION_KEY=your-32-byte-hex-key

# Optional
GOOGLE_MAPS_API_KEY=xxx
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Project Structure

```
jcil-ai-micro/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page
│   ├── chat/                     # AI Chat interface
│   ├── code-lab/                 # Code Lab IDE
│   │   ├── page.tsx              # Main Code Lab
│   │   └── about/                # Technical breakdown
│   ├── docs/                     # Documentation
│   │   ├── page.tsx              # Docs hub
│   │   └── code-lab/             # Code Lab docs
│   ├── api-info/                 # API coming soon
│   ├── tools/                    # Specialized tools
│   │   ├── email/
│   │   ├── essay/
│   │   ├── research/
│   │   └── website-builder/
│   ├── admin/                    # Admin panel
│   └── api/                      # API routes
│       ├── code-lab/             # Code Lab endpoints
│       │   ├── chat/
│       │   ├── files/
│       │   ├── git/
│       │   └── execute/
│       ├── chat/
│       └── auth/
├── src/
│   ├── components/               # React components
│   ├── lib/                      # Core libraries
│   │   ├── workspace/            # Code Lab core
│   │   │   ├── chat-integration.ts
│   │   │   ├── planning.ts
│   │   │   ├── mcp.ts
│   │   │   ├── hooks.ts
│   │   │   ├── memory.ts
│   │   │   ├── background-tasks.ts
│   │   │   └── security.ts
│   │   ├── supabase/
│   │   ├── redis/
│   │   └── stripe/
│   └── prompts/                  # AI prompt templates
└── public/                       # Static assets
```

---

## Security

### Implemented

- ✅ Command injection prevention (sanitized shell args, commit messages, file paths)
- ✅ Session ownership verification for all Code Lab operations
- ✅ AES-256-GCM token encryption with proper error handling
- ✅ E2B sandbox isolation (no access to host system)
- ✅ Supabase RLS for all user-scoped data
- ✅ Google OAuth only (no password storage)
- ✅ Rate limiting (Redis-backed)
- ✅ File upload validation (MIME, size)
- ✅ CSP, XSS/CSRF protection

### Security Utilities

```typescript
// /src/lib/workspace/security.ts
sanitizeShellArg(input)       // Escape shell arguments
sanitizeCommitMessage(msg)     // Safe git commit messages
sanitizeFilePath(path)         // Prevent path traversal
sanitizeGlobPattern(pattern)   // Safe glob patterns
validateEncryptedTokenFormat() // Token validation
```

---

## Subscription Tiers

| Tier | Messages/Day | Code Lab | Web Search | Price |
|------|-------------|----------|------------|-------|
| **Free** | 10 | ❌ | ✅ | $0 |
| **Basic** | 100 | ✅ | ✅ | $9/mo |
| **Pro** | 200 | ✅ | ✅ | $29/mo |
| **Executive** | 1000 | ✅ | ✅ | $99/mo |

---

## Development

```bash
# Development server
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Production build
pnpm build

# Start production server
pnpm start
```

---

## Documentation

- **[/docs](https://jcil.ai/docs)** — Documentation hub
- **[/docs/code-lab](https://jcil.ai/docs/code-lab)** — Code Lab comprehensive guide
- **[/code-lab/about](https://jcil.ai/code-lab/about)** — Technical breakdown

---

## Roadmap

### Completed
- [x] Code Lab with 30+ tools
- [x] Planning mode (EnterPlanMode/ExitPlanMode)
- [x] MCP server integration
- [x] Hooks system
- [x] Project memory (CODELAB.md)
- [x] Background task management
- [x] GitHub integration (PRs, commits)
- [x] Security hardening
- [x] Documentation pages

### In Progress
- [ ] API access for developers
- [ ] Team workspaces
- [ ] Real-time collaboration

### Planned
- [ ] Mobile app
- [ ] VS Code extension
- [ ] Enterprise SSO
- [ ] On-premise deployment

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with conventional commits
4. Open PR with clear description
5. Ensure CI passes

---

## License

Proprietary - All Rights Reserved

---

<div align="center">

**[Website](https://jcil.ai)** · **[Code Lab](https://jcil.ai/code-lab)** · **[Documentation](https://jcil.ai/docs)** · **[API (Coming Soon)](https://jcil.ai/api-info)**

Built with ❤️ by JCIL.AI

</div>
