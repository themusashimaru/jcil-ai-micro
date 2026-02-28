import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// We need a configurable mock for the Anthropic SDK so individual tests can
// control what `client.messages.create` / `client.messages.stream` return.
const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  })),
}));

// Mock Supabase for downloadAnthropicFile
const mockSupabaseSingle = vi.fn();
const mockSupabaseDownload = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSupabaseSingle,
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        download: mockSupabaseDownload,
      })),
    },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers — default successful response
// ---------------------------------------------------------------------------
function makeTextResponse(text: string, extras?: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text }],
    model: 'claude-haiku-4-5-20251001',
    usage: { input_tokens: 10, output_tokens: 20 },
    stop_reason: 'end_turn',
    ...extras,
  };
}

function makeToolUseResponse(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolId = 'tool_123',
  textBefore = ''
) {
  const content: Array<Record<string, unknown>> = [];
  if (textBefore) {
    content.push({ type: 'text', text: textBefore });
  }
  content.push({ type: 'tool_use', id: toolId, name: toolName, input: toolInput });
  return {
    content,
    model: 'claude-haiku-4-5-20251001',
    usage: { input_tokens: 10, output_tokens: 20 },
    stop_reason: 'tool_use',
  };
}

// ---------------------------------------------------------------------------
// Clean module state between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // Clear env vars that affect key pools
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ===================================================================
// 1. EXPORTS & CONSTANTS
// ===================================================================

describe('Anthropic Client — Exports & Constants', () => {
  it('exports CLAUDE_HAIKU constant with correct model id', async () => {
    const { CLAUDE_HAIKU } = await import('./client');
    expect(CLAUDE_HAIKU).toBe('claude-haiku-4-5-20251001');
  });

  it('exports CLAUDE_SONNET constant with correct model id', async () => {
    const { CLAUDE_SONNET } = await import('./client');
    expect(CLAUDE_SONNET).toBe('claude-sonnet-4-6');
  });

  it('exports isAnthropicConfigured as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { isAnthropicConfigured } = await import('./client');
    expect(typeof isAnthropicConfigured).toBe('function');
  });

  it('exports getAnthropicKeyStats as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { getAnthropicKeyStats } = await import('./client');
    expect(typeof getAnthropicKeyStats).toBe('function');
  });

  it('exports createAnthropicCompletion as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createAnthropicCompletion } = await import('./client');
    expect(typeof createAnthropicCompletion).toBe('function');
  });

  it('exports createAnthropicStreamingCompletion as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createAnthropicStreamingCompletion } = await import('./client');
    expect(typeof createAnthropicStreamingCompletion).toBe('function');
  });

  it('exports createAnthropicCompletionWithSearch as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createAnthropicCompletionWithSearch } = await import('./client');
    expect(typeof createAnthropicCompletionWithSearch).toBe('function');
  });

  it('exports createAnthropicCompletionWithSkills as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createAnthropicCompletionWithSkills } = await import('./client');
    expect(typeof createAnthropicCompletionWithSkills).toBe('function');
  });

  it('exports downloadAnthropicFile as a function', async () => {
    const { downloadAnthropicFile } = await import('./client');
    expect(typeof downloadAnthropicFile).toBe('function');
  });

  it('exports isImageGenerationRequest as a function', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(typeof isImageGenerationRequest).toBe('function');
  });

  it('exports detectDocumentRequest as a function', async () => {
    const { detectDocumentRequest } = await import('./client');
    expect(typeof detectDocumentRequest).toBe('function');
  });

  it('exports selectClaudeModel as a function', async () => {
    const { selectClaudeModel } = await import('./client');
    expect(typeof selectClaudeModel).toBe('function');
  });

  it('exports createClaudeStreamingChat as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createClaudeStreamingChat } = await import('./client');
    expect(typeof createClaudeStreamingChat).toBe('function');
  });

  it('exports createClaudeChat as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createClaudeChat } = await import('./client');
    expect(typeof createClaudeChat).toBe('function');
  });

  it('exports createClaudeStructuredOutput as a function', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createClaudeStructuredOutput } = await import('./client');
    expect(typeof createClaudeStructuredOutput).toBe('function');
  });
});

// ===================================================================
// 2. API KEY MANAGEMENT
// ===================================================================

