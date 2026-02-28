// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * SERVICE TESTS
 *
 * Comprehensive tests for the multi-provider service covering:
 * - ProviderService class construction and defaults
 * - getCurrentProvider / setProvider
 * - getProviderConfig
 * - getProviderStatuses / getConfiguredProviders
 * - chat() method with primary, retry, fallback, and error paths
 * - switchProvider() method with handoff logic
 * - formatTools() and hasCapability()
 * - Singleton management (getProviderService, createProviderService)
 * - Convenience functions (isProviderAvailable, getAvailableProviders, chat)
 * - Edge cases and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE imports so vitest hoists them
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Mock the registry module
const mockGetProvider = vi.fn();
const mockGetDefaultModel = vi.fn();
const mockCheckProviderAvailable = vi.fn();

vi.mock('../registry', () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
  getDefaultModel: (...args: unknown[]) => mockGetDefaultModel(...args),
  isProviderAvailable: (...args: unknown[]) => mockCheckProviderAvailable(...args),
}));

// Mock the adapters module
const mockGetAdapter = vi.fn();

vi.mock('../adapters', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

// Mock the errors module
const mockParseProviderError = vi.fn();
const mockCanRecoverWithFallback = vi.fn();

vi.mock('../errors', () => ({
  parseProviderError: (...args: unknown[]) => mockParseProviderError(...args),
  canRecoverWithFallback: (...args: unknown[]) => mockCanRecoverWithFallback(...args),
}));

// Mock the context module
const mockPrepareProviderHandoff = vi.fn();
const mockCanHandoff = vi.fn();

vi.mock('../context', () => ({
  prepareProviderHandoff: (...args: unknown[]) => mockPrepareProviderHandoff(...args),
  canHandoff: (...args: unknown[]) => mockCanHandoff(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { UnifiedAIError } from '../types';
import {
  ProviderService,
  getProviderService,
  createProviderService,
  isProviderAvailable,
  getAvailableProviders,
  chat,
} from '../service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all chunks from an async generator and return the final result */
async function collectGenerator<TYield, TReturn>(
  gen: AsyncGenerator<TYield, TReturn, unknown>
): Promise<{ chunks: TYield[]; result: TReturn }> {
  const chunks: TYield[] = [];
  let iterResult = await gen.next();
  while (!iterResult.done) {
    chunks.push(iterResult.value as TYield);
    iterResult = await gen.next();
  }
  return { chunks, result: iterResult.value as TReturn };
}

/** Create a mock adapter with configurable chat behaviour */
function createMockAdapter(overrides: Record<string, unknown> = {}) {
  return {
    providerId: 'claude',
    family: 'anthropic',
    chat: vi.fn(async function* () {
      yield { type: 'text', text: 'hello' };
    }),
    formatTools: vi.fn((tools: unknown[]) => tools),
    toProviderMessages: vi.fn((msgs: unknown[]) => msgs),
    fromProviderMessages: vi.fn((msgs: unknown[]) => msgs),
    formatToolResult: vi.fn((r: unknown) => r),
    getCapabilities: vi.fn(() => ({
      vision: true,
      parallelToolCalls: true,
      streaming: true,
      systemMessages: true,
      jsonMode: false,
      toolCalling: true,
      extendedThinking: false,
    })),
    hasCapability: vi.fn((cap: string) => cap !== 'jsonMode'),
    ...overrides,
  };
}

/** Simple messages fixture */
const MESSAGES = [{ role: 'user', content: 'Hello' }];

// ---------------------------------------------------------------------------
// Reset state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the singleton by accessing the module-level variable via a fresh service
  // We use createProviderService for isolated tests and avoid singleton leaking
  // Reset singleton by clearing the module-level _defaultService
  // We achieve this by re-importing, but vitest caches, so we clear mocks instead.
  // The singleton is internal; we test it indirectly via getProviderService().
});

// ============================================================================
// ProviderService — Constructor & Basic Accessors
// ============================================================================

describe('ProviderService', () => {
  describe('constructor', () => {
    it('should default to claude as the current provider', () => {
      const svc = new ProviderService();
      expect(svc.getCurrentProvider()).toBe('claude');
    });

    it('should accept a custom default provider', () => {
      const svc = new ProviderService('openai');
      expect(svc.getCurrentProvider()).toBe('openai');
    });

    it('should accept a custom fallback provider', () => {
      // fallback is internal; we test it indirectly via chat fallback behaviour
      const svc = new ProviderService('claude', 'deepseek');
      expect(svc.getCurrentProvider()).toBe('claude');
    });

    it('should accept null as fallback provider', () => {
      const svc = new ProviderService('claude', null);
      expect(svc.getCurrentProvider()).toBe('claude');
    });
  });

  // --------------------------------------------------------------------------
  // getCurrentProvider
  // --------------------------------------------------------------------------

  describe('getCurrentProvider', () => {
    it('should return the current provider id', () => {
      const svc = new ProviderService('xai');
      expect(svc.getCurrentProvider()).toBe('xai');
    });
  });

  // --------------------------------------------------------------------------
  // setProvider
  // --------------------------------------------------------------------------

  describe('setProvider', () => {
    it('should switch provider when available', () => {
      mockCheckProviderAvailable.mockReturnValue(true);
      const svc = new ProviderService();
      const result = svc.setProvider('openai');
      expect(result).toBe(true);
      expect(svc.getCurrentProvider()).toBe('openai');
    });

    it('should return false when provider is not available', () => {
      mockCheckProviderAvailable.mockReturnValue(false);
      const svc = new ProviderService();
      const result = svc.setProvider('deepseek');
      expect(result).toBe(false);
      expect(svc.getCurrentProvider()).toBe('claude');
    });

    it('should not change provider when unavailable', () => {
      mockCheckProviderAvailable.mockReturnValue(false);
      const svc = new ProviderService('openai');
      svc.setProvider('xai');
      expect(svc.getCurrentProvider()).toBe('openai');
    });

    it('should call isProviderAvailable from registry', () => {
      mockCheckProviderAvailable.mockReturnValue(true);
      const svc = new ProviderService();
      svc.setProvider('google');
      expect(mockCheckProviderAvailable).toHaveBeenCalledWith('google');
    });
  });

  // --------------------------------------------------------------------------
  // getProviderConfig
  // --------------------------------------------------------------------------

  describe('getProviderConfig', () => {
    it('should return config for the current provider when no id given', () => {
      const fakeConfig = { id: 'claude', name: 'Claude' };
      mockGetProvider.mockReturnValue(fakeConfig);
      const svc = new ProviderService('claude');
      expect(svc.getProviderConfig()).toEqual(fakeConfig);
      expect(mockGetProvider).toHaveBeenCalledWith('claude');
    });

    it('should return config for a specified provider', () => {
      const fakeConfig = { id: 'openai', name: 'OpenAI' };
      mockGetProvider.mockReturnValue(fakeConfig);
      const svc = new ProviderService();
      expect(svc.getProviderConfig('openai')).toEqual(fakeConfig);
      expect(mockGetProvider).toHaveBeenCalledWith('openai');
    });
  });

  // --------------------------------------------------------------------------
  // getProviderStatuses
  // --------------------------------------------------------------------------

  describe('getProviderStatuses', () => {
    it('should return statuses for all 5 providers', () => {
      mockCheckProviderAvailable.mockReturnValue(false);
      mockGetDefaultModel.mockReturnValue(undefined);
      const svc = new ProviderService();
      const statuses = svc.getProviderStatuses();
      expect(statuses).toHaveLength(5);
      expect(statuses.map((s) => s.providerId)).toEqual([
        'claude',
        'openai',
        'xai',
        'deepseek',
        'google',
      ]);
    });

    it('should mark configured providers as available', () => {
      mockCheckProviderAvailable.mockImplementation((id: string) => id === 'claude');
      mockGetDefaultModel.mockReturnValue({ id: 'claude-sonnet-4-6' });
      const svc = new ProviderService();
      const statuses = svc.getProviderStatuses();
      const claudeStatus = statuses.find((s) => s.providerId === 'claude');
      expect(claudeStatus?.configured).toBe(true);
      expect(claudeStatus?.available).toBe(true);
      expect(claudeStatus?.defaultModel).toBe('claude-sonnet-4-6');
    });

    it('should set defaultModel to null when provider is not configured', () => {
      mockCheckProviderAvailable.mockReturnValue(false);
      const svc = new ProviderService();
      const statuses = svc.getProviderStatuses();
      statuses.forEach((s) => {
        expect(s.defaultModel).toBeNull();
      });
    });

    it('should set defaultModel to null when model config has no id', () => {
      mockCheckProviderAvailable.mockReturnValue(true);
      mockGetDefaultModel.mockReturnValue(undefined);
      const svc = new ProviderService();
      const statuses = svc.getProviderStatuses();
      statuses.forEach((s) => {
        expect(s.defaultModel).toBeNull();
      });
    });
  });

  // --------------------------------------------------------------------------
  // getConfiguredProviders
  // --------------------------------------------------------------------------

  describe('getConfiguredProviders', () => {
    it('should return only configured provider ids', () => {
      mockCheckProviderAvailable.mockImplementation(
        (id: string) => id === 'claude' || id === 'openai'
      );
      mockGetDefaultModel.mockReturnValue({ id: 'model-x' });
      const svc = new ProviderService();
      const configured = svc.getConfiguredProviders();
      expect(configured).toEqual(['claude', 'openai']);
    });

    it('should return empty array when none configured', () => {
      mockCheckProviderAvailable.mockReturnValue(false);
      const svc = new ProviderService();
      expect(svc.getConfiguredProviders()).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // chat — primary path
  // --------------------------------------------------------------------------

  describe('chat', () => {
    it('should yield chunks from the primary provider', async () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'model-1' });

      const svc = new ProviderService('claude', null);
      const { chunks, result } = await collectGenerator(svc.chat(MESSAGES, { enableRetry: false }));

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ type: 'text', text: 'hello' });
      expect(result.providerId).toBe('claude');
      expect(result.usedFallback).toBe(false);
    });

    it('should use the model from options over default', async () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'default-model' });

      const svc = new ProviderService('claude', null);
      await collectGenerator(svc.chat(MESSAGES, { model: 'custom-model', enableRetry: false }));

      expect(adapter.chat).toHaveBeenCalledWith(
        MESSAGES,
        expect.objectContaining({ model: 'custom-model' })
      );
    });

    it('should use the default model when no model in options', async () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'default-model' });

      const svc = new ProviderService('claude', null);
      await collectGenerator(svc.chat(MESSAGES, { enableRetry: false }));

      expect(adapter.chat).toHaveBeenCalledWith(
        MESSAGES,
        expect.objectContaining({ model: 'default-model' })
      );
    });

    it('should use undefined model when no default model exists', async () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue(undefined);

      const svc = new ProviderService('claude', null);
      await collectGenerator(svc.chat(MESSAGES, { enableRetry: false }));

      expect(adapter.chat).toHaveBeenCalledWith(
        MESSAGES,
        expect.objectContaining({ model: undefined })
      );
    });

    it('should throw when no adapter is found for primary provider', async () => {
      mockGetAdapter.mockReturnValue(null);

      const svc = new ProviderService('claude', null);
      await expect(collectGenerator(svc.chat(MESSAGES, { enableFallback: false }))).rejects.toThrow(
        'Provider claude is not configured'
      );
    });

    it('should throw UnifiedAIError with model_unavailable when no adapter', async () => {
      mockGetAdapter.mockReturnValue(null);

      const svc = new ProviderService('openai', null);
      try {
        await collectGenerator(svc.chat(MESSAGES, { enableFallback: false }));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnifiedAIError);
        expect(err.code).toBe('model_unavailable');
      }
    });

    it('should use providerId from options over service default', async () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'm' });

      const svc = new ProviderService('claude', null);
      const { result } = await collectGenerator(
        svc.chat(MESSAGES, { providerId: 'xai', enableRetry: false })
      );

      expect(mockGetAdapter).toHaveBeenCalledWith('xai');
      expect(result.providerId).toBe('xai');
    });

    // --------------------------------------------------------------------------
    // chat — retry path
    // --------------------------------------------------------------------------

    it('should retry on retryable errors up to 3 attempts', async () => {
      const retryableError = new UnifiedAIError('rate_limited', 'Rate limited', 'claude', true, 1);
      const adapter = createMockAdapter({
        chat: vi
          .fn()
          .mockImplementationOnce(async function* () {
            throw retryableError;
          })
          .mockImplementationOnce(async function* () {
            throw retryableError;
          })
          .mockImplementationOnce(async function* () {
            yield { type: 'text', text: 'ok' };
          }),
      });
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'm' });
      mockParseProviderError.mockReturnValue(retryableError);

      const svc = new ProviderService('claude', null);
      const { chunks } = await collectGenerator(
        svc.chat(MESSAGES, { enableRetry: true, enableFallback: false })
      );

      expect(chunks).toHaveLength(1);
      expect(adapter.chat).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new UnifiedAIError('auth_failed', 'Auth failed', 'claude', false);
      const adapter = createMockAdapter({
        chat: vi.fn().mockImplementationOnce(async function* () {
          throw nonRetryableError;
        }),
      });
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'm' });
      mockParseProviderError.mockReturnValue(nonRetryableError);

      const svc = new ProviderService('claude', null);
      await expect(
        collectGenerator(svc.chat(MESSAGES, { enableRetry: true, enableFallback: false }))
      ).rejects.toThrow('Auth failed');

      expect(adapter.chat).toHaveBeenCalledTimes(1);
    });

    it('should throw after exhausting all 3 retry attempts', async () => {
      const retryableError = new UnifiedAIError('server_error', 'Server error', 'claude', true, 1);
      const adapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw retryableError;
        }),
      });
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'm' });
      mockParseProviderError.mockReturnValue(retryableError);

      const svc = new ProviderService('claude', null);
      await expect(
        collectGenerator(svc.chat(MESSAGES, { enableRetry: true, enableFallback: false }))
      ).rejects.toThrow('Server error');

      expect(adapter.chat).toHaveBeenCalledTimes(3);
    });

    // --------------------------------------------------------------------------
    // chat — fallback path
    // --------------------------------------------------------------------------

    it('should fall back to fallback provider when primary fails', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Primary failed', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });
      const fallbackAdapter = createMockAdapter({
        chat: vi.fn(async function* () {
          yield { type: 'text', text: 'fallback reply' };
        }),
      });

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        if (id === 'openai') return fallbackAdapter;
        return null;
      });
      mockGetDefaultModel.mockReturnValue({ id: 'fallback-model' });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      const { chunks, result } = await collectGenerator(
        svc.chat(MESSAGES, { enableRetry: false, enableFallback: true })
      );

      expect(chunks[0]).toEqual({ type: 'text', text: 'fallback reply' });
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReason).toBe('Primary failed');
      expect(result.providerId).toBe('openai');
    });

    it('should call onProviderSwitch callback on fallback', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Down', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });
      const fallbackAdapter = createMockAdapter();
      const onSwitch = vi.fn();

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        if (id === 'openai') return fallbackAdapter;
        return null;
      });
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      await collectGenerator(
        svc.chat(MESSAGES, {
          enableRetry: false,
          enableFallback: true,
          onProviderSwitch: onSwitch,
        })
      );

      expect(onSwitch).toHaveBeenCalledWith('claude', 'openai', 'Down');
    });

    it('should throw original error when fallback adapter is not found', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Fail', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        return null; // fallback adapter not found
      });
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      await expect(
        collectGenerator(svc.chat(MESSAGES, { enableRetry: false, enableFallback: true }))
      ).rejects.toThrow('Fail');
    });

    it('should not fall back when canRecoverWithFallback returns false', async () => {
      const primaryError = new UnifiedAIError('auth_failed', 'Bad key', 'claude', false);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });

      mockGetAdapter.mockReturnValue(primaryAdapter);
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(false);

      const svc = new ProviderService('claude', 'openai');
      await expect(
        collectGenerator(svc.chat(MESSAGES, { enableRetry: false, enableFallback: true }))
      ).rejects.toThrow('Bad key');
    });

    it('should not fall back when fallbackProviderId is null', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Oops', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });

      mockGetAdapter.mockReturnValue(primaryAdapter);
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', null);
      await expect(
        collectGenerator(svc.chat(MESSAGES, { enableRetry: false, enableFallback: true }))
      ).rejects.toThrow('Oops');
    });

    it('should not fall back when enableFallback is false', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Down', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });

      mockGetAdapter.mockReturnValue(primaryAdapter);
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      await expect(
        collectGenerator(svc.chat(MESSAGES, { enableRetry: false, enableFallback: false }))
      ).rejects.toThrow('Down');
    });

    it('should use fallback provider default model instead of primary model', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Down', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });
      const fallbackAdapter = createMockAdapter();

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        if (id === 'openai') return fallbackAdapter;
        return null;
      });
      mockGetDefaultModel.mockImplementation((id: string) => {
        if (id === 'openai') return { id: 'gpt-5.2' };
        return { id: 'claude-sonnet' };
      });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      await collectGenerator(svc.chat(MESSAGES, { enableRetry: false, enableFallback: true }));

      expect(fallbackAdapter.chat).toHaveBeenCalledWith(
        MESSAGES,
        expect.objectContaining({ model: 'gpt-5.2' })
      );
    });

    it('should retry fallback provider up to 2 attempts', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Primary down', 'claude', true, 1);
      const fallbackError = new UnifiedAIError('server_error', 'Fallback flaky', 'openai', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });
      const fallbackAdapter = createMockAdapter({
        chat: vi
          .fn()
          .mockImplementationOnce(async function* () {
            throw fallbackError;
          })
          .mockImplementationOnce(async function* () {
            yield { type: 'text', text: 'recovered' };
          }),
      });

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        if (id === 'openai') return fallbackAdapter;
        return null;
      });
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockImplementation((err: unknown) => {
        if (err === primaryError) return primaryError;
        return fallbackError;
      });
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      const { chunks } = await collectGenerator(
        svc.chat(MESSAGES, { enableRetry: false, enableFallback: true })
      );

      expect(chunks[0]).toEqual({ type: 'text', text: 'recovered' });
      expect(fallbackAdapter.chat).toHaveBeenCalledTimes(2);
    });

    it('should throw when fallback also fails after 2 attempts with non-retryable error', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Primary down', 'claude', true, 1);
      const fallbackError = new UnifiedAIError('auth_failed', 'Bad key', 'openai', false);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });
      const fallbackAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw fallbackError;
        }),
      });

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        if (id === 'openai') return fallbackAdapter;
        return null;
      });
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockImplementation((err: unknown) => {
        if (err === primaryError) return primaryError;
        return fallbackError;
      });
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      await expect(
        collectGenerator(svc.chat(MESSAGES, { enableRetry: false, enableFallback: true }))
      ).rejects.toThrow('Bad key');
    });

    it('should parse non-UnifiedAIError errors before deciding on fallback', async () => {
      const rawError = new Error('Something weird');
      const parsedError = new UnifiedAIError('server_error', 'Parsed error', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw rawError;
        }),
      });
      const fallbackAdapter = createMockAdapter();

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        if (id === 'openai') return fallbackAdapter;
        return null;
      });
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockReturnValue(parsedError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      const svc = new ProviderService('claude', 'openai');
      const { result } = await collectGenerator(
        svc.chat(MESSAGES, { enableRetry: false, enableFallback: true })
      );

      expect(mockParseProviderError).toHaveBeenCalledWith(rawError, 'claude');
      expect(result.usedFallback).toBe(true);
    });

    it('should return result with model unknown when no default model for final provider', async () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue(undefined);

      const svc = new ProviderService('claude', null);
      const { result } = await collectGenerator(svc.chat(MESSAGES, { enableRetry: false }));

      expect(result.model).toBe('unknown');
    });

    it('should pass through extra chatOptions to the adapter', async () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'model' });

      const svc = new ProviderService('claude', null);
      await collectGenerator(
        svc.chat(MESSAGES, {
          enableRetry: false,
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: 'Be helpful',
        })
      );

      expect(adapter.chat).toHaveBeenCalledWith(
        MESSAGES,
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: 'Be helpful',
          model: 'model',
        })
      );
    });

    it('should yield multiple chunks from the primary provider', async () => {
      const adapter = createMockAdapter({
        chat: vi.fn(async function* () {
          yield { type: 'message_start' };
          yield { type: 'text', text: 'Hello ' };
          yield { type: 'text', text: 'world' };
          yield { type: 'message_end', usage: { inputTokens: 10, outputTokens: 5 } };
        }),
      });
      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'model' });

      const svc = new ProviderService('claude', null);
      const { chunks } = await collectGenerator(svc.chat(MESSAGES, { enableRetry: false }));

      expect(chunks).toHaveLength(4);
      expect(chunks[0].type).toBe('message_start');
      expect(chunks[1].text).toBe('Hello ');
      expect(chunks[2].text).toBe('world');
      expect(chunks[3].type).toBe('message_end');
    });

    it('should handle UnifiedAIError directly without re-parsing', async () => {
      const directError = new UnifiedAIError('content_filtered', 'Filtered', 'claude', false);
      const adapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw directError;
        }),
      });

      mockGetAdapter.mockReturnValue(adapter);
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockCanRecoverWithFallback.mockReturnValue(false);

      const svc = new ProviderService('claude', 'openai');
      try {
        await collectGenerator(svc.chat(MESSAGES, { enableRetry: false, enableFallback: true }));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBe(directError);
        // Should NOT have called parseProviderError since it was already a UnifiedAIError
        expect(mockParseProviderError).not.toHaveBeenCalled();
      }
    });

    it('should use fallbackProviderId from options over constructor fallback', async () => {
      const primaryError = new UnifiedAIError('server_error', 'Down', 'claude', true, 1);
      const primaryAdapter = createMockAdapter({
        chat: vi.fn().mockImplementation(async function* () {
          throw primaryError;
        }),
      });
      const xaiAdapter = createMockAdapter({
        chat: vi.fn(async function* () {
          yield { type: 'text', text: 'xai reply' };
        }),
      });

      mockGetAdapter.mockImplementation((id: string) => {
        if (id === 'claude') return primaryAdapter;
        if (id === 'xai') return xaiAdapter;
        return null;
      });
      mockGetDefaultModel.mockReturnValue({ id: 'model' });
      mockParseProviderError.mockReturnValue(primaryError);
      mockCanRecoverWithFallback.mockReturnValue(true);

      // constructor says fallback=openai, but options override to xai
      const svc = new ProviderService('claude', 'openai');
      const { result } = await collectGenerator(
        svc.chat(MESSAGES, {
          enableRetry: false,
          enableFallback: true,
          fallbackProviderId: 'xai',
        })
      );

      expect(result.providerId).toBe('xai');
    });
  });

  // --------------------------------------------------------------------------
  // switchProvider
  // --------------------------------------------------------------------------

  describe('switchProvider', () => {
    it('should successfully switch provider and update currentProviderId', async () => {
      const handoffResult = {
        messages: MESSAGES,
        fromProvider: 'claude',
        toProvider: 'openai',
        warnings: [],
        metadata: {
          handoffTime: '2026-02-27T00:00:00Z',
          originalMessageCount: 1,
          preparedMessageCount: 1,
          wasSummarized: false,
          processingTimeMs: 10,
        },
      };
      mockCanHandoff.mockReturnValue({ possible: true, warnings: [] });
      mockPrepareProviderHandoff.mockResolvedValue(handoffResult);

      const svc = new ProviderService('claude');
      const result = await svc.switchProvider(MESSAGES, 'openai');

      expect(result).toEqual(handoffResult);
      expect(svc.getCurrentProvider()).toBe('openai');
    });

    it('should throw when handoff is not possible', async () => {
      mockCanHandoff.mockReturnValue({
        possible: false,
        warnings: ['No vision support', 'Tool loss'],
      });

      const svc = new ProviderService('claude');
      await expect(svc.switchProvider(MESSAGES, 'deepseek')).rejects.toThrow(
        'Cannot handoff from claude to deepseek: No vision support, Tool loss'
      );
    });

    it('should throw UnifiedAIError with invalid_request when handoff fails', async () => {
      mockCanHandoff.mockReturnValue({ possible: false, warnings: ['Reason'] });

      const svc = new ProviderService('claude');
      try {
        await svc.switchProvider(MESSAGES, 'deepseek');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnifiedAIError);
        expect(err.code).toBe('invalid_request');
      }
    });

    it('should pass options to prepareProviderHandoff', async () => {
      mockCanHandoff.mockReturnValue({ possible: true, warnings: [] });
      mockPrepareProviderHandoff.mockResolvedValue({
        messages: MESSAGES,
        fromProvider: 'claude',
        toProvider: 'openai',
        warnings: [],
        metadata: {
          handoffTime: '2026-02-27T00:00:00Z',
          originalMessageCount: 1,
          preparedMessageCount: 1,
          wasSummarized: false,
          processingTimeMs: 5,
        },
      });

      const svc = new ProviderService('claude');
      const opts = { summarizeIfExceeds: 0.5, includeSystemPrompt: true };
      await svc.switchProvider(MESSAGES, 'openai', opts);

      expect(mockPrepareProviderHandoff).toHaveBeenCalledWith(MESSAGES, 'claude', 'openai', opts);
    });

    it('should not update currentProviderId when handoff fails', async () => {
      mockCanHandoff.mockReturnValue({ possible: false, warnings: ['Blocked'] });

      const svc = new ProviderService('claude');
      try {
        await svc.switchProvider(MESSAGES, 'openai');
      } catch {
        // expected
      }

      expect(svc.getCurrentProvider()).toBe('claude');
    });
  });

  // --------------------------------------------------------------------------
  // formatTools
  // --------------------------------------------------------------------------

  describe('formatTools', () => {
    it('should format tools using the current provider adapter', () => {
      const adapter = createMockAdapter({
        formatTools: vi.fn(() => [{ formatted: true }]),
      });
      mockGetAdapter.mockReturnValue(adapter);

      const svc = new ProviderService('claude');
      const tools = [
        { name: 'search', description: 'Search', parameters: { type: 'object', properties: {} } },
      ];
      const result = svc.formatTools(tools);

      expect(result).toEqual([{ formatted: true }]);
      expect(adapter.formatTools).toHaveBeenCalledWith(tools);
    });

    it('should use specified providerId over current provider', () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);

      const svc = new ProviderService('claude');
      svc.formatTools([], 'openai');

      expect(mockGetAdapter).toHaveBeenCalledWith('openai');
    });

    it('should throw when no adapter found', () => {
      mockGetAdapter.mockReturnValue(null);

      const svc = new ProviderService('claude');
      expect(() => svc.formatTools([])).toThrow('Provider claude not configured');
    });

    it('should throw with correct provider name for explicit providerId', () => {
      mockGetAdapter.mockReturnValue(null);

      const svc = new ProviderService('claude');
      expect(() => svc.formatTools([], 'xai')).toThrow('Provider xai not configured');
    });
  });

  // --------------------------------------------------------------------------
  // hasCapability
  // --------------------------------------------------------------------------

  describe('hasCapability', () => {
    it('should return true when adapter has the capability', () => {
      const adapter = createMockAdapter({
        hasCapability: vi.fn(() => true),
      });
      mockGetAdapter.mockReturnValue(adapter);

      const svc = new ProviderService('claude');
      expect(svc.hasCapability('vision')).toBe(true);
    });

    it('should return false when adapter lacks the capability', () => {
      const adapter = createMockAdapter({
        hasCapability: vi.fn(() => false),
      });
      mockGetAdapter.mockReturnValue(adapter);

      const svc = new ProviderService('claude');
      expect(svc.hasCapability('extendedThinking')).toBe(false);
    });

    it('should return false when no adapter is found', () => {
      mockGetAdapter.mockReturnValue(null);

      const svc = new ProviderService('claude');
      expect(svc.hasCapability('vision')).toBe(false);
    });

    it('should check capability on the specified provider', () => {
      const adapter = createMockAdapter();
      mockGetAdapter.mockReturnValue(adapter);

      const svc = new ProviderService('claude');
      svc.hasCapability('streaming', 'openai');

      expect(mockGetAdapter).toHaveBeenCalledWith('openai');
    });
  });
});

