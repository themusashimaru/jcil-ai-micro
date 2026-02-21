/**
 * GITHUB TOKEN API
 * ================
 *
 * Securely stores and retrieves user's GitHub Personal Access Token.
 * Tokens are encrypted with AES-256-GCM before storage.
 *
 * SEC-008: Uses SecureServiceRoleClient for audited, scoped access.
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { encrypt as encryptToken, decrypt as decryptToken } from '@/lib/security/crypto';
import {
  createSecureServiceClient,
  extractRequestContext,
} from '@/lib/supabase/secure-service-role';

const log = logger('GitHubToken');

export const runtime = 'nodejs';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * GET - Check if user has a GitHub token stored
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getUser();

  if (error || !user) {
    return errors.unauthorized();
  }

  // Rate limit by user
  const rateLimitResult = await checkRequestRateLimit(
    `github:token:get:${user.id}`,
    rateLimits.standard
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  // SEC-008: Use SecureServiceRoleClient with audit logging
  const secureClient = createSecureServiceClient(
    { id: user.id, email: user.email || undefined },
    extractRequestContext(request, '/api/user/github-token')
  );

  const userData = await secureClient.getUserData(user.id, ['github_token', 'github_username']);

  if (userData?.github_token) {
    // Verify the token is still valid by making a test request
    let token: string;
    try {
      token = decryptToken(userData.github_token as string);
    } catch (decryptError) {
      // Decryption failed - token was encrypted with a different key
      log.warn('[GitHub Token] Decryption failed, clearing invalid token', {
        error: decryptError instanceof Error ? decryptError.message : 'Unknown error',
      });
      await secureClient.updateUserData(user.id, {
        github_token: null,
        github_username: null,
      });
      return successResponse({
        connected: false,
        error: 'Token encryption changed, please reconnect',
      });
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const ghUser = await response.json();
        return successResponse({
          connected: true,
          username: ghUser.login,
          avatarUrl: ghUser.avatar_url,
        });
      } else {
        // Token is invalid, clear it
        await secureClient.updateUserData(user.id, {
          github_token: null,
          github_username: null,
        });

        return successResponse({ connected: false, error: 'Token expired or invalid' });
      }
    } catch {
      return successResponse({ connected: false, error: 'Failed to verify token' });
    }
  }

  return successResponse({ connected: false });
}

/**
 * POST - Save GitHub token
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getUser();

  if (error || !user) {
    return errors.unauthorized();
  }

  // Rate limit by user - strict limit for token operations
  const rateLimitResult = await checkRequestRateLimit(
    `github:token:save:${user.id}`,
    rateLimits.strict
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  const body = await request.json();
  const { token } = body;

  if (!token) {
    return errors.badRequest('Token required');
  }

  // Validate the token by making a test request
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      log.error('[GitHub Token] Validation failed');
      return errors.badRequest('Invalid token. Make sure it has the "repo" scope.');
    }

    const ghUser = await response.json();

    // Check if token has repo scope by trying to list repos
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=1', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!reposResponse.ok) {
      return errors.badRequest('Token needs "repo" scope to push code');
    }

    // SEC-008: Use SecureServiceRoleClient for audited storage
    const secureClient = createSecureServiceClient(
      { id: user.id, email: user.email || undefined },
      extractRequestContext(request, '/api/user/github-token')
    );

    const encryptedToken = encryptToken(token);

    await secureClient.updateUserData(user.id, {
      github_token: encryptedToken,
      github_username: ghUser.login,
    });

    return successResponse({
      success: true,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
    });
  } catch (err) {
    log.error('[GitHub Token] Error:', err instanceof Error ? err : { err });
    return errors.serverError();
  }
}

/**
 * DELETE - Remove GitHub token
 */
export async function DELETE(request: NextRequest) {
  const { user, error } = await getUser();

  if (error || !user) {
    return errors.unauthorized();
  }

  // Rate limit by user
  const rateLimitResult = await checkRequestRateLimit(
    `github:token:delete:${user.id}`,
    rateLimits.strict
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  // SEC-008: Use SecureServiceRoleClient for audited deletion
  const secureClient = createSecureServiceClient(
    { id: user.id, email: user.email || undefined },
    extractRequestContext(request, '/api/user/github-token')
  );

  await secureClient.updateUserData(user.id, {
    github_token: null,
    github_username: null,
  });

  return successResponse({ success: true });
}
