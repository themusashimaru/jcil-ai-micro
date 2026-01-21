# SESSION HANDOFF DOCUMENT

**Purpose:** Ensure seamless context transfer between Claude Code sessions
**Last Updated:** 2026-01-21
**Current Score:** 38/100
**Target:** 100/100

---

## QUICK START FOR NEW SESSIONS

### 1. Read These Files (In Order)

```bash
# 1. This file - Current state and context
cat SESSION_HANDOFF.md

# 2. Comprehensive roadmap - All tasks and phases
cat ROADMAP_TO_100.md

# 3. Detailed audit - Gap analysis
cat AUDIT_REPORT_VS_CLAUDE_CODE.md
```

### 2. Check Git State

```bash
git status
git log --oneline -10
git branch -a
```

### 3. Find Next Task

```bash
# Find first incomplete task
grep -A 5 "⬜ NOT STARTED" ROADMAP_TO_100.md | head -20
```

---

## PROJECT OVERVIEW

### What Is Code Lab?

Code Lab is a web-based AI coding assistant (like Claude Code) built into the JCIL AI Micro platform. It aims to provide Claude Code-like functionality in a browser environment.

### Technology Stack

| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Frontend | Next.js 14.2, React 18.3, TypeScript 5.4 |
| UI       | Tailwind CSS, Custom components          |
| AI       | Claude Opus 4.5 via Anthropic SDK        |
| Sandbox  | E2B Code Interpreter (containers)        |
| Database | Supabase (PostgreSQL)                    |
| Cache    | Upstash Redis                            |
| Auth     | Supabase Auth + WebAuthn                 |

### Key Directories

```
/src/agents/code/          # AI agent implementation
  ├── tools/               # Agent tools (Read, Write, Bash, etc.)
  ├── brain/               # Reasoning modules
  └── CodeAgentV2.ts       # Main agent class

/src/lib/workspace/        # Backend services
  ├── container.ts         # E2B sandbox management
  ├── mcp.ts              # MCP integration (NEEDS FIXING)
  ├── surgical-edit.ts    # Line-based editing
  └── chat-integration.ts # 57K lines - main workspace logic

/src/lib/debugger/         # Debug protocols (UNUSED)
  ├── cdp-client.ts       # Chrome DevTools Protocol
  ├── dap-client.ts       # Debug Adapter Protocol
  └── debug-manager.ts    # Session management

/src/lib/mcp/              # MCP protocol
  ├── mcp-client.ts       # Real implementation (NOT USED)
  └── client.ts           # HTTP facade

/src/components/code-lab/  # 37 React components
  ├── CodeLab.tsx         # Main component (1,320 lines)
  ├── CodeLabEditor.tsx   # Code editor
  ├── CodeLabTerminal.tsx # Terminal
  └── [35 more]

/app/api/code-lab/         # API routes
  ├── chat/               # Main AI endpoint
  ├── files/              # File operations
  ├── edit/               # Surgical editing
  └── [13 more]
```

---

## CURRENT STATE

### What's Working

1. **Core Tools** (60/100)
   - ReadTool - Reads files from E2B containers
   - WriteTool - Writes files to E2B containers
   - GlobTool - File pattern matching with minimatch
   - SearchTool - Code search with ripgrep patterns
   - BashTool - Command execution (HAS SECURITY ISSUES)

2. **UI Components** (55/100)
   - Chat interface with streaming
   - Code editor with syntax highlighting
   - Terminal emulator
   - File browser
   - Command palette

3. **Backend** (45/100)
   - E2B container management
   - Session persistence in Supabase
   - Rate limiting (in-memory only)
   - CSRF protection (on some endpoints)

### What's Broken

1. **Security** (35/100) - CRITICAL
   - Command injection in git operations
   - 8 endpoints missing CSRF
   - 9+ endpoints missing rate limiting
   - Session ownership not verified

2. **Debugging** (10/100)
   - CDP client: EXCELLENT code, NEVER USED
   - DAP client: EXCELLENT code, NEVER USED
   - No API endpoint
   - No UI component

3. **MCP** (25/100)
   - Real protocol in mcp-client.ts
   - MCPManager bypasses it with hardcoded tools
   - Can't connect to real MCP servers

4. **Agent System** (15/100)
   - No subagents/parallel execution
   - No background tasks
   - No agent hooks

5. **Configuration** (10/100)
   - No CLAUDE.md support
   - No custom skills
   - No user settings

---

## PHASE STATUS

| Phase            | Status         | Score  | Next Task                       |
| ---------------- | -------------- | ------ | ------------------------------- |
| 1. Security      | ⬜ NOT STARTED | 38→48  | Task 1.1: Fix command injection |
| 2. Debugging     | ⬜ NOT STARTED | 48→56  | -                               |
| 3. MCP           | ⬜ NOT STARTED | 56→64  | -                               |
| 4. Subagents     | ⬜ NOT STARTED | 64→76  | -                               |
| 5. LSP           | ⬜ NOT STARTED | 76→84  | -                               |
| 6. Memory/Config | ⬜ NOT STARTED | 84→90  | -                               |
| 7. UI/UX         | ⬜ NOT STARTED | 90→94  | -                               |
| 8. Plan Mode     | ⬜ NOT STARTED | 94→97  | -                               |
| 9. Testing       | ⬜ NOT STARTED | 97→100 | -                               |

---

## CRITICAL CONTEXT

### The "Unused Code" Problem

The codebase contains ~5,000 lines of excellent protocol implementations that are NEVER USED:

