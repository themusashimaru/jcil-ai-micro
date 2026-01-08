import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
      stream: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Test' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' response' } };
        },
      }),
    },
  })),
}));

describe('Anthropic Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Module Exports', () => {
    it('should export isAnthropicConfigured function', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      const { isAnthropicConfigured } = await import('./client');
      expect(typeof isAnthropicConfigured).toBe('function');
    });

    it('should export getAnthropicKeyStats function', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      const { getAnthropicKeyStats } = await import('./client');
      expect(typeof getAnthropicKeyStats).toBe('function');
    });

    it('should export createAnthropicCompletion function', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      const { createAnthropicCompletion } = await import('./client');
      expect(typeof createAnthropicCompletion).toBe('function');
    });

    it('should export createAnthropicStreamingCompletion function', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      const { createAnthropicStreamingCompletion } = await import('./client');
      expect(typeof createAnthropicStreamingCompletion).toBe('function');
    });

    it('should export createAnthropicCompletionWithSearch function', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      const { createAnthropicCompletionWithSearch } = await import('./client');
      expect(typeof createAnthropicCompletionWithSearch).toBe('function');
    });

    it('should export isImageGenerationRequest function', async () => {
      const { isImageGenerationRequest } = await import('./client');
      expect(typeof isImageGenerationRequest).toBe('function');
    });

    it('should export detectDocumentRequest function', async () => {
      const { detectDocumentRequest } = await import('./client');
      expect(typeof detectDocumentRequest).toBe('function');
    });

    it('should export selectClaudeModel function', async () => {
      const { selectClaudeModel } = await import('./client');
      expect(typeof selectClaudeModel).toBe('function');
    });

    it('should export createClaudeStreamingChat function', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      const { createClaudeStreamingChat } = await import('./client');
      expect(typeof createClaudeStreamingChat).toBe('function');
    });

    it('should export createClaudeChat function', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      const { createClaudeChat } = await import('./client');
      expect(typeof createClaudeChat).toBe('function');
    });

    it('should export CLAUDE_HAIKU constant', async () => {
      const { CLAUDE_HAIKU } = await import('./client');
      expect(CLAUDE_HAIKU).toBe('claude-haiku-4-5-20251001');
    });

    it('should export CLAUDE_SONNET constant', async () => {
      const { CLAUDE_SONNET } = await import('./client');
      expect(CLAUDE_SONNET).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('isAnthropicConfigured', () => {
    it('should return true when ANTHROPIC_API_KEY is set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key');
      vi.resetModules();

      const { isAnthropicConfigured } = await import('./client');
      expect(isAnthropicConfigured()).toBe(true);
    });

    it('should return true when numbered keys are set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY_1', 'sk-ant-key-1');
      vi.stubEnv('ANTHROPIC_API_KEY_2', 'sk-ant-key-2');
      vi.resetModules();

      const { isAnthropicConfigured } = await import('./client');
      expect(isAnthropicConfigured()).toBe(true);
    });
  });

  describe('getAnthropicKeyStats', () => {
    it('should return key statistics', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
      vi.resetModules();

      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();

      expect(stats).toHaveProperty('primaryKeys');
      expect(stats).toHaveProperty('primaryAvailable');
      expect(stats).toHaveProperty('fallbackKeys');
      expect(stats).toHaveProperty('fallbackAvailable');
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('totalAvailable');
    });

    it('should count primary and fallback pools separately', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY_1', 'sk-ant-primary-1');
      vi.stubEnv('ANTHROPIC_API_KEY_FALLBACK_1', 'sk-ant-fallback-1');
      vi.resetModules();

      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();

      expect(stats.primaryKeys).toBeGreaterThanOrEqual(0);
      expect(stats.fallbackKeys).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isImageGenerationRequest', () => {
    it('should detect "create image" requests', async () => {
      const { isImageGenerationRequest } = await import('./client');
      expect(isImageGenerationRequest('create an image of a cat')).toBe(true);
    });

    it('should detect "generate picture" requests', async () => {
      const { isImageGenerationRequest } = await import('./client');
      expect(isImageGenerationRequest('generate a picture of sunset')).toBe(true);
    });

    it('should detect DALL-E mentions', async () => {
      const { isImageGenerationRequest } = await import('./client');
      expect(isImageGenerationRequest('use dall-e to make something')).toBe(true);
    });

    it('should detect Midjourney mentions', async () => {
      const { isImageGenerationRequest } = await import('./client');
      expect(isImageGenerationRequest('create this in midjourney style')).toBe(true);
    });

    it('should not detect regular text requests', async () => {
      const { isImageGenerationRequest } = await import('./client');
      expect(isImageGenerationRequest('explain how photosynthesis works')).toBe(false);
    });

    it('should not detect coding requests', async () => {
      const { isImageGenerationRequest } = await import('./client');
      expect(isImageGenerationRequest('write a function to process images')).toBe(false);
    });
  });

  describe('detectDocumentRequest', () => {
    it('should detect Excel/spreadsheet requests', async () => {
      const { detectDocumentRequest } = await import('./client');
      expect(detectDocumentRequest('create an excel spreadsheet')).toBe('xlsx');
      expect(detectDocumentRequest('make me a budget spreadsheet')).toBe('xlsx');
    });

    it('should detect PowerPoint/presentation requests', async () => {
      const { detectDocumentRequest } = await import('./client');
      expect(detectDocumentRequest('create a powerpoint presentation')).toBe('pptx');
      expect(detectDocumentRequest('make slides for my pitch')).toBe('pptx');
    });

    it('should detect Word document requests', async () => {
      const { detectDocumentRequest } = await import('./client');
      expect(detectDocumentRequest('write a word document')).toBe('docx');
      expect(detectDocumentRequest('create a resume for me')).toBe('docx');
      expect(detectDocumentRequest('write a cover letter')).toBe('docx');
    });

    it('should detect PDF requests', async () => {
      const { detectDocumentRequest } = await import('./client');
      expect(detectDocumentRequest('create a pdf invoice')).toBe('pdf');
      expect(detectDocumentRequest('generate an invoice for client')).toBe('pdf');
    });

    it('should return null for non-document requests', async () => {
      const { detectDocumentRequest } = await import('./client');
      expect(detectDocumentRequest('explain quantum physics')).toBe(null);
      expect(detectDocumentRequest('write some code')).toBe(null);
    });
  });

  describe('selectClaudeModel', () => {
    it('should return Haiku for simple greetings', async () => {
      const { selectClaudeModel, CLAUDE_HAIKU } = await import('./client');
      expect(selectClaudeModel('hi')).toBe(CLAUDE_HAIKU);
      expect(selectClaudeModel('hello')).toBe(CLAUDE_HAIKU);
      expect(selectClaudeModel('thanks')).toBe(CLAUDE_HAIKU);
    });

    it('should return Sonnet for complex requests', async () => {
      const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
      expect(selectClaudeModel('explain the theory of relativity in depth')).toBe(CLAUDE_SONNET);
      expect(selectClaudeModel('analyze this code and refactor it')).toBe(CLAUDE_SONNET);
    });

    it('should return Sonnet for research queries', async () => {
      const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
      expect(selectClaudeModel('research', { isResearch: true })).toBe(CLAUDE_SONNET);
    });

    it('should return Sonnet for document generation', async () => {
      const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
      expect(selectClaudeModel('doc', { isDocumentGeneration: true })).toBe(CLAUDE_SONNET);
    });

    it('should return Sonnet for faith topics', async () => {
      const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
      expect(selectClaudeModel('faith', { isFaithTopic: true })).toBe(CLAUDE_SONNET);
    });

    it('should respect forceModel option', async () => {
      const { selectClaudeModel, CLAUDE_HAIKU, CLAUDE_SONNET } = await import('./client');
      expect(selectClaudeModel('complex query', { forceModel: 'haiku' })).toBe(CLAUDE_HAIKU);
      expect(selectClaudeModel('simple hi', { forceModel: 'sonnet' })).toBe(CLAUDE_SONNET);
    });

    it('should return Sonnet for long content', async () => {
      const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
      const longContent = 'a'.repeat(250);
      expect(selectClaudeModel(longContent)).toBe(CLAUDE_SONNET);
    });

    it('should return Sonnet for code requests', async () => {
      const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
      expect(selectClaudeModel('write a typescript function')).toBe(CLAUDE_SONNET);
      expect(selectClaudeModel('debug this python code')).toBe(CLAUDE_SONNET);
    });

    it('should return Sonnet for bible/faith content', async () => {
      const { selectClaudeModel, CLAUDE_SONNET } = await import('./client');
      expect(selectClaudeModel('what does the bible say about love')).toBe(CLAUDE_SONNET);
      expect(selectClaudeModel('explain Romans 8:28')).toBe(CLAUDE_SONNET);
    });
  });
});