// ============================================================================
// Singleton Management
// ============================================================================

describe('getProviderService', () => {
  it('should return a ProviderService instance', () => {
    const svc = getProviderService();
    expect(svc).toBeInstanceOf(ProviderService);
  });

  it('should return the same instance on subsequent calls', () => {
    const svc1 = getProviderService();
    const svc2 = getProviderService();
    expect(svc1).toBe(svc2);
  });
});

describe('createProviderService', () => {
  it('should create a new ProviderService with defaults', () => {
    const svc = createProviderService();
    expect(svc).toBeInstanceOf(ProviderService);
  });

  it('should create a service with custom default provider', () => {
    const svc = createProviderService('xai');
    expect(svc.getCurrentProvider()).toBe('xai');
  });

  it('should create a service with custom fallback provider', () => {
    // We can only test indirectly; verify the service was created
    const svc = createProviderService('claude', 'deepseek');
    expect(svc).toBeInstanceOf(ProviderService);
    expect(svc.getCurrentProvider()).toBe('claude');
  });

  it('should create a new instance each time (not singleton)', () => {
    const svc1 = createProviderService();
    const svc2 = createProviderService();
    expect(svc1).not.toBe(svc2);
  });

  it('should handle null fallback provider', () => {
    const svc = createProviderService('claude', null);
    expect(svc).toBeInstanceOf(ProviderService);
  });
});

