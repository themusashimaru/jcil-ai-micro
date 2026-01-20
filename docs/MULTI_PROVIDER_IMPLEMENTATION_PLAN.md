# Multi-Provider Implementation Plan

**Document Version:** 1.0
**Created:** January 20, 2026
**Status:** Planning Phase
**Risk Level:** Low (Additive changes only)

---

## Executive Summary

This document outlines the implementation plan for adding multi-provider AI support to JCIL Code Lab. The goal is to allow users to switch between AI providers (Claude, OpenAI, xAI, DeepSeek) mid-conversation with seamless context handoff.

### Key Objectives

1. Create provider abstraction layer (no changes to core machine)
2. Support mid-conversation provider switching
3. Maintain full tool compatibility across all providers
4. Preserve context and workspace state across switches

### Business Value

- Platform positioning: "AI Coding Platform" vs "Claude Wrapper"
- User flexibility: Right model for each task
- Cost optimization: Budget options (DeepSeek) vs Premium (Claude/GPT-4)
- Acquisition appeal: Provider-agnostic = strategic value

---

## Provider Support Matrix

### Phase 1: OpenAI-Compatible Adapter

One adapter unlocks multiple providers:

| Provider     | Models                             | Vision | Tool Calls | Streaming | Price Tier |
| ------------ | ---------------------------------- | ------ | ---------- | --------- | ---------- |
| **OpenAI**   | gpt-4o, gpt-4-turbo, o1, o1-mini   | Yes    | Yes        | Yes       | Premium    |
| **xAI**      | grok-2, grok-2-vision, grok-3      | Yes    | Yes        | Yes       | Standard   |
| **DeepSeek** | deepseek-chat (V3), deepseek-coder | No     | Yes        | Yes       | Budget     |
| **Groq**     | llama-3.3-70b-versatile            | No     | Yes        | Yes       | Budget     |

### Phase 2: Anthropic Adapter (Wrap Existing)

| Provider   | Models                         | Vision | Tool Calls | Streaming | Price Tier |
| ---------- | ------------------------------ | ------ | ---------- | --------- | ---------- |
| **Claude** | claude-opus-4, claude-sonnet-4 | Yes    | Yes        | Yes       | Premium    |

### Future: Google Adapter