describe('Anthropic Client — API Key Management', () => {
  describe('isAnthropicConfigured', () => {
    it('returns true when single ANTHROPIC_API_KEY is set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-single');
      const { isAnthropicConfigured } = await import('./client');
      expect(isAnthropicConfigured()).toBe(true);
    });

    it('returns true when numbered primary keys are set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY_1', 'sk-ant-1');
      vi.stubEnv('ANTHROPIC_API_KEY_2', 'sk-ant-2');
      const { isAnthropicConfigured } = await import('./client');
      expect(isAnthropicConfigured()).toBe(true);
    });

    it('returns true when only fallback keys are set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY_FALLBACK_1', 'sk-ant-fb-1');
      // Need a primary key for it to be "configured" — but let's check
      // Actually fallback-only should also return true per source code
      const { isAnthropicConfigured } = await import('./client');
      // The source checks `primaryPool.length > 0 || fallbackPool.length > 0`
      expect(isAnthropicConfigured()).toBe(true);
    });

    it('returns false when no keys are configured', async () => {
      // Ensure no anthropic env vars are set
      const { isAnthropicConfigured } = await import('./client');
      expect(isAnthropicConfigured()).toBe(false);
    });
  });

  describe('getAnthropicKeyStats', () => {
    it('returns correct stats for single key', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-single');
      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();

      expect(stats.primaryKeys).toBe(1);
      expect(stats.primaryAvailable).toBe(1);
      expect(stats.fallbackKeys).toBe(0);
      expect(stats.fallbackAvailable).toBe(0);
      expect(stats.totalKeys).toBe(1);
      expect(stats.totalAvailable).toBe(1);
    });

    it('returns correct stats for multiple primary + fallback keys', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY_1', 'key1');
      vi.stubEnv('ANTHROPIC_API_KEY_2', 'key2');
      vi.stubEnv('ANTHROPIC_API_KEY_3', 'key3');
      vi.stubEnv('ANTHROPIC_API_KEY_FALLBACK_1', 'fb1');
      vi.stubEnv('ANTHROPIC_API_KEY_FALLBACK_2', 'fb2');
      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();

      expect(stats.primaryKeys).toBe(3);
      expect(stats.fallbackKeys).toBe(2);
      expect(stats.totalKeys).toBe(5);
      expect(stats.totalAvailable).toBe(5);
    });

    it('returns zero stats when no keys are configured', async () => {
      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();

      expect(stats.primaryKeys).toBe(0);
      expect(stats.fallbackKeys).toBe(0);
      expect(stats.totalKeys).toBe(0);
      expect(stats.totalAvailable).toBe(0);
    });

    it('stops scanning numbered keys when a gap is found', async () => {
      // Only set _1 and _2, skip _3 — pool should have 2 keys
      vi.stubEnv('ANTHROPIC_API_KEY_1', 'key1');
      vi.stubEnv('ANTHROPIC_API_KEY_2', 'key2');
      // _3 is intentionally missing
      vi.stubEnv('ANTHROPIC_API_KEY_4', 'key4'); // should NOT be detected
      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();

      expect(stats.primaryKeys).toBe(2);
    });

    it('does not use single ANTHROPIC_API_KEY when numbered keys exist', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-single');
      vi.stubEnv('ANTHROPIC_API_KEY_1', 'sk-ant-1');
      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();

      // Should have only 1 key (from numbered), not 2
      expect(stats.primaryKeys).toBe(1);
    });
  });
});

// ===================================================================
// 3. isImageGenerationRequest
// ===================================================================

describe('Anthropic Client — isImageGenerationRequest', () => {
  it('detects "create an image" requests', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('create an image of a sunset')).toBe(true);
  });

  it('detects "generate a picture" requests', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('generate a picture of a cat')).toBe(true);
  });

  it('detects "draw an illustration" requests', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('draw an illustration of a tree')).toBe(true);
  });

  it('detects DALL-E mentions', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('use dall-e to make art')).toBe(true);
  });

  it('detects Midjourney mentions', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('create this in midjourney style')).toBe(true);
  });

  it('detects Stable Diffusion mentions', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('use stable diffusion for this')).toBe(true);
  });

  it('detects "image of" pattern', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('I want an image of a dog')).toBe(true);
  });

  it('returns false for regular text requests', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('explain quantum physics')).toBe(false);
  });

  it('returns false for code requests about images', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('write a function to process images')).toBe(false);
  });

  it('returns false for empty string', async () => {
    const { isImageGenerationRequest } = await import('./client');
    expect(isImageGenerationRequest('')).toBe(false);
  });
});

// ===================================================================
// 4. detectDocumentRequest
// ===================================================================

