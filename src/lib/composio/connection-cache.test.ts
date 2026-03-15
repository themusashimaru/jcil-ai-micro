// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

// Track all mock query builder calls
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGt = vi.fn();
const mockLimit = vi.fn();
const mockNot = vi.fn();
const mockNeq = vi.fn();
const _mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// Chain builder that returns itself for all chainable methods
function createChainBuilder(terminalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'in', 'gt', 'limit', 'not', 'neq', 'update', 'delete'];
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // Wrap the select mock to also track and return builder
  builder.select = (...args: unknown[]) => {
    mockSelect(...args);
    return builder;
  };
  builder.eq = (...args: unknown[]) => {
    mockEq(...args);
    return builder;
  };
  builder.in = (...args: unknown[]) => {
    mockIn(...args);
    return builder;
  };
  builder.gt = (...args: unknown[]) => {
    mockGt(...args);
    return builder;
  };
  builder.limit = (...args: unknown[]) => {
    mockLimit(...args);
    return builder;
  };
  builder.not = (...args: unknown[]) => {
    mockNot(...args);
    return builder;
  };
  builder.neq = (...args: unknown[]) => {
    mockNeq(...args);
    return builder;
  };
  builder.update = (...args: unknown[]) => {
    mockUpdate(...args);
    return builder;
  };
  builder.delete = (...args: unknown[]) => {
    mockDelete(...args);
    return builder;
  };

  // Make it thenable so `await` resolves to the terminal result
  builder.then = (resolve: (val: unknown) => void) => resolve(terminalResult);
  return builder;
}

let mockFromResult: ReturnType<typeof createChainBuilder>;
const mockFrom = vi.fn().mockImplementation(() => mockFromResult);
const _mockUpsertResult = { data: null, error: null };
let mockFromSequence: Array<ReturnType<typeof createChainBuilder>> = [];
let mockFromCallIndex = 0;

const mockCreateClient = vi.fn().mockReturnValue({
  from: (...args: unknown[]) => {
    mockFrom(...args);
    if (mockFromSequence.length > 0) {
      const result = mockFromSequence[mockFromCallIndex] || mockFromResult;
      mockFromCallIndex++;
      return result;
    }
    return mockFromResult;
  },
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import {
  getCachedConnections,
  isCacheFresh,
  saveConnectionsToCache,
  saveSingleConnectionToCache,
  removeConnectionFromCache,
  clearUserCache,
  withRetry,
  CACHE_TTL_MS,
} from './connection-cache';

// ============================================================================
// TEST HELPERS
// ============================================================================

const TEST_USER_ID = 'user-123';

function makeCachedConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cache-row-1',
    user_id: TEST_USER_ID,
    connection_id: 'conn-abc',
    toolkit: 'GMAIL',
    status: 'connected',
    connected_at: '2026-03-01T00:00:00Z',
    last_verified_at: '2026-03-05T12:00:00Z',
    metadata: {},
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-05T12:00:00Z',
    ...overrides,
  };
}

function makeConnectedAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-abc',
    toolkit: 'GMAIL',
    status: 'connected' as const,
    connectedAt: '2026-03-01T00:00:00Z',
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockFromCallIndex = 0;
  mockFromSequence = [];

  // Set env vars so getSupabaseAdmin() returns a client
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

  // Default: successful empty result
  mockFromResult = createChainBuilder({ data: [], error: null });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ============================================================================
// TESTS: CACHE_TTL_MS
// ============================================================================

describe('CACHE_TTL_MS', () => {
  it('should be 30 minutes in milliseconds', () => {
    expect(CACHE_TTL_MS).toBe(30 * 60 * 1000);
  });
});

// ============================================================================
// TESTS: getCachedConnections
// ============================================================================

