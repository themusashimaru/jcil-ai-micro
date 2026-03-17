# CTO Strategy: Agents → Skills/Tools Migration

**Author:** AI CTO Assessment
**Date:** 2026-03-17
**Status:** PROPOSED — Awaiting approval before implementation
**Scope:** Complete architectural shift from multi-agent orchestration to direct Opus tool calling

---

## Executive Summary

The current architecture runs 3 agent systems (Deep Research, Deep Strategy, Quick Research) that wrap Opus/Sonnet in orchestration layers, spawn up to 100 parallel scouts, and burn tokens through intermediate reasoning. This strategy eliminates the agent abstraction layer and gives Opus direct access to consolidated tools — cutting token costs by ~60-70%, removing redundancy, and simplifying the codebase by ~3,000+ lines.

**Core thesis:** Opus 4.6 with 200K context and native tool calling is smart enough to orchestrate its own research and strategy work. We don't need to tell it how to think.

---

## Part 1: What We're Killing

### 1.1 Strategy Agent System (DELETE)

**Files to remove:** `src/agents/strategy/` (entire directory)

| Component                  | Lines  | Why Kill It                                                    |
| -------------------------- | ------ | -------------------------------------------------------------- |
| `StrategyAgent.ts`         | ~600   | Orchestration layer Opus doesn't need                          |
| `Scout.ts`                 | 958    | Spawns Sonnet sub-agents; Opus can do this natively with tools |
| `ForensicIntake.ts`        | ~200   | Convert to a skill/prompt template, not an agent               |
| `MasterArchitect.ts`       | ~200   | Opus IS the architect — no wrapper needed                      |
| `QualityControl.ts`        | ~150   | Quality gates become part of system prompt                     |
| `Synthesizer.ts`           | ~200   | Opus synthesizes natively                                      |
| `ExecutionQueue.ts`        | ~150   | Rate limiting moves to tool-level                              |
| `SteeringEngine.ts`        | ~100   | Not needed without scouts                                      |
| `KnowledgeBase.ts`         | ~200   | Keep as a standalone utility, not agent infrastructure         |
| `PerformanceTracker.ts`    | ~150   | Simplify to per-tool metrics                                   |
| `ArtifactGenerator.ts`     | ~200   | Convert to a tool                                              |
| `prompts/*.ts`             | ~600   | Convert best parts to skills                                   |
| `tools/*.ts` (13 tools)    | ~1,500 | Merge non-duplicates into main tool registry                   |
| `constants.ts`, `types.ts` | ~500   | Mostly obsolete                                                |

**Estimated removal:** ~5,700 lines
**Net removal after migrations:** ~3,500 lines

**Token cost impact:** The Strategy Agent uses Opus for "architecture" and spawns Sonnet scouts. A typical deep research query:

- Current: Opus orchestrator (~2K input + 1K output) + 10-30 Sonnet scouts (~5K input + 2K output each) = **52K-62K input, 21K-31K output**
- Proposed: Single Opus call with tools (~8K input + 4K output per iteration, 2-4 iterations) = **16K-32K input, 8K-16K output**
- **Savings: ~60-70% fewer tokens per research query**

### 1.2 Code Agent V1 (DELETE)

**File:** `src/agents/code/CodeAgent.ts` (460 lines)

V2 supersedes V1 completely. V1 is dead weight.

### 1.3 Code Agent V2 (MORPH → Tool Suite)

**File:** `src/agents/code/CodeAgentV2.ts` (862 lines)

Don't delete — decompose its 6 modes into individual tools that Opus calls directly:

| V2 Mode    | Becomes Tool    | Purpose                    |
| ---------- | --------------- | -------------------------- |
| `generate` | `code_generate` | Already exists in registry |
| `analyze`  | `code_analyze`  | Already exists             |
| `review`   | `code_review`   | Already exists             |
| `fix`      | `code_fix`      | Already exists             |
| `test`     | `code_test`     | New tool                   |
| `document` | `code_document` | New tool                   |

