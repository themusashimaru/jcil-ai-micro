import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock providers registry
const mockGetDefaultChatModelId = vi.fn().mockReturnValue('claude-3-5-sonnet-20241022');
const mockGetDefaultModel = vi.fn();
const mockIsProviderAvailable = vi.fn();
const mockGetProviderAndModel = vi.fn();
const mockGetAvailableProviderIds = vi.fn().mockReturnValue(['claude', 'openai']);

vi.mock('@/lib/ai/providers/registry', () => ({
  getDefaultModel: (...args: unknown[]) => mockGetDefaultModel(...args),
  getDefaultChatModelId: () => mockGetDefaultChatModelId(),
  isProviderAvailable: (...args: unknown[]) => mockIsProviderAvailable(...args),
  getProviderAndModel: (...args: unknown[]) => mockGetProviderAndModel(...args),
  getAvailableProviderIds: () => mockGetAvailableProviderIds(),
}));

// Mock other dependencies
vi.mock('@/lib/ai/providers/adapters', () => ({
  getAdapter: vi.fn(),
}));

vi.mock('@/lib/queue', () => ({
  releaseSlot: vi.fn(),
}));

vi.mock('@/lib/pending-requests', () => ({
  createPendingRequest: vi.fn().mockResolvedValue('pending-123'),
  completePendingRequest: vi.fn(),
}));

vi.mock('@/lib/api/utils', () => ({
  chatErrorResponse: (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status }),
}));

vi.mock('@/lib/constants', () => ({
  ERROR_CODES: { INVALID_INPUT: 'INVALID_INPUT' },
  HTTP_STATUS: { BAD_REQUEST: 400 },
  TIMEOUTS: { API_REQUEST: 30000, AI_RESPONSE: 120000 },
}));

vi.mock('@/lib/usage/track', () => ({
  trackTokenUsage: vi.fn(),
}));

vi.mock('@/lib/limits', () => ({
  incrementTokenUsage: vi.fn(),
}));

vi.mock('@/lib/memory', () => ({
  processConversationForMemory: vi.fn(),
}));

vi.mock('@/lib/ai/chat-router', () => ({
  routeChatWithTools: vi.fn(),
}));

import { resolveProvider, createStreamPendingRequest } from '../streaming';

describe('streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveProvider', () => {
    it('should default to Claude when no provider specified', () => {
      const result = resolveProvider(undefined);
      expect(result.selectedProviderId).toBe('claude');
      expect(result.selectedModel).toBe('claude-3-5-sonnet-20241022');
      expect(result.error).toBeUndefined();
    });

    it('should use Claude when provider is undefined', () => {
      const result = resolveProvider(undefined);
      expect(result.selectedProviderId).toBe('claude');
    });

    it('should select available provider', () => {
      mockIsProviderAvailable.mockReturnValue(true);
      mockGetDefaultModel.mockReturnValue({ id: 'gpt-4' });

      const result = resolveProvider('openai');
      expect(result.selectedProviderId).toBe('openai');
      expect(result.selectedModel).toBe('gpt-4');
      expect(result.error).toBeUndefined();
    });

    it('should return error for unavailable provider', () => {
      mockIsProviderAvailable.mockReturnValue(false);

      const result = resolveProvider('nonexistent');
      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(Response);
    });

    it('should fall back to Claude defaults when provider is unavailable', () => {
      mockIsProviderAvailable.mockReturnValue(false);

      const result = resolveProvider('nonexistent');
      expect(result.selectedProviderId).toBe('claude');
      expect(result.selectedModel).toBe('claude-3-5-sonnet-20241022');
    });

    it('should handle provider with no default model gracefully', () => {
      mockIsProviderAvailable.mockReturnValue(true);
      mockGetDefaultModel.mockReturnValue(null);

      const result = resolveProvider('openai');
      // Should still use default Claude model since getDefaultModel returned null
      expect(result.selectedModel).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('createStreamPendingRequest', () => {
    it('should return null when no conversationId', async () => {
      const result = await createStreamPendingRequest({
        userId: 'user-1',
        messages: [],
        model: 'claude-3',
      });
      expect(result).toBeNull();
    });

    it('should create pending request with conversationId', async () => {
      const result = await createStreamPendingRequest({
        userId: 'user-1',
        conversationId: 'conv-123',
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3',
      });
      expect(result).toBe('pending-123');
    });

    it('should serialize message content to string', async () => {
      const { createPendingRequest } = await import('@/lib/pending-requests');

      await createStreamPendingRequest({
        userId: 'user-1',
        conversationId: 'conv-123',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        model: 'claude-3',
      });

      expect(createPendingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.any(String),
            }),
          ]),
        })
      );
    });
  });
});
