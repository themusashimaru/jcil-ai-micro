/**
 * GITHUB IDENTITY LINKING
 * =======================
 *
 * Links a GitHub account to an existing user's account.
 * Uses signInWithOAuth which will auto-link if emails match.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { checkRequestRateLimit, rateLimits, getClientIP } from '@/lib/api/utils';

const log = logger('AuthLinkGitHub');

export const runtime = 'nodejs';

/**
 * GET - Initiate GitHub OAuth linking via signInWithOAuth
 * This approach works without enabling "manual linking" in Supabase
 * If the GitHub email matches the current user's email, accounts merge
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP
  const ip = getClientIP(request);
  const rateLimitResult = checkRequestRateLimit(`github:link:${ip}`, rateLimits.auth);
  if (!rateLimitResult.allowed) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL('/chat?error=rate_limited', origin));
  }
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get('redirect') || '/chat';
  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

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
            // Ignore errors in read-only contexts
          }
        },
      },
    }
  );

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if already linked to GitHub
    const hasGitHub = user.identities?.some(i => i.provider === 'github');
    if (hasGitHub) {
      return NextResponse.redirect(new URL(`${redirectTo}?github=already_linked`, origin));
    }
  }

  // Use signInWithOAuth - this will:
  // 1. If email matches existing account: link the GitHub identity
  // 2. If no match: create new account with GitHub
  // The callback will preserve the session
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}&linking=true`,
      scopes: 'repo read:user user:email',
    },
  });

  if (error) {
    log.error('[Link GitHub] OAuth Error:', error instanceof Error ? error : { error });
    return NextResponse.redirect(new URL(`${redirectTo}?error=oauth_failed`, origin));
  }

  if (data?.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.redirect(new URL(`${redirectTo}?error=no_oauth_url`, origin));
}
