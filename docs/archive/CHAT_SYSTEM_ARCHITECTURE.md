# JCIL AI Chat System Architecture

> Last Updated: February 1, 2026 at 22:30 UTC
> Branch: claude/evaluate-chat-tools-cDLQH
> Version: 3.1.0 (10 Major Enhancements + Security Suite)

## Overview

The JCIL AI chat system is the most capable AI chat ever built - a multi-provider, tool-enabled conversational AI platform built on Next.js. It features **153 fully wired tools** (378 total files), native Claude tool use, persistent workspaces, smart tool chaining, code memory, agentic workflows, and enterprise-grade reliability features.

**Latest Wiring (February 1, 2026 at 22:30 UTC):**

- ✅ `run_workflow` - Enhancement #3 (Smart Tool Chaining)
- ✅ `github_context` - Enhancement #4 (Repository Understanding)
- ✅ 32 Cybersecurity Tools - Full Security Operations Suite

## February 2026 Major Enhancements (10 Total)

This release includes 10 major enhancements that significantly expand the Chat's capabilities:

| #   | Enhancement                       | Description                                                   |
| --- | --------------------------------- | ------------------------------------------------------------- |
| 1   | **Real MCP Client**               | Live MCP server management replacing mock implementations     |
| 2   | **Persistent Workspace Sessions** | Conversation-aware E2B sandboxes with file persistence        |
| 3   | **Smart Tool Chaining**           | Predefined workflow templates for multi-step operations       |
| 4   | **GitHub Repo Context**           | Full GitHub repository understanding and code search          |
| 5   | **Multi-File Project View**       | File tree navigation with syntax highlighting                 |
| 6   | **Live Preview for Web Code**     | Sandboxed HTML/React preview with device presets              |
| 7   | **Conversation Memory for Code**  | Persistent code artifact storage with semantic search         |
| 8   | **Agentic Code Workflows**        | Trigger phrase detection ("ship it", "test everything")       |
| 9   | **Real-Time Code Streaming**      | File-by-file generation with progress tracking                |
| 10  | **Self-Improving Tools**          | Telemetry, failure pattern detection, improvement suggestions |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                                │
│  ChatClient.tsx → ChatComposer (message input)                  │
│  ├─ ProjectView (multi-file display)                            │
│  ├─ LivePreview (HTML/React preview)                            │
│  ├─ StreamingCodeOutput (real-time generation)                  │
│  └─ ChatMCPSettings (MCP server management)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ POST /api/chat
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MIDDLEWARE LAYER                              │
│  ├─ CSRF Validation                                             │
│  ├─ Authentication (Supabase JWT)                               │
│  ├─ Rate Limiting (500/hr search, 120/hr chat)                  │
│  └─ Queue Slot Acquisition                                      │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              CHAT ROUTER (routeChatWithTools)                   │
│  ├─ 371+ Tools (8 categories)                                   │
│  │   ├─ Code Development (8 tools)                              │
│  │   ├─ Cybersecurity (100+ tools)                              │
│  │   ├─ Science & Engineering (140+ tools)                      │
│  │   └─ Utilities & Media (100+ tools)                          │
│  ├─ Agentic Workflows (trigger phrases)                         │
│  ├─ Tool Chain Executor (smart chaining)                        │
│  ├─ GitHub Context (repo understanding)                         │
│  ├─ Code Memory (artifact persistence)                          │
│  ├─ Tool Telemetry (self-improvement)                           │
│  ├─ Dynamic tool creation (cost-limited)                        │
│  ├─ Streaming with tool loop                                    │
│  └─ 15s timeout per tool execution                              │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              WORKSPACE LAYER (NEW)                              │
│  ├─ Persistent E2B Sandboxes per conversation                   │
│  ├─ ContainerManager singleton                                  │
│  ├─ File persistence across turns                               │
│  └─ Real MCP Client integration                                 │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              MULTI-PROVIDER SYSTEM                              │
│  ├─ Primary: Claude Sonnet 4.6 (intelligent orchestration)      │
│  ├─ Fallback: xAI Grok                                          │
│  └─ API Key Pooling with rotation                               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Chat Route (`/app/api/chat/route.ts`)

The main orchestration file (~2800 lines) handling:

- Request validation and authentication
- Rate limiting (in-memory + Supabase)
- Tool executor setup with rate limiting
- Multiple routing paths (research, search, documents, chat)
- Memory extraction and pending request handling

**Key Constants:**

```typescript
RATE_LIMIT_AUTHENTICATED = 120; // requests/hour
RATE_LIMIT_ANONYMOUS = 30; // requests/hour
RATE_LIMIT_RESEARCH = 500; // searches/hour (Brave Pro)
MAX_CONTEXT_MESSAGES = 40; // messages before truncation
```

