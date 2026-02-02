/**
 * AES-ENCRYPTION TOOL
 * AES symmetric encryption with real S-box, MixColumns, and round operations
 * Educational implementation of the Rijndael cipher
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const aesencryptionTool: UnifiedTool = {
  name: 'aes_encryption',
  description: `AES (Advanced Encryption Standard) symmetric encryption.

Operations:
- info: AES algorithm explanation and structure
- encrypt: Encrypt plaintext block (educational demo)
- decrypt: Decrypt ciphertext block
- generate_key: Generate random AES key
- key_expansion: Show key schedule/expansion
- round: Demonstrate single AES round
- sbox: Show S-box substitution
- mixcolumns: Demonstrate MixColumns operation
- modes: Explain block cipher modes (ECB, CBC, GCM, CTR)

Parameters:
- operation: The operation to perform
- key_size: 128, 192, or 256 bits
- mode: Block cipher mode (ECB, CBC, GCM, CTR)
- plaintext: Hex string to encrypt
- key: Hex string key
- iv: Initialization vector for CBC/GCM/CTR`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'encrypt', 'decrypt', 'generate_key', 'key_expansion', 'round', 'sbox', 'mixcolumns', 'modes', 'demonstrate'],
        description: 'Operation to perform'
      },
      key_size: {
        type: 'number',
        enum: [128, 192, 256],
        description: 'Key size in bits'
      },
      mode: {
        type: 'string',
        enum: ['ECB', 'CBC', 'GCM', 'CTR'],
        description: 'Block cipher mode'
      },
      plaintext: { type: 'string', description: 'Hex plaintext' },
      key: { type: 'string', description: 'Hex key' },
      iv: { type: 'string', description: 'Initialization vector' }
    },
    required: ['operation']
  }
};

// ============================================================================
// AES CONSTANTS
// ============================================================================

// AES S-box (Rijndael S-box)
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

// ============================================================================
// AES OPERATIONS
// ============================================================================

/**
 * Convert hex string to byte array
 */
function hexToBytes(hex: string): number[] {
  hex = hex.replace(/\s/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

/**
 * Convert byte array to hex string
 */
function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert bytes to 4x4 state matrix (column-major)
 */
function bytesToState(bytes: number[]): number[][] {
  const state: number[][] = [];
  for (let c = 0; c < 4; c++) {
    state.push([bytes[c*4], bytes[c*4+1], bytes[c*4+2], bytes[c*4+3]]);
  }
  return state;
}

/**
 * Convert state matrix back to bytes
 */
function stateToBytes(state: number[][]): number[] {
  const bytes: number[] = [];
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      bytes.push(state[c][r]);
    }
  }
  return bytes;
}

/**
 * SubBytes: Apply S-box substitution to each byte
 */
function subBytes(state: number[][]): number[][] {
  const result: number[][] = [];
  for (let c = 0; c < 4; c++) {
    result.push(state[c].map(b => SBOX[b]));
  }
  return result;
}

/**
 * InvSubBytes: Apply inverse S-box
 */
function invSubBytes(state: number[][]): number[][] {
  const result: number[][] = [];
  for (let c = 0; c < 4; c++) {
    result.push(state[c].map(b => INV_SBOX[b]));
  }
  return result;
}

/**
 * ShiftRows: Cyclically shift rows
 * Row 0: no shift
 * Row 1: shift left 1
 * Row 2: shift left 2
 * Row 3: shift left 3
 */
function shiftRows(state: number[][]): number[][] {
  const result: number[][] = [[], [], [], []];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      result[c][r] = state[(c + r) % 4][r];
    }
  }
  return result;
}

/**
 * InvShiftRows: Inverse of ShiftRows
 */
function invShiftRows(state: number[][]): number[][] {
  const result: number[][] = [[], [], [], []];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      result[c][r] = state[(c - r + 4) % 4][r];
    }
  }
  return result;
}

/**
 * Galois Field multiplication
 */
function gmul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if ((b & 1) !== 0) {
      p ^= a;
    }
    const hiBitSet = (a & 0x80) !== 0;
    a <<= 1;
    a &= 0xff;
    if (hiBitSet) {
      a ^= 0x1b; // x^8 + x^4 + x^3 + x + 1
    }
    b >>= 1;
  }
  return p;
}

/**
 * MixColumns: Mix bytes within each column using GF(2^8) multiplication
 */
