// @ts-nocheck - Test file with extensive mocking
/**
 * PROVIDER SERVICE TESTS
 *
 * Comprehensive tests for the multi-provider service module.
 * Tests ProviderService class, singleton management, and convenience functions.
 */

import { describe, it, expect, vi } from 'vitest';
import { UnifiedAIError } from './types';
import type { ProviderId, AIAdapter, ProviderCapabilities, UnifiedMessage } from './types';

// Mock all external dependencies before importing service
vi.mock('./registry', () => ({
  getProvider: vi.fn((id: string) => {
    if (id === 'nonexistent') throw new Error(`Unknown provider: ${id}`);
    return {
      id,
      name: id,
      family: id === 'claude' ? 'anthropic' : 'openai-compatible',
      apiKeyEnv: `${id.toUpperCase()}_API_KEY`,
      capabilities: {
        vision: true,
        parallelToolCalls: true,
        streaming: true,
        systemMessages: true,
        jsonMode: id !== 'claude',
        toolCalling: true,
        extendedThinking: id === 'claude',
      },
      models: [{ id: `${id}-default`, name: `${id} default`, isDefault: true }],
    };
  }),
  getDefaultModel: vi.fn((id: string) => {
    if (id === 'nonexistent') return undefined;
    return { id: `${id}-default`, name: `${id} default`, isDefault: true };
  }),
  isProviderAvailable: vi.fn((id: string) => {
    return ['claude', 'openai', 'xai'].includes(id);
  }),
}));

vi.mock('./adapters', () => {
  const createMockAdapter = (providerId: string): AIAdapter => ({
    providerId: providerId as ProviderId,
    family: providerId === 'claude' ? 'anthropic' : 'openai-compatible',
    chat: vi.fn(async function* () {
      yield { type: 'text' as const, text: `Response from ${providerId}` };
      yield { type: 'message_end' as const, usage: { inputTokens: 10, outputTokens: 5 } };
    }),
    formatTools: vi.fn((tools) => tools),
    toProviderMessages: vi.fn((msgs) => msgs),
    fromProviderMessages: vi.fn((msgs) => msgs as UnifiedMessage[]),
    formatToolResult: vi.fn((result) => result),
    getCapabilities: vi.fn(() => ({
      vision: true,
      parallelToolCalls: true,
      streaming: true,
      systemMessages: true,
      jsonMode: providerId !== 'claude',
      toolCalling: true,
      extendedThinking: providerId === 'claude',
    })),
    hasCapability: vi.fn((cap: keyof ProviderCapabilities) => {
      if (cap === 'extendedThinking') return providerId === 'claude';
      return true;
    }),
  });

  return {
    getAdapter: vi.fn((id: string) => {
      if (id === 'unconfigured') return null;
      return createMockAdapter(id);
    }),
  };
});

vi.mock('./errors', () => ({
  parseProviderError: vi.fn((err: unknown, providerId: string) => {
    if (err instanceof UnifiedAIError) return err;
    const msg = err instanceof Error ? err.message : String(err);
    return new UnifiedAIError('server_error', msg, providerId as ProviderId, true, 100);
  }),
  canRecoverWithFallback: vi.fn((err: UnifiedAIError) => {
    return (
      err.code === 'rate_limited' ||
      err.code === 'server_error' ||
      err.code === 'model_unavailable' ||
      err.code === 'timeout'
    );
  }),
}));

