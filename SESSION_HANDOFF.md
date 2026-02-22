# SESSION HANDOFF DOCUMENT

**Purpose:** Ensure seamless context transfer between Claude Code sessions.
**Last Updated:** 2026-02-22
**Current Phase:** Phase 1 — Foundation

---

## Quick Start for New Sessions

### Step 1: Read Core Documents (In Order)

```
1. CLAUDE.md              — Mission, standards, session protocol
2. TASK_TRACKER.md        — Find where we left off, resume next unchecked task
3. PROJECT_STATUS.md      — Current ground-truth metrics
```

### Step 2: Check Git State

```bash
git status
git log --oneline -5
git branch -a
```

### Step 3: Verify Build Health

```bash
npx tsc --noEmit        # Zero TypeScript errors
npm run lint             # Zero lint warnings
npm run build            # Build succeeds
npm test                 # Tests pass
```

If ANY of these fail, **fix them before doing anything else.**

### Step 4: Find Next Task

Open `TASK_TRACKER.md`. Find the first unchecked `[ ]` item. That's your starting point.

---

## Project Overview

### What Is JCIL AI Micro?

An AI-powered educational platform built on Next.js 14 + Supabase + Anthropic Claude. Features a chat interface, code lab (browser-based coding environment), document generation, and research agents.

### Ground-Truth State (Feb 22, 2026)

| Metric | Value |
|---|---|
| Real tool implementations | 3 of ~300 |
| Test coverage | 5.9% |
| ARIA attributes | 0 |
| Largest component file | 2,631 lines |
| Largest route file | 5,840 lines |
| Production dependencies | 152 |

### What We're Building Toward

A production-grade platform where:
- Every tool that's listed actually works (no stubs)
- Test coverage is 60%+
- Components are maintainable (<400 lines)
- Accessibility meets WCAG 2.1 AA
- CI gates prevent broken deploys
- Security is enterprise-grade

---

## Critical Context for All Sessions

### The Stub Problem

~95% of the platform's 300+ tools are stubs that return fake data. Previous documentation claimed these were "wired" or "functional." They are not. The #1 priority is removing stubs from the active registry and only presenting tools that genuinely work.

### The Documentation Trust Problem

Many `.md` files in the repository contain claims that were not verified. Examples:
- "1,835 tests passing" → Actual: far fewer (5.9% coverage)
- "75% coverage threshold" → Actual: not enforced, 5.9% actual
- "100% Claude Code parity" → Actual: many features are stubs/facades
- "WCAG 2.1 AA compliance" → Actual: 0 ARIA attributes

**Only trust documents dated 2026-02-22 or later.** These have been verified against the actual codebase.

### The Build Discipline Rule

**Never push a broken build.** Before every push:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — 0 warnings
3. `npm run build` — passes
4. `npm test` — passes

If any step fails, fix it before pushing. If it can't be fixed quickly, revert and investigate.

---

## Session Protocol

### During Work

1. Pick the next unchecked task from `TASK_TRACKER.md`
2. Do the work
3. Check `[x]` the task with date when done
4. Commit with descriptive message
5. Verify build health
6. Repeat

### Before Ending

1. Update `TASK_TRACKER.md` — check off completed tasks, note what's next
2. Update `PROJECT_STATUS.md` — if any metrics changed
3. Update this file's "Last Session" section below
4. Commit and push all changes

---

## Last Session Summary

### Session: 2026-02-22 — Assessment + Phase 1 Execution (18/150 tasks)

**Branch:** `claude/app-assessment-recommendations-vsx0y`

**Completed — Assessment & Documentation:**
- 7-dimension codebase audit (tools, tests, UX, build, security, database, competitive)
- Competitor research (Manus.ai, ChatGPT/Codex, OpenClaw, Cursor, Windsurf, Replit)
- Created `APP_ASSESSMENT_AND_RECOMMENDATIONS.md`, `CTO_ASSESSMENT_REPORT.md`
- Created `CLAUDE.md` (session instructions), `TASK_TRACKER.md` (150 tasks)
- Rewrote `PROJECT_STATUS.md` (ground-truth), `SESSION_HANDOFF.md`, `README.md`

**Completed — Phase 1 Execution (18 tasks):**
- **1.1.1-1.1.2**: Tool inventory + removed 311 unused files (226,755 lines deleted, 393→82 files)
- **1.3.1-1.3.2**: Vitest config — honest coverage with `all: true`, 5% baseline thresholds
- **1.4.1-1.4.6**: CI safety gates — removed continue-on-error, verified all gates
- **1.5.1**: Admin permissions default to FALSE (was TRUE — fail-open)
- **1.5.2**: Rate limiting fails closed in production (was open)
- **1.5.6**: Viewport allows user scaling (was blocked — WCAG fix)
- **1.5.7**: Removed fake aggregateRating (Google penalty risk)
- **1.5.8**: Auth guard audit complete (46 inline auth routes mapped)
- **1.6.1-1.6.5**: Env validation throws in production, Node version aligned, Google token to env var

**Auth Guard Audit Results (for next session):**
- 26 routes: `requireAdmin()` ✓
- 13 routes: `requireUser()` ✓
- 46 routes: Inline auth (need migration to formal guards)
- 44 routes: Public/intentional (webhooks, cron, auth flow)
- 45 routes use SERVICE_ROLE_KEY (30 need review)

**Key Findings:**
- 95% of tools were stubs — 311 unused files removed, ~16 stub exports remain in index.ts
- 5.9% test coverage
- 0 ARIA attributes
- Security foundation is solid (RLS, Zod, CSRF) but has critical gaps (admin fail-open, rate limit fail-open)
- Largest component: 2,631 lines; largest route: 5,840 lines

**Next Session Should:**
1. **1.1.5**: Remove ~16 stub tool exports from `index.ts` (agriculture, geology, etc.)
2. **1.1.3**: Create `tools/registry.ts` manifest with status per tool
3. **1.5.3-1.5.5**: Add CSP headers, Permissions-Policy, encrypt API tokens at rest
4. **1.5.8**: Migrate 46 inline-auth routes to `requireUser()`/`requireAdmin()`
5. **1.3.3-1.3.8**: Write tests for real tools, auth, rate limiting

---

## Key File References

| File | Purpose | Trust Level |
|---|---|---|
| `CLAUDE.md` | Session instructions, mission, standards | Trusted (Feb 22, 2026) |
| `TASK_TRACKER.md` | Master task list (150 items) | Trusted (Feb 22, 2026) |
| `PROJECT_STATUS.md` | Ground-truth metrics | Trusted (Feb 22, 2026) |
| `APP_ASSESSMENT_AND_RECOMMENDATIONS.md` | Full assessment report | Trusted (Feb 22, 2026) |
| `CTO_ASSESSMENT_REPORT.md` | CTO-level technical review | Trusted (Feb 22, 2026) |
| `app/api/chat/route.ts` | Main chat route (5,840 lines) | Needs decomposition |
| `lib/ai/tools.ts` | Tool registry | Needs stub removal |
| `lib/ai/tools/index.ts` | Tool barrel export (4,033 lines) | Needs refactor |
| `components/code-lab.tsx` | CodeLab component (2,631 lines) | Needs decomposition |

---

## User Expectations

> "Comprehensive work valuing accuracy over speed."
> "Be the methodical senior software engineer that I need."
> "Triple check TypeScript, lint errors before pushing."
> "Never push a broken build."
> "We are going to complete each and every one of them."

---

_Update this document at the end of every session._