### 2. Chat Router (`/src/lib/ai/chat-router.ts`)

Provides two main functions:

**`routeChat()`** - Standard streaming chat

- Converts CoreMessage to UnifiedMessage
- Routes through provider service
- Returns ReadableStream

**`routeChatWithTools()`** - Tool-enabled chat

- Handles tool execution loop (max 5 iterations)
- Accumulates tool arguments from streaming
- Executes tools with timeout (15s)
- Sends keepalive pings during execution (10s interval)
- Returns tool usage metadata

### 3. Web Search Tool (`/src/lib/ai/tools/web-search.ts`)

Native Claude tool for web search:

```typescript
{
  name: 'web_search',
  description: 'Search the web for current information...',
  parameters: {
    query: string,      // Search query
    search_type: enum   // 'general' | 'news' | 'factcheck'
  }
}
```

**Executor Flow:**

1. Validate tool name and arguments
2. Check rate limit
3. Call Brave Search API
4. Format results with sources
5. Return to Claude for synthesis

### 4. Dynamic Tool Creation (`/src/lib/ai/tools/dynamic-tool.ts`)

Allows Sonnet to create custom tools on-the-fly when existing tools aren't sufficient:

```typescript
{
  name: 'create_and_run_tool',
  description: 'Create and execute a custom tool',
  parameters: {
    purpose: string,    // What the tool should accomplish
    code: string,       // Python code with main() function
    inputs: object      // Input values for the code
  }
}
```

**Cost Controls:**

- Max $0.15 per dynamic tool execution
- Max 3 dynamic tools per session
- 30 second timeout per execution
- Code validation (blocks dangerous patterns)
- Runs in isolated E2B sandbox

### 5. Workflow Tasks (`/src/lib/ai/tools/workflow-tasks.ts`)

Claude Code style todo lists for multi-step workflows:

```
┌─────────────────────────────────────────┐
│            Task Progress                │
├─────────────────────────────────────────┤
│ [x] Research competitor pricing         │
│ [>] Analyzing market data... analyzing  │
│ [ ] Create pricing model                │
│ [ ] Generate recommendations            │
└─────────────────────────────────────────┘
```

**Status Symbols:**

- `[ ]` - Pending
- `[>]` - In-progress (with intelligent status like "analyzing", "searching")
- `[x]` - Completed
- `[-]` - Skipped

### 6. YouTube Transcript Tool (`/src/lib/ai/tools/youtube-transcript.ts`)

Extracts transcripts from YouTube videos:

```typescript
{
  name: 'youtube_transcript',
  description: 'Extract transcript from YouTube video',
  parameters: {
    video_url: string,       // YouTube URL
    language: string,        // Language code (default: 'en')
    include_timestamps: boolean  // Include time markers
  }
}
```

**Features:**

- Supports youtube.com, youtu.be, and shorts URLs
- Auto-generated and manual captions
- Multi-language support
- No API key required (uses public YouTube API)

### 7. GitHub Tool (`/src/lib/ai/tools/github-tool.ts`)

Search and browse GitHub repositories:

```typescript
{
  name: 'github',
  description: 'Search and browse GitHub',
  parameters: {
    action: 'search_code' | 'search_repos' | 'get_file' | 'list_dir' | 'get_repo' | 'search_issues',
    query: string,      // For search actions
    owner: string,      // Repo owner
    repo: string,       // Repo name
    path: string,       // File/directory path
    branch: string      // Branch name
  }
}
```

**Rate Limits:**

- Without GITHUB_TOKEN: 60 requests/hour
- With GITHUB_TOKEN: 5000 requests/hour

### 8. Screenshot Tool (`/src/lib/ai/tools/screenshot-tool.ts`)

Capture screenshots of any webpage:

```typescript
{
  name: 'screenshot',
  description: 'Capture screenshot of webpage',
  parameters: {
    url: string,         // URL to screenshot
    full_page: boolean,  // Capture full scroll (default: false)
    width: number,       // Viewport width (default: 1280)
    height: number,      // Viewport height (default: 720)
    wait_for: string,    // CSS selector to wait for
    delay_ms: number     // Additional delay (default: 1000)
  }
}
```

**Implementation:**

- Uses E2B sandbox with Playwright
- Returns base64 PNG image
- 30 second timeout
- URL safety validation

### 9. Calculator Tool (`/src/lib/ai/tools/calculator-tool.ts`)

Advanced mathematical calculations:

```typescript
{
  name: 'calculator',
  description: 'Perform math calculations',
  parameters: {
    query: string,           // Math question/calculation
    include_steps: boolean   // Show step-by-step solution
  }
}
```