| Provider   | Models                           | Vision | Tool Calls | Streaming | Price Tier |
| ---------- | -------------------------------- | ------ | ---------- | --------- | ---------- |
| **Gemini** | gemini-2.0-flash, gemini-2.0-pro | Yes    | Yes        | Yes       | Standard   |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Provider: Claude ▼]  [Model: Opus 4 ▼]                            │   │
│  │                                                                      │   │
│  │  User can switch providers mid-conversation                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ROUTE (/api/code-lab/chat)                     │
│                                                                              │
│  1. Receive request with provider/model selection                           │
│  2. If provider changed → Execute context handoff                           │
│  3. Get appropriate adapter from registry                                   │
│  4. Stream response using unified format                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROVIDER ABSTRACTION LAYER                         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ Anthropic       │  │ OpenAI-         │  │ Google          │            │
│  │ Adapter         │  │ Compatible      │  │ Adapter         │            │
│  │                 │  │ Adapter         │  │ (Future)        │            │
│  │ • Claude        │  │ • OpenAI        │  │ • Gemini        │            │
│  │                 │  │ • xAI           │  │                 │            │
│  │                 │  │ • DeepSeek      │  │                 │            │
│  │                 │  │ • Groq          │  │                 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  Each adapter implements:                                                   │
│  • chat() → AsyncIterable<UnifiedStreamChunk>                              │
│  • formatTools() → Provider-specific tool format                           │
│  • parseToolCall() → UnifiedToolCall                                       │
│  • toProviderMessages() → Provider message format                          │
│  • fromProviderMessages() → UnifiedMessage[]                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED STREAM FORMAT                                │
│                                                                              │
│  All providers emit the same chunk format:                                  │
│  { type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'done', ... }   │
│                                                                              │
│  Your existing streaming UI receives identical data regardless of provider  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXISTING CORE MACHINE (UNCHANGED)                         │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Tool         │  │ E2B          │  │ Workspace    │  │ CRDT         │   │
│  │ Executor     │  │ Sandbox      │  │ Agent        │  │ Collaboration│   │
│  │              │  │              │  │              │  │              │   │
│  │ 55+ tools    │  │ Isolated     │  │ File ops     │  │ Real-time    │   │
│  │ unchanged    │  │ execution    │  │ Git, LSP     │  │ sync         │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/lib/ai/
├── providers/
│   ├── types.ts                    # Unified types and interfaces
│   ├── registry.ts                 # Provider configurations
│   ├── capabilities.ts             # Feature flags per provider
│   ├── factory.ts                  # Adapter factory function
│   │
│   ├── adapters/
│   │   ├── base.ts                 # Abstract base adapter class
│   │   ├── anthropic.ts            # Claude adapter (wraps existing)
│   │   ├── openai-compatible.ts    # OpenAI/xAI/DeepSeek/Groq
│   │   └── index.ts                # Exports
│   │
│   ├── streaming/
│   │   ├── unified-stream.ts       # Unified chunk types
│   │   ├── anthropic-parser.ts     # Parse Anthropic SSE
│   │   ├── openai-parser.ts        # Parse OpenAI SSE
│   │   └── index.ts
│   │
│   ├── tools/
│   │   ├── unified-tool.ts         # Provider-agnostic tool definition
│   │   ├── anthropic-format.ts     # Convert to/from Anthropic
│   │   ├── openai-format.ts        # Convert to/from OpenAI
│   │   └── index.ts
│   │
│   ├── messages/
│   │   ├── unified-message.ts      # Provider-agnostic message
│   │   ├── anthropic-format.ts     # Convert to/from Anthropic
│   │   ├── openai-format.ts        # Convert to/from OpenAI
│   │   └── index.ts
│   │
│   ├── context/
│   │   ├── handoff.ts              # Mid-conversation provider switch
│   │   ├── summarizer.ts           # Context summarization for handoff
│   │   └── index.ts
│   │
│   ├── errors/
│   │   ├── unified-error.ts        # Normalized error class
│   │   ├── anthropic-parser.ts     # Parse Anthropic errors
│   │   ├── openai-parser.ts        # Parse OpenAI errors
│   │   └── index.ts
│   │
│   └── index.ts                    # Main exports
│
src/components/code-lab/
├── ProviderSelector.tsx            # Provider/model dropdown
├── ProviderSwitchIndicator.tsx     # "Switched to GPT-4o" banner
└── ProviderIcon.tsx                # Provider logo icons