vi.mock('./context', () => ({
  prepareProviderHandoff: vi.fn(async (conversation, from, to) => ({
    messages: conversation,
    fromProvider: from,
    toProvider: to,
    warnings: [],
    metadata: {
      handoffTime: new Date().toISOString(),
      originalMessageCount: conversation.length,
      preparedMessageCount: conversation.length,
      wasSummarized: false,
      processingTimeMs: 10,
    },
  })),
  canHandoff: vi.fn((_from: string, _to: string) => ({
    possible: true,
    warnings: [],
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import after mocks are set up
import {
  ProviderService,
  getProviderService,
  createProviderService,
  isProviderAvailable,
  getAvailableProviders,
} from './service';
import { getAdapter } from './adapters';
import { canHandoff } from './context';

// ============================================================================
// ProviderService CLASS
// ============================================================================

describe('ProviderService', () => {
  describe('constructor', () => {
    it('should default to claude as the provider', () => {
      const service = new ProviderService();
      expect(service.getCurrentProvider()).toBe('claude');
    });

    it('should accept a custom default provider', () => {
      const service = new ProviderService('openai');
      expect(service.getCurrentProvider()).toBe('openai');
    });
  });

  describe('getCurrentProvider', () => {
    it('should return the current provider ID', () => {
      const service = new ProviderService('xai');
      expect(service.getCurrentProvider()).toBe('xai');
    });
  });

  describe('setProvider', () => {
    it('should switch to an available provider and return true', () => {
      const service = new ProviderService();
      const result = service.setProvider('openai');
      expect(result).toBe(true);
      expect(service.getCurrentProvider()).toBe('openai');
    });

    it('should return false and keep current provider when target is unavailable', () => {
      const service = new ProviderService('claude');
      // 'deepseek' is not in the available list in our mock
      const result = service.setProvider('deepseek');
      expect(result).toBe(false);
      expect(service.getCurrentProvider()).toBe('claude');
    });
  });

  describe('getProviderConfig', () => {
    it('should return config for the current provider by default', () => {
      const service = new ProviderService('claude');
      const config = service.getProviderConfig();
      expect(config?.id).toBe('claude');
    });

    it('should return config for a specific provider', () => {
      const service = new ProviderService('claude');
      const config = service.getProviderConfig('openai');
      expect(config?.id).toBe('openai');
    });
  });

  describe('getProviderStatuses', () => {
    it('should return status for all 5 providers', () => {
      const service = new ProviderService();
      const statuses = service.getProviderStatuses();
      expect(statuses).toHaveLength(5);
    });

    it('should mark configured providers as available', () => {
      const service = new ProviderService();
      const statuses = service.getProviderStatuses();
      const claudeStatus = statuses.find((s) => s.providerId === 'claude');
      expect(claudeStatus?.configured).toBe(true);
      expect(claudeStatus?.available).toBe(true);
      expect(claudeStatus?.defaultModel).toBe('claude-default');
    });

    it('should mark unconfigured providers as unavailable', () => {
      const service = new ProviderService();
      const statuses = service.getProviderStatuses();
      const deepseekStatus = statuses.find((s) => s.providerId === 'deepseek');
      expect(deepseekStatus?.configured).toBe(false);
      expect(deepseekStatus?.available).toBe(false);
      expect(deepseekStatus?.defaultModel).toBeNull();
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return only configured provider IDs', () => {
      const service = new ProviderService();
      const configured = service.getConfiguredProviders();
      expect(configured).toContain('claude');
      expect(configured).toContain('openai');
      expect(configured).toContain('xai');
      expect(configured).not.toContain('deepseek');
    });
  });

  describe('formatTools', () => {
    it('should delegate to the adapter formatTools and return result', () => {
      const service = new ProviderService('claude');
      const tools = [
        {
          name: 'test',
          description: 'test tool',
          parameters: { type: 'object' as const, properties: {} },
        },
      ];
      const result = service.formatTools(tools);
      // The mock formatTools returns tools as-is
      expect(result).toEqual(tools);
      // Verify getAdapter was called with the right provider
      expect(getAdapter).toHaveBeenCalledWith('claude');
    });

    it('should throw when adapter is not available', () => {
      const service = new ProviderService('unconfigured' as ProviderId);
      expect(() => service.formatTools([])).toThrow('not configured');
    });

    it('should use explicit providerId when given', () => {
      const service = new ProviderService('claude');
      service.formatTools([], 'openai');
      expect(getAdapter).toHaveBeenCalledWith('openai');
    });
  });

  describe('hasCapability', () => {
    it('should return true for supported capabilities', () => {
      const service = new ProviderService('claude');
      expect(service.hasCapability('streaming')).toBe(true);
      expect(service.hasCapability('extendedThinking')).toBe(true);
    });

    it('should return false when adapter is not available', () => {
      const service = new ProviderService('unconfigured' as ProviderId);
      expect(service.hasCapability('streaming')).toBe(false);
    });

    it('should check a specific provider when given', () => {
      const service = new ProviderService('claude');
      // openai mock returns false for extendedThinking
      expect(service.hasCapability('extendedThinking', 'openai')).toBe(false);
    });
  });

  describe('chat', () => {
    it('should stream chunks from the primary provider', async () => {
      const service = new ProviderService('claude', null);
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];

      const chunks: unknown[] = [];
      const gen = service.chat(messages, { enableFallback: false, enableRetry: false });
      let result;
      while (true) {
        const next = await gen.next();
        if (next.done) {
          result = next.value;
          break;
        }
        chunks.push(next.value);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(result.providerId).toBe('claude');
      expect(result.usedFallback).toBe(false);
    });

    it('should throw when primary adapter is not configured and no fallback', async () => {
      const service = new ProviderService('unconfigured' as ProviderId, null);
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];

      const gen = service.chat(messages, { enableFallback: false });
      await expect(gen.next()).rejects.toThrow();
    });

    it('should fall back to secondary provider on recoverable error', async () => {
      // Make the primary adapter throw a recoverable error
      const mockGetAdapter = vi.mocked(getAdapter);
      const originalImpl = mockGetAdapter.getMockImplementation()!;

      const _callCount = 0;
      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') {
          callCount++;
          return {
            ...originalImpl(id)!,
            chat: vi.fn(async function* () {
              throw new UnifiedAIError('server_error', 'Server error', 'claude', false);
            }),
          } as unknown as AIAdapter;
        }
        return originalImpl(id);
      });

      const service = new ProviderService('claude', 'openai');
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];

      const chunks: unknown[] = [];
      const gen = service.chat(messages, { enableRetry: false });
      let result;
      while (true) {
        const next = await gen.next();
        if (next.done) {
          result = next.value;
          break;
        }
        chunks.push(next.value);
      }

      expect(result.usedFallback).toBe(true);
      expect(result.providerId).toBe('openai');
      expect(result.fallbackReason).toBeDefined();

      // Restore
      mockGetAdapter.mockImplementation(originalImpl);
    });

    it('should throw when fallback is disabled and primary fails', async () => {
      const mockGetAdapter = vi.mocked(getAdapter);
      const originalImpl = mockGetAdapter.getMockImplementation()!;

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') {
          return {
            ...originalImpl(id)!,
            chat: vi.fn(async function* () {
              throw new UnifiedAIError('server_error', 'Server error', 'claude', false);
            }),
          } as unknown as AIAdapter;
        }
        return originalImpl(id);
      });

      const service = new ProviderService('claude', 'openai');
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];

      const gen = service.chat(messages, { enableFallback: false, enableRetry: false });
      await expect(gen.next()).rejects.toThrow();

      mockGetAdapter.mockImplementation(originalImpl);
    });

    it('should call onProviderSwitch callback when falling back', async () => {
      const mockGetAdapter = vi.mocked(getAdapter);
      const originalImpl = mockGetAdapter.getMockImplementation()!;

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') {
          return {
            ...originalImpl(id)!,
            chat: vi.fn(async function* () {
              throw new UnifiedAIError('rate_limited', 'Too many requests', 'claude', true, 100);
            }),
          } as unknown as AIAdapter;
        }
        return originalImpl(id);
      });

      const onSwitch = vi.fn();
      const service = new ProviderService('claude', 'openai');
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];

      const gen = service.chat(messages, {
        enableRetry: false,
        onProviderSwitch: onSwitch,
      });
      // Consume the generator
      while (true) {
        const next = await gen.next();
        if (next.done) break;
      }

      expect(onSwitch).toHaveBeenCalledWith('claude', 'openai', expect.any(String));

      mockGetAdapter.mockImplementation(originalImpl);
    });
  });

  describe('switchProvider', () => {
    it('should switch provider and update current provider', async () => {
      const service = new ProviderService('claude', 'openai');
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];

      const result = await service.switchProvider(messages, 'openai');
      expect(result.fromProvider).toBe('claude');
      expect(result.toProvider).toBe('openai');
      expect(service.getCurrentProvider()).toBe('openai');
    });

    it('should throw when handoff is not possible', async () => {
      const mockCanHandoff = vi.mocked(canHandoff);
      mockCanHandoff.mockReturnValueOnce({ possible: false, warnings: ['Incompatible formats'] });

      const service = new ProviderService('claude', null);
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];

      await expect(service.switchProvider(messages, 'openai')).rejects.toThrow('Cannot handoff');
      // Provider should not have changed
      expect(service.getCurrentProvider()).toBe('claude');
    });
  });
});