describe('Anthropic Client — detectDocumentRequest', () => {
  it('detects Excel/spreadsheet requests and returns xlsx', async () => {
    const { detectDocumentRequest } = await import('./client');
    expect(detectDocumentRequest('create an excel spreadsheet')).toBe('xlsx');
    expect(detectDocumentRequest('make me a budget spreadsheet')).toBe('xlsx');
    expect(detectDocumentRequest('I need a financial tracker')).toBe('xlsx');
  });

  it('detects PowerPoint/presentation requests and returns pptx', async () => {
    const { detectDocumentRequest } = await import('./client');
    expect(detectDocumentRequest('create a powerpoint presentation')).toBe('pptx');
    expect(detectDocumentRequest('make slides for my pitch')).toBe('pptx');
    expect(detectDocumentRequest('generate a slide deck')).toBe('pptx');
  });

  it('detects Word document requests and returns docx', async () => {
    const { detectDocumentRequest } = await import('./client');
    expect(detectDocumentRequest('write a word document')).toBe('docx');
    expect(detectDocumentRequest('create a resume for me')).toBe('docx');
    expect(detectDocumentRequest('write a cover letter')).toBe('docx');
    expect(detectDocumentRequest('create a professional resume')).toBe('docx');
  });

  it('detects PDF requests and returns pdf', async () => {
    const { detectDocumentRequest } = await import('./client');
    expect(detectDocumentRequest('create a pdf invoice')).toBe('pdf');
    expect(detectDocumentRequest('generate an invoice for client')).toBe('pdf');
    expect(detectDocumentRequest('make a receipt')).toBe('pdf');
  });

  it('returns null for non-document requests', async () => {
    const { detectDocumentRequest } = await import('./client');
    expect(detectDocumentRequest('explain quantum physics')).toBeNull();
    expect(detectDocumentRequest('write some code')).toBeNull();
    expect(detectDocumentRequest('hello world')).toBeNull();
    expect(detectDocumentRequest('')).toBeNull();
  });
});

// ===================================================================
// 5. selectClaudeModel
// ===================================================================

describe('Anthropic Client — selectClaudeModel', () => {
  it('returns Haiku by default for regular chat', async () => {
    const { selectClaudeModel, CLAUDE_HAIKU } = await import('./client');
    expect(selectClaudeModel('hello')).toBe(CLAUDE_HAIKU);
    expect(selectClaudeModel('explain relativity')).toBe(CLAUDE_HAIKU);
  });

  it('returns Haiku even for long/complex messages', async () => {
    const { selectClaudeModel, CLAUDE_HAIKU } = await import('./client');
    const longContent = 'a'.repeat(5000);
    expect(selectClaudeModel(longContent)).toBe(CLAUDE_HAIKU);
  });

  it('returns Sonnet for document generation', async () => {
    const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
    expect(selectClaudeModel('anything', { isDocumentGeneration: true })).toBe(CLAUDE_SONNET);
  });

  it('respects forceModel=haiku override', async () => {
    const { selectClaudeModel, CLAUDE_HAIKU } = await import('./client');
    expect(selectClaudeModel('anything', { forceModel: 'haiku' })).toBe(CLAUDE_HAIKU);
    // Even when isDocumentGeneration is true, forceModel takes priority
    expect(selectClaudeModel('anything', { forceModel: 'haiku', isDocumentGeneration: true })).toBe(
      CLAUDE_HAIKU
    );
  });

  it('respects forceModel=sonnet override', async () => {
    const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
    expect(selectClaudeModel('hi', { forceModel: 'sonnet' })).toBe(CLAUDE_SONNET);
  });

  it('returns Haiku when isResearch is true but no forceModel', async () => {
    const { selectClaudeModel, CLAUDE_HAIKU } = await import('./client');
    expect(selectClaudeModel('research topic', { isResearch: true })).toBe(CLAUDE_HAIKU);
  });

  it('returns Haiku when isFaithTopic is true but no forceModel', async () => {
    const { selectClaudeModel, CLAUDE_HAIKU } = await import('./client');
    expect(selectClaudeModel('faith topic', { isFaithTopic: true })).toBe(CLAUDE_HAIKU);
  });

  it('handles empty options object', async () => {
    const { selectClaudeModel, CLAUDE_HAIKU } = await import('./client');
    expect(selectClaudeModel('test', {})).toBe(CLAUDE_HAIKU);
  });
});

// ===================================================================
// 6. createAnthropicCompletion
// ===================================================================

