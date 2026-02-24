import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/anthropic/client', () => ({
  createAnthropicCompletion: vi.fn().mockResolvedValue({ text: 'Mock synopsis of the document.' }),
  CLAUDE_HAIKU: 'claude-haiku-4-5-20251001',
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
  type DocSection,
  type DocProfile,
  type ChunkResult,
  makeDocProfile,
  getRelevantChunks,
  needsChunking,
  processDocumentForContext,
} from './chunking';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('Chunking type exports', () => {
  it('should export DocSection interface', () => {
    const s: DocSection = { i: 0, h: 'Introduction', start: 0, end: 10 };
    expect(s.h).toBe('Introduction');
  });

  it('should export DocProfile interface', () => {
    const p: DocProfile = {
      id: 'doc-1',
      version: 'abc123',
      synopsis: 'A document about...',
      sections: [],
      totalLines: 100,
      totalChars: 5000,
    };
    expect(p.totalLines).toBe(100);
  });

  it('should export ChunkResult interface', () => {
    const r: ChunkResult = {
      synopsis: 'Synopsis',
      chunks: ['chunk1'],
      totalTokensUsed: 50,
      chunksSelected: 1,
      chunksTotal: 3,
    };
    expect(r.chunksSelected).toBe(1);
  });
});

// ============================================================================
// needsChunking
// ============================================================================

describe('needsChunking', () => {
  it('should return false for short text', () => {
    expect(needsChunking('Hello world')).toBe(false);
  });

  it('should return true for long text', () => {
    const longText = 'word '.repeat(5000);
    expect(needsChunking(longText)).toBe(true);
  });

  it('should respect custom maxDirectTokens', () => {
    const mediumText = 'word '.repeat(100);
    expect(needsChunking(mediumText, 50)).toBe(true);
    expect(needsChunking(mediumText, 500)).toBe(false);
  });

  it('should handle empty text', () => {
    expect(needsChunking('')).toBe(false);
  });
});

// ============================================================================
// getRelevantChunks
// ============================================================================

describe('getRelevantChunks', () => {
  const makeProfile = (sections: DocSection[]): DocProfile => ({
    id: 'test',
    version: 'v1',
    synopsis: 'Test synopsis',
    sections,
    totalLines: 100,
    totalChars: 5000,
  });

  it('should return chunks sorted by relevance', () => {
    const rawText = Array.from({ length: 20 }, (_, i) =>
      i < 10 ? 'The quick brown fox' : 'Data about databases and SQL queries'
    ).join('\n');

    const profile = makeProfile([
      { i: 0, h: 'Fox Section', start: 0, end: 10 },
      { i: 1, h: 'Database Section', start: 10, end: 20 },
    ]);

    const result = getRelevantChunks(rawText, profile, 'database SQL', 120, 800);
    expect(result.chunks.length).toBeGreaterThan(0);
    // Database section should come first since query matches
    expect(result.chunks[0]).toContain('Database');
  });

  it('should respect token budget', () => {
    const rawText = 'word '.repeat(1000) + '\n'.repeat(100);
    const profile = makeProfile([
      { i: 0, h: 'Section 1', start: 0, end: 500 },
      { i: 1, h: 'Section 2', start: 500, end: 1000 },
    ]);

    const result = getRelevantChunks(rawText, profile, 'test', 120, 50);
    expect(result.totalTokensUsed).toBeLessThanOrEqual(50);
  });

  it('should include section headings in chunks', () => {
    const rawText = 'Line 1\nLine 2\nLine 3';
    const profile = makeProfile([{ i: 0, h: 'My Header', start: 0, end: 3 }]);

    const result = getRelevantChunks(rawText, profile, 'line', 120, 800);
    expect(result.chunks[0]).toContain('### My Header');
  });

  it('should give header matches higher weight', () => {
    const rawText = 'generic text\n'.repeat(10) + 'more generic text\n'.repeat(10);
    const profile = makeProfile([
      { i: 0, h: 'Security Vulnerabilities', start: 0, end: 10 },
      { i: 1, h: 'General Info', start: 10, end: 20 },
    ]);

    const result = getRelevantChunks(rawText, profile, 'security', 120, 800);
    expect(result.chunks[0]).toContain('Security');
  });

  it('should return synopsis from profile', () => {
    const rawText = 'content';
    const profile = makeProfile([{ i: 0, h: 'Sec', start: 0, end: 1 }]);
    profile.synopsis = 'Custom synopsis here';

    const result = getRelevantChunks(rawText, profile, 'test', 120, 800);
    expect(result.synopsis).toBe('Custom synopsis here');
  });

  it('should report chunk counts', () => {
    const rawText = 'line\n'.repeat(500);
    const profile = makeProfile([{ i: 0, h: 'Big Section', start: 0, end: 500 }]);

    const result = getRelevantChunks(rawText, profile, 'test', 120, 100);
    expect(result.chunksTotal).toBeGreaterThan(0);
    expect(result.chunksSelected).toBeLessThanOrEqual(result.chunksTotal);
  });

  it('should handle empty sections', () => {
    const rawText = '';
    const profile = makeProfile([]);
    const result = getRelevantChunks(rawText, profile, 'test', 120, 800);
    expect(result.chunks).toEqual([]);
    expect(result.chunksTotal).toBe(0);
  });
});

