/**
 * USER AUTHENTICATION GUARD
 *
 * PURPOSE:
 * - Protect user routes with authentication checks
 * - Verify user is authenticated
 * - CSRF protection for state-changing operations
 * - Return standardized error responses
 *
 * USAGE:
 * import { requireUser } from '@/lib/auth/user-guard';
 *
 * // For GET requests (no CSRF check needed):
 * export async function GET() {
 *   const auth = await requireUser();
 *   if (!auth.authorized) return auth.response;
 *   // Continue with user logic...
 * }
 *
 * // For POST/PUT/DELETE (with CSRF protection):
 * export async function POST(request: NextRequest) {
 *   const auth = await requireUser(request);
 *   if (!auth.authorized) return auth.response;
 *   // Continue with user logic...
 * }
 */

import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

const log = logger('UserGuard');

interface UserAuthResult {
  authorized: true;
  user: {
    id: string;
    email?: string;
  };
  /** Supabase client with user context */
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}

interface UserAuthError {
  authorized: false;
  response: NextResponse;
}

type UserAuthResponse = UserAuthResult | UserAuthError;

/**
 * Require user authentication for a route
 * @param request - Optional request object for CSRF validation on state-changing operations
 * @returns Either authorized user data or error response
 */
export async function requireUser(request?: NextRequest): Promise<UserAuthResponse> {
  try {
    // CSRF PROTECTION: Validate for state-changing requests (POST, PUT, DELETE, PATCH)
    if (request) {
      const csrfCheck = validateCSRF(request);
      if (!csrfCheck.valid) {
        return {
          authorized: false,
          response: csrfCheck.response!,
        };
      }
    }

    // Get authenticated user from session cookies
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Authentication required',
            message: 'You must be signed in to access this resource.',
            code: 'UNAUTHORIZED'
          },
          { status: 401 }
        ),
      };
    }

    // User is authenticated
    return {
      authorized: true,
      user: {
        id: user.id,
        email: user.email,
      },
      supabase,
    };
  } catch (error) {
    // Unexpected error during auth check
    log.error('Unexpected error during authentication', error as Error);

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Authentication error',
          message: 'An error occurred while verifying your credentials.',
          code: 'AUTH_ERROR'
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Optional authentication check - returns user if authenticated, null otherwise
 * Does not return error responses, useful for optional auth scenarios
 */
export async function optionalUser(): Promise<{
  user: { id: string; email?: string } | null;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    return {
      user: user ? { id: user.id, email: user.email } : null,
      supabase,
    };
  } catch {
    const supabase = await createServerSupabaseClient();
    return { user: null, supabase };
  }
}
