# Deep Strategy Agent

> **The Most Advanced Self-Designing AI Agent System** — Powered by a Multi-Tier Claude Architecture

---

## Overview

The Deep Strategy Agent is JCIL.AI's most powerful feature—a self-designing, multi-agent system that dynamically creates and deploys specialized AI agents to solve complex problems. Unlike traditional AI assistants that process requests in a single pass, Deep Strategy uses a coordinated army of up to 100 AI agents conducting hundreds of real-time web searches.

### Key Differentiators

| Feature            | Traditional AI            | Deep Strategy Agent                           |
| ------------------ | ------------------------- | --------------------------------------------- |
| **Processing**     | Single model, single pass | Multi-tier hierarchy with specialized agents  |
| **Research**       | Static knowledge cutoff   | Real-time web research (hundreds of searches) |
| **Browser**        | None                      | Puppeteer automation visits actual websites   |
| **Screenshots**    | None                      | Visual analysis of web pages                  |
| **Code Execution** | None                      | Python/JS sandbox for data analysis           |
| **Depth**          | Surface-level responses   | Forensic-level deep analysis                  |
| **Customization**  | Generic responses         | Self-designs specialized agents per problem   |
| **Continuity**     | Lost on page leave        | Sessions persist, return to results anytime   |
| **Cost**           | ~$0.05/request            | ~$5-20/strategy (premium feature)             |

### Research Capabilities

Deep Strategy agents have access to **14 powerful research tools** in secure E2B cloud sandboxes:

**Core Research Tools:**

- **Brave Search API** — Hundreds of real-time web searches
- **Puppeteer Browser** — Visits actual websites, extracts rendered content from JavaScript-heavy pages
- **Screenshots** — Captures visual snapshots of web pages for analysis
- **Code Execution** — Python/JS sandbox (E2B) for data processing and analysis

**Vision & AI Analysis Tools:**

- **Vision Analyze** — Claude Vision AI analyzes screenshots, extracts data from charts and complex layouts
- **Extract Tables** — AI-powered extraction of pricing tables, comparison charts
- **Compare Screenshots** — Side-by-side comparison of multiple URLs (price comparisons, etc.)

**Safe Interactive Browser Tools:**

- **Safe Form Fill** — Fills ONLY search/filter forms (BLOCKED: login, signup, payment)
- **Pagination Handler** — Navigates through multi-page search results automatically
- **Infinite Scroll** — Handles infinite scroll pages (social feeds, product listings)
- **Click Navigate** — Clicks elements and extracts resulting content

**Document Tools:**

- **PDF Extraction** — Downloads and extracts text from PDF documents

**Data Organization:**

- **Comparison Table Generator** — Creates formatted comparison tables from research data

### Responsible Use

This is an extremely powerful tool. Users must agree to use it responsibly:

- For legitimate research and decision-making only
- Not for illegal activities, harassment, fraud, or harmful purposes
- Not for accessing government, adult, or restricted content
- Respect rate limits and cost controls

---

## Architecture

