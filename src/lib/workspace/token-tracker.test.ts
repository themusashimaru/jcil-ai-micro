import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TokenTracker,
  getTokenTracker,
  removeTokenTracker,
  executeTokenTrackingTool,
  isTokenTrackingTool,
  getTokenTrackingTools,
} from './token-tracker';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  // Clean up trackers between tests
  removeTokenTracker('test-session');
  removeTokenTracker('session-a');
  removeTokenTracker('session-b');
});

// -------------------------------------------------------------------
// TokenTracker class
// -------------------------------------------------------------------
describe('TokenTracker', () => {
  it('should initialize with session and model', () => {
    const tracker = new TokenTracker('s1', 'claude-sonnet-4-6');
    const session = tracker.exportSession();
    expect(session.sessionId).toBe('s1');
    expect(session.modelId).toBe('claude-sonnet-4-6');
  });

  it('should default to claude-sonnet-4-6', () => {
    const tracker = new TokenTracker('s1');
    expect(tracker.exportSession().modelId).toBe('claude-sonnet-4-6');
  });

  it('should set model', () => {
    const tracker = new TokenTracker('s1');
    tracker.setModel('claude-opus-4-6');
    expect(tracker.exportSession().modelId).toBe('claude-opus-4-6');
  });

  it('should record usage and track history', () => {
    const tracker = new TokenTracker('s1');
    tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
    expect(tracker.getHistory()).toHaveLength(1);
    expect(tracker.getHistory()[0].inputTokens).toBe(100);
    expect(tracker.getHistory()[0].outputTokens).toBe(50);
  });

  it('should get last usage', () => {
    const tracker = new TokenTracker('s1');
    tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
    tracker.recordUsage({ inputTokens: 200, outputTokens: 75 });
    const last = tracker.getLastUsage();
    expect(last?.inputTokens).toBe(200);
    expect(last?.outputTokens).toBe(75);
  });

  it('should return undefined for last usage when empty', () => {
    const tracker = new TokenTracker('s1');
    expect(tracker.getLastUsage()).toBeUndefined();
  });

  it('should add timestamp to recorded usage', () => {
    const tracker = new TokenTracker('s1');
    const before = Date.now();
    tracker.recordUsage({ inputTokens: 10, outputTokens: 5 });
    const after = Date.now();
    const usage = tracker.getLastUsage()!;
    expect(usage.timestamp).toBeGreaterThanOrEqual(before);
    expect(usage.timestamp).toBeLessThanOrEqual(after);
  });

  it('should clear history', () => {
    const tracker = new TokenTracker('s1');
    tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
    tracker.clearHistory();
    expect(tracker.getHistory()).toHaveLength(0);
  });

  it('should return a copy of history', () => {
    const tracker = new TokenTracker('s1');
    tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
    const h1 = tracker.getHistory();
    const h2 = tracker.getHistory();
    expect(h1).not.toBe(h2); // different arrays
    expect(h1).toEqual(h2);
  });
});

// -------------------------------------------------------------------
// calculateCost
// -------------------------------------------------------------------
describe('TokenTracker.calculateCost', () => {
  it('should calculate cost for claude-sonnet-4-6', () => {
    const tracker = new TokenTracker('s1', 'claude-sonnet-4-6');
    const cost = tracker.calculateCost({
      inputTokens: 1000,
      outputTokens: 1000,
      timestamp: Date.now(),
    });
    // input: 1000/1000 * 0.3 = 0.3, output: 1000/1000 * 1.5 = 1.5
    expect(cost.inputCost).toBe(0.3);
    expect(cost.outputCost).toBe(1.5);
    expect(cost.totalCost).toBe(1.8);
    expect(cost.currency).toBe('USD');
  });

  it('should calculate cache costs', () => {
    const tracker = new TokenTracker('s1', 'claude-sonnet-4-6');
    const cost = tracker.calculateCost({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1000,
      cacheWriteTokens: 1000,
      timestamp: Date.now(),
    });
    // cacheRead: 1000/1000 * 0.03 = 0.03, cacheWrite: 1000/1000 * 0.375 = 0.375
    expect(cost.cacheCost).toBe(0.405);
  });

  it('should calculate cost for opus model', () => {
    const tracker = new TokenTracker('s1', 'claude-opus-4-6');
    const cost = tracker.calculateCost({
      inputTokens: 1000,
      outputTokens: 1000,
      timestamp: Date.now(),
    });
    expect(cost.inputCost).toBe(1.5);
    expect(cost.outputCost).toBe(7.5);
    expect(cost.totalCost).toBe(9);
  });

  it('should fall back to sonnet pricing for unknown model', () => {
    const tracker = new TokenTracker('s1', 'unknown-model');
    const cost = tracker.calculateCost({
      inputTokens: 1000,
      outputTokens: 1000,
      timestamp: Date.now(),
    });
    expect(cost.inputCost).toBe(0.3);
    expect(cost.outputCost).toBe(1.5);
  });

  it('should override model in calculation', () => {
    const tracker = new TokenTracker('s1', 'claude-sonnet-4-6');
    const cost = tracker.calculateCost(
      { inputTokens: 1000, outputTokens: 1000, timestamp: Date.now() },
      'claude-opus-4-6'
    );
    expect(cost.inputCost).toBe(1.5);
  });
});

