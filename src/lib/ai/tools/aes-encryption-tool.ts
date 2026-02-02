/**
 * AES-ENCRYPTION TOOL
 * Real AES-128/192/256 encryption implementation
 * Educational implementation with full S-box, key expansion, and block cipher modes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const aesencryptionTool: UnifiedTool = {
  name: 'aes_encryption',
  description: 'AES-128/192/256 encryption - key generation, encrypt/decrypt, analysis, cipher modes (ECB, CBC, CTR)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['encrypt', 'decrypt', 'generate_key', 'key_expansion', 'sbox_lookup', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      plaintext: { type: 'string', description: 'Text to encrypt (hex or string)' },
      ciphertext: { type: 'string', description: 'Hex ciphertext to decrypt' },
      key: { type: 'string', description: 'Encryption key (hex string)' },
      key_size: { type: 'number', enum: [128, 192, 256], description: 'Key size in bits' },
      mode: { type: 'string', enum: ['ECB', 'CBC', 'CTR'], description: 'Block cipher mode' },
      iv: { type: 'string', description: 'Initialization vector (hex) for CBC/CTR' },
      input_format: { type: 'string', enum: ['hex', 'string'], description: 'Input format' }
    },
    required: ['operation']
  }
};

// AES S-box (Substitution box) - precomputed Rijndael S-box
const SBOX: number[] = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

// Inverse S-box for decryption
const INV_SBOX: number[] = [
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
];

// Round constants for key expansion
const RCON: number[] = [
  0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36
];

interface AESArgs {
  operation: string;
  plaintext?: string;
  ciphertext?: string;
  key?: string;
  key_size?: number;
  mode?: string;
  iv?: string;
  input_format?: string;
}

// Helper functions
function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return bytes;
}

function bytesToString(bytes: number[]): string {
  return bytes.map(b => String.fromCharCode(b)).join('');
}

function xorBytes(a: number[], b: number[]): number[] {
  return a.map((v, i) => v ^ b[i]);
}

// Generate cryptographically-style random key (using Math.random for demo)
function generateKey(bits: number): number[] {
  const bytes = bits / 8;
  const key: number[] = [];
  for (let i = 0; i < bytes; i++) {
    key.push(Math.floor(Math.random() * 256));
  }
  return key;
}

// Generate random IV
function generateIV(): number[] {
  const iv: number[] = [];
  for (let i = 0; i < 16; i++) {
    iv.push(Math.floor(Math.random() * 256));
  }
  return iv;
}

// Galois Field multiplication
function gmul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b; // x^8 + x^4 + x^3 + x + 1
    b >>= 1;
  }
  return p;
}

// Key expansion - creates round keys from cipher key
function keyExpansion(key: number[], keySize: number): number[][] {
  const Nk = keySize / 32; // Key length in 32-bit words (4, 6, or 8)
  const Nr = Nk + 6;       // Number of rounds (10, 12, or 14)
  const Nb = 4;            // Block size in 32-bit words (always 4 for AES)

  // Initialize with the original key
  const w: number[][] = [];
  for (let i = 0; i < Nk; i++) {
    w.push([key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]]);
  }

  // Expand to (Nr+1)*Nb words
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    let temp = [...w[i - 1]];

    if (i % Nk === 0) {
      // RotWord and SubWord
      temp = [SBOX[temp[1]], SBOX[temp[2]], SBOX[temp[3]], SBOX[temp[0]]];
      temp[0] ^= RCON[(i / Nk) - 1];
    } else if (Nk > 6 && i % Nk === 4) {
      // Additional SubWord for AES-256
      temp = temp.map(b => SBOX[b]);
    }

    w.push(xorBytes(w[i - Nk], temp));
  }

  // Convert to round keys (16-byte blocks)
  const roundKeys: number[][] = [];
  for (let r = 0; r <= Nr; r++) {
    const roundKey: number[] = [];
    for (let i = 0; i < 4; i++) {
      roundKey.push(...w[r * 4 + i]);
    }
    roundKeys.push(roundKey);
  }

  return roundKeys;
}

// SubBytes transformation
function subBytes(state: number[]): number[] {
  return state.map(b => SBOX[b]);
}

// InvSubBytes transformation
function invSubBytes(state: number[]): number[] {
  return state.map(b => INV_SBOX[b]);
}

// ShiftRows transformation
function shiftRows(state: number[]): number[] {
  const result = [...state];
  // Row 1: shift left by 1
  [result[1], result[5], result[9], result[13]] = [result[5], result[9], result[13], result[1]];
  // Row 2: shift left by 2
  [result[2], result[6], result[10], result[14]] = [result[10], result[14], result[2], result[6]];
  // Row 3: shift left by 3
  [result[3], result[7], result[11], result[15]] = [result[15], result[3], result[7], result[11]];
  return result;
}

// InvShiftRows transformation
function invShiftRows(state: number[]): number[] {
  const result = [...state];
  // Row 1: shift right by 1
  [result[1], result[5], result[9], result[13]] = [result[13], result[1], result[5], result[9]];
  // Row 2: shift right by 2
  [result[2], result[6], result[10], result[14]] = [result[10], result[14], result[2], result[6]];
  // Row 3: shift right by 3
  [result[3], result[7], result[11], result[15]] = [result[7], result[11], result[15], result[3]];
  return result;
}

// MixColumns transformation
function mixColumns(state: number[]): number[] {
  const result: number[] = [];
  for (let c = 0; c < 4; c++) {
    const col = c * 4;
    result[col] = gmul(0x02, state[col]) ^ gmul(0x03, state[col+1]) ^ state[col+2] ^ state[col+3];
    result[col+1] = state[col] ^ gmul(0x02, state[col+1]) ^ gmul(0x03, state[col+2]) ^ state[col+3];
    result[col+2] = state[col] ^ state[col+1] ^ gmul(0x02, state[col+2]) ^ gmul(0x03, state[col+3]);
    result[col+3] = gmul(0x03, state[col]) ^ state[col+1] ^ state[col+2] ^ gmul(0x02, state[col+3]);
  }
  return result;
}

// InvMixColumns transformation
function invMixColumns(state: number[]): number[] {
  const result: number[] = [];
  for (let c = 0; c < 4; c++) {
    const col = c * 4;
    result[col] = gmul(0x0e, state[col]) ^ gmul(0x0b, state[col+1]) ^ gmul(0x0d, state[col+2]) ^ gmul(0x09, state[col+3]);
    result[col+1] = gmul(0x09, state[col]) ^ gmul(0x0e, state[col+1]) ^ gmul(0x0b, state[col+2]) ^ gmul(0x0d, state[col+3]);
    result[col+2] = gmul(0x0d, state[col]) ^ gmul(0x09, state[col+1]) ^ gmul(0x0e, state[col+2]) ^ gmul(0x0b, state[col+3]);
    result[col+3] = gmul(0x0b, state[col]) ^ gmul(0x0d, state[col+1]) ^ gmul(0x09, state[col+2]) ^ gmul(0x0e, state[col+3]);
  }
  return result;
}

// AddRoundKey transformation
function addRoundKey(state: number[], roundKey: number[]): number[] {
  return xorBytes(state, roundKey);
}

// Encrypt a single 16-byte block
function encryptBlock(block: number[], roundKeys: number[][]): number[] {
  const Nr = roundKeys.length - 1;
  let state = addRoundKey(block, roundKeys[0]);

  for (let round = 1; round < Nr; round++) {
    state = subBytes(state);
    state = shiftRows(state);
    state = mixColumns(state);
    state = addRoundKey(state, roundKeys[round]);
  }

  // Final round (no MixColumns)
  state = subBytes(state);
  state = shiftRows(state);
  state = addRoundKey(state, roundKeys[Nr]);

  return state;
}

// Decrypt a single 16-byte block
function decryptBlock(block: number[], roundKeys: number[][]): number[] {
  const Nr = roundKeys.length - 1;
  let state = addRoundKey(block, roundKeys[Nr]);

  for (let round = Nr - 1; round > 0; round--) {
    state = invShiftRows(state);
    state = invSubBytes(state);
    state = addRoundKey(state, roundKeys[round]);
    state = invMixColumns(state);
  }

  // Final round
  state = invShiftRows(state);
  state = invSubBytes(state);
  state = addRoundKey(state, roundKeys[0]);

  return state;
}

// PKCS7 padding
function pkcs7Pad(data: number[]): number[] {
  const padLen = 16 - (data.length % 16);
  return [...data, ...Array(padLen).fill(padLen)];
}

// PKCS7 unpadding
function pkcs7Unpad(data: number[]): number[] {
  const padLen = data[data.length - 1];
  if (padLen > 16 || padLen === 0) return data;
  return data.slice(0, data.length - padLen);
}

// ECB mode encryption
function encryptECB(plaintext: number[], roundKeys: number[][]): number[] {
  const padded = pkcs7Pad(plaintext);
  const ciphertext: number[] = [];

  for (let i = 0; i < padded.length; i += 16) {
    const block = padded.slice(i, i + 16);
    ciphertext.push(...encryptBlock(block, roundKeys));
  }

  return ciphertext;
}

// ECB mode decryption
function decryptECB(ciphertext: number[], roundKeys: number[][]): number[] {
  const plaintext: number[] = [];

  for (let i = 0; i < ciphertext.length; i += 16) {
    const block = ciphertext.slice(i, i + 16);
    plaintext.push(...decryptBlock(block, roundKeys));
  }

  return pkcs7Unpad(plaintext);
}

// CBC mode encryption
function encryptCBC(plaintext: number[], roundKeys: number[][], iv: number[]): number[] {
  const padded = pkcs7Pad(plaintext);
  const ciphertext: number[] = [];
  let prevBlock = iv;

  for (let i = 0; i < padded.length; i += 16) {
    const block = padded.slice(i, i + 16);
    const xored = xorBytes(block, prevBlock);
    const encrypted = encryptBlock(xored, roundKeys);
    ciphertext.push(...encrypted);
    prevBlock = encrypted;
  }

  return ciphertext;
}

// CBC mode decryption
function decryptCBC(ciphertext: number[], roundKeys: number[][], iv: number[]): number[] {
  const plaintext: number[] = [];
  let prevBlock = iv;

  for (let i = 0; i < ciphertext.length; i += 16) {
    const block = ciphertext.slice(i, i + 16);
    const decrypted = decryptBlock(block, roundKeys);
    const xored = xorBytes(decrypted, prevBlock);
    plaintext.push(...xored);
    prevBlock = block;
  }

  return pkcs7Unpad(plaintext);
}

// CTR mode encryption/decryption (same operation)
function cryptCTR(data: number[], roundKeys: number[][], nonce: number[]): number[] {
  const result: number[] = [];
  const counter = [...nonce];

  for (let i = 0; i < data.length; i += 16) {
    const keystream = encryptBlock(counter, roundKeys);
    const block = data.slice(i, Math.min(i + 16, data.length));

    for (let j = 0; j < block.length; j++) {
      result.push(block[j] ^ keystream[j]);
    }

    // Increment counter
    for (let j = 15; j >= 0; j--) {
      counter[j]++;
      if (counter[j] !== 0) break;
    }
  }

  return result;
}

// Analyze key strength and properties
function analyzeKey(key: number[]): Record<string, unknown> {
  const bits = key.length * 8;
  const uniqueBytes = new Set(key).size;
  const entropy = key.reduce((sum, b) => sum + (b === 0 ? 0 : Math.log2(256)), 0) / key.length;

  // Check for weak patterns
  let hasRepeating = false;
  for (let i = 0; i < key.length - 1; i++) {
    if (key[i] === key[i + 1]) hasRepeating = true;
  }

  return {
    key_size_bits: bits,
    key_size_bytes: key.length,
    unique_bytes: uniqueBytes,
    entropy_bits_per_byte: entropy.toFixed(2),
    total_entropy_bits: (entropy * key.length).toFixed(2),
    has_repeating_bytes: hasRepeating,
    all_zeros: key.every(b => b === 0),
    all_ones: key.every(b => b === 255),
    security_level: bits === 256 ? 'HIGH' : bits === 192 ? 'HIGH' : 'MEDIUM',
    brute_force_operations: `2^${bits}`,
    is_weak: uniqueBytes < key.length / 2 || key.every(b => b === 0)
  };
}

export async function executeaesencryption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args: AESArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      plaintext,
      ciphertext,
      key,
      key_size = 256,
      mode = 'CBC',
      iv,
      input_format = 'string'
    } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'generate_key': {
        const keyBytes = generateKey(key_size);
        const ivBytes = generateIV();
        result = {
          operation: 'generate_key',
          key_size_bits: key_size,
          key_hex: bytesToHex(keyBytes),
          iv_hex: bytesToHex(ivBytes),
          rounds: key_size === 128 ? 10 : key_size === 192 ? 12 : 14,
          analysis: analyzeKey(keyBytes),
          warning: 'For production use, generate keys with crypto.getRandomValues() or similar CSPRNG'
        };
        break;
      }

      case 'encrypt': {
        if (!plaintext) throw new Error('plaintext is required');

        const keyBytes = key ? hexToBytes(key) : generateKey(key_size);
        const expectedKeyLen = key_size / 8;
        if (keyBytes.length !== expectedKeyLen) {
          throw new Error(`Key must be ${expectedKeyLen} bytes for AES-${key_size}`);
        }

        const roundKeys = keyExpansion(keyBytes, key_size);
        const plaintextBytes = input_format === 'hex' ? hexToBytes(plaintext) : stringToBytes(plaintext);
        const ivBytes = iv ? hexToBytes(iv) : generateIV();

        let ciphertextBytes: number[];
        switch (mode.toUpperCase()) {
          case 'ECB':
            ciphertextBytes = encryptECB(plaintextBytes, roundKeys);
            break;
          case 'CTR':
            ciphertextBytes = cryptCTR(plaintextBytes, roundKeys, ivBytes);
            break;
          case 'CBC':
          default:
            ciphertextBytes = encryptCBC(plaintextBytes, roundKeys, ivBytes);
        }

        result = {
          operation: 'encrypt',
          mode,
          key_size_bits: key_size,
          key_hex: key || bytesToHex(keyBytes),
          iv_hex: bytesToHex(ivBytes),
          plaintext_length: plaintextBytes.length,
          ciphertext_hex: bytesToHex(ciphertextBytes),
          ciphertext_length: ciphertextBytes.length,
          rounds: roundKeys.length - 1,
          block_size: 128
        };
        break;
      }

      case 'decrypt': {
        if (!ciphertext) throw new Error('ciphertext is required');
        if (!key) throw new Error('key is required for decryption');

        const keyBytes = hexToBytes(key);
        const detectedKeySize = keyBytes.length * 8;
        if (![128, 192, 256].includes(detectedKeySize)) {
          throw new Error('Invalid key length. Must be 16, 24, or 32 bytes');
        }

        const roundKeys = keyExpansion(keyBytes, detectedKeySize);
        const ciphertextBytes = hexToBytes(ciphertext);
        const ivBytes = iv ? hexToBytes(iv) : new Array(16).fill(0);

        let plaintextBytes: number[];
        switch (mode.toUpperCase()) {
          case 'ECB':
            plaintextBytes = decryptECB(ciphertextBytes, roundKeys);
            break;
          case 'CTR':
            plaintextBytes = cryptCTR(ciphertextBytes, roundKeys, ivBytes);
            break;
          case 'CBC':
          default:
            plaintextBytes = decryptCBC(ciphertextBytes, roundKeys, ivBytes);
        }

        result = {
          operation: 'decrypt',
          mode,
          key_size_bits: detectedKeySize,
          plaintext_string: bytesToString(plaintextBytes),
          plaintext_hex: bytesToHex(plaintextBytes),
          plaintext_length: plaintextBytes.length
        };
        break;
      }

      case 'key_expansion': {
        const keyBytes = key ? hexToBytes(key) : generateKey(key_size);
        const expectedKeyLen = key_size / 8;
        if (keyBytes.length !== expectedKeyLen) {
          throw new Error(`Key must be ${expectedKeyLen} bytes for AES-${key_size}`);
        }

        const roundKeys = keyExpansion(keyBytes, key_size);
        result = {
          operation: 'key_expansion',
          key_size_bits: key_size,
          original_key_hex: bytesToHex(keyBytes),
          num_rounds: roundKeys.length - 1,
          round_keys: roundKeys.map((rk, i) => ({
            round: i,
            key_hex: bytesToHex(rk)
          })),
          algorithm: 'Rijndael key schedule with RotWord, SubWord, and Rcon'
        };
        break;
      }

      case 'sbox_lookup': {
        const input = plaintext ? parseInt(plaintext, 16) : 0;
        if (input < 0 || input > 255) throw new Error('Input must be 0x00-0xFF');

        result = {
          operation: 'sbox_lookup',
          input_hex: input.toString(16).padStart(2, '0'),
          input_binary: input.toString(2).padStart(8, '0'),
          sbox_output_hex: SBOX[input].toString(16).padStart(2, '0'),
          sbox_output_binary: SBOX[input].toString(2).padStart(8, '0'),
          inverse_sbox_hex: INV_SBOX[input].toString(16).padStart(2, '0'),
          verification: INV_SBOX[SBOX[input]] === input,
          note: 'S-box provides non-linearity (confusion) in AES'
        };
        break;
      }

      case 'analyze': {
        const keyBytes = key ? hexToBytes(key) : null;
        result = {
          operation: 'analyze',
          key_analysis: keyBytes ? analyzeKey(keyBytes) : null,
          mode_analysis: {
            ECB: {
              description: 'Electronic Codebook - identical blocks produce identical ciphertext',
              security: 'WEAK - reveals patterns',
              use_case: 'Never use for sensitive data'
            },
            CBC: {
              description: 'Cipher Block Chaining - each block XORed with previous ciphertext',
              security: 'GOOD - with random IV',
              use_case: 'General purpose encryption'
            },
            CTR: {
              description: 'Counter mode - turns block cipher into stream cipher',
              security: 'GOOD - parallelizable, no padding needed',
              use_case: 'High-performance encryption'
            },
            GCM: {
              description: 'Galois/Counter Mode - CTR with authentication',
              security: 'EXCELLENT - provides authentication',
              use_case: 'Modern standard (TLS 1.3)',
              note: 'GCM requires additional GHASH implementation'
            }
          },
          security_recommendations: [
            'Always use a unique IV/nonce for each encryption',
            'Use authenticated encryption (GCM) when possible',
            'Generate keys with CSPRNG',
            'Protect keys in secure storage (HSM, secure enclave)',
            'Use key derivation functions (HKDF, PBKDF2) for password-based keys'
          ]
        };
        break;
      }

      case 'info':
      default:
        result = {
          operation: 'info',
          description: 'AES (Advanced Encryption Standard) - Rijndael block cipher',
          supported_key_sizes: [128, 192, 256],
          block_size: 128,
          operations: {
            generate_key: 'Generate random AES key and IV',
            encrypt: 'Encrypt plaintext using specified mode',
            decrypt: 'Decrypt ciphertext using specified mode',
            key_expansion: 'Show all round keys from key schedule',
            sbox_lookup: 'Look up S-box substitution value',
            analyze: 'Analyze key strength and mode security'
          },
          modes: ['ECB', 'CBC', 'CTR'],
          parameters: {
            plaintext: 'Text to encrypt',
            ciphertext: 'Hex string to decrypt',
            key: 'Encryption key as hex string',
            key_size: 'Key size: 128, 192, or 256 bits',
            mode: 'Block cipher mode: ECB, CBC, CTR',
            iv: 'Initialization vector (hex)',
            input_format: 'hex or string'
          },
          rounds_by_key_size: {
            'AES-128': 10,
            'AES-192': 12,
            'AES-256': 14
          },
          transformations: [
            'SubBytes - S-box substitution (non-linearity)',
            'ShiftRows - Row-wise permutation (diffusion)',
            'MixColumns - Column mixing (diffusion)',
            'AddRoundKey - XOR with round key'
          ],
          examples: [
            { operation: 'generate_key', key_size: 256 },
            { operation: 'encrypt', plaintext: 'Hello, World!', mode: 'CBC' },
            { operation: 'sbox_lookup', plaintext: '53' }
          ]
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isaesencryptionAvailable(): boolean { return true; }