### Multi-Tier Model Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEEP STRATEGY AGENT SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    TIER 1: OPUS 4.5 (Master Brain)                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Master     │  │   Quality    │  │   Final      │                 │ │
│  │  │  Architect   │  │   Control    │  │  Synthesis   │                 │ │
│  │  │              │  │              │  │              │                 │ │
│  │  │ Designs the  │  │ Validates    │  │ Synthesizes  │                 │ │
│  │  │ agent army   │  │ all findings │  │ final output │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                TIER 2: SONNET 4.5 (Project Managers)                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   PM: Legal  │  │ PM: Market   │  │ PM: Strategy │  ...           │ │
│  │  │   Research   │  │  Analysis    │  │    Options   │                 │ │
│  │  │              │  │              │  │              │                 │ │
│  │  │ Coordinates  │  │ Coordinates  │  │ Coordinates  │                 │ │
│  │  │ legal scouts │  │market scouts │  │strategy scouts│                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                   TIER 3: HAIKU 4.5 (Scout Army)                        │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ...       │ │
│  │  │Scout│ │Scout│ │Scout│ │Scout│ │Scout│ │Scout│ │Scout│  Up to    │ │
│  │  │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │ │  7  │  100!     │ │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘           │ │
│  │    │       │       │       │       │       │       │                │ │
│  │    ▼       ▼       ▼       ▼       ▼       ▼       ▼                │ │
│  │  ┌───────────────────────────────────────────────────────────────┐  │ │
│  │  │                    RESEARCH TOOLS LAYER                        │  │ │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │  │ │
│  │  │  │  Brave  │  │Puppeteer│  │ Screen- │  │  Code   │          │  │ │
│  │  │  │ Search  │  │ Browser │  │  shot   │  │ Sandbox │          │  │ │
│  │  │  │   API   │  │  (E2B)  │  │         │  │  (E2B)  │          │  │ │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │  │ │
│  │  │   Hundreds     Visits      Visual        Python/JS           │  │ │
│  │  │   of queries   real URLs   analysis      analysis            │  │ │
│  │  └───────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Tier 1: Opus 4.5 (Master Brain)

**Master Architect** — Designs the entire agent army

- Analyzes the synthesized problem from forensic intake
- Determines what types of specialized agents are needed
- Creates blueprints for Project Managers and Scouts
- Defines search strategies and research angles

**Quality Control** — Validates all findings

- Reviews findings from all agents
- Checks for contradictions and inconsistencies
- Ensures confidence scores are accurate
- Flags low-quality or unreliable sources

**Final Synthesis** — Creates the ultimate output

- Synthesizes all validated findings
- Generates the final strategic recommendation
- Produces actionable steps with priorities
- Creates executive summary for the user

#### Tier 2: Sonnet 4.5 (Project Managers)

Project Managers coordinate groups of Scout agents:

- Receive blueprints from the Master Architect
- Spawn and coordinate Scout agents
- Aggregate findings from their Scouts
- Report consolidated results upward

#### Tier 3: Haiku 4.5 (Scout Army)

Scouts are the execution layer with powerful research tools:

- **Brave Search** — Execute targeted web search queries
- **Puppeteer Browser** — Visit actual websites, extract rendered content from JavaScript-heavy pages
- **Screenshots** — Capture visual snapshots of web pages for analysis
- **Code Execution** — Run Python/JS in E2B sandbox for data processing

Each scout can use tools like Claude native tool calling, selecting the best tool for each research task.

---

## User Flow

### Phase 1: Document Upload (Optional)

Users can upload relevant documents before the strategy begins:

```
┌────────────────────────────────────────┐
│     📎 Upload Documents (Optional)      │
│                                        │
│  • Resume/CV                           │
│  • Contracts                           │
│  • Financial documents                 │
│  • Screenshots                         │
│  • Spreadsheets                        │
│                                        │
│  Supported: PDF, DOC, XLSX, images     │
│  Max: 10MB per file                    │
└────────────────────────────────────────┘
```

### Phase 2: Forensic Intake

The system conducts a deep interview to understand the problem:

```
AI: "I'm going to ask you some questions to deeply understand
     your situation. Please share as much context as possible."

AI: "What is the core problem you're facing?"
User: [Explains their situation]

AI: "What constraints or limitations should I know about?"
User: [Shares budget, timeline, location, etc.]

AI: "Who are the key stakeholders affected?"
User: [Identifies people involved]

AI: "What would an ideal outcome look like?"
User: [Describes success criteria]
```

### Phase 3: Strategy Execution

Once intake is complete, the agent army deploys:

```
┌─────────────────────────────────────────────┐
│       ⚡ Deep Strategy In Progress           │
├─────────────────────────────────────────────┤
│                                             │
│  ✓ Understanding your situation             │
│  ✓ Designing agent army                     │
│  ● Spawning research scouts        [12]     │
│  ○ Conducting web research         [47]     │
│  ○ Processing scout findings                │
│  ○ Synthesizing strategy                    │
│                                             │
├─────────────────────────────────────────────┤
│  🧠 12/12 agents  🔍 47 searches  💡 8 findings │
│                                    $4.23    │
└─────────────────────────────────────────────┘
```

