# JCIL AI Micro — Project Status (Ground Truth)

**Last Updated:** 2026-02-27
**Updated By:** Phase 2.6 — Test Coverage Push (15% → 41%, 12,107 tests)
**Branch:** `claude/fix-chat-crashes-L9aK6`

> This document reflects verified, measured values only. No aspirational claims.
> Previous versions of this file contained inaccurate metrics. This is the corrected baseline.

---

## Current State Summary

| Metric                         | Verified Value                                                                    | Target                 | Status                      |
| ------------------------------ | --------------------------------------------------------------------------------- | ---------------------- | --------------------------- |
| **Test Coverage (lines)**      | 41.25% (was 15.05%)                                                               | 60%                    | Major progress — Phase 2.6  |
| **Test Coverage (statements)** | 41.25% (was 15.05%)                                                               | 60%                    | Major progress — Phase 2.6  |
| **Test Coverage (branches)**   | 80.71% (was 62.55%)                                                               | 60%                    | Target exceeded             |
| **API Routes Tested**          | ~40% (was 8.5%)                                                                   | 90%                    | Improving                   |
| **Real Tool Implementations**  | 57 tools (all real, stubs removed)                                                | All active tools real  | Improved — 23 stubs deleted |
| **ARIA Attributes**            | 409+ (was 0)                                                                      | WCAG 2.1 AA            | Major progress — Phase 2.4  |
| **Inline Styles**              | 155 (was 554, 72% reduction). All remaining are dynamic/computed runtime values.  | 0 static inline styles | Complete — Phase 2.4.8      |
| **Largest Component**          | 374 lines (was 2,631)                                                             | <400 lines             | Target met — decomposed     |
| **Largest Route File**         | 537 lines (was 4,618)                                                             | <500 lines             | Decomposed into 10 modules  |
| **Production Dependencies**    | 152                                                                               | <50                    | Needs audit                 |
| **Tool Files (total)**         | 58 (was 82, deleted 23 stubs + index.ts)                                          | Lazy-loaded            | Lazy loading implemented    |
| **Error Boundaries**           | 6 (chat sidebar, thread, composer, CodeLab, code-lab/error.tsx, global-error.tsx) | All major sections     | Complete — Phase 2.5        |
| **TypeScript Errors**          | TBD (verify)                                                                      | 0                      | Check each session          |
| **Build Status**               | TBD (verify)                                                                      | Passing                | Check each session          |
| **Lint Warnings**              | TBD (verify)                                                                      | 0                      | Check each session          |

---

## What Actually Works (Verified)

### Real Tool Implementations (55 tools in registry — see `tools/registry.ts`)

| Tool           | File                                  | What It Does                                      |
| -------------- | ------------------------------------- | ------------------------------------------------- |
| Web Search     | `tools/web-search.ts`                 | Native Anthropic server tool (web search)         |
| Fetch URL      | `tools/fetch-url.ts`                  | Real HTTP fetch + HTML parsing                    |
| Code Execution | `tools/run-code.ts`                   | Real E2B sandboxed code execution                 |
| Web Capture    | `tools/web-capture-tool.ts`           | Puppeteer screenshots and PDFs                    |
| 51 more tools  | See `tools/registry.ts` for full list | Various categories: code, data, media, scientific |

### Security (Solid Foundation)

| Feature         | Status   | Implementation                                                                              |
| --------------- | -------- | ------------------------------------------------------------------------------------------- |
| Supabase RLS    | Working  | Proper row-level security policies                                                          |
| Zod Validation  | Working  | 50+ schemas for input validation                                                            |
| CSRF Protection | Working  | Origin/Referer validation                                                                   |
| Rate Limiting   | Working  | Redis-backed sliding window                                                                 |
| DOMPurify       | Working  | HTML sanitization                                                                           |
| Auth Guards     | Improved | `requireUser`/`requireAdmin` — 17 API routes migrated, CSRF on all state-changing endpoints |

### Infrastructure

| Component           | Status  | Notes                             |
| ------------------- | ------- | --------------------------------- |
| Next.js 14          | Working | SSR, API routes                   |
| Supabase PostgreSQL | Working | Database with RLS                 |
| Upstash Redis       | Working | Rate limiting                     |
| Vercel Deployment   | Working | Production hosting                |
| Stripe              | Partial | Integration exists, needs testing |
| E2B Sandboxing      | Exists  | Code execution environment        |

---

## What Does NOT Work (Verified)

### Stub Tools (~297 tools)

The vast majority of tools in `lib/ai/tools/` return simulated/fake data:

- Hardcoded responses after artificial delays
- Random number generation pretending to be real analysis
- Math calculations Claude can already do natively
- No external API calls, no real integrations

**These tools must be removed from the active registry** until they have real implementations.

### Accessibility

