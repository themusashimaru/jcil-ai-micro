/**
 * WebAuthn Passkey Authentication API
 * POST /api/auth/webauthn/authenticate - Get authentication options
 * PUT /api/auth/webauthn/authenticate - Verify passkey and create session
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  type StoredPasskey,
  type AuthenticationResponseJSON,
} from '@/lib/auth/webauthn';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits, getClientIP } from '@/lib/api/utils';
import { cacheGet, cacheSet, cacheDelete, isRedisAvailable } from '@/lib/redis/client';

const log = logger('WebAuthnAuthenticate');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Challenge TTL in seconds (5 minutes)
const CHALLENGE_TTL_SECONDS = 5 * 60;

// In-memory fallback only when Redis is unavailable (development only)
const memoryFallbackStore = new Map<string, { challenge: string; expires: number }>();

// Create Supabase client inside functions to avoid build-time initialization
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Store WebAuthn challenge (Redis-first with memory fallback)
 */
async function storeChallenge(key: string, challenge: string): Promise<void> {
  const redisKey = `webauthn:auth:${key}`;

  if (isRedisAvailable()) {
    await cacheSet(redisKey, { challenge }, CHALLENGE_TTL_SECONDS);
  } else {
    // Memory fallback for development - cleanup old entries first
    const now = Date.now();
    for (const [k, v] of memoryFallbackStore.entries()) {
      if (v.expires < now) memoryFallbackStore.delete(k);
    }
    memoryFallbackStore.set(key, {
      challenge,
      expires: now + CHALLENGE_TTL_SECONDS * 1000,
    });
    log.warn('Using memory fallback for challenge storage - not recommended in production');
  }
}

/**
 * Get stored WebAuthn challenge (Redis-first with memory fallback)
 */
async function getChallenge(key: string): Promise<string | null> {
  const redisKey = `webauthn:auth:${key}`;

  if (isRedisAvailable()) {
    const data = await cacheGet<{ challenge: string }>(redisKey);
    return data?.challenge || null;
  } else {
    const entry = memoryFallbackStore.get(key);
    if (!entry || entry.expires < Date.now()) {
      memoryFallbackStore.delete(key);
      return null;
    }
    return entry.challenge;
  }
}

/**
 * Delete stored WebAuthn challenge
 */
async function deleteChallenge(key: string): Promise<void> {
  const redisKey = `webauthn:auth:${key}`;

  if (isRedisAvailable()) {
    await cacheDelete(redisKey);
  } else {
    memoryFallbackStore.delete(key);
  }
}

/**
 * POST - Generate authentication options
 * Can be called with or without email (for discoverable credentials)
 */
export async function POST(request: NextRequest) {
  // Rate limit by IP for login attempts
  const ip = getClientIP(request);
  const rateLimitResult = checkRequestRateLimit(`webauthn:auth:${ip}`, rateLimits.auth);
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body as { email?: string };

    let userPasskeys: StoredPasskey[] | undefined;

    // If email provided, get user's passkeys
    if (email) {
      const supabase = getSupabaseAdmin();
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userData) {
        const { data: passkeys } = await supabase
          .from('user_passkeys')
          .select('*')
          .eq('user_id', userData.id);

        userPasskeys = passkeys as StoredPasskey[] | undefined;
      }
    }

    // Generate authentication options
    const options = await generatePasskeyAuthenticationOptions(userPasskeys);

    // Store challenge in Redis (use a session ID or random key for anonymous auth)
    const challengeKey = email || `anon_${options.challenge.slice(0, 16)}`;
    await storeChallenge(challengeKey, options.challenge);

    return successResponse({
      ...options,
      challengeKey, // Return this so client can send it back
    });
  } catch (error) {
    log.error('Passkey auth options error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}

/**
 * PUT - Verify authentication response and create session
 */
export async function PUT(request: NextRequest) {
  // Rate limit by IP for login attempts
  const ip = getClientIP(request);
  const rateLimitResult = checkRequestRateLimit(`webauthn:verify:${ip}`, rateLimits.auth);
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  try {
    const body = await request.json();
    const { response, challengeKey } = body as {
      response: AuthenticationResponseJSON;
      challengeKey: string;
    };

    // Get stored challenge from Redis
    const storedChallenge = await getChallenge(challengeKey);
    if (!storedChallenge) {
      return errors.badRequest('Challenge expired, please try again');
    }

    const supabase = getSupabaseAdmin();
    // Find the passkey by credential ID
    const credentialId = response.id;
    const { data: passkey, error: findError } = await supabase
      .from('user_passkeys')
      .select('*')
      .eq('credential_id', credentialId)
      .single();

    if (findError || !passkey) {
      return errors.notFound('Passkey');
    }

    // Verify the authentication response
    const verification = await verifyPasskeyAuthentication(
      response,
      storedChallenge,
      passkey as StoredPasskey
    );

    if (!verification.verified) {
      return errors.badRequest('Verification failed');
    }

    // Update the counter to prevent replay attacks
    await supabase
      .from('user_passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', passkey.id);

    // Clear the challenge from Redis
    await deleteChallenge(challengeKey);

    // Get the user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', passkey.user_id)
      .single();

    if (userError || !userData) {
      return errors.notFound('User');
    }

    // Generate a magic link for the user
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.email,
    });

    if (authError || !authData) {
      log.error('Failed to generate auth link', { error: authError ?? 'Unknown error' });
      return errors.serverError();
    }

    // Extract the token hash from the action link
    // The action link format: https://xxx.supabase.co/auth/v1/verify?token=TOKEN&type=magiclink&redirect_to=...
    const actionLink = authData.properties?.action_link;
    if (!actionLink) {
      return errors.serverError();
    }

    // Parse the token from the URL
    const url = new URL(actionLink);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    if (!token) {
      return errors.serverError();
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userData.id);

    return successResponse({
      success: true,
      // Return token info for client-side verification
      token,
      type: type || 'magiclink',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.full_name,
      },
    });
  } catch (error) {
    log.error('Passkey authentication error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
