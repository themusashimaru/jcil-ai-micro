// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API validation calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  hasRequiredScopes,
  clearTokenCache,
  getRedactedToken,
  getTokenRefreshNotification,
  validateGitHubToken,
  getTokenHealthStatus,
} from './github-token-manager';
import type { TokenHealthStatus } from './github-token-manager';

// Helper to create mock Response with proper headers
function mockResponse(
  ok: boolean,
  body: object,
  headers: Record<string, string> = {},
  status = 200
) {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  };
}

// ---------------------------------------------------------------------------
// hasRequiredScopes
// ---------------------------------------------------------------------------

describe('hasRequiredScopes', () => {
  it('should return hasAll true when repo scope is present', () => {
    const result = hasRequiredScopes(['repo', 'user']);
    expect(result.hasAll).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should return hasAll true when public_repo is present', () => {
    const result = hasRequiredScopes(['public_repo']);
    expect(result.hasAll).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should return hasAll false when repo scope is missing', () => {
    const result = hasRequiredScopes(['user', 'gist']);
    expect(result.hasAll).toBe(false);
    expect(result.missing).toContain('repo');
  });

  it('should return hasAll false for empty scopes', () => {
    const result = hasRequiredScopes([]);
    expect(result.hasAll).toBe(false);
    expect(result.missing).toContain('repo');
  });
});

// ---------------------------------------------------------------------------
// getRedactedToken
// ---------------------------------------------------------------------------

describe('getRedactedToken', () => {
  it('should redact middle of long token', () => {
    const result = getRedactedToken('ghp_1234567890abcdef');
    expect(result.startsWith('ghp_')).toBe(true);
    expect(result.endsWith('cdef')).toBe(true);
    expect(result).toContain('*');
  });

  it('should fully redact short token', () => {
    const result = getRedactedToken('abc');
    expect(result).toBe('***');
  });

  it('should fully redact 8 char token', () => {
    const result = getRedactedToken('12345678');
    expect(result).toBe('********');
  });

  it('should show first 4 and last 4 for 9+ char token', () => {
    const result = getRedactedToken('123456789');
    expect(result).toBe('1234*6789');
  });

  it('should preserve token length', () => {
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz';
    const result = getRedactedToken(token);
    expect(result.length).toBe(token.length);
  });
});

// ---------------------------------------------------------------------------
// getTokenRefreshNotification
// ---------------------------------------------------------------------------

