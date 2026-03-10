/**
 * GITHUB TOKEN MANAGER - MEDIUM-004 FIX
 *
 * Provides token rotation and validation mechanisms:
 * - Automatic token health checks
 * - Expiration detection
 * - Refresh prompting
 * - Token validation caching
 */

import { logger } from '@/lib/logger';

const log = logger('GitHubTokenManager');

// ============================================================================
// TYPES
// ============================================================================

export interface TokenValidationResult {
  isValid: boolean;
  username?: string;
  scopes?: string[];
  expiresAt?: Date | null;
  error?: string;
  needsRefresh?: boolean;
}

export interface TokenHealthStatus {
  status: 'healthy' | 'expiring' | 'expired' | 'invalid' | 'unknown';
  message: string;
  daysUntilExpiry?: number;
  lastChecked: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Days before expiration to prompt for refresh */
const EXPIRATION_WARNING_DAYS = 7;

/** How often to re-validate tokens (in ms) - 1 hour */
const VALIDATION_CACHE_TTL = 60 * 60 * 1000;

/** In-memory cache for token validation results */
const validationCache = new Map<string, { result: TokenValidationResult; timestamp: number }>();

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a GitHub token and return detailed information
 */
export async function validateGitHubToken(token: string): Promise<TokenValidationResult> {
  // Check cache first
  const cached = validationCache.get(token);
  if (cached && Date.now() - cached.timestamp < VALIDATION_CACHE_TTL) {
    return cached.result;
  }

  try {
    // Make request to GitHub API
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const result: TokenValidationResult = {
        isValid: false,
        error:
          response.status === 401
            ? 'Token is invalid or expired'
            : `GitHub API error: ${response.status}`,
      };
      return result;
    }

    const user = await response.json();

    // Extract scopes from headers
    const scopesHeader = response.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    // Check for token expiration (fine-grained PATs have expiration)
    const expirationHeader = response.headers.get('github-authentication-token-expiration');
    let expiresAt: Date | null = null;
    let needsRefresh = false;

    if (expirationHeader) {
      expiresAt = new Date(expirationHeader);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      needsRefresh = daysUntilExpiry <= EXPIRATION_WARNING_DAYS;
    }

    const result: TokenValidationResult = {
      isValid: true,
      username: user.login,
      scopes,
      expiresAt,
      needsRefresh,
    };

    // Cache the result
    validationCache.set(token, { result, timestamp: Date.now() });

    return result;
  } catch (error) {
    log.error('Token validation failed', error as Error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Get the health status of a token
 */
export async function getTokenHealthStatus(token: string): Promise<TokenHealthStatus> {
  const validation = await validateGitHubToken(token);
  const lastChecked = new Date();

  if (!validation.isValid) {
    return {
      status: 'invalid',
      message: validation.error || 'Token is invalid',
      lastChecked,
    };
  }

  if (validation.expiresAt) {
    const daysUntilExpiry = Math.ceil(
      (validation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 0) {
      return {
        status: 'expired',
        message: 'Token has expired',
        daysUntilExpiry: 0,
        lastChecked,
      };
    }

    if (daysUntilExpiry <= EXPIRATION_WARNING_DAYS) {
      return {
        status: 'expiring',
        message: `Token expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
        daysUntilExpiry,
        lastChecked,
      };
    }

    return {
      status: 'healthy',
      message: 'Token is valid',
      daysUntilExpiry,
      lastChecked,
    };
  }

  // Classic PATs don't expire
  return {
    status: 'healthy',
    message: 'Token is valid (no expiration)',
    lastChecked,
  };
}

/**
 * Check if a token has required scopes for Code Lab operations
 */
export function hasRequiredScopes(scopes: string[]): {
  hasAll: boolean;
  missing: string[];
} {
  const requiredScopes = ['repo'];
  const missing = requiredScopes.filter(
    (required) =>
      !scopes.some(
        (scope) => scope === required || (required === 'repo' && scope === 'public_repo')
      )
  );

  return {
    hasAll: missing.length === 0,
    missing,
  };
}

/**
 * Clear validation cache for a token
 */
export function clearTokenCache(token?: string): void {
  if (token) {
    validationCache.delete(token);
  } else {
    validationCache.clear();
  }
}

/**
 * Get token summary for display (redacted)
 */
export function getRedactedToken(token: string): string {
  if (token.length <= 8) {
    return '*'.repeat(token.length);
  }
  return `${token.slice(0, 4)}${'*'.repeat(token.length - 8)}${token.slice(-4)}`;
}

// ============================================================================
// REFRESH NOTIFICATION HELPERS
// ============================================================================

export interface TokenRefreshNotification {
  type: 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
}

/**
 * Get notification for token status
 */
export function getTokenRefreshNotification(
  status: TokenHealthStatus
): TokenRefreshNotification | null {
  switch (status.status) {
    case 'expiring':
      return {
        type: 'warning',
        title: 'GitHub Token Expiring Soon',
        message: status.message,
        action: {
          label: 'Refresh Token',
          href: '/settings?tab=connectors',
        },
      };
    case 'expired':
      return {
        type: 'error',
        title: 'GitHub Token Expired',
        message: 'Please generate a new token to continue using GitHub features.',
        action: {
          label: 'Update Token',
          href: '/settings?tab=connectors',
        },
      };
    case 'invalid':
      return {
        type: 'error',
        title: 'GitHub Token Invalid',
        message: status.message,
        action: {
          label: 'Reconnect GitHub',
          href: '/settings?tab=connectors',
        },
      };
    default:
      return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

const GitHubTokenManager = {
  validateGitHubToken,
  getTokenHealthStatus,
  hasRequiredScopes,
  clearTokenCache,
  getRedactedToken,
  getTokenRefreshNotification,
};

export default GitHubTokenManager;
