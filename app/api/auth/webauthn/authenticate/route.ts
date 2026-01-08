/**
 * WebAuthn Passkey Authentication API
 * POST /api/auth/webauthn/authenticate - Get authentication options
 * PUT /api/auth/webauthn/authenticate - Verify passkey and create session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  type StoredPasskey,
  type AuthenticationResponseJSON,
} from '@/lib/auth/webauthn';
import { logger } from '@/lib/logger';

const log = logger('WebAuthnAuthenticate');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create Supabase client inside functions to avoid build-time initialization
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// In-memory challenge store (in production, use Redis or database)
const challengeStore = new Map<string, { challenge: string; expires: number }>();

/**
 * POST - Generate authentication options
 * Can be called with or without email (for discoverable credentials)
 */
export async function POST(request: NextRequest) {
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

    // Store challenge (use a session ID or random key for anonymous auth)
    const challengeKey = email || `anon_${options.challenge.slice(0, 16)}`;
    challengeStore.set(challengeKey, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });

    // Clean up expired challenges
    for (const [key, value] of challengeStore.entries()) {
      if (value.expires < Date.now()) {
        challengeStore.delete(key);
      }
    }

    return NextResponse.json({
      ...options,
      challengeKey, // Return this so client can send it back
    });
  } catch (error) {
    log.error('Passkey auth options error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Verify authentication response and create session
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { response, challengeKey } = body as {
      response: AuthenticationResponseJSON;
      challengeKey: string;
    };

    // Get stored challenge
    const storedChallenge = challengeStore.get(challengeKey);
    if (!storedChallenge || storedChallenge.expires < Date.now()) {
      challengeStore.delete(challengeKey);
      return NextResponse.json(
        { error: 'Challenge expired, please try again' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Passkey not found' },
        { status: 404 }
      );
    }

    // Verify the authentication response
    const verification = await verifyPasskeyAuthentication(
      response,
      storedChallenge.challenge,
      passkey as StoredPasskey
    );

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    // Update the counter to prevent replay attacks
    await supabase
      .from('user_passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', passkey.id);

    // Clear the challenge
    challengeStore.delete(challengeKey);

    // Get the user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', passkey.user_id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate a magic link for the user
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.email,
    });

    if (authError || !authData) {
      log.error('Failed to generate auth link', { error: authError ?? 'Unknown error' });
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Extract the token hash from the action link
    // The action link format: https://xxx.supabase.co/auth/v1/verify?token=TOKEN&type=magiclink&redirect_to=...
    const actionLink = authData.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Parse the token from the URL
    const url = new URL(actionLink);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to extract token' },
        { status: 500 }
      );
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userData.id);

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}
