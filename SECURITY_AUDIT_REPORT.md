# JCIL.AI — Full Security & Code Audit Report

**Date:** 2026-03-25 (Tuesday)
**Timestamp:** Generated at session time ~14:30 UTC
**Auditor:** Claude Code (Opus 4.6)
**Scope:** API routes, security/auth layer, all AI tools, frontend & dependencies
**Method:** Line-by-line source code review across 4 parallel audit passes

---

## Executive Summary

The application has **solid application-layer security** (auth guards, CSRF, rate limiting, encryption) but **critical holes in Supabase RLS policies** that would allow any authenticated user to escalate privileges. Additionally, ~48 of ~90 AI tools add no real value over Claude's native capabilities and represent 12,000+ lines of unnecessary maintenance burden.

### Scoreboard

| Area | Grade | Notes |
|------|-------|-------|
| Security (app layer) | B+ | Auth guards, CSRF, rate limiting all solid |
| Security (database) | D | RLS policies are Swiss cheese |
| API Design | B- | Good patterns, too-large files |
| Tool System | C | 25 essential tools buried under 48 that add nothing |
| Frontend | B- | Good decomposition, redundant deps, a11y gaps |
| Code Quality | B | Strict TypeScript, good patterns, some `any` leaks |
| Testing | C+ | 41% coverage, growing |

---

## 1. Security Findings

### Critical (2)

#### 1.1 Settings Table Writable by Any Authenticated User
- **Location:** Supabase RLS policy on `settings` table
- **Issue:** `FOR ALL USING (true) WITH CHECK (true)` without `TO service_role` clause
- **Impact:** Any authenticated user can modify site settings — maintenance mode, disable signups, change logos, alter platform behavior
- **Fix:** Add `TO service_role` or restrict with `USING (auth.uid() = owner_id)` / admin role check

#### 1.2 Branding Storage Bucket Writable by Any Authenticated User
- **Location:** Supabase storage policy on `branding` bucket
- **Issue:** Same pattern — permissive policy without role restriction
- **Impact:** Any authenticated user can upload, replace, or delete brand assets
- **Fix:** Restrict to admin role only

### High (10)

#### 1.3 Eight Tables Missing `TO service_role` on Permissive RLS Policies
- **Tables affected:**
  - `support_tickets` — any user can read ALL support tickets
  - `user_messages` — any user can read ALL user messages
  - `code_lab_sessions` — any user can read ALL code lab sessions
  - `code_lab_messages` — any user can read ALL code lab messages
  - `code_lab_workspaces` — any user can read ALL workspaces
  - `code_lab_file_changes` — any user can read ALL file changes
  - `code_lab_presence` — any user can read ALL presence data
  - `moderation_logs` — any user can INSERT moderation log entries
- **Pattern:** All follow `FOR ALL USING (true) WITH CHECK (true)` intended for service role but missing the `TO service_role` clause
- **Fix:** One migration to add proper `TO` clauses to all affected policies

#### 1.4 Users Table Allows Arbitrary Row Insertion
- **Location:** Supabase RLS INSERT policy on `users` table
- **Issue:** Any authenticated user can insert rows with arbitrary subscription tiers
- **Impact:** Privilege escalation — a free user could insert themselves as `enterprise` tier
- **Fix:** Restrict INSERT to service role; user creation should go through auth flow only

#### 1.5 Open INSERT Policies on Audit Tables
- **Tables:** `export_logs`, `subscription_history`
- **Issue:** Any authenticated user can insert arbitrary audit log entries
- **Impact:** Log poisoning, false audit trails
- **Fix:** Restrict to service role

#### 1.6 Document Download Tokens Are Unsigned
- **Location:** `app/api/documents/generate/route.ts`
- **Issue:** Download tokens are plain base64-encoded JSON (user ID + file path) — no HMAC signature
- **Impact:** Anyone who understands the format can forge tokens to download other users' files
- **Fix:** Sign tokens with HMAC-SHA256 using a server secret; verify signature on download

### Medium (9)

#### 1.7 Prompt Injection via Document Context
- **Location:** `lib/prompts/systemPrompt.ts` (~line 416)
- **Issue:** Document content injected raw into the system prompt without sanitization
- **Impact:** Uploaded documents could contain instructions that manipulate AI behavior
- **Fix:** Sanitize/escape document content before injection; consider content boundary markers

#### 1.8 Stripe Unknown Status Defaults to Active
- **Location:** Subscription status checking logic
- **Issue:** When an unknown Stripe subscription status is encountered, the code defaults to granting active access
- **Impact:** Edge case Stripe statuses could grant unintended access
- **Fix:** Default to restrictive (inactive) for unknown statuses

#### 1.9 GitHub Token Passed in Tool Arguments
- **Location:** GitHub tool invocation
- **Issue:** GitHub OAuth token passed as a tool argument rather than via secure context
- **Impact:** Token could appear in logs, error messages, or AI conversation history
- **Fix:** Pass token via secure server-side context, not as a tool parameter