### Phase 4: Browser Preview Window

Watch the AI at work in a futuristic mini-browser interface that shows research in real-time:

```
┌─────────────────────────────────────────────┐
│ 🔴 🟡 🟢  │ 🔒 zillow.com/jersey-city  🔄  │ ● LIVE │
├─────────────────────────────────────────────┤
│                                             │
│           🌐                                │
│       zillow.com                            │
│     "Market Research Scout"                 │
│                                             │
│  ┌─────────────────────────────────┐        │
│  │ 🔍 "PATH train schedule"        │ 80%    │
│  │ 🌐 redfin.com                   │ 60%    │
│  │ 📸 streeteasy.com               │ 40%    │
│  └─────────────────────────────────┘        │
├─────────────────────────────────────────────┤
│ 🔍 47  🌐 12  📸 5  💻 2    ⚡ 66 actions    │
└─────────────────────────────────────────────┘
```

Features:

- **macOS-style browser chrome** with traffic lights and address bar
- **Live URL display** shows what's being visited in real-time
- **Flash effects** when new activities occur
- **Activity counts** by type (searches, visits, screenshots, code)
- **Ambient glow** and scanline effects for futuristic feel

### Phase 5: Activity Log

Expandable detailed log of all research activities:

```
┌─────────────────────────────────────────────┐
│  ⚡ Live Research Activity           ●       │
├─────────────────────────────────────────────┤
│  🔍 47  🌐 12  📸 5                          │
├─────────────────────────────────────────────┤
│  🔍 "jersey city apartment prices 2024"     │
│  🌐 zillow.com                              │
│  📸 Screenshot: streeteasy.com              │
│  🔍 "PATH train schedule journal square"    │
│  🌐 redfin.com/NJ/Jersey-City               │
│  💻 Running Python analysis...              │
└─────────────────────────────────────────────┘
```

This gives users visibility into exactly what the AI agents are researching.

### Phase 5: Mid-Execution Steering & Context

Users can send messages while the strategy is running. Messages are parsed by the **Steering Engine** to detect commands, or stored as additional context.

**Context Messages** — Additional information the user remembered:

```
User: "I forgot to mention we have a partner in Japan"
→ Context stored and available to synthesis
```

**Steering Commands** — Real-time control over the agent army:

```
User: "Stop researching housing, focus on career"
→ Steering: Killed domain "housing", focused all resources on "career"

User: "Also look into remote work trends"
→ Steering: Spawning 3 new scouts for "remote work trends"

User: "Pause"
→ Execution paused. Send "resume" to restart.
```

**Supported Steering Commands:**

| Command Pattern                   | Action         | Effect                                        |
| --------------------------------- | -------------- | --------------------------------------------- |
| "stop researching X" / "kill X"   | `kill_domain`  | Skips all scouts related to domain X          |
| "focus on X" / "double down on X" | `focus_domain` | Kills all domains except X, spawns new scouts |
| "redirect to X" / "pivot to X"    | `redirect`     | Spawns 3 new scouts for target X              |
| "also research X" / "add X"       | `spawn_scouts` | Spawns 3 additional scouts for X              |
| "pause" / "hold" / "wait"         | `pause`        | Pauses scout execution loop                   |
| "resume" / "continue" / "go"      | `resume`       | Resumes paused execution                      |

The steering engine uses natural language regex parsing — no special syntax needed.

### Phase 6: Post-Synthesis

After synthesis completes, the system automatically:

1. **Stores findings** in the Knowledge Base for future sessions
2. **Generates artifacts** — comparison CSVs, findings tables, executive report, confidence chart
3. **Records scout performance** — tool combos and effectiveness metrics are stored for architect learning

### Phase 7: Final Output

The strategy is delivered with:

- **Executive Summary** — Key recommendation in 2-3 sentences
- **Detailed Analysis** — Full breakdown with evidence
- **Action Items** — Prioritized steps with timeframes
- **Risk Assessment** — Potential challenges and mitigations
- **Sources** — All web research cited with links
- **Generated Deliverables** — CSVs, charts, and reports (listed with file names and sizes)

### Session Continuity

Strategy sessions persist across browser sessions:

- **Sidebar Integration** — Completed sessions appear in the chat sidebar
- **Return Anytime** — Click a session to reload its results
- **Session Status** — See which sessions are complete, running, or errored
- **Full Persistence** — All findings, results, and metadata saved to database

```
┌─────────────────────────────────────────────┐
│  💡 Strategy Sessions (3)            ▾      │
├─────────────────────────────────────────────┤
│  ✓ Housing decision analysis      $12.47   │
│  ✓ Career pivot strategy           $8.93   │
│  ● Investment research (running)            │
└─────────────────────────────────────────────┘
```

---

## Multi-Mode Agent System

The Deep Agent engine supports multiple modes that share the same execution core but use different prompt sets. The engine is mode-agnostic — only the prompts change.

### Available Modes

| Mode              | `AgentMode` | Button Color | Prompt Focus                              |
| ----------------- | ----------- | ------------ | ----------------------------------------- |
| **Deep Strategy** | `strategy`  | Purple       | Decision-making, action plans, trade-offs |
| **Deep Research** | `research`  | Emerald      | Evidence-based findings, academic rigor   |

### Architecture

```
┌──────────────────────────────────────────────┐
│              SHARED AGENT ENGINE              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Intake   │ │ Architect│ │ QC + Syn │     │
│  │ (Opus)   │ │ (Opus)   │ │ (Opus)   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  ┌──────────────────────────────────────┐    │
│  │        Scout Army (Haiku)            │    │
│  └──────────────────────────────────────┘    │
│                     ↑                        │
│            PromptSet injection               │
│     ┌───────────┐    ┌───────────┐           │
│     │ Strategy  │    │ Research  │           │
│     │  Prompts  │    │  Prompts  │           │
│     └───────────┘    └───────────┘           │
└──────────────────────────────────────────────┘
```

### Adding New Modes

1. Create a new file in `src/agents/strategy/prompts/` (e.g., `audit.ts`)
2. Export a `PromptSet` with all 7 prompt fields
3. Register it in `prompts/index.ts` under a new key
4. Add the UI button in `ChatComposer.tsx`
5. Add the lifecycle functions in `ChatClient.tsx`

---

## Enhancement Features

### 1. Persistent Knowledge Base

Every finding from every session is stored in Supabase with full-text search. Future sessions build on past research.

**How it works:**

- After synthesis, all findings are stored in the `knowledge_base` table
- Before the Master Architect designs agents, prior findings are queried
- Relevant prior research is injected into the architect's system prompt
- Uses PostgreSQL `tsvector` for full-text search (no external API needed)

**Database table:** `knowledge_base`

- Per-user isolation via RLS
- Full-text search index on title + content + domain + tags
- Optional trigram index for fuzzy matching (pg_trgm)

**Key functions:**

- `storeFindings()` — Batch inserts findings after synthesis
- `queryKnowledge()` — Full-text search with domain/tag/mode filters
- `getKnowledgeSummary()` — Retrieves summary for architect injection
- `buildKnowledgePromptContext()` — Formats prior findings for prompt

### 2. Scout Performance Tracking

Records how well each scout configuration performed. The Master Architect uses this data to design increasingly effective agent armies over time.

**Metrics tracked per scout:**

- Tool combination used (brave_search + browser_visit + etc.)
- Findings count, confidence breakdown (high/medium/low)
- Average relevance score
- Execution time, token usage, cost
- Success/failure status
- Child agents spawned

**Key functions:**

- `recordScoutPerformance()` — Records after each scout completes (non-blocking)
- `getPerformanceInsights()` — Aggregates by tool combination, sorts by effectiveness
- `buildPerformancePromptContext()` — Injects top combos into architect prompt

**Database table:** `scout_performance`

- Indexed by user, mode, tools, domain, status

