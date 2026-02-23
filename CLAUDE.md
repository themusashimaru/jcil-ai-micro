# JCIL AI Micro — Claude Code Session Instructions

**Last Updated:** 2026-02-22
**Authoritative Assessment:** `APP_ASSESSMENT_AND_RECOMMENDATIONS.md`
**Task Tracker:** `TASK_TRACKER.md`
**CTO Report:** `CTO_ASSESSMENT_REPORT.md`

---

## Mission Statement

JCIL AI Micro is an AI-powered educational platform. Our mission is to deliver a **production-grade, enterprise-ready product** — not a demo. Every feature must work. Every claim in documentation must be verifiable. We value **accuracy over speed** and **depth over breadth**.

**Core Principle:** It is better to have 10 tools that work flawlessly than 300 tools that are stubs.

---

## Session Protocol

### Starting a New Session

1. **Read this file first** — it is the source of truth for how sessions operate.
2. **Read `TASK_TRACKER.md`** — find where we left off. Resume the next unchecked task.
3. **Read `PROJECT_STATUS.md`** — understand current ground-truth state.
4. **Check git state** — `git status`, `git log --oneline -5`, confirm branch.
5. **Do NOT trust legacy docs** — Many `.md` files in `/docs` and root contain outdated/false claims from previous sessions. Only trust documents dated `2026-02-22` or later.

### During a Session

- **Mark tasks complete in `TASK_TRACKER.md`** as you finish them. Add the date.
- **Update `PROJECT_STATUS.md`** if you change any metric (test count, coverage, etc.).
- **Commit frequently** — small, focused commits. Never batch large changes.
- **Triple-check before pushing:**
  1. `npx tsc --noEmit` — zero TypeScript errors
  2. `npm run lint` — zero lint warnings
  3. `npm run build` — build succeeds
  4. `npm test` — tests pass
- **Never push a broken build.** If the build fails, fix it before moving to the next task.

### Ending a Session

1. Update `TASK_TRACKER.md` with what was completed and what's next.
2. Update `PROJECT_STATUS.md` with any changed metrics.
3. Commit and push all documentation changes.
4. The next session should be able to pick up exactly where you left off.

---

## Standards & Rules

### Code Quality

- **No stubs.** If a tool or feature can't be implemented for real, don't include it. Remove it from the registry.
- **No fake data.** No hardcoded responses, no simulated delays, no random generation pretending to be real output.
- **No aspirational claims.** Documentation must describe what IS, not what we wish it were.
- **Component size limit:** No component file should exceed 400 lines. Decompose.
- **File size limit:** No API route file should exceed 500 lines. Decompose.

### Build Discipline

- Every commit must pass: TypeScript, ESLint, build, and tests.
- Every push to preview must be verified working.
- If a build fails, it is the **top priority** to fix before any other work.
- Never use `--no-verify`, `continue-on-error: true`, or skip CI gates.

### Accuracy Over Speed

- Read code before modifying it.
- Verify changes work before marking tasks complete.
- If unsure about a change's impact, test it first.
- Better to complete 2 tasks correctly than 10 tasks with regressions.

---

## Architecture Overview (Ground Truth — Feb 22, 2026)

### What Actually Works

| Component | Status | Notes |
|---|---|---|
| Google Search tool | Real | `lib/tools/google-search.ts` |
| Web Scraping tool | Real | `lib/tools/web-scraping.ts` |
| Code Execution tool | Real | `lib/tools/code-execution.ts` |
| Supabase RLS | Real | Properly configured |
| Zod input validation | Real | 50+ schemas |
| Rate limiting (Redis) | Real | `src/lib/security/rate-limit.ts` |
| CSRF protection | Real | Implemented |
| NextAuth | Real | Working auth flow |
| Stripe integration | Partial | Needs testing |

### What Does NOT Work (Stubs)

~297 of ~300 tools in `lib/ai/tools/` and `lib/tools/` return fake/simulated data. These must be removed from the active registry or replaced with real implementations.

### Key Metrics (Verified Feb 22, 2026)

| Metric | Actual Value |
|---|---|
| Test coverage | 5.9% |
| ARIA attributes | 0 |
| Inline styles | 554 |
| Real tools (of 300+) | 3 |
| Largest component | 2,631 lines (CodeLab.tsx) |
| Production dependencies | 152 |
| Tools loaded per request | ~393 |

---

## File Structure Quick Reference

```
Key source files:
  app/api/chat/route.ts          — Main chat route (5,840 lines — needs decomposition)
  lib/ai/tools.ts                — Tool registry (~393 tools loaded per request)
  lib/ai/tools/index.ts          — Tool barrel export (4,033 lines)
  components/code-lab.tsx         — CodeLab component (2,631 lines — needs decomposition)
  components/tool-result.tsx      — Tool result renderer (1,300+ lines)
  lib/prompts/systemPrompt.ts    — System prompt (4,312 lines)

Key documentation (trust these):
  CLAUDE.md                       — This file (session instructions)
  TASK_TRACKER.md                 — Master task list
  PROJECT_STATUS.md               — Ground-truth metrics
  APP_ASSESSMENT_AND_RECOMMENDATIONS.md — Full assessment report
  CTO_ASSESSMENT_REPORT.md        — CTO-level review

Legacy documentation (DO NOT trust without verification):
  docs/*.md                       — Many contain outdated claims
  ROADMAP_TO_100.md              — Outdated scoring system
  AUDIT_REPORT_VS_CLAUDE_CODE.md — Outdated
  CLAUDE_CODE_PARITY.md          — Contains unverified "100% parity" claims
```

---

## Commit Convention

```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, security, perf, chore
Scopes: tools, chat, codelab, auth, db, ci, ui, a11y
```

Examples:
- `fix(tools): remove stub tools from active registry`
- `refactor(chat): decompose route.ts into modules`
- `test(auth): add integration tests for login flow`
- `security(auth): encrypt API tokens at rest`

---

## Contact

- **Repository:** https://github.com/themusashimaru/jcil-ai-micro
- **User Expectations:** "Comprehensive work valuing accuracy over speed. Be the methodical senior software engineer that I need."
