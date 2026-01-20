/**
 * VERCEL TOKEN API
 * ================
 *
 * Securely stores and retrieves user's Vercel API Token.
 * Tokens are encrypted with AES-256-GCM before storage.
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
// SECURITY FIX: Use centralized crypto module which requires dedicated ENCRYPTION_KEY
// (no fallback to SERVICE_ROLE_KEY for separation of concerns)
import { encrypt as encryptToken, decrypt as decryptToken } from '@/lib/security/crypto';

const log = logger('VercelToken');

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
 * GET - Check if user has a Vercel token stored
 */
export async function GET() {
  const { user, error } = await getUser();

  if (error || !user) {
    return errors.unauthorized();
  }

  // Rate limit by user
  const rateLimitResult = await checkRequestRateLimit(
    `vercel:token:get:${user.id}`,
    rateLimits.standard
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  // Use service role to read from users table
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData } = await adminClient
    .from('users')
    .select('vercel_token, vercel_username, vercel_team_id')
    .eq('id', user.id)
    .single();

  if (userData?.vercel_token) {
    // Verify the token is still valid by making a test request
    const token = decryptToken(userData.vercel_token);
    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const vercelUser = await response.json();
        return successResponse({
          connected: true,
          username: vercelUser.user?.username || vercelUser.user?.name || userData.vercel_username,
          email: vercelUser.user?.email,
          teamId: userData.vercel_team_id,
        });
      } else {
        // Token is invalid, clear it
        await adminClient
          .from('users')
          .update({ vercel_token: null, vercel_username: null, vercel_team_id: null })
          .eq('id', user.id);

        return successResponse({ connected: false, error: 'Token expired or invalid' });
      }
    } catch {
      return successResponse({ connected: false, error: 'Failed to verify token' });
    }
  }

  return successResponse({ connected: false });
}

/**
 * POST - Save Vercel token
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getUser();

  if (error || !user) {
    return errors.unauthorized();
  }

  // Rate limit by user - strict limit for token operations
  const rateLimitResult = await checkRequestRateLimit(
    `vercel:token:save:${user.id}`,
    rateLimits.strict
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  const body = await request.json();
  const { token, teamId } = body;

  if (!token) {
    return errors.badRequest('Token required');
  }

  // Validate the token by making a test request
  try {
    const response = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      log.error('[Vercel Token] Validation failed');
      return errors.badRequest('Invalid token. Make sure it has deployment permissions.');
    }

    const vercelUser = await response.json();

    // Verify token has deployment capabilities by checking projects
    const projectsResponse = await fetch('https://api.vercel.com/v9/projects?limit=1', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!projectsResponse.ok) {
      return errors.badRequest('Token needs deployment permissions');
    }

    // Store encrypted token
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const encryptedToken = encryptToken(token);

    const { error: updateError } = await adminClient
      .from('users')
      .update({
        vercel_token: encryptedToken,
        vercel_username:
          vercelUser.user?.username || vercelUser.user?.name || vercelUser.user?.email,
        vercel_team_id: teamId || null,
      })
      .eq('id', user.id);

    if (updateError) {
      log.error(
        '[Vercel Token] Save error:',
        updateError instanceof Error ? updateError : { updateError }
      );
      return errors.serverError();
    }

    return successResponse({
      success: true,
      username: vercelUser.user?.username || vercelUser.user?.name,
      email: vercelUser.user?.email,
    });
  } catch (err) {
    log.error('[Vercel Token] Error:', err instanceof Error ? err : { err });
    return errors.serverError();
  }
}

/**
 * DELETE - Remove Vercel token
 */
export async function DELETE() {
  const { user, error } = await getUser();

  if (error || !user) {
    return errors.unauthorized();
  }

  // Rate limit by user
  const rateLimitResult = await checkRequestRateLimit(
    `vercel:token:delete:${user.id}`,
    rateLimits.strict
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await adminClient
    .from('users')
    .update({ vercel_token: null, vercel_username: null, vercel_team_id: null })
    .eq('id', user.id);

  return successResponse({ success: true });
}