src/hooks/
└── useProvider.ts                  # Provider state management hook
```

---

## Implementation Phases

### Phase 1: Foundation (Day 1-2)

**Goal:** Create type system and registry without any behavioral changes

**Files to create:**

- `src/lib/ai/providers/types.ts`
- `src/lib/ai/providers/registry.ts`
- `src/lib/ai/providers/capabilities.ts`

**Deliverables:**

- [ ] UnifiedMessage type
- [ ] UnifiedToolCall type
- [ ] UnifiedStreamChunk type
- [ ] UnifiedAIError class
- [ ] ProviderConfig for all providers
- [ ] getProvider() factory function
- [ ] getAvailableProviders() function

**Risk:** None - purely additive

**Testing:** TypeScript compilation only

---

### Phase 2: Base Adapter & Anthropic Wrapper (Day 2-3)

**Goal:** Create base adapter class and wrap existing Claude logic

**Files to create:**

- `src/lib/ai/providers/adapters/base.ts`
- `src/lib/ai/providers/adapters/anthropic.ts`
- `src/lib/ai/providers/streaming/anthropic-parser.ts`
- `src/lib/ai/providers/tools/anthropic-format.ts`
- `src/lib/ai/providers/messages/anthropic-format.ts`

**Deliverables:**

- [ ] BaseAIAdapter abstract class
- [ ] AnthropicAdapter that wraps existing Claude code
- [ ] Anthropic stream → UnifiedStreamChunk parser
- [ ] Anthropic tool format converter
- [ ] Anthropic message format converter

**Risk:** Low - wrapping, not modifying

**Testing:**

- Unit tests with mocked Anthropic responses
- Integration test: existing Claude flow still works

---

### Phase 3: OpenAI-Compatible Adapter (Day 3-5)

**Goal:** Create the adapter that unlocks OpenAI, xAI, DeepSeek, Groq

**Files to create:**

- `src/lib/ai/providers/adapters/openai-compatible.ts`
- `src/lib/ai/providers/streaming/openai-parser.ts`
- `src/lib/ai/providers/tools/openai-format.ts`
- `src/lib/ai/providers/messages/openai-format.ts`

**Deliverables:**

- [ ] OpenAICompatibleAdapter class
- [ ] Support for custom baseURL (xAI, DeepSeek, Groq)
- [ ] OpenAI stream → UnifiedStreamChunk parser
- [ ] OpenAI tool format converter (handle JSON string arguments)
- [ ] OpenAI message format converter

**Key Implementation Details:**

```typescript
// Tool call argument handling - CRITICAL DIFFERENCE
// Anthropic: input is object
{ type: 'tool_use', input: { path: '/file.ts' } }

// OpenAI: arguments is JSON STRING
{ function: { arguments: '{"path": "/file.ts"}' } }

// Adapter must parse:
const args = JSON.parse(toolCall.function.arguments);
```

**Risk:** Medium - needs thorough testing of tool call parsing

**Testing:**

- Unit tests with mocked OpenAI responses
- Integration tests with real API calls (minimal tokens)
- Tool execution tests

---

### Phase 4: Error Handling (Day 5-6)

**Goal:** Normalize errors from all providers

**Files to create:**

- `src/lib/ai/providers/errors/unified-error.ts`
- `src/lib/ai/providers/errors/anthropic-parser.ts`
- `src/lib/ai/providers/errors/openai-parser.ts`

**Deliverables:**

- [ ] UnifiedAIError class with error codes
- [ ] Anthropic error → UnifiedAIError parser
- [ ] OpenAI error → UnifiedAIError parser
- [ ] Retry logic integration

**Error Code Mapping:**

| Scenario         | Anthropic              | OpenAI                    | Unified Code        |
| ---------------- | ---------------------- | ------------------------- | ------------------- |
| Rate limited     | 429 + rate_limit_error | 429 + rate_limit_exceeded | `rate_limited`      |
| Context too long | invalid_request_error  | context_length_exceeded   | `context_too_long`  |
| Auth failed      | 401                    | 401                       | `auth_failed`       |
| Model not found  | model_not_found        | model_not_found           | `model_unavailable` |
| Content filtered | content_policy         | content_filter            | `content_filtered`  |

**Risk:** Low

**Testing:** Unit tests with error fixtures

---

### Phase 5: Context Handoff (Day 6-7)

**Goal:** Enable mid-conversation provider switching

**Files to create:**

- `src/lib/ai/providers/context/handoff.ts`
- `src/lib/ai/providers/context/summarizer.ts`

**Deliverables:**

- [ ] prepareProviderHandoff() function
- [ ] Message format conversion between providers
- [ ] Context summarization for long conversations
- [ ] Capability degradation warnings (e.g., switching to non-vision provider)

**Handoff Flow:**

```
User switches Claude → GPT-4o
         │
         ▼