// ============================================================================
// makeDocProfile
// ============================================================================

describe('makeDocProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a profile with sections', async () => {
    const doc = '# Introduction\nSome intro text\n# Methods\nSome methods text';
    const profile = await makeDocProfile('test-doc', doc);
    expect(profile.id).toBe('test-doc');
    expect(profile.sections.length).toBeGreaterThan(0);
    expect(profile.totalLines).toBe(4);
  });

  it('should detect markdown headings as section boundaries', async () => {
    const doc = '# Heading 1\nContent 1\n## Heading 2\nContent 2\n### Heading 3\nContent 3';
    const profile = await makeDocProfile('test-doc', doc);
    const headings = profile.sections.map((s) => s.h);
    expect(headings).toContain('Heading 1');
    expect(headings).toContain('Heading 2');
  });

  it('should generate a version hash', async () => {
    const profile = await makeDocProfile('test', 'some text');
    expect(profile.version).toMatch(/^[a-f0-9]{40}$/); // SHA1 hex
  });

  it('should generate different hashes for different content', async () => {
    const p1 = await makeDocProfile('test', 'text A');
    const p2 = await makeDocProfile('test', 'text B');
    expect(p1.version).not.toBe(p2.version);
  });

  it('should include synopsis from AI', async () => {
    const profile = await makeDocProfile('test', 'content');
    expect(profile.synopsis).toBe('Mock synopsis of the document.');
  });

  it('should count total chars', async () => {
    const text = 'Hello World';
    const profile = await makeDocProfile('test', text);
    expect(profile.totalChars).toBe(text.length);
  });
});

// ============================================================================
// processDocumentForContext
// ============================================================================

describe('processDocumentForContext', () => {
  it('should return full text for small documents', async () => {
    const result = await processDocumentForContext('doc-1', 'Small text here', 'query');
    expect(result.wasChunked).toBe(false);
    expect(result.content).toBe('Small text here');
    expect(result.stats).toBeUndefined();
  });

  it('should chunk large documents', async () => {
    const largeText = 'word '.repeat(3000);
    const result = await processDocumentForContext('doc-2', largeText, 'word', 100);
    expect(result.wasChunked).toBe(true);
    expect(result.content).toContain('Document Synopsis');
    expect(result.content).toContain('Relevant Sections');
    expect(result.stats).toBeDefined();
  });

  it('should include chunk count in output', async () => {
    const largeText =
      '# Section A\n' + 'data '.repeat(1000) + '\n# Section B\n' + 'info '.repeat(1000);
    const result = await processDocumentForContext('doc-3', largeText, 'data', 200);
    if (result.wasChunked) {
      expect(result.content).toContain('sections shown based on relevance');
    }
  });
});