describe('Anthropic Client — createAnthropicCompletion', () => {
  it('returns text from a successful completion', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('Hello from Claude'));

    const { createAnthropicCompletion } = await import('./client');
    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.text).toBe('Hello from Claude');
    expect(result.model).toBe('claude-haiku-4-5-20251001'); // DEFAULT_MODEL
  });

  it('uses provided model, maxTokens, temperature, and systemPrompt', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('response'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
      model: 'claude-sonnet-4-6',
      maxTokens: 8192,
      temperature: 0.5,
      systemPrompt: 'Be helpful.',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        temperature: 0.5,
      })
    );
  });

  it('uses defaults when optional params are omitted', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        temperature: 0.7,
      })
    );
  });

  it('joins multiple text blocks with newline', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Part 1' },
        { type: 'text', text: 'Part 2' },
      ],
      model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const { createAnthropicCompletion } = await import('./client');
    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.text).toBe('Part 1\nPart 2');
  });

  it('throws when no API keys are configured', async () => {
    // No env vars set
    const { createAnthropicCompletion } = await import('./client');
    await expect(
      createAnthropicCompletion({
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('ANTHROPIC_API_KEY is not configured');
  });

  it('retries on rate limit error and succeeds on second attempt', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY_1', 'key1');
    vi.stubEnv('ANTHROPIC_API_KEY_2', 'key2');

    mockCreate
      .mockRejectedValueOnce(new Error('rate_limit exceeded'))
      .mockResolvedValueOnce(makeTextResponse('Success after retry'));

    const { createAnthropicCompletion } = await import('./client');
    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.text).toBe('Success after retry');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('throws after all retry attempts exhausted on rate limit', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'single-key');

    mockCreate.mockRejectedValue(new Error('rate_limit exceeded'));

    const { createAnthropicCompletion } = await import('./client');
    await expect(
      createAnthropicCompletion({
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('rate_limit');
  });

  it('extracts retry-after from error message', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY_1', 'key1');
    vi.stubEnv('ANTHROPIC_API_KEY_2', 'key2');

    mockCreate
      .mockRejectedValueOnce(new Error('rate_limit retry-after: 30'))
      .mockResolvedValueOnce(makeTextResponse('Ok'));

    const { createAnthropicCompletion } = await import('./client');
    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.text).toBe('Ok');
  });

  it('retries with exponential backoff on non-rate-limit errors', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY_1', 'key1');
    vi.stubEnv('ANTHROPIC_API_KEY_2', 'key2');

    mockCreate
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(makeTextResponse('Recovered'));

    const { createAnthropicCompletion } = await import('./client');
    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.text).toBe('Recovered');
  });

  it('handles non-Error thrown values by wrapping in Error', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'key1');

    mockCreate.mockRejectedValueOnce('string error');

    const { createAnthropicCompletion } = await import('./client');
    await expect(
      createAnthropicCompletion({
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('string error');
  });

  it('converts system messages correctly — system messages are excluded from message array', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'hello' },
      ],
    });

    // System messages are filtered out; only the user message should appear
    const callArgs = mockCreate.mock.calls[0][0];
    const msgRoles = callArgs.messages.map((m: { role: string }) => m.role);
    expect(msgRoles).not.toContain('system');
    expect(msgRoles).toContain('user');
  });

  it('handles multimodal content with base64 images', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('I see an image'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
          ] as unknown as string,
        },
      ],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages[0];
    // Should have converted the image content
    expect(Array.isArray(userMsg.content)).toBe(true);
  });

  it('defaults unknown image media types to image/png', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [
        {
          role: 'user',
          content: [{ type: 'image', image: 'data:image/bmp;base64,AAAA' }] as unknown as string,
        },
      ],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages[0];
    if (Array.isArray(userMsg.content)) {
      const imagePart = userMsg.content.find((p: Record<string, unknown>) => p.type === 'image');
      if (imagePart) {
        expect((imagePart as { source: { media_type: string } }).source.media_type).toBe(
          'image/png'
        );
      }
    }
  });

  it('skips empty string messages', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [
        { role: 'user', content: '' },
        { role: 'user', content: 'real message' },
      ],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    // The empty message should have been skipped
    expect(callArgs.messages.length).toBe(1);
    expect(callArgs.messages[0].content).toBe('real message');
  });

  it('uses prompt caching by default (system is an array with cache_control)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'Be helpful.',
    });

    const callArgs = mockCreate.mock.calls[0][0];
    // System should be an array with cache_control
    expect(Array.isArray(callArgs.system)).toBe(true);
    expect(callArgs.system[0]).toHaveProperty('cache_control');
    expect(callArgs.system[0].text).toBe('Be helpful.');
  });
});

// ===================================================================
// 7. createAnthropicCompletionWithSearch
// ===================================================================

