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

---

## Advanced AI Capabilities

The Deep Strategy Agent includes cutting-edge AI features that push the boundaries of what's possible with autonomous agents. These advanced capabilities are implemented in the `src/agents/strategy/advanced/` module.

### 1. Meta-Cognitive Reflection Engine

**File:** `src/agents/strategy/ReflectionEngine.ts`

The Reflection Engine enables the AI to analyze its own reasoning process—a form of "thinking about thinking" that improves decision quality.

**Capabilities:**

- **Assumption Identification** — Detects implicit assumptions in analysis
- **Bias Detection** — Identifies cognitive biases (confirmation, anchoring, availability, overconfidence)
- **Logic Gap Analysis** — Finds missing reasoning steps or logical leaps
- **Meta-Observations** — Higher-level patterns in the reasoning process

**Key Types:**

```typescript
interface ReflectionResult {
  assumptions: Assumption[]; // Implicit assumptions found
  biases: BiasDetection[]; // Detected cognitive biases
  logicGaps: LogicGap[]; // Missing reasoning steps
  metaObservations: MetaObservation[]; // Higher-level patterns
  overallQuality: number; // 0-1 reasoning quality score
  recommendations: string[]; // Suggestions for improvement
}

type BiasType =
  | 'confirmation' // Seeking confirming evidence
  | 'anchoring' // Over-relying on first information
  | 'availability' // Overweighting easily recalled info
  | 'overconfidence' // Excessive certainty
  | 'sunk_cost' // Continuing due to past investment
  | 'framing' // Influenced by how info is presented
  | 'groupthink' // Conforming to perceived consensus
  | 'recency' // Overweighting recent events
  | 'other';
```

**Usage:**

```typescript
import { createReflectionEngine } from '@/agents/strategy/advanced';

const reflection = createReflectionEngine(anthropicClient, onStream);
const result = await reflection.reflect({
  findings: strategyFindings,
  reasoning: synthesisReasoning,
  context: problemContext,
});

// Result includes identified assumptions, biases, and improvement suggestions
```

### 2. Adversarial Verification Layer

**File:** `src/agents/strategy/AdversarialVerifier.ts`

The Adversarial Verifier acts as a "devil's advocate" that challenges the AI's own conclusions, identifying weaknesses before they reach the user.

**Capabilities:**

- **Counter-Argument Generation** — Creates strongest opposing arguments
- **Contradiction Detection** — Finds internal inconsistencies
- **Stress Testing** — Tests conclusions under extreme scenarios
- **Multi-Perspective Analysis** — Views from skeptic, optimist, expert, layperson

**Key Types:**

```typescript
interface AdversarialResult {
  counterArguments: CounterArgument[];
  contradictions: Contradiction[];
  stressTestResults: StressTestResult[];
  perspectives: Perspective[];
  devilsAdvocate: DevilsAdvocateAssessment;
  verdict: VerificationVerdict;
}

interface VerificationVerdict {
  robust: boolean; // Did it survive adversarial testing?
  confidenceAdjustment: number; // How much to adjust confidence (-0.5 to +0.5)
  criticalFlaws: string[]; // Fundamental issues found
  suggestedRevisions: string[]; // Recommended changes
}
```

**Usage:**

```typescript
import { createAdversarialVerifier } from '@/agents/strategy/advanced';

const verifier = createAdversarialVerifier(anthropicClient, onStream);
const result = await verifier.verify({
  conclusion: strategyRecommendation,
  evidence: supportingFindings,
  context: problemStatement,
});

// If !result.verdict.robust, revise the conclusion
```

### 3. Knowledge Graph System

**File:** `src/agents/strategy/KnowledgeGraph.ts`

The Knowledge Graph creates structured representations of entities and relationships, enabling sophisticated reasoning that goes beyond text similarity.

**Capabilities:**

- **Entity Extraction** — Identifies people, organizations, concepts, events
- **Relationship Mapping** — Discovers connections between entities
- **Cluster Analysis** — Groups related entities for insight
- **Graph Queries** — Path finding, subgraph extraction, pattern matching
- **Persistence** — Stores graphs in Supabase for cross-session learning

**Key Types:**

