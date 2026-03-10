// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const chainable = () => ({
  from: mockFrom,
  insert: mockInsert,
  select: mockSelect,
  single: mockSingle,
  eq: mockEq,
  or: mockOr,
  gte: mockGte,
  lte: mockLte,
  order: mockOrder,
  limit: mockLimit,
});

// Each chained method returns the chainable object
for (const fn of [mockFrom, mockInsert, mockSelect, mockEq, mockOr, mockGte, mockLte, mockOrder]) {
  fn.mockReturnValue(chainable());
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => chainable()),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Set env vars before importing (Supabase URL and key required for non-null client)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

import {
  getCodeMemory,
  storeCode,
  searchCode,
  getRecentCode,
  getConversationCode,
  formatCodeMemoryForPrompt,
} from './code-memory';

// ---------------------------------------------------------------------------
// getCodeMemory singleton
// ---------------------------------------------------------------------------

describe('getCodeMemory', () => {
  it('should return a service instance', () => {
    const service = getCodeMemory();
    expect(service).toBeDefined();
  });

  it('should return the same instance on multiple calls', () => {
    const a = getCodeMemory();
    const b = getCodeMemory();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// storeCode
// ---------------------------------------------------------------------------

describe('storeCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-chain all mocks
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should store code artifact successfully', async () => {
    const stored = {
      id: 'artifact_1',
      userId: 'user_1',
      code: 'const x = 1;',
      language: 'typescript',
    };
    mockSingle.mockResolvedValue({ data: stored, error: null });

    const result = await storeCode('user_1', 'const x = 1;', { language: 'typescript' });
    expect(result).toEqual(stored);
  });

  it('should return null on database error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await storeCode('user_1', 'const x = 1;');
    expect(result).toBeNull();
  });

  it('should return null on exception', async () => {
    mockSingle.mockRejectedValue(new Error('Network error'));

    const result = await storeCode('user_1', 'const x = 1;');
    expect(result).toBeNull();
  });

  it('should call from with correct table', async () => {
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', 'code');
    expect(mockFrom).toHaveBeenCalledWith('chat_code_artifacts');
  });
});

// ---------------------------------------------------------------------------
// searchCode
// ---------------------------------------------------------------------------

describe('searchCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should return results for matching query', async () => {
    const artifacts = [
      {
        id: '1',
        code: 'useState hook',
        language: 'tsx',
        description: 'React hook',
        tags: ['react', 'hooks'],
      },
    ];
    mockLimit.mockResolvedValue({ data: artifacts, error: null });

    const results = await searchCode('user_1', 'react');
    expect(Array.isArray(results)).toBe(true);
  });

  it('should return empty array on DB error', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'Query failed' } });

    const results = await searchCode('user_1', 'test');
    expect(results).toEqual([]);
  });

  it('should return empty array on exception', async () => {
    mockLimit.mockRejectedValue(new Error('Network'));

    const results = await searchCode('user_1', 'test');
    expect(results).toEqual([]);
  });

  it('should filter by language when specified', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await searchCode('user_1', 'query', { language: 'python' });
    expect(mockEq).toHaveBeenCalled();
  });

  it('should filter by date range when specified', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await searchCode('user_1', 'query', {
      dateRange: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
    });
    expect(mockGte).toHaveBeenCalled();
    expect(mockLte).toHaveBeenCalled();
  });

  it('should respect maxResults option', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await searchCode('user_1', 'query', { maxResults: 5 });
    expect(mockLimit).toHaveBeenCalledWith(10); // maxResults * 2
  });
});

// ---------------------------------------------------------------------------
// getRecentCode
// ---------------------------------------------------------------------------

describe('getRecentCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should return recent artifacts', async () => {
    const artifacts = [
      { id: '1', code: 'code' },
      { id: '2', code: 'code2' },
    ];
    mockLimit.mockResolvedValue({ data: artifacts, error: null });

    const results = await getRecentCode('user_1');
    expect(results).toEqual(artifacts);
  });

  it('should return empty array on error', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'error' } });

    const results = await getRecentCode('user_1');
    expect(results).toEqual([]);
  });

  it('should return empty array on exception', async () => {
    mockLimit.mockRejectedValue(new Error('fail'));

    const results = await getRecentCode('user_1');
    expect(results).toEqual([]);
  });

  it('should call from with correct table', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await getRecentCode('user_1');
    expect(mockFrom).toHaveBeenCalledWith('chat_code_artifacts');
  });

  it('should default limit to 10', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await getRecentCode('user_1');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should accept custom limit', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await getRecentCode('user_1', 25);
    expect(mockLimit).toHaveBeenCalledWith(25);
  });
});

// ---------------------------------------------------------------------------
// getConversationCode
// ---------------------------------------------------------------------------

