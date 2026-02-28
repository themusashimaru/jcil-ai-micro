// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */
/**
 * COMPOSIO CONNECTION CACHE — Tests
 * ==================================
 *
 * Comprehensive tests for the connection cache layer that sits between
 * the application and the Composio API, providing resilience against
 * slow or stale API responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE any import that touches the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Supabase mock builder chain -------------------------------------------------
// Each chainable method returns the same builder so callers can compose
// arbitrary query chains (e.g. .from().select().eq().gt().limit()).

interface MockBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  // The terminal "data/error" result that resolves when awaited
  then?: (onFulfilled: (v: unknown) => unknown) => Promise<unknown>;
}

let mockResult: { data: unknown; error: unknown };

function createMockBuilder(): MockBuilder {
  const builder: MockBuilder = {} as MockBuilder;

  const self = () =>
    new Proxy(builder, {
      get(target, prop) {
        if (prop === 'then') {
          // Makes the builder thenable — resolves with mockResult
          return (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(mockResult).then(onFulfilled);
        }
        return (target as Record<string | symbol, unknown>)[prop];
      },
    });

  builder.select = vi.fn(() => self());
  builder.eq = vi.fn(() => self());
  builder.neq = vi.fn(() => self());
  builder.gt = vi.fn(() => self());
  builder.in = vi.fn(() => self());
  builder.not = vi.fn(() => self());
  builder.limit = vi.fn(() => self());
  builder.upsert = vi.fn(() => self());
  builder.update = vi.fn(() => self());
  builder.delete = vi.fn(() => self());

  return builder;
}

let mockBuilder: MockBuilder;

const mockFrom = vi.fn(() => {
  // Each call to .from() returns a fresh proxy wrapping the current builder
  return new Proxy(mockBuilder, {
    get(target, prop) {
      if (prop === 'then') {
        return (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(mockResult).then(onFulfilled);
      }
      return (target as Record<string | symbol, unknown>)[prop];
    },
  });
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are in place
// ---------------------------------------------------------------------------

import {
  getCachedConnections,
  isCacheFresh,
  saveConnectionsToCache,
  saveSingleConnectionToCache,
  removeConnectionFromCache,
  clearUserCache,
  withRetry,
  CACHE_TTL_MS,
} from '../connection-cache';

import type { ConnectedAccount } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-123';

function makeConnection(overrides: Partial<ConnectedAccount> = {}): ConnectedAccount {
  return {
    id: 'conn-1',
    toolkit: 'GMAIL',
    status: 'connected',
    connectedAt: '2026-02-27T00:00:00.000Z',
    metadata: { email: 'test@example.com' },
    ...overrides,
  };
}

function makeCachedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    user_id: TEST_USER_ID,
    connection_id: 'conn-1',
    toolkit: 'GMAIL',
    status: 'connected',
    connected_at: '2026-02-27T00:00:00.000Z',
    last_verified_at: new Date().toISOString(),
    metadata: { email: 'test@example.com' },
    created_at: '2026-02-27T00:00:00.000Z',
    updated_at: '2026-02-27T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockBuilder = createMockBuilder();
  mockResult = { data: null, error: null };

  // Ensure env vars are set so getSupabaseAdmin() returns a client
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

// ===========================================================================
// CACHE_TTL_MS export
// ===========================================================================

describe('CACHE_TTL_MS', () => {
  it('should be 5 minutes in milliseconds', () => {
    expect(CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('should equal exactly 300000', () => {
    expect(CACHE_TTL_MS).toBe(300000);
  });

  it('should be a positive number', () => {
    expect(CACHE_TTL_MS).toBeGreaterThan(0);
  });
});

// ===========================================================================
// getCachedConnections
// ===========================================================================

describe('getCachedConnections', () => {
  it('should return null when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('should return null when query errors', async () => {
    mockResult = { data: null, error: { message: 'DB error' } };
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('should return null when no cached data exists', async () => {
    mockResult = { data: [], error: null };
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('should return null when data is null', async () => {
    mockResult = { data: null, error: null };
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('should return mapped ConnectedAccount array on success', async () => {
    const rows = [
      makeCachedRow({ toolkit: 'GMAIL', connection_id: 'conn-gmail' }),
      makeCachedRow({ toolkit: 'SLACK', connection_id: 'conn-slack' }),
    ];
    mockResult = { data: rows, error: null };

    const result = await getCachedConnections(TEST_USER_ID);

    expect(result).toHaveLength(2);
    expect(result![0].id).toBe('conn-gmail');
    expect(result![0].toolkit).toBe('GMAIL');
    expect(result![1].id).toBe('conn-slack');
    expect(result![1].toolkit).toBe('SLACK');
  });

  it('should filter for connected and pending statuses', async () => {
    mockResult = { data: [makeCachedRow()], error: null };
    await getCachedConnections(TEST_USER_ID);

    expect(mockBuilder.in).toHaveBeenCalledWith('status', ['connected', 'pending']);
  });

  it('should map connected_at null to undefined', async () => {
    mockResult = { data: [makeCachedRow({ connected_at: null })], error: null };
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result![0].connectedAt).toBeUndefined();
  });

  it('should return null when an unexpected exception occurs', async () => {
    // Force the Supabase chain to throw
    mockBuilder.select = vi.fn(() => {
      throw new Error('unexpected crash');
    });
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it('should query the composio_connection_cache table', async () => {
    mockResult = { data: [], error: null };
    await getCachedConnections(TEST_USER_ID);
    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
  });

  it('should pass the user_id to eq filter', async () => {
    mockResult = { data: [], error: null };
    await getCachedConnections(TEST_USER_ID);
    expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
  });

  it('should correctly map metadata from cached row', async () => {
    const meta = { email: 'user@test.com', name: 'Test User', avatarUrl: 'http://img.png' };
    mockResult = { data: [makeCachedRow({ metadata: meta })], error: null };
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result![0].metadata).toEqual(meta);
  });

  it('should correctly map status from cached row', async () => {
    mockResult = { data: [makeCachedRow({ status: 'pending' })], error: null };
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result![0].status).toBe('pending');
  });

  it('should handle a single cached row correctly', async () => {
    const row = makeCachedRow({ toolkit: 'GITHUB', connection_id: 'conn-gh' });
    mockResult = { data: [row], error: null };
    const result = await getCachedConnections(TEST_USER_ID);
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('conn-gh');
    expect(result![0].toolkit).toBe('GITHUB');
  });
});

// ===========================================================================
// isCacheFresh
// ===========================================================================

describe('isCacheFresh', () => {
  it('should return false when Supabase is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });

  it('should return false when query errors', async () => {
    mockResult = { data: null, error: { message: 'DB error' } };
    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });

  it('should return false when no fresh records exist', async () => {
    mockResult = { data: [], error: null };
    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });

  it('should return true when fresh records exist', async () => {
    mockResult = {
      data: [{ last_verified_at: new Date().toISOString() }],
      error: null,
    };
    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(true);
  });

  it('should query with correct cutoff time relative to CACHE_TTL_MS', async () => {
    const before = Date.now();
    mockResult = { data: [], error: null };
    await isCacheFresh(TEST_USER_ID);
    const after = Date.now();

    // The gt call should have been made with a cutoff time that is ~CACHE_TTL_MS ago
    const gtCall = mockBuilder.gt.mock.calls[0];
    expect(gtCall[0]).toBe('last_verified_at');
    const cutoff = new Date(gtCall[1] as string).getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - CACHE_TTL_MS - 50);
    expect(cutoff).toBeLessThanOrEqual(after - CACHE_TTL_MS + 50);
  });

  it('should return false when an unexpected exception occurs', async () => {
    mockBuilder.select = vi.fn(() => {
      throw new Error('unexpected crash');
    });
    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(false);
  });

  it('should query the composio_connection_cache table', async () => {
    mockResult = { data: [], error: null };
    await isCacheFresh(TEST_USER_ID);
    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
  });

  it('should select last_verified_at column', async () => {
    mockResult = { data: [], error: null };
    await isCacheFresh(TEST_USER_ID);
    expect(mockBuilder.select).toHaveBeenCalledWith('last_verified_at');
  });

  it('should limit results to 1', async () => {
    mockResult = { data: [], error: null };
    await isCacheFresh(TEST_USER_ID);
    expect(mockBuilder.limit).toHaveBeenCalledWith(1);
  });

  it('should return falsy when data is null', async () => {
    mockResult = { data: null, error: null };
    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBeFalsy();
  });

  it('should return true when multiple fresh records exist', async () => {
    mockResult = {
      data: [
        { last_verified_at: new Date().toISOString() },
        { last_verified_at: new Date().toISOString() },
      ],
      error: null,
    };
    const result = await isCacheFresh(TEST_USER_ID);
    expect(result).toBe(true);
  });
});

// ===========================================================================
// saveConnectionsToCache
// ===========================================================================

describe('saveConnectionsToCache', () => {
  it('should return early when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await saveConnectionsToCache(TEST_USER_ID, [makeConnection()]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should upsert connections with uppercased toolkit', async () => {
    const conn = makeConnection({ toolkit: 'gmail' });
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    expect(mockBuilder.upsert).toHaveBeenCalled();
    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg[0].toolkit).toBe('GMAIL');
  });

  it('should not call upsert when connections array is empty', async () => {
    mockResult = { data: null, error: null };
    await saveConnectionsToCache(TEST_USER_ID, []);

    // upsert should not be called, but the existing cache check should still happen
    expect(mockBuilder.upsert).not.toHaveBeenCalled();
  });

  it('should mark stale connections as disconnected', async () => {
    const conn = makeConnection({ toolkit: 'GMAIL' });

    // First call: upsert succeeds
    // Second call: existing cached (returns one extra toolkit)
    // Third call: update to mark disconnected
    let callCount = 0;
    const originalSelect = mockBuilder.select;
    mockBuilder.select = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) {
        // This is the select for existing cached connections
        mockResult = {
          data: [{ toolkit: 'GMAIL' }, { toolkit: 'SLACK' }],
          error: null,
        };
      }
      return originalSelect(...args);
    });

    // For upsert and update calls, succeed
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    // The update should have been called to mark SLACK as disconnected
    expect(mockBuilder.update).toHaveBeenCalled();
  });

  it('should detect partial API response and skip disconnection marking', async () => {
    const conn = makeConnection({ toolkit: 'GMAIL' });

    // Simulate: previously had 5 connections, now only 1 returned
    let callCount = 0;
    const originalSelect = mockBuilder.select;
    mockBuilder.select = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) {
        mockResult = {
          data: [
            { toolkit: 'GMAIL' },
            { toolkit: 'SLACK' },
            { toolkit: 'GITHUB' },
            { toolkit: 'NOTION' },
            { toolkit: 'JIRA' },
          ],
          error: null,
        };
      }
      return originalSelect(...args);
    });

    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    // update should NOT have been called because partial response was detected
    expect(mockBuilder.update).not.toHaveBeenCalled();
  });

  it('should mark all as disconnected when API returns 0 and previous count <= 2', async () => {
    // Simulate: previously had 1 connection, now 0 returned
    let callCount = 0;
    const originalSelect = mockBuilder.select;
    mockBuilder.select = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) {
        mockResult = {
          data: [{ toolkit: 'GMAIL' }],
          error: null,
        };
      }
      return originalSelect(...args);
    });

    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, []);

    expect(mockBuilder.update).toHaveBeenCalled();
  });

  it('should preserve cache when API returns 0 but user had many cached', async () => {
    // Simulate: previously had 5 connections, now 0 returned
    let callCount = 0;
    const originalSelect = mockBuilder.select;
    mockBuilder.select = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) {
        mockResult = {
          data: [
            { toolkit: 'GMAIL' },
            { toolkit: 'SLACK' },
            { toolkit: 'GITHUB' },
            { toolkit: 'NOTION' },
            { toolkit: 'JIRA' },
          ],
          error: null,
        };
      }
      return originalSelect(...args);
    });

    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, []);

    // update should NOT have been called — cache is preserved
    expect(mockBuilder.update).not.toHaveBeenCalled();
  });

  it('should handle upsert error gracefully', async () => {
    const conn = makeConnection();
    mockBuilder.upsert = vi.fn(() => {
      return new Proxy(mockBuilder, {
        get(_, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: { message: 'upsert failed' } }).then(
                onFulfilled
              );
          }
          return (mockBuilder as Record<string | symbol, unknown>)[prop];
        },
      });
    });

    // Should not throw
    await saveConnectionsToCache(TEST_USER_ID, [conn]);
  });

  it('should handle unexpected exception gracefully', async () => {
    mockBuilder.upsert = vi.fn(() => {
      throw new Error('unexpected crash');
    });

    // Should not throw
    await saveConnectionsToCache(TEST_USER_ID, [makeConnection()]);
  });

  it('should set metadata to empty object when connection has no metadata', async () => {
    const conn = makeConnection({ metadata: undefined });
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg[0].metadata).toEqual({});
  });

  it('should set connected_at to null when connectedAt is not provided', async () => {
    const conn = makeConnection({ connectedAt: undefined });
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg[0].connected_at).toBeNull();
  });

  it('should include user_id in each upserted record', async () => {
    const conn = makeConnection();
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg[0].user_id).toBe(TEST_USER_ID);
  });

  it('should set last_verified_at to current time on upsert', async () => {
    const conn = makeConnection();
    mockResult = { data: null, error: null };

    const before = new Date().toISOString();
    await saveConnectionsToCache(TEST_USER_ID, [conn]);
    const after = new Date().toISOString();

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg[0].last_verified_at >= before).toBe(true);
    expect(upsertArg[0].last_verified_at <= after).toBe(true);
  });

  it('should upsert with onConflict user_id,toolkit', async () => {
    const conn = makeConnection();
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    const upsertOptions = mockBuilder.upsert.mock.calls[0][1];
    expect(upsertOptions.onConflict).toBe('user_id,toolkit');
    expect(upsertOptions.ignoreDuplicates).toBe(false);
  });

  it('should upsert multiple connections in a single call', async () => {
    const conns = [
      makeConnection({ toolkit: 'GMAIL', id: 'c1' }),
      makeConnection({ toolkit: 'SLACK', id: 'c2' }),
      makeConnection({ toolkit: 'GITHUB', id: 'c3' }),
    ];
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, conns);

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg).toHaveLength(3);
    expect(upsertArg[0].toolkit).toBe('GMAIL');
    expect(upsertArg[1].toolkit).toBe('SLACK');
    expect(upsertArg[2].toolkit).toBe('GITHUB');
  });

  it('should handle update error when marking stale connections', async () => {
    const conn = makeConnection({ toolkit: 'GMAIL' });

    let callCount = 0;
    const originalSelect = mockBuilder.select;
    mockBuilder.select = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) {
        mockResult = {
          data: [{ toolkit: 'GMAIL' }, { toolkit: 'SLACK' }],
          error: null,
        };
      }
      return originalSelect(...args);
    });

    // Make the update call return an error
    mockBuilder.update = vi.fn(() => {
      return new Proxy(mockBuilder, {
        get(_, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: { message: 'update failed' } }).then(
                onFulfilled
              );
          }
          return (mockBuilder as Record<string | symbol, unknown>)[prop];
        },
      });
    });

    // Should not throw despite update error
    await saveConnectionsToCache(TEST_USER_ID, [conn]);
  });

  it('should handle error when marking all as disconnected', async () => {
    let callCount = 0;
    const originalSelect = mockBuilder.select;
    mockBuilder.select = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) {
        mockResult = {
          data: [{ toolkit: 'GMAIL' }],
          error: null,
        };
      }
      return originalSelect(...args);
    });

    mockBuilder.update = vi.fn(() => {
      return new Proxy(mockBuilder, {
        get(_, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: { message: 'update all failed' } }).then(
                onFulfilled
              );
          }
          return (mockBuilder as Record<string | symbol, unknown>)[prop];
        },
      });
    });

    // Should not throw despite update error
    await saveConnectionsToCache(TEST_USER_ID, []);
  });

  it('should preserve connection status in upserted record', async () => {
    const conn = makeConnection({ status: 'pending' });
    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg[0].status).toBe('pending');
  });

  it('should not detect partial response when previous count is less than 3', async () => {
    // 2 previous, 1 new => ratio is 0.5 but previousCount < 3 so not partial
    const conn = makeConnection({ toolkit: 'GMAIL' });

    let callCount = 0;
    const originalSelect = mockBuilder.select;
    mockBuilder.select = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) {
        mockResult = {
          data: [{ toolkit: 'GMAIL' }, { toolkit: 'SLACK' }],
          error: null,
        };
      }
      return originalSelect(...args);
    });

    mockResult = { data: null, error: null };

    await saveConnectionsToCache(TEST_USER_ID, [conn]);

    // update SHOULD have been called since previousCount (2) < 3
    expect(mockBuilder.update).toHaveBeenCalled();
  });
});

// ===========================================================================
// saveSingleConnectionToCache
// ===========================================================================

describe('saveSingleConnectionToCache', () => {
  it('should return early when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await saveSingleConnectionToCache(TEST_USER_ID, makeConnection());
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should upsert a single connection successfully', async () => {
    mockResult = { data: null, error: null };
    const conn = makeConnection({ toolkit: 'slack', id: 'conn-slack' });

    await saveSingleConnectionToCache(TEST_USER_ID, conn);

    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
    expect(mockBuilder.upsert).toHaveBeenCalled();
    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg.toolkit).toBe('SLACK');
    expect(upsertArg.connection_id).toBe('conn-slack');
    expect(upsertArg.user_id).toBe(TEST_USER_ID);
  });

  it('should use current time as connected_at when not provided', async () => {
    mockResult = { data: null, error: null };
    const conn = makeConnection({ connectedAt: undefined });

    const before = new Date().toISOString();
    await saveSingleConnectionToCache(TEST_USER_ID, conn);
    const after = new Date().toISOString();

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg.connected_at).toBeTruthy();
    expect(upsertArg.connected_at >= before).toBe(true);
    expect(upsertArg.connected_at <= after).toBe(true);
  });

  it('should handle upsert error gracefully', async () => {
    mockBuilder.upsert = vi.fn(() => {
      return new Proxy(mockBuilder, {
        get(_, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: { message: 'upsert failed' } }).then(
                onFulfilled
              );
          }
          return (mockBuilder as Record<string | symbol, unknown>)[prop];
        },
      });
    });

    // Should not throw
    await saveSingleConnectionToCache(TEST_USER_ID, makeConnection());
  });

  it('should handle unexpected exception gracefully', async () => {
    mockBuilder.upsert = vi.fn(() => {
      throw new Error('unexpected');
    });

    // Should not throw
    await saveSingleConnectionToCache(TEST_USER_ID, makeConnection());
  });

  it('should set onConflict to user_id,toolkit', async () => {
    mockResult = { data: null, error: null };
    await saveSingleConnectionToCache(TEST_USER_ID, makeConnection());

    const upsertOptions = mockBuilder.upsert.mock.calls[0][1];
    expect(upsertOptions.onConflict).toBe('user_id,toolkit');
    expect(upsertOptions.ignoreDuplicates).toBe(false);
  });

  it('should preserve provided connectedAt timestamp', async () => {
    mockResult = { data: null, error: null };
    const conn = makeConnection({ connectedAt: '2025-01-15T12:00:00.000Z' });

    await saveSingleConnectionToCache(TEST_USER_ID, conn);

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg.connected_at).toBe('2025-01-15T12:00:00.000Z');
  });

  it('should set metadata to empty object when not provided', async () => {
    mockResult = { data: null, error: null };
    const conn = makeConnection({ metadata: undefined });

    await saveSingleConnectionToCache(TEST_USER_ID, conn);

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg.metadata).toEqual({});
  });

  it('should set last_verified_at to current time', async () => {
    mockResult = { data: null, error: null };
    const before = new Date().toISOString();
    await saveSingleConnectionToCache(TEST_USER_ID, makeConnection());
    const after = new Date().toISOString();

    const upsertArg = mockBuilder.upsert.mock.calls[0][0];
    expect(upsertArg.last_verified_at >= before).toBe(true);
    expect(upsertArg.last_verified_at <= after).toBe(true);
  });

  it('should return early with warning when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await saveSingleConnectionToCache(TEST_USER_ID, makeConnection());
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// removeConnectionFromCache
// ===========================================================================

describe('removeConnectionFromCache', () => {
  it('should return early when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should update connection status to disconnected', async () => {
    mockResult = { data: null, error: null };
    await removeConnectionFromCache(TEST_USER_ID, 'gmail');

    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
    expect(mockBuilder.update).toHaveBeenCalled();
    const updateArg = mockBuilder.update.mock.calls[0][0];
    expect(updateArg.status).toBe('disconnected');
    expect(updateArg.last_verified_at).toBeTruthy();
  });

  it('should uppercase the toolkit name in the eq filter', async () => {
    mockResult = { data: null, error: null };
    await removeConnectionFromCache(TEST_USER_ID, 'slack');

    // eq is called for user_id and toolkit
    const eqCalls = mockBuilder.eq.mock.calls;
    const toolkitCall = eqCalls.find((call: unknown[]) => call[0] === 'toolkit');
    expect(toolkitCall).toBeDefined();
    expect(toolkitCall![1]).toBe('SLACK');
  });

  it('should handle update error gracefully', async () => {
    mockBuilder.update = vi.fn(() => {
      return new Proxy(mockBuilder, {
        get(_, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: { message: 'update failed' } }).then(
                onFulfilled
              );
          }
          return (mockBuilder as Record<string | symbol, unknown>)[prop];
        },
      });
    });

    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');
    // Should not throw
  });

  it('should handle unexpected exception gracefully', async () => {
    mockBuilder.update = vi.fn(() => {
      throw new Error('unexpected');
    });

    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');
    // Should not throw
  });

  it('should filter by user_id', async () => {
    mockResult = { data: null, error: null };
    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');

    const eqCalls = mockBuilder.eq.mock.calls;
    const userIdCall = eqCalls.find((call: unknown[]) => call[0] === 'user_id');
    expect(userIdCall).toBeDefined();
    expect(userIdCall![1]).toBe(TEST_USER_ID);
  });

  it('should set last_verified_at to a valid ISO string', async () => {
    mockResult = { data: null, error: null };
    const before = new Date().toISOString();
    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');
    const after = new Date().toISOString();

    const updateArg = mockBuilder.update.mock.calls[0][0];
    expect(updateArg.last_verified_at >= before).toBe(true);
    expect(updateArg.last_verified_at <= after).toBe(true);
  });

  it('should handle already-uppercase toolkit names', async () => {
    mockResult = { data: null, error: null };
    await removeConnectionFromCache(TEST_USER_ID, 'JIRA');

    const eqCalls = mockBuilder.eq.mock.calls;
    const toolkitCall = eqCalls.find((call: unknown[]) => call[0] === 'toolkit');
    expect(toolkitCall![1]).toBe('JIRA');
  });
});

// ===========================================================================
// clearUserCache
// ===========================================================================

describe('clearUserCache', () => {
  it('should return early when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await clearUserCache(TEST_USER_ID);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should delete all records for the user', async () => {
    mockResult = { data: null, error: null };
    await clearUserCache(TEST_USER_ID);

    expect(mockFrom).toHaveBeenCalledWith('composio_connection_cache');
    expect(mockBuilder.delete).toHaveBeenCalled();
    expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
  });

  it('should handle delete error gracefully', async () => {
    mockBuilder.delete = vi.fn(() => {
      return new Proxy(mockBuilder, {
        get(_, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: { message: 'delete failed' } }).then(
                onFulfilled
              );
          }
          return (mockBuilder as Record<string | symbol, unknown>)[prop];
        },
      });
    });

    await clearUserCache(TEST_USER_ID);
    // Should not throw
  });

  it('should handle unexpected exception gracefully', async () => {
    mockBuilder.delete = vi.fn(() => {
      throw new Error('unexpected');
    });

    await clearUserCache(TEST_USER_ID);
    // Should not throw
  });

  it('should return early when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await clearUserCache(TEST_USER_ID);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// withRetry
// ===========================================================================

describe('withRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { operationName: 'test-op' });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed on subsequent attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail-1')).mockResolvedValue('success');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1, // minimal delay for test speed
      operationName: 'test-op',
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelay: 1,
        operationName: 'test-op',
      })
    ).rejects.toThrow('persistent failure');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use default values when options are not provided', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should respect custom maxRetries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, { maxRetries: 1, baseDelay: 1 })).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should apply exponential backoff between retries', async () => {
    // We cannot easily test exact timing, but we can verify the function
    // is called the correct number of times with minimal delay
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      operationName: 'backoff-test',
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should handle non-Error rejection values', async () => {
    const fn = vi.fn().mockRejectedValue('string-error');

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelay: 1, operationName: 'string-err' })
    ).rejects.toBe('string-error');
  });

  it('should succeed on the last possible attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('last-chance');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      operationName: 'last-chance-op',
    });

    expect(result).toBe('last-chance');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should propagate the last error when all retries fail', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error-1'))
      .mockRejectedValueOnce(new Error('error-2'))
      .mockRejectedValueOnce(new Error('error-3'));

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 1, operationName: 'multi-error' })
    ).rejects.toThrow('error-3');
  });

  it('should handle null rejection value', async () => {
    const fn = vi.fn().mockRejectedValue(null);

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelay: 1, operationName: 'null-err' })
    ).rejects.toBeNull();
  });

  it('should handle undefined rejection value', async () => {
    const fn = vi.fn().mockRejectedValue(undefined);

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelay: 1, operationName: 'undef-err' })
    ).rejects.toBeUndefined();
  });

  it('should return complex objects from the function', async () => {
    const complexResult = { items: [1, 2, 3], nested: { key: 'value' } };
    const fn = vi.fn().mockResolvedValue(complexResult);

    const result = await withRetry(fn, { operationName: 'complex-return' });
    expect(result).toEqual(complexResult);
  });

  it('should use default operationName when not specified', async () => {
    const fn = vi.fn().mockResolvedValue('done');

    // This just verifies it doesn't crash with default operationName
    const result = await withRetry(fn, { maxRetries: 1 });
    expect(result).toBe('done');
  });
});

// ===========================================================================
// getSupabaseAdmin — indirect tests via missing env vars
// ===========================================================================

describe('getSupabaseAdmin (via public functions)', () => {
  it('should return null/false/void when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

    const [cached, fresh] = await Promise.all([
      getCachedConnections(TEST_USER_ID),
      isCacheFresh(TEST_USER_ID),
    ]);

    expect(cached).toBeNull();
    expect(fresh).toBe(false);
  });

  it('should return null/false/void when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const [cached, fresh] = await Promise.all([
      getCachedConnections(TEST_USER_ID),
      isCacheFresh(TEST_USER_ID),
    ]);

    expect(cached).toBeNull();
    expect(fresh).toBe(false);
  });

  it('should return null/false when both env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const [cached, fresh] = await Promise.all([
      getCachedConnections(TEST_USER_ID),
      isCacheFresh(TEST_USER_ID),
    ]);

    expect(cached).toBeNull();
    expect(fresh).toBe(false);
  });

  it('should handle saveConnectionsToCache when both env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await saveConnectionsToCache(TEST_USER_ID, [makeConnection()]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should handle removeConnectionFromCache when both env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await removeConnectionFromCache(TEST_USER_ID, 'GMAIL');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should handle clearUserCache when both env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await clearUserCache(TEST_USER_ID);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
