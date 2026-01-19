# Claude Code Parity Tracker

**Last Updated:** January 19, 2026
**Current Parity Score:** ~85%
**Target:** 95%+

---

## Status Overview

| Category        | Score | Status     |
| --------------- | ----- | ---------- |
| Core Tools      | 95%   | ✅ Strong  |
| MCP             | 80%   | 🟡 Partial |
| Session         | 75%   | 🟡 Partial |
| Hooks           | 30%   | 🔴 Gap     |
| Extensibility   | 40%   | 🔴 Gap     |
| Editor/Terminal | 90%   | ✅ Strong  |
| Security        | 95%   | ✅ Strong  |

---

## P0 - Critical Gaps

### 1. Event-Driven Hook System

**Status:** 🔴 Not Started
**Impact:** High
**Effort:** Medium (3-5 days)

Claude Code hooks:

- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `PermissionRequest` - Before permission prompts
- `UserPromptSubmit` - Before processing user input
- `SessionStart` / `SessionEnd` - Session lifecycle
- `Stop` / `SubagentStop` - Before termination
- `PreCompact` - Before context compaction
- `Notification` - Custom notifications

**Current State:** Only React UI hooks exist (`useLSP`, `useSandbox`)

**Implementation Path:**

- [ ] Create `/src/lib/hooks/event-hooks.ts`
- [ ] Add hook configuration in `.claude/hooks/`
- [ ] Implement matcher system for tool-specific hooks
- [ ] Add bash command and prompt-based hook types
- [ ] Integrate with tool execution pipeline

---

### 2. Custom Slash Commands

**Status:** 🔴 Not Started
**Impact:** High
**Effort:** Low (1-2 days)

Claude Code supports:

- `.claude/commands/` for project commands
- `~/.claude/commands/` for personal commands
- Argument templating (`$ARGUMENTS`, `$1`, `$2`)
- File references and frontmatter

**Implementation Path:**

- [ ] Create command loader for `.claude/commands/`
- [ ] Add argument parsing system
- [ ] Integrate with chat input handler
- [ ] Add command discovery and `/help` listing

---

## P1 - Important Gaps

### 3. Subagent Architecture

**Status:** 🟡 Partial
**Impact:** High
**Effort:** Medium (3-5 days)

Claude Code has:

- Built-in subagents: `code-reviewer`, `debugger`, `researcher`
- Spawnable subagents with isolated context
- Background/foreground execution
- Auto-compaction per subagent

**Current State:** Has agents but not spawnable pattern

**Implementation Path:**

- [ ] Refactor `/src/agents/` to subagent pattern
- [ ] Add `Task` tool for spawning subagents
- [ ] Implement context forking for subagents
- [ ] Add background subagent support

---

### 4. Tool Permission Patterns

**Status:** 🟡 Partial
**Impact:** Medium
**Effort:** Medium (2-3 days)

Claude Code supports:

- Pattern matching: `Bash(git add:*)`, `Edit(/src/**)`
- Auto-Accept, Plan Mode, Normal modes
- Tool-specific allow/deny rules

**Current State:** Has security but not pattern-based permissions

**Implementation Path:**

- [ ] Add glob pattern matching for tool permissions
- [ ] Implement permission modes in settings
- [ ] Create permission prompt UI
- [ ] Add per-tool configuration

---

## P2 - Enhancement Gaps

### 5. Plugin System

**Status:** 🔴 Not Started
**Impact:** Medium
**Effort:** High (1-2 weeks)

Claude Code features:

- Install plugins from GitHub
- Plugin marketplace
- Plugin-scoped commands, MCP servers, Skills

**Implementation Path:**

- [ ] Design plugin manifest format
- [ ] Create plugin loader and registry
- [ ] Add plugin installation UI
- [ ] Implement plugin sandboxing

---

### 6. Session Forking

**Status:** 🔴 Not Started
**Impact:** Low
**Effort:** Medium (2-3 days)

Claude Code allows:

- Fork sessions for parallel work
- Named sessions with `/rename`
- `/teleport` between web and terminal

**Implementation Path:**

- [ ] Add session fork API endpoint
- [ ] Implement context duplication
- [ ] Add fork UI in session history

---

## P3 - Nice to Have

### 7. Rewind/Checkpointing

**Status:** 🔴 Not Started
**Impact:** Medium
**Effort:** Low (1-2 days)

- [ ] Track file changes during session
- [ ] Implement `/rewind` command
- [ ] Add checkpoint markers

---

### 8. Output Styles

**Status:** 🔴 Not Started
**Impact:** Low
**Effort:** Low (1 day)

- [ ] Create output style configuration
- [ ] Add built-in styles (concise, verbose, markdown)
- [ ] Implement style switching

---

### 9. Vim Mode

**Status:** 🔴 Not Started
**Impact:** Low
**Effort:** Medium (3-4 days)

- [ ] Integrate vim keybindings in editor
- [ ] Add `/vim` toggle command

---

## Already at Parity ✅

- File operations (read, write, edit, glob, grep)
- Real PTY terminal with xterm.js
- MCP support (5 production servers)
- Git operations and GitHub integration
- LSP support (TypeScript, Python, Go)
- Session management (create, resume, history)
- Memory system with CLAUDE.md
- Background tasks
- Plan mode
- Code review
- Image/screenshot support
- Extended thinking
- Context compaction
- Multi-platform deployment
- Debugging with DAP/CDP
- Real-time collaboration
- Comprehensive security (5-layer)
- 924 tests, 75% coverage

---

## Recommended Roadmap

### Phase 16: Extensibility (Est. 1-2 weeks)

1. Event-driven hook system
2. Custom slash commands
3. Tool permission patterns

### Phase 17: Agent Architecture (Est. 1 week)

4. Subagent pattern refactor
5. Background subagent support

### Phase 18: Power Features (Est. 2 weeks)

6. Plugin system foundation
7. Session forking
8. Rewind/checkpointing

### Phase 19: Polish (Est. 1 week)

9. Output styles
10. Vim mode (optional)
11. MCP scopes

---

## Progress Log

| Date         | Change               | Parity |
| ------------ | -------------------- | ------ |
| Jan 19, 2026 | Initial gap analysis | 85%    |
|              |                      |        |

---

_This document tracks progress toward Claude Code feature parity._