// ============================================================================
// SINGLETON & FACTORY FUNCTIONS
// ============================================================================

describe('getProviderService', () => {
  it('should return a ProviderService instance', () => {
    const service = getProviderService();
    expect(service).toBeInstanceOf(ProviderService);
  });

  it('should return the same instance on multiple calls', () => {
    const service1 = getProviderService();
    const service2 = getProviderService();
    expect(service1).toBe(service2);
  });
});

describe('createProviderService', () => {
  it('should create a new ProviderService with defaults', () => {
    const service = createProviderService();
    expect(service).toBeInstanceOf(ProviderService);
    expect(service.getCurrentProvider()).toBe('claude');
  });

  it('should create a service with custom provider', () => {
    const service = createProviderService('openai');
    expect(service.getCurrentProvider()).toBe('openai');
  });

  it('should create a new instance each time (not singleton)', () => {
    const s1 = createProviderService();
    const s2 = createProviderService();
    expect(s1).not.toBe(s2);
  });
});

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

describe('isProviderAvailable (convenience)', () => {
  it('should return true for available providers', () => {
    expect(isProviderAvailable('claude')).toBe(true);
  });

  it('should return false for unavailable providers', () => {
    expect(isProviderAvailable('deepseek')).toBe(false);
  });
});

describe('getAvailableProviders (convenience)', () => {
  it('should return configured provider IDs', () => {
    const available = getAvailableProviders();
    expect(available).toContain('claude');
    expect(available).toContain('openai');
  });
});