### 3. Real-time Steering Engine

Parses natural language steering commands from users during execution and translates them into concrete actions.

**Integration points:**

- `addContext()` in StrategyAgent — parses every user message for commands
- `executeScouts()` — checks `shouldKillScout()` before each scout
- `isExecutionPaused()` — pauses the execution loop
- `generateRedirectBlueprints()` — creates new scouts for redirect/spawn commands

**Deduplication safety:** Steering scouts use `scout_steer_` ID prefix. An `executedIds` set prevents double-execution when the async generator picks up dynamically-added blueprints.

### 4. Auto-generated Artifacts

After synthesis completes, the system generates downloadable deliverables:

| Artifact Type    | Format    | Content                                     |
| ---------------- | --------- | ------------------------------------------- |
| Comparison CSV   | text/csv  | Domain comparison tables from analysis      |
| Findings CSV     | text/csv  | All findings with type, confidence, sources |
| Executive Report | text/md   | Full formatted report with all sections     |
| Confidence Chart | image/png | Matplotlib bar chart via E2B Python sandbox |

**Storage:** Artifacts are stored in the `strategy_artifacts` Supabase table (inline content — base64 for images, text for CSV/markdown).

**Retrieval:** `GET /api/strategy?sessionId=X&includeArtifacts=true` returns artifacts with full content.

---

## Safety & Limits

### Browser Safety Framework

**Domain Restrictions:**

- **BLOCKED:** Government sites (.gov, .mil), banking login pages, adult content, state media/propaganda
- **TRUSTED:** Real estate (Zillow, Redfin), job sites (LinkedIn, Indeed), e-commerce (Amazon, eBay), travel (Kayak, Expedia), business info (Yelp, Crunchbase)

**Form Safety (Whitelist Approach):**

- **ALLOWED:** Search forms, filter forms, price calculators, location selectors
- **BLOCKED:** Login, signup, registration, checkout, payment, delete actions
- **INPUT BLOCKED:** Password fields, credit card numbers, SSN, bank accounts, API keys

**Rate Limits per Session:**
| Limit | Value | Purpose |
| ---------------------- | ----- | -------------------------- |
| Max pages per domain | 20 | Prevent abuse |
| Max form submissions | 5 | Limit interactions |
| Max clicks per page | 10 | Prevent excessive clicking |
| Action delay | 500ms | Rate limit protection |
| Max total pages | 100 | Resource management |
| Max screenshots | 50 | Storage limits |

**Output Sanitization:**

- Automatic redaction of credit card numbers
- Automatic redaction of SSN patterns
- Automatic redaction of phone numbers
- All sensitive data patterns removed before returning to user

### Hard Limits (Kill Switch)

| Limit              | Value        | Reason                   |
| ------------------ | ------------ | ------------------------ |
| **Max Budget**     | $20          | Cost protection          |
| **Max Scouts**     | 100          | Resource management      |
| **Max Searches**   | 500          | API rate limiting        |
| **Max Time**       | 10 minutes   | Timeout protection       |
| **Max Depth**      | 50 levels    | Infinite loop prevention |
| **Max Concurrent** | 30 API calls | Parallel execution       |
| **Batch Delay**    | 250ms        | Rate limit safety buffer |

### Quality Control

- **Minimum Confidence Score**: 0.5 (50%)
- **Max Error Rate**: 30% before kill switch
- **Duplicate Detection**: Automatic deduplication
- **Source Validation**: Cross-reference verification

### Graceful Degradation

If any limit is hit, the system:

1. Stops spawning new agents
2. Waits for in-progress agents to complete
3. Synthesizes a partial result with available findings
4. Returns whatever insights were gathered

---

## API Reference

### Start Strategy Session

```http
POST /api/strategy
Content-Type: application/json

{
  "action": "start",
  "attachments": [
    {
      "id": "abc123",
      "name": "resume.pdf",
      "type": "application/pdf",
      "size": 245000,
      "content": "data:application/pdf;base64,..."
    }
  ]
}
```