describe('getCachedConnections', () => {
  it('returns null when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('returns null when Supabase query returns an error', async () => {
    mockFromResult = createChainBuilder({
      data: null,
      error: { message: 'DB error' },
    });

    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('returns null when no cached connections exist', async () => {
    mockFromResult = createChainBuilder({ data: [], error: null });

    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('returns null when data is null', async () => {
    mockFromResult = createChainBuilder({ data: null, error: null });

    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('returns mapped ConnectedAccount objects on cache hit', async () => {
    const cached = makeCachedConnection();
    mockFromResult = createChainBuilder({ data: [cached], error: null });

    const result = await getCachedConnections(TEST_USER_ID);

    expect(result).toEqual([
      {
        id: 'conn-abc',
        toolkit: 'GMAIL',
        status: 'connected',
        connectedAt: '2026-03-01T00:00:00Z',
        metadata: {},
      },
    ]);
  });

  it('maps multiple cached connections correctly', async () => {
    const cached1 = makeCachedConnection({ toolkit: 'GMAIL', connection_id: 'conn-1' });
    const cached2 = makeCachedConnection({
      toolkit: 'SLACK',
      connection_id: 'conn-2',
      connected_at: null,
      status: 'pending',
    });

    mockFromResult = createChainBuilder({ data: [cached1, cached2], error: null });

    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toHaveLength(2);
    expect(result![0].toolkit).toBe('GMAIL');
    expect(result![1].toolkit).toBe('SLACK');
    expect(result![1].connectedAt).toBeUndefined();
    expect(result![1].status).toBe('pending');
  });

  it('returns null when an exception is thrown', async () => {
    // Create a builder that throws on .then
    const throwingBuilder: Record<string, unknown> = {};
    throwingBuilder.select = vi.fn().mockReturnValue(throwingBuilder);
    throwingBuilder.eq = vi.fn().mockReturnValue(throwingBuilder);
    throwingBuilder.in = vi.fn().mockReturnValue(throwingBuilder);
    throwingBuilder.then = () => {
      throw new Error('Network failure');
    };

    mockFromResult = throwingBuilder as ReturnType<typeof createChainBuilder>;

    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });
});

// ============================================================================
// TESTS: isCacheFresh
// ============================================================================

describe('isCacheFresh', () => {
  it('returns false when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });

  it('returns false when query errors', async () => {
    mockFromResult = createChainBuilder({
      data: null,
      error: { message: 'Query error' },
    });

    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });

  it('returns false when no rows match the TTL cutoff', async () => {
    mockFromResult = createChainBuilder({ data: [], error: null });

    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });

  it('returns true when rows exist within TTL cutoff', async () => {
    mockFromResult = createChainBuilder({
      data: [{ last_verified_at: new Date().toISOString() }],
      error: null,
    });

    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(true);
  });

  it('returns false on exception', async () => {
    const throwingBuilder: Record<string, unknown> = {};
    throwingBuilder.select = vi.fn().mockReturnValue(throwingBuilder);
    throwingBuilder.eq = vi.fn().mockReturnValue(throwingBuilder);
    throwingBuilder.gt = vi.fn().mockReturnValue(throwingBuilder);
    throwingBuilder.limit = vi.fn().mockReturnValue(throwingBuilder);
    throwingBuilder.then = () => {
      throw new Error('Timeout');
    };

    mockFromResult = throwingBuilder as ReturnType<typeof createChainBuilder>;

    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });
});

// ============================================================================
// TESTS: saveConnectionsToCache
// ============================================================================

describe('saveConnectionsToCache', () => {
  it('returns early when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await saveConnectionsToCache(TEST_USER_ID, [makeConnectedAccount()]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('upserts active connections without marking absent ones as disconnected', async () => {
    const conn = makeConnectedAccount({ toolkit: 'GMAIL' });

    // Only one DB call: upsert active connections (no select/update for stale marking)
    const upsertBuilder = createChainBuilder({ data: null, error: null });
    upsertBuilder.upsert = vi.fn().mockReturnValue(createChainBuilder({ data: null, error: null }));

    mockFromSequence = [upsertBuilder];

    await saveConnectionsToCache(TEST_USER_ID, [conn]);
    expect(mockFrom).toHaveBeenCalled();
  });

  it('does nothing when connections array is empty', async () => {
    // With additive-only caching, empty response means nothing to upsert
    await saveConnectionsToCache(TEST_USER_ID, []);
    // No DB calls expected since no active or inactive connections
  });

  it('handles upsert error gracefully', async () => {
    const conn = makeConnectedAccount();

    const upsertBuilder = createChainBuilder({ data: null, error: null });
    upsertBuilder.upsert = vi
      .fn()
      .mockReturnValue(createChainBuilder({ data: null, error: { message: 'Upsert failed' } }));

    mockFromSequence = [upsertBuilder];

    // Should not throw
    await saveConnectionsToCache(TEST_USER_ID, [conn]);
  });

  it('upserts explicitly-inactive connections with their non-active status', async () => {
    // When Composio API returns a connection with FAILED/EXPIRED status,
    // we should upsert it with that status (but not mark absent ones)
    const activeConn = makeConnectedAccount({ toolkit: 'GMAIL' });
    const failedConn = makeConnectedAccount({ toolkit: 'SLACK', id: 'conn-2', status: 'failed' });

    // Two upsert calls: one for active, one for inactive
    const upsertBuilder1 = createChainBuilder({ data: null, error: null });
    upsertBuilder1.upsert = vi
      .fn()
      .mockReturnValue(createChainBuilder({ data: null, error: null }));

    const upsertBuilder2 = createChainBuilder({ data: null, error: null });
    upsertBuilder2.upsert = vi
      .fn()
      .mockReturnValue(createChainBuilder({ data: null, error: null }));

    mockFromSequence = [upsertBuilder1, upsertBuilder2];

    await saveConnectionsToCache(TEST_USER_ID, [activeConn, failedConn]);
    expect(mockFrom).toHaveBeenCalled();
  });

  it('preserves cache when API returns partial results (additive-only)', async () => {
    // With additive-only caching, partial responses just update what's present
    // and leave everything else untouched — no marking absent as disconnected
    const conn1 = makeConnectedAccount({ toolkit: 'GMAIL' });

    const upsertBuilder = createChainBuilder({ data: null, error: null });
    upsertBuilder.upsert = vi.fn().mockReturnValue(createChainBuilder({ data: null, error: null }));

    mockFromSequence = [upsertBuilder];

    await saveConnectionsToCache(TEST_USER_ID, [conn1]);
    // Should only upsert GMAIL, leave other cached connections alone
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('handles exception in the entire save flow', async () => {
    const throwingBuilder: Record<string, unknown> = {};
    throwingBuilder.upsert = vi.fn().mockImplementation(() => {
      throw new Error('Catastrophic failure');
    });

    mockFromSequence = [throwingBuilder as ReturnType<typeof createChainBuilder>];

    // Should not throw
    await saveConnectionsToCache(TEST_USER_ID, [makeConnectedAccount()]);
  });
});

// ============================================================================
// TESTS: saveSingleConnectionToCache
// ============================================================================

describe('saveSingleConnectionToCache', () => {
  it('returns early when Supabase is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await saveSingleConnectionToCache(TEST_USER_ID, makeConnectedAccount());
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('upserts a single connection successfully', async () => {
    const upsertBuilder = createChainBuilder({ data: null, error: null });
    upsertBuilder.upsert = vi.fn().mockReturnValue(createChainBuilder({ data: null, error: null }));

    mockFromSequence = [upsertBuilder];

    await saveSingleConnectionToCache(TEST_USER_ID, makeConnectedAccount());
    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
  });

  it('uppercases the toolkit name', async () => {
    const upsertFn = vi.fn().mockReturnValue(createChainBuilder({ data: null, error: null }));

    const builder = createChainBuilder({ data: null, error: null });
    builder.upsert = upsertFn;

    mockFromSequence = [builder];

    const conn = makeConnectedAccount({ toolkit: 'gmail' });
    await saveSingleConnectionToCache(TEST_USER_ID, conn);

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ toolkit: 'GMAIL' }),
      expect.any(Object)
    );
  });

  it('handles upsert error gracefully', async () => {
    const builder = createChainBuilder({ data: null, error: null });
    builder.upsert = vi
      .fn()
      .mockReturnValue(createChainBuilder({ data: null, error: { message: 'Conflict' } }));

    mockFromSequence = [builder];

    await saveSingleConnectionToCache(TEST_USER_ID, makeConnectedAccount());
    // Should not throw
  });

  it('uses current time as connectedAt when not provided', async () => {
    const upsertFn = vi.fn().mockReturnValue(createChainBuilder({ data: null, error: null }));

    const builder = createChainBuilder({ data: null, error: null });
    builder.upsert = upsertFn;

    mockFromSequence = [builder];

    const conn = makeConnectedAccount({ connectedAt: undefined });
    await saveSingleConnectionToCache(TEST_USER_ID, conn);

    const upsertArg = upsertFn.mock.calls[0][0];
    expect(upsertArg.connected_at).toBeTruthy();
    // It should be a recent ISO string
    const timestamp = new Date(upsertArg.connected_at).getTime();
    expect(Math.abs(Date.now() - timestamp)).toBeLessThan(5000);
  });

  it('handles exception gracefully', async () => {
    const builder: Record<string, unknown> = {};
    builder.upsert = vi.fn().mockImplementation(() => {
      throw new Error('Network error');
    });

    mockFromSequence = [builder as ReturnType<typeof createChainBuilder>];

    await saveSingleConnectionToCache(TEST_USER_ID, makeConnectedAccount());
    // Should not throw
  });
});

// ============================================================================
// TESTS: removeConnectionFromCache
// ============================================================================

describe('removeConnectionFromCache', () => {
  it('returns early when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await removeConnectionFromCache(TEST_USER_ID, 'gmail');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('updates connection status to disconnected', async () => {
    mockFromResult = createChainBuilder({ data: null, error: null });

    await removeConnectionFromCache(TEST_USER_ID, 'gmail');
    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
  });

  it('uppercases toolkit name in the query', async () => {
    mockFromResult = createChainBuilder({ data: null, error: null });

    await removeConnectionFromCache(TEST_USER_ID, 'slack');
    // The eq mock should have been called with 'toolkit' and 'SLACK'
    expect(mockEq).toHaveBeenCalledWith('toolkit', 'SLACK');
  });

  it('handles update error gracefully', async () => {
    mockFromResult = createChainBuilder({ data: null, error: { message: 'Update failed' } });

    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');
    // Should not throw
  });

  it('handles exception gracefully', async () => {
    const throwingBuilder: Record<string, unknown> = {};
    throwingBuilder.update = vi.fn().mockImplementation(() => {
      throw new Error('DB down');
    });

    mockFromResult = throwingBuilder as ReturnType<typeof createChainBuilder>;

    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');
    // Should not throw
  });
});

// ============================================================================
// TESTS: clearUserCache
// ============================================================================

describe('clearUserCache', () => {
  it('returns early when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await clearUserCache(TEST_USER_ID);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deletes all cached connections for the user', async () => {
    mockFromResult = createChainBuilder({ data: null, error: null });

    await clearUserCache(TEST_USER_ID);
    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
    expect(mockEq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
  });

  it('handles delete error gracefully', async () => {
    mockFromResult = createChainBuilder({ data: null, error: { message: 'Delete failed' } });

    await clearUserCache(TEST_USER_ID);
    // Should not throw
  });

  it('handles exception gracefully', async () => {
    const throwingBuilder: Record<string, unknown> = {};
    throwingBuilder.delete = vi.fn().mockImplementation(() => {
      throw new Error('Connection refused');
    });

    mockFromResult = throwingBuilder as ReturnType<typeof createChainBuilder>;

    await clearUserCache(TEST_USER_ID);
    // Should not throw
  });
});

// ============================================================================
// TESTS: withRetry
// ============================================================================

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, { operationName: 'test-op' });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
      operationName: 'retry-test',
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const err = new Error('Persistent failure');
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 10, operationName: 'fail-test' })
    ).rejects.toThrow('Persistent failure');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue(42);

    const result = await withRetry(fn);
    expect(result).toBe(42);
  });

  it('respects custom maxRetries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, { maxRetries: 1, baseDelay: 10 })).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff between retries', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
      operationName: 'backoff-test',
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('handles non-Error thrown values', async () => {
    const fn = vi.fn().mockRejectedValueOnce('string error').mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 2, baseDelay: 10 });
    expect(result).toBe('ok');
  });

  it('throws the last error when all retries fail', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error-1'))
      .mockRejectedValueOnce(new Error('error-2'))
      .mockRejectedValueOnce(new Error('error-3'));

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('error-3');
  });
});
