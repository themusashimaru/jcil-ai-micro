/**
 * TEST-002: Encryption/Decryption Tests
 *
 * Tests AES-256-GCM encryption with SEC-012 key versioning.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Set encryption key for tests
process.env.ENCRYPTION_KEY = 'test-encryption-key-that-is-long-enough-for-security';

import {
  encrypt,
  decrypt,
  safeDecrypt,
  validateEncryptedFormat,
  EncryptionError,
  DecryptionError,
} from './crypto';

describe('Crypto Module', () => {
  describe('encrypt', () => {
    it('should encrypt a plaintext string', () => {
      const result = encrypt('hello world');
      expect(result).toBeTruthy();
      expect(result).not.toBe('hello world');
    });

    it('should produce versioned format (v1:iv:tag:data)', () => {
      const result = encrypt('test data');
      const parts = result.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const a = encrypt('same input');
      const b = encrypt('same input');
      expect(a).not.toBe(b);
    });

    it('should throw on empty input', () => {
      expect(() => encrypt('')).toThrow(EncryptionError);
    });
  });

  describe('decrypt', () => {
    it('should decrypt what encrypt produces', () => {
      const encrypted = encrypt('secret data');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('secret data');
    });

    it('should handle special characters', () => {
      const special = 'sk-ant-api03-test_KEY!@#$%^&*()';
      const encrypted = encrypt(special);
      expect(decrypt(encrypted)).toBe(special);
    });

    it('should handle unicode', () => {
      const unicode = '日本語テスト 🔐';
      const encrypted = encrypt(unicode);
      expect(decrypt(encrypted)).toBe(unicode);
    });

    it('should handle long strings', () => {
      const long = 'a'.repeat(10000);
      const encrypted = encrypt(long);
      expect(decrypt(encrypted)).toBe(long);
    });

    it('should throw on empty input', () => {
      expect(() => decrypt('')).toThrow(DecryptionError);
    });

    it('should throw on invalid format', () => {
      expect(() => decrypt('not:valid')).toThrow(DecryptionError);
      expect(() => decrypt('only-one-part')).toThrow(DecryptionError);
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('original');
      // Tamper with the encrypted data
      const parts = encrypted.split(':');
      parts[3] = parts[3].replace(/[0-9a-f]/, 'x'); // Replace a hex char
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('should still decrypt legacy format (3 parts without version)', () => {
      // Simulate legacy format by removing the v1 prefix
      const encrypted = encrypt('legacy test');
      const parts = encrypted.split(':');
      // Remove version prefix to simulate legacy format
      const legacyFormat = parts.slice(1).join(':');
      const decrypted = decrypt(legacyFormat);
      expect(decrypted).toBe('legacy test');
    });
  });

  describe('safeDecrypt', () => {
    it('should return decrypted value on success', () => {
      const encrypted = encrypt('safe test');
      expect(safeDecrypt(encrypted)).toBe('safe test');
    });

    it('should return null on failure instead of throwing', () => {
      expect(safeDecrypt('invalid:data')).toBeNull();
      expect(safeDecrypt('')).toBeNull();
    });
  });

  describe('validateEncryptedFormat', () => {
    it('should validate versioned format', () => {
      const encrypted = encrypt('test');
      expect(validateEncryptedFormat(encrypted).valid).toBe(true);
    });

    it('should validate legacy 3-part format', () => {
      const encrypted = encrypt('test');
      // Strip version prefix
      const legacy = encrypted.split(':').slice(1).join(':');
      expect(validateEncryptedFormat(legacy).valid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateEncryptedFormat('');
      expect(result.valid).toBe(false);
    });

    it('should reject invalid part count', () => {
      const result = validateEncryptedFormat('only:two');
      expect(result.valid).toBe(false);
    });

    it('should reject invalid IV format', () => {
      const result = validateEncryptedFormat('v1:not-hex-32-chars:' + 'a'.repeat(32) + ':data');
      expect(result.valid).toBe(false);
    });
  });
});
