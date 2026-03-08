# JCIL AI Micro — Chat System Pre-Launch Audit

**Date:** 2026-03-07
**Auditor:** Third-Party Security & Reliability Audit
**Scope:** Complete chat system (main chat + code-lab chat), all supporting modules
**Verdict:** NOT READY for Monday launch without addressing BLOCKERS below

---

## EXECUTIVE SUMMARY

I audited every layer of the chat system: authentication, rate limiting, validation, streaming/encoding, tool execution, system prompt, UI components, code-lab chat, and the build pipeline. The architecture is **solid** — the decomposition work, auth migration, and overall code quality are genuinely impressive for a project of this scope. But there are issues that **will** embarrass you in front of real users if not fixed.

### The Good News

- UTF-8 encoding is handled correctly everywhere (TextEncoder, TextDecoder with `stream: true`, proper charset headers)
- No `dangerouslySetInnerHTML` in chat components — React's safe rendering is used throughout
- Error boundaries cover all major sections (messages individually, sidebar, thread, CodeLab)
- Auth guards are comprehensive (46 routes, 100% coverage, built-in CSRF)
- Loading states and skeletons are well-implemented
- Abort controllers properly clean up on unmount
- The Zod validation layer is genuinely well-designed (strips unknown keys, no ReDoS in regexes)
- Accessibility is above average (ARIA labels, roles, aria-live regions)

### The Bad News

There are **3 launch blockers**, **12 high-severity issues**, and **25+ medium issues** that need attention.

---

## LAUNCH BLOCKERS (Fix before Monday or don't launch)

### BLOCKER 1: Build Is Broken

**File:** `src/lib/stripe/client.ts:20`
**Error:** `Type '"2026-01-28.clover"' is not assignable to type '"2026-02-25.clover"'`

The Stripe SDK was updated but the API version string was not updated to match. **The app literally cannot build right now.** This must be fixed before anything else.

**Fix:** Change line 20 to `apiVersion: '2026-02-25.clover'`

### BLOCKER 2: Redis Runtime Errors Fail OPEN (Rate Limiting Disabled Under Stress)

**File:** `src/lib/security/rate-limit.ts:153-157`

When Redis has a transient error (network blip, timeout, OOM), the system silently falls back to an **in-memory counter that starts from zero** on every serverless invocation. In Vercel's serverless model, this means:

- Every cold start = fresh counter = zero usage
- An attacker who can trigger Redis errors bypasses ALL rate limits
- During any Redis outage, rate limiting is effectively disabled

This is especially dangerous for an AI platform where every unthrottled request costs real money (Claude API tokens).

**Fix:** In the catch block at line 153, fail closed in production (return `allowed: false`) instead of falling back to per-process in-memory counters.

### BLOCKER 3: Code-Lab Chat Has NO Input Validation

**File:** `app/api/code-lab/chat/route.ts:109`

The code-lab chat endpoint accepts `sessionId`, `modelId`, `content`, `repo`, and `attachments` from the request body with **zero Zod validation**. Compare this with the main chat route which has comprehensive schema validation. This means:

- `sessionId` can be any type (not validated as UUID) — used directly in DB queries
- `modelId` is passed directly to Anthropic API — user could attempt to route to arbitrary models
- `content` has no type guard — non-string values flow through downstream
- `repo` object has no shape validation
- Image attachments have no size limits

**Fix:** Add a Zod schema for the code-lab chat request body matching the rigor of `chatRequestSchema`.

---

## HIGH SEVERITY ISSUES (Fix before launch if possible)

### H1: Tool Results Never Sanitized for Prompt Injection

**Files:** `chat-tools.ts:458-486`, `safety.ts:83`

A `sanitizeOutput()` function exists but is **never called**. Results from MCP servers, Composio tools, `fetch_url`, and `browser_visit` flow directly into the model context unsanitized. A malicious website or MCP server could inject instructions that alter Claude's behavior.

**Fix:** Call `sanitizeOutput()` on all tool results before returning them to the model.

### H2: Memory/Learning Context = Persistent Prompt Injection Vector

**Files:** `system-prompt.ts:372-385`, `learning/index.ts:314`

User memory and learning preferences are injected into the system prompt with zero sanitization and no boundary markers. A user can craft messages that cause the memory extractor to store adversarial instructions as "facts," which then poison every future conversation.

