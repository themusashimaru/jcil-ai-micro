import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { extractKeywords, clearKnowledgeBaseCache, getKnowledgeBaseContent } from './knowledgeBase';

// -------------------------------------------------------------------
// extractKeywords — pure function
// -------------------------------------------------------------------
describe('extractKeywords', () => {
  it('should extract meaningful words from a message', () => {
    const keywords = extractKeywords('What does the Bible say about forgiveness?');
    expect(keywords).toContain('bible');
    expect(keywords).toContain('say');
    expect(keywords).toContain('forgiveness');
  });

  it('should remove stop words', () => {
    const keywords = extractKeywords('The quick brown fox is a very fast animal');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('is');
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('very');
    expect(keywords).toContain('quick');
    expect(keywords).toContain('brown');
    expect(keywords).toContain('fox');
    expect(keywords).toContain('fast');
    expect(keywords).toContain('animal');
  });

  it('should lowercase all keywords', () => {
    const keywords = extractKeywords('Jesus Christ LORD GOD');
    keywords.forEach((kw) => {
      expect(kw).toBe(kw.toLowerCase());
    });
  });

  it('should remove punctuation', () => {
    const keywords = extractKeywords('Hello, world! How are you?');
    expect(keywords).toContain('hello');
    expect(keywords).toContain('world');
    // "how", "are", "you" are stop words
  });

  it('should remove short words (2 chars or less)', () => {
    const keywords = extractKeywords('I am on it so we go');
    // All are <= 2 chars or stop words
    expect(keywords).toEqual([]);
  });

  it('should return unique keywords', () => {
    const keywords = extractKeywords('God is God and God loves');
    const godCount = keywords.filter((k) => k === 'god').length;
    expect(godCount).toBe(1);
  });

  it('should handle empty string', () => {
    expect(extractKeywords('')).toEqual([]);
  });
});

// -------------------------------------------------------------------
// clearKnowledgeBaseCache — stateful utility
// -------------------------------------------------------------------
describe('clearKnowledgeBaseCache', () => {
  it('should not throw', () => {
    expect(() => clearKnowledgeBaseCache()).not.toThrow();
  });
});

// -------------------------------------------------------------------
// getKnowledgeBaseContent — with empty categories
// -------------------------------------------------------------------
describe('getKnowledgeBaseContent', () => {
  beforeEach(() => {
    clearKnowledgeBaseCache();
  });

  it('should return empty string for empty categories', async () => {
    const result = await getKnowledgeBaseContent([]);
    expect(result).toBe('');
  });

  it('should return fallback content when supabase is not configured', async () => {
    // process.env vars are not set, so getSupabase() returns null
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const result = await getKnowledgeBaseContent(['worldview']);
    expect(result).toContain('CHRISTIAN WORLDVIEW');

    // Restore
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  it('should return fallback content for apologetics category', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await getKnowledgeBaseContent(['apologetics']);
    expect(result).toContain('APOLOGETICS');

    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it('should return fallback content for pastoral category', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await getKnowledgeBaseContent(['pastoral']);
    expect(result).toContain('PASTORAL');

    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it('should return combined fallback for multiple categories', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await getKnowledgeBaseContent(['worldview', 'gospel']);
    expect(result).toContain('CHRISTIAN WORLDVIEW');
    expect(result).toContain('GOSPEL');

    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });
});
