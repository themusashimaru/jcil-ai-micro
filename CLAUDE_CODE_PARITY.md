# Claude Code Parity Tracker

**Last Updated:** January 19, 2026
**Current Parity Score:** ~85%
**Target:** 100%

---

## Executive Summary

JCIL Code Lab has achieved strong parity with Claude Code on core capabilities (file operations, terminal, MCP, git, sessions). The remaining gaps are in the **extensibility layer**: hooks, custom commands, plugins, and subagents. These features enable power users to customize and extend Claude Code's behavior.

---

## Status Overview

| Category        | Score | Status     | Gap Items                    |
| --------------- | ----- | ---------- | ---------------------------- |
| Core Tools      | 95%   | ✅ Strong  | -                            |
| MCP             | 80%   | 🟡 Partial | Scopes, managed config       |
| Session         | 75%   | 🟡 Partial | Forking, teleport            |
| Hooks           | 0%    | 🔴 Gap     | Event-driven hook system     |
| Extensibility   | 20%   | 🔴 Gap     | Commands, plugins, subagents |
| Editor/Terminal | 90%   | ✅ Strong  | Vim mode, output styles      |
| Security        | 95%   | ✅ Strong  | Tool permission patterns     |

---

## P0 - Critical Gaps (Must Have for Parity)

### 1. Event-Driven Hook System

**Status:** 🔴 Not Started
**Impact:** High - Core extensibility feature
**Effort:** Medium

Claude Code hooks enable users to intercept and modify tool behavior:

```typescript
// Example hook configuration (.claude/settings.json)
{
  "hooks": {
    "PreToolUse": [{
      "matcher": { "tool": "Bash", "command": "git push" },
      "command": "npm test",
      "onFailure": "block"
    }],
    "PostToolUse": [{
      "matcher": { "tool": "Edit" },
      "command": "eslint --fix $FILE"
    }],
    "SessionStart": [{
      "command": "echo 'Welcome to Code Lab!'",
      "once": true
    }]
  }
}
```

**Hook Types:**
| Hook | Trigger | Use Case |
|------|---------|----------|
| `PreToolUse` | Before any tool runs | Validation, confirmation |
| `PostToolUse` | After tool completes | Logging, auto-formatting |
| `PermissionRequest` | Before permission prompt | Custom approval flows |
| `UserPromptSubmit` | Before processing input | Input validation |
| `SessionStart` | Session begins | Environment setup |
| `SessionEnd` | Session ends | Cleanup, logging |
| `PreCompact` | Before context compaction | Save important context |
| `Notification` | Custom triggers | Alerts, webhooks |

**Implementation Files:**

```
src/lib/hooks/
├── event-hooks.ts       # Core hook system
├── hook-matcher.ts      # Pattern matching for tools
├── hook-executor.ts     # Bash/prompt execution
├── hook-config.ts       # Load .claude/hooks.json
└── index.ts             # Public API
```

**Implementation Tasks:**

- [ ] Create `src/lib/hooks/event-hooks.ts` with HookManager class
- [ ] Implement hook configuration loader (`.claude/hooks.json`)
- [ ] Add matcher system for tool-specific hooks (glob patterns)
- [ ] Implement bash command execution for hooks
- [ ] Implement prompt-based hooks (JSON output)
- [ ] Integrate with tool execution pipeline in `agent.ts`
- [ ] Add exit code handling (block, warn, continue)
- [ ] Add hook tests

---

### 2. Custom Slash Commands

**Status:** 🔴 Not Started
**Impact:** High - User customization
**Effort:** Low

Claude Code allows users to create custom commands:

```markdown
## <!-- .claude/commands/review.md -->

description: Review code changes
arguments:

- name: file
  description: File to review
  required: false

---

Review the following code for:

1. Security issues
2. Performance problems
3. Best practices

$ARGUMENTS
```

**Features:**

- Project commands: `.claude/commands/*.md`
- Personal commands: `~/.claude/commands/*.md`
- Argument templating: `$ARGUMENTS`, `$1`, `$2`, etc.
- File references: `@file.ts`
- Frontmatter metadata

**Implementation Files:**

```
src/lib/commands/
├── command-loader.ts    # Load command files
├── command-parser.ts    # Parse frontmatter + content
├── command-executor.ts  # Execute with arguments
└── index.ts
```

**Implementation Tasks:**

- [ ] Create command loader for `.claude/commands/` directory
- [ ] Parse markdown frontmatter for metadata
- [ ] Implement argument substitution (`$ARGUMENTS`, `$1`, `$2`)
- [ ] Add file reference expansion (`@file.ts`)
- [ ] Integrate with chat input (detect `/command` prefix)
- [ ] Add `/help` command discovery
- [ ] Add command tests

---

## P1 - Important Gaps (High Value)

### 3. Subagent Architecture

**Status:** 🟡 Partial
**Impact:** High - Enables parallel and specialized work
**Effort:** Medium

Claude Code has spawnable subagents with isolated contexts:

