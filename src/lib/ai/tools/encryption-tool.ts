/**
 * ENCRYPTION TOOL
 *
 * Encryption utilities: symmetric ciphers, key derivation,
 * encoding/decoding, and cryptographic operations.
 *
 * Part of TIER CYBERSECURITY - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// SIMPLE CIPHERS (Educational)
// ============================================================================

function caesarCipher(text: string, shift: number, decrypt: boolean = false): string {
  const actualShift = decrypt ? -shift : shift;
  return text
    .split('')
    .map((char) => {
      if (char.match(/[a-z]/i)) {
        const base = char === char.toUpperCase() ? 65 : 97;
        return String.fromCharCode(((char.charCodeAt(0) - base + actualShift + 26) % 26) + base);
      }
      return char;
    })
    .join('');
}

function vigenereCipher(text: string, key: string, decrypt: boolean = false): string {
  const keyUpper = key.toUpperCase();
  let keyIndex = 0;

  return text
    .split('')
    .map((char) => {
      if (char.match(/[a-z]/i)) {
        const base = char === char.toUpperCase() ? 65 : 97;
        const shift = keyUpper.charCodeAt(keyIndex % keyUpper.length) - 65;
        const actualShift = decrypt ? -shift : shift;
        keyIndex++;
        return String.fromCharCode(((char.charCodeAt(0) - base + actualShift + 26) % 26) + base);
      }
      return char;
    })
    .join('');
}

function rot13(text: string): string {
  return caesarCipher(text, 13);
}

function atbashCipher(text: string): string {
  return text
    .split('')
    .map((char) => {
      if (char.match(/[a-z]/)) {
        return String.fromCharCode(122 - (char.charCodeAt(0) - 97));
      }
      if (char.match(/[A-Z]/)) {
        return String.fromCharCode(90 - (char.charCodeAt(0) - 65));
      }
      return char;
    })
    .join('');
}

// ============================================================================
// XOR OPERATIONS
// ============================================================================

function xorStrings(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

export function xorHex(hexData: string, keyHex: string): string {
  const data = hexData.match(/.{2}/g) || [];
  const key = keyHex.match(/.{2}/g) || [];

  return data
    .map((byte, i) => {
      const xored = parseInt(byte, 16) ^ parseInt(key[i % key.length], 16);
      return xored.toString(16).padStart(2, '0');
    })
    .join('');
}

// ============================================================================
// ENCODING/DECODING
// ============================================================================

function base64Encode(text: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text).toString('base64');
  }
  return btoa(text);
}

function base64Decode(encoded: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }
  return atob(encoded);
}

function hexEncode(text: string): string {
  return text
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

function hexDecode(hex: string): string {
  const bytes = hex.match(/.{2}/g) || [];
  return bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join('');
}

function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

function urlDecode(encoded: string): string {
  return decodeURIComponent(encoded);
}

// ============================================================================
// KEY DERIVATION (Simplified)
// ============================================================================

function simpleKDF(password: string, salt: string, iterations: number): string {
  // Simple PBKDF2-like function for demonstration
  let key = password + salt;
  for (let i = 0; i < iterations; i++) {
    let hash = 0;
    for (let j = 0; j < key.length; j++) {
      hash = (hash << 5) - hash + key.charCodeAt(j);
      hash = hash & hash;
    }
    key = Math.abs(hash).toString(16) + key.substring(0, 16);
  }
  return key.substring(0, 32);
}

// ============================================================================
// PASSWORD ANALYSIS
// ============================================================================

function analyzePassword(password: string): {
  length: number;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  entropy: number;
  strength: string;
} {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let charsetSize = 0;
  if (hasLower) charsetSize += 26;
  if (hasUpper) charsetSize += 26;
  if (hasDigit) charsetSize += 10;
  if (hasSpecial) charsetSize += 32;

  const entropy = password.length * Math.log2(charsetSize || 1);

  let strength = 'Very Weak';
  if (entropy >= 60) strength = 'Very Strong';
  else if (entropy >= 40) strength = 'Strong';
  else if (entropy >= 28) strength = 'Moderate';
  else if (entropy >= 18) strength = 'Weak';

  return {
    length: password.length,
    hasUpper,
    hasLower,
    hasDigit,
    hasSpecial,
    entropy: Math.round(entropy * 10) / 10,
    strength,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const encryptionTool: UnifiedTool = {
  name: 'encryption',
  description: `Encryption and encoding utilities.

Operations:
- caesar: Caesar cipher encryption/decryption
- vigenere: Vigenère cipher encryption/decryption
- rot13: ROT13 transformation
- atbash: Atbash cipher
- xor: XOR encryption
- base64: Base64 encode/decode
- hex: Hex encode/decode
- url: URL encode/decode
- password: Password strength analysis
- kdf: Simple key derivation`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'caesar',
          'vigenere',
          'rot13',
          'atbash',
          'xor',
          'base64',
          'hex',
          'url',
          'password',
          'kdf',
        ],
        description: 'Encryption operation',
      },
      text: { type: 'string', description: 'Text to process' },
      key: { type: 'string', description: 'Encryption key' },
      shift: { type: 'number', description: 'Caesar cipher shift amount' },
      decrypt: { type: 'boolean', description: 'Decrypt instead of encrypt' },
      salt: { type: 'string', description: 'Salt for key derivation' },
      iterations: { type: 'number', description: 'KDF iterations' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeEncryption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text = 'Hello World', decrypt = false } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'caesar': {
        const { shift = 3 } = args;
        const output = caesarCipher(text, shift, decrypt);

        result = {
          operation: 'caesar',
          mode: decrypt ? 'decrypt' : 'encrypt',
          input: text,
          shift: shift,
          output: output,
          all_shifts: decrypt
            ? undefined
            : Array.from({ length: 26 }, (_, i) => ({
                shift: i,
                result: caesarCipher(text, i),
              })),
        };
        break;
      }

      case 'vigenere': {
        const { key = 'KEY' } = args;
        const output = vigenereCipher(text, key, decrypt);

        result = {
          operation: 'vigenere',
          mode: decrypt ? 'decrypt' : 'encrypt',
          input: text,
          key: key,
          output: output,
          note: 'Polyalphabetic substitution cipher',
        };
        break;
      }

      case 'rot13': {
        const output = rot13(text);

        result = {
          operation: 'rot13',
          input: text,
          output: output,
          note: 'ROT13 is its own inverse - apply twice to get original',
        };
        break;
      }

      case 'atbash': {
        const output = atbashCipher(text);

        result = {
          operation: 'atbash',
          input: text,
          output: output,
          note: 'Atbash is its own inverse - apply twice to get original',
        };
        break;
      }

      case 'xor': {
        const { key = 'secret' } = args;
        const output = xorStrings(text, key);
        const outputHex = hexEncode(output);

        result = {
          operation: 'xor',
          input: text,
          key: key,
          output_hex: outputHex,
          decrypted: xorStrings(output, key),
          note: 'XOR is symmetric - same operation encrypts and decrypts',
        };
        break;
      }

      case 'base64': {
        if (decrypt) {
          const decoded = base64Decode(text);
          result = {
            operation: 'base64',
            mode: 'decode',
            input: text,
            output: decoded,
          };
        } else {
          const encoded = base64Encode(text);
          result = {
            operation: 'base64',
            mode: 'encode',
            input: text,
            output: encoded,
            url_safe: encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          };
        }
        break;
      }

      case 'hex': {
        if (decrypt) {
          const decoded = hexDecode(text);
          result = {
            operation: 'hex',
            mode: 'decode',
            input: text,
            output: decoded,
          };
        } else {
          const encoded = hexEncode(text);
          result = {
            operation: 'hex',
            mode: 'encode',
            input: text,
            output: encoded,
            output_uppercase: encoded.toUpperCase(),
          };
        }
        break;
      }

      case 'url': {
        if (decrypt) {
          const decoded = urlDecode(text);
          result = {
            operation: 'url',
            mode: 'decode',
            input: text,
            output: decoded,
          };
        } else {
          const encoded = urlEncode(text);
          result = {
            operation: 'url',
            mode: 'encode',
            input: text,
            output: encoded,
          };
        }
        break;
      }

      case 'password': {
        const analysis = analyzePassword(text);

        result = {
          operation: 'password',
          password_masked: '*'.repeat(text.length),
          analysis: analysis,
          recommendations: [
            analysis.length < 12 ? 'Use at least 12 characters' : null,
            !analysis.hasUpper ? 'Add uppercase letters' : null,
            !analysis.hasLower ? 'Add lowercase letters' : null,
            !analysis.hasDigit ? 'Add numbers' : null,
            !analysis.hasSpecial ? 'Add special characters' : null,
          ].filter(Boolean),
          time_to_crack:
            analysis.entropy < 28
              ? 'Minutes to hours'
              : analysis.entropy < 40
                ? 'Days to weeks'
                : analysis.entropy < 60
                  ? 'Years'
                  : 'Centuries+',
        };
        break;
      }

      case 'kdf': {
        const { key = 'password', salt = 'random_salt', iterations = 1000 } = args;
        const derived = simpleKDF(key, salt, iterations);

        result = {
          operation: 'kdf',
          password_length: key.length,
          salt: salt,
          iterations: iterations,
          derived_key: derived,
          note: 'Simplified KDF for demonstration - use PBKDF2/Argon2 in production',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Encryption Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      isError: true,
    };
  }
}

export function isEncryptionAvailable(): boolean {
  return true;
}