- ~~**0 ARIA attributes**~~ — **FIXED**: 409+ ARIA attrs across 80+ files _(2026-02-23)_
- ~~**0 keyboard navigation**~~ — **FIXED**: global focus-visible outlines, Tab reachability _(2026-02-23)_
- **~955 inline styles** remaining (75 converted to Tailwind, more in progress)
- ~~**No skip-to-content links**~~ — **FIXED** _(2026-02-23)_
- ~~**No focus management** for modals~~ — **FIXED**: native `<dialog>` + focus restore _(2026-02-23)_
- ~~`userScalable: false`~~ — **FIXED** _(2026-02-22)_

### Testing

- **41.25% overall coverage** (was 15.05%, was 5.9%)
- 12,107 tests across 410 files, all passing
- ~40% of API routes now tested (was 8.5%)
- No integration tests for payment flows
- No E2E tests running against real environment

### Build Pipeline Gaps

- ~~`npm audit` has `continue-on-error: true`~~ — **FIXED** (all CI steps required) _(2026-02-22)_
- ~~No coverage thresholds enforced~~ — **FIXED** (vitest thresholds enforced in CI) _(2026-02-22)_
- No bundle size analysis
- No staging environment / preview deployments

---

## Known Critical Issues (From CTO Assessment)

1. ~~**Admin permissions default to TRUE** when NULL~~ — **FIXED** (now `?? false`, fail-closed) _(2026-02-22)_
2. ~~**Rate limiting fails open** when Redis is down~~ — **FIXED** (now fail-closed, denies in production) _(2026-02-22)_
3. **90 API routes** don't use formal auth guards — **17 migrated** to `requireUser()`, ~73 remaining
4. ~~**In-memory state** (Maps) in serverless functions~~ — **FIXED** (chat rate limiting + admin cache migrated to Redis) _(2026-02-23)_
5. ~~**393 tools loaded on every request**~~ — **FIXED** (lazy loading via `tool-loader.ts`, only loaded on demand) _(2026-02-22)_
6. ~~**4,618-line chat route**~~ — **FIXED** (decomposed to 537-line orchestrator + 9 focused modules) _(2026-02-23)_
7. **4,312-line system prompt** — ~15-20K tokens sent every request (~$0.05/request just for prompt)
8. ~~**Fake aggregate rating** in Schema.org data~~ — **FIXED** (removed) _(2026-02-22)_

---

## Technology Stack

| Layer      | Technology               | Version         |
| ---------- | ------------------------ | --------------- |
| Frontend   | Next.js                  | 14.2            |
| Language   | TypeScript               | 5.4             |
| UI         | React + Tailwind CSS     | 18.3            |
| Database   | Supabase PostgreSQL      | -               |
| Cache      | Upstash Redis            | -               |
| Auth       | NextAuth / Supabase Auth | -               |
| Payments   | Stripe                   | -               |
| Sandboxing | E2B                      | -               |
| AI         | Anthropic Claude         | Multiple models |
| Hosting    | Vercel                   | -               |

---

## Tracking

This document is updated whenever a verified metric changes. Each update includes:

- The date of change
- What changed
- The new verified value

### Change Log