```typescript
// Task tool spawns specialized agents
{
  "tool": "Task",
  "input": {
    "description": "Review code security",
    "subagent_type": "code-reviewer",
    "prompt": "Review src/auth.ts for security issues",
    "run_in_background": true
  }
}
```

**Built-in Subagents:**
| Agent | Purpose | Tools Available |
|-------|---------|-----------------|
| `code-reviewer` | Code review | Read, Grep, Glob |
| `debugger` | Debug issues | Read, Bash, Grep |
| `researcher` | Research questions | Read, WebSearch, WebFetch |
| `Explore` | Codebase exploration | Read, Grep, Glob |
| `Plan` | Architecture planning | Read, Grep, Glob |

**Current State:** Has `/src/agents/code/` and `/src/agents/research/` but not spawnable via tool

**Implementation Files:**

```
src/lib/subagents/
├── subagent-manager.ts  # Spawn and manage subagents
├── subagent-types.ts    # Type definitions
├── built-in/
│   ├── code-reviewer.ts
│   ├── debugger.ts
│   ├── researcher.ts
│   └── explorer.ts
└── index.ts
```

**Implementation Tasks:**

- [ ] Create SubagentManager class in `src/lib/subagents/`
- [ ] Implement `Task` tool for spawning subagents
- [ ] Add context forking (subagent gets copy of context)
- [ ] Implement background execution with output tracking
- [ ] Add auto-compaction for long-running subagents
- [ ] Create built-in subagent prompts
- [ ] Add subagent tests

---

### 4. Tool Permission Patterns

**Status:** 🟡 Partial
**Impact:** Medium - Security and UX
**Effort:** Medium

Claude Code has granular permission controls:

```typescript
// Permission configuration
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Bash(git status)",
      "Bash(git diff)",
      "Bash(npm test)",
      "Edit(/src/**)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force)",
      "Edit(/node_modules/**)"
    ],
    "mode": "normal" // "auto-accept" | "plan" | "normal"
  }
}
```

**Permission Modes:**
| Mode | Behavior |
|------|----------|
| `auto-accept` | All tools run without prompts |
| `plan` | Read-only, no modifications |
| `normal` | Prompt for sensitive operations |

**Implementation Files:**

```
src/lib/permissions/
├── permission-manager.ts  # Check permissions
├── permission-matcher.ts  # Glob pattern matching
├── permission-config.ts   # Load settings
└── index.ts
```

**Implementation Tasks:**

- [ ] Create PermissionManager class
- [ ] Implement glob pattern matching for tools
- [ ] Add permission modes (auto-accept, plan, normal)
- [ ] Create permission prompt component
- [ ] Integrate with tool execution pipeline
- [ ] Add "Always allow" option per pattern
- [ ] Add permission tests

---

## P2 - Enhancement Gaps (Nice to Have)

### 5. Plugin System

**Status:** 🔴 Not Started
**Impact:** Medium - Ecosystem growth
**Effort:** High

Claude Code has an extensible plugin system:

```typescript
// Plugin manifest (plugin.json)
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Custom tools for my workflow",
  "commands": ["./commands/*.md"],
  "mcp_servers": ["./mcp-server.js"],
  "hooks": ["./hooks.json"]
}
```

**Implementation Files:**

```
src/lib/plugins/
├── plugin-loader.ts     # Load from GitHub/local
├── plugin-registry.ts   # Track installed plugins
├── plugin-sandbox.ts    # Isolate plugin execution
├── plugin-manifest.ts   # Parse plugin.json
└── index.ts
```

**Implementation Tasks:**

- [ ] Design plugin manifest format
- [ ] Create plugin loader (GitHub, local)
- [ ] Implement plugin registry in database
- [ ] Add plugin sandboxing for security
- [ ] Create plugin installation API
- [ ] Add plugin management UI
- [ ] Add plugin tests

---

### 6. Session Forking

**Status:** 🔴 Not Started
**Impact:** Medium - Parallel exploration
**Effort:** Medium

```typescript
// Session fork API
POST /api/code-lab/sessions/:id/fork
{
  "name": "experiment-branch"
}
// Returns new session with duplicated context
```

**Implementation Tasks:**

- [ ] Add session fork API endpoint
- [ ] Duplicate session messages and context
- [ ] Preserve file state at fork point
- [ ] Add fork UI in session history
- [ ] Add session rename (`/rename` command)
- [ ] Add fork tests

---

### 7. MCP Scopes

**Status:** 🔴 Not Started
**Impact:** Medium - Enterprise configuration
**Effort:** Medium

Claude Code supports MCP server scopes:

```typescript
// .claude/mcp.json (project scope)
{
  "servers": {
    "custom-db": {
      "command": "npx",
      "args": ["@myorg/mcp-db-server"],
      "env": { "DB_URL": "${DATABASE_URL}" }
    }
  }
}

// ~/.claude/mcp.json (user scope)
// Managed by organization (managed-mcp.json)
```

**Scope Priority:** managed > user > project > local

**Implementation Tasks:**

- [ ] Support project-level `.claude/mcp.json`
- [ ] Support user-level `~/.claude/mcp.json`
- [ ] Add scope priority resolution
- [ ] Support environment variable expansion
- [ ] Add managed MCP config for enterprise