**Response**: Server-Sent Events stream

### Process Intake Input

```http
POST /api/strategy
Content-Type: application/json

{
  "action": "input",
  "sessionId": "strategy_user123_1706198400000",
  "input": "My main constraint is budget - only $5000 available"
}
```

### Execute Strategy

```http
POST /api/strategy
Content-Type: application/json

{
  "action": "execute",
  "sessionId": "strategy_user123_1706198400000"
}
```

**Response**: Server-Sent Events stream with progress updates

### Add Mid-Execution Context / Steering Command

```http
POST /api/strategy
Content-Type: application/json

{
  "action": "context",
  "sessionId": "strategy_user123_1706198400000",
  "message": "Stop researching housing, focus on career options"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Redirecting all resources to \"career options\". Other domains will be deprioritized.",
  "sessionId": "strategy_user123_1706198400000",
  "steeringApplied": true,
  "steeringAction": "focus_domain"
}
```

If the message is not a recognized steering command, it's stored as additional context:

```json
{
  "success": true,
  "message": "Context added successfully",
  "sessionId": "strategy_user123_1706198400000",
  "steeringApplied": false
}
```

### Cancel Strategy

```http
DELETE /api/strategy?sessionId=strategy_user123_1706198400000
```

### Get Session Status

```http
GET /api/strategy?sessionId=strategy_user123_1706198400000
```

### Get Session with Artifacts

```http
GET /api/strategy?sessionId=strategy_user123_1706198400000&includeArtifacts=true
```

**Response includes:**

```json
{
  "sessionId": "...",
  "phase": "complete",
  "result": { "..." },
  "artifacts": [
    {
      "id": "uuid",
      "type": "csv",
      "title": "Comparison Table",
      "fileName": "comparison_abc12345.csv",
      "mimeType": "text/csv",
      "sizeBytes": 2048,
      "contentText": "Header1,Header2\nVal1,Val2\n..."
    },
    {
      "id": "uuid",
      "type": "chart",
      "title": "Options Comparison Chart",
      "fileName": "chart_abc12345.png",
      "mimeType": "image/png",
      "sizeBytes": 45000,
      "contentBase64": "iVBORw0KGgo..."
    }
  ]
}
```

---

## Stream Events

| Event Type            | Description                             |
| --------------------- | --------------------------------------- |
| `intake_start`        | Intake process begins, initial question |
| `intake_question`     | Follow-up question during intake        |
| `intake_complete`     | Intake finished, problem synthesized    |
| `architect_designing` | Opus 4.5 designing agent blueprints     |
| `agent_spawned`       | New agent created                       |
| `agent_progress`      | Agent reporting progress                |
| `agent_complete`      | Agent finished with findings            |
| `agent_failed`        | Agent encountered error                 |
| `search_executing`    | Brave Search query running              |
| `search_complete`     | Search results received                 |
| `browser_visiting`    | Puppeteer visiting a URL                |
| `screenshot_captured` | Screenshot taken of a web page          |
| `vision_analyzing`    | Claude Vision analyzing screenshot      |
| `table_extracted`     | Table extracted from screenshot         |
| `form_filling`        | Safe form being filled                  |
| `paginating`          | Navigating through paginated results    |
| `scrolling`           | Handling infinite scroll page           |
| `pdf_extracting`      | Extracting text from PDF                |
| `comparing`           | Comparing multiple screenshots          |
| `code_executing`      | Python/JS code running in E2B sandbox   |
| `finding_discovered`  | New insight found                       |
| `quality_check`       | QC validating findings                  |
| `quality_issue`       | QC found a problem                      |
| `synthesis_start`     | Final synthesis beginning               |
| `synthesis_progress`  | Synthesis progress update               |
| `strategy_complete`   | Full strategy delivered                 |
| `user_context_added`  | User added mid-execution context        |
| `error`               | Error occurred                          |
| `kill_switch`         | Limit exceeded, emergency stop          |

---

## Output Format

### StrategyOutput

