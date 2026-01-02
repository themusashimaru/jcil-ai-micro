/**
 * GITHUB IDENTITY LINKING
 * =======================
 *
 * Links a GitHub account to an existing user's account.
 * This allows users who signed up with email to connect their GitHub.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * GET - Initiate GitHub OAuth linking
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get('redirect') || '/chat';

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
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL('/login?error=not_authenticated', request.url));
  }

  // Check if already linked to GitHub
  const hasGitHub = user.identities?.some(i => i.provider === 'github');
  if (hasGitHub) {
    return NextResponse.redirect(new URL(`${redirectTo}?github=already_linked`, request.url));
  }

  // Initiate GitHub OAuth to link identity
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'github',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      scopes: 'repo read:user user:email',
    },
  });

  if (error) {
    console.error('[Link GitHub] Error:', error);
    return NextResponse.redirect(new URL(`${redirectTo}?error=link_failed`, request.url));
  }

  if (data?.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.redirect(new URL(`${redirectTo}?error=no_url`, request.url));
}
