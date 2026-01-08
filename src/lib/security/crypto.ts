/**
 * CENTRALIZED ENCRYPTION UTILITIES
 *
 * AES-256-GCM encryption/decryption for secure token storage.
 * Used across the application for GitHub tokens, Vercel tokens, and other secrets.
 *
 * FORMAT: iv:authTag:encryptedData (all hex-encoded)
 * - IV: 16 bytes (32 hex chars)
 * - Auth Tag: 16 bytes (32 hex chars)
 * - Encrypted Data: variable length (hex chars)
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const log = logger('Crypto');

// Error types for better error handling
export class EncryptionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Get encryption key (32 bytes for AES-256)
 * Uses ENCRYPTION_KEY from environment, falls back to SUPABASE_SERVICE_ROLE_KEY
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!key) {
    throw new EncryptionError(
      'No encryption key configured. Set ENCRYPTION_KEY in environment.',
      'NO_KEY'
    );
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

    // Combine IV + authTag + encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
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
  if (parts.length !== 3) {
    throw new DecryptionError(
      'Invalid encrypted format - expected iv:authTag:data',
      'INVALID_FORMAT'
    );
  }

  const [ivHex, authTagHex, encrypted] = parts;

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
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format - expected 3 parts separated by colons' };
  }

  // Validate IV (should be 32 hex chars = 16 bytes)
  if (!/^[0-9a-fA-F]{32}$/.test(parts[0])) {
    return { valid: false, error: 'Invalid IV format' };
  }

  // Validate auth tag (should be 32 hex chars = 16 bytes)
  if (!/^[0-9a-fA-F]{32}$/.test(parts[1])) {
    return { valid: false, error: 'Invalid auth tag format' };
  }

  // Validate encrypted content (should be hex)
  if (!/^[0-9a-fA-F]+$/.test(parts[2])) {
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