```typescript
interface Entity {
  id: string;
  name: string;
  type: EntityType; // person | organization | concept | event | location | product | technology
  properties: Record<string, unknown>;
  confidence: number;
  sources: string[];
}

interface Relationship {
  id: string;
  source: string; // Entity ID
  target: string; // Entity ID
  type: RelationshipType; // causes | enables | competes_with | part_of | influences | etc.
  strength: number; // 0-1
  properties: Record<string, unknown>;
}

interface GraphQuery {
  type: 'path' | 'neighbors' | 'subgraph' | 'pattern';
  startEntity?: string;
  endEntity?: string;
  maxDepth?: number;
  relationshipTypes?: RelationshipType[];
  entityTypes?: EntityType[];
}
```

**Usage:**

```typescript
import { createKnowledgeGraph } from '@/agents/strategy/advanced';

const graph = createKnowledgeGraph(anthropicClient, userId, sessionId, onStream);

// Extract entities and relationships from findings
const extraction = await graph.extractFromFindings(strategyFindings);

// Query the graph
const paths = await graph.query({
  type: 'path',
  startEntity: 'company_a',
  endEntity: 'market_trend_1',
  maxDepth: 4,
});

// Get graph statistics
const stats = graph.getStatistics();
// { entityCount, relationshipCount, clusterCount, density, avgDegree }
```

### 4. Causal Reasoning Engine

**File:** `src/agents/strategy/CausalReasoningEngine.ts`

The Causal Reasoning Engine implements Pearl's causal inference framework to distinguish correlation from causation and identify intervention points.

**Capabilities:**

- **Causal Graph Construction** — Builds cause-effect networks
- **Root Cause Analysis** — Traces effects back to underlying causes
- **Counterfactual Analysis** — "What if X hadn't happened?"
- **Intervention Planning** — Identifies best points to intervene
- **Confounder Detection** — Finds hidden variables affecting relationships

**Key Types:**

```typescript
interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  confounders: Confounder[];
  interventionPoints: InterventionPoint[];
}

interface CausalEdge {
  source: string;
  target: string;
  mechanism: string; // How cause produces effect
  strength: number; // 0-1 causal strength
  confidence: number; // 0-1 confidence in causal relationship
  timelag?: string; // e.g., "2 weeks", "immediate"
  necessary: boolean; // Is this cause necessary for effect?
  sufficient: boolean; // Is this cause sufficient for effect?
}

interface CounterfactualAnalysis {
  scenario: string; // "What if X hadn't happened?"
  predictedOutcome: string;
  confidence: number;
  assumptions: string[];
  caveats: string[];
}
```

**Usage:**

```typescript
import { createCausalReasoningEngine } from '@/agents/strategy/advanced';

const causal = createCausalReasoningEngine(anthropicClient, onStream);

// Build causal graph from findings
const graph = await causal.buildCausalGraph({
  findings: strategyFindings,
  domain: 'market_analysis',
});

// Analyze root causes
const rootCauses = await causal.analyzeRootCauses({
  effect: 'declining_sales',
  graph: graph,
  maxDepth: 5,
});

// Run counterfactual analysis
const counterfactual = await causal.runCounterfactual({
  graph: graph,
  intervention: 'remove_competitor_entry',
  targetOutcome: 'market_share',
});
```

### 5. Predictive Simulation Engine

**File:** `src/agents/strategy/PredictiveSimulator.ts`

The Predictive Simulator enables scenario modeling, Monte Carlo simulation, and what-if analysis for strategic planning.

**Capabilities:**

- **Scenario Generation** — Creates multiple future scenarios
- **What-If Analysis** — Explores hypothetical changes
- **Sensitivity Analysis** — Identifies which variables matter most
- **Decision Trees** — Models decision paths with probabilities
- **Monte Carlo Simulation** — Runs thousands of iterations

**Key Types:**

```typescript
interface Scenario {
  id: string;
  name: string;
  description: string;
  probability: number;
  variables: ScenarioVariable[];
  timeline: TimelineEvent[];
  outcomes: Outcome[];
  risks: ScenarioRisk[];
}

interface WhatIfQuery {
  hypothesis: string; // "What if we enter the Asian market?"
  variables: { name: string; value: unknown }[];
  timeHorizon: string; // "6 months", "2 years"
  metrics: string[]; // What to measure
}

interface SensitivityAnalysis {
  variable: string;
  baseValue: unknown;
  range: { min: unknown; max: unknown };
  impactOnOutcome: number; // -1 to +1
  criticalThreshold?: unknown;
}

interface DecisionTree {
  root: DecisionNode;
  expectedValue: number;
  bestPath: string[]; // Node IDs for optimal decisions
  worstPath: string[];
}
```

**Usage:**