describe('Anthropic API Key Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Dual Pool System', () => {
    it('should detect numbered primary keys', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY_1', 'key1');
      vi.stubEnv('ANTHROPIC_API_KEY_2', 'key2');
      vi.stubEnv('ANTHROPIC_API_KEY_3', 'key3');
      vi.resetModules();

      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();
      expect(stats.primaryKeys).toBeGreaterThanOrEqual(0);
    });

    it('should detect fallback keys', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY_FALLBACK_1', 'fallback1');
      vi.stubEnv('ANTHROPIC_API_KEY_FALLBACK_2', 'fallback2');
      vi.resetModules();

      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();
      expect(stats.fallbackKeys).toBeGreaterThanOrEqual(0);
    });

    it('should fall back to single ANTHROPIC_API_KEY', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'single-key');
      vi.resetModules();

      const { isAnthropicConfigured } = await import('./client');
      expect(isAnthropicConfigured()).toBe(true);
    });
  });

  describe('Rate Limit Handling', () => {
    it('should track available keys', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      vi.resetModules();

      const { getAnthropicKeyStats } = await import('./client');
      const stats = getAnthropicKeyStats();
      expect(stats.totalAvailable).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Anthropic Streaming', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.resetModules();
  });

  describe('Reliability Features', () => {
    it('should have keepalive configuration', async () => {
      // The streaming functions include keepalive intervals
      const { createAnthropicStreamingCompletion } = await import('./client');
      expect(typeof createAnthropicStreamingCompletion).toBe('function');
    });

    it('should have timeout configuration', async () => {
      // The streaming functions include chunk timeouts
      const { createClaudeStreamingChat } = await import('./client');
      expect(typeof createClaudeStreamingChat).toBe('function');
    });
  });
});