**Capabilities:**

- Arithmetic, algebra, calculus
- Unit conversions
- Statistical calculations
- Symbolic math (derivatives, integrals)
- Uses Wolfram Alpha API (with fallback)

### 10. Chart Tool (`/src/lib/ai/tools/chart-tool.ts`)

Generate data visualizations:

```typescript
{
  name: 'create_chart',
  description: 'Generate charts from data',
  parameters: {
    chart_type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter',
    title: string,
    labels: string[],     // X-axis or pie slice labels
    datasets: [{          // Data series
      label: string,
      data: number[],
      color: string
    }],
    width: number,        // Default: 600
    height: number        // Default: 400
  }
}
```

**Implementation:**

- Uses QuickChart.io API (serverless-compatible)
- Returns image URL
- Auto-styling with color palette
- Multiple dataset support

### 11. Document Tool (`/src/lib/ai/tools/document-tool.ts`)

Generate professional documents:

```typescript
{
  name: 'create_document',
  description: 'Generate PDF, DOCX, or TXT documents',
  parameters: {
    format: 'pdf' | 'docx' | 'txt',
    title: string,
    content: string,      // Markdown-formatted content
    author: string,
    sections: [{          // Optional structured sections
      heading: string,
      body: string
    }]
  }
}
```

**Libraries:**

- PDF: pdfkit
- DOCX: docx package
- Returns base64 data URL for download

### 12. Provider System (`/src/lib/ai/providers/`)

**Adapters:**

- `anthropic.ts` - Claude adapter with streaming tool support
- `openai-compatible.ts` - xAI/Grok/DeepSeek adapter

**Key Types:**

- `UnifiedMessage` - Provider-agnostic message format
- `UnifiedTool` - Tool definition format
- `UnifiedToolCall` - Tool invocation (arguments: string | Record)
- `UnifiedStreamChunk` - Streaming chunk types

## Tool Use Flow

```
1. User sends message
   ↓
2. routeChatWithTools() called with web_search tool
   ↓
3. Claude streams response
   ├─ Text chunks → streamed to client
   └─ tool_call_start → accumulate tool call
       ├─ tool_call_delta → accumulate JSON args
       └─ tool_call_end → parse args, add to pending
   ↓
4. If pending tool calls:
   ├─ Send status message (e.g., "*Searching the web...*")
   ├─ Start keepalive interval (8s) with elapsed time
   ├─ Execute each tool (15s timeout)
   ├─ Add results to conversation
   └─ Loop back to step 3
   ↓
5. No more tool calls → stream complete
```

## Rate Limiting

### Tiers

| Tier          | Chat Limit | Search Limit |
| ------------- | ---------- | ------------ |
| Authenticated | 120/hr     | 500/hr       |
| Anonymous     | 30/hr      | 500/hr       |
| Admin         | Unlimited  | Unlimited    |

### Implementation

- Primary: Supabase `rate_limits` table
- Fallback: In-memory Map (50k max entries)
- Cleanup: Every 5 minutes

## Error Handling

### Tool Execution

- 15 second timeout per tool
- Parse errors: Execute with `_parseError` flag
- Network errors: Return error result to Claude
- Rate limit: Return error result to Claude

### Streaming

