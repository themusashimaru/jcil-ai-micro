import { describe, it, expect, vi } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  getCurrentDateFormatted,
  getCurrentDateISO,
  estimateTokens,
  buildBaseSystemPrompt,
  buildFullSystemPrompt,
} from '../system-prompt';

describe('system-prompt', () => {
  describe('getCurrentDateFormatted', () => {
    it('should return a formatted date string', () => {
      const result = getCurrentDateFormatted();
      // Should match pattern like "February 24, 2026"
      expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    });

    it('should include month name, day, and year', () => {
      const result = getCurrentDateFormatted();
      const parts = result.split(/[, ]+/);
      expect(parts.length).toBe(3);
      // Month name
      expect(parts[0].length).toBeGreaterThan(2);
      // Day number
      expect(parseInt(parts[1])).toBeGreaterThanOrEqual(1);
      expect(parseInt(parts[1])).toBeLessThanOrEqual(31);
      // Year
      expect(parseInt(parts[2])).toBeGreaterThanOrEqual(2024);
    });
  });

  describe('getCurrentDateISO', () => {
    it('should return ISO date format (YYYY-MM-DD)', () => {
      const result = getCurrentDateISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should match today's date", () => {
      const result = getCurrentDateISO();
      const today = new Date().toISOString().split('T')[0];
      expect(result).toBe(today);
    });
  });

  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for undefined-like input', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens for simple text', () => {
      const result = estimateTokens('Hello world');
      // 2 words * 1.3 = 2.6, ceil = 3
      expect(result).toBe(3);
    });

    it('should account for punctuation', () => {
      const withPunctuation = estimateTokens('Hello, world! How are you?');
      const withoutPunctuation = estimateTokens('Hello world How are you');
      expect(withPunctuation).toBeGreaterThan(withoutPunctuation);
    });

    it('should handle code with many special characters', () => {
      const code = 'function foo() { return { bar: [1, 2, 3] }; }';
      const result = estimateTokens(code);
      // Should be higher than plain text due to special chars
      expect(result).toBeGreaterThan(10);
    });

    it('should handle long text', () => {
      const longText = 'word '.repeat(1000);
      const result = estimateTokens(longText);
      // ~1000 words * 1.3 = ~1300
      expect(result).toBeGreaterThan(1200);
      expect(result).toBeLessThan(1400);
    });

    it('should handle single word', () => {
      const result = estimateTokens('Hello');
      expect(result).toBe(2); // ceil(1 * 1.3) = 2
    });
  });

  describe('buildBaseSystemPrompt', () => {
    it('should include the AI identity', () => {
      const prompt = buildBaseSystemPrompt();
      expect(prompt).toContain('JCIL AI');
    });

    it("should include today's date", () => {
      const prompt = buildBaseSystemPrompt();
      const todayFormatted = getCurrentDateFormatted();
      expect(prompt).toContain(todayFormatted);
    });

    it('should include capabilities section', () => {
      const prompt = buildBaseSystemPrompt();
      expect(prompt).toContain('CAPABILITIES');
    });

    it('should include tool descriptions', () => {
      const prompt = buildBaseSystemPrompt();
      expect(prompt).toContain('web_search');
      expect(prompt).toContain('fetch_url');
      expect(prompt).toContain('run_code');
    });

    it('should include document generation instructions', () => {
      const prompt = buildBaseSystemPrompt();
      expect(prompt).toContain('DOCUMENT GENERATION');
    });

    it('should return a non-empty string', () => {
      const prompt = buildBaseSystemPrompt();
      expect(prompt.length).toBeGreaterThan(500);
    });
  });

  describe('buildFullSystemPrompt', () => {
    it('should include base prompt when no contexts provided', () => {
      const result = buildFullSystemPrompt({});
      expect(result).toContain('JCIL AI');
      expect(result).toContain('CAPABILITIES');
    });

    it('should append custom instructions', () => {
      const result = buildFullSystemPrompt({
        customInstructions: 'Always respond in Spanish.',
      });
      expect(result).toContain("USER'S CUSTOM INSTRUCTIONS");
      expect(result).toContain('Always respond in Spanish.');
    });

    it('should append memory context', () => {
      const result = buildFullSystemPrompt({
        memoryContext: 'User prefers dark mode.',
      });
      expect(result).toContain('User prefers dark mode.');
    });

    it('should append learning context', () => {
      const result = buildFullSystemPrompt({
        learningContext: 'User is a Python developer.',
      });
      expect(result).toContain('User is a Python developer.');
    });

    it('should append document context', () => {
      const result = buildFullSystemPrompt({
        documentContext: 'Reference document: API spec v2.',
      });
      expect(result).toContain('Reference document: API spec v2.');
    });

    it('should append composio addition', () => {
      const result = buildFullSystemPrompt({
        composioAddition: '\n\nConnected apps: Slack, Gmail',
      });
      expect(result).toContain('Connected apps: Slack, Gmail');
    });

    it('should respect priority order: custom > memory > learning > documents', () => {
      const result = buildFullSystemPrompt({
        customInstructions: 'XXYY_CUSTOM_MARKER',
        memoryContext: 'XXYY_MEMORY_MARKER',
        learningContext: 'XXYY_LEARNING_MARKER',
        documentContext: 'XXYY_DOCUMENT_MARKER',
      });

      const customIdx = result.indexOf('XXYY_CUSTOM_MARKER');
      const memoryIdx = result.indexOf('XXYY_MEMORY_MARKER');
      const learningIdx = result.indexOf('XXYY_LEARNING_MARKER');
      const documentIdx = result.indexOf('XXYY_DOCUMENT_MARKER');

      expect(customIdx).toBeGreaterThan(-1);
      expect(memoryIdx).toBeGreaterThan(-1);
      expect(learningIdx).toBeGreaterThan(-1);
      expect(documentIdx).toBeGreaterThan(-1);
      expect(customIdx).toBeLessThan(memoryIdx);
      expect(memoryIdx).toBeLessThan(learningIdx);
      expect(learningIdx).toBeLessThan(documentIdx);
    });

    it('should handle all contexts being provided', () => {
      const result = buildFullSystemPrompt({
        customInstructions: 'Be concise',
        memoryContext: 'User is John',
        learningContext: 'Prefers TypeScript',
        documentContext: 'API docs',
        composioAddition: '\nSlack connected',
      });

      expect(result).toContain('Be concise');
      expect(result).toContain('User is John');
      expect(result).toContain('Prefers TypeScript');
      expect(result).toContain('API docs');
      expect(result).toContain('Slack connected');
    });
  });
});
