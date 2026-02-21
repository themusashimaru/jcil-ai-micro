/**
 * WebAuthn Passkey Registration API
 * POST /api/auth/webauthn/register - Get registration options
 * PUT /api/auth/webauthn/register - Verify and save new passkey
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/supabase/server-auth';
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getDeviceNameFromUserAgent,
  uint8ArrayToBase64URL,
  type StoredPasskey,
  type RegistrationResponseJSON,
} from '@/lib/auth/webauthn';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { cacheGet, cacheSet, cacheDelete, isRedisAvailable } from '@/lib/redis/client';
import { auditLog } from '@/lib/audit';

const log = logger('WebAuthnRegister');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Challenge TTL in seconds (5 minutes)
const CHALLENGE_TTL_SECONDS = 5 * 60;

// In-memory fallback only when Redis is unavailable (development only — rejected in production)
const memoryFallbackStore = new Map<string, { challenge: string; expires: number }>();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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
  const redisKey = `webauthn:register:${key}`;

  if (isRedisAvailable()) {
    await cacheSet(redisKey, { challenge }, CHALLENGE_TTL_SECONDS);
  } else if (IS_PRODUCTION) {
    // SEC-007: Reject WebAuthn in production when Redis unavailable
    log.error('Redis unavailable — WebAuthn challenge storage rejected in production');
    throw new Error('WebAuthn requires Redis in production');
  } else {
    // Memory fallback for development only
    const now = Date.now();
    for (const [k, v] of memoryFallbackStore.entries()) {
      if (v.expires < now) memoryFallbackStore.delete(k);
    }
    memoryFallbackStore.set(key, {
      challenge,
      expires: now + CHALLENGE_TTL_SECONDS * 1000,
    });
    log.warn('Using memory fallback for challenge storage — development only');
  }
}

/**
 * Get stored WebAuthn challenge (Redis-first, rejects in production without Redis)
 */
async function getChallenge(key: string): Promise<string | null> {
  const redisKey = `webauthn:register:${key}`;

  if (isRedisAvailable()) {
    const data = await cacheGet<{ challenge: string }>(redisKey);
    return data?.challenge || null;
  } else if (IS_PRODUCTION) {
    log.error('Redis unavailable — cannot retrieve WebAuthn challenge in production');
    return null;
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
  const redisKey = `webauthn:register:${key}`;

  if (isRedisAvailable()) {
    await cacheDelete(redisKey);
  } else if (!IS_PRODUCTION) {
    memoryFallbackStore.delete(key);
  }
}

/**
 * POST - Generate registration options for a new passkey
 */
export async function POST(_request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession();
    if (!session?.user) {
      return errors.unauthorized();
    }

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `webauthn:register:${session.user.id}`,
      rateLimits.auth
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const supabase = getSupabaseAdmin();
    const userId = session.user.id;
    const userEmail = session.user.email || '';

    // Get user's display name
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    const userName = userData?.full_name || userEmail;

    // Get existing passkeys to exclude
    const { data: existingPasskeys } = await supabase
      .from('user_passkeys')
      .select('*')
      .eq('user_id', userId);

    // Generate registration options
    const options = await generatePasskeyRegistrationOptions(
      userId,
      userEmail,
      userName,
      (existingPasskeys || []) as StoredPasskey[]
    );

    // Store challenge in Redis for verification (expires in 5 minutes)
    await storeChallenge(userId, options.challenge);

    return successResponse(options);
  } catch (error) {
    log.error('Passkey registration options error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}

/**
 * PUT - Verify registration response and save passkey
 */
export async function PUT(request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession();
    if (!session?.user) {
      return errors.unauthorized();
    }

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `webauthn:verify:${session.user.id}`,
      rateLimits.auth
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const userId = session.user.id;

    // Get stored challenge from Redis
    const storedChallenge = await getChallenge(userId);
    if (!storedChallenge) {
      return errors.badRequest('Challenge expired, please try again');
    }

    // Parse request body
    const body = await request.json();
    const { response, deviceName: customDeviceName } = body as {
      response: RegistrationResponseJSON;
      deviceName?: string;
    };

    // Verify the registration response
    const verification = await verifyPasskeyRegistration(response, storedChallenge);

    if (!verification.verified || !verification.registrationInfo) {
      return errors.badRequest('Verification failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Detect device name from user agent
    const userAgent = request.headers.get('user-agent') || '';
    const deviceName = customDeviceName || getDeviceNameFromUserAgent(userAgent);

    const supabase = getSupabaseAdmin();
    // Store the passkey in database
    const { error: insertError } = await supabase.from('user_passkeys').insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: uint8ArrayToBase64URL(credential.publicKey),
      counter: credential.counter,
      device_name: deviceName,
      transports: credential.transports || [],
    });

    if (insertError) {
      log.error('Failed to save passkey:', { error: insertError ?? 'Unknown error' });
      return errors.serverError();
    }

    // Clear the challenge from Redis
    await deleteChallenge(userId);

    // CHAT-015: Audit log
    auditLog({
      userId,
      action: 'auth.passkey_register',
      resourceType: 'passkey',
      resourceId: credential.id,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      metadata: { deviceName, deviceType: credentialDeviceType, backedUp: credentialBackedUp },
    }).catch(() => {});

    return successResponse({
      success: true,
      message: 'Passkey registered successfully',
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
  } catch (error) {
    log.error('Passkey registration error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