// -------------------------------------------------------------------
// Session stats
// -------------------------------------------------------------------
describe('TokenTracker.getSessionStats', () => {
  it('should aggregate usage across messages', () => {
    const tracker = new TokenTracker('s1');
    tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
    tracker.recordUsage({ inputTokens: 200, outputTokens: 100 });
    const stats = tracker.getSessionStats();
    expect(stats.totalInputTokens).toBe(300);
    expect(stats.totalOutputTokens).toBe(150);
    expect(stats.messageCount).toBe(2);
  });

  it('should aggregate cache tokens', () => {
    const tracker = new TokenTracker('s1');
    tracker.recordUsage({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 100,
      cacheWriteTokens: 50,
    });
    tracker.recordUsage({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 200,
      cacheWriteTokens: 75,
    });
    const stats = tracker.getSessionStats();
    expect(stats.totalCacheReadTokens).toBe(300);
    expect(stats.totalCacheWriteTokens).toBe(125);
  });

  it('should calculate context usage percent', () => {
    const tracker = new TokenTracker('s1', 'claude-sonnet-4-6');
    // Context window is 200,000
    tracker.recordUsage({ inputTokens: 100000, outputTokens: 50000 });
    const stats = tracker.getSessionStats();
    // (150000/200000) * 100 = 75%
    expect(stats.contextUsagePercent).toBe(75);
  });

  it('should cap context usage at 100%', () => {
    const tracker = new TokenTracker('s1', 'claude-sonnet-4-6');
    tracker.recordUsage({ inputTokens: 150000, outputTokens: 100000 });
    const stats = tracker.getSessionStats();
    expect(stats.contextUsagePercent).toBe(100);
  });
});

// -------------------------------------------------------------------
// getContextInfo
// -------------------------------------------------------------------
describe('TokenTracker.getContextInfo', () => {
  it('should return context window info', () => {
    const tracker = new TokenTracker('s1', 'claude-sonnet-4-6');
    tracker.recordUsage({ inputTokens: 1000, outputTokens: 500 });
    const info = tracker.getContextInfo();
    expect(info.used).toBe(1500);
    expect(info.total).toBe(200000);
    expect(info.remaining).toBe(198500);
    expect(info.percentUsed).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// Static formatters
// -------------------------------------------------------------------
describe('TokenTracker.formatCost', () => {
  it('should format small costs in cents', () => {
    expect(TokenTracker.formatCost(0.005)).toBe('$0.50¢');
  });

  it('should format larger costs in dollars', () => {
    expect(TokenTracker.formatCost(1.5)).toBe('$1.5000');
  });

  it('should format zero cost', () => {
    expect(TokenTracker.formatCost(0)).toBe('$0.00¢');
  });
});

describe('TokenTracker.formatTokens', () => {
  it('should format millions', () => {
    expect(TokenTracker.formatTokens(1500000)).toBe('1.5M');
  });

  it('should format thousands', () => {
    expect(TokenTracker.formatTokens(5500)).toBe('5.5K');
  });

  it('should format small numbers as-is', () => {
    expect(TokenTracker.formatTokens(500)).toBe('500');
  });

  it('should format zero', () => {
    expect(TokenTracker.formatTokens(0)).toBe('0');
  });
});

// -------------------------------------------------------------------
// getTokenTracker / removeTokenTracker
// -------------------------------------------------------------------
describe('getTokenTracker', () => {
  it('should create a new tracker for unknown session', () => {
    const tracker = getTokenTracker('session-a');
    expect(tracker).toBeInstanceOf(TokenTracker);
  });

  it('should return same tracker for same session', () => {
    const t1 = getTokenTracker('session-a');
    const t2 = getTokenTracker('session-a');
    expect(t1).toBe(t2);
  });

  it('should update model when provided', () => {
    getTokenTracker('session-a', 'claude-sonnet-4-6');
    const tracker = getTokenTracker('session-a', 'claude-opus-4-6');
    expect(tracker.exportSession().modelId).toBe('claude-opus-4-6');
  });
});

describe('removeTokenTracker', () => {
  it('should remove tracker so next call creates new one', () => {
    const t1 = getTokenTracker('session-b');
    t1.recordUsage({ inputTokens: 100, outputTokens: 50 });
    removeTokenTracker('session-b');
    const t2 = getTokenTracker('session-b');
    expect(t2.getHistory()).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// executeTokenTrackingTool
// -------------------------------------------------------------------
describe('executeTokenTrackingTool', () => {
  it('should return usage info for tokens_usage', () => {
    const tracker = getTokenTracker('test-session');
    tracker.recordUsage({ inputTokens: 1000, outputTokens: 500 });
    const result = executeTokenTrackingTool('tokens_usage', {}, 'test-session');
    expect(result).toContain('Session Token Usage');
    expect(result).toContain('1.0K'); // 1000 input tokens
    expect(result).toContain('Estimated Cost');
  });

  it('should return context info for tokens_context', () => {
    const result = executeTokenTrackingTool('tokens_context', {}, 'test-session');
    expect(result).toContain('Context Window');
    expect(result).toContain('Remaining');
  });

  it('should return error for unknown tool', () => {
    const result = executeTokenTrackingTool('tokens_unknown', {}, 'test-session');
    expect(result).toContain('Unknown');
  });
});

// -------------------------------------------------------------------
// isTokenTrackingTool
// -------------------------------------------------------------------
describe('isTokenTrackingTool', () => {
  it('should return true for tracking tools', () => {
    expect(isTokenTrackingTool('tokens_usage')).toBe(true);
    expect(isTokenTrackingTool('tokens_context')).toBe(true);
  });

  it('should return false for non-tracking tools', () => {
    expect(isTokenTrackingTool('other_tool')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getTokenTrackingTools
// -------------------------------------------------------------------
describe('getTokenTrackingTools', () => {
  it('should return tool definitions', () => {
    const tools = getTokenTrackingTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('tokens_usage');
    expect(tools[1].name).toBe('tokens_context');
  });
});