describe('Anthropic Client — createAnthropicCompletionWithSearch', () => {
  it('falls back to regular completion when no webSearchFn provided', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('No search needed'));

    const { createAnthropicCompletionWithSearch } = await import('./client');
    const result = await createAnthropicCompletionWithSearch({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.text).toBe('No search needed');
    expect(result.citations).toEqual([]);
    expect(result.numSourcesUsed).toBe(0);
  });

  it('executes web search when model requests tool_use', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    // First call: model wants to search
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('web_search', { query: 'latest news' }, 'tool_1'))
      // Second call: model provides final answer
      .mockResolvedValueOnce(makeTextResponse('Here are the results'));

    const mockSearchFn = vi.fn().mockResolvedValue({
      results: [{ title: 'News Article', url: 'https://example.com', description: 'Latest news' }],
      query: 'latest news',
    });

    const { createAnthropicCompletionWithSearch } = await import('./client');
    const result = await createAnthropicCompletionWithSearch({
      messages: [{ role: 'user', content: 'what is the latest news?' }],
      webSearchFn: mockSearchFn,
    });

    expect(result.text).toBe('Here are the results');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].title).toBe('News Article');
    expect(result.numSourcesUsed).toBe(1);
    expect(mockSearchFn).toHaveBeenCalledWith('latest news');
  });

  it('handles web search errors gracefully', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('web_search', { query: 'test' }, 'tool_err'))
      .mockResolvedValueOnce(makeTextResponse('Based on my knowledge'));

    const mockSearchFn = vi.fn().mockRejectedValue(new Error('Search API down'));

    const { createAnthropicCompletionWithSearch } = await import('./client');
    const result = await createAnthropicCompletionWithSearch({
      messages: [{ role: 'user', content: 'search this' }],
      webSearchFn: mockSearchFn,
    });

    expect(result.text).toBe('Based on my knowledge');
    expect(result.citations).toEqual([]);
  });

  it('respects maxIterations (3) to prevent infinite loops', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    // Model always requests search — should stop after 3 iterations
    mockCreate.mockResolvedValue(makeToolUseResponse('web_search', { query: 'loop' }, 'tool_loop'));

    const mockSearchFn = vi.fn().mockResolvedValue({
      results: [{ title: 'Result', url: 'https://ex.com', description: 'desc' }],
      query: 'loop',
    });

    const { createAnthropicCompletionWithSearch } = await import('./client');
    const result = await createAnthropicCompletionWithSearch({
      messages: [{ role: 'user', content: 'keep searching' }],
      webSearchFn: mockSearchFn,
    });

    expect(result.text).toContain('unable to complete the search');
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});

// ===================================================================
// 8. createAnthropicCompletionWithSkills
// ===================================================================