#### 1.10 No Zod Validation on Document Generation Endpoint
- **Location:** `app/api/documents/generate/route.ts`
- **Issue:** Request body is not validated with Zod schema
- **Impact:** Malformed requests could cause unexpected behavior
- **Fix:** Add Zod schema validation matching other endpoints

#### 1.11 MCP Tool Name Parsing Breaks with Underscores
- **Location:** MCP tool name parsing logic
- **Issue:** Server IDs containing underscores cause incorrect parsing of `serverId__toolName` format
- **Impact:** MCP tools with underscored server names fail to route correctly
- **Fix:** Use a more robust delimiter or parsing strategy

#### 1.12-1.15 Additional Medium Issues
- Upload pattern duplicated 4x in document generation (DRY violation, increases bug surface)
- Some `any` type leaks in tool implementations
- Error messages occasionally leak internal paths
- Rate limit bypass possible via connection reset timing

---

## 2. API Routes Audit

### Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `app/api/code-lab/chat/route.ts` | 1,680 | 3x over 500-line limit |
| `app/api/documents/generate/route.ts` | 1,234 | Critical security issues |
| `app/api/chat/route.ts` | 690 | Solid, minor extraction needed |
| `app/api/webhooks/stripe/route.ts` | ~300 | Unknown status handling issue |
| `lib/prompts/systemPrompt.ts` | 416 | Prompt injection vector |

### Key Issues

1. **code-lab/chat/route.ts** (1,680 lines) — Duplicates main chat route logic extensively. Should share a common chat engine.
2. **documents/generate/route.ts** (1,234 lines) — Unsigned download tokens (Critical). No Zod validation. Same upload pattern copied 4x within the file.
3. **chat/route.ts** (690 lines) — `tryDataAnalytics` function (142 lines) should be extracted to its own module.
4. **systemPrompt.ts** — Document context injected raw without sanitization.

---

## 3. AI Tools Audit

### TIER 1: KEEP (25 tools) — Real capabilities Claude can't do natively

| Tool | Why Keep |
|------|----------|
| `web-search` | Native Anthropic web search |
| `fetch-url` | URL content extraction via fetch |
| `run-code` | E2B sandbox code execution |
| `browser-visit` | Puppeteer browser automation |
| `extract-pdf` | PDF text extraction |
| `dynamic-tool` | On-the-fly tool creation |
| `youtube-transcript` | YouTube caption scraping |
| `github-tool` | Full GitHub API integration |
| `chart-tool` | QuickChart image generation |
| `document-tool` | PDF/DOCX file creation |
| `audio-transcribe` | Whisper speech-to-text |
| `spreadsheet-tool` | Excel file generation |
| `http-request-tool` | External HTTP API calls |
| `image-transform-tool` | Sharp image processing |
| `pdf-tool` | PDF merge/split/encrypt operations |
| `zip-tool` | ZIP archive creation |
| `presentation-tool` | PowerPoint file generation |
| `spawn-agent-tool` | Parallel sub-agent orchestration |
| `schedule-task-tool` | Future task scheduling |
| `desktop-sandbox-tool` | E2B Desktop GUI sandbox |
| `e2b-chart-tool` | Python matplotlib chart generation |
| `sandbox-files` | E2B sandbox file operations |
| `sandbox-template` | E2B sandbox templates |
| `test-runner` | E2B test execution |
| `calendar-event-tool` | .ics calendar file generation |

### TIER 2: EVALUATE (17 tools) — Nice to have, assess usage

QR code generation, barcode generation, file format conversion, mail merge, email templates, SQL query execution, cryptocurrency data, media processing, EXIF metadata, geospatial calculations, 3D graphics rendering, and similar utilities.

**Recommendation:** Keep if usage data shows adoption; remove if unused after 30 days.

### TIER 3: REMOVE (48 tools) — ~12,000 lines of dead weight

#### Document Formatters (26 tools)
These all follow the same pattern: Claude writes the content, then passes it through a simple markdown/HTML template. Claude can generate identical output without these tools.
- Sermon formatter, resume builder, invoice generator, lesson plan creator, meeting notes formatter, project proposal template, business plan formatter, cover letter writer, recipe formatter, travel itinerary, workout plan, meal plan, budget template, study guide, event planner, newsletter formatter, product description, social media post, blog post formatter, press release, case study, white paper, FAQ generator, job description, performance review, training manual

#### Computation Tools (6 tools)
Claude has this knowledge built in and can compute these natively:
- DNA sequence analyzer, medical calculator, mathematical sequence generator, ray tracer, physics simulator, chemistry balancer

#### "Claude Calling Claude" Tools (2 tools)
Pure overhead — an AI tool that calls the same AI model to do something:
- Error fixer tool, code refactor tool

#### Text Analysis Tools (12 tools)
Claude performs all of these natively with equal or better quality:
- NLP analyzer, text diff tool, text validator, phone number parser, code prettier/formatter, sentiment analyzer, language detector, grammar checker, readability scorer, keyword extractor, summarizer, plagiarism checker (without a corpus)

