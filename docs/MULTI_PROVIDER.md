# Multi-Provider AI System

JCIL Code Lab supports multiple AI providers with seamless mid-conversation switching.

## Supported Providers

| Provider     | Models                              | Vision | Tool Calling | Notes                                        |
| ------------ | ----------------------------------- | ------ | ------------ | -------------------------------------------- |
| **Claude**   | Opus 4.5, Sonnet 4.5, Haiku 4.5     | Yes    | Yes          | Default provider, best for complex reasoning |
| **OpenAI**   | GPT-5.2, GPT-5.2 Codex, GPT-5.2 Pro | Yes    | Yes          | Latest GPT models with strong coding         |
| **xAI**      | Grok 4, Grok 4 Vision               | Yes    | Yes          | Excels at real-time knowledge                |
| **DeepSeek** | V3.2, Coder V3.2                    | No     | Yes          | Cost-effective coding assistant              |

## Model Pricing Reference (Base Costs)

These are the base costs from each provider. JCIL pricing may differ.

### Claude (Anthropic)

| Model ID                    | Name      | Best For       | Input / 1M | Output / 1M |
| --------------------------- | --------- | -------------- | ---------- | ----------- |
| `claude-opus-4-5-20251101`  | Opus 4.5  | Most capable   | $15.00     | $75.00      |
| `claude-sonnet-4-20250514`  | Sonnet 4  | Fast & capable | $3.00      | $15.00      |
| `claude-3-5-haiku-20241022` | Haiku 3.5 | Fastest        | $0.25      | $1.25       |

**Extended Thinking variants** - Same pricing but with additional thinking budget tokens.

### OpenAI GPT

| Model ID             | Name               | Best For                   | Input / 1M | Output / 1M |
| -------------------- | ------------------ | -------------------------- | ---------- | ----------- |
| `gpt-5.2-codex`      | GPT-5.2 Codex      | Top coding & multi-file    | $1.75      | $14.00      |
| `gpt-5.2`            | GPT-5.2            | All-around + strong coding | $1.75      | $14.00      |
| `gpt-5.1-codex-max`  | GPT-5.1 Codex Max  | Strong, cheaper coding     | $1.25      | $10.00      |
| `gpt-5.1-codex-mini` | GPT-5.1 Codex Mini | Budget coding / tooling    | $0.25      | $2.00       |
| `gpt-5.2-pro`        | GPT-5.2 Pro        | Ultra-hard reasoning/code  | ~$21.00    | ~$168.00    |

### xAI Grok (Coming Soon)

| Model ID        | Name          | Best For            | Input / 1M | Output / 1M |
| --------------- | ------------- | ------------------- | ---------- | ----------- |
| `grok-4`        | Grok 4        | Real-time knowledge | TBD        | TBD         |
| `grok-4-vision` | Grok 4 Vision | Vision + knowledge  | TBD        | TBD         |

### DeepSeek (Coming Soon)

| Model ID              | Name           | Best For          | Input / 1M | Output / 1M |
| --------------------- | -------------- | ----------------- | ---------- | ----------- |
| `deepseek-v3.2`       | DeepSeek V3.2  | Cost-effective AI | TBD        | TBD         |
| `deepseek-coder-v3.2` | DeepSeek Coder | Budget coding     | TBD        | TBD         |

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
ANTHROPIC_API_KEY=your-key      # Claude (primary)
OPENAI_API_KEY=your-key         # OpenAI
XAI_API_KEY=your-key            # xAI Grok (fallback)
DEEPSEEK_API_KEY=your-key       # DeepSeek

# Search providers
BRAVE_SEARCH_API_KEY=your-key   # Brave Search (main chat search/factcheck)
PERPLEXITY_API_KEY=your-key     # Perplexity (Research Agent only)
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

## Agentic Interface

The multi-provider system includes a simplified agentic interface for building autonomous agents. This allows all Code Lab agents (CodeAgent, ResearchAgent, ToolOrchestrator) to work with any provider.

### Simple Chat (Brain Modules)

For AI modules that just need text responses:

```typescript
import { agentChat, ProviderId } from '@/lib/ai/providers';

class MyBrainModule {
  private provider: ProviderId = 'claude';

  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  async analyze(input: string): Promise<string> {
    const response = await agentChat([{ role: 'user', content: input }], {
      provider: this.provider,
      maxTokens: 4000,
    });
    return response.text;
  }
}
```

### Tool Calling (Autonomous Agents)

For agentic loops that need to call tools:

```typescript
import {
  agentChatWithTools,
  buildToolResultMessage,
  buildToolCallMessage,
  ProviderId,
  UnifiedMessage,
  UnifiedTool,
} from '@/lib/ai/providers';

class MyAgent {
  private provider: ProviderId = 'claude';
  private tools: UnifiedTool[] = [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
    },
  ];

  async execute(task: string): Promise<string> {
    const messages: UnifiedMessage[] = [{ role: 'user', content: task }];

    while (true) {
      const response = await agentChatWithTools(messages, this.tools, {
        provider: this.provider,
        maxTokens: 8192,
      });

      // Done - no more tool calls
      if (response.done) {
        return response.text;
      }

      // Execute tool calls
      const results = [];
      for (const call of response.toolCalls) {
        const result = await this.executeTool(call.name, call.arguments);
        results.push({
          toolCallId: call.id,
          content: JSON.stringify(result),
        });
      }

      // Add to message history
      messages.push(buildToolCallMessage(response.toolCalls));
      messages.push(buildToolResultMessage(results));
    }
  }
}
```

### Updated Agent Files

All Code Lab agents now use the multi-provider system:

| Module               | Location                                    | Uses                 |
| -------------------- | ------------------------------------------- | -------------------- |
| IntentAnalyzer       | `src/agents/code/brain/IntentAnalyzer.ts`   | `agentChat`          |
| ProjectPlanner       | `src/agents/code/brain/ProjectPlanner.ts`   | `agentChat`          |
| CodeGenerator        | `src/agents/code/brain/CodeGenerator.ts`    | `agentChat`          |
| ErrorAnalyzer        | `src/agents/code/brain/ErrorAnalyzer.ts`    | `agentChat`          |
| AutoFixer            | `src/agents/code/brain/AutoFixer.ts`        | `agentChat`          |
| TestGenerator        | `src/agents/code/brain/TestGenerator.ts`    | `agentChat`          |
| DocGenerator         | `src/agents/code/brain/DocGenerator.ts`     | `agentChat`          |
| SecurityScanner      | `src/agents/code/brain/SecurityScanner.ts`  | `agentChat`          |
| PerformanceAnalyzer  | `src/agents/code/brain/PerformanceAnalyzer` | `agentChat`          |
| Reasoner             | `src/agents/code/brain/Reasoner.ts`         | `agentChat`          |
| **ToolOrchestrator** | `src/agents/code/tools/ToolOrchestrator.ts` | `agentChatWithTools` |

Each module has a `setProvider(provider: ProviderId)` method to switch providers.
