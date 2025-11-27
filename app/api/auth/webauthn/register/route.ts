/**
 * WebAuthn Passkey Registration API
 * POST /api/auth/webauthn/register - Get registration options
 * PUT /api/auth/webauthn/register - Verify and save new passkey
 */

import { NextRequest, NextResponse } from 'next/server';
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

// Use service role for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory challenge store (in production, use Redis or database)
const challengeStore = new Map<string, { challenge: string; expires: number }>();

/**
 * POST - Generate registration options for a new passkey
 */
export async function POST(_request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Store challenge for verification (expires in 5 minutes)
    challengeStore.set(userId, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });

    // Clean up expired challenges
    for (const [key, value] of challengeStore.entries()) {
      if (value.expires < Date.now()) {
        challengeStore.delete(key);
      }
    }

    return NextResponse.json(options);
  } catch (error) {
    console.error('Passkey registration options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get stored challenge
    const storedChallenge = challengeStore.get(userId);
    if (!storedChallenge || storedChallenge.expires < Date.now()) {
      challengeStore.delete(userId);
      return NextResponse.json(
        { error: 'Challenge expired, please try again' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { response, deviceName: customDeviceName } = body as {
      response: RegistrationResponseJSON;
      deviceName?: string;
    };

    // Verify the registration response
    const verification = await verifyPasskeyRegistration(
      response,
      storedChallenge.challenge
    );

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Detect device name from user agent
    const userAgent = request.headers.get('user-agent') || '';
    const deviceName = customDeviceName || getDeviceNameFromUserAgent(userAgent);

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
      console.error('Failed to save passkey:', insertError);
      return NextResponse.json(
        { error: 'Failed to save passkey' },
        { status: 500 }
      );
    }

    // Clear the challenge
    challengeStore.delete(userId);

    return NextResponse.json({
      success: true,
      message: 'Passkey registered successfully',
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
  } catch (error) {
    console.error('Passkey registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register passkey' },
      { status: 500 }
    );
  }
}
