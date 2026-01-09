# Persistent Memory Agent - Technical Specification

> Enterprise-Grade Cross-Conversation Personalization System

---

## Overview

The Persistent Memory Agent enables JCIL.AI to remember user context across conversations, providing personalized AI experiences that improve over time. This system learns user preferences, interests, and communication styles to deliver contextually relevant responses.

### Design Principles

1. **Privacy First** - Users control their data; GDPR-compliant erasure
2. **Non-Blocking** - Memory operations never slow down chat responses
3. **Intelligent Extraction** - Claude Haiku extracts only relevant personal information
4. **Graceful Degradation** - Chat works normally if memory system is unavailable
5. **Cost Efficient** - Fast pre-checks avoid unnecessary API calls

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENT MEMORY ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         CHAT FLOW                                        │ │
│  │                                                                          │ │
│  │  1. PRE-CHAT LOADING                                                    │ │
│  │     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐     │ │
│  │     │   User Auth    │───▶│  Load Memory   │───▶│ Format Context │     │ │
│  │     │   Verified     │    │  from Supabase │    │  for Prompt    │     │ │
│  │     └────────────────┘    └────────────────┘    └────────────────┘     │ │
│  │                                                          │              │ │
│  │  2. CHAT PROCESSING                                      ▼              │ │
│  │     ┌────────────────────────────────────────────────────────────┐     │ │
│  │     │                   SYSTEM PROMPT                              │     │ │
│  │     │  ┌──────────────────────────────────────────────────────┐  │     │ │
│  │     │  │ Base Prompt + USER MEMORY CONTEXT                     │  │     │ │
│  │     │  │                                                        │  │     │ │
│  │     │  │ "About This User: John, Software Engineer..."         │  │     │ │
│  │     │  │ "Topics Discussed: programming, theology..."          │  │     │ │
│  │     │  │ "Communication Style: technical"                       │  │     │ │
│  │     │  └──────────────────────────────────────────────────────┘  │     │ │
│  │     └────────────────────────────────────────────────────────────┘     │ │
│  │                                                          │              │ │
│  │  3. POST-CHAT EXTRACTION (Async, Non-blocking)          ▼              │ │
│  │     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐     │ │
│  │     │  Regex Filter  │───▶│  Haiku Extract │───▶│ Merge & Save   │     │ │
│  │     │  (Fast Check)  │    │  (If Needed)   │    │  to Database   │     │ │
│  │     └────────────────┘    └────────────────┘    └────────────────┘     │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Database Schema

The memory system uses the existing `conversation_memory` table in Supabase:

```sql
CREATE TABLE conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Memory content
  summary TEXT DEFAULT '',                      -- Overall context summary
  key_topics TEXT[] DEFAULT '{}',               -- Discussion topics
  user_preferences JSONB DEFAULT '{}',          -- Structured preferences

  -- Context tracking
  conversation_ids UUID[] DEFAULT '{}',         -- Contributing conversations
  last_conversations TEXT[] DEFAULT '{}',       -- Recent summaries

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(user_id)
);

-- Row-Level Security
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memory"
ON conversation_memory FOR ALL
USING (auth.uid() = user_id);
```

### TypeScript Types

```typescript
// Core memory structure
interface UserMemory {
  id: string;
  user_id: string;
  summary: string;
  key_topics: string[];
  user_preferences: UserPreferences;
  conversation_ids: string[];
  last_conversations: string[];
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

// Structured preferences
interface UserPreferences {
  name?: string;
  preferred_name?: string;
  occupation?: string;
  location?: string;
  communication_style?: 'formal' | 'casual' | 'technical' | 'simple';
  interests?: string[];
  faith_context?: string;
  family_members?: FamilyMember[];
  goals?: string[];
  important_dates?: ImportantDate[];
  interaction_preferences?: string[];
  custom?: Record<string, string>;
}

// Family reference
interface FamilyMember {
  relation: string;  // "wife", "son", "mother"
  name?: string;
  notes?: string;
}

// Important date
interface ImportantDate {
  label: string;     // "wife's birthday"
  date?: string;     // "March 15" or ISO date
}
```

---

## Components

### 1. Memory Loading (`user-memory.ts`)

Loads user memory at the start of each chat session:

```typescript
// Location: src/lib/memory/user-memory.ts

export async function loadUserMemory(userId: string): Promise<UserMemory | null>

// Usage in chat route:
if (isAuthenticated) {
  const memory = await getMemoryContext(rateLimitIdentifier);
  if (memory.loaded) {
    memoryContext = memory.contextString;
  }
}
```

**Features:**
- Automatic `last_accessed_at` timestamp update
- Graceful null return for new users
- Database connection error handling

### 2. Memory Formatting (`formatMemoryForPrompt`)

Converts memory data into system prompt context:

```typescript
export function formatMemoryForPrompt(
  memory: UserMemory | null,
  options?: MemoryOptions
): MemoryContext

// Options:
interface MemoryOptions {
  includeConversationSummaries?: boolean;  // default: true
  maxTopics?: number;                       // default: 10
  maxContextLength?: number;                // default: 2000
}
```

**Output Example:**
```
---
USER MEMORY (Persistent Context):

**About This User:**
- Name: John
- Occupation: Software Engineer
- Location: San Francisco
- Prefers technical communication style
- Family:
  - wife (Sarah)
  - son (Michael)
- Interests: AI, programming, theology

**Topics Previously Discussed:** machine learning, faith, family

**Context from Previous Conversations:**
User is building an AI startup and interested in ethical AI development.

Use this context to personalize responses. Reference previous conversations naturally when relevant.
---
```

### 3. Memory Extraction (`memory-extractor.ts`)

Extracts personal information from conversations:

```typescript
// Fast pre-check (regex-based)
export function shouldExtractMemory(
  messages: Array<{ role: string; content: string }>
): boolean

// AI-powered extraction (Claude Haiku)
export async function extractMemoryFromConversation(
  messages: Array<{ role: string; content: string }>
): Promise<MemoryExtraction | null>

// Local topic extraction (no API call)
export function extractTopicsLocally(
  messages: Array<{ role: string; content: string }>
): string[]
```

**Extraction Pipeline:**

```
Message Content
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: Regex Pre-Check                                    │
│                                                              │
│  Patterns checked:                                           │
│  • "my name is", "i am", "i'm"                              │
│  • "my wife", "my husband", "my son", "my daughter"         │
│  • "i work", "i'm a", "my job"                              │
│  • "i live in", "i'm from", "my home"                       │
│  • "i prefer", "i like", "i enjoy"                          │
│  • "my goal", "i want to", "i'm trying to"                  │
│                                                              │
│  If NO patterns match → Skip extraction (save API cost)     │
└──────────────────────────┬──────────────────────────────────┘
                           │ (If patterns match)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: Claude Haiku Extraction                            │
│                                                              │
│  Model: claude-sonnet-4-5-20250514 (or haiku for cost)      │
│  Max tokens: 500                                             │
│                                                              │
│  Extracts:                                                   │
│  • Personal facts (name, occupation, location)              │
│  • Family members                                            │
│  • Interests and preferences                                 │
│  • Goals and aspirations                                     │
│  • Communication style                                       │
│  • Conversation summary                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 3: Merge & Persist                                    │
│                                                              │
│  • Deduplicate topics                                        │
│  • Merge preferences (new values override old)              │
│  • Update conversation summaries (keep last 10)             │
│  • Generate overall summary (after 3+ conversations)        │
└─────────────────────────────────────────────────────────────┘
```

### 4. Memory Update (`updateUserMemory`)

Merges extracted facts into existing memory:

```typescript
export async function updateUserMemory(
  userId: string,
  extraction: MemoryExtraction,
  conversationId?: string
): Promise<MemoryUpdateResult>

interface MemoryUpdateResult {
  success: boolean;
  updated: boolean;
  factsAdded: number;
  topicsAdded: number;
  error?: string;
}
```

**Merge Rules:**
- Topics are deduplicated (case-insensitive)
- Maximum 50 topics retained
- Preferences merge by key (new values override)
- Last 10 conversation summaries kept
- Confidence threshold: 0.6 (facts below this are skipped)

---

## API Endpoints

### GET /api/memory

Retrieve user's memory profile.

**Response:**
```json
{
  "memory": {
    "id": "uuid",
    "summary": "string",
    "key_topics": ["string"],
    "preferences": {
      "name": "string",
      "occupation": "string",
      ...
    },
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp"
  }
}
```

### PUT /api/memory

Update user preferences directly.

**Request:**
```json
{
  "name": "John",
  "occupation": "Software Engineer",
  "communication_style": "technical",
  "interests": ["AI", "programming"]
}
```

### DELETE /api/memory

Clear all user memory (GDPR right to erasure).

**Response:**
```json
{
  "success": true,
  "message": "All memory has been permanently deleted"
}
```

### POST /api/memory/forget

Forget specific items (targeted GDPR deletion).

**Request:**
```json
{
  "topics": ["topic1", "topic2"],
  "preference_keys": ["occupation", "location"],
  "clear_summary": false
}
```

**Response:**
```json
{
  "success": true,
  "removed": ["topics: topic1, topic2", "preference: occupation"]
}
```

---

## Integration Points

### Chat Route Integration

The memory system integrates at two points in the chat flow:

**1. Pre-Chat (Memory Loading):**
```typescript
// app/api/chat/route.ts (lines 435-450)

let memoryContext = '';
if (isAuthenticated) {
  try {
    const memory = await getMemoryContext(rateLimitIdentifier);
    if (memory.loaded) {
      memoryContext = memory.contextString;
    }
  } catch (error) {
    log.warn('Failed to load user memory', error);
  }
}
```

**2. Post-Chat (Memory Extraction):**
```typescript
// app/api/chat/route.ts (TransformStream flush)

flush() {
  ensureSlotReleased();

  if (isAuthenticated && messages.length >= 2) {
    processConversationForMemory(
      rateLimitIdentifier,
      messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content),
      }))
    ).catch(err => {
      log.warn('Memory extraction failed (non-critical)', err);
    });
  }
}
```

---

## Performance Considerations

### Latency Impact

| Operation | Timing | Impact on UX |
|-----------|--------|--------------|
| Memory loading | ~50-100ms | Minimal (parallel with other init) |
| Memory formatting | ~1ms | None |
| Pre-check regex | ~1ms | None |
| AI extraction | ~500-1000ms | None (async, post-response) |
| Database update | ~50-100ms | None (async) |

### Cost Optimization

1. **Regex Pre-Check**: 90%+ of conversations don't contain personal info
2. **Haiku Model**: Cost-effective for extraction (~$0.0001/request)
3. **Local Topic Extraction**: No API call for simple topic extraction
4. **Confidence Threshold**: Skip low-confidence facts

### Scaling

- Memory table indexed on `user_id` (unique constraint)
- Single row per user (no N+1 queries)
- Redis caching can be added for frequently accessed users
- Supabase RLS ensures query efficiency

---

## GDPR Compliance

### Data Subject Rights

| Right | Implementation | Endpoint |
|-------|---------------|----------|
| **Right to Access** | Users can view all stored memory | GET /api/memory |
| **Right to Rectification** | Users can update preferences | PUT /api/memory |
| **Right to Erasure** | Complete memory deletion | DELETE /api/memory |
| **Right to be Forgotten** | Targeted fact deletion | POST /api/memory/forget |
| **Right to Portability** | JSON export via GET | GET /api/memory |

### Data Minimization

- Only personal information is extracted (no conversation content stored)
- Topics limited to 50 entries
- Conversation summaries limited to 10 entries
- Old summaries automatically pruned

### Consent

- Memory is only created for authenticated users
- Users can opt-out by deleting their memory
- Clear documentation of what is stored

---

## File Structure

```
src/lib/memory/
├── index.ts              # Module exports & convenience functions
├── types.ts              # TypeScript type definitions
├── user-memory.ts        # Core memory service (CRUD operations)
├── memory-extractor.ts   # AI extraction with Claude Haiku
└── memory.test.ts        # Comprehensive test suite

app/api/memory/
├── route.ts              # GET, PUT, DELETE endpoints
└── forget/
    └── route.ts          # POST endpoint for targeted deletion
```

---

## Testing

### Test Coverage

```bash
# Run memory system tests
npm test -- src/lib/memory/memory.test.ts
```

**Test Categories:**
- Type definitions and exports
- formatMemoryForPrompt() formatting
- shouldExtractMemory() pattern matching
- extractTopicsLocally() topic extraction
- Database operations (with mocked Supabase)
- GDPR compliance endpoints

### Manual Testing

1. **Test Memory Loading:**
   - Chat as authenticated user
   - Check logs for "Loaded user memory"

2. **Test Memory Extraction:**
   - Send message: "My name is John and I work as a developer"
   - Check database for new memory record

3. **Test GDPR Deletion:**
   - Call DELETE /api/memory
   - Verify memory is cleared

---

## Configuration

### Environment Variables

No additional environment variables required. Memory uses existing:

```env
# Already required for chat
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Optional Tuning

Constants in `user-memory.ts`:

```typescript
const DEFAULT_MAX_TOPICS = 10;           // Topics in context string
const DEFAULT_MAX_CONTEXT_LENGTH = 2000; // Max context characters
const MAX_CONVERSATION_SUMMARIES = 5;    // Summaries in context
```

Constants in `memory-extractor.ts`:

```typescript
const CONFIDENCE_THRESHOLD = 0.6;        // Minimum fact confidence
const MAX_TOPICS = 50;                   // Maximum stored topics
```

---

## Future Enhancements

### Planned

1. **Memory Decay** - Reduce importance of old facts over time
2. **Importance Scoring** - Prioritize frequently referenced facts
3. **Category Preferences** - Let users control what is remembered
4. **Memory Insights** - Show users what the AI "knows" about them

### Under Consideration

1. **Redis Caching** - Cache hot user memories
2. **Batch Extraction** - Process multiple conversations together
3. **Cross-Device Sync** - Explicit memory sync controls
4. **Memory Sharing** - Share context between related agents

---

_Last Updated: January 2026_
_Version: 1.0.0_