function mixColumns(state: number[][]): number[][] {
  const result: number[][] = [];
  for (let c = 0; c < 4; c++) {
    const col = state[c];
    result.push([
      gmul(2, col[0]) ^ gmul(3, col[1]) ^ col[2] ^ col[3],
      col[0] ^ gmul(2, col[1]) ^ gmul(3, col[2]) ^ col[3],
      col[0] ^ col[1] ^ gmul(2, col[2]) ^ gmul(3, col[3]),
      gmul(3, col[0]) ^ col[1] ^ col[2] ^ gmul(2, col[3])
    ]);
  }
  return result;
}

/**
 * InvMixColumns
 */
function invMixColumns(state: number[][]): number[][] {
  const result: number[][] = [];
  for (let c = 0; c < 4; c++) {
    const col = state[c];
    result.push([
      gmul(14, col[0]) ^ gmul(11, col[1]) ^ gmul(13, col[2]) ^ gmul(9, col[3]),
      gmul(9, col[0]) ^ gmul(14, col[1]) ^ gmul(11, col[2]) ^ gmul(13, col[3]),
      gmul(13, col[0]) ^ gmul(9, col[1]) ^ gmul(14, col[2]) ^ gmul(11, col[3]),
      gmul(11, col[0]) ^ gmul(13, col[1]) ^ gmul(9, col[2]) ^ gmul(14, col[3])
    ]);
  }
  return result;
}

/**
 * AddRoundKey: XOR state with round key
 */
function addRoundKey(state: number[][], roundKey: number[]): number[][] {
  const result: number[][] = [];
  for (let c = 0; c < 4; c++) {
    result.push(state[c].map((b, r) => b ^ roundKey[c * 4 + r]));
  }
  return result;
}

/**
 * Key Expansion: Generate round keys from cipher key
 */
function keyExpansion(key: number[], keySize: number): number[][] {
  const Nk = keySize / 32; // Number of 32-bit words in key
  const Nr = Nk + 6;       // Number of rounds
  const Nb = 4;            // Block size in words

  const w: number[][] = [];

  // First Nk words are the key itself
  for (let i = 0; i < Nk; i++) {
    w.push([key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]]);
  }

  // Generate remaining words
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    let temp = [...w[i - 1]];

    if (i % Nk === 0) {
      // RotWord
      temp = [temp[1], temp[2], temp[3], temp[0]];
      // SubWord
      temp = temp.map(b => SBOX[b]);
      // XOR with Rcon
      temp[0] ^= RCON[(i / Nk) - 1];
    } else if (Nk > 6 && i % Nk === 4) {
      // Additional SubWord for AES-256
      temp = temp.map(b => SBOX[b]);
    }

    w.push(w[i - Nk].map((b, j) => b ^ temp[j]));
  }

  // Convert to round keys (16 bytes each)
  const roundKeys: number[][] = [];
  for (let round = 0; round <= Nr; round++) {
    const roundKey: number[] = [];
    for (let word = 0; word < 4; word++) {
      roundKey.push(...w[round * 4 + word]);
    }
    roundKeys.push(roundKey);
  }

  return roundKeys;
}

/**
 * AES Encryption
 */
function aesEncrypt(plaintext: number[], key: number[], keySize: number): {
  ciphertext: number[];
  rounds: Array<{ state: string; operation: string }>;
} {
  const Nr = keySize / 32 + 6;
  const roundKeys = keyExpansion(key, keySize);
  const rounds: Array<{ state: string; operation: string }> = [];

  let state = bytesToState(plaintext);

  // Initial round key addition
  state = addRoundKey(state, roundKeys[0]);
  rounds.push({ state: bytesToHex(stateToBytes(state)), operation: 'AddRoundKey (initial)' });

  // Main rounds
  for (let round = 1; round < Nr; round++) {
    state = subBytes(state);
    rounds.push({ state: bytesToHex(stateToBytes(state)), operation: `Round ${round}: SubBytes` });

    state = shiftRows(state);
    rounds.push({ state: bytesToHex(stateToBytes(state)), operation: `Round ${round}: ShiftRows` });

    state = mixColumns(state);
    rounds.push({ state: bytesToHex(stateToBytes(state)), operation: `Round ${round}: MixColumns` });

    state = addRoundKey(state, roundKeys[round]);
    rounds.push({ state: bytesToHex(stateToBytes(state)), operation: `Round ${round}: AddRoundKey` });
  }

  // Final round (no MixColumns)
  state = subBytes(state);
  rounds.push({ state: bytesToHex(stateToBytes(state)), operation: `Round ${Nr}: SubBytes` });

  state = shiftRows(state);
  rounds.push({ state: bytesToHex(stateToBytes(state)), operation: `Round ${Nr}: ShiftRows` });

  state = addRoundKey(state, roundKeys[Nr]);
  rounds.push({ state: bytesToHex(stateToBytes(state)), operation: `Round ${Nr}: AddRoundKey (final)` });

  return { ciphertext: stateToBytes(state), rounds };
}

