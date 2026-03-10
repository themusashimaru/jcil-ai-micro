import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { RateLimitResult } from '@/lib/security/rate-limit';

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test
// ---------------------------------------------------------------------------

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

// Import *after* mocks are set up so the module picks up the mocked deps
import {
  checkChatRateLimit,
  checkResearchRateLimit,
  checkToolRateLimit,
  TOOL_RATE_LIMITS,
} from '../rate-limiting';
import { checkRateLimit } from '@/lib/security/rate-limit';

const mockCheckRateLimit = checkRateLimit as Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a RateLimitResult representing an allowed request. */
function allowed(remaining: number, retryAfter?: number): RateLimitResult {
  return {
    allowed: true,
    remaining,
    resetAt: Date.now() + 3_600_000,
    retryAfter,
  };
}

/** Build a RateLimitResult representing a blocked request. */
function blocked(retryAfter = 3600): RateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 3_600_000,
    retryAfter,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rate-limiting (chat route layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // checkChatRateLimit
  // -----------------------------------------------------------------------

  describe('checkChatRateLimit', () => {
    it('returns allowed with remaining count when authenticated user is within limit', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(allowed(100));

      const result = await checkChatRateLimit('user-123', true);

      expect(result).toEqual({
        allowed: true,
        remaining: 100,
        resetIn: 0,
      });

      // Verify the correct key prefix and authenticated limit (120 default)
      expect(mockCheckRateLimit).toHaveBeenCalledWith('chat:msg:user-123', {
        limit: 120,
        windowMs: 3_600_000,
      });
    });

    it('returns blocked with resetIn when limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(blocked(1800));

      const result = await checkChatRateLimit('user-123', true);

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        resetIn: 1800,
      });
    });

    it('uses the correct limit for authenticated vs anonymous users', async () => {
      // Authenticated call -- should use 120 (RATE_LIMIT_AUTH default)
      mockCheckRateLimit.mockResolvedValueOnce(allowed(119));
      await checkChatRateLimit('auth-user', true);

      expect(mockCheckRateLimit).toHaveBeenCalledWith('chat:msg:auth-user', {
        limit: 120,
        windowMs: 3_600_000,
      });

      // Anonymous call -- should use 30 (RATE_LIMIT_ANON default)
      mockCheckRateLimit.mockResolvedValueOnce(allowed(29));
      await checkChatRateLimit('anon-ip', false);

      expect(mockCheckRateLimit).toHaveBeenCalledWith('chat:msg:anon-ip', {
        limit: 30,
        windowMs: 3_600_000,
      });
    });

    it('returns resetIn of 0 when retryAfter is undefined', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 50,
        resetAt: Date.now() + 3_600_000,
        // no retryAfter field
      } satisfies RateLimitResult);

      const result = await checkChatRateLimit('user-x', true);
      expect(result.resetIn).toBe(0);
    });

    it('propagates retryAfter as resetIn when the request is blocked', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(blocked(900));

      const result = await checkChatRateLimit('user-blocked', false);

      expect(result.resetIn).toBe(900);
      expect(result.allowed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // checkResearchRateLimit
  // -----------------------------------------------------------------------

  describe('checkResearchRateLimit', () => {
    it('returns allowed with remaining count when within limit', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(allowed(450));

      const result = await checkResearchRateLimit('user-456');

      expect(result).toEqual({
        allowed: true,
        remaining: 450,
      });

      // Verify the correct key prefix and research limit (500 default)
      expect(mockCheckRateLimit).toHaveBeenCalledWith('chat:research:user-456', {
        limit: 500,
        windowMs: 3_600_000,
      });
    });

    it('returns blocked when research limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(blocked());

      const result = await checkResearchRateLimit('user-456');

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
      });
    });

    it('uses the chat:research: key prefix for all calls', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(allowed(499));

      await checkResearchRateLimit('some-identifier');

      expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
      const callArgs = mockCheckRateLimit.mock.calls[0];
      expect(callArgs[0]).toBe('chat:research:some-identifier');
    });
  });

  // -----------------------------------------------------------------------
  // checkToolRateLimit
  // -----------------------------------------------------------------------

  describe('checkToolRateLimit', () => {
    it('returns allowed immediately when tool has no defined limit', async () => {
      const result = await checkToolRateLimit('user-789', 'some_unknown_tool');

      expect(result).toEqual({ allowed: true });

      // checkRateLimit should NOT be called for unlisted tools
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });

    it('returns allowed when the tool call is within the per-tool limit', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(allowed(90));

      const result = await checkToolRateLimit('user-789', 'run_code');

      expect(result).toEqual({ allowed: true });

      expect(mockCheckRateLimit).toHaveBeenCalledWith('chat:tool:user-789:run_code', {
        limit: 100,
        windowMs: 3_600_000,
      });
    });

    it('returns blocked with limit info when tool limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(blocked());

      const result = await checkToolRateLimit('user-789', 'generate_video');

      expect(result).toEqual({
        allowed: false,
        limit: 10,
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith('chat:tool:user-789:generate_video', {
        limit: 10,
        windowMs: 3_600_000,
      });
    });

    it('passes the correct per-tool limit for each listed tool', async () => {
      const expectedLimits: Record<string, number> = {
        run_code: 100,
        browser_visit: 50,
        generate_image: 30,
        generate_video: 10,
        extract_pdf: 60,
        analyze_image: 60,
      };

      for (const [toolName, expectedLimit] of Object.entries(expectedLimits)) {
        mockCheckRateLimit.mockResolvedValueOnce(allowed(expectedLimit - 1));
        await checkToolRateLimit('user-check', toolName);

        expect(mockCheckRateLimit).toHaveBeenCalledWith(`chat:tool:user-check:${toolName}`, {
          limit: expectedLimit,
          windowMs: 3_600_000,
        });
      }
    });

    it('does not include limit property in allowed response', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(allowed(45));

      const result = await checkToolRateLimit('user-789', 'browser_visit');

      expect(result.allowed).toBe(true);
      expect(result).not.toHaveProperty('limit');
    });

    it('includes the maxPerHour as limit property in blocked response', async () => {
      mockCheckRateLimit.mockResolvedValueOnce(blocked());

      const result = await checkToolRateLimit('user-789', 'generate_image');

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(30);
    });
  });

  // -----------------------------------------------------------------------
  // TOOL_RATE_LIMITS constant
  // -----------------------------------------------------------------------

  describe('TOOL_RATE_LIMITS', () => {
    it('has the expected tools defined', () => {
      const expectedTools = [
        'run_code',
        'browser_visit',
        'generate_image',
        'generate_video',
        'extract_pdf',
        'analyze_image',
      ];

      expect(Object.keys(TOOL_RATE_LIMITS).sort()).toEqual(expectedTools.sort());
    });

    it('has positive integer limits for every tool', () => {
      for (const [toolName, limit] of Object.entries(TOOL_RATE_LIMITS)) {
        expect(limit, `${toolName} limit should be a positive integer`).toBeGreaterThan(0);
        expect(Number.isInteger(limit), `${toolName} limit should be an integer`).toBe(true);
      }
    });

    it('has expected specific values', () => {
      expect(TOOL_RATE_LIMITS.run_code).toBe(100);
      expect(TOOL_RATE_LIMITS.browser_visit).toBe(50);
      expect(TOOL_RATE_LIMITS.generate_image).toBe(30);
      expect(TOOL_RATE_LIMITS.generate_video).toBe(10);
      expect(TOOL_RATE_LIMITS.extract_pdf).toBe(60);
      expect(TOOL_RATE_LIMITS.analyze_image).toBe(60);
    });
  });
});