The "brain modules" (`src/agents/code/brain/`) become utility functions these tools call, not an agent orchestration layer.

### 1.4 Agent API Routes (DELETE/SIMPLIFY)

| Route                            | Action                                   |
| -------------------------------- | ---------------------------------------- |
| `app/api/strategy/route.ts`      | DELETE — no more agent endpoint          |
| `app/api/code-lab/chat/route.ts` | SIMPLIFY — remove agent invocation logic |

### 1.5 Agent UI (SIMPLIFY)

**File:** `src/components/code-lab/CodeLabComposerAgents.tsx`

Replace the 3-agent dropdown with:

- Remove "Deep Research" agent button
- Remove "Deep Strategy" agent button
- Remove "Research" agent button
- The model handles research/strategy naturally when given the right tools

---

## Part 2: Tool Consolidation (Eliminating Redundancy)

### 2.1 Current Redundancies

| Redundancy Group   | Current Tools                                                                  | Consolidated Tool                                        |
| ------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **Web capture**    | `screenshot`, `browser_visit`, `capture_webpage`, `desktop_sandbox`            | `web_browse` (single tool: visit + screenshot + extract) |
| **Spreadsheet**    | `create_spreadsheet`, `excel_advanced`                                         | `spreadsheet` (one tool, full capability)                |
| **Charts**         | `create_chart`, `e2b_visualize`                                                | `visualize` (one tool, server-side via E2B)              |
| **Bio sequence**   | `analyze_sequence`, `sequence_analyze`                                         | `bio_sequence` (one tool, clear name)                    |
| **Code execution** | `run_code` (registry), `run_code` (scout), `e2b_code` (scout)                  | `run_code` (single implementation)                       |
| **PDF**            | `extract_pdf` (registry), `extract_pdf` (scout)                                | `extract_pdf` (single implementation)                    |
| **Vision**         | `analyze_image` (registry), `vision_analyze` (scout)                           | `analyze_image` (single implementation)                  |
| **Web search**     | `web_search` (registry), `brave_search` (scout)                                | `web_search` (single implementation, Brave backend)      |
| **Browser**        | `browser_visit` (scout), `e2b_browser` (scout), `e2b_browser_enhanced` (scout) | `web_browse` (see above)                                 |

**Result: ~56 tools → ~42 consolidated tools** (eliminate 14 redundant tools)

### 2.2 Scout Tools to Promote to Main Registry

These scout-only tools have real value and should become first-class tools:

| Scout Tool            | New Registry Name         | Why Keep                           |
| --------------------- | ------------------------- | ---------------------------------- |
| `safe_form_fill`      | `web_form_fill`           | Unique capability, safety built in |
| `paginate`            | (merge into `web_browse`) | Pagination is a browse feature     |
| `infinite_scroll`     | (merge into `web_browse`) | Scroll is a browse feature         |
| `click_navigate`      | (merge into `web_browse`) | Navigation is a browse feature     |
| `compare_screenshots` | `compare_images`          | Useful for visual diff             |
| `generate_comparison` | `comparison_table`        | Useful for research output         |
| `extract_table`       | `extract_table`           | Already in registry — no action    |

### 2.3 Scout Tools to Kill

| Tool                             | Why                                                    |
| -------------------------------- | ------------------------------------------------------ |
| `browser_visit`                  | Duplicate of registry `web_browse`                     |
| `e2b_browser`                    | Duplicate                                              |
| `e2b_browser_enhanced`           | Merge useful features into `web_browse`                |
| `screenshot`                     | Merged into `web_browse`                               |
| `run_code` (scout version)       | Duplicate of registry `run_code`                       |
| `extract_pdf` (scout version)    | Duplicate of registry `extract_pdf`                    |
| `vision_analyze` (scout version) | Duplicate of registry `analyze_image`                  |
| `brave_search` (scout version)   | Duplicate of registry `web_search`                     |
| Dynamic tool creation            | Opus can generate and run code directly via `run_code` |

---

## Part 3: New Capabilities

### 3.1 Forensic Intake Skill