---

## P3 - Polish (Optional)

### 8. Rewind/Checkpointing

**Status:** 🔴 Not Started
**Impact:** Medium - Safety net
**Effort:** Low

```typescript
// Track file changes during session
interface FileCheckpoint {
  id: string;
  timestamp: Date;
  files: Map<string, { before: string; after: string }>;
  description: string;
}

// /rewind command
('/rewind 3'); // Revert last 3 file changes
```

**Implementation Tasks:**

- [ ] Track file changes in session state
- [ ] Create checkpoint on each Edit/Write
- [ ] Implement `/rewind` command
- [ ] Add rewind UI with diff preview

---

### 9. Output Styles

**Status:** 🔴 Not Started
**Impact:** Low - Customization
**Effort:** Low

```typescript
// Output style configuration
{
  "outputStyle": "concise" | "verbose" | "markdown" | "minimal"
}
```

**Implementation Tasks:**

- [ ] Create output style configuration
- [ ] Implement style formatters
- [ ] Add `/style` command to switch

---

### 10. Vim Mode

**Status:** 🔴 Not Started
**Impact:** Low - Power users
**Effort:** Medium

**Implementation Tasks:**

- [ ] Add vim keybindings to code editor
- [ ] Implement `/vim` toggle command
- [ ] Add vim mode indicator in status bar

---

## Already at Parity ✅

### Core Tools (95%)

- [x] File operations (read, write, edit, glob, grep)
- [x] Multi-edit atomic operations
- [x] Search with ripgrep patterns

### Terminal (90%)

- [x] Real PTY terminal with xterm.js
- [x] ANSI color support
- [x] Command history
- [x] Background process support

### MCP (80%)

- [x] 5 production servers (Filesystem, GitHub, Memory, Puppeteer, PostgreSQL)
- [x] Tool discovery and execution
- [x] Server lifecycle management

### Git & GitHub (95%)

- [x] Full git operations (status, diff, commit, push, pull, branch)
- [x] GitHub MCP (issues, PRs, repos)
- [x] Commit message generation

### Session Management (75%)

- [x] Create, resume, delete sessions
- [x] Session history with search
- [x] Message persistence
- [x] Session templates

### Memory System (90%)

- [x] CLAUDE.md file support
- [x] Memory extraction and injection
- [x] Cross-session context

### Planning & Tasks (90%)

- [x] Plan mode with approval
- [x] Todo tracking
- [x] Background tasks with output

### Advanced (85%)

- [x] Extended thinking visualization
- [x] Context compaction
- [x] LSP support (TypeScript, Python, Go)
- [x] Image/screenshot support
- [x] Code review tools

### Security (95%)

- [x] 5-layer defense (network, application, data, execution)
- [x] CSRF, rate limiting, input validation
- [x] E2B sandboxed execution
- [x] Command injection prevention

### Beyond Claude Code ✨

- [x] Multi-platform deployment (Vercel, Netlify, Railway, Cloudflare)
- [x] Zero-install web access
- [x] Real-time collaboration
- [x] Visual debugging UI
- [x] Browser automation MCP
- [x] Database queries MCP

---

## Implementation Priority Matrix

| Feature                  | Impact | Effort | Priority | Est. Parity Boost |
| ------------------------ | ------ | ------ | -------- | ----------------- |
| Event-driven hooks       | High   | Medium | P0       | +5%               |
| Custom slash commands    | High   | Low    | P0       | +3%               |
| Tool permission patterns | Medium | Medium | P1       | +2%               |
| Subagent architecture    | High   | Medium | P1       | +3%               |
| Plugin system            | Medium | High   | P2       | +2%               |
| Session forking          | Medium | Medium | P2       | +1%               |
| MCP scopes               | Medium | Medium | P2       | +1%               |
| Rewind/checkpointing     | Medium | Low    | P3       | +1%               |
| Output styles            | Low    | Low    | P3       | +1%               |
| Vim mode                 | Low    | Medium | P3       | +1%               |

**Total potential gain: 20% → Target 100% parity**

---

## Progress Log

| Date         | Change                | Parity | Notes                  |
| ------------ | --------------------- | ------ | ---------------------- |
| Jan 19, 2026 | Initial gap analysis  | 85%    | Identified 10 gaps     |
| Jan 19, 2026 | Updated documentation | 85%    | README, parity tracker |
|              |                       |        |                        |

---

## Quick Start for Implementers

1. **Start with P0 items** - Hooks and commands give the biggest parity boost
2. **Use existing patterns** - Follow the structure in `src/lib/`
3. **Add tests** - Maintain 75% coverage threshold
4. **Update this document** - Check off tasks, update parity score

---

## Related Documentation

- [README.md](./README.md) - Project overview
- [CODE_LAB.md](./docs/CODE_LAB.md) - Technical specification
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Current status
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System design

---

_This document tracks progress toward 100% Claude Code feature parity._
_Target: Match all Claude Code capabilities in a browser-based environment._
