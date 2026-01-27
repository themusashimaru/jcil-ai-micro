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

Deep Strategy agents have access to powerful research tools:

- **Brave Search API** — Hundreds of real-time web searches
- **Puppeteer Browser** — Visits actual websites, extracts rendered content from JavaScript-heavy pages
- **Screenshots** — Captures visual snapshots of web pages for analysis
- **Code Execution** — Python/JS sandbox (E2B) for data processing and analysis

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

### Phase 4: Live Research Activity Feed

Watch the AI at work with a real-time activity feed showing:

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

### Phase 5: Mid-Execution Messaging

Users can add context while the strategy is running (like Claude Code's interrupt):

```
┌─────────────────────────────────────────────┐
│  💬 Add more context while running:          │
│  ┌─────────────────────────────────────────┐ │
│  │ I forgot to mention we have a partner   │ │
│  │ in Japan who might help...        [Send]│ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  Added context:                             │
│  • "Budget actually flexible up to $50k"    │
│  • "Timeline extended to 6 months"          │
└─────────────────────────────────────────────┘
```

### Phase 6: Final Output

The strategy is delivered with:

- **Executive Summary** — Key recommendation in 2-3 sentences
- **Detailed Analysis** — Full breakdown with evidence
- **Action Items** — Prioritized steps with timeframes
- **Risk Assessment** — Potential challenges and mitigations
- **Sources** — All web research cited with links

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

## Safety & Limits

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

### Add Mid-Execution Context

```http
POST /api/strategy
Content-Type: application/json

{
  "action": "context",
  "sessionId": "strategy_user123_1706198400000",
  "message": "I forgot to mention we have connections in the industry"
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
├── index.ts              # Public exports
├── types.ts              # Type definitions
├── constants.ts          # Configuration & prompts (inc. safety rules)
├── StrategyAgent.ts      # Main orchestrator
├── ForensicIntake.ts     # Intake interview system
├── MasterArchitect.ts    # Opus 4.5 architect
├── QualityControl.ts     # Finding validation
├── Scout.ts              # Haiku 4.5 scouts with tool calling
├── ExecutionQueue.ts     # Rate-limited queue
└── tools/                # Research tool implementations
    ├── index.ts          # Tool exports
    ├── types.ts          # Tool type definitions
    ├── braveSearch.ts    # Brave Search API integration
    ├── e2bBrowser.ts     # Puppeteer in E2B sandbox
    ├── e2bCode.ts        # Python/JS code execution
    └── executor.ts       # Tool execution & cost tracking

src/components/chat/DeepStrategy/
├── index.ts                  # Component exports
├── DeepStrategyButton.tsx    # Launch button
├── DeepStrategyModal.tsx     # Upload, tech overview & confirm modal
├── DeepStrategyProgress.tsx  # Real-time progress UI
└── ResearchActivityFeed.tsx  # Live activity feed (searches, visits)

src/hooks/
└── useDeepStrategy.ts    # React hook for state management

src/app/api/strategy/
└── route.ts              # API endpoints (SSE streaming, persistence)
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