- Keepalive status messages every 8s during tool execution
- Visible status like "_Searching the web..._ (8s)" for user feedback
- Connection abort detection
- Graceful stream closure

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=...
BRAVE_SEARCH_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional (with defaults)
RATE_LIMIT_AUTH=120
RATE_LIMIT_ANON=30
RATE_LIMIT_RESEARCH=500
DEFAULT_AI_PROVIDER=claude
FALLBACK_AI_PROVIDER=xai
```

## Recent Changes

### February 1, 2026 - 10 Major Enhancements

**Enhancement 1: Real MCP Client**

- Modified `/app/api/chat/mcp/route.ts` with live MCPClientManager
- Real server start/stop/call functionality
- Health monitoring integration

**Enhancement 2: Persistent Workspace Sessions**

- Enhanced `/src/lib/ai/tools/workspace-tool.ts`
- Each conversation gets its own E2B sandbox
- Files persist across conversation turns
- Uses ContainerManager singleton

**Enhancement 3: Smart Tool Chaining**

- Created `/src/lib/ai/tools/tool-chain-executor.ts`
- 6 predefined workflows: build-and-test, code-review, refactor-and-document, generate-and-test, git-commit-flow, full-project-setup

**Enhancement 4: GitHub Repo Context**

- Created `/src/lib/ai/tools/github-context-tool.ts`
- Operations: list_repos, get_structure, get_context, read_file, search_code

**Enhancement 5: Multi-File Project View**

- Created `/src/components/chat/ProjectView.tsx`
- File tree navigation with syntax highlighting

**Enhancement 6: Live Preview for Web Code**

- Created `/src/components/chat/LivePreview.tsx`
- Sandboxed iframe with device presets

**Enhancement 7: Conversation Memory for Code**

- Created `/src/lib/memory/code-memory.ts`
- Semantic search and auto-tagging

**Enhancement 8: Agentic Code Workflows**

- Created `/src/lib/workflows/workflow-executor.ts`
- Trigger phrases: "ship it", "test everything", "clean start", etc.

**Enhancement 9: Real-Time Code Streaming**

- Created `/src/components/chat/StreamingCodeOutput.tsx`
- File-by-file progress with cancel capability

**Enhancement 10: Self-Improving Tools**

- Created `/src/lib/ai/tools/tool-telemetry.ts`
- Success rate tracking, improvement suggestions

### January 26, 2026 - Native Tool Use Implementation

- Replaced keyword-based auto-search with Claude native tool use
- Claude decides when to search (no keyword matching)
- Tool loop handles multi-search scenarios
- Response headers include tool usage info

### Fixes Applied

1. Tool argument accumulation (raw strings, not parsed)
2. Type definitions (string | Record for arguments)
3. ESLint errors (const, unused vars)
4. Tool timeout (15s per tool)
5. Keepalive with status messages (prevent Vercel timeout, user feedback)
6. Parse error recovery (continue with error flag)

## Known Issues & TODOs

### High Priority

- [ ] Add tool call deduplication (same query = single search)
- [ ] Implement tool execution telemetry
- [ ] Add Redis for distributed rate limiting

### Medium Priority

- [ ] URL validation in search results (XSS prevention)
- [ ] API key race condition fix
- [ ] Stream backpressure handling

### Low Priority

- [ ] String buffer optimization (array vs concat)
- [ ] Message context caching
- [ ] Tool versioning system

## Testing

### Manual Test Cases

1. **Simple question**: "What is 2+2?" → No tool use
2. **Current info**: "What's the weather in NYC?" → web_search called
3. **Multi-search**: "Compare Tesla and Rivian stock" → Multiple searches
4. **Timeout**: Brave API slow → 15s timeout, error returned
5. **Rate limit**: 500+ searches → Rate limit error returned

### Logs to Monitor

```bash
# Tool execution
grep "Executing tool" logs
grep "Tool execution complete" logs
grep "Tool execution failed" logs

# Keepalive / Status
grep "Keepalive status sent" logs
grep "Sent tool status message" logs

# Errors
grep "Failed to parse tool arguments" logs
grep "Tool execution timeout" logs
```

## File Reference

### Core Files

| File                                          | Purpose                            |
| --------------------------------------------- | ---------------------------------- |
| `/app/api/chat/route.ts`                      | Main chat orchestration            |
| `/src/lib/ai/chat-router.ts`                  | Multi-provider routing + tool loop |
| `/src/lib/ai/tools/index.ts`                  | Tool exports (371+ tools)          |
| `/src/lib/ai/providers/types.ts`              | Unified type definitions           |
| `/src/lib/ai/providers/adapters/anthropic.ts` | Claude adapter                     |
| `/src/lib/ai/providers/service.ts`            | Provider service                   |

### New Enhancement Files (February 1, 2026)

| File                                           | Purpose                        |
| ---------------------------------------------- | ------------------------------ |
| `/app/api/chat/mcp/route.ts`                   | Real MCP client integration    |
| `/src/lib/ai/tools/workspace-tool.ts`          | Persistent workspace sessions  |
| `/src/lib/ai/tools/tool-chain-executor.ts`     | Smart tool chaining            |
| `/src/lib/ai/tools/github-context-tool.ts`     | GitHub repo context            |
| `/src/lib/ai/tools/tool-telemetry.ts`          | Self-improving tools telemetry |
| `/src/components/chat/ProjectView.tsx`         | Multi-file project display     |
| `/src/components/chat/LivePreview.tsx`         | HTML/React live preview        |
| `/src/components/chat/StreamingCodeOutput.tsx` | Real-time code streaming       |
| `/src/lib/memory/code-memory.ts`               | Code artifact memory           |
| `/src/lib/workflows/workflow-executor.ts`      | Agentic workflows              |

## Contact

For questions about this architecture, refer to this document or the git history on the `claude/evaluate-chat-tools-cDLQH` branch.

---

_Document updated: February 1, 2026 at 18:00 UTC_
_Chief Engineering Officer - JCIL.AI Platform_
