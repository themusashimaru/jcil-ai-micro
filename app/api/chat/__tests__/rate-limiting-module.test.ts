import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the rate limiter
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  checkResearchRateLimit,
  checkToolRateLimit,
  checkChatRateLimit,
  TOOL_RATE_LIMITS,
} from '../rate-limiting';
import { checkRateLimit } from '@/lib/security/rate-limit';

const mockCheckRateLimit = vi.mocked(checkRateLimit);

describe('TOOL_RATE_LIMITS', () => {
  it('should define rate limits for expensive tools', () => {
    expect(TOOL_RATE_LIMITS.run_code).toBe(100);
    expect(TOOL_RATE_LIMITS.browser_visit).toBe(50);
    expect(TOOL_RATE_LIMITS.generate_image).toBe(30);
    expect(TOOL_RATE_LIMITS.generate_video).toBe(10);
    expect(TOOL_RATE_LIMITS.extract_pdf).toBe(60);
    expect(TOOL_RATE_LIMITS.analyze_image).toBe(60);
  });
});

describe('checkResearchRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return allowed when under limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 400,
      resetAt: Date.now() + 3600000,
      retryAfter: undefined,
    });

    const result = await checkResearchRateLimit('user-123');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(400);
  });

  it('should return not allowed when over limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 300000,
      retryAfter: 300,
    });

    const result = await checkResearchRateLimit('user-123');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should use research-specific key prefix', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 100,
      resetAt: Date.now() + 3600000,
      retryAfter: undefined,
    });

    await checkResearchRateLimit('user-xyz');
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'chat:research:user-xyz',
      expect.objectContaining({ limit: expect.any(Number), windowMs: expect.any(Number) })
    );
  });
});

describe('checkToolRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow tools without rate limits', async () => {
    const result = await checkToolRateLimit('user-123', 'web_search');
    expect(result.allowed).toBe(true);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('should check rate limit for run_code', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 90,
      resetAt: Date.now() + 3600000,
      retryAfter: undefined,
    });

    const result = await checkToolRateLimit('user-123', 'run_code');
    expect(result.allowed).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'chat:tool:user-123:run_code',
      expect.objectContaining({ limit: 100 })
    );
  });

  it('should return limit when exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 600000,
      retryAfter: 600,
    });

    const result = await checkToolRateLimit('user-123', 'generate_video');
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(10);
  });

  it('should not return limit when allowed', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 5,
      resetAt: Date.now() + 3600000,
      retryAfter: undefined,
    });

    const result = await checkToolRateLimit('user-123', 'browser_visit');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeUndefined();
  });
});

describe('checkChatRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check authenticated rate limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 100,
      resetAt: Date.now() + 3600000,
      retryAfter: undefined,
    });

    const result = await checkChatRateLimit('user-123', true);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
    expect(result.resetIn).toBe(0);
  });

  it('should check anonymous rate limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 20,
      resetAt: Date.now() + 3600000,
      retryAfter: undefined,
    });

    const result = await checkChatRateLimit('ip-192.168.1.1', false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(20);
  });

  it('should return resetIn when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1800000,
      retryAfter: 1800,
    });

    const result = await checkChatRateLimit('user-123', true);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetIn).toBe(1800);
  });

  it('should use message-specific key prefix', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 50,
      resetAt: Date.now() + 3600000,
      retryAfter: undefined,
    });

    await checkChatRateLimit('user-abc', true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'chat:msg:user-abc',
      expect.objectContaining({ limit: expect.any(Number) })
    );
  });
});