```typescript
import { createPredictiveSimulator } from '@/agents/strategy/advanced';

const simulator = createPredictiveSimulator(anthropicClient, onStream);

// Generate scenarios
const scenarios = await simulator.generateScenarios({
  context: problemContext,
  variables: marketVariables,
  count: 5,
  timeHorizon: '1 year',
});

// Run what-if analysis
const whatIf = await simulator.whatIf({
  hypothesis: 'What if we doubled our marketing budget?',
  variables: [{ name: 'marketing_spend', value: 2000000 }],
  timeHorizon: '6 months',
  metrics: ['revenue', 'market_share', 'brand_awareness'],
});

// Build decision tree
const tree = await simulator.buildDecisionTree({
  decisions: strategicOptions,
  outcomes: possibleOutcomes,
  probabilities: estimatedProbabilities,
});
```

### 6. Multi-Modal Document Analyzer

**File:** `src/agents/strategy/DocumentAnalyzer.ts`

The Document Analyzer provides sophisticated understanding of images, PDFs, and tables using Claude's vision capabilities.

**Capabilities:**

- **Document Type Detection** — Identifies financial reports, contracts, charts, etc.
- **Table Extraction** — Parses tables from images and PDFs
- **Chart Data Extraction** — Extracts underlying data from visualizations
- **Entity Extraction** — Identifies people, organizations, dates, amounts
- **Cross-Document Comparison** — Compares multiple documents

**Key Types:**

```typescript
interface DocumentAnalysis {
  id: string;
  documentType: DocumentType; // financial_report | contract | chart | table | presentation | etc.
  metadata: DocumentMetadata;
  structuredData: StructuredData;
  tables: ExtractedTable[];
  images: ExtractedImage[];
  entities: DocumentEntity[];
  summary: string;
  confidence: number;
}

interface ExtractedTable {
  id: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  pageNumber?: number;
  confidence: number;
}

interface ChartDataExtraction {
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'other';
  title: string;
  xAxis: { label: string; values: (string | number)[] };
  yAxis: { label: string; values: number[] };
  series: { name: string; data: number[] }[];
  dataPoints: { x: string | number; y: number; series?: string }[];
}
```

**Usage:**

```typescript
import { createDocumentAnalyzer } from '@/agents/strategy/advanced';

const analyzer = createDocumentAnalyzer(anthropicClient, onStream);

// Analyze a document
const analysis = await analyzer.analyze({
  content: base64ImageOrPdf,
  mimeType: 'application/pdf',
  extractTables: true,
  extractCharts: true,
});

// Extract chart data from an image
const chartData = await analyzer.extractChartData({
  content: base64ChartImage,
  chartType: 'bar',
});

// Compare multiple documents
const comparison = await analyzer.compareDocuments([doc1, doc2, doc3]);
```

### 7. Adaptive Model Router

**File:** `src/agents/strategy/AdaptiveModelRouter.ts`

The Adaptive Model Router intelligently selects the optimal Claude model for each task based on complexity, cost, and performance requirements.

**Capabilities:**

- **Task Profiling** — Analyzes task complexity and requirements
- **Model Scoring** — Scores models based on task fit
- **Performance Learning** — Improves routing based on outcomes
- **Cost Optimization** — Balances quality with API costs
- **Batch Routing** — Routes multiple tasks optimally

**Key Types:**

```typescript
interface TaskProfile {
  taskId: string;
  taskType: TaskType; // analysis | extraction | summarization | classification | etc.
  complexity: ComplexityLevel; // trivial | simple | moderate | complex | extreme
  requiredCapabilities: Capability[]; // reasoning | creativity | precision | speed | vision | code | etc.
  inputSize: 'small' | 'medium' | 'large' | 'very_large';
  urgency: 'critical' | 'high' | 'normal' | 'low';
  costSensitivity: 'high' | 'medium' | 'low';
  qualityRequirement: 'best' | 'good' | 'acceptable';
}

interface RoutingDecision {
  taskId: string;
  selectedModel: ModelTier; // opus | sonnet | haiku
  modelId: string;
  confidence: number;
  reasoning: string[];
  estimatedCost: number;
  estimatedLatency: 'fast' | 'medium' | 'slow';
  alternatives: { model: ModelTier; score: number; tradeoff: string }[];
}
```

**Model Capabilities:**

