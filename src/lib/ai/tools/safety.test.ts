/**
 * SAFETY MODULE TESTS
 *
 * Tests for the pass-through safety/cost control functions.
 * These are currently no-op implementations but must maintain their API surface
 * because 8+ tool files import from this module.
 */

import { describe, it, expect } from 'vitest';
import {
  canExecuteTool,
  recordToolCost,
  getChatSessionCosts,
  CHAT_COST_LIMITS,
  isUrlSafe,
  isDomainTrusted,
  recordPageVisit,
  sanitizeOutput,
} from './safety';

describe('Safety Module', () => {
  describe('Cost Control', () => {
    it('should export CHAT_COST_LIMITS with expected shape', () => {
      expect(CHAT_COST_LIMITS).toBeDefined();
      expect(CHAT_COST_LIMITS.maxCostPerSession).toBe(Infinity);
      expect(CHAT_COST_LIMITS.maxCostPerTool).toBe(Infinity);
      expect(CHAT_COST_LIMITS.maxToolCallsPerSession).toBe(1000);
    });

    it('canExecuteTool should always allow execution', () => {
      const result = canExecuteTool('session-1', 'web_search', 0.01);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('canExecuteTool should allow even high-cost tools', () => {
      const result = canExecuteTool('session-1', 'expensive_tool', 999.99);
      expect(result.allowed).toBe(true);
    });

    it('recordToolCost should not throw', () => {
      expect(() => recordToolCost('session-1', 'web_search', 0.01)).not.toThrow();
    });

    it('getChatSessionCosts should return zero state', () => {
      const costs = getChatSessionCosts('session-1');
      expect(costs.totalCost).toBe(0);
      expect(costs.toolCalls).toBe(0);
    });
  });

  describe('URL Safety', () => {
    it('isUrlSafe should allow all URLs', () => {
      expect(isUrlSafe('https://example.com').safe).toBe(true);
      expect(isUrlSafe('http://localhost:3000').safe).toBe(true);
      expect(isUrlSafe('ftp://files.example.com').safe).toBe(true);
    });

    it('isDomainTrusted should trust all domains', () => {
      expect(isDomainTrusted('example.com')).toBe(true);
      expect(isDomainTrusted('evil.com')).toBe(true);
      expect(isDomainTrusted('localhost')).toBe(true);
    });
  });

  describe('Browser Safety', () => {
    it('recordPageVisit should not throw', () => {
      expect(() => recordPageVisit('session-1', 'https://example.com')).not.toThrow();
    });

    it('sanitizeOutput should pass through content unchanged', () => {
      const input = '<script>alert("xss")</script>Hello World';
      expect(sanitizeOutput(input)).toBe(input);
    });

    it('sanitizeOutput should handle empty string', () => {
      expect(sanitizeOutput('')).toBe('');
    });
  });
});