describe('getTokenRefreshNotification', () => {
  it('should return warning notification for expiring status', () => {
    const status: TokenHealthStatus = {
      status: 'expiring',
      message: 'Token expires in 7 days',
      lastChecked: new Date(),
    };
    const result = getTokenRefreshNotification(status);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('warning');
    expect(result!.title).toContain('Expiring');
    expect(result!.action?.label).toBe('Refresh Token');
  });

  it('should return error notification for expired status', () => {
    const status: TokenHealthStatus = {
      status: 'expired',
      message: 'Token has expired',
      lastChecked: new Date(),
    };
    const result = getTokenRefreshNotification(status);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.title).toContain('Expired');
    expect(result!.action?.label).toBe('Update Token');
  });

  it('should return error notification for invalid status', () => {
    const status: TokenHealthStatus = {
      status: 'invalid',
      message: 'Token is invalid',
      lastChecked: new Date(),
    };
    const result = getTokenRefreshNotification(status);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.title).toContain('Invalid');
    expect(result!.action?.label).toBe('Reconnect GitHub');
  });

  it('should return null for healthy status', () => {
    const status: TokenHealthStatus = {
      status: 'healthy',
      message: 'Token is valid',
      lastChecked: new Date(),
    };
    const result = getTokenRefreshNotification(status);
    expect(result).toBeNull();
  });

  it('should include settings link in action', () => {
    const status: TokenHealthStatus = {
      status: 'expiring',
      message: 'Expiring',
      lastChecked: new Date(),
    };
    const result = getTokenRefreshNotification(status);
    expect(result!.action?.href).toContain('/settings');
  });

  it('should return null for unknown status', () => {
    const status: TokenHealthStatus = {
      status: 'unknown',
      message: 'Unknown',
      lastChecked: new Date(),
    };
    const result = getTokenRefreshNotification(status);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearTokenCache
// ---------------------------------------------------------------------------

describe('clearTokenCache', () => {
  it('should not throw when clearing all', () => {
    expect(() => clearTokenCache()).not.toThrow();
  });

  it('should not throw when clearing specific token', () => {
    expect(() => clearTokenCache('some-token')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateGitHubToken
// ---------------------------------------------------------------------------

describe('validateGitHubToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenCache();
  });

  it('should return valid for successful API response', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(true, { login: 'testuser' }, { 'x-oauth-scopes': 'repo, user' })
    );

    const result = await validateGitHubToken('ghp_valid_token_123456');
    expect(result.isValid).toBe(true);
    expect(result.username).toBe('testuser');
  });

  it('should parse scopes from headers', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(true, { login: 'testuser' }, { 'x-oauth-scopes': 'repo, user, gist' })
    );

    const result = await validateGitHubToken('ghp_scopes_token_12345');
    expect(result.scopes).toContain('repo');
    expect(result.scopes).toContain('user');
    expect(result.scopes).toContain('gist');
  });

  it('should return invalid for 401 response', async () => {
    mockFetch.mockResolvedValue(mockResponse(false, { message: 'Bad credentials' }, {}, 401));

    const result = await validateGitHubToken('ghp_invalid_token_12345');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('invalid or expired');
  });

  it('should return invalid for non-401 error response', async () => {
    mockFetch.mockResolvedValue(mockResponse(false, { message: 'Server error' }, {}, 500));

    const result = await validateGitHubToken('ghp_server_error_12345');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('500');
  });

  it('should return invalid on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await validateGitHubToken('ghp_network_token_1234');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should detect expiring tokens from headers', async () => {
    const expiresIn3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch.mockResolvedValue(
      mockResponse(
        true,
        { login: 'user' },
        {
          'x-oauth-scopes': 'repo',
          'github-authentication-token-expiration': expiresIn3Days,
        }
      )
    );

    const result = await validateGitHubToken('ghp_expiring_token_1234');
    expect(result.isValid).toBe(true);
    expect(result.needsRefresh).toBe(true);
    expect(result.expiresAt).toBeDefined();
  });

  it('should not flag refresh for tokens expiring far in the future', async () => {
    const expiresIn60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch.mockResolvedValue(
      mockResponse(
        true,
        { login: 'user' },
        {
          'x-oauth-scopes': 'repo',
          'github-authentication-token-expiration': expiresIn60Days,
        }
      )
    );

    const result = await validateGitHubToken('ghp_longexpiry_token12');
    expect(result.isValid).toBe(true);
    expect(result.needsRefresh).toBe(false);
  });

  it('should cache results', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(true, { login: 'cached' }, { 'x-oauth-scopes': 'repo' })
    );

    const token = 'ghp_cache_test_token1234';
    const result1 = await validateGitHubToken(token);
    const result2 = await validateGitHubToken(token);

    expect(result1.username).toBe('cached');
    expect(result2.username).toBe('cached');
    // Only 1 fetch call — second was from cache
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should send correct authorization header', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(true, { login: 'user' }, { 'x-oauth-scopes': 'repo' })
    );

    await validateGitHubToken('ghp_auth_header_test12');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe('Bearer ghp_auth_header_test12');
  });
});

// ---------------------------------------------------------------------------
// getTokenHealthStatus
// ---------------------------------------------------------------------------

describe('getTokenHealthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenCache();
  });

  it('should return healthy for valid token without expiry', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(true, { login: 'testuser' }, { 'x-oauth-scopes': 'repo' })
    );

    const result = await getTokenHealthStatus('ghp_healthy_token_12345');
    expect(result.status).toBe('healthy');
    expect(result.message).toContain('valid');
    expect(result.lastChecked).toBeInstanceOf(Date);
  });

  it('should return invalid for bad token', async () => {
    mockFetch.mockResolvedValue(mockResponse(false, { message: 'Bad credentials' }, {}, 401));

    const result = await getTokenHealthStatus('ghp_bad_token_123456789');
    expect(result.status).toBe('invalid');
    expect(result.lastChecked).toBeInstanceOf(Date);
  });

  it('should return expiring for token near expiration', async () => {
    const expiresIn3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch.mockResolvedValue(
      mockResponse(
        true,
        { login: 'user' },
        {
          'x-oauth-scopes': 'repo',
          'github-authentication-token-expiration': expiresIn3Days,
        }
      )
    );

    const result = await getTokenHealthStatus('ghp_expiring_health_12');
    expect(result.status).toBe('expiring');
    expect(result.daysUntilExpiry).toBeLessThanOrEqual(7);
  });

  it('should return healthy for token with distant expiration', async () => {
    const expiresIn60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch.mockResolvedValue(
      mockResponse(
        true,
        { login: 'user' },
        {
          'x-oauth-scopes': 'repo',
          'github-authentication-token-expiration': expiresIn60Days,
        }
      )
    );

    const result = await getTokenHealthStatus('ghp_distant_health_123');
    expect(result.status).toBe('healthy');
    expect(result.daysUntilExpiry).toBeGreaterThan(7);
  });

  it('should return expired for past expiration date', async () => {
    const expiredYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockFetch.mockResolvedValue(
      mockResponse(
        true,
        { login: 'user' },
        {
          'x-oauth-scopes': 'repo',
          'github-authentication-token-expiration': expiredYesterday,
        }
      )
    );

    const result = await getTokenHealthStatus('ghp_expired_health_123');
    expect(result.status).toBe('expired');
    expect(result.daysUntilExpiry).toBe(0);
  });
});
