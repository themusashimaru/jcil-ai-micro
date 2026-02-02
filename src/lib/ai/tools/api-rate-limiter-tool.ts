/**
 * API RATE LIMITER TOOL
 * Rate limiting algorithms and API quota management
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface RateLimitConfig { algorithm: 'token_bucket' | 'sliding_window' | 'fixed_window' | 'leaky_bucket'; limit: number; window: number; }
void (0 as unknown as RateLimitConfig); // For config-based initialization
interface RateLimitState { allowed: number; remaining: number; resetTime: number; retryAfter?: number; }
interface TokenBucket { tokens: number; capacity: number; refillRate: number; lastRefill: number; }
interface SlidingWindow { requests: number[]; windowMs: number; limit: number; }

function createTokenBucket(capacity: number, refillRate: number): TokenBucket {
  return { tokens: capacity, capacity, refillRate, lastRefill: Date.now() };
}

function refillTokens(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsed * bucket.refillRate;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

function consumeToken(bucket: TokenBucket, tokens: number = 1): { allowed: boolean; remaining: number; retryAfter?: number } {
  refillTokens(bucket);

  if (bucket.tokens >= tokens) {
    bucket.tokens -= tokens;
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }

  const deficit = tokens - bucket.tokens;
  const retryAfter = Math.ceil(deficit / bucket.refillRate);
  return { allowed: false, remaining: 0, retryAfter };
}

function createSlidingWindow(windowMs: number, limit: number): SlidingWindow {
  return { requests: [], windowMs, limit };
}

function checkSlidingWindow(window: SlidingWindow): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  window.requests = window.requests.filter(t => t > now - window.windowMs);

  const remaining = window.limit - window.requests.length;
  const resetTime = window.requests.length > 0 ? window.requests[0] + window.windowMs : now + window.windowMs;

  if (window.requests.length < window.limit) {
    window.requests.push(now);
    return { allowed: true, remaining: remaining - 1, resetTime };
  }

  return { allowed: false, remaining: 0, resetTime };
}

interface FixedWindow { count: number; windowStart: number; windowMs: number; limit: number; }

function createFixedWindow(windowMs: number, limit: number): FixedWindow {
  return { count: 0, windowStart: Date.now(), windowMs, limit };
}

function checkFixedWindow(window: FixedWindow): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  if (now - window.windowStart >= window.windowMs) {
    window.windowStart = now;
    window.count = 0;
  }

  const resetTime = window.windowStart + window.windowMs;
  const remaining = window.limit - window.count;

  if (window.count < window.limit) {
    window.count++;
    return { allowed: true, remaining: remaining - 1, resetTime };
  }

  return { allowed: false, remaining: 0, resetTime };
}

interface LeakyBucket { queue: number; capacity: number; leakRate: number; lastLeak: number; }

function createLeakyBucket(capacity: number, leakRate: number): LeakyBucket {
  return { queue: 0, capacity, leakRate, lastLeak: Date.now() };
}

function checkLeakyBucket(bucket: LeakyBucket): { allowed: boolean; queueSize: number; capacity: number } {
  const now = Date.now();
  const elapsed = (now - bucket.lastLeak) / 1000;
  const leaked = elapsed * bucket.leakRate;
  bucket.queue = Math.max(0, bucket.queue - leaked);
  bucket.lastLeak = now;

  if (bucket.queue < bucket.capacity) {
    bucket.queue++;
    return { allowed: true, queueSize: Math.floor(bucket.queue), capacity: bucket.capacity };
  }

  return { allowed: false, queueSize: bucket.capacity, capacity: bucket.capacity };
}

function simulateTraffic(algorithm: string, limit: number, requests: number, burstSize: number = 1): Array<{ request: number; allowed: boolean; remaining: number }> {
  const results: Array<{ request: number; allowed: boolean; remaining: number }> = [];

  switch (algorithm) {
    case 'token_bucket':
      const tokenBucket = createTokenBucket(limit, limit / 60); // Refill over 60 seconds
      for (let i = 0; i < requests; i++) {
        const result = consumeToken(tokenBucket, burstSize);
        results.push({ request: i + 1, allowed: result.allowed, remaining: result.remaining });
      }
      break;
    case 'sliding_window':
      const slidingWindow = createSlidingWindow(60000, limit);
      for (let i = 0; i < requests; i++) {
        const result = checkSlidingWindow(slidingWindow);
        results.push({ request: i + 1, allowed: result.allowed, remaining: result.remaining });
      }
      break;
    case 'fixed_window':
      const fixedWindow = createFixedWindow(60000, limit);
      for (let i = 0; i < requests; i++) {
        const result = checkFixedWindow(fixedWindow);
        results.push({ request: i + 1, allowed: result.allowed, remaining: result.remaining });
      }
      break;
    case 'leaky_bucket':
      const leakyBucket = createLeakyBucket(limit, limit / 60);
      for (let i = 0; i < requests; i++) {
        const result = checkLeakyBucket(leakyBucket);
        results.push({ request: i + 1, allowed: result.allowed, remaining: result.capacity - result.queueSize });
      }
      break;
  }

  return results;
}

function generateRateLimitHeaders(state: RateLimitState): Record<string, string> {
  return {
    'X-RateLimit-Limit': state.allowed.toString(),
    'X-RateLimit-Remaining': state.remaining.toString(),
    'X-RateLimit-Reset': new Date(state.resetTime).toISOString(),
    ...(state.retryAfter ? { 'Retry-After': state.retryAfter.toString() } : {})
  };
}

function rateLimitToAscii(results: Array<{ request: number; allowed: boolean }>): string {
  const width = Math.min(50, results.length);
  const line = results.slice(0, width).map(r => r.allowed ? '✓' : '✗').join('');

  const allowed = results.filter(r => r.allowed).length;
  const blocked = results.filter(r => !r.allowed).length;

  return `Traffic: ${line}\n` +
         `Allowed: ${allowed} | Blocked: ${blocked} | Total: ${results.length}\n` +
         `Success Rate: ${(allowed / results.length * 100).toFixed(1)}%`;
}

export const apiRateLimiterTool: UnifiedTool = {
  name: 'api_rate_limiter',
  description: 'Rate Limiter: token_bucket, sliding_window, fixed_window, leaky_bucket, simulate, headers',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['token_bucket', 'sliding_window', 'fixed_window', 'leaky_bucket', 'simulate', 'compare', 'headers', 'info'] },
      limit: { type: 'number' },
      requests: { type: 'number' },
      burstSize: { type: 'number' },
      windowMs: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeApiRateLimiter(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    const limit = args.limit || 100;

    switch (args.operation) {
      case 'token_bucket':
        const tokenBucket = createTokenBucket(limit, limit / 60);
        const tokenResults: Array<{ request: number; allowed: boolean; remaining: number }> = [];
        for (let i = 0; i < (args.requests || 20); i++) {
          const r = consumeToken(tokenBucket, args.burstSize || 1);
          tokenResults.push({ request: i + 1, ...r });
        }
        result = {
          algorithm: 'Token Bucket',
          config: { capacity: limit, refillRate: `${(limit / 60).toFixed(2)}/sec` },
          results: tokenResults.slice(-10),
          visualization: rateLimitToAscii(tokenResults)
        };
        break;
      case 'sliding_window':
        const slidingWindow = createSlidingWindow(args.windowMs || 60000, limit);
        const slidingResults: Array<{ request: number; allowed: boolean; remaining: number }> = [];
        for (let i = 0; i < (args.requests || 20); i++) {
          const r = checkSlidingWindow(slidingWindow);
          slidingResults.push({ request: i + 1, allowed: r.allowed, remaining: r.remaining });
        }
        result = {
          algorithm: 'Sliding Window',
          config: { limit, windowMs: args.windowMs || 60000 },
          results: slidingResults.slice(-10),
          visualization: rateLimitToAscii(slidingResults)
        };
        break;
      case 'fixed_window':
        const fixedWindow = createFixedWindow(args.windowMs || 60000, limit);
        const fixedResults: Array<{ request: number; allowed: boolean; remaining: number }> = [];
        for (let i = 0; i < (args.requests || 20); i++) {
          const r = checkFixedWindow(fixedWindow);
          fixedResults.push({ request: i + 1, allowed: r.allowed, remaining: r.remaining });
        }
        result = {
          algorithm: 'Fixed Window',
          config: { limit, windowMs: args.windowMs || 60000 },
          results: fixedResults.slice(-10),
          visualization: rateLimitToAscii(fixedResults)
        };
        break;
      case 'leaky_bucket':
        const leakyBucket = createLeakyBucket(limit, limit / 60);
        const leakyResults: Array<{ request: number; allowed: boolean; remaining: number }> = [];
        for (let i = 0; i < (args.requests || 20); i++) {
          const r = checkLeakyBucket(leakyBucket);
          leakyResults.push({ request: i + 1, allowed: r.allowed, remaining: r.capacity - r.queueSize });
        }
        result = {
          algorithm: 'Leaky Bucket',
          config: { capacity: limit, leakRate: `${(limit / 60).toFixed(2)}/sec` },
          results: leakyResults.slice(-10),
          visualization: rateLimitToAscii(leakyResults)
        };
        break;
      case 'simulate':
        const simResults = simulateTraffic(args.algorithm || 'token_bucket', limit, args.requests || 50, args.burstSize || 1);
        result = {
          algorithm: args.algorithm || 'token_bucket',
          totalRequests: args.requests || 50,
          allowed: simResults.filter(r => r.allowed).length,
          blocked: simResults.filter(r => !r.allowed).length,
          visualization: rateLimitToAscii(simResults)
        };
        break;
      case 'compare':
        const algorithms = ['token_bucket', 'sliding_window', 'fixed_window', 'leaky_bucket'];
        const comparison: Record<string, { allowed: number; blocked: number }> = {};
        for (const algo of algorithms) {
          const sim = simulateTraffic(algo, limit, args.requests || 150);
          comparison[algo] = {
            allowed: sim.filter(r => r.allowed).length,
            blocked: sim.filter(r => !r.allowed).length
          };
        }
        result = { limit, requests: args.requests || 150, comparison };
        break;
      case 'headers':
        const state: RateLimitState = {
          allowed: limit,
          remaining: Math.floor(limit * 0.7),
          resetTime: Date.now() + 60000
        };
        result = {
          headers: generateRateLimitHeaders(state),
          explanation: {
            'X-RateLimit-Limit': 'Maximum requests allowed',
            'X-RateLimit-Remaining': 'Requests remaining in current window',
            'X-RateLimit-Reset': 'When the limit resets',
            'Retry-After': 'Seconds to wait before retrying (only when limited)'
          }
        };
        break;
      case 'info':
        result = {
          description: 'API rate limiting algorithms',
          algorithms: {
            token_bucket: 'Allows bursts up to bucket capacity, refills at constant rate',
            sliding_window: 'Tracks requests in rolling time window, smoothest limiting',
            fixed_window: 'Simple counter that resets at fixed intervals, can allow 2x at window boundary',
            leaky_bucket: 'Processes requests at constant rate, queues excess requests'
          },
          useCases: {
            token_bucket: 'APIs that can handle occasional bursts',
            sliding_window: 'Strict rate limiting with smooth distribution',
            fixed_window: 'Simple implementation, acceptable variance',
            leaky_bucket: 'Traffic shaping, smooth output rate'
          }
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isApiRateLimiterAvailable(): boolean { return true; }