describe('Anthropic Client — createAnthropicCompletionWithSkills', () => {
  it('returns text when model does not use tools', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('Direct answer'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'hello' }],
      skills: ['web_search'],
    });

    expect(result.text).toBe('Direct answer');
    expect(result.files).toEqual([]);
  });

  it('handles web_search skill with webSearchFn', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('web_search', { query: 'AI news' }, 'ws_1'))
      .mockResolvedValueOnce(makeTextResponse('Search results synthesized'));

    const mockSearchFn = vi.fn().mockResolvedValue({
      results: [{ title: 'AI Article', url: 'https://ai.com', description: 'Latest AI' }],
      query: 'AI news',
    });

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'AI news' }],
      skills: ['web_search'],
      webSearchFn: mockSearchFn,
    });

    expect(result.text).toBe('Search results synthesized');
  });

  it('handles web_search without webSearchFn', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('web_search', { query: 'test' }, 'ws_no'))
      .mockResolvedValueOnce(makeTextResponse('No search available'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'search' }],
      skills: ['web_search'],
    });

    expect(result.text).toBe('No search available');
  });

  it('handles code_analysis skill', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse(
          'code_analysis',
          { code: 'console.log(1)', language: 'javascript', focus: 'bugs' },
          'ca_1'
        )
      )
      .mockResolvedValueOnce(makeTextResponse('Code looks fine'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'review my code' }],
      skills: ['code_analysis'],
    });

    expect(result.text).toBe('Code looks fine');
  });

  it('handles generate_document skill and tracks files', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse(
          'generate_document',
          { type: 'pdf', title: 'Invoice', content: '{}' },
          'gd_1'
        )
      )
      .mockResolvedValueOnce(makeTextResponse('Document created'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'create an invoice' }],
      skills: ['generate_document'],
    });

    expect(result.text).toBe('Document created');
    expect(result.files).toHaveLength(1);
    expect(result.files![0].filename).toBe('Invoice.pdf');
    expect(result.files![0].mime_type).toBe('application/pdf');
  });

  it('handles generate_document with docx type', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse(
          'generate_document',
          { type: 'docx', title: 'Resume', content: '{}' },
          'gd_2'
        )
      )
      .mockResolvedValueOnce(makeTextResponse('Resume created'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'make a resume' }],
      skills: ['generate_document'],
    });

    expect(result.files![0].mime_type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('handles generate_document with xlsx type', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse(
          'generate_document',
          { type: 'xlsx', title: 'Budget', content: '{}' },
          'gd_3'
        )
      )
      .mockResolvedValueOnce(makeTextResponse('Spreadsheet created'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'create a budget spreadsheet' }],
      skills: ['generate_document'],
    });

    expect(result.files![0].mime_type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('handles unknown tool name', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('unknown_tool', { data: 'test' }, 'ut_1'))
      .mockResolvedValueOnce(makeTextResponse('Handled unknown'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'test' }],
      skills: ['unknown_tool'],
    });

    expect(result.text).toBe('Handled unknown');
  });

  it('handles tool execution errors', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    // Make webSearchFn throw
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('web_search', { query: 'test' }, 'ws_err'))
      .mockResolvedValueOnce(makeTextResponse('Recovered from error'));

    const mockSearchFn = vi.fn().mockRejectedValue(new Error('Search failed'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'search' }],
      skills: ['web_search'],
      webSearchFn: mockSearchFn,
    });

    expect(result.text).toBe('Recovered from error');
  });

  it('stops after maxIterations (5)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockCreate.mockResolvedValue(makeToolUseResponse('web_search', { query: 'loop' }, 'loop_1'));

    const mockSearchFn = vi.fn().mockResolvedValue({
      results: [{ title: 'R', url: 'https://r.com', description: 'd' }],
      query: 'loop',
    });

    const { createAnthropicCompletionWithSkills } = await import('./client');
    const result = await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'loop' }],
      skills: ['web_search'],
      webSearchFn: mockSearchFn,
    });

    expect(result.text).toContain('Maximum iterations reached');
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });

  it('does not pass tools when skills array is empty', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('No skills'));

    const { createAnthropicCompletionWithSkills } = await import('./client');
    await createAnthropicCompletionWithSkills({
      messages: [{ role: 'user', content: 'test' }],
      skills: [],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tools).toBeUndefined();
  });
});

// ===================================================================
// 9. downloadAnthropicFile
// ===================================================================

describe('Anthropic Client — downloadAnthropicFile', () => {
  it('throws for invalid file ID format', async () => {
    const { downloadAnthropicFile } = await import('./client');
    await expect(downloadAnthropicFile('invalid_id')).rejects.toThrow('Invalid file ID format');
  });

  it('throws when file is not found in database', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');

    mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const { downloadAnthropicFile } = await import('./client');
    await expect(downloadAnthropicFile('doc_123_abc')).rejects.toThrow('File not found');
  });

  it('throws when download from storage fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');

    mockSupabaseSingle.mockResolvedValueOnce({
      data: { filename: 'test.pdf', mime_type: 'application/pdf', storage_path: 'docs/test.pdf' },
      error: null,
    });
    mockSupabaseDownload.mockResolvedValueOnce({
      data: null,
      error: { message: 'Download failed' },
    });

    const { downloadAnthropicFile } = await import('./client');
    await expect(downloadAnthropicFile('doc_123_abc')).rejects.toThrow('Failed to download file');
  });

  it('returns file data on successful download', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');

    const mockArrayBuffer = new ArrayBuffer(8);
    const mockBlob = { arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer) };

    mockSupabaseSingle.mockResolvedValueOnce({
      data: {
        filename: 'invoice.pdf',
        mime_type: 'application/pdf',
        storage_path: 'docs/invoice.pdf',
      },
      error: null,
    });
    mockSupabaseDownload.mockResolvedValueOnce({ data: mockBlob, error: null });

    const { downloadAnthropicFile } = await import('./client');
    const result = await downloadAnthropicFile('doc_456_xyz');

    expect(result.filename).toBe('invoice.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.data).toBe(mockArrayBuffer);
  });
});

// ===================================================================
// 10. createClaudeChat (non-streaming wrapper)
// ===================================================================

