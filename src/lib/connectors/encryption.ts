/**
 * TOKEN ENCRYPTION UTILITIES
 * Encrypts/decrypts API tokens for secure storage
 * Uses AES-256-GCM encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get encryption key from environment
 * Falls back to a derived key from SUPABASE_SERVICE_ROLE_KEY if not set
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CONNECTOR_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('No encryption key available. Set CONNECTOR_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY');
  }

  // Derive a 32-byte key using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a token for storage
 * Returns base64 encoded string: iv:authTag:encryptedData
 */
export function encryptToken(plainToken: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainToken, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine iv:authTag:encrypted as base64
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a stored token
 * Expects base64 encoded string: iv:authTag:encryptedData
 */
export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();

  const parts = encryptedToken.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Mask a token for display (show only last 4 chars)
 */
export function maskToken(token: string): string {
  if (token.length <= 4) {
    return '••••';
  }
  return '••••••••' + token.slice(-4);
}