| Model      | Best For                         | Speed | Quality | Cost Efficiency |
| ---------- | -------------------------------- | ----- | ------- | --------------- |
| Opus 4.5   | Complex reasoning, extreme tasks | ★★☆☆  | ★★★★★   | ★★☆☆☆           |
| Sonnet 4.5 | Balanced tasks, most use cases   | ★★★★☆ | ★★★★☆   | ★★★★☆           |
| Haiku 4.5  | Fast extraction, simple tasks    | ★★★★★ | ★★★☆☆   | ★★★★★           |

**Usage:**

```typescript
import { createAdaptiveModelRouter } from '@/agents/strategy/advanced';

const router = createAdaptiveModelRouter({
  defaultModel: 'sonnet',
  costBudget: 5.0,
  preferQuality: true,
  learningEnabled: true,
});

// Route a single task
const decision = router.route({
  taskId: 'analysis_1',
  taskType: 'analysis',
  complexity: 'complex',
  requiredCapabilities: ['reasoning', 'synthesis'],
  inputSize: 'large',
  urgency: 'normal',
  costSensitivity: 'medium',
  qualityRequirement: 'best',
});

// Record performance for learning
router.recordPerformance({
  taskId: 'analysis_1',
  taskType: 'analysis',
  modelUsed: 'opus',
  inputTokens: 5000,
  outputTokens: 2000,
  latencyMs: 8500,
  success: true,
  qualityScore: 0.95,
  cost: 0.12,
  timestamp: Date.now(),
});
```

### 8. Full Audit Trail & Explainability

**File:** `src/agents/strategy/AuditTrail.ts`

The Audit Trail provides comprehensive logging and explainability for all AI decisions, enabling transparency and debugging.

**Capabilities:**

- **Decision Logging** — Records every significant AI decision
- **Reasoning Chains** — Captures step-by-step reasoning
- **Data Flow Tracking** — Shows how data moves through the system
- **Explainability Reports** — Human-readable decision explanations
- **Audit Queries** — Search and filter audit events

**Key Types:**

```typescript
interface AuditEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: AuditEventType; // decision | tool_use | model_call | error | finding | etc.
  timestamp: number;
  component: string; // Which module generated this
  action: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  reasoning?: string;
  modelUsed?: ModelTier;
  tokenUsage?: { input: number; output: number };
  cost?: number;
  duration?: number;
  parentEventId?: string; // For nested events
}

interface DecisionExplanation {
  decision: string;
  reasoning: ReasoningChain;
  alternatives: { option: string; whyNotChosen: string }[];
  confidence: number;
  keyFactors: string[];
  assumptions: string[];
  limitations: string[];
}

interface ExplainabilityReport {
  sessionId: string;
  executiveSummary: string;
  keyDecisions: DecisionExplanation[];
  dataFlow: DataFlowNode[];
  modelUsage: { model: ModelTier; calls: number; tokens: number; cost: number }[];
  timeline: { timestamp: number; event: string }[];
  recommendations: string[];
}
```

**Usage:**

```typescript
import { createAuditTrail } from '@/agents/strategy/advanced';

const audit = createAuditTrail(sessionId, userId, { persistToDb: true });

// Log events throughout execution
audit.logEvent({
  eventType: 'decision',
  component: 'MasterArchitect',
  action: 'designed_agent_army',
  inputs: { problemSynthesis },
  outputs: { agentBlueprints },
  reasoning: 'Selected specialized agents based on problem domains',
});

// Generate explainability report
const report = await audit.generateReport();

// Query audit events
const decisions = await audit.query({
  eventTypes: ['decision'],
  component: 'QualityControl',
  startTime: sessionStartTime,
});
```

### 9. Advanced Puppeteer with Anti-Detection

**File:** `src/agents/strategy/tools/AdvancedPuppeteer.ts`

The Advanced Puppeteer provides enhanced browser automation with proxy support, fingerprint masking, and anti-detection capabilities for reliable web scraping.

**Capabilities:**

- **Proxy Rotation** — Cycles through proxy servers to avoid blocks
- **User Agent Rotation** — Randomizes browser fingerprints
- **Anti-Detection Scripts** — Evades bot detection systems
- **Rate Limiting** — Respects website limits with random delays
- **Session Management** — Maintains browser state across requests
- **Safety Checks** — Blocks sensitive form fields and dangerous actions

**Key Types:**