// ============================================================================
// Convenience Functions
// ============================================================================

describe('isProviderAvailable', () => {
  it('should delegate to registry isProviderAvailable', () => {
    mockCheckProviderAvailable.mockReturnValue(true);
    expect(isProviderAvailable('claude')).toBe(true);
    expect(mockCheckProviderAvailable).toHaveBeenCalledWith('claude');
  });

  it('should return false when provider is not available', () => {
    mockCheckProviderAvailable.mockReturnValue(false);
    expect(isProviderAvailable('deepseek')).toBe(false);
  });
});

describe('getAvailableProviders', () => {
  it('should return configured provider ids from the singleton', () => {
    mockCheckProviderAvailable.mockImplementation(
      (id: string) => id === 'claude' || id === 'google'
    );
    mockGetDefaultModel.mockReturnValue({ id: 'model' });

    const result = getAvailableProviders();
    expect(result).toEqual(['claude', 'google']);
  });

  it('should return empty array when nothing is configured', () => {
    mockCheckProviderAvailable.mockReturnValue(false);

    const result = getAvailableProviders();
    expect(result).toEqual([]);
  });
});

describe('chat (convenience function)', () => {
  it('should yield chunks from the default provider service', async () => {
    const adapter = createMockAdapter({
      chat: vi.fn(async function* () {
        yield { type: 'text', text: 'convenience reply' };
      }),
    });
    mockGetAdapter.mockReturnValue(adapter);
    mockGetDefaultModel.mockReturnValue({ id: 'model' });

    const { chunks, result } = await collectGenerator(chat(MESSAGES, { enableRetry: false }));

    expect(chunks[0]).toEqual({ type: 'text', text: 'convenience reply' });
    expect(result).toBeDefined();
    expect(result.usedFallback).toBe(false);
  });

  it('should pass options through to service.chat', async () => {
    const adapter = createMockAdapter();
    mockGetAdapter.mockReturnValue(adapter);
    mockGetDefaultModel.mockReturnValue({ id: 'model' });

    await collectGenerator(chat(MESSAGES, { temperature: 0.5, enableRetry: false }));

    expect(adapter.chat).toHaveBeenCalledWith(
      MESSAGES,
      expect.objectContaining({ temperature: 0.5 })
    );
  });

  it('should propagate errors from service.chat', async () => {
    mockGetAdapter.mockReturnValue(null);

    await expect(collectGenerator(chat(MESSAGES, { enableFallback: false }))).rejects.toThrow();
  });
});