**Fix:** Apply `sanitizeContextInjection()` to memory and learning contexts, and wrap them in clear structural boundaries (like custom instructions already have).

### H3: SSRF in Image Edit Route

**File:** `image-routes.ts:349-353`

`previousImageUrl` extracted from conversation history is fetched with no domain validation. A crafted assistant message (via prompt injection) could cause the server to fetch internal URLs.

**Fix:** Validate that `previousImageUrl` matches expected domains (Supabase storage, FLUX CDN) before fetching.

### H4: URL Safety Functions Are No-Ops

**File:** `safety.ts`

`isUrlSafe()` and `isDomainTrusted()` unconditionally return `true`. Tools like `fetch_url` and `browser_visit` can target internal services, `file://` URIs, and cloud metadata endpoints (`169.254.169.254`).

**Fix:** Implement actual URL validation with SSRF protection.

### H5: No Execution Timeouts on Tool Calls

**File:** `chat-tools.ts:455-486`

Tool execution has no `Promise.race` timeout wrapper. A hung tool blocks the request indefinitely, consuming a serverless function slot.

**Fix:** Wrap all tool execution in `Promise.race` with a 30-second timeout (120s for known long-running tools like code execution).

### H6: Cost Control Is Completely Disabled

**File:** `chat-tools.ts` + `safety.ts`

`canExecuteTool()` always returns `{ allowed: true }`. `recordToolCost()` does nothing. `maxCostPerSession` is `Infinity`. The elaborate 178-entry `TOOL_COSTS` map is dead code. A runaway session can invoke unlimited expensive tools.

**Fix:** Either implement real cost tracking or remove the dead code (it creates a false sense of security).

### H7: No Token Tracking for Non-Claude Providers

**File:** `streaming.ts:133-324`

The non-Claude provider path has zero token tracking. Users on OpenAI, xAI, DeepSeek, or Google providers consume tokens that are never recorded against their usage limits. This is a billing/quota enforcement gap.

**Fix:** Add `onUsage` callback and `incrementTokenUsage` calls to the non-Claude streaming path.

### H8: No Timeout Safety Net for Non-Claude Streams

**File:** `streaming.ts:154-287`

The Claude path has a 30-second `SLOT_TIMEOUT_MS` safety timeout. The non-Claude path has no equivalent. If the upstream provider hangs, the slot is never released.

**Fix:** Add matching timeout logic to `handleNonClaudeProvider`.

### H9: Code-Lab In-Memory Rate Limiter Is Per-Instance

**File:** `code-lab/chat/chat-rate-limit.ts:13-17`

Uses an in-memory `Map` instead of Redis. In Vercel's serverless model, each function instance has its own map, making the 30 req/min limit trivially bypassable.

**Fix:** Use the existing Redis-based `checkRateLimit()` from `src/lib/security/rate-limit.ts`.

### H10: Subscription Status Allowlist Is Incomplete

**File:** `auth.ts:137`

Only checks `past_due` and `canceled`. Stripe can also set `unpaid`, `incomplete`, `incomplete_expired`, and `paused` — all of which would retain paid tier access.

**Fix:** Use an allowlist: only grant paid tier if `status === 'active' || status === 'trialing'`.

### H11: Filename Upload Has No Sanitization

**File:** `src/lib/validation/schemas.ts:174-178`

`filename` accepts any string up to 255 chars. Paths like `../../etc/passwd` or `<script>` tags pass validation.

**Fix:** Add regex constraint: `z.string().regex(/^[a-zA-Z0-9._\- ]+$/)`.

### H12: Code-Lab File Path Allows Traversal at Schema Level

**File:** `src/lib/validation/schemas.ts:480-484`

`codeLabFileSchema.path` has no traversal prevention. While `sanitizeFilePath` exists elsewhere, schema-level defense-in-depth is missing.

**Fix:** Add `.refine(p => !p.includes('..'))` or similar at the schema level.

---

## MEDIUM SEVERITY ISSUES

### M1: Errors Sent as Content, Not Structured Errors (streaming.ts:244-284)

When non-Claude providers throw, errors are sent as regular markdown text in the stream. Clients cannot distinguish errors from normal responses programmatically.

### M2: Stale Admin Cache (auth.ts:122-124)

Admin status cached in Redis for 5 minutes with no invalidation. A revoked admin retains privileges for up to 5 minutes.

