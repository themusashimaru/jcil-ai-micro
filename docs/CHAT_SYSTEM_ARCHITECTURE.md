# JCIL AI Chat System Architecture

> Last Updated: January 30, 2026
> Branch: claude/evaluate-chat-workflow-AZh3A

## Overview

The JCIL AI chat system is a multi-provider, tool-enabled conversational AI platform built on Next.js. It features native Claude tool use for web search, multi-provider failover, and enterprise-grade reliability features.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                                │
│  ChatClient.tsx → ChatComposer (message input)                  │
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
│  ├─ Tools: [web_search, fetch_url, run_code, vision,            │
│  │          browser_visit, extract_pdf, extract_table,          │
│  │          parallel_research, create_and_run_tool]             │
│  ├─ Dynamic tool creation (cost-limited)                        │
│  ├─ Streaming with tool loop                                    │
│  ├─ Status messages during tool execution (8s interval)         │
│  ├─ 15s timeout per tool execution                              │
│  └─ Workflow task tracking (Claude Code style)                  │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              MULTI-PROVIDER SYSTEM                              │
│  ├─ Primary: Claude Sonnet 4.5 (intelligent orchestration)      │
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

### 6. Provider System (`/src/lib/ai/providers/`)

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

## Recent Changes (Jan 26, 2026)

### Native Tool Use Implementation

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

| File                                          | Purpose                            |
| --------------------------------------------- | ---------------------------------- |
| `/app/api/chat/route.ts`                      | Main chat orchestration            |
| `/src/lib/ai/chat-router.ts`                  | Multi-provider routing + tool loop |
| `/src/lib/ai/tools/web-search.ts`             | Web search tool definition         |
| `/src/lib/ai/tools/index.ts`                  | Tool exports                       |
| `/src/lib/ai/providers/types.ts`              | Unified type definitions           |
| `/src/lib/ai/providers/adapters/anthropic.ts` | Claude adapter                     |
| `/src/lib/ai/providers/service.ts`            | Provider service                   |
| `/src/lib/brave/`                             | Brave Search integration           |

## Contact

For questions about this architecture, refer to this document or the git history on the `claude/audit-chat-tools-xTqRJ` branch.