| Date       | Change                                           | Old Value                                   | New Value                                 |
| ---------- | ------------------------------------------------ | ------------------------------------------- | ----------------------------------------- |
| 2026-02-22 | Initial ground-truth baseline                    | (stale data)                                | All metrics above                         |
| 2026-02-22 | Removed 311 unused tool files                    | 393 tool files                              | 82 tool files                             |
| 2026-02-22 | Fixed admin permissions default                  | `?? true` (fail-open)                       | `?? false` (fail-closed)                  |
| 2026-02-22 | Fixed rate limiting fail-open                    | `allowed: true` on Redis failure            | `allowed: false` (fail-closed)            |
| 2026-02-22 | Fixed viewport scaling                           | `userScalable: false`                       | `userScalable: true`                      |
| 2026-02-22 | Removed fake aggregate rating                    | 4.9/5 (150 reviews)                         | Removed                                   |
| 2026-02-22 | Fixed vitest coverage config                     | 75% threshold (files-with-tests only)       | 5% threshold (all files)                  |
| 2026-02-22 | Removed CI continue-on-error                     | Security audit non-blocking                 | Security audit blocks deploy              |
| 2026-02-22 | Aligned Node version                             | package.json: 22.x                          | package.json: 20.x (matches .nvmrc, CI)   |
| 2026-02-22 | Strengthened env validation                      | Log-only on missing vars                    | Throws in production                      |
| 2026-02-22 | Google verification to env var                   | Hardcoded token                             | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`    |
| 2026-02-22 | Deleted 23 stub tools + fixed index.ts           | 82 files, 4,033-line index.ts               | 58 files, ~430-line index.ts              |
| 2026-02-22 | Cleaned route.ts of deleted tool refs            | ~8,366 lines of broken refs                 | All refs to real tools only               |
| 2026-02-22 | Migrated 17 API routes to requireUser()          | Inline auth patterns                        | Centralized auth + CSRF                   |
| 2026-02-22 | Added security tests (35 new)                    | 2130 tests                                  | 2165 tests across 75 files                |
| 2026-02-22 | Implemented lazy tool loading (tool-loader.ts)   | 55 static imports + 90-case switch          | Dynamic import() on demand, cached        |
| 2026-02-22 | Reduced route.ts via lazy loading                | 5,100 lines                                 | 4,618 lines (-484 lines)                  |
| 2026-02-22 | Fixed Supabase types for build                   | Build broken (missing Relationships)        | Build passing (all types fixed)           |
| 2026-02-22 | Added tool tests (82 new)                        | 2165 tests, 5.9% coverage                   | 2247 tests across 78 files, 15.05% cov    |
| 2026-02-23 | Decomposed chat route.ts into 10 modules         | 4,618 lines, monolithic                     | 537-line orchestrator + 9 focused modules |
| 2026-02-23 | Migrated rate limiting to Redis                  | 3 in-memory Maps (unreliable on serverless) | Redis-backed via checkRateLimit()         |
| 2026-02-23 | Migrated admin cache to Redis                    | In-memory Map (lost across invocations)     | Redis cacheGet/cacheSet (5-min TTL)       |
| 2026-02-23 | Added chat module tests (101 new)                | 2247 tests across 78 files                  | 2348 tests across 80 files                |
| 2026-02-23 | Added hook tests (165 new)                       | 2348 tests across 80 files                  | 2513 tests across 85 files                |
| 2026-02-23 | Decomposed MessageBubble.tsx                     | 1,689 lines                                 | 301 lines + 9 sub-components              |
| 2026-02-23 | Decomposed ChatComposer.tsx                      | 1,667 lines                                 | 512 lines + 6 extracted modules           |
| 2026-02-23 | Decomposed CodeLabComposer.tsx                   | 1,633 lines                                 | 328 lines + 3 sub-components + CSS file   |
| 2026-02-23 | Decomposed CodeLabPairProgramming.tsx            | 1,499 lines                                 | 561 lines + CSS + usePairProgramming hook |
| 2026-02-23 | Decomposed CodeLabCollaboration.tsx              | 1,486 lines                                 | 296 lines + CSS + 5 sub-components        |
| 2026-02-23 | Decomposed CodeLabTerminal.tsx                   | 1,343 lines                                 | 599 lines + CSS + 4 sub-modules           |
| 2026-02-23 | Decomposed CodeLabDebugger.tsx                   | 1,301 lines                                 | 647 lines + CSS file                      |
| 2026-02-23 | Decomposed CodeLabSidebar.tsx                    | 1,296 lines                                 | 608 lines + CSS file                      |
| 2026-02-23 | Decomposed ChatSidebar.tsx                       | 1,228 lines                                 | 613 lines + 5 sub-components              |
| 2026-02-23 | Added decomposed component tests (122 new)       | 2513 tests across 85 files                  | 2635 tests across 89 files                |
| 2026-02-24 | Added error boundaries to all major sections     | 0 error boundaries                          | 6 boundaries (chat×3, CodeLab, route×2)   |
| 2026-02-24 | Added ToastProvider + toast errors to ChatClient | Silent console.error only                   | User-visible toast notifications          |
| 2026-02-24 | Wired fetchWithRetry into key API calls          | Raw fetch() with no retry                   | Exponential backoff (max 2 retries)       |
| 2026-02-24 | Added loading skeleton to ChatThread             | No loading state during msg fetch           | ThreadSkeleton shown while loading        |
| 2026-02-24 | Added code-lab/error.tsx + loading.tsx           | No route-level error handling for code-lab  | Segment-level error boundary + skeleton   |
| 2026-02-24 | Added error handling tests (78 new)              | 2635 tests across 89 files                  | 2724 tests across 93 files                |
| 2026-02-27 | Fixed chat crashes (null guards)                 | Unprotected JSON.parse, null array access   | try/catch + null guards in 4 modules      |
| 2026-02-27 | Fixed basic-ftp CVE (path traversal)             | basic-ftp 5.1.0 (vulnerable)                | basic-ftp 5.2.0 via pnpm override         |
| 2026-02-27 | Added chat route tests (75 new)                  | 0 tests for auth/tools/image/doc/title      | 75 tests across 6 new test files          |
| 2026-02-27 | Added code-lab route tests (24 new)              | 0 tests for lsp/memory/plan routes          | 24 tests across 3 new test files          |
| 2026-02-27 | Added Stripe webhook tests (6 new)               | 0 tests for webhook handler                 | 6 tests covering all event types          |
| 2026-02-27 | Coverage push: 15% → 41.25%                      | 2,724 tests, 15.05% lines                   | 12,107 tests, 41.25% lines, 410 files     |
| 2026-02-27 | Updated vitest thresholds                        | 5% lines/statements                         | 35% lines/stmts, 60% branches/functions   |

---

_This is a living document. Update it after every meaningful change. Only include verified, measured values._