```typescript
interface StrategyOutput {
  recommendation: {
    title: string; // "Recommended Strategy: [Title]"
    summary: string; // Executive summary (2-3 paragraphs)
    confidence: number; // 0-100 confidence score
    riskLevel: 'low' | 'medium' | 'high';
  };

  analysis: {
    problem: string; // Synthesized problem statement
    findings: Finding[]; // All discovered insights
    tradeoffs: Tradeoff[]; // Pros/cons of different approaches
  };

  actionPlan: {
    immediate: ActionItem[]; // Do this week
    shortTerm: ActionItem[]; // Do this month
    longTerm: ActionItem[]; // Do this quarter
  };

  metadata: {
    executionTime: number; // Total time in ms
    totalAgents: number; // Agents deployed
    totalSearches: number; // Web searches conducted
    totalCost: number; // API cost in USD
    confidenceScore: number; // Overall confidence
    completedAt: number; // Timestamp
    modelUsage: {
      opus: { calls: number; tokens: number };
      sonnet: { calls: number; tokens: number };
      haiku: { calls: number; tokens: number };
    };
  };
}
```

---

## Access Control

### Current Status: Admin-Only Testing

The Deep Strategy Agent is currently in admin-only testing mode. Users without admin access will see:

```json
{
  "error": "Admin access required",
  "message": "Deep Strategy Agent is currently in admin-only testing mode."
}
```

### Future Pricing (Planned)

| Tier       | Access    | Est. Price |
| ---------- | --------- | ---------- |
| Free       | None      | -          |
| Pro        | 2/month   | Included   |
| Business   | 10/month  | Included   |
| Enterprise | Unlimited | Custom     |

---

## File Structure

```
src/agents/strategy/
├── index.ts              # Public exports (all modules + types)
├── types.ts              # Type definitions (agent, knowledge, steering, artifacts)
├── constants.ts          # Configuration & safety rules
├── StrategyAgent.ts      # Main orchestrator (wires all features)
├── ForensicIntake.ts     # Intake interview system (Opus 4.5)
├── MasterArchitect.ts    # Agent army designer (Opus 4.5)
├── QualityControl.ts     # Finding validation (Opus 4.5)
├── Scout.ts              # Research scouts (Haiku 4.5) with tool calling
├── ExecutionQueue.ts     # Rate-limited batch execution queue
│
│   Enhancement Modules (cross-session learning + real-time control)
├── KnowledgeBase.ts      # Persistent memory — store/query findings via tsvector
├── PerformanceTracker.ts # Scout learning — track metrics, feed to architect
├── SteeringEngine.ts     # Real-time control — parse commands, kill/spawn scouts
├── ArtifactGenerator.ts  # Auto-deliverables — CSV, reports, charts via E2B
│
│   Prompt System (multi-mode architecture)
├── prompts/
│   ├── types.ts          # PromptSet interface (7 prompt fields)
│   ├── strategy.ts       # Deep Strategy prompts
│   ├── research.ts       # Deep Research prompts
│   └── index.ts          # Mode selector (getPrompts, getAvailableModes)
│
└── tools/                # Research tool implementations (14 tools)
    ├── index.ts          # Tool exports
    ├── types.ts          # Tool type definitions
    ├── braveSearch.ts    # Brave Search API integration
    ├── e2bBrowser.ts     # Core Puppeteer browser operations
    ├── e2bBrowserEnhanced.ts  # Safe form fill, pagination, infinite scroll
    ├── e2bCode.ts        # Python/JS code execution (used by ArtifactGenerator)
    ├── visionAnalysis.ts # Claude Vision screenshot analysis
    ├── comparisonTable.ts # Comparison table generator
    ├── safety.ts         # Browser safety framework
    └── executor.ts       # Tool execution & cost tracking

src/components/chat/DeepStrategy/
├── index.ts                  # Component exports
├── DeepStrategyButton.tsx    # Launch button
├── DeepStrategyModal.tsx     # Upload, tech overview & confirm modal
├── DeepStrategyProgress.tsx  # Real-time progress UI
├── BrowserPreviewWindow.tsx  # Futuristic mini-browser with live activity
└── ResearchActivityFeed.tsx  # Activity log (searches, visits, screenshots)

src/hooks/
└── useDeepStrategy.ts    # React hook for state management

app/api/strategy/
└── route.ts              # API endpoints (SSE streaming, steering, artifacts)

supabase/migrations/
└── 20260128_add_knowledge_base_and_performance.sql
                          # Tables: knowledge_base, scout_performance, strategy_artifacts
```

