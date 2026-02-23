/**
 * Chat Route Authentication
 *
 * Handles user authentication, admin status caching, and user data loading.
 * Uses Supabase cookie-based auth with an in-memory admin cache (5-minute TTL).
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const log = logger('ChatAuth');

// AUTH-002: Cache admin check results to avoid DB hit every request (5-minute TTL)
const adminCache = new Map<string, { isAdmin: boolean; tier: string; expiresAt: number }>();
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedUserData(userId: string): { isAdmin: boolean; tier: string } | null {
  const entry = adminCache.get(userId);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) adminCache.delete(userId);
    return null;
  }
  return { isAdmin: entry.isAdmin, tier: entry.tier };
}

function setCachedUserData(userId: string, isAdmin: boolean, tier: string): void {
  adminCache.set(userId, { isAdmin, tier, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS });
  // Periodic size check — evict oldest if over 10k entries
  if (adminCache.size > 10000) {
    const firstKey = adminCache.keys().next().value;
    if (firstKey) adminCache.delete(firstKey);
  }
}

export interface AuthResult {
  authenticated: true;
  userId: string;
  isAdmin: boolean;
  userPlanKey: string;
  customInstructions: string;
}

export interface AuthError {
  authenticated: false;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Authenticate the request and load user data.
 * Returns either an AuthResult on success or an AuthError on failure.
 */
export async function authenticateRequest(): Promise<AuthResult | AuthError> {
  try {
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
              /* ignore */
            }
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      log.warn('Unauthenticated chat attempt blocked');
      return {
        authenticated: false,
        status: 401,
        body: {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
          message: 'Please sign in to use chat.',
          action: 'authenticate',
        },
      };
    }

    // AUTH-002: Check admin cache first to avoid DB hit every request
    let isAdmin = false;
    let userPlanKey = 'free';

    const cached = getCachedUserData(user.id);
    if (cached) {
      isAdmin = cached.isAdmin;
      userPlanKey = cached.tier;
    } else {
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin, subscription_tier')
        .eq('id', user.id)
        .single();
      isAdmin = userData?.is_admin === true;
      userPlanKey = userData?.subscription_tier || 'free';
      setCachedUserData(user.id, isAdmin, userPlanKey);
    }

    // CHAT-009: Load custom instructions from user settings
    let customInstructions = '';
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('custom_instructions')
      .eq('user_id', user.id)
      .single();
    if (userSettings?.custom_instructions) {
      customInstructions = userSettings.custom_instructions;
    }

    return {
      authenticated: true,
      userId: user.id,
      isAdmin,
      userPlanKey,
      customInstructions,
    };
  } catch (authErr) {
    log.error('Auth check failed', {
      error: authErr instanceof Error ? authErr.message : 'Unknown',
    });
    return {
      authenticated: false,
      status: 401,
      body: {
        error: 'Authentication required',
        message: 'Please sign in to use chat.',
      },
    };
  }
}