```typescript
interface BrowserConfig {
  proxyEnabled: boolean;
  proxies: ProxyConfig[];
  userAgentRotation: boolean;
  antiDetectionLevel: 'none' | 'basic' | 'standard' | 'advanced';
  requestDelay: { min: number; max: number }; // Random delay between requests
  timeout: number;
}

interface ProxyServer {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string;
  country?: string;
}

interface FingerprintProfile {
  userAgent: string;
  viewport: { width: number; height: number };
  timezone: string;
  locale: string;
  platform: string;
}

interface PageResult {
  url: string;
  title: string;
  content: string;
  screenshot?: string; // Base64
  cookies: BrowserCookie[];
  timing: { dns: number; connect: number; ttfb: number; load: number };
}
```

**Anti-Detection Levels:**

| Level    | Features                                 | Use Case               |
| -------- | ---------------------------------------- | ---------------------- |
| none     | No anti-detection                        | Trusted/internal sites |
| basic    | Hide webdriver property                  | Simple bot detection   |
| standard | + Mock plugins, languages, permissions   | Medium security sites  |
| advanced | + Full fingerprint masking, canvas noise | High security sites    |

**Safety Features:**

- **Blocked Form Fields:** password, credit card, CVV, SSN, bank account, API keys
- **Domain Restrictions:** .gov, .mil, banking login pages, adult content
- **Rate Limits:** Per-domain page limits, action delays

**Usage:**

```typescript
import { createAdvancedPuppeteer } from '@/agents/strategy/advanced';

const browser = createAdvancedPuppeteer({
  proxyEnabled: true,
  proxies: [
    { host: 'proxy1.example.com', port: 8080, protocol: 'http' },
    { host: 'proxy2.example.com', port: 8080, protocol: 'http' },
  ],
  antiDetectionLevel: 'standard',
  requestDelay: { min: 1000, max: 3000 },
  timeout: 30000,
});

// Navigate with anti-detection
const result = await browser.navigate('https://example.com', {
  waitFor: 'networkidle2',
  screenshot: true,
});

// Take screenshot
const screenshot = await browser.screenshot('https://example.com/pricing');

// Fill safe form (search/filter only - login/payment blocked)
const formResult = await browser.fillForm(
  'https://example.com/search',
  { query: 'market research', category: 'reports' },
  'button[type="submit"]'
);
```

---

### Advanced Features Integration

All advanced features are exported from a central module for easy integration:

```typescript
// Import all advanced features
import {
  // Meta-cognitive Reflection
  createReflectionEngine,
  type ReflectionResult,

  // Adversarial Verification
  createAdversarialVerifier,
  type AdversarialResult,

  // Knowledge Graph
  createKnowledgeGraph,
  type Entity,
  type Relationship,

  // Causal Reasoning
  createCausalReasoningEngine,
  type CausalGraph,

  // Predictive Simulation
  createPredictiveSimulator,
  type Scenario,
  type WhatIfResult,

  // Document Analysis
  createDocumentAnalyzer,
  type DocumentAnalysis,

  // Adaptive Model Routing
  createAdaptiveModelRouter,
  type RoutingDecision,

  // Audit Trail
  createAuditTrail,
  type AuditEvent,

  // Advanced Puppeteer
  createAdvancedPuppeteer,
  type BrowserConfig,
} from '@/agents/strategy/advanced';
```

---

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
│   Advanced AI Capabilities (cutting-edge features)
├── ReflectionEngine.ts   # Meta-cognitive reflection (AI thinking about thinking)
├── AdversarialVerifier.ts # Devil's advocate verification layer
├── KnowledgeGraph.ts     # Structured entity-relationship knowledge
├── CausalReasoningEngine.ts # Pearl's causal inference (cause-effect analysis)
├── PredictiveSimulator.ts # Scenario modeling, Monte Carlo, what-if analysis
├── DocumentAnalyzer.ts   # Multi-modal document understanding (vision AI)
├── AdaptiveModelRouter.ts # Smart model selection (opus/sonnet/haiku)
├── AuditTrail.ts         # Full decision logging and explainability
│
│   Advanced Module Exports
├── advanced/
│   └── index.ts          # Central export for all advanced features
│
│   Prompt System (multi-mode architecture)
├── prompts/
│   ├── types.ts          # PromptSet interface (7 prompt fields)
│   ├── strategy.ts       # Deep Strategy prompts
│   ├── research.ts       # Deep Research prompts
│   └── index.ts          # Mode selector (getPrompts, getAvailableModes)
│
│   Tests
├── __tests__/
│   └── advanced-features.test.ts  # Comprehensive tests for all 9 advanced features
│
└── tools/                # Research tool implementations (14+ tools)
    ├── index.ts          # Tool exports
    ├── types.ts          # Tool type definitions
    ├── braveSearch.ts    # Brave Search API integration
    ├── e2bBrowser.ts     # Core Puppeteer browser operations
    ├── e2bBrowserEnhanced.ts  # Safe form fill, pagination, infinite scroll
    ├── e2bCode.ts        # Python/JS code execution (used by ArtifactGenerator)
    ├── visionAnalysis.ts # Claude Vision screenshot analysis
    ├── comparisonTable.ts # Comparison table generator
    ├── safety.ts         # Browser safety framework
    ├── executor.ts       # Tool execution & cost tracking
    └── AdvancedPuppeteer.ts # Enhanced browser with proxies & anti-detection

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

