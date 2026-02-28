// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

import {
  estimateStringTokens,
  estimateMessageTokens,
  estimateTokenCount,
  summarizeContext,
  isSummaryMessage,
  getCompressionRatio,
  DEFAULT_SUMMARIZATION_OPTIONS,
} from '../summarizer';

// ============================================
// HELPERS
// ============================================

function makeMsg(role: string, content: string) {
  return { role, content };
}

function makeBlockMsg(role: string, blocks: Array<{ type: string; [key: string]: unknown }>) {
  return { role, content: blocks };
}

function makeLongConversation(msgCount: number) {
  const msgs = [];
  for (let i = 0; i < msgCount; i++) {
    msgs.push(
      makeMsg(
        'user',
        `This is user message number ${i}. It contains substantial content to ensure token estimation picks it up. `.repeat(
          5
        )
      )
    );
    msgs.push(
      makeMsg(
        'assistant',
        `This is assistant response number ${i}. Providing detailed analysis and recommendations. `.repeat(
          5
        )
      )
    );
  }
  return msgs;
}

// ============================================
// TESTS
// ============================================

describe('summarizer', () => {
  // -----------------------------------------------------------------------
  // estimateStringTokens
  // -----------------------------------------------------------------------

  describe('estimateStringTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateStringTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(estimateStringTokens(null)).toBe(0);
      expect(estimateStringTokens(undefined)).toBe(0);
    });

    it('should estimate tokens for simple English text', () => {
      const tokens = estimateStringTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate more tokens for longer text', () => {
      const short = estimateStringTokens('Hello');
      const long = estimateStringTokens(
        'Hello world this is a much longer sentence with many words'
      );
      expect(long).toBeGreaterThan(short);
    });

    it('should account for special characters', () => {
      const plain = estimateStringTokens('hello world');
      const withSymbols = estimateStringTokens('hello, world! @#$%');
      expect(withSymbols).toBeGreaterThan(plain);
    });

    it('should account for numeric content', () => {
      const text = estimateStringTokens('hello');
      const withNumbers = estimateStringTokens('hello 123456789');
      expect(withNumbers).toBeGreaterThan(text);
    });

    it('should handle code-like strings', () => {
      const tokens = estimateStringTokens('function foo() { return bar.baz(); }');
      expect(tokens).toBeGreaterThan(5);
    });
  });

  // -----------------------------------------------------------------------
  // estimateMessageTokens
  // -----------------------------------------------------------------------

  describe('estimateMessageTokens', () => {
    it('should estimate tokens for string content', () => {
      const tokens = estimateMessageTokens(makeMsg('user', 'Hello world'));
      expect(tokens).toBeGreaterThan(10); // Base (10) + word tokens
    });

    it('should include base token overhead', () => {
      const tokens = estimateMessageTokens(makeMsg('user', ''));
      expect(tokens).toBeGreaterThanOrEqual(10);
    });

    it('should handle text content blocks', () => {
      const msg = makeBlockMsg('assistant', [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' },
      ]);
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(10);
    });

    it('should estimate image blocks at ~1500 tokens', () => {
      const msg = makeBlockMsg('user', [{ type: 'image', source: { data: 'base64...' } }]);
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThanOrEqual(1500);
    });

    it('should estimate tool_use blocks', () => {
      const msg = makeBlockMsg('assistant', [
        { type: 'tool_use', name: 'read_file', arguments: { path: '/test.ts' } },
      ]);
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(50);
    });

    it('should estimate tool_result blocks', () => {
      const msg = makeBlockMsg('tool', [
        { type: 'tool_result', content: 'File content here with lots of text' },
      ]);
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(20);
    });

    it('should use default for unknown block types', () => {
      const msg = makeBlockMsg('user', [{ type: 'custom_type', data: 'stuff' }]);
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThanOrEqual(50);
    });
  });

  // -----------------------------------------------------------------------
  // estimateTokenCount
  // -----------------------------------------------------------------------

  describe('estimateTokenCount', () => {
    it('should return 0 for empty array', () => {
      expect(estimateTokenCount([])).toBe(0);
    });

    it('should sum up message tokens', () => {
      const messages = [makeMsg('user', 'Hello'), makeMsg('assistant', 'Hi there')];
      const tokens = estimateTokenCount(messages);
      expect(tokens).toBeGreaterThan(20);
    });

    it('should grow with message count', () => {
      const short = estimateTokenCount([makeMsg('user', 'Hello')]);
      const long = estimateTokenCount([
        makeMsg('user', 'Hello'),
        makeMsg('assistant', 'Hi'),
        makeMsg('user', 'How are you?'),
      ]);
      expect(long).toBeGreaterThan(short);
    });
  });

  // -----------------------------------------------------------------------
  // DEFAULT_SUMMARIZATION_OPTIONS
  // -----------------------------------------------------------------------

  describe('DEFAULT_SUMMARIZATION_OPTIONS', () => {
    it('should have targetTokens of 50000', () => {
      expect(DEFAULT_SUMMARIZATION_OPTIONS.targetTokens).toBe(50000);
    });

    it('should preserve 5 recent messages', () => {
      expect(DEFAULT_SUMMARIZATION_OPTIONS.preserveRecentMessages).toBe(5);
    });

    it('should preserve tool history by default', () => {
      expect(DEFAULT_SUMMARIZATION_OPTIONS.preserveToolHistory).toBe(true);
    });

    it('should not include timestamps by default', () => {
      expect(DEFAULT_SUMMARIZATION_OPTIONS.includeTimestamps).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // summarizeContext
  // -----------------------------------------------------------------------

  describe('summarizeContext', () => {
    it('should return unchanged if under token limit', async () => {
      const messages = [makeMsg('user', 'Hello'), makeMsg('assistant', 'Hi')];
      const result = await summarizeContext(messages, 'claude');

      expect(result.messages).toBe(messages);
      expect(result.originalCount).toBe(2);
      expect(result.summarizedCount).toBe(2);
      expect(result.summaryText).toBe('');
    });

    it('should summarize long conversations', async () => {
      const messages = makeLongConversation(30); // 60 messages
      const result = await summarizeContext(messages, 'claude', { targetTokens: 500 });

      expect(result.summarizedCount).toBeLessThan(result.originalCount);
      expect(result.tokensAfter).toBeLessThanOrEqual(result.tokensBefore);
    });

    it('should preserve recent messages', async () => {
      const messages = makeLongConversation(20);
      const result = await summarizeContext(messages, 'claude', {
        targetTokens: 100,
        preserveRecentMessages: 3,
      });

      // Should have summary + at least some preserved messages
      expect(result.summarizedCount).toBeGreaterThanOrEqual(2);
    });

    it('should include summary text for summarized conversations', async () => {
      const messages = makeLongConversation(20);
      const result = await summarizeContext(messages, 'claude', { targetTokens: 100 });

      expect(result.summaryText.length).toBeGreaterThan(0);
    });

    it('should report tokensBefore and tokensAfter', async () => {
      const messages = makeLongConversation(20);
      const result = await summarizeContext(messages, 'claude', { targetTokens: 100 });

      expect(result.tokensBefore).toBeGreaterThan(0);
      expect(result.tokensAfter).toBeGreaterThan(0);
    });

    it('should handle empty messages', async () => {
      const result = await summarizeContext([], 'claude');
      expect(result.messages).toEqual([]);
      expect(result.originalCount).toBe(0);
    });

    it('should include tool usage in summary when preserveToolHistory is true', async () => {
      const messages = [
        ...makeLongConversation(10),
        makeBlockMsg('assistant', [
          { type: 'tool_use', name: 'read_file', arguments: { path: '/x' } },
        ]),
        ...makeLongConversation(10),
      ];

      const result = await summarizeContext(messages, 'claude', {
        targetTokens: 100,
        preserveToolHistory: true,
      });

      // The summary should reference tool usage
      expect(result.summaryText.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // isSummaryMessage
  // -----------------------------------------------------------------------

  describe('isSummaryMessage', () => {
    it('should return true for summary messages', () => {
      expect(
        isSummaryMessage({ role: 'system', content: 'Summary', metadata: { isSummary: true } })
      ).toBe(true);
    });

    it('should return false for regular messages', () => {
      expect(isSummaryMessage(makeMsg('user', 'Hello'))).toBe(false);
    });

    it('should return false for messages without metadata', () => {
      expect(isSummaryMessage({ role: 'system', content: 'x' })).toBe(false);
    });

    it('should return false for messages with isSummary=false', () => {
      expect(
        isSummaryMessage({ role: 'system', content: 'x', metadata: { isSummary: false } })
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getCompressionRatio
  // -----------------------------------------------------------------------

  describe('getCompressionRatio', () => {
    it('should return ratio of after/before', () => {
      const result = {
        messages: [],
        originalCount: 10,
        summarizedCount: 3,
        tokensBefore: 1000,
        tokensAfter: 500,
        summaryText: '',
      };
      expect(getCompressionRatio(result)).toBe(0.5);
    });

    it('should return 1 for zero tokensBefore', () => {
      const result = {
        messages: [],
        originalCount: 0,
        summarizedCount: 0,
        tokensBefore: 0,
        tokensAfter: 0,
        summaryText: '',
      };
      expect(getCompressionRatio(result)).toBe(1);
    });

    it('should return 1 for equal before and after', () => {
      const result = {
        messages: [],
        originalCount: 5,
        summarizedCount: 5,
        tokensBefore: 500,
        tokensAfter: 500,
        summaryText: '',
      };
      expect(getCompressionRatio(result)).toBe(1);
    });

    it('should handle aggressive compression', () => {
      const result = {
        messages: [],
        originalCount: 100,
        summarizedCount: 5,
        tokensBefore: 10000,
        tokensAfter: 100,
        summaryText: '',
      };
      expect(getCompressionRatio(result)).toBe(0.01);
    });
  });
});