describe('Anthropic Client — createClaudeChat', () => {
  it('returns text and model from a successful non-streaming completion', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('Chat response'));

    const { createClaudeChat } = await import('./client');
    const result = await createClaudeChat({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.text).toBe('Chat response');
    expect(result.model).toBeDefined();
  });

  it('uses forceModel when specified', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('Sonnet response'));

    const { createClaudeChat } = await import('./client');
    const result = await createClaudeChat({
      messages: [{ role: 'user', content: 'complex' }],
      forceModel: 'sonnet',
    });

    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('extracts last user message content for model selection', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createClaudeChat } = await import('./client');
    await createClaudeChat({
      messages: [
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'response' },
        { role: 'user', content: 'second message' },
      ],
    });

    // Should work without errors — model selection uses last user message
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('handles messages with array content (non-string) for model selection', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createClaudeChat } = await import('./client');
    await createClaudeChat({
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'multimodal' }] as unknown as string,
        },
      ],
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('handles empty messages array', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('empty'));

    const { createClaudeChat } = await import('./client');
    const result = await createClaudeChat({ messages: [] });

    expect(result.text).toBe('empty');
  });
});

// ===================================================================
// 11. createClaudeStructuredOutput
// ===================================================================

describe('Anthropic Client — createClaudeStructuredOutput', () => {
  it('parses valid JSON response', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('{"name": "John", "age": 30}'));

    const { createClaudeStructuredOutput } = await import('./client');
    const result = await createClaudeStructuredOutput<{ name: string; age: number }>({
      messages: [{ role: 'user', content: 'give me user data' }],
      systemPrompt: 'Return JSON',
      schema: { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } } },
    });

    expect(result.data).toEqual({ name: 'John', age: 30 });
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('strips markdown json wrapper before parsing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('```json\n{"key": "value"}\n```'));

    const { createClaudeStructuredOutput } = await import('./client');
    const result = await createClaudeStructuredOutput<{ key: string }>({
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'Return JSON',
      schema: { type: 'object' },
    });

    expect(result.data).toEqual({ key: 'value' });
  });

  it('strips generic markdown code block wrapper', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('```\n{"key": "value2"}\n```'));

    const { createClaudeStructuredOutput } = await import('./client');
    const result = await createClaudeStructuredOutput<{ key: string }>({
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'Return JSON',
      schema: { type: 'object' },
    });

    expect(result.data).toEqual({ key: 'value2' });
  });

  it('throws on invalid JSON response', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('This is not JSON'));

    const { createClaudeStructuredOutput } = await import('./client');
    await expect(
      createClaudeStructuredOutput({
        messages: [{ role: 'user', content: 'test' }],
        systemPrompt: 'Return JSON',
        schema: { type: 'object' },
      })
    ).rejects.toThrow('Failed to parse Claude structured output as JSON');
  });

  it('always uses CLAUDE_SONNET model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('{"ok": true}'));

    const { createClaudeStructuredOutput } = await import('./client');
    await createClaudeStructuredOutput({
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'Return JSON',
      schema: { type: 'object' },
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-6');
    expect(callArgs.temperature).toBe(0.3);
  });

  it('includes schema in system prompt sent to API', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('{"a": 1}'));

    const schema = { type: 'object', properties: { a: { type: 'number' } } };
    const { createClaudeStructuredOutput } = await import('./client');
    await createClaudeStructuredOutput({
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'Be structured',
      schema,
    });

    const callArgs = mockCreate.mock.calls[0][0];
    // The system prompt should contain the schema JSON
    expect(callArgs.system).toContain('"type": "object"');
    expect(callArgs.system).toContain('valid JSON only');
  });
});

// ===================================================================
// 12. createAnthropicStreamingCompletion
// ===================================================================