### 2026-01-28: Advanced AI Capabilities (Major Feature Release)

**New Modules:** Added 9 cutting-edge AI capabilities to the Deep Strategy Agent:

1. **ReflectionEngine** (`ReflectionEngine.ts`)
   - Meta-cognitive reflection — AI analyzes its own reasoning
   - Identifies assumptions, cognitive biases, logic gaps
   - Provides reasoning quality scores and improvement suggestions

2. **AdversarialVerifier** (`AdversarialVerifier.ts`)
   - Devil's advocate verification layer
   - Generates counter-arguments, detects contradictions
   - Stress tests conclusions under extreme scenarios
   - Multi-perspective analysis (skeptic, optimist, expert, layperson)

3. **KnowledgeGraph** (`KnowledgeGraph.ts`)
   - Structured entity-relationship knowledge representation
   - Entity extraction from findings (person, org, concept, event, etc.)
   - Relationship mapping (causes, enables, competes_with, etc.)
   - Graph queries: path finding, subgraph extraction, pattern matching
   - Supabase persistence for cross-session learning

4. **CausalReasoningEngine** (`CausalReasoningEngine.ts`)
   - Pearl's causal inference framework
   - Builds causal graphs with cause-effect relationships
   - Root cause analysis — traces effects to underlying causes
   - Counterfactual analysis — "What if X hadn't happened?"
   - Intervention point identification

5. **PredictiveSimulator** (`PredictiveSimulator.ts`)
   - Scenario modeling with Monte Carlo simulation
   - What-if analysis for strategic planning
   - Sensitivity analysis — identifies which variables matter most
   - Decision tree construction with probability weighting

6. **DocumentAnalyzer** (`DocumentAnalyzer.ts`)
   - Multi-modal document understanding using Claude Vision
   - Document type detection (financial report, contract, chart, etc.)
   - Table extraction from images and PDFs
   - Chart data extraction — recovers underlying data from visualizations
   - Cross-document comparison

7. **AdaptiveModelRouter** (`AdaptiveModelRouter.ts`)
   - Smart model selection based on task complexity
   - Task profiling (type, complexity, urgency, cost sensitivity)
   - Model scoring and capability matching
   - Performance learning — improves routing based on outcomes
   - Cost optimization with quality balancing

8. **AuditTrail** (`AuditTrail.ts`)
   - Full decision logging and explainability
   - Reasoning chain recording with step-by-step transparency
   - Data flow tracking through the system
   - Explainability report generation
   - Audit queries and filtering

9. **AdvancedPuppeteer** (`tools/AdvancedPuppeteer.ts`)
   - Enhanced browser automation for reliable web scraping
   - Proxy rotation with multiple server support
   - User agent and fingerprint rotation
   - Anti-detection scripts (basic/standard/advanced levels)
   - Rate limiting with configurable delays
   - Safety checks blocking sensitive form fields

**New Files Created:**

- `src/agents/strategy/ReflectionEngine.ts`
- `src/agents/strategy/AdversarialVerifier.ts`
- `src/agents/strategy/KnowledgeGraph.ts`
- `src/agents/strategy/CausalReasoningEngine.ts`
- `src/agents/strategy/PredictiveSimulator.ts`
- `src/agents/strategy/DocumentAnalyzer.ts`
- `src/agents/strategy/AdaptiveModelRouter.ts`
- `src/agents/strategy/AuditTrail.ts`
- `src/agents/strategy/tools/AdvancedPuppeteer.ts`
- `src/agents/strategy/advanced/index.ts` (central export)
- `src/agents/strategy/__tests__/advanced-features.test.ts` (comprehensive tests)

**Test Status:** All tests passing. TypeScript and ESLint clean.

---

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
