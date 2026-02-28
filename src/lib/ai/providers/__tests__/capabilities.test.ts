// @ts-nocheck - Test file with extensive mocking
/**
 * CAPABILITIES TESTS
 *
 * Comprehensive tests for provider capability detection, comparison,
 * message analysis, provider selection, and capability matrix utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderId, ProviderConfig, ProviderCapabilities, UnifiedMessage } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Build realistic provider fixtures used by the registry mock
const makeCapabilities = (overrides: Partial<ProviderCapabilities> = {}): ProviderCapabilities => ({
  vision: true,
  parallelToolCalls: true,
  streaming: true,
  systemMessages: true,
  jsonMode: false,
  toolCalling: true,
  extendedThinking: true,
  ...overrides,
});

const claudeConfig: ProviderConfig = {
  id: 'claude',
  name: 'Claude',
  family: 'anthropic',
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  capabilities: makeCapabilities({ jsonMode: false, extendedThinking: true }),
  models: [
    {
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputPricePer1M: 5,
      outputPricePer1M: 25,
      tier: 'premium',
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      inputPricePer1M: 3,
      outputPricePer1M: 15,
      tier: 'standard',
      isDefault: true,
    },
    {
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.8,
      outputPricePer1M: 4,
      tier: 'budget',
      capabilities: { vision: false } as Partial<ProviderCapabilities> as ProviderCapabilities,
    },
  ],
};

const openaiConfig: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  family: 'openai-compatible',
  apiKeyEnv: 'OPENAI_API_KEY',
  capabilities: makeCapabilities({ jsonMode: true, extendedThinking: false }),
  models: [
    {
      id: 'gpt-5.2',
      name: 'GPT-5.2',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputPricePer1M: 5,
      outputPricePer1M: 15,
      tier: 'premium',
      isDefault: true,
    },
  ],
};

const xaiConfig: ProviderConfig = {
  id: 'xai',
  name: 'xAI (Grok)',
  family: 'openai-compatible',
  apiKeyEnv: 'XAI_API_KEY',
  capabilities: makeCapabilities({ jsonMode: true, extendedThinking: false }),
  models: [
    {
      id: 'grok-4-1-fast-reasoning',
      name: 'Grok 4.1 Fast',
      contextWindow: 2000000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.2,
      outputPricePer1M: 0.5,
      tier: 'budget',
      isDefault: true,
    },
  ],
};

const deepseekConfig: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  family: 'openai-compatible',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  capabilities: makeCapabilities({
    vision: false,
    jsonMode: true,
    extendedThinking: false,
  }),
  models: [
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek Reasoner',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.55,
      outputPricePer1M: 2.19,
      tier: 'standard',
      isDefault: true,
    },
  ],
};

const providerMap: Record<string, ProviderConfig> = {
  claude: claudeConfig,
  openai: openaiConfig,
  xai: xaiConfig,
  deepseek: deepseekConfig,
};

// Mock the registry module. The mock functions are hoisted so they can be
// reconfigured per-test if needed (e.g. to simulate missing providers).
const mockGetProvider = vi.fn((id: ProviderId) => {
  const p = providerMap[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
});

const mockGetModelCapabilities = vi.fn((providerId: ProviderId, modelId: string) => {
  const provider = providerMap[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const model = provider.models.find((m) => m.id === modelId);
  if (!model) return provider.capabilities;
  return { ...provider.capabilities, ...model.capabilities };
});

const mockGetAvailableProviders = vi.fn(() => Object.values(providerMap));
const mockGetAllProviders = vi.fn(() => Object.values(providerMap));

vi.mock('../registry', () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...(args as [ProviderId])),
  getModelCapabilities: (...args: unknown[]) =>
    mockGetModelCapabilities(...(args as [ProviderId, string])),
  getAvailableProviders: (...args: unknown[]) => mockGetAvailableProviders(...args),
  getAllProviders: (...args: unknown[]) => mockGetAllProviders(...args),
}));

// Import the module under test AFTER mocks are set up
import {
  hasCapability,
  supportsVision,
  supportsParallelTools,
  supportsToolCalling,
  supportsStreaming,
  supportsSystemMessages,
  compareCapabilities,
  getCapabilityWarnings,
  messageContainsImages,
  conversationContainsImages,
  messageContainsToolCalls,
  conversationContainsToolCalls,
  findProvidersForRequirements,
  getBestProviderForConversation,
  getCapabilityMatrix,
  getProvidersWithAllCapabilities,
} from '../capabilities';

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock implementations to defaults
  mockGetProvider.mockImplementation((id: ProviderId) => {
    const p = providerMap[id];
    if (!p) throw new Error(`Unknown provider: ${id}`);
    return p;
  });
  mockGetModelCapabilities.mockImplementation((providerId: ProviderId, modelId: string) => {
    const provider = providerMap[providerId];
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    const model = provider.models.find((m) => m.id === modelId);
    if (!model) return provider.capabilities;
    return { ...provider.capabilities, ...model.capabilities };
  });
  mockGetAvailableProviders.mockImplementation(() => Object.values(providerMap));
  mockGetAllProviders.mockImplementation(() => Object.values(providerMap));
});

// ============================================================================
// hasCapability
// ============================================================================

describe('hasCapability', () => {
  it('returns true for a capability the provider supports', () => {
    expect(hasCapability('claude', 'vision')).toBe(true);
  });

  it('returns false for a capability the provider does not support', () => {
    expect(hasCapability('deepseek', 'vision')).toBe(false);
  });

  it('delegates to getModelCapabilities when modelId is provided', () => {
    hasCapability('claude', 'vision', 'claude-opus-4-6');
    expect(mockGetModelCapabilities).toHaveBeenCalledWith('claude', 'claude-opus-4-6');
  });

  it('uses model-specific capability overrides', () => {
    // claude-haiku has vision:false override
    expect(hasCapability('claude', 'vision', 'claude-haiku-4-5-20251001')).toBe(false);
  });

  it('returns false when provider lookup throws', () => {
    mockGetProvider.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(hasCapability('claude', 'vision')).toBe(false);
  });

  it('returns false when getModelCapabilities throws', () => {
    mockGetModelCapabilities.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(hasCapability('claude', 'vision', 'nonexistent-model')).toBe(false);
  });
});

// ============================================================================
// Convenience capability checkers
// ============================================================================

describe('supportsVision', () => {
  it('returns true for vision-capable provider', () => {
    expect(supportsVision('claude')).toBe(true);
  });

  it('returns false for non-vision provider', () => {
    expect(supportsVision('deepseek')).toBe(false);
  });

  it('passes modelId through', () => {
    supportsVision('claude', 'claude-opus-4-6');
    expect(mockGetModelCapabilities).toHaveBeenCalledWith('claude', 'claude-opus-4-6');
  });
});

describe('supportsParallelTools', () => {
  it('returns true when provider supports parallel tool calls', () => {
    expect(supportsParallelTools('openai')).toBe(true);
  });
});

describe('supportsToolCalling', () => {
  it('returns true for tool-calling provider', () => {
    expect(supportsToolCalling('claude')).toBe(true);
  });
});

describe('supportsStreaming', () => {
  it('returns true for streaming-capable provider', () => {
    expect(supportsStreaming('xai')).toBe(true);
  });
});

describe('supportsSystemMessages', () => {
  it('returns true for system-message-capable provider', () => {
    expect(supportsSystemMessages('deepseek')).toBe(true);
  });
});

// ============================================================================
// compareCapabilities
// ============================================================================

describe('compareCapabilities', () => {
  it('reports lost capabilities when switching from claude to deepseek', () => {
    const result = compareCapabilities('claude', 'deepseek');
    expect(result.lost).toContain('vision');
    expect(result.lost).not.toContain('streaming');
  });

  it('reports gained capabilities when switching from deepseek to claude', () => {
    const result = compareCapabilities('deepseek', 'claude');
    expect(result.gained).toContain('vision');
  });

  it('includes capabilities unchanged between providers in same array', () => {
    const result = compareCapabilities('claude', 'openai');
    expect(result.same).toContain('streaming');
    expect(result.same).toContain('vision');
    expect(result.same).toContain('toolCalling');
  });

  it('reports jsonMode gained when switching claude -> openai', () => {
    const result = compareCapabilities('claude', 'openai');
    expect(result.gained).toContain('jsonMode');
  });

  it('returns all capabilities in exactly one of gained/lost/same', () => {
    const result = compareCapabilities('claude', 'deepseek');
    const total = result.gained.length + result.lost.length + result.same.length;
    // The function compares 6 specific capabilities
    expect(total).toBe(6);
  });
});

// ============================================================================
// getCapabilityWarnings
// ============================================================================

describe('getCapabilityWarnings', () => {
  it('returns warning strings for lost capabilities', () => {
    const warnings = getCapabilityWarnings('claude', 'deepseek');
    expect(warnings.length).toBeGreaterThan(0);
    // vision is lost — should contain image-related warning
    expect(warnings.some((w) => w.toLowerCase().includes('image'))).toBe(true);
  });

  it('returns empty array when no capabilities are lost', () => {
    // claude -> openai: claude lacks jsonMode, openai gains it — but openai lacks extendedThinking
    // However extendedThinking is NOT in the 6 capabilities that compareCapabilities checks
    // claude has all 6 except jsonMode; openai has all 6 including jsonMode
    // So claude -> openai: gains jsonMode, loses nothing from the 6 checked
    const warnings = getCapabilityWarnings('claude', 'openai');
    expect(warnings).toEqual([]);
  });

  it('includes tool calling warning when switching to non-tool provider', () => {
    // Create a provider without tool calling
    const noToolProvider: ProviderConfig = {
      ...deepseekConfig,
      id: 'deepseek' as ProviderId,
      capabilities: { ...deepseekConfig.capabilities, toolCalling: false },
    };
    mockGetProvider.mockImplementation((id: ProviderId) => {
      if (id === 'deepseek') return noToolProvider;
      return (
        providerMap[id] ??
        (() => {
          throw new Error('not found');
        })()
      );
    });

    const warnings = getCapabilityWarnings('claude', 'deepseek');
    expect(warnings.some((w) => w.toLowerCase().includes('tool'))).toBe(true);
  });
});

// ============================================================================
// Message analysis
// ============================================================================

describe('messageContainsImages', () => {
  it('returns false for string content', () => {
    const msg: UnifiedMessage = { role: 'user', content: 'Hello' };
    expect(messageContainsImages(msg)).toBe(false);
  });

  it('returns false for content blocks without images', () => {
    const msg: UnifiedMessage = {
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }],
    };
    expect(messageContainsImages(msg)).toBe(false);
  });

  it('returns true when content contains an image block', () => {
    const msg: UnifiedMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'Look at this' },
        { type: 'image', source: { type: 'base64', data: 'abc' } },
      ],
    };
    expect(messageContainsImages(msg)).toBe(true);
  });
});

describe('conversationContainsImages', () => {
  it('returns false for empty conversation', () => {
    expect(conversationContainsImages([])).toBe(false);
  });

  it('returns true if any message contains images', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'Hello' },
      {
        role: 'user',
        content: [{ type: 'image', source: { type: 'url', url: 'https://example.com/img.png' } }],
      },
    ];
    expect(conversationContainsImages(messages)).toBe(true);
  });

  it('returns false if no messages contain images', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    expect(conversationContainsImages(messages)).toBe(false);
  });
});

describe('messageContainsToolCalls', () => {
  it('returns false for string content', () => {
    const msg: UnifiedMessage = { role: 'assistant', content: 'Hello' };
    expect(messageContainsToolCalls(msg)).toBe(false);
  });

  it('returns true when content contains tool_use block', () => {
    const msg: UnifiedMessage = {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'call-1', name: 'search', arguments: { q: 'test' } }],
    };
    expect(messageContainsToolCalls(msg)).toBe(true);
  });

  it('returns false for content blocks without tool_use', () => {
    const msg: UnifiedMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'result' }],
    };
    expect(messageContainsToolCalls(msg)).toBe(false);
  });
});

describe('conversationContainsToolCalls', () => {
  it('returns true if any message contains tool calls', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'Search for X' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'c1', name: 'search', arguments: {} }],
      },
    ];
    expect(conversationContainsToolCalls(messages)).toBe(true);
  });

  it('returns false for conversation without tool calls', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ];
    expect(conversationContainsToolCalls(messages)).toBe(false);
  });
});

// ============================================================================
// findProvidersForRequirements
// ============================================================================

describe('findProvidersForRequirements', () => {
  it('returns all providers when no requirements are specified', () => {
    const result = findProvidersForRequirements({});
    expect(result).toEqual(expect.arrayContaining(['claude', 'openai', 'xai', 'deepseek']));
  });

  it('filters out providers that lack vision', () => {
    const result = findProvidersForRequirements({ vision: true });
    expect(result).not.toContain('deepseek');
    expect(result).toContain('claude');
  });

  it('filters by maxContextTokens', () => {
    // Only xai has a model with contextWindow >= 500000
    const result = findProvidersForRequirements({ maxContextTokens: 500000 });
    expect(result).toContain('xai');
    expect(result).not.toContain('deepseek');
  });

  it('uses getAllProviders when onlyAvailable is false', () => {
    findProvidersForRequirements({}, false);
    expect(mockGetAllProviders).toHaveBeenCalled();
    expect(mockGetAvailableProviders).not.toHaveBeenCalled();
  });

  it('uses getAvailableProviders by default (onlyAvailable=true)', () => {
    findProvidersForRequirements({});
    expect(mockGetAvailableProviders).toHaveBeenCalled();
  });

  it('can combine multiple requirements', () => {
    const result = findProvidersForRequirements({
      vision: true,
      streaming: true,
      toolCalling: true,
    });
    expect(result).toContain('claude');
    expect(result).toContain('openai');
    expect(result).not.toContain('deepseek');
  });

  it('returns empty array when no providers meet requirements', () => {
    const result = findProvidersForRequirements({ maxContextTokens: 999999999 });
    expect(result).toEqual([]);
  });
});

// ============================================================================
// getBestProviderForConversation
// ============================================================================

describe('getBestProviderForConversation', () => {
  it('returns preferred provider when it meets requirements', () => {
    const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = getBestProviderForConversation(messages, 'openai');
    expect(result).toBe('openai');
  });

  it('returns claude as highest-priority default', () => {
    const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = getBestProviderForConversation(messages);
    expect(result).toBe('claude');
  });

  it('adds vision requirement when conversation contains images', () => {
    const messages: UnifiedMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', source: { type: 'base64', data: 'abc' } }],
      },
    ];
    // deepseek lacks vision — should NOT be selected even if preferred
    // But we mock getAvailableProviders to only return deepseek to prove it falls through
    mockGetAvailableProviders.mockReturnValue([deepseekConfig]);
    const result = getBestProviderForConversation(messages, 'deepseek');
    // No candidate meets vision requirement, so fallback to 'claude'
    expect(result).toBe('claude');
  });

  it('ignores preferred provider that does not meet requirements', () => {
    // Only return providers that support vision
    mockGetAvailableProviders.mockReturnValue([claudeConfig, openaiConfig]);
    const messages: UnifiedMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', source: { type: 'url', url: 'https://example.com/img.png' } }],
      },
    ];
    const result = getBestProviderForConversation(messages, 'deepseek');
    expect(result).not.toBe('deepseek');
    expect(result).toBe('claude');
  });

  it('follows priority order: claude > openai > xai > deepseek', () => {
    // Remove claude from available, openai should be selected
    mockGetAvailableProviders.mockReturnValue([openaiConfig, xaiConfig, deepseekConfig]);
    const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = getBestProviderForConversation(messages);
    expect(result).toBe('openai');
  });

  it('selects xai when claude and openai are unavailable', () => {
    mockGetAvailableProviders.mockReturnValue([xaiConfig, deepseekConfig]);
    const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = getBestProviderForConversation(messages);
    expect(result).toBe('xai');
  });

  it('falls back to claude when no candidates match', () => {
    mockGetAvailableProviders.mockReturnValue([]);
    const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = getBestProviderForConversation(messages);
    expect(result).toBe('claude');
  });
});

// ============================================================================
// getCapabilityMatrix
// ============================================================================

describe('getCapabilityMatrix', () => {
  it('returns capability records for all four providers', () => {
    const matrix = getCapabilityMatrix();
    expect(Object.keys(matrix)).toEqual(
      expect.arrayContaining(['claude', 'openai', 'xai', 'deepseek'])
    );
  });

  it('reflects each provider capabilities accurately', () => {
    const matrix = getCapabilityMatrix();
    expect(matrix['claude'].vision).toBe(true);
    expect(matrix['deepseek'].vision).toBe(false);
    expect(matrix['openai'].jsonMode).toBe(true);
    expect(matrix['claude'].jsonMode).toBe(false);
  });

  it('returns a copy — mutating the matrix does not affect providers', () => {
    const matrix = getCapabilityMatrix();
    matrix['claude'].vision = false;
    // Re-fetch to verify original is untouched
    const matrix2 = getCapabilityMatrix();
    expect(matrix2['claude'].vision).toBe(true);
  });
});

// ============================================================================
// getProvidersWithAllCapabilities
// ============================================================================

describe('getProvidersWithAllCapabilities', () => {
  it('returns providers that have ALL specified capabilities', () => {
    const result = getProvidersWithAllCapabilities(['vision', 'streaming']);
    expect(result).toContain('claude');
    expect(result).toContain('openai');
    expect(result).not.toContain('deepseek');
  });

  it('returns all four providers for universally supported capabilities', () => {
    const result = getProvidersWithAllCapabilities(['streaming', 'toolCalling']);
    expect(result).toEqual(expect.arrayContaining(['claude', 'openai', 'xai', 'deepseek']));
  });

  it('returns empty array when no provider has all required capabilities', () => {
    // extendedThinking is only on claude; jsonMode is only on openai/xai/deepseek
    const result = getProvidersWithAllCapabilities(['extendedThinking', 'jsonMode']);
    expect(result).toEqual([]);
  });

  it('returns all providers when given empty capability list', () => {
    const result = getProvidersWithAllCapabilities([]);
    expect(result).toEqual(expect.arrayContaining(['claude', 'openai', 'xai', 'deepseek']));
  });
});
