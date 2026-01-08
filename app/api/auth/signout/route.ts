/**
 * AUTH SIGNOUT ROUTE
 *
 * PURPOSE:
 * - Sign out user from Supabase
 * - Clear session and cookies
 * - Redirect to home page
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits, getClientIP } from '@/lib/api/utils';

const log = logger('AuthSignout');

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = getClientIP(request);
  const rateLimitResult = checkRequestRateLimit(`signout:${ip}`, rateLimits.auth);
  if (!rateLimitResult.allowed) return rateLimitResult.response;
  try {
    const cookieStore = await cookies();

    log.info('[API] Starting logout process...');
    log.info('[API] Current cookies', { cookies: cookieStore.getAll().map(c => c.name) });

    // Create Supabase client with SSR cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              log.info('[API] Setting cookie', { name, hasValue: !!value });
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Sign out from Supabase (clears session and cookies)
    const { error } = await supabase.auth.signOut();

    if (error) {
      log.error('[API] Supabase signout error:', error instanceof Error ? error : { error });
      throw error;
    }

    log.info('[API] Supabase signOut() completed');

    // MANUALLY delete ALL Supabase auth cookies to ensure they're cleared
    const allCookies = cookieStore.getAll();
    log.info('[API] Manually deleting cookies...');

    allCookies.forEach((cookie) => {
      // Delete any cookie that starts with 'sb-' (Supabase cookies)
      if (cookie.name.startsWith('sb-')) {
        log.info('[API] Deleting cookie', { cookie: cookie.name });
        cookieStore.delete(cookie.name);
      }
    });

    log.info('[API] User signed out successfully');
    log.info('[API] Remaining cookies', { cookies: cookieStore.getAll().map(c => c.name) });

    // Return success - let client handle redirect
    return successResponse({ success: true });
  } catch (error) {
    log.error('[API] Signout error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