┌─────────────────────────────────┐
│ 1. Convert message history      │
│    Anthropic format → OpenAI    │
├─────────────────────────────────┤
│ 2. Check context length         │
│    If too long → summarize      │
├─────────────────────────────────┤
│ 3. Check capabilities           │
│    Warn if losing features      │
├─────────────────────────────────┤
│ 4. Add handoff system prompt    │
│    "Continuing conversation..." │
├─────────────────────────────────┤
│ 5. Return prepared context      │
│    Ready for new provider       │
└─────────────────────────────────┘
```

**Risk:** Medium - needs careful testing

**Testing:**

- Unit tests for message conversion
- Integration tests for full handoff flow

---

### Phase 6: Database Schema (Day 7)

**Goal:** Track provider per message for history

**Changes:**

- Add `provider` and `model` columns to messages table

**Migration:**

```sql
-- Migration: add_provider_tracking
ALTER TABLE messages
ADD COLUMN provider TEXT DEFAULT 'claude',
ADD COLUMN model TEXT;

-- Backfill existing messages
UPDATE messages SET provider = 'claude' WHERE provider IS NULL;
```

**Deliverables:**

- [ ] Database migration
- [ ] Update message insert logic
- [ ] Update message retrieval logic

**Risk:** Low - additive column

---

### Phase 7: API Integration (Day 8-9)

**Goal:** Wire up adapters to chat route

**Files to modify:**

- `app/api/code-lab/chat/route.ts` (minimal changes)

**Changes:**

```typescript
// Add to request body parsing
const { providerId = 'claude', modelId } = body;

// Add provider switching logic
if (conversation.lastProvider && conversation.lastProvider !== providerId) {
  const handoff = await prepareProviderHandoff(...);
  messages = handoff.messages;
}

// Use adapter instead of direct Anthropic call
const adapter = getAdapter(providerId);
const stream = adapter.chat(messages, { model: modelId, tools: workspaceTools });

