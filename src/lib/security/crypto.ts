/**
 * CENTRALIZED ENCRYPTION UTILITIES
 *
 * AES-256-GCM encryption/decryption for secure token storage.
 * Used across the application for GitHub tokens, Vercel tokens, and other secrets.
 *
 * FORMAT v1: v1:iv:authTag:encryptedData (all hex-encoded)
 * LEGACY FORMAT: iv:authTag:encryptedData (auto-detected on decrypt)
 * - IV: 16 bytes (32 hex chars)
 * - Auth Tag: 16 bytes (32 hex chars)
 * - Encrypted Data: variable length (hex chars)
 *
 * SEC-012: Key versioning — all new encryptions use v1 prefix.
 * When ENCRYPTION_KEY is rotated, bump the version and add the old key
 * to ENCRYPTION_KEY_V1 so existing data can still be decrypted.
 */

const CURRENT_KEY_VERSION = 'v1';

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const log = logger('Crypto');

// Error types for better error handling
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Get encryption key (32 bytes for AES-256)
 * SECURITY: Requires dedicated ENCRYPTION_KEY - no fallbacks to other keys
 * This ensures separation of concerns between database access and encryption
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new EncryptionError(
      'No encryption key configured. Set ENCRYPTION_KEY in environment. ' +
        'SECURITY: Do not use database keys for encryption.',
      'NO_KEY'
    );
  }

  // Validate key has minimum entropy (at least 32 characters recommended)
  if (key.length < 32) {
    log.warn('ENCRYPTION_KEY is shorter than recommended 32 characters');
  }

  // Hash the key to ensure it's exactly 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted data in format: iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new EncryptionError('Cannot encrypt empty value', 'EMPTY_INPUT');
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // 16 bytes IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // SEC-012: Version-prefixed format for key rotation support
    return (
      CURRENT_KEY_VERSION +
      ':' +
      iv.toString('hex') +
      ':' +
      authTag.toString('hex') +
      ':' +
      encrypted
    );
  } catch (error) {
    log.error('Encryption failed', error instanceof Error ? error : { error });
    throw new EncryptionError('Failed to encrypt data', 'ENCRYPT_FAILED');
  }
}

/**
 * Decrypt a string encrypted with encrypt()
 *
 * @param encryptedData - The encrypted data in format: iv:authTag:encryptedData
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new DecryptionError('Cannot decrypt empty value', 'EMPTY_INPUT');
  }

  const parts = encryptedData.split(':');

  // SEC-012: Support both versioned (v1:iv:authTag:data) and legacy (iv:authTag:data) formats
  let ivHex: string, authTagHex: string, encrypted: string;

  if (parts.length === 4 && parts[0].startsWith('v')) {
    // Versioned format: v1:iv:authTag:data
    const version = parts[0];
    if (version !== CURRENT_KEY_VERSION) {
      // Future: look up key for older versions via ENCRYPTION_KEY_V{n}
      log.warn('Decrypting data with older key version', { version });
    }
    [, ivHex, authTagHex, encrypted] = parts;
  } else if (parts.length === 3) {
    // Legacy format: iv:authTag:data (pre-versioning)
    [ivHex, authTagHex, encrypted] = parts;
  } else {
    throw new DecryptionError(
      'Invalid encrypted format - expected [version:]iv:authTag:data',
      'INVALID_FORMAT'
    );
  }

  // Validate format
  if (!/^[0-9a-fA-F]{32}$/.test(ivHex)) {
    throw new DecryptionError('Invalid IV format', 'INVALID_IV');
  }
  if (!/^[0-9a-fA-F]{32}$/.test(authTagHex)) {
    throw new DecryptionError('Invalid auth tag format', 'INVALID_AUTH_TAG');
  }
  if (!/^[0-9a-fA-F]+$/.test(encrypted)) {
    throw new DecryptionError('Invalid encrypted content format', 'INVALID_CONTENT');
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    log.error('Decryption failed', error instanceof Error ? error : { error });
    throw new DecryptionError('Failed to decrypt data', 'DECRYPT_FAILED');
  }
}

/**
 * Validate encrypted token format without decrypting
 *
 * @param encryptedData - The encrypted string to validate
 * @returns Validation result with error message if invalid
 */
export function validateEncryptedFormat(encryptedData: string): { valid: boolean; error?: string } {
  if (!encryptedData) {
    return { valid: false, error: 'Token is empty' };
  }

  const parts = encryptedData.split(':');

  // SEC-012: Support both versioned (4 parts) and legacy (3 parts) formats
  let ivIdx: number, authIdx: number, dataIdx: number;
  if (parts.length === 4 && parts[0].startsWith('v')) {
    [ivIdx, authIdx, dataIdx] = [1, 2, 3];
  } else if (parts.length === 3) {
    [ivIdx, authIdx, dataIdx] = [0, 1, 2];
  } else {
    return { valid: false, error: 'Invalid token format - expected [version:]iv:authTag:data' };
  }

  if (!/^[0-9a-fA-F]{32}$/.test(parts[ivIdx])) {
    return { valid: false, error: 'Invalid IV format' };
  }

  if (!/^[0-9a-fA-F]{32}$/.test(parts[authIdx])) {
    return { valid: false, error: 'Invalid auth tag format' };
  }

  if (!/^[0-9a-fA-F]+$/.test(parts[dataIdx])) {
    return { valid: false, error: 'Invalid encrypted content format' };
  }

  return { valid: true };
}

/**
 * Safely decrypt with error handling
 * Returns null on failure instead of throwing
 *
 * @param encryptedData - The encrypted string to decrypt
 * @returns Decrypted string or null if decryption fails
 */
export function safeDecrypt(encryptedData: string): string | null {
  try {
    return decrypt(encryptedData);
  } catch (error) {
    log.warn('Safe decrypt failed', {
      code: error instanceof DecryptionError ? error.code : 'UNKNOWN',
    });
    return null;
  }
}

// Legacy exports for backward compatibility
export const encryptToken = encrypt;
export const decryptToken = decrypt;