Convert `ForensicIntake.ts` from an agent component to a **skill** (prompt template):

```yaml
# .claude/skills/forensic-intake.md
---
name: forensic-intake
description: Deep problem analysis - asks clarifying questions before diving in
model: opus
maxTokens: 4096
tags: [analysis, intake, planning]
---

You are performing a forensic intake analysis. Your job is to deeply understand
the problem before proposing solutions.

## Process:
1. Identify the core problem statement
2. List what you know vs what you need to know
3. Identify constraints, dependencies, and risks
4. Ask 3-5 targeted clarifying questions
5. Propose a preliminary analysis framework

## Rules:
- Do NOT jump to solutions
- Do NOT make assumptions about technology choices
- Ask questions that reveal hidden complexity
- Consider legal, ethical, and practical constraints
```

Users invoke with `/forensic-intake` in the chat.

### 3.2 Research Skill (Replaces Deep Research Agent)

```yaml
# .claude/skills/deep-research.md
---
name: deep-research
description: Multi-source research with synthesis
allowedTools: [web_search, web_browse, extract_pdf, analyze_image, extract_table, comparison_table, run_code]
model: opus
maxTokens: 8192
tags: [research, analysis]
---

You are conducting deep research. Use your tools iteratively:

1. Start with web_search to find relevant sources
2. Use web_browse to read full articles
3. Use extract_pdf for academic papers
4. Use extract_table for data extraction
5. Cross-reference findings across sources
6. Synthesize into a structured report with citations

## Output Format:
- Executive Summary (2-3 sentences)
- Key Findings (numbered, with source citations)
- Data/Evidence (tables, quotes, statistics)
- Confidence Assessment (what's well-supported vs speculative)
- Recommended Next Steps
```

### 3.3 Strategy Skill (Replaces Deep Strategy Agent)

```yaml
# .claude/skills/deep-strategy.md
---
name: deep-strategy
description: Strategic analysis and planning
allowedTools: [web_search, web_browse, run_code, comparison_table, visualize]
model: opus
maxTokens: 8192
tags: [strategy, planning]
---

You are a strategic advisor. Analyze the problem using structured frameworks:

1. Research the landscape (competitors, market, technology)
2. Identify options with trade-offs
3. Build comparison matrices
4. Recommend a path with justification
5. Create an implementation roadmap

## Frameworks to consider:
- SWOT analysis
- Porter's Five Forces (for market questions)
- Build vs Buy analysis (for technology choices)
- Risk/Impact matrix
- Cost-benefit analysis

## Output Format:
- Situation Assessment
- Options Analysis (comparison table)
- Recommended Strategy
- Implementation Roadmap (phased)
- Risk Mitigation Plan
```

### 3.4 Quick Research Skill (Replaces Quick Research Agent)

```yaml
# .claude/skills/research.md
---
name: research
description: Quick web research with AI summary
allowedTools: [web_search, web_browse]
model: opus
maxTokens: 4096
tags: [research, quick]
---

Perform a focused web search and provide a concise answer:

1. Search for the most relevant information
2. Read 2-3 top sources
3. Synthesize into a clear, cited answer
4. Include source URLs
```

### 3.5 Additional High-Value Skills

| Skill               | Purpose                                      | Tools Needed                                   |
| ------------------- | -------------------------------------------- | ---------------------------------------------- |
| `code-architect`    | Design system architecture from requirements | `run_code`, `web_search`, `visualize`          |
| `security-audit`    | Analyze code for vulnerabilities             | `run_code`, `web_search`                       |
| `data-analyst`      | Analyze datasets and produce insights        | `run_code`, `visualize`, `spreadsheet`         |
| `legal-research`    | Legal document analysis and research         | `web_search`, `web_browse`, `extract_pdf`      |
| `competitive-intel` | Competitor analysis and market research      | `web_search`, `web_browse`, `comparison_table` |

---

## Part 4: Brave Search Decision

### Keep Brave Search — But as a Backend, Not a Feature

**Rationale:**

