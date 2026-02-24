import { describe, it, expect, vi } from 'vitest';
import {
  ContextCompactionManager,
  DEFAULT_COMPACTION_SETTINGS,
  getContextCompactionTools,
  isContextCompactionTool,
  type CompactableMessage,
} from './context-compaction';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Anthropic
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockCreate(...args) };
  },
}));

// -------------------------------------------------------------------
// DEFAULT_COMPACTION_SETTINGS
// -------------------------------------------------------------------
describe('DEFAULT_COMPACTION_SETTINGS', () => {
  it('should have auto-compact enabled', () => {
    expect(DEFAULT_COMPACTION_SETTINGS.autoCompact).toBe(true);
  });

  it('should have 80% threshold', () => {
    expect(DEFAULT_COMPACTION_SETTINGS.threshold).toBe(80);
  });

  it('should preserve 10 recent messages', () => {
    expect(DEFAULT_COMPACTION_SETTINGS.preserveRecentCount).toBe(10);
  });
});

// -------------------------------------------------------------------
// ContextCompactionManager
// -------------------------------------------------------------------
describe('ContextCompactionManager', () => {
  describe('getSettings / setSettings', () => {
    it('should return defaults for new session', () => {
      const mgr = new ContextCompactionManager();
      const settings = mgr.getSettings('new-session');
      expect(settings.autoCompact).toBe(true);
      expect(settings.threshold).toBe(80);
    });

    it('should merge partial settings', () => {
      const mgr = new ContextCompactionManager();
      mgr.setSettings('s1', { threshold: 90 });
      const settings = mgr.getSettings('s1');
      expect(settings.threshold).toBe(90);
      expect(settings.autoCompact).toBe(true); // default preserved
    });
  });

  describe('shouldCompact', () => {
    it('should return true when above threshold', () => {
      const mgr = new ContextCompactionManager();
      expect(mgr.shouldCompact('s1', 85)).toBe(true);
    });

    it('should return false when below threshold', () => {
      const mgr = new ContextCompactionManager();
      expect(mgr.shouldCompact('s1', 50)).toBe(false);
    });

    it('should return false when auto-compact disabled', () => {
      const mgr = new ContextCompactionManager();
      mgr.setSettings('s1', { autoCompact: false });
      expect(mgr.shouldCompact('s1', 95)).toBe(false);
    });

    it('should return true at exact threshold', () => {
      const mgr = new ContextCompactionManager();
      expect(mgr.shouldCompact('s1', 80)).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for simple messages', () => {
      const mgr = new ContextCompactionManager();
      const messages: CompactableMessage[] = [{ role: 'user', content: 'Hello world' }];
      const tokens = mgr.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate more tokens for longer messages', () => {
      const mgr = new ContextCompactionManager();
      const short: CompactableMessage[] = [{ role: 'user', content: 'Hi' }];
      const long: CompactableMessage[] = [
        {
          role: 'user',
          content:
            'This is a much longer message with many more words and sentences that should result in more estimated tokens',
        },
      ];
      expect(mgr.estimateTokens(long)).toBeGreaterThan(mgr.estimateTokens(short));
    });

    it('should account for special characters', () => {
      const mgr = new ContextCompactionManager();
      const plain: CompactableMessage[] = [{ role: 'user', content: 'hello world' }];
      const special: CompactableMessage[] = [
        { role: 'user', content: 'hello {world} [test] (foo) @bar!' },
      ];
      expect(mgr.estimateTokens(special)).toBeGreaterThan(mgr.estimateTokens(plain));
    });

    it('should return 0 for empty array', () => {
      const mgr = new ContextCompactionManager();
      expect(mgr.estimateTokens([])).toBe(0);
    });
  });

  describe('compactMessages', () => {
    it('should skip when not enough messages', async () => {
      const mgr = new ContextCompactionManager();
      const messages: CompactableMessage[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          role: 'user' as const,
          content: `Message ${i}`,
        }));
      const result = await mgr.compactMessages('s1', messages);
      expect(result.success).toBe(false);
      expect(result.tokensSaved).toBe(0);
    });

    it('should compact when forced even with few messages', async () => {
      const mgr = new ContextCompactionManager();
      mgr.setSettings('s1', { preserveRecentCount: 2 });

      const messages: CompactableMessage[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          role: 'user' as const,
          content: `Message ${i}`,
        }));

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Summary of messages 0-2' }],
      });

      const result = await mgr.compactMessages('s1', messages, true);
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Summary');
    });

    it('should handle API error gracefully', async () => {
      const mgr = new ContextCompactionManager();
      mgr.setSettings('s1', { preserveRecentCount: 2 });

      const messages: CompactableMessage[] = Array(20)
        .fill(null)
        .map((_, i) => ({
          role: 'user' as const,
          content: `Message ${i}`,
        }));

      mockCreate.mockRejectedValueOnce(new Error('API error'));

      const result = await mgr.compactMessages('s1', messages);
      expect(result.success).toBe(false);
      expect(result.tokensSaved).toBe(0);
    });
  });

  describe('getHistory / clearSession', () => {
    it('should return empty history for new session', () => {
      const mgr = new ContextCompactionManager();
      expect(mgr.getHistory('new')).toEqual([]);
    });

    it('should clear session data', () => {
      const mgr = new ContextCompactionManager();
      mgr.setSettings('s1', { threshold: 90 });
      mgr.clearSession('s1');
      expect(mgr.getSettings('s1').threshold).toBe(80); // back to default
    });
  });
});

// -------------------------------------------------------------------
// isContextCompactionTool
// -------------------------------------------------------------------
describe('isContextCompactionTool', () => {
  it('should return true for compaction tools', () => {
    expect(isContextCompactionTool('context_compact')).toBe(true);
    expect(isContextCompactionTool('context_settings')).toBe(true);
  });

  it('should return false for other tools', () => {
    expect(isContextCompactionTool('other')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getContextCompactionTools
// -------------------------------------------------------------------
describe('getContextCompactionTools', () => {
  it('should return 2 tools', () => {
    expect(getContextCompactionTools()).toHaveLength(2);
    expect(getContextCompactionTools().map((t) => t.name)).toEqual([
      'context_compact',
      'context_settings',
    ]);
  });
});