// Stream unified chunks (existing streaming logic works!)
for await (const chunk of stream) {
  // Your existing chunk handling - unchanged!
}
```

**Risk:** Medium - this is the main integration point

**Testing:**

- Integration tests with each provider
- Full conversation tests
- Provider switching tests

---

### Phase 8: UI Components (Day 9-10)

**Goal:** Add provider selection UI

**Files to create:**

- `src/components/code-lab/ProviderSelector.tsx`
- `src/components/code-lab/ProviderSwitchIndicator.tsx`
- `src/components/code-lab/ProviderIcon.tsx`
- `src/hooks/useProvider.ts`

**Deliverables:**

- [ ] Provider dropdown in chat header
- [ ] Model selection within provider
- [ ] "Switched to X" indicator in chat
- [ ] Provider icons (Claude, OpenAI, xAI, DeepSeek logos)

**Risk:** Low - UI only

---

### Phase 9: Testing & Polish (Day 10-12)

**Goal:** Comprehensive testing and edge case handling

**Test Scenarios:**

- [ ] Claude basic chat
- [ ] Claude with tool calls
- [ ] Claude with parallel tools
- [ ] Claude with vision
- [ ] GPT-4o basic chat
- [ ] GPT-4o with tool calls
- [ ] GPT-4o with vision
- [ ] Grok basic chat
- [ ] Grok with tool calls
- [ ] DeepSeek basic chat
- [ ] DeepSeek with tool calls
- [ ] Switch Claude → GPT-4o mid-conversation
- [ ] Switch GPT-4o → DeepSeek mid-conversation
- [ ] Switch to non-vision provider with images in history
- [ ] Rate limit handling per provider
- [ ] Error recovery per provider
- [ ] Long conversation handoff (summarization)

---

## Risk Assessment

### Low Risk (Proceed Confidently)

| Item              | Why Low Risk          |
| ----------------- | --------------------- |
| Type definitions  | Purely additive       |
| Provider registry | Configuration only    |
| UI components     | No core logic changes |
| Anthropic adapter | Wraps existing code   |

### Medium Risk (Test Thoroughly)

| Item                   | Concern               | Mitigation                |
| ---------------------- | --------------------- | ------------------------- |
| OpenAI tool parsing    | JSON string vs object | Extensive unit tests      |
| Context handoff        | Format conversion     | Test all message types    |
| Chat route integration | Main code path        | Feature flag for rollback |

### Rollback Strategy

If issues arise:

1. Feature flag: `ENABLE_MULTI_PROVIDER=false`
2. Falls back to existing Claude-only flow
3. No data loss - messages still in DB

---

## Environment Variables

**Already configured (per user):**

- `ANTHROPIC_API_KEY` ✓
- `OPENAI_API_KEY` ✓
- `XAI_API_KEY` ✓
- `DEEPSEEK_API_KEY` ✓
- `GOOGLE_AI_API_KEY` ✓ (for future Gemini)

**To add:**

- `GROQ_API_KEY` (optional)
- `ENABLE_MULTI_PROVIDER` (feature flag)

---

## Success Criteria

### Functional Requirements

- [ ] User can select provider from dropdown
- [ ] User can select model within provider
- [ ] User can switch providers mid-conversation
- [ ] Context preserved across provider switches
- [ ] All 55+ tools work with all providers
- [ ] Errors handled gracefully per provider
- [ ] Retry logic works for all providers

### Non-Functional Requirements

- [ ] No degradation of existing Claude performance
- [ ] Streaming latency within 10% of direct API calls
- [ ] Clean rollback if issues arise

---

## Appendix A: Provider API Differences

### Message Format Comparison

**Anthropic:**

```typescript
{
  role: 'user' | 'assistant',
  content: [
    { type: 'text', text: '...' },
    { type: 'image', source: { type: 'base64', data: '...' } },
    { type: 'tool_use', id: '...', name: '...', input: {...} },
    { type: 'tool_result', tool_use_id: '...', content: '...' }
  ]
}
```

**OpenAI:**

```typescript
{
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: '...',  // Usually string
  tool_calls: [{
    id: '...',
    type: 'function',
    function: { name: '...', arguments: '{"json":"string"}' }
  }],
  tool_call_id: '...'  // For tool role messages
}
```

### Streaming Chunk Comparison

**Anthropic:**

```typescript
{ type: 'message_start', ... }
{ type: 'content_block_start', content_block: { type: 'text' } }
{ type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } }
{ type: 'content_block_delta', delta: { type: 'input_json_delta', ... } }
{ type: 'content_block_stop' }
{ type: 'message_stop' }
```

**OpenAI:**

```typescript
{
  choices: [{ delta: { content: '...' } }];
}
{
  choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '...' } }] } }];
}
{
  choices: [{ finish_reason: 'stop' }];
}
```

---

## Appendix B: Checklist for Implementation

### Before Starting

- [ ] Review this document with stakeholder
- [ ] Confirm environment variables are set
- [ ] Set up test accounts with rate limits understood
- [ ] Create feature branch: `feature/multi-provider`

### During Implementation

- [ ] Commit after each phase
- [ ] Write tests before moving to next phase
- [ ] Document any deviations from plan

### Before Merging

- [ ] All test scenarios passing
- [ ] Performance benchmarks acceptable
- [ ] Feature flag tested (on/off)
- [ ] Rollback procedure tested
- [ ] Documentation updated

---

## Appendix C: Estimated Timeline

| Phase                | Days | Cumulative |
| -------------------- | ---- | ---------- |
| 1. Foundation        | 1-2  | 2          |
| 2. Anthropic Adapter | 1    | 3          |
| 3. OpenAI Adapter    | 2    | 5          |
| 4. Error Handling    | 1    | 6          |
| 5. Context Handoff   | 1    | 7          |
| 6. Database Schema   | 0.5  | 7.5        |
| 7. API Integration   | 1.5  | 9          |
| 8. UI Components     | 1    | 10         |
| 9. Testing & Polish  | 2    | 12         |

**Total: ~12 working days**

---

_Document created for JCIL.AI Code Lab multi-provider implementation project._