1. **CDP Client** (`/src/lib/debugger/cdp-client.ts`)
   - Full Chrome DevTools Protocol
   - WebSocket connection, breakpoints, variables
   - **Status:** Sits unused

2. **DAP Client** (`/src/lib/debugger/dap-client.ts`)
   - Full Debug Adapter Protocol
   - Python debugging support
   - **Status:** Sits unused

3. **MCP Client** (`/src/lib/mcp/mcp-client.ts`)
   - Real JSON-RPC 2.0 implementation
   - Stdio transport for local servers
   - **Status:** MCPManager doesn't use it

### The MCP Facade Problem

```typescript
// mcp-client.ts has REAL implementation:
class MCPClient {
  async listTools() {
    return this.request('tools/list', {});
  }
}

// But mcp.ts IGNORES it and hardcodes tools:
class MCPManager {
  async startServer(id) {
    // Does NOT spawn server
    // Does NOT use MCPClient
    // Just sets status and hardcodes tools
  }
}
```

**Fix:** MCPManager must USE MCPClient instead of bypassing it.

### Security Vulnerabilities

```typescript
// VULNERABLE (container.ts:763):
async gitCommit(message: string) {
  return this.run(`git commit -m "${message}"`);  // INJECTION!
}

// Exploit: message = 'test"; rm -rf / #'
```

**Fix:** Create shell escaping utilities and use them everywhere.

---

## GIT WORKFLOW

### Branch

All work is on: `claude/audit-coding-lab-hLMWt`

### Commit Convention

```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- security: Security fix
- docs: Documentation
- refactor: Code refactoring
- test: Adding tests
```

### Before Pushing

```bash
# Run linter
pnpm lint

# Run tests
pnpm test

# Check types
pnpm type-check
```

---

## SESSION LOG

### Session 2026-01-21 (Current)

**Completed:**

1. ✅ Fixed multi-provider model routing bug (CRITICAL)
2. ✅ Added `getProviderForModel()` and `getProviderAndModel()` to registry
3. ✅ Updated chat route to route requests to correct provider
4. ✅ Updated CODE_LAB_CRITICAL_BUGS.md with detailed documentation

**Findings:**

- Chat route was sending ALL model requests to Anthropic API
- Non-Claude models (GPT-5.2, Grok 4, DeepSeek, Gemini) returned 404 errors
- Key diagnostic: Anthropic request_id format (`req_011CXLt...`) in error responses
- Fix: Route requests through provider-specific adapters

**Key Files Changed:**

- `app/api/code-lab/chat/route.ts` - Added multi-provider routing logic
- `src/lib/ai/providers/registry.ts` - Added model-to-provider lookup functions

**Commit:** `2e788a6 fix(code-lab): route chat requests to correct provider based on model ID`

**Next Session Should:**

1. Test the multi-provider routing with live API keys
2. Verify all 5 providers work correctly (Claude, OpenAI, xAI, DeepSeek, Google)
3. Continue with Phase 1: Security Hardening if no issues found

---

### Session 2026-01-18

**Completed:**

1. ✅ Comprehensive audit vs Claude Code
2. ✅ Created AUDIT_REPORT_VS_CLAUDE_CODE.md
3. ✅ Created ROADMAP_TO_100.md
4. ✅ Created SESSION_HANDOFF.md

**Findings:**

- Real score: 38/100 (not 94%)
- 30 tasks identified to reach 100/100
- 24 weeks estimated timeline
- Security is Phase 1 priority

**Next Session Should:**

1. Start Phase 1: Security Hardening
2. Begin with Task 1.1: Fix command injection

### Previous Sessions (Summary)

**Sessions 1-4 (Before Audit):**

- Implemented agent tools (Read, Write, Glob, Search, Bash)
- Added CDP/DAP debug clients
- Added MCP container transport
- Added shell session manager
- Added rate limiting (incomplete)
- Added backup/restore for edits
- Improved glob patterns with minimatch
- Fixed pair programming messaging

---

## APPENDIX: COMMON TASKS

### Add CSRF to an Endpoint

```typescript
import { validateCsrfToken } from '@/lib/security/csrf';

export async function POST(request: NextRequest) {
  // 1. Validate CSRF
  const csrfResult = await validateCsrfToken(request);
  if (!csrfResult.valid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // 2. Continue with handler...
}
```

### Add Rate Limiting to an Endpoint

```typescript
import { rateLimiters } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  // 1. Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Check rate limit
  const rateLimit = await rateLimiters.codeLabEdit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // 3. Continue with handler...
}
```

### Verify Session Ownership

```typescript
import { verifySessionOwnership } from '@/lib/workspace/session-auth';

export async function POST(request: NextRequest) {
  const { sessionId } = await request.json();

  const isOwner = await verifySessionOwnership(sessionId, user.id, supabase);
  if (!isOwner) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Continue...
}
```

---

## CONTACT & RESOURCES

### Key References

- [Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [MCP Specification](https://modelcontextprotocol.io/)
- [DAP Specification](https://microsoft.github.io/debug-adapter-protocol/)
- [CDP Reference](https://chromedevtools.github.io/devtools-protocol/)

### User Expectations

From the user:

> "100% operational", "no stubs", "no mocks", "no facades"
> "comprehensive work valuing accuracy over speed"
> "Be the methodical software senior software engineer that I need"
> "let's get this to be 100 out of 100 in comparison to Claude code"

---

_This document should be updated at the end of every session._