- Brave Search API at $0.005/query is cheap
- No equivalent native search capability exists without an API
- Perplexity's `sonar-pro` is more expensive and less controllable
- The issue isn't Brave — it's that agents were making 50-500 Brave calls per session

**Change:**

- `web_search` tool uses Brave as its backend (already does)
- Remove the separate `brave_search` scout tool (redundant)
- Add intelligent search deduplication: if Opus already searched for "X", don't search for "X" again
- Rate limit: max 10 searches per conversation turn (configurable)
- Cache search results for 15 minutes to avoid duplicate API calls

**Cost impact:** From 50-500 searches/session → 5-15 searches/session = **90% reduction in search costs**

---

## Part 5: Token Cost Analysis

### Current Architecture Cost Per Deep Research Query

| Component               | Input Tokens | Output Tokens | Cost       |
| ----------------------- | ------------ | ------------- | ---------- |
| Opus orchestrator       | 4,000        | 2,000         | $0.021     |
| 15 Sonnet scouts (avg)  | 75,000       | 30,000        | $0.675     |
| Brave searches (30 avg) | —            | —             | $0.150     |
| **Total**               | **79,000**   | **32,000**    | **$0.846** |

### Proposed Architecture Cost Per Deep Research Query

| Component                          | Input Tokens | Output Tokens | Cost       |
| ---------------------------------- | ------------ | ------------- | ---------- |
| Opus with tools (3 iterations avg) | 24,000       | 12,000        | $0.126     |
| Brave searches (8 avg)             | —            | —             | $0.040     |
| **Total**                          | **24,000**   | **12,000**    | **$0.166** |

### Savings: **$0.68 per deep research query (~80%)**

At 100 deep research queries/day: **$68/day → $12/day = $56/day saved = $1,680/month saved**

### Regular Chat (No Change)

Regular chat already uses Opus directly. No cost change expected.

---

## Part 6: Implementation Roadmap

### Phase 1: Tool Consolidation (Week 1)

**Risk: LOW — No user-facing changes**

1. Create consolidated `web_browse` tool merging browse/screenshot/navigate/scroll/form capabilities
2. Merge duplicate spreadsheet tools into single `spreadsheet`
3. Merge duplicate chart tools into single `visualize`
4. Fix naming: `analyze_sequence`/`sequence_analyze` → `bio_sequence`
5. Remove duplicate scout tools that exist in main registry
6. Update tool registry to reflect consolidation
7. Update all tests

**Deliverable:** 42 tools (down from 56+13 = 69 unique invocation points)

### Phase 2: Create Skills (Week 1-2)

**Risk: LOW — Additive, nothing breaks**

1. Create `forensic-intake` skill
2. Create `deep-research` skill
3. Create `deep-strategy` skill
4. Create `research` (quick) skill
5. Create `code-architect` skill
6. Create `security-audit` skill
7. Wire skills into skill-loader system
8. Test each skill end-to-end

**Deliverable:** 6+ skills ready to replace agent functionality

### Phase 3: Agent Removal (Week 2)

**Risk: MEDIUM — User-facing behavior changes**

1. Remove Strategy Agent invocation from code-lab chat route
2. Remove Code Agent V1 entirely
3. Morph Code Agent V2 into individual tools
4. Update `CodeLabComposerAgents.tsx` — remove agent dropdown
5. Add skill invocation to chat UI (e.g., `/deep-research` command)
6. Delete `src/agents/strategy/` directory
7. Delete `src/agents/code/CodeAgent.ts`
8. Simplify `src/agents/code/CodeAgentV2.ts` into tool functions
9. Remove `app/api/strategy/route.ts`
10. Update all imports and references

**Deliverable:** Agent system fully removed, skills operational

### Phase 4: Search Optimization (Week 2-3)

**Risk: LOW**

1. Add search result caching (15-minute TTL)
2. Add search deduplication within conversation
3. Add per-turn search rate limiting (max 10)
4. Remove Perplexity dependency if Brave covers all use cases
5. Monitor search costs

**Deliverable:** Search costs reduced ~90%

### Phase 5: Cleanup & Documentation (Week 3)

