/**
 * Tests for User Document Search
 *
 * Tests searchUserDocuments and userHasDocuments with mocked Supabase
 */

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchUserDocuments, userHasDocuments } from './userSearch';

beforeEach(() => {
  vi.clearAllMocks();

  // Set env vars
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

  // Setup chain for count query
  mockFrom.mockReturnValue({
    select: mockSelect,
  });

  mockSelect.mockReturnValue({
    eq: mockEq,
  });

  mockEq.mockImplementation(() => ({
    eq: mockEq,
    or: mockOr,
    order: mockOrder,
  }));

  mockOr.mockReturnValue({
    limit: mockLimit,
  });

  mockOrder.mockReturnValue({
    limit: mockLimit,
  });
});

describe('searchUserDocuments', () => {
  it('should return empty results when user has no documents', async () => {
    // First call is the count query
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
    });

    const result = await searchUserDocuments('user-123', 'test query');
    expect(result.results).toEqual([]);
    expect(result.contextString).toBe('');
  });

  it('should return empty results on count error', async () => {
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'DB error' } }),
    });

    const result = await searchUserDocuments('user-123', 'test query');
    expect(result.results).toEqual([]);
    expect(result.contextString).toBe('');
  });

  it('should perform keyword search when user has documents', async () => {
    // Count query returns docs
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
    });

    // Keyword search returns results
    const mockChunks = [
      {
        id: 'chunk-1',
        document_id: 'doc-1',
        content: 'This is a test document about typescript',
        user_documents: { name: 'My Notes' },
      },
    ];

    // Reset chain for keyword search
    mockEq.mockReturnValueOnce({
      or: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: mockChunks, error: null }),
      }),
    });

    const result = await searchUserDocuments('user-123', 'typescript test');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].document_name).toBe('My Notes');
    expect(result.contextString).toContain('My Notes');
  });

  it('should handle search with no matching chunks', async () => {
    // Count query returns docs
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
    });

    // Keyword search returns no results
    mockEq.mockReturnValueOnce({
      or: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    // Fallback to recent chunks also returns empty
    mockEq.mockReturnValueOnce({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await searchUserDocuments('user-123', 'nonexistent terms');
    expect(result.results).toEqual([]);
  });

  it('should fall back to recent chunks when keyword search fails', async () => {
    // Count query returns docs
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
    });

    // Keyword search fails
    mockEq.mockReturnValueOnce({
      or: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'search error' } }),
      }),
    });

    // Recent chunks fallback
    const recentChunks = [
      {
        id: 'chunk-2',
        document_id: 'doc-2',
        content: 'Recent document content',
        user_documents: { name: 'Recent Doc' },
      },
    ];

    mockEq.mockReturnValueOnce({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: recentChunks, error: null }),
      }),
    });

    const result = await searchUserDocuments('user-123', 'some query');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].document_name).toBe('Recent Doc');
    expect(result.results[0].similarity).toBe(0.5);
  });

  it('should handle very short query words (< 3 chars)', async () => {
    // Count query
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    });

    // Short words are filtered, falls back to recent chunks
    mockEq.mockReturnValueOnce({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await searchUserDocuments('user-123', 'a b c');
    expect(result.results).toEqual([]);
  });

  it('should use custom matchCount option', async () => {
    // Count query
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
    });

    mockEq.mockReturnValueOnce({
      or: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    mockEq.mockReturnValueOnce({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    await searchUserDocuments('user-123', 'query', { matchCount: 10 });
    // Should not throw
  });

  it('should handle document chunks with array user_documents', async () => {
    // Count query
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
    });

    const mockChunks = [
      {
        id: 'chunk-1',
        document_id: 'doc-1',
        content: 'content about testing',
        user_documents: [{ name: 'Array Doc' }],
      },
    ];

    mockEq.mockReturnValueOnce({
      or: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: mockChunks, error: null }),
      }),
    });

    const result = await searchUserDocuments('user-123', 'testing content');
    expect(result.results[0].document_name).toBe('Array Doc');
  });

  it('should sort results by similarity score', async () => {
    // Count query
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
    });

    const mockChunks = [
      {
        id: 'chunk-1',
        document_id: 'doc-1',
        content: 'only matches testing',
        user_documents: { name: 'Doc A' },
      },
      {
        id: 'chunk-2',
        document_id: 'doc-2',
        content: 'matches both testing and javascript programming',
        user_documents: { name: 'Doc B' },
      },
    ];

    mockEq.mockReturnValueOnce({
      or: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: mockChunks, error: null }),
      }),
    });

    const result = await searchUserDocuments('user-123', 'testing javascript programming');
    expect(result.results[0].similarity).toBeGreaterThanOrEqual(result.results[1].similarity);
  });
});

describe('userHasDocuments', () => {
  it('should return true when user has documents', async () => {
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
    });

    const result = await userHasDocuments('user-123');
    expect(result).toBe(true);
  });

  it('should return false when user has no documents', async () => {
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
    });

    const result = await userHasDocuments('user-456');
    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockRejectedValue(new Error('DB connection error')),
    });

    const result = await userHasDocuments('user-789');
    expect(result).toBe(false);
  });

  it('should return false when count is null', async () => {
    mockEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ count: null, error: null }),
    });

    const result = await userHasDocuments('user-000');
    expect(result).toBe(false);
  });
});