describe('Anthropic Client — createAnthropicStreamingCompletion', () => {
  it('returns a toTextStreamResponse function and model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    // Mock stream that yields text deltas
    mockStream.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' World' } };
      },
    });

    const { createAnthropicStreamingCompletion } = await import('./client');
    const result = await createAnthropicStreamingCompletion({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(typeof result.toTextStreamResponse).toBe('function');
  });

  it('toTextStreamResponse returns a Response with correct headers', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockStream.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Test' } };
      },
    });

    const { createAnthropicStreamingCompletion } = await import('./client');
    const result = await createAnthropicStreamingCompletion({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const response = result.toTextStreamResponse();
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
  });

  it('toTextStreamResponse merges custom headers', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockStream.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'x' } };
      },
    });

    const { createAnthropicStreamingCompletion } = await import('./client');
    const result = await createAnthropicStreamingCompletion({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const response = result.toTextStreamResponse({
      headers: { 'X-Custom': 'value' },
    });
    expect(response.headers.get('X-Custom')).toBe('value');
  });

  it('throws when no API keys are configured', async () => {
    const { createAnthropicStreamingCompletion } = await import('./client');
    await expect(
      createAnthropicStreamingCompletion({
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('ANTHROPIC_API_KEY is not configured');
  });
});

// ===================================================================
// 13. createClaudeStreamingChat
// ===================================================================

describe('Anthropic Client — createClaudeStreamingChat', () => {
  it('returns stream, model, and getTokenUsage', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockStream.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'message_start',
          message: { usage: { input_tokens: 100 } },
        };
        yield {
          type: 'content_block_delta',
          delta: { text: 'Hello' },
        };
        yield {
          type: 'message_delta',
          usage: { output_tokens: 50 },
        };
      },
    });

    const { createClaudeStreamingChat } = await import('./client');
    const result = await createClaudeStreamingChat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.stream).toBeInstanceOf(ReadableStream);
    expect(typeof result.model).toBe('string');
    expect(typeof result.getTokenUsage).toBe('function');

    // Read the stream to trigger token capture
    const reader = result.stream.getReader();
    const chunks: string[] = [];
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    // Token usage should be captured
    const usage = result.getTokenUsage();
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
  });

  it('uses correct model based on forceModel', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockStream.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'content_block_delta', delta: { text: 'ok' } };
      },
    });

    const { createClaudeStreamingChat } = await import('./client');
    const result = await createClaudeStreamingChat({
      messages: [{ role: 'user', content: 'test' }],
      forceModel: 'sonnet',
    });

    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('handles rate limit errors in stream with user-friendly message', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockStream.mockRejectedValueOnce(new Error('429 rate_limit'));

    const { createClaudeStreamingChat } = await import('./client');
    const result = await createClaudeStreamingChat({
      messages: [{ role: 'user', content: 'test' }],
    });

    // Read the stream to get the error message
    const reader = result.stream.getReader();
    const chunks: string[] = [];
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    const output = chunks.join('');
    expect(output).toContain('High demand');
  });

  it('handles stream with cache statistics logging', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    mockStream.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'message_start',
          message: {
            usage: {
              input_tokens: 100,
              cache_creation_input_tokens: 500,
              cache_read_input_tokens: 0,
            },
          },
        };
        yield { type: 'content_block_delta', delta: { text: 'cached' } };
      },
    });

    const { createClaudeStreamingChat } = await import('./client');
    const result = await createClaudeStreamingChat({
      messages: [{ role: 'user', content: 'test' }],
    });

    // Consume the stream
    const reader = result.stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // cacheCreationTokens and cacheReadTokens are captured internally
    // The getTokenUsage function should reflect them (as extended properties)
    const usage = result.getTokenUsage();
    expect(usage).toHaveProperty('cacheCreationTokens', 500);
    expect(usage).toHaveProperty('cacheReadTokens', 0);
  });
});

// ===================================================================
// 14. Edge Cases & Error Handling
// ===================================================================

describe('Anthropic Client — Edge Cases', () => {
  it('convertMessages uses default system prompt when none provided', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
      // no systemPrompt
    });

    const callArgs = mockCreate.mock.calls[0][0];
    // Default system prompt should be "You are a helpful AI assistant."
    if (Array.isArray(callArgs.system)) {
      expect(callArgs.system[0].text).toBe('You are a helpful AI assistant.');
    } else {
      expect(callArgs.system).toBe('You are a helpful AI assistant.');
    }
  });

  it('handles 429 Too Many Requests error string', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY_1', 'key1');
    vi.stubEnv('ANTHROPIC_API_KEY_2', 'key2');

    mockCreate
      .mockRejectedValueOnce(new Error('Too Many Requests'))
      .mockResolvedValueOnce(makeTextResponse('Recovered'));

    const { createAnthropicCompletion } = await import('./client');
    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.text).toBe('Recovered');
  });

  it('handles response with mixed content block types (text and non-text)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'thinking', thinking: 'internal thought' }, // non-text block
        { type: 'text', text: 'World' },
      ],
      model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const { createAnthropicCompletion } = await import('./client');
    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: 'test' }],
    });

    // Only text blocks should be extracted
    expect(result.text).toBe('Hello\nWorld');
  });

  it('handles multimodal content with image_url type', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('I see it'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image: 'data:image/jpeg;base64,/9j/' },
          ] as unknown as string,
        },
      ],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages[0];
    expect(Array.isArray(userMsg.content)).toBe(true);
  });

  it('skips image parts with invalid data URL format', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    mockCreate.mockResolvedValueOnce(makeTextResponse('ok'));

    const { createAnthropicCompletion } = await import('./client');
    await createAnthropicCompletion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'image', image: 'not-a-data-url' }, // Invalid format
          ] as unknown as string,
        },
      ],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages[0];
    // Should only have the text part, the invalid image is skipped
    if (Array.isArray(userMsg.content)) {
      expect(userMsg.content.length).toBe(1);
      expect(userMsg.content[0].type).toBe('text');
    }
  });
});