/**
 * AES Decryption
 */
function aesDecrypt(ciphertext: number[], key: number[], keySize: number): number[] {
  const Nr = keySize / 32 + 6;
  const roundKeys = keyExpansion(key, keySize);

  let state = bytesToState(ciphertext);

  // Initial round
  state = addRoundKey(state, roundKeys[Nr]);

  // Main rounds (in reverse)
  for (let round = Nr - 1; round >= 1; round--) {
    state = invShiftRows(state);
    state = invSubBytes(state);
    state = addRoundKey(state, roundKeys[round]);
    state = invMixColumns(state);
  }

  // Final round
  state = invShiftRows(state);
  state = invSubBytes(state);
  state = addRoundKey(state, roundKeys[0]);

  return stateToBytes(state);
}

/**
 * Generate random key
 */
function generateKey(bits: number): number[] {
  const bytes = bits / 8;
  const key: number[] = [];
  for (let i = 0; i < bytes; i++) {
    key.push(Math.floor(Math.random() * 256));
  }
  return key;
}

export async function executeaesencryption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'AES Encryption',
          description: 'Advanced Encryption Standard (Rijndael cipher)',

          overview: {
            type: 'Symmetric block cipher',
            blockSize: '128 bits (16 bytes)',
            keySizes: ['128 bits (10 rounds)', '192 bits (12 rounds)', '256 bits (14 rounds)'],
            standardizedBy: 'NIST in 2001 (FIPS 197)',
            designers: 'Joan Daemen and Vincent Rijmen'
          },

          structure: {
            stateMatrix: '4×4 matrix of bytes (column-major order)',
            roundOperations: [
              'SubBytes - Non-linear S-box substitution',
              'ShiftRows - Row-wise cyclic shifts',
              'MixColumns - Column mixing in GF(2⁸)',
              'AddRoundKey - XOR with round key'
            ],
            finalRound: 'Omits MixColumns'
          },

          sbox: {
            purpose: 'Non-linearity to resist linear/differential cryptanalysis',
            construction: 'Multiplicative inverse in GF(2⁸) + affine transformation',
            properties: ['No fixed points (S(x) ≠ x)', 'No opposite fixed points (S(x) ≠ x̄)']
          },

          mixColumns: {
            purpose: 'Diffusion within columns',
            matrix: '[[2,3,1,1],[1,2,3,1],[1,1,2,3],[3,1,1,2]]',
            field: 'GF(2⁸) with polynomial x⁸+x⁴+x³+x+1'
          },

          security: {
            bestKnownAttack: 'Biclique attack (2^126.1 for AES-128)',
            practicalStatus: 'No practical attack known',
            quantumResistance: 'Grover reduces to 2^64/2^96/2^128 for 128/192/256'
          },

          usage: 'Use operation: encrypt, decrypt, generate_key, key_expansion, round, sbox, mixcolumns, modes'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'encrypt': {
        const keySize = args.key_size || 128;
        let plaintext: number[];
        let key: number[];

        if (args.plaintext) {
          plaintext = hexToBytes(args.plaintext);
        } else {
          plaintext = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
                       0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
        }

        if (args.key) {
          key = hexToBytes(args.key);
        } else {
          key = generateKey(keySize);
        }

        // Pad plaintext to 16 bytes if needed
        while (plaintext.length < 16) plaintext.push(0);
        plaintext = plaintext.slice(0, 16);

        const { ciphertext, rounds } = aesEncrypt(plaintext, key, keySize);

        const result = {
          operation: 'encrypt',
          keySize: keySize,
          rounds: keySize / 32 + 6,

          input: {
            plaintext: bytesToHex(plaintext),
            key: bytesToHex(key)
          },

          roundTransformations: rounds.slice(0, 10), // Show first 10 for brevity

          output: {
            ciphertext: bytesToHex(ciphertext)
          },

          note: 'Single block encryption. Use modes (CBC, GCM, CTR) for multiple blocks.'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'decrypt': {
        const keySize = args.key_size || 128;
        const ciphertext = args.plaintext ? hexToBytes(args.plaintext) :
          [0x69, 0xc4, 0xe0, 0xd8, 0x6a, 0x7b, 0x04, 0x30,
           0xd8, 0xcd, 0xb7, 0x80, 0x70, 0xb4, 0xc5, 0x5a];
        const key = args.key ? hexToBytes(args.key) : generateKey(keySize);

        const plaintext = aesDecrypt(ciphertext, key, keySize);

        const result = {
          operation: 'decrypt',
          keySize: keySize,

          input: {
            ciphertext: bytesToHex(ciphertext),
            key: bytesToHex(key)
          },

          output: {
            plaintext: bytesToHex(plaintext)
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'generate_key': {
        const keySize = args.key_size || 256;
        const key = generateKey(keySize);

        const result = {
          operation: 'generate_key',
          keySize: keySize,
          keyBytes: keySize / 8,
          key: bytesToHex(key),

          strength: {
            128: '2^128 possible keys - secure against brute force',
            192: '2^192 possible keys - extra security margin',
            256: '2^256 possible keys - quantum-resistant security margin'
          }[keySize],

          warning: 'Use cryptographically secure RNG in production!'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'key_expansion': {
        const keySize = args.key_size || 128;
        const key = args.key ? hexToBytes(args.key) : generateKey(keySize);
        const roundKeys = keyExpansion(key, keySize);

        const result = {
          operation: 'key_expansion',
          keySize: keySize,
          originalKey: bytesToHex(key),
          rounds: keySize / 32 + 6,

          algorithm: [
            '1. First Nk words are the original key',
            '2. For each new word w[i]:',
            '   - If i mod Nk = 0: RotWord, SubWord, XOR Rcon',
            '   - If Nk > 6 and i mod Nk = 4: SubWord only',
            '   - w[i] = w[i-Nk] XOR temp'
          ],

          roundKeys: roundKeys.map((rk, i) => ({
            round: i,
            key: bytesToHex(rk)
          }))
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'sbox': {
        const inputByte = args.plaintext ? parseInt(args.plaintext, 16) : 0x53;
        const outputByte = SBOX[inputByte];

        // Show S-box lookup
        const row = (inputByte >> 4) & 0x0f;
        const col = inputByte & 0x0f;

        const result = {
          operation: 'sbox',

          lookup: {
            input: inputByte.toString(16).padStart(2, '0'),
            'row (high nibble)': row.toString(16),
            'col (low nibble)': col.toString(16),
            output: outputByte.toString(16).padStart(2, '0')
          },

          construction: {
            step1: 'Find multiplicative inverse in GF(2⁸)',
            step2: 'Apply affine transformation',
            formula: "b'ᵢ = bᵢ ⊕ b₍ᵢ₊₄₎ mod 8 ⊕ b₍ᵢ₊₅₎ mod 8 ⊕ b₍ᵢ₊₆₎ mod 8 ⊕ b₍ᵢ₊₇₎ mod 8 ⊕ cᵢ"
          },

          properties: {
            nonLinearity: 112,
            differentialUniformity: 4,
            algebraicDegree: 7
          },

          sboxTable: 'First row: ' + SBOX.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(' ')
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'mixcolumns': {
        // Demo with example column
        const col = args.plaintext ? hexToBytes(args.plaintext).slice(0, 4) : [0xd4, 0xbf, 0x5d, 0x30];

        const mixed = [
          gmul(2, col[0]) ^ gmul(3, col[1]) ^ col[2] ^ col[3],
          col[0] ^ gmul(2, col[1]) ^ gmul(3, col[2]) ^ col[3],
          col[0] ^ col[1] ^ gmul(2, col[2]) ^ gmul(3, col[3]),
          gmul(3, col[0]) ^ col[1] ^ col[2] ^ gmul(2, col[3])
        ];

        const result = {
          operation: 'mixcolumns',

          input: {
            column: col.map(b => b.toString(16).padStart(2, '0'))
          },

          matrix: [
            '[2, 3, 1, 1]',
            '[1, 2, 3, 1]',
            '[1, 1, 2, 3]',
            '[3, 1, 1, 2]'
          ],

          calculation: {
            'out[0]': `2·${col[0].toString(16)} ⊕ 3·${col[1].toString(16)} ⊕ ${col[2].toString(16)} ⊕ ${col[3].toString(16)} = ${mixed[0].toString(16)}`,
            'out[1]': `${col[0].toString(16)} ⊕ 2·${col[1].toString(16)} ⊕ 3·${col[2].toString(16)} ⊕ ${col[3].toString(16)} = ${mixed[1].toString(16)}`,
            'out[2]': `${col[0].toString(16)} ⊕ ${col[1].toString(16)} ⊕ 2·${col[2].toString(16)} ⊕ 3·${col[3].toString(16)} = ${mixed[2].toString(16)}`,
            'out[3]': `3·${col[0].toString(16)} ⊕ ${col[1].toString(16)} ⊕ ${col[2].toString(16)} ⊕ 2·${col[3].toString(16)} = ${mixed[3].toString(16)}`
          },

          output: {
            column: mixed.map(b => b.toString(16).padStart(2, '0'))
          },

          galoisField: {
            polynomial: 'x⁸ + x⁴ + x³ + x + 1 (0x11b)',
            multiply2: 'Left shift, XOR 0x1b if overflow',
            multiply3: 'multiply2 XOR original'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'modes': {
        const mode = args.mode || 'all';

        const result = {
          operation: 'modes',

          blockCipherModes: {
            ECB: {
              name: 'Electronic Codebook',
              security: 'INSECURE - patterns leak',
              parallelizable: true,
              ivRequired: false,
              description: 'Each block encrypted independently',
              diagram: 'P₁→E(K)→C₁, P₂→E(K)→C₂, ...'
            },

            CBC: {
              name: 'Cipher Block Chaining',
              security: 'Secure for confidentiality',
              parallelizable: 'Decrypt only',
              ivRequired: true,
              description: 'Each block XORed with previous ciphertext',
              diagram: 'C₁ = E(K, P₁ ⊕ IV), C₂ = E(K, P₂ ⊕ C₁), ...',
              vulnerabilities: ['Padding oracle attacks', 'IV predictability']
            },

            CTR: {
              name: 'Counter Mode',
              security: 'Secure - turns block cipher into stream cipher',
              parallelizable: true,
              ivRequired: true,
              description: 'Encrypt counter, XOR with plaintext',
              diagram: 'C₁ = P₁ ⊕ E(K, Nonce||1), C₂ = P₂ ⊕ E(K, Nonce||2), ...',
              advantages: ['Fully parallelizable', 'Random access decryption']
            },

            GCM: {
              name: 'Galois/Counter Mode',
              security: 'AEAD - confidentiality + integrity',
              parallelizable: true,
              ivRequired: true,
              description: 'CTR mode + GHASH authentication',
              provides: ['Encryption', 'Authentication tag', 'AAD support'],
              recommended: 'Modern standard for authenticated encryption'
            }
          },

          recommendation: 'Use GCM for new applications (authenticated encryption)'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'demonstrate': {
        // Full demo with known test vector
        const plaintext = hexToBytes('00112233445566778899aabbccddeeff');
        const key = hexToBytes('000102030405060708090a0b0c0d0e0f');

        const { ciphertext, rounds } = aesEncrypt(plaintext, key, 128);
        const decrypted = aesDecrypt(ciphertext, key, 128);

        const result = {
          operation: 'demonstrate',
          title: 'Complete AES-128 Encryption Demo',

          testVector: {
            plaintext: '00112233445566778899aabbccddeeff',
            key: '000102030405060708090a0b0c0d0e0f',
            expectedCiphertext: '69c4e0d86a7b0430d8cdb78070b4c55a'
          },

          stateEvolution: rounds,

          result: {
            ciphertext: bytesToHex(ciphertext),
            decrypted: bytesToHex(decrypted),
            matches: bytesToHex(plaintext) === bytesToHex(decrypted)
          },

          summary: {
            rounds: 10,
            operations: '10 SubBytes + 10 ShiftRows + 9 MixColumns + 11 AddRoundKey',
            blockSize: '128 bits',
            keySize: '128 bits'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, encrypt, decrypt, generate_key, key_expansion, round, sbox, mixcolumns, modes, demonstrate`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isaesencryptionAvailable(): boolean { return true; }
