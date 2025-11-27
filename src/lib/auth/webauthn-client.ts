/**
 * WebAuthn Client-Side Helpers
 * Browser APIs for passkey registration and authentication
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { createBrowserClient } from '@/lib/supabase/client';

export { browserSupportsWebAuthn, platformAuthenticatorIsAvailable };

/**
 * Check if the device supports passkeys (Face ID, Touch ID, etc.)
 */
export async function supportsPasskeys(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) {
    return false;
  }
  return await platformAuthenticatorIsAvailable();
}

/**
 * Get a friendly name for the biometric type available
 */
export function getBiometricName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Face ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'Fingerprint';
  if (/Windows/.test(ua)) return 'Windows Hello';
  return 'Biometric Login';
}

/**
 * Register a new passkey for the current user
 */
export async function registerPasskey(): Promise<{ success: boolean; error?: string }> {
  try {
    // Get registration options from server
    const optionsRes = await fetch('/api/auth/webauthn/register', {
      method: 'POST',
      credentials: 'include',
    });

    if (!optionsRes.ok) {
      const error = await optionsRes.json();
      return { success: false, error: error.error || 'Failed to get registration options' };
    }

    const options: PublicKeyCredentialCreationOptionsJSON = await optionsRes.json();

    // Start the WebAuthn registration ceremony
    const credential = await startRegistration({ optionsJSON: options });

    // Send the credential to the server to verify and store
    const verifyRes = await fetch('/api/auth/webauthn/register', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ response: credential }),
    });

    if (!verifyRes.ok) {
      const error = await verifyRes.json();
      return { success: false, error: error.error || 'Failed to register passkey' };
    }

    return { success: true };
  } catch (error: unknown) {
    // Handle user cancellation
    if (error instanceof Error && error.name === 'NotAllowedError') {
      return { success: false, error: 'Registration was cancelled' };
    }
    console.error('Passkey registration error:', error);
    return { success: false, error: 'Failed to register passkey' };
  }
}

/**
 * Authenticate with a passkey
 */
export async function authenticateWithPasskey(
  email?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get authentication options from server
    const optionsRes = await fetch('/api/auth/webauthn/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!optionsRes.ok) {
      const error = await optionsRes.json();
      return { success: false, error: error.error || 'Failed to get authentication options' };
    }

    const optionsData = await optionsRes.json();
    const { challengeKey, ...options } = optionsData as PublicKeyCredentialRequestOptionsJSON & {
      challengeKey: string;
    };

    // Start the WebAuthn authentication ceremony
    const credential = await startAuthentication({ optionsJSON: options });

    // Send the credential to the server to verify
    const verifyRes = await fetch('/api/auth/webauthn/authenticate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: credential, challengeKey }),
    });

    if (!verifyRes.ok) {
      const error = await verifyRes.json();
      return { success: false, error: error.error || 'Authentication failed' };
    }

    const result = await verifyRes.json();

    // Use the token_hash to verify and create session
    if (result.token && result.user?.email) {
      const supabase = createBrowserClient();

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: result.token,
        type: 'magiclink',
      });

      if (verifyError) {
        console.error('OTP verification error:', verifyError);
        return { success: false, error: 'Failed to create session' };
      }

      return { success: true };
    }

    return { success: false, error: 'Invalid response from server' };
  } catch (error: unknown) {
    // Handle user cancellation
    if (error instanceof Error && error.name === 'NotAllowedError') {
      return { success: false, error: 'Authentication was cancelled' };
    }
    console.error('Passkey authentication error:', error);
    return { success: false, error: 'Failed to authenticate' };
  }
}

/**
 * Get user's registered passkeys
 */
export async function getPasskeys(): Promise<{
  passkeys: Array<{
    id: string;
    device_name: string;
    created_at: string;
    last_used_at: string | null;
  }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/webauthn/passkeys', {
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      return { passkeys: [], error: error.error };
    }

    return await res.json();
  } catch {
    return { passkeys: [], error: 'Failed to fetch passkeys' };
  }
}

/**
 * Delete a passkey
 */
export async function deletePasskey(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/auth/webauthn/passkeys?id=${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      return { success: false, error: error.error };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete passkey' };
  }
}