describe('getConversationCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should return conversation artifacts', async () => {
    const artifacts = [{ id: '1', code: 'code', conversationId: 'conv_1' }];
    // getConversationCode doesn't use limit — it uses order then expects data
    mockOrder.mockResolvedValue({ data: artifacts, error: null });

    const results = await getConversationCode('conv_1');
    expect(results).toEqual(artifacts);
  });

  it('should return empty array on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'error' } });

    const results = await getConversationCode('conv_1');
    expect(results).toEqual([]);
  });

  it('should return empty array on exception', async () => {
    mockOrder.mockRejectedValue(new Error('fail'));

    const results = await getConversationCode('conv_1');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatCodeMemoryForPrompt
// ---------------------------------------------------------------------------

describe('formatCodeMemoryForPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should return empty string when no recent code', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    const result = await formatCodeMemoryForPrompt('user_1');
    expect(result).toBe('');
  });

  it('should format code artifacts for prompt', async () => {
    const artifacts = [
      {
        id: '1',
        code: 'const x = 1;',
        language: 'typescript',
        description: 'Simple variable',
        filename: 'index.ts',
        createdAt: new Date('2026-01-15'),
      },
    ];
    mockLimit.mockResolvedValue({ data: artifacts, error: null });

    const result = await formatCodeMemoryForPrompt('user_1');
    expect(result).toContain('Recent Code Memory');
    expect(result).toContain('index.ts');
    expect(result).toContain('const x = 1;');
  });

  it('should truncate long code to 200 chars', async () => {
    const longCode = 'x'.repeat(500);
    const artifacts = [
      {
        id: '1',
        code: longCode,
        language: 'text',
        description: 'Long code',
        createdAt: new Date(),
      },
    ];
    mockLimit.mockResolvedValue({ data: artifacts, error: null });

    const result = await formatCodeMemoryForPrompt('user_1');
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(longCode.length);
  });

  it('should respect maxTokens limit', async () => {
    const artifacts = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      code: 'x'.repeat(100),
      language: 'typescript',
      description: `Artifact ${i}`,
      createdAt: new Date(),
    }));
    mockLimit.mockResolvedValue({ data: artifacts, error: null });

    const result = await formatCodeMemoryForPrompt('user_1', 100);
    // Should not include all 10 artifacts due to token limit
    expect(result.length).toBeLessThan(10 * 200);
  });
});

// ---------------------------------------------------------------------------
// Language detection (indirectly via storeCode)
// ---------------------------------------------------------------------------

describe('language detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it.each([
    ['import React from "react"; function App() { return <div/> }', 'tsx'],
    ['const [state, setState] = useState(0);', 'tsx'],
    ['interface User { name: string; age: number }', 'typescript'],
    ['function hello() { console.log("hi") }', 'javascript'],
    ['def greet(name): print(f"Hello {name}")', 'python'],
    ['func main() { package main }', 'go'],
    ['fn main() { let mut x = 5; }', 'rust'],
    ['public class Main { public static void main(String[] args) {} }', 'java'],
    ['<html><body></body></html>', 'html'],
    ['<!DOCTYPE html>', 'html'],
    ['SELECT * FROM users', 'sql'],
    ['INSERT INTO users VALUES (1)', 'sql'],
    ['random content', 'text'],
  ])('should detect language for: %s', async (code, expected) => {
    let detectedLanguage = '';
    mockInsert.mockImplementation((data) => {
      detectedLanguage = data[0]?.language || '';
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', code);
    expect(detectedLanguage).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Tag extraction (indirectly via storeCode)
// ---------------------------------------------------------------------------

describe('tag extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should extract React tags', async () => {
    let tags: string[] = [];
    mockInsert.mockImplementation((data) => {
      tags = data[0]?.tags || [];
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', 'import React from "react"; const [x, setX] = useState(0);');
    expect(tags).toContain('react');
    expect(tags).toContain('hooks');
  });

  it('should extract async tag', async () => {
    let tags: string[] = [];
    mockInsert.mockImplementation((data) => {
      tags = data[0]?.tags || [];
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', 'async function fetchData() { await fetch("url") }');
    expect(tags).toContain('async');
    expect(tags).toContain('api');
  });

  it('should extract test tag', async () => {
    let tags: string[] = [];
    mockInsert.mockImplementation((data) => {
      tags = data[0]?.tags || [];
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', 'test("should work", () => { expect(1).toBe(1) })');
    expect(tags).toContain('test');
  });

  it('should limit tags to 10', async () => {
    let tags: string[] = [];
    mockInsert.mockImplementation((data) => {
      tags = data[0]?.tags || [];
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    // Code that triggers many tag matches
    await storeCode(
      'user_1',
      'import React; useState; useEffect; express; Next; async; await; test; expect; fetch; api'
    );
    expect(tags.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Description generation (indirectly via storeCode)
// ---------------------------------------------------------------------------

describe('description generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should extract comment as description', async () => {
    let desc = '';
    mockInsert.mockImplementation((data) => {
      desc = data[0]?.description || '';
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', '// This is a utility function\nfunction util() {}');
    expect(desc).toContain('This is a utility function');
  });

  it('should extract function name as description', async () => {
    let desc = '';
    mockInsert.mockImplementation((data) => {
      desc = data[0]?.description || '';
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', 'function processData(input) { return input; }');
    expect(desc).toContain('processData');
  });

  it('should fall back to language snippet description', async () => {
    let desc = '';
    mockInsert.mockImplementation((data) => {
      desc = data[0]?.description || '';
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    await storeCode('user_1', 'const x = 1; const y = 2;');
    expect(desc).toContain('code snippet');
  });
});

// ---------------------------------------------------------------------------
// Code truncation
// ---------------------------------------------------------------------------

describe('code size limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mockFrom,
      mockInsert,
      mockSelect,
      mockEq,
      mockOr,
      mockGte,
      mockLte,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  it('should truncate code to 50000 characters', async () => {
    let storedCode = '';
    mockInsert.mockImplementation((data) => {
      storedCode = data[0]?.code || '';
      return chainable();
    });
    mockSingle.mockResolvedValue({ data: { id: '1' }, error: null });

    const hugeCode = 'x'.repeat(100000);
    await storeCode('user_1', hugeCode);
    expect(storedCode.length).toBe(50000);
  });
});
