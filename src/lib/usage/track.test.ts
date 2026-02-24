import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => ({})),
}));
vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
  })),
}));
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { calculateCost, trackTokenUsage } from './track';

describe('calculateCost', () => {
  it('should calculate cost for claude-opus-4-6', () => {
    // 1M input tokens at $5/M + 1M output tokens at $25/M = $30
    const cost = calculateCost('claude-opus-4-6', 1_000_000, 1_000_000);
    expect(cost).toBe(30);
  });

  it('should calculate cost for claude-sonnet-4-6', () => {
    // 1M input at $3/M + 1M output at $15/M = $18
    const cost = calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(cost).toBe(18);
  });

  it('should calculate cost for claude-haiku-4-5-20251001', () => {
    // 1M input at $0.8/M + 1M output at $4/M = $4.8
    const cost = calculateCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);
    expect(cost).toBe(4.8);
  });

  it('should calculate cost for gpt-5.2', () => {
    // 1M input at $5/M + 1M output at $15/M = $20
    const cost = calculateCost('gpt-5.2', 1_000_000, 1_000_000);
    expect(cost).toBe(20);
  });

  it('should calculate cost for deepseek-chat', () => {
    // 1M input at $0.2/M + 1M output at $0.5/M = $0.7
    const cost = calculateCost('deepseek-chat', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.7);
  });

  it('should calculate cost for deepseek-reasoner', () => {
    // 1M input at $0.2/M + 1M output at $1.5/M = $1.7
    const cost = calculateCost('deepseek-reasoner', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(1.7);
  });

  it('should return 0 for 0 tokens', () => {
    const cost = calculateCost('claude-sonnet-4-6', 0, 0);
    expect(cost).toBe(0);
  });

  it('should handle small token counts', () => {
    // 1000 input at $3/M + 500 output at $15/M
    const cost = calculateCost('claude-sonnet-4-6', 1000, 500);
    expect(cost).toBeCloseTo(0.003 + 0.0075);
  });

  it('should apply cache discount for cached input tokens', () => {
    // Normal: 1M input at $3/M = $3
    // With 500K cached: (500K regular at $3/M) + (500K cached at $0.3/M) = $1.5 + $0.15 = $1.65
    const normalCost = calculateCost('claude-sonnet-4-6', 1_000_000, 0);
    const cachedCost = calculateCost('claude-sonnet-4-6', 1_000_000, 0, 500_000);
    expect(cachedCost).toBeLessThan(normalCost);
    // Savings: 500K * ($3 - $0.3) / 1M = $1.35
    expect(normalCost - cachedCost).toBeCloseTo(1.35);
  });

  it('should not apply cache discount for models without cache pricing', () => {
    // GPT-5.2 has no cacheRead pricing
    const normalCost = calculateCost('gpt-5.2', 1_000_000, 0);
    const cachedCost = calculateCost('gpt-5.2', 1_000_000, 0, 500_000);
    expect(cachedCost).toBe(normalCost);
  });

  it('should not apply cache discount for 0 cached tokens', () => {
    const normalCost = calculateCost('claude-sonnet-4-6', 1_000_000, 0);
    const cachedCost = calculateCost('claude-sonnet-4-6', 1_000_000, 0, 0);
    expect(cachedCost).toBe(normalCost);
  });

  it('should use Sonnet defaults for unknown models', () => {
    // Unknown model defaults to Sonnet: $3/M input + $15/M output
    const cost = calculateCost('unknown-model-xyz', 1_000_000, 1_000_000);
    expect(cost).toBe(18); // Same as Sonnet
  });

  it('should never return negative cost', () => {
    // Even with large cache values, cost should be >= 0
    const cost = calculateCost('claude-sonnet-4-6', 100, 0, 1_000_000);
    expect(cost).toBeGreaterThanOrEqual(0);
  });
});

describe('trackTokenUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip tracking for 0 token records', async () => {
    await trackTokenUsage({
      userId: 'user-123',
      modelName: 'claude-sonnet-4-6',
      inputTokens: 0,
      outputTokens: 0,
    });
    // Should return without inserting
    const { untypedFrom } = await import('@/lib/supabase/workspace-client');
    expect(untypedFrom).not.toHaveBeenCalled();
  });

  it('should track non-zero token usage', async () => {
    const { untypedFrom } = await import('@/lib/supabase/workspace-client');
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    (untypedFrom as ReturnType<typeof vi.fn>).mockReturnValue({ insert: mockInsert });

    await trackTokenUsage({
      userId: 'user-123',
      modelName: 'claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 500,
      source: 'chat',
    });

    expect(untypedFrom).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        model_name: 'claude-sonnet-4-6',
        input_tokens: 1000,
        output_tokens: 500,
        source: 'chat',
      })
    );
  });

  it('should handle insert errors gracefully', async () => {
    const { untypedFrom } = await import('@/lib/supabase/workspace-client');
    (untypedFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    });

    // Should not throw
    await expect(
      trackTokenUsage({
        userId: 'user-123',
        modelName: 'claude-sonnet-4-6',
        inputTokens: 100,
        outputTokens: 50,
      })
    ).resolves.toBeUndefined();
  });

  it('should handle exceptions gracefully', async () => {
    const { untypedFrom } = await import('@/lib/supabase/workspace-client');
    (untypedFrom as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Connection failed');
    });

    // Should not throw
    await expect(
      trackTokenUsage({
        userId: 'user-123',
        modelName: 'claude-sonnet-4-6',
        inputTokens: 100,
        outputTokens: 50,
      })
    ).resolves.toBeUndefined();
  });

  it('should default source to unknown when not provided', async () => {
    const { untypedFrom } = await import('@/lib/supabase/workspace-client');
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    (untypedFrom as ReturnType<typeof vi.fn>).mockReturnValue({ insert: mockInsert });

    await trackTokenUsage({
      userId: 'user-123',
      modelName: 'claude-sonnet-4-6',
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ source: 'unknown' }));
  });
});