#### Deduplication Note
Several tools duplicate capabilities: `chart-tool` vs `e2b-chart-tool`, `document-tool` vs document formatters, `http-request-tool` vs `fetch-url`. After removing Tier 3, review Tier 1 for remaining overlaps.

---

## 4. Frontend & Dependencies Audit

### Dependency Issues (42 of 75 flagged)

| Category | Duplicates | Recommendation |
|----------|-----------|----------------|
| PDF libraries | 3 (`pdf-lib`, `pdfjs-dist`, `@react-pdf/renderer`) | Keep `pdf-lib` for generation, `pdfjs-dist` for extraction. Evaluate `@react-pdf/renderer`. |
| Excel libraries | 2 (`exceljs`, `xlsx`) | Pick one. `exceljs` is more actively maintained. |
| Redis clients | 2 (`ioredis`, `@upstash/redis`) | Pick one based on deployment (Upstash for serverless). |
| Markdown parsers | 2 (`marked`, `react-markdown`) | Keep `react-markdown` for components, evaluate if `marked` is still needed. |
| GitHub clients | 2 (`@octokit/rest`, `octokit`) | `octokit` is the unified SDK; remove `@octokit/rest` if not used separately. |
| xterm packages | 4 (`xterm`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`) | Verify if the custom terminal UI uses these. If not, remove all 4. |
| Testing in prod | 1 (`axe-core`) | Move to devDependencies |

### Component Issues

1. **CodeLabEditor** — Claims syntax highlighting for 50+ languages and auto-completion features, but is implemented as a plain `<textarea>`. This is misleading to users.
2. **OAuth Signup** — Google/GitHub OAuth buttons don't check the `agreedToTerms` checkbox, bypassing terms of service agreement.
3. **Native Dialogs** — Uses browser `alert()` and `confirm()` instead of the application's toast/modal system.
4. **Keyboard Accessibility** — Clickable `<div>` elements without `onKeyDown`/`onKeyPress` handlers; password toggle buttons unreachable by keyboard navigation.
5. **105 components** exceed the 400-line threshold set in CLAUDE.md.

---

## 5. Prioritized Action Plan

### P0 — Before Launch (Security Critical)

1. **Fix RLS policies** — Write one Supabase migration that:
   - Adds `TO service_role` to all 8 affected table policies
   - Restricts `settings` table to admin role
   - Restricts `branding` bucket to admin role
   - Restricts `users` INSERT to service role
   - Restricts audit table INSERTs to service role
   - **Estimated impact:** Fixes 10+ critical/high issues in one migration

2. **Sign download tokens** — Replace base64 tokens with HMAC-SHA256 signed tokens in `documents/generate/route.ts`

3. **Add Zod validation** to document generation endpoint

4. **Fix Stripe default** — Unknown subscription statuses should default to inactive/restricted

### P1 — Before Launch (Quality)

5. **Remove 48 Tier 3 tools** — Delete files, remove from registry, update tool count in docs
6. **Sanitize document context** in system prompt injection
7. **Fix OAuth terms bypass** — Require terms agreement before OAuth signup completes
8. **Move `axe-core` to devDependencies**

### P2 — Near-Term (Technical Debt)

9. **Deduplicate dependencies** — Pick one library per category
10. **Decompose large routes** — code-lab/chat/route.ts (1,680 lines), documents/generate/route.ts (1,234 lines)
11. **Fix CodeLabEditor** — Either add real syntax highlighting or remove the claims
12. **Fix keyboard accessibility** — Add handlers to clickable divs, make password toggles focusable
13. **Replace native dialogs** — Use toast/modal system consistently

### P3 — Ongoing

14. **Decompose 105 oversized components**
15. **Increase test coverage** past 41%
16. **Remove `any` type leaks**
17. **Audit Tier 2 tools** based on usage data after 30 days

---

## Appendix: RLS Policy Fix Template

```sql
-- Example migration to fix critical RLS issues
-- Run as a single migration in Supabase

-- Fix settings table: restrict to service role / admin
DROP POLICY IF EXISTS "settings_policy" ON settings;
CREATE POLICY "settings_admin_only" ON settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix support_tickets: service role full access
DROP POLICY IF EXISTS "support_tickets_service" ON support_tickets;
CREATE POLICY "support_tickets_service_role" ON support_tickets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add user-specific read policy for their own tickets
CREATE POLICY "support_tickets_user_read" ON support_tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Repeat pattern for: user_messages, code_lab_sessions,
-- code_lab_messages, code_lab_workspaces, code_lab_file_changes,
-- code_lab_presence, moderation_logs, export_logs, subscription_history

-- Fix users table INSERT
DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert_service_only" ON users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix branding bucket
-- (Run via Supabase dashboard or storage API)
```

---

*Report generated 2026-03-25 by Claude Code audit session.*