### M3: Custom Instructions Not Length-Capped (auth.ts:159-171)

`customInstructions` from DB has no length limit or sanitization before injection into system prompt.

### M4: `supabase` Typed as `any` (auth.ts:43)

Disables all type checking on downstream Supabase usage across the entire chat route.

### M5: Session Ownership Check After Rate Limit Consumption (code-lab/chat/route.ts:96-275)

Rate limits consumed before session ownership verified. Attacker can exhaust another user's budget.

### M6: Client Can Force Perplexity Search (code-lab/chat/route.ts:434)

`forceSearch` parameter bypasses detection logic, inflating API costs.

### M7: Client Can Force Sandbox Activation (code-lab/chat/route.ts:455-459)

Including `/workspace` in message text triggers E2B sandbox creation regardless of user tier.

### M8: Conversation Summary Prompt Injection (code-lab/chat/conversation-summary.ts:26-48)

User messages are concatenated into summarization prompt. Crafted messages can influence the summary, which is then stored in DB and injected into future system prompts.

### M9: Race Condition on Message Count (code-lab/chat/route.ts:305-314)

Read-modify-write on message count is not atomic. Can cause double-summarization or skipped summarization.

### M10: No Timeout on Summarization API Call (code-lab/chat/conversation-summary.ts:30)

`anthropic.messages.create()` has no timeout. Hung API = hung request = consumed slot.

### M11: `metadata` Schema Allows Arbitrary Nested Objects (schemas.ts:92)

`z.record(z.unknown())` with no depth or key count constraints. Potential for storage exhaustion.

### M12: `attachment_urls` No URL Validation (schemas.ts:91)

50KB strings with no `.url()` format check. Could contain `javascript:` protocol.

### M13: Request Size Check After Full JSON Parse (route.ts:86-97)

Body is fully parsed into memory before size validation runs. `checkContentLength` exists but is never called.

### M14: MessageBubble Memo Comparison Missing Fields (MessageBubble.tsx:315-324)

`areEqual` doesn't check `isStreaming`, `isError`, `suggestedFollowups`, `generatedImage`, `videoUrl`, or `analytics`. When only these fields change, the component won't re-render. Most impactful: streaming cursor may not update when streaming ends.

### M15: Timestamp Labeled "UTC" But Shows Local Time (MessageFooter.tsx:45-51)

`toLocaleTimeString` uses local timezone. Display says UTC. This **will** confuse users.

### M16: Token Increment Failures Silently Swallowed (streaming.ts:379)

`incrementTokenUsage().catch(() => {})` — no logging. Users can exceed quotas without any record.

### M17: Full Tool Inventory Leaked in System Prompt (system-prompt.ts:68-137)

Every tool name, purpose, and chaining pattern exposed. Prompt exfiltration gives attackers a complete capability map.

### M18: SQL Pattern Sanitization Incomplete (helpers.ts:252)

Regex requires trailing dot. Common SQL patterns pass through unredacted.

### M19: MCP Server ID Parsing Fragile (chat-tools.ts:527-537)

Underscore-delimited parsing breaks if server ID contains underscores.

### M20: Composio `anonymous` User Fallback (chat-tools.ts:617)

Falls back to `'anonymous'` if userId is falsy, potentially sharing state.

### M21: No Global Rate Limit (rate-limiting.ts)

All limits are per-user. Coordinated multi-account attack has no protection.

### M22: CSRF Parameter Optional in Auth Function (auth.ts:57)

If `request` is omitted by a future caller, CSRF validation is skipped.

---

## LOW SEVERITY ISSUES (Fix post-launch)

