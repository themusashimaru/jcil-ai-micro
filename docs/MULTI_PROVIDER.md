# Multi-Provider AI System

JCIL Code Lab supports multiple AI providers with seamless mid-conversation switching.

## Supported Providers

| Provider     | Models                          | Vision | Tool Calling | Notes                                        |
| ------------ | ------------------------------- | ------ | ------------ | -------------------------------------------- |
| **Claude**   | Opus 4.5, Sonnet 4.5, Haiku 4.5 | Yes    | Yes          | Default provider, best for complex reasoning |
| **OpenAI**   | GPT-5, GPT-5 Turbo, O3          | Yes    | Yes          | Versatile general-purpose AI                 |
| **xAI**      | Grok 4, Grok 4 Vision           | Yes    | Yes          | Excels at real-time knowledge                |
| **DeepSeek** | V3.2, Coder V3.2                | No     | Yes          | Cost-effective coding assistant              |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Multi-Provider System                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Registry   │  │ Capabilities │  │    Error Handling    │   │
│  │  (configs)   │──│  (checking)  │──│  (retry/fallback)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         │                 │                     │                │
│         ▼                 ▼                     ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Adapters                              │   │
│  │  ┌────────────┐  ┌────────────────────────────────────┐  │   │
│  │  │ Anthropic  │  │        OpenAI-Compatible           │  │   │
│  │  │  Adapter   │  │  (OpenAI, xAI, DeepSeek)           │  │   │
│  │  └────────────┘  └────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Provider Service                         │   │
│  │  - Chat with auto-retry/fallback                          │   │
│  │  - Mid-conversation switching                             │   │
│  │  - Capability checking                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Context Handoff                          │   │
│  │  - Message conversion between providers                   │   │
│  │  - Context summarization for long conversations           │   │
│  │  - Capability degradation warnings                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Usage

```typescript
import { getProviderService, chat } from '@/lib/ai/providers';

// Get the default service
const service = getProviderService();

// Simple chat
const messages = [{ role: 'user', content: 'Hello!' }];
for await (const chunk of chat(messages)) {
  if (chunk.type === 'text') {
    console.log(chunk.text);
  }
}
```

### Provider Selection

```typescript
import { createProviderService } from '@/lib/ai/providers';

// Create a service with DeepSeek as default, Claude as fallback
const service = createProviderService('deepseek', 'claude');

// Chat with automatic fallback on errors
for await (const chunk of service.chat(messages, {
  enableFallback: true,
  enableRetry: true,
})) {
  // ...
}
```

### Mid-Conversation Switching

```typescript
// Switch provider mid-conversation
const result = await service.switchProvider(conversation, 'openai', { includeSystemPrompt: true });

console.log(result.warnings); // Capability warnings
console.log(result.metadata.wasSummarized); // If context was summarized
```

### API Route Integration

```typescript
import { createMultiProviderHandler } from '@/lib/ai/providers';

export const POST = createMultiProviderHandler({
  defaultProvider: 'claude',
  fallbackProvider: 'openai',
  enableFallback: true,
  beforeChat: async (req, messages) => {
    // Add system prompt, validate, etc.
    return messages;
  },
});
```

## Database Schema

The system tracks provider information in the database:

- `conversations.provider` - Current provider for the conversation
- `conversations.provider_history` - History of provider switches
- `messages.provider` - Provider that generated each message
- `code_lab_sessions.provider` - Provider for coding sessions
- `user_provider_preferences` - User's default provider settings

## UI Components

### Provider Selector

```tsx
import { CodeLabProviderSelector } from '@/components/code-lab';

<CodeLabProviderSelector
  currentProvider={provider}
  onProviderChange={setProvider}
  configuredProviders={['claude', 'openai']}
  showSwitchWarning={true}
/>;
```

### Provider Status

```tsx
import { CodeLabProviderStatus } from '@/components/code-lab';

<CodeLabProviderStatus
  providerId={currentProvider}
  isProcessing={loading}
  onClick={() => setShowSelector(true)}
/>;
```

## Environment Variables

```bash
# Required for each provider
ANTHROPIC_API_KEY=your-key      # Claude
OPENAI_API_KEY=your-key         # OpenAI
XAI_API_KEY=your-key            # xAI Grok
DEEPSEEK_API_KEY=your-key       # DeepSeek
```

## Error Handling

The system provides unified error handling across all providers:

- **Rate limiting**: Auto-retry with exponential backoff
- **Context too long**: Auto-summarization
- **Provider unavailable**: Automatic fallback to secondary provider
- **Auth failures**: Clear error messages

## Testing

Run the multi-provider test suite:

```bash
pnpm test src/lib/ai/providers/providers.test.ts
```

## Migration

Apply the database migration:

```sql
-- Run the migration
\i supabase/migrations/20260120_add_provider_tracking.sql
```

## Keyboard Shortcuts

- `Cmd+Shift+P` / `Ctrl+Shift+P` - Open provider selector