**Risk: LOW**

1. Remove unused brain modules from `src/agents/code/brain/`
2. Clean up types that referenced agent system
3. Update CLAUDE.md with new architecture
4. Update PROJECT_STATUS.md with new metrics
5. Update TASK_TRACKER.md
6. Final test pass

**Deliverable:** Clean codebase, accurate documentation

---

## Part 7: What We Keep

| Component                                               | Why                                                |
| ------------------------------------------------------- | -------------------------------------------------- |
| Tool registry (`src/lib/ai/tools/registry.ts`)          | Core infrastructure — tools are the new primitives |
| Skills system (`src/lib/skills/skill-loader.ts`)        | This IS the replacement for agents                 |
| Brave Search client (`src/lib/brave/client.ts`)         | Backend for `web_search` tool                      |
| E2B sandbox (`run_code`, `web_browse`)                  | Real sandboxed execution                           |
| Token tracking (`src/lib/workspace/token-tracker.ts`)   | Cost monitoring                                    |
| Knowledge Base (`src/agents/strategy/KnowledgeBase.ts`) | Move to `src/lib/knowledge/` — useful standalone   |
| Code brain modules (subset)                             | Move useful ones to `src/lib/code-utils/`          |

---

## Part 8: Model Version Audit (Bonus Finding)

During this analysis, I found a **bug in token tracking**:

**File:** `app/api/strategy/strategy-db.ts` (lines 236, 249, 261)
**Issue:** Hardcodes `'claude-opus-4-6'` for ALL token tracking, even when Sonnet scouts did the work.
**Impact:** Cost reports undercount by ~5x (Opus costs 5x more than Sonnet per token).
**Fix:** This becomes moot once we kill the agent system — single Opus model for everything.

**Other finding:** `CLAUDE_HAIKU_MODEL` env var defaults to `claude-opus-4-6` (line 25 in constants.ts). The haiku tier is effectively dead. Clean this up during Phase 5.

---

## Part 9: Risk Assessment

| Risk                                    | Probability | Impact | Mitigation                                                    |
| --------------------------------------- | ----------- | ------ | ------------------------------------------------------------- |
| Users miss agent UX                     | Medium      | Medium | Skills provide same capability with simpler UX                |
| Opus tool iterations exceed budget      | Low         | Medium | Per-turn tool call limits (max 15 per turn)                   |
| Research quality drops                  | Low         | High   | Test extensively in Phase 2 before removing agents in Phase 3 |
| Scout parallelism was actually valuable | Low         | Medium | Opus can make multiple sequential tool calls efficiently      |
| Search result quality varies            | Low         | Low    | Brave is already the backend — no change                      |

---

## Part 10: Success Metrics

| Metric                        | Current  | Target | How to Measure     |
| ----------------------------- | -------- | ------ | ------------------ |
| Token cost per research query | ~$0.85   | ~$0.17 | Token tracker      |
| Search API calls per session  | 50-500   | 5-15   | Brave call counter |
| Codebase lines (agents)       | ~8,000   | ~500   | `wc -l`            |
| Tool count (unique)           | 69       | 42     | Registry count     |
| Research query latency        | 30-60s   | 10-20s | API response time  |
| Monthly infrastructure cost   | ~$2,000+ | ~$400  | Billing dashboard  |

---

## Bottom Line

**Kill the agents. Trust Opus. Give it tools. Use skills for workflow templates.**

The agent layer was built when models needed hand-holding. Opus 4.6 doesn't need an orchestrator — it IS the orchestrator. Every layer of abstraction between Opus and the tools is wasted tokens and added complexity.

This migration saves ~$1,600/month, removes ~3,500 lines of code, eliminates 14 redundant tools, and makes the system simpler to maintain and extend. New capabilities (forensic intake, security audit, competitive intel) are added as 20-line skill files instead of 500-line agent classes.

The only thing we lose is parallelism (100 scouts running simultaneously). What we gain is intelligence — one Opus call with the right tools beats 30 Sonnet scouts trying to figure out what to search for.