---

## Best Practices

### For Users

1. **Provide Rich Context** — The more detail in intake, the better the strategy
2. **Upload Documents** — Relevant documents dramatically improve results
3. **Use Mid-Execution Messaging** — Add forgotten details as you remember them
4. **Be Patient** — Complex strategies take 2-5 minutes for full analysis

### For Developers

1. **Handle SSE Properly** — Use streaming response parsing, not regular fetch
2. **Implement Graceful Degradation** — Always handle partial results
3. **Respect Rate Limits** — The queue system handles this automatically
4. **Monitor Costs** — Check `metadata.totalCost` in production

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture overview
- [API.md](./API.md) — Full API reference
- [SECURITY.md](./SECURITY.md) — Security implementation details

---

## Development Notes & Changelog

### 2026-01-28: Audit Fixes & Tool Type Expansion

**Issue:** `ScoutToolType` in `types.ts` only included 4 tools (`brave_search`, `browser_visit`, `run_code`, `screenshot`), but 13 tools were actually implemented. The `MasterArchitect.normalizeTools()` method was silently stripping all enhanced tools from scout blueprints.

**Fix Applied:**

- Expanded `ScoutToolType` to include all 13 tools:
  - Core: `brave_search`, `browser_visit`, `run_code`, `screenshot`
  - Vision: `vision_analyze`, `extract_table`, `compare_screenshots`
  - Interactive: `safe_form_fill`, `paginate`, `infinite_scroll`, `click_navigate`
  - Document: `extract_pdf`
  - Data: `generate_comparison`
- Updated `MasterArchitect.normalizeTools()` to accept all 13 tools
- Added `comparison_table` to `OutputFormat` type (used in prompts but was missing from type)
- Updated `MasterArchitect.normalizeOutputFormat()` to accept `comparison_table`

**Files Modified:**

- `src/agents/strategy/types.ts:138-152` — Added 9 new tool types + `comparison_table` output format
- `src/agents/strategy/MasterArchitect.ts:268-277` — Updated `validTools` array
- `src/agents/strategy/MasterArchitect.ts:303-313` — Updated `valid` output formats

**CSRF & Rate Limiting Fixes:**

Added CSRF protection and rate limiting to conversation endpoints that were missing them:

- `app/api/conversations/[id]/messages/route.ts` — POST, PATCH, DELETE now have CSRF
- `app/api/conversations/[id]/messages/regenerate/route.ts` — POST now has CSRF
- `app/api/conversations/[id]/folder/route.ts` — PATCH now has CSRF + rate limiting
- `app/api/conversations/[id]/process-pending/route.ts` — POST now has CSRF + rate limiting

**Test Status:** All 1877 tests passing across 60 test files.

### Testing Routes

To verify the strategy tools are working:

```bash
# Test all E2B tools
curl http://localhost:3000/api/strategy/test-tools

# Test SSE events (returns mock stream)
curl http://localhost:3000/api/strategy/test-events

# Test full strategy flow
curl http://localhost:3000/api/strategy/test
```

### Key Integration Points

When resuming development:

1. **Strategy Agent Entry Point:** `app/api/strategy/route.ts`
2. **Agent Orchestration:** `src/agents/strategy/StrategyAgent.ts`
3. **Scout Execution:** `src/agents/strategy/Scout.ts`
4. **Tool Definitions:** `src/agents/strategy/tools/executor.ts:getClaudeToolDefinitions()`
5. **UI Components:** `src/components/chat/DeepStrategy/`
6. **React Hook:** `src/hooks/useDeepStrategy.ts`
