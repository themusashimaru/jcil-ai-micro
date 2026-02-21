/**
 * WebAuthn/Passkey Server-Side Helpers
 * Handles registration and authentication for Face ID, Touch ID, Windows Hello
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

// Configuration
const RP_NAME = 'Slingshot 2.0';
const RP_ID =
  process.env.WEBAUTHN_RP_ID || (process.env.NODE_ENV === 'production' ? 'jcil.ai' : 'localhost');
const ORIGIN = process.env.NODE_ENV === 'production' ? 'https://jcil.ai' : 'http://localhost:3000';

// SEC-015: Allowed origins from env var — no hardcoded preview URLs
const ALLOWED_ORIGINS: string[] = process.env.WEBAUTHN_ALLOWED_ORIGINS
  ? process.env.WEBAUTHN_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : [ORIGIN];

export interface StoredPasskey {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name: string;
  transports: AuthenticatorTransportFuture[];
  created_at: string;
  last_used_at: string | null;
}

/**
 * Generate options for registering a new passkey
 */
export async function generatePasskeyRegistrationOptions(
  userId: string,
  userEmail: string,
  userName: string,
  existingPasskeys: StoredPasskey[] = []
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(userId),
    userName: userEmail,
    userDisplayName: userName || userEmail,
    // Prevent re-registration of existing authenticators
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.credential_id,
      transports: passkey.transports,
    })),
    authenticatorSelection: {
      // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
      authenticatorAttachment: 'platform',
      // Require user verification (biometric or PIN)
      userVerification: 'required',
      // Create a resident key (discoverable credential) for passwordless login
      residentKey: 'required',
    },
    // Prefer ES256 algorithm
    supportedAlgorithmIDs: [-7, -257],
  });

  return options;
}

/**
 * Verify a registration response and return credential data to store
 */
export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ALLOWED_ORIGINS,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });

  return verification;
}

/**
 * Generate options for authenticating with a passkey
 */
export async function generatePasskeyAuthenticationOptions(
  userPasskeys?: StoredPasskey[]
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    // If we know the user, provide their credentials
    // If not (passwordless), leave empty for discoverable credentials
    allowCredentials: userPasskeys?.map((passkey) => ({
      id: passkey.credential_id,
      transports: passkey.transports,
    })),
  });

  return options;
}

/**
 * Verify an authentication response
 */
export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  storedPasskey: StoredPasskey
): Promise<VerifiedAuthenticationResponse> {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ALLOWED_ORIGINS,
    expectedRPID: RP_ID,
    credential: {
      id: storedPasskey.credential_id,
      publicKey: base64URLToUint8Array(storedPasskey.public_key),
      counter: storedPasskey.counter,
      transports: storedPasskey.transports,
    },
    requireUserVerification: true,
  });

  return verification;
}

/**
 * Detect device name from user agent
 */
export function getDeviceNameFromUserAgent(userAgent: string): string {
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) return 'Mac';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Android')) return 'Android Device';
  if (userAgent.includes('Linux')) return 'Linux Device';
  return 'Unknown Device';
}

/**
 * Convert base64url string to Uint8Array
 */
export function base64URLToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64url string
 */
export function uint8ArrayToBase64URL(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Re-export types for convenience
export type { RegistrationResponseJSON, AuthenticationResponseJSON };
export type PublicKeyCredentialCreationOptionsJSON = Awaited<
  ReturnType<typeof generateRegistrationOptions>
>;
export type PublicKeyCredentialRequestOptionsJSON = Awaited<
  ReturnType<typeof generateAuthenticationOptions>
>;