| #   | Issue                                                                       | Location                |
| --- | --------------------------------------------------------------------------- | ----------------------- |
| L1  | `getImageAttachments` checks last message, not last _user_ message          | helpers.ts:125          |
| L2  | Messages <20 chars dropped from summary (loses "Yes, delete it")            | helpers.ts:37           |
| L3  | Summary injection uses `role: 'user'` (confuses turn-taking)                | helpers.ts:77-79        |
| L4  | `Transfer-Encoding: chunked` set manually (may conflict with framework)     | streaming.ts:464        |
| L5  | Custom `X-*` headers leak model/provider/tool info                          | streaming.ts:316-322    |
| L6  | Upstream streams not cancelled on client disconnect                         | streaming.ts:311        |
| L7  | Dedup hash truncated to 64 bits (collision risk in window)                  | request-dedup.ts:54     |
| L8  | `calculateJSONSize` returns 0 on serialization failure                      | request-size.ts:38-47   |
| L9  | BYOK decrypted key lives in memory with no zeroing                          | byok.ts:94-96           |
| L10 | Keepalive spaces may cause minor rendering issues                           | stream-utils.ts:53      |
| L11 | Error sanitization doesn't catch `Authorization: Bearer` patterns           | stream-utils.ts:212-214 |
| L12 | `checkContentLength` silently passes when header missing                    | request-size.ts:193-203 |
| L13 | Non-http connection strings (postgres://, redis://) not caught by sanitizer | helpers.ts:250          |
| L14 | Unicode surrogate pair splitting on content truncation                      | helpers.ts:39,255       |
| L15 | Specialist tool tier gating bypassable via keyword stuffing                 | chat-tools.ts:230-252   |

---

## DEPENDENCY VULNERABILITIES

### npm audit: 8 vulnerabilities (2 high, 6 moderate)

| Package     | Severity | Issue                                     | Fix Available                         |
| ----------- | -------- | ----------------------------------------- | ------------------------------------- |
| next        | HIGH     | DoS via Image Optimizer remotePatterns    | Upgrade to 16.x (breaking)            |
| next        | HIGH     | HTTP request deserialization DoS with RSC | Upgrade to 16.x (breaking)            |
| xlsx        | HIGH     | Prototype pollution + ReDoS               | No fix (consider sheetjs alternative) |
| vite/vitest | MODERATE | Various                                   | Dev deps only                         |

### TypeScript Errors

- E2E test files: Missing `@playwright/test` types (not production-impacting)
- `vitest.config.ts`: Missing types (not production-impacting)
- **`src/lib/stripe/client.ts:20`**: API version mismatch — **BREAKS BUILD**

---

## MY RECOMMENDATIONS AS YOUR "OLDER BROTHER"

### Before Monday (Must-Do)

1. **Fix the Stripe API version** — the build is literally broken
2. **Add Zod validation to code-lab chat endpoint** — this is your biggest security gap
3. **Make Redis rate limiting fail-closed in production** — or your first popular day could bankrupt you on API costs
4. **Call `sanitizeOutput()` on tool results** — the function already exists, just wire it in
5. **Add timeout wrappers on tool execution** — one hung tool shouldn't take down a slot forever
6. **Fix the timestamp "UTC" label** — small thing but users will notice immediately
7. **Fix MessageBubble memo comparison** — add `isStreaming` and `isError` to the areEqual function
8. **Implement URL safety checks** — `isUrlSafe()` returning `true` unconditionally is a ticking SSRF bomb

### Before Week 2 (Should-Do)

9. Implement real cost tracking or remove the dead code
10. Add token tracking to non-Claude provider path
11. Replace code-lab in-memory rate limiter with Redis
12. Switch Stripe subscription check to allowlist approach
13. Sanitize memory/learning contexts before system prompt injection
14. Add `checkContentLength` pre-parse to the chat route
15. Add timeout to code-lab summarization API call
16. Gate sandbox activation behind subscription tier

### Before Month 2 (Nice-to-Have)

17. Add global rate limiting (cross-user)
18. Add structured error framing to streams (SSE error events)
19. Evaluate Next.js upgrade path for security patches
20. Find xlsx alternative (no fix available for current vulns)
21. Add MCP server ID allowlist validation
22. Implement cache invalidation for admin status changes

---

## OVERALL ASSESSMENT

**Score: 7.5/10 for architecture, 6/10 for launch-readiness**

The codebase is well-organized and shows genuine engineering discipline. The decomposition work, auth migration, error boundaries, and accessibility improvements are all real and impressive. This is NOT a demo project — it's clearly being built to be a real product.

But the security gaps in the tool execution pipeline, the broken build, the fail-open rate limiting, and the unvalidated code-lab endpoint are the kind of things that turn a promising launch into a bad day. You've done 90% of the work — the last 10% is what separates "this is cool" from "this is trustworthy."

Fix the 8 must-do items and you can launch with confidence. Your users will see a polished, responsive, accessible AI platform. Skip them and you're rolling dice on whether someone pokes a hole in your first week.

I believe in this project. Let's make sure it's ready.

---

_Audit conducted 2026-03-07. All findings verified against source code at commit `2565535`._