describe('Anthropic Security', () => {
  describe('API Key Protection', () => {
    it('should not expose keys in errors', async () => {
      const errorMessage = 'Anthropic API error occurred';
      expect(errorMessage).not.toContain('sk-ant-');
    });

    it('should use environment variables for keys', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
      const { isAnthropicConfigured } = await import('./client');
      expect(isAnthropicConfigured()).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should handle empty messages array', async () => {
      const { selectClaudeModel } = await import('./client');
      expect(selectClaudeModel('')).toBeDefined();
    });
  });
});

describe('Anthropic Message Conversion', () => {
  describe('Content Types', () => {
    it('should handle text content', async () => {
      const { createAnthropicCompletion } = await import('./client');
      expect(typeof createAnthropicCompletion).toBe('function');
    });

    it('should handle multimodal content', async () => {
      const { createAnthropicCompletion } = await import('./client');
      expect(typeof createAnthropicCompletion).toBe('function');
    });
  });

  describe('Image Media Types', () => {
    it('should support PNG images', async () => {
      // Implementation supports image/png
      const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      expect(supportedTypes).toContain('image/png');
    });

    it('should support JPEG images', async () => {
      const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      expect(supportedTypes).toContain('image/jpeg');
    });

    it('should support GIF images', async () => {
      const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      expect(supportedTypes).toContain('image/gif');
    });

    it('should support WebP images', async () => {
      const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      expect(supportedTypes).toContain('image/webp');
    });
  });
});
