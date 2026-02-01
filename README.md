# JCIL.AI

> **Enterprise-Grade AI Platform** — Built Exclusively on Anthropic Claude for Safety, Security, and Privacy

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Anthropic](https://img.shields.io/badge/Powered%20by-Anthropic%20Claude-orange)](https://anthropic.com/)
[![Tests](https://img.shields.io/badge/Tests-1542%20Passing-brightgreen)]()
[![Code Lab Tools](https://img.shields.io/badge/Code%20Lab%20Tools-55+-purple)]()
[![Chat Tools](https://img.shields.io/badge/Chat%20Tools-371+-green)]()
[![MCP](https://img.shields.io/badge/MCP%20Servers-5-blue)]()
[![Enhancements](https://img.shields.io/badge/Major%20Enhancements-10-orange)]()

---

## Code Lab: Claude Code in Your Browser

**Build, test, and deploy software with an AI that can actually do things.** Code Lab is a fully-functional agentic development environment powered by Claude Opus 4.5 with 55+ tools, real MCP server integration, and cloud-sandboxed execution.

```
You: "Set up a React app with TypeScript, add a dark mode toggle, and deploy to Vercel"

Code Lab:
  [execute_shell] npx create-react-app my-app --template typescript
  [write_file] src/components/ThemeToggle.tsx
  [edit_file] src/App.tsx - adding theme context
  [run_tests] npm test -- --watchAll=false
  [deploy_vercel] Deploying to production...

  Done. Your app is live at: https://my-app.vercel.app
```

### Why Developers Love Code Lab

| Capability                | What It Means                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Real Execution**        | Not just code suggestions—Claude actually runs commands, edits files, and deploys apps |
| **Cloud Sandboxed**       | Every workspace runs in an isolated E2B VM. No local setup, no risk to your machine    |
| **Persistent Workspaces** | Come back tomorrow—your code, packages, and git history are still there                |
| **MCP Protocol**          | Connect to GitHub, databases, browsers, and more through Model Context Protocol        |
| **One-Click Deploy**      | Ship to Vercel, Netlify, Railway, or Cloudflare directly from the chat                 |

---

## MCP Server Integration

**Model Context Protocol (MCP)** extends Claude's capabilities beyond the sandbox. Connect to external services, automate browsers, query databases—all through natural language.

### Available MCP Servers

#### Puppeteer — Browser Automation

Automate any web browser task. Scrape data, test UIs, generate screenshots.

```typescript
// What you say:
"Navigate to github.com/anthropics/claude-code and screenshot the README"

// What happens:
[mcp_enable_server] puppeteer
[mcp__puppeteer__navigate] https://github.com/anthropics/claude-code
[mcp__puppeteer__screenshot] /workspace/github-readme.png

// Result: Screenshot saved to your workspace
```

**Use Cases:**

- Visual regression testing
- Automated form filling and submission
- Scraping dynamic JavaScript-rendered content
- Generating PDFs from web pages
- E2E testing without writing test code

---

#### GitHub — Repository Integration

Full GitHub access through Claude. Create issues, open PRs, explore repos.

```typescript
// What you say:
"Check the open issues on my repo and create a PR for the bug fix I just made"

// What happens:
[mcp__github__list_issues] owner: myuser, repo: my-project, state: open
[mcp__github__create_pr] title: "Fix authentication timeout bug"

// Result: PR #47 created with your changes
```

**Capabilities:**

- `get_repo` — Repository metadata, stars, forks, description
- `list_issues` — Filter by state (open/closed/all)
- `create_issue` — File bugs or feature requests programmatically
- `create_pr` — Open pull requests with descriptions

---

#### PostgreSQL — Database Queries

Query your database directly through Claude. Explore schemas, analyze data, debug queries.

```typescript
// What you say:
"Show me the top 10 users by activity in the last 30 days"

// What happens:
[mcp__postgres__query] SELECT user_id, COUNT(*) as activity
                       FROM events
                       WHERE created_at > NOW() - INTERVAL '30 days'
                       GROUP BY user_id
                       ORDER BY activity DESC
                       LIMIT 10

// Result: Query results displayed in a formatted table
```

**Security:**

- SELECT queries only (no mutations)
- Row-Level Security enforced
- Connection through Supabase RPC

---

#### Memory — Persistent Key-Value Store

Store information across sessions. Remember project context, user preferences, learned patterns.

```typescript
// What you say:
"Remember that this project uses tabs for indentation and prefers async/await over callbacks"

// What happens:
[mcp__memory__store] key: "coding_style", value: {"indent": "tabs", "async": "async/await"}

// Next session:
[mcp__memory__retrieve] key: "coding_style"
// Claude automatically applies your preferences
```

**Use Cases:**

- Project-specific coding conventions
- Frequently used commands and snippets
- Cross-session context continuity
- User preference learning

---

#### Filesystem — Sandboxed File Operations

Full filesystem access within the secure E2B sandbox.

```typescript
// Capabilities:
[read_file][write_file][list_directory][search_files][move_file][copy_file]; // Read any file // Create or overwrite files // Explore folder structure // Glob pattern matching // Rename/relocate files // Duplicate files
```

---

## Deep Strategy Agent (Premium)

**The most advanced self-designing AI agent system.** Deep Strategy deploys an army of up to 100 AI agents conducting hundreds of real-time web searches to solve complex problems.

```
You: "I'm considering relocating to Austin for a tech job. I have a family,
     budget of $5000/month for housing, and need good schools."

Deep Strategy:
  ✓ Forensic intake - understanding your situation
  ✓ Opus 4.5 designing agent army
  ✓ Spawning 15 specialized scouts
  ● Conducting 47 parallel web searches...
  ○ Processing findings
  ○ Synthesizing strategic recommendations

Result: Comprehensive relocation strategy with:
  • Housing market analysis (12 neighborhoods evaluated)
  • School district rankings with specific recommendations
  • Cost of living comparison vs current location
  • Tech job market data with salary benchmarks
  • 90-day action plan with prioritized steps
```

### How It Works

| Tier                 | Model      | Role                                                           |
| -------------------- | ---------- | -------------------------------------------------------------- |
| **Master Brain**     | Opus 4.5   | Designs the agent army, validates findings, synthesizes output |
| **Project Managers** | Sonnet 4.5 | Coordinate groups of Scouts, aggregate research                |
| **Scout Army**       | Haiku 4.5  | Execute targeted searches via Brave Search API                 |

### Features

- **Self-Designing**: Analyzes your problem and creates specialized agents dynamically
- **Forensic Intake**: Deep interview process to understand full context
- **Document Upload**: Attach resumes, contracts, photos, spreadsheets
- **Mid-Execution Messaging**: Add context while running (like Claude Code)
- **Real-Time Progress**: Claude Code-style task list with streaming updates

### Safety Limits

```
$20 max budget │ 100 max scouts │ 500 max searches │ 10 min timeout
```

📄 **Full documentation**: [docs/DEEP_STRATEGY.md](./docs/DEEP_STRATEGY.md)

---

## Chat AI Tools (371+ Tools)

**Updated:** February 1, 2026 at 18:00 UTC
**Version:** 3.0.0 (10 Major Enhancements)

The main chat interface is now the **most capable AI chat ever built** with **371+ AI-powered tools** and 10 major enhancements.

### February 2026 - 10 Major Enhancements

| # | Enhancement | Description |
|---|-------------|-------------|
| 1 | **Real MCP Client** | Live server management, health monitoring |
| 2 | **Persistent Workspaces** | E2B sandboxes that persist across turns |
| 3 | **Smart Tool Chaining** | 6 predefined workflow templates |
| 4 | **GitHub Repo Context** | Full repository understanding |
| 5 | **Project View** | Multi-file tree navigation with syntax highlighting |
| 6 | **Live Preview** | Sandboxed HTML/React preview |
| 7 | **Code Memory** | Artifact persistence with semantic search |
| 8 | **Agentic Workflows** | Trigger phrases ("ship it", "test everything") |
| 9 | **Code Streaming** | Real-time file-by-file generation |
| 10 | **Self-Improving Tools** | Telemetry with failure detection |

### Tool Categories Overview

| Category | Count | Description |
|----------|-------|-------------|
| **Code Development** | 8 | Full-stack: generate, analyze, test, refactor |
| **Tool Orchestration** | 3 | Workflows, chaining, GitHub context |
| **Cybersecurity** | 100+ | SIEM, SOC, threat intel, compliance |
| **Science** | 80+ | Physics, chemistry, biology, astronomy |
| **Engineering** | 60+ | Mechanical, electrical, chemical |
| **Mathematics** | 30+ | Calculus, statistics, optimization |
| **Web & Research** | 15+ | Search, scraping, browser automation |
| **Media & Graphics** | 20+ | Image, audio, video processing |
| **Utilities** | 30+ | Conversion, validation, encoding |

### Key Tool Highlights

**Code Development (Pro Developer Suite)**
- `workspace` - Full coding workspace with bash, git, file operations
- `generate_code` - Production-quality code in any language
- `analyze_code` - Security, performance, quality analysis
- `generate_tests` - Unit, integration, e2e test generation
- `fix_error` - Debug and fix code errors with explanations

**Tool Orchestration (NEW)**
- `run_workflow` - Smart tool chaining with 6 predefined workflows
- `github_context` - Full repository understanding with code search
- Agentic triggers: "ship it", "test everything", "clean start"

**Research & Information**
- `web_search` - Real-time search via Brave API
- `fetch_url` - URL content extraction
- `youtube_transcript` - Video transcript extraction
- `parallel_research` - Multi-agent research orchestration

📄 **Full audit**: [docs/CHAT_TOOLS_REFERENCE.md](./docs/CHAT_TOOLS_REFERENCE.md)

---

## Complete Tool Reference

Code Lab provides **55+ tools** for autonomous software development:

### File Operations

```
read_file          Write content to files
write_file         Create or overwrite files
edit_file          Find-and-replace edits
list_files         Directory exploration
search_files       Glob pattern search
search_code        Grep through codebase
multi_edit         Atomic batch edits
```

### Shell & Execution

```
execute_shell      Run any command (npm, pip, cargo, go, etc.)
run_build          Auto-detect and run build
run_tests          Auto-detect and run tests
install_packages   Package manager detection
```

### Git & GitHub

```
git_status         Repository state
git_diff           View changes
git_commit         Stage and commit
git_log            Commit history
git_branch         Branch management
git_push           Push to remote
create_pr          Open pull requests
```

### Planning & Task Management

```
enter_plan_mode    Start structured planning
write_plan         Create execution plan
exit_plan_mode     Finalize and execute
todo_write         Track task progress (Claude Code parity)
```

### Background Tasks

```
bg_run             Start long-running process
bg_output          Stream task output
bg_kill            Terminate process
bg_list            View all tasks
```

### Project Memory

```
memory_read        Load project context
memory_create      Initialize memory file
memory_update      Modify stored context
memory_add_section Add new context section
```

### MCP Servers

```
mcp_list_servers   View all MCP servers
mcp_enable_server  Activate a server
mcp_disable_server Deactivate a server
mcp__*__*          Execute any MCP tool
```

### Deployment

```
deploy_vercel      Deploy to Vercel
deploy_netlify     Deploy to Netlify
deploy_railway     Deploy to Railway
deploy_cloudflare  Deploy to Cloudflare Pages
check_deploy_status Poll deployment progress
```

### Advanced

```
web_fetch          Fetch and parse URLs
spawn_task         Parallel sub-agents
notebook_edit      Jupyter notebook editing
ask_user           Request clarification
```

---

## Claude Code Parity Status

**Current Parity Score: 100%** | **Target: 100% — ACHIEVED**

### Feature Comparison: Code Lab vs Claude Code

| Feature                      | Claude Code (CLI) | JCIL Code Lab             | Status    |
| ---------------------------- | ----------------- | ------------------------- | --------- |
| Shell execution              | Local machine     | Cloud sandbox (E2B)       | ✅ Parity |
| File operations              | Local filesystem  | Cloud workspace           | ✅ Parity |
| Git integration              | Local git         | Full git + GitHub         | ✅ Parity |
| Planning mode                | Yes               | Yes                       | ✅ Parity |
| MCP servers                  | Local + remote    | 5 cloud-hosted            | ✅ Parity |
| Project memory (CLAUDE.md)   | Yes               | Yes                       | ✅ Parity |
| Background tasks             | Yes               | Yes                       | ✅ Parity |
| Extended thinking            | Yes               | Yes                       | ✅ Parity |
| Context compaction           | Yes               | Yes                       | ✅ Parity |
| LSP support                  | Yes               | Yes                       | ✅ Parity |
| **Event-driven hooks**       | Yes               | Yes                       | ✅ Parity |
| **Custom slash commands**    | Yes               | Yes                       | ✅ Parity |
| **Plugin system**            | Yes               | Yes + Marketplace UI      | ✅ Parity |
| **Subagent architecture**    | Yes               | Yes                       | ✅ Parity |
| **Tool permission patterns** | Yes               | Yes                       | ✅ Parity |
| **Session forking**          | Yes               | Yes                       | ✅ Parity |
| **Rewind/checkpointing**     | Yes               | Yes                       | ✅ Parity |
| **MCP scopes**               | Yes               | Full 4-tier hierarchy     | ✅ Parity |
| **Output styles**            | Yes               | Yes (concise/verbose/etc) | ✅ Parity |
| **Vim mode**                 | Yes               | Yes (full keybindings)    | ✅ Parity |
| Browser automation           | Via MCP           | Puppeteer MCP             | ✅ Parity |
| Database queries             | Via MCP           | PostgreSQL MCP            | ✅ Parity |
| One-click deploy             | No                | 4 platforms               | ✅ Beyond |
| Web-based                    | No                | Yes                       | ✅ Beyond |
| Zero local setup             | No                | Yes                       | ✅ Beyond |
| Multi-language debugger      | No                | 32 languages              | ✅ Beyond |
| Visual debugging UI          | No                | Yes                       | ✅ Beyond |

See [CLAUDE_CODE_PARITY.md](./CLAUDE_CODE_PARITY.md) for detailed feature tracking.

---

## Why Anthropic Exclusively

JCIL.AI is built **exclusively** on [Anthropic's Claude](https://anthropic.com/) models. This is a deliberate choice:

| Principle             | Why Anthropic                                                 |
| --------------------- | ------------------------------------------------------------- |
| **Safety First**      | Constitutional AI ensures helpful, harmless, honest responses |
| **Privacy by Design** | No training on user data, enterprise-grade handling           |
| **Security**          | SOC 2 Type II certified, HIPAA eligible infrastructure        |
| **Transparency**      | Published safety research, clear documentation                |

### Model Configuration

| Use Case    | Model             | Purpose                                     |
| ----------- | ----------------- | ------------------------------------------- |
| Chat (Fast) | Claude Haiku 4.5  | Quick responses, cost-effective             |
| Documents   | Claude Sonnet 4.5 | Quality JSON output, structured generation  |
| Code Lab    | Claude Opus 4.5   | Complex reasoning, multi-step agentic tasks |

---

## Security & Compliance

### Defense-in-Depth Architecture

```
LAYER 1: NETWORK
├── TLS 1.3 encryption in transit
├── Security headers (CSP, HSTS, X-Frame-Options)
└── DDoS protection via Vercel Edge

LAYER 2: APPLICATION
├── CSRF protection on all state-changing requests
├── Input validation with 50+ Zod schemas
├── Rate limiting (Redis-backed)
└── Request size limits per route

LAYER 3: DATA
├── AES-256-GCM encryption for sensitive tokens
├── Row-Level Security (RLS) in Supabase
├── PII redaction in logs
└── No plaintext secrets in code

LAYER 4: EXECUTION
├── E2B sandboxed VMs for code execution
├── Command injection prevention
├── Path traversal protection
└── Session ownership verification
```

### SOC 2 Readiness

| Control Area         | Status |
| -------------------- | ------ |
| Security             | Ready  |
| Availability         | Ready  |
| Processing Integrity | Ready  |
| Confidentiality      | Ready  |
| Privacy              | Ready  |

---

## Accessibility & UX

Code Lab is built to **WCAG 2.1 Level AA** standards with production-grade UX patterns.

### Accessibility Features

| Feature              | Implementation                                  | Standard       |
| -------------------- | ----------------------------------------------- | -------------- |
| **Color Contrast**   | All text meets 4.5:1 minimum ratio              | WCAG 2.1 1.4.3 |
| **Focus Management** | Focus traps in modals, visible focus indicators | WCAG 2.4.3     |
| **ARIA Labels**      | All interactive elements properly labeled       | WCAG 4.1.2     |
| **Keyboard Nav**     | Full keyboard support, no mouse required        | WCAG 2.1.1     |
| **Screen Readers**   | Semantic HTML, live regions for updates         | WCAG 4.1.3     |

### Design System

Centralized design tokens ensure consistency across all components:

```typescript
// src/styles/design-tokens.ts

// WCAG AA Compliant Text Colors (on white)
--cl-text-primary: #1a1f36    // 14.1:1 ratio
--cl-text-secondary: #374151  // 8.5:1 ratio
--cl-text-tertiary: #4b5563   // 5.9:1 ratio
--cl-text-muted: #6b7280      // 4.0:1 ratio (placeholders only)

// Z-Index Hierarchy
workspacePanel: 35
backdrop: 44
sidebar: 45
modal: 50
commandPalette: 100
toast: 1000
```

### UX Patterns

| Pattern                 | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| **Toast Notifications** | Non-blocking error/success feedback        |
| **Skeleton Loaders**    | Perceived performance during data fetching |
| **Focus Traps**         | Keep keyboard focus within modals          |
| **Command Palette**     | Cmd+K quick actions with fuzzy search      |
| **Slash Commands**      | 11 shortcuts for common operations         |

---

## Technical Stack

| Layer          | Technology                               | Purpose               |
| -------------- | ---------------------------------------- | --------------------- |
| **Frontend**   | Next.js 14, React 18, TypeScript 5.4     | SSR, type safety      |
| **AI**         | Anthropic Claude (Haiku/Sonnet/Opus 4.5) | Agentic AI            |
| **Database**   | Supabase PostgreSQL                      | User data, sessions   |
| **Cache**      | Upstash Redis                            | Rate limiting, queues |
| **Auth**       | Supabase Auth + WebAuthn                 | OAuth, passkeys       |
| **Payments**   | Stripe                                   | Subscriptions         |
| **Sandboxing** | E2B                                      | Isolated execution    |
| **Search**     | Perplexity                               | Web search            |

### Quality Metrics

| Metric             | Value       |
| ------------------ | ----------- |
| TypeScript Errors  | 0           |
| ESLint Warnings    | 0           |
| Test Coverage      | 1,542 tests |
| Test Files         | 54          |
| Coverage Threshold | 75%         |
| Build Warnings     | 0           |

---

## Getting Started

### Prerequisites

- Node.js 20.x+
- pnpm 8+ (recommended)
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
ANTHROPIC_API_KEY=           # Claude API access
NEXT_PUBLIC_SUPABASE_URL=    # Database URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Database public key
SUPABASE_SERVICE_ROLE_KEY=   # Database admin key
```

### Optional (Recommended)

```bash
E2B_API_KEY=          # Sandboxed execution
UPSTASH_REDIS_REST_URL= # Rate limiting
GITHUB_TOKEN=         # GitHub MCP
VERCEL_TOKEN=         # Vercel deployments
```

---

## Documentation

| Document                                      | Description             |
| --------------------------------------------- | ----------------------- |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md)     | System design           |
| [CODE_LAB.md](./docs/CODE_LAB.md)             | Code Lab technical spec |
| [MEMORY_SYSTEM.md](./docs/MEMORY_SYSTEM.md)   | Memory Agent            |
| [SECURITY.md](./docs/SECURITY.md)             | Security policies       |
| [SOC2_READINESS.md](./docs/SOC2_READINESS.md) | Compliance              |
| [CONTRIBUTING.md](./CONTRIBUTING.md)          | Development guide       |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md)      | Current status          |
| [CODE_LAB_AUDIT.md](./docs/CODE_LAB_AUDIT.md) | Technical audit report  |

---

## Subscription Plans

| Plan          | Tokens/Month      | Features               | Price  |
| ------------- | ----------------- | ---------------------- | ------ |
| **Free**      | 10,000 (one-time) | Basic chat, web search | $0     |
| **Plus**      | 1,000,000         | All features, Code Lab | $18/mo |
| **Pro**       | 3,000,000         | Priority support       | $30/mo |
| **Executive** | 5,000,000         | Enterprise features    | $99/mo |

---

## Roadmap

### Completed (Phase 1-15)

- [x] Multi-agent architecture (Research, Code, Document, Memory)
- [x] Code Lab with 55+ tools
- [x] 5 MCP servers (Filesystem, GitHub, Memory, Puppeteer, PostgreSQL)
- [x] E2B sandboxed execution
- [x] Multi-platform deployment (Vercel, Netlify, Railway, Cloudflare)
- [x] Enterprise security (CSRF, validation, rate limiting)
- [x] 1,542 automated tests with 75% coverage thresholds
- [x] Document generation (PDF, DOCX, XLSX)
- [x] WebAuthn/Passkey authentication
- [x] GDPR-compliant memory management
- [x] LSP support (TypeScript, Python, Go)
- [x] Real PTY terminal with xterm.js
- [x] Extended thinking visualization
- [x] Context compaction
- [x] Session management with history
- [x] Multi-language debugger (32 languages via DAP/CDP)
- [x] Cognitive debugging with SSE broadcaster

### Completed (Phase 16-17: 100% Claude Code Parity)

- [x] **Event-driven hook system** (PreToolUse, PostToolUse, SessionStart, etc.)
- [x] **Custom slash commands** (`.claude/commands/` support)
- [x] **Subagent architecture** (spawnable specialized agents)
- [x] **Tool permission patterns** (glob-based allow/deny rules)
- [x] **Session forking** (parallel workspaces)
- [x] **Rewind/checkpointing** (full workspace state rollback)
- [x] **MCP scopes** (full 4-tier hierarchy: managed > user > project > local)
- [x] **Plugin system** (loader, registry, manifest + marketplace UI)
- [x] **Output styles** (concise, verbose, markdown, minimal formatting)
- [x] **Vim mode** (full editor keybindings)

### Planned (Phase 18+)

- [ ] SOC 2 Type II certification
- [ ] API access for developers
- [ ] Team workspaces with RBAC
- [ ] Additional MCP servers (Slack, Linear, Notion)
- [ ] Enterprise SSO (SAML, OIDC)
- [ ] VS Code extension
- [ ] Mobile applications

---

## Support

- **Documentation**: [jcil.ai/docs](https://jcil.ai/docs)
- **Support**: support@jcil.ai
- **Security Issues**: security@jcil.ai

---

## License

Proprietary - All Rights Reserved

Copyright (c) 2024-2026 JCIL.AI

---

<div align="center">

**Built with Anthropic Claude** | **55+ Code Lab Tools** | **371+ Chat Tools** | **5 MCP Servers** | **10 Major Enhancements**

[Website](https://jcil.ai) | [Code Lab](https://jcil.ai/code-lab) | [Documentation](https://jcil.ai/docs)

*Last updated: February 1, 2026 at 18:00 UTC - Version 3.0.0*

</div>
