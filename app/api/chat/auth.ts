/**
 * Chat Route Authentication
 *
 * Handles user authentication, admin status caching, and user data loading.
 * Uses Supabase cookie-based auth with Redis-backed admin cache (5-minute TTL).
 *
 * Migrated from in-memory adminCache (Task 2.1.8) — serverless-safe.
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cacheGet, cacheSet } from '@/lib/redis/client';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

const log = logger('ChatAuth');

// AUTH-002: Cache admin check results to avoid DB hit every request (5-minute TTL)
const ADMIN_CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const ADMIN_CACHE_PREFIX = 'chat:admin:';

interface CachedUserData {
  isAdmin: boolean;
  tier: string;
}

async function getCachedUserData(userId: string): Promise<CachedUserData | null> {
  return cacheGet<CachedUserData>(`${ADMIN_CACHE_PREFIX}${userId}`);
}

async function setCachedUserData(userId: string, isAdmin: boolean, tier: string): Promise<void> {
  await cacheSet(`${ADMIN_CACHE_PREFIX}${userId}`, { isAdmin, tier }, ADMIN_CACHE_TTL_SECONDS);
}

export interface AuthResult {
  authenticated: true;
  userId: string;
  isAdmin: boolean;
  userPlanKey: string;
  customInstructions: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}

export interface AuthError {
  authenticated: false;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Authenticate the request and load user data.
 * Pass `request` for state-changing methods (POST/PUT/DELETE) to enable CSRF validation.
 * Returns either an AuthResult on success or an AuthError on failure.
 */
export async function authenticateRequest(request?: NextRequest): Promise<AuthResult | AuthError> {
  try {
    // CSRF protection for state-changing operations (built-in, like requireUser)
    if (request) {
      const csrfCheck = validateCSRF(request);
      if (!csrfCheck.valid) {
        return {
          authenticated: false,
          status: 403,
          body: {
            error: 'CSRF validation failed',
            code: 'CSRF_ERROR',
            message: 'Request origin validation failed.',
          },
        };
      }
    }
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

    // AUTH-002: Check Redis cache first to avoid DB hit every request
    // Failures here should NOT block auth — fall back to defaults gracefully
    let isAdmin = false;
    let userPlanKey = 'free';
    let customInstructions = '';

    // Step 1: Try Redis cache
    const cached = await getCachedUserData(user.id).catch(() => null);
    if (cached) {
      isAdmin = cached.isAdmin;
      userPlanKey = cached.tier;
    } else {
      // Step 2: Cache miss or Redis down — query DB directly (this MUST succeed)
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('is_admin, subscription_tier, subscription_status')
        .eq('id', user.id)
        .single();

      if (dbError) {
        // DB query failed — this is NOT safe to continue with 'free' defaults.
        // A paying user would silently lose their paid features.
        log.error('Failed to load user data from DB — cannot determine tier', {
          userId: user.id,
          error: dbError.message,
        });
        return {
          authenticated: false,
          status: 503,
          body: {
            error: 'Service temporarily unavailable',
            code: 'USER_DATA_UNAVAILABLE',
            message: 'Unable to load your account data. Please try again in a moment.',
          },
        };
      }

      isAdmin = userData?.is_admin === true;
      const rawTier = userData?.subscription_tier || 'free';
      const subStatus = userData?.subscription_status || 'active';

      // Only grant paid tier if subscription is explicitly active or trialing
      // All other statuses (past_due, canceled, unpaid, incomplete, paused) → free
      const isActiveSubscription = subStatus === 'active' || subStatus === 'trialing';
      if (rawTier !== 'free' && !isActiveSubscription) {
        log.warn('User has non-active subscription, downgrading to free', {
          userId: user.id,
          tier: rawTier,
          status: subStatus,
        });
        userPlanKey = 'free';
      } else {
        userPlanKey = rawTier;
      }
      // Cache set failure is non-fatal
      await setCachedUserData(user.id, isAdmin, userPlanKey).catch((err) =>
        log.warn('Failed to cache user data in Redis (non-fatal)', { userId: user.id, error: err instanceof Error ? err.message : String(err) })
      );
    }

    // CHAT-009: Load custom instructions from user settings
    try {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('custom_instructions')
        .eq('user_id', user.id)
        .single();
      if (userSettings?.custom_instructions) {
        customInstructions = userSettings.custom_instructions;
      }
    } catch {
      // Non-fatal — custom instructions are optional
      log.warn('Failed to load custom instructions', { userId: user.id });
    }

    return {
      authenticated: true,
      userId: user.id,
      isAdmin,
      userPlanKey,
      customInstructions,
      supabase,
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
