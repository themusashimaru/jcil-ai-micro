/**
 * SIGNED DOWNLOAD TOKENS
 *
 * HMAC-SHA256 signed tokens for document download URLs.
 * Prevents token forgery — attackers cannot craft valid tokens
 * to access other users' files.
 *
 * Token format: base64url(JSON payload) + "." + base64url(HMAC signature)
 *
 * Security audit fix: 2026-03-25
 */

import crypto from 'crypto';

/**
 * Get the HMAC signing key.
 * Uses ENCRYPTION_KEY (already required for the app) or a dedicated key.
 */
function getSigningKey(): Buffer {
  const key = process.env.DOWNLOAD_TOKEN_SECRET || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('DOWNLOAD_TOKEN_SECRET or ENCRYPTION_KEY must be set');
  }
  // Derive a dedicated key for download tokens using HKDF-like approach
  return crypto.createHash('sha256').update(`download-token:${key}`).digest();
}

interface TokenPayload {
  /** User ID */
  u: string;
  /** Filename */
  f: string;
  /** File type */
  t: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'txt';
  /** Issued at (unix seconds) */
  iat: number;
}

/**
 * Create a signed download token.
 */
export function createDownloadToken(
  userId: string,
  filename: string,
  type: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'txt'
): string {
  const payload: TokenPayload = {
    u: userId,
    f: filename,
    t: type,
    iat: Math.floor(Date.now() / 1000),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode a signed download token.
 * Returns null if the token is invalid, tampered, or expired.
 */
export function verifyDownloadToken(
  token: string
): {
  userId: string;
  filename: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'txt';
} | null {
  const parts = token.split('.');

  // Support both new signed format (payload.signature) and legacy unsigned format
  if (parts.length === 2) {
    // New signed format
    const [payloadB64, providedSignature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', getSigningKey())
      .update(payloadB64)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
      return null;
    }

    try {
      const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      if (!payload.u || !payload.f || !payload.t) {
        return null;
      }

      // Reject tokens older than 2 hours
      const maxAge = 2 * 60 * 60; // 2 hours in seconds
      const now = Math.floor(Date.now() / 1000);
      if (payload.iat && now - payload.iat > maxAge) {
        return null;
      }

      return { userId: payload.u, filename: payload.f, type: payload.t };
    } catch {
      return null;
    }
  }

  // Legacy unsigned tokens are no longer accepted (security risk)
  return null;
}
