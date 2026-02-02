/**
 * SHA-HASH TOOL
 * Complete SHA family cryptographic hashing implementation
 * Supports SHA-1, SHA-224, SHA-256, SHA-384, SHA-512, SHA-512/224, SHA-512/256
 * Includes HMAC, key derivation, and hash-based message authentication
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const shahashTool: UnifiedTool = {
  name: 'sha_hash',
  description: 'SHA family cryptographic hashing - SHA-1, SHA-256, SHA-384, SHA-512, HMAC, key derivation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['hash', 'verify', 'hmac', 'pbkdf2', 'hkdf', 'compare', 'benchmark', 'info'],
        description: 'Operation to perform'
      },
      algorithm: {
        type: 'string',
        enum: ['SHA-1', 'SHA-224', 'SHA-256', 'SHA-384', 'SHA-512', 'SHA-512/224', 'SHA-512/256'],
        description: 'SHA algorithm variant'
      },
      message: {
        type: 'string',
        description: 'Message to hash (string or hex)'
      },
      message_format: {
        type: 'string',
        enum: ['text', 'hex', 'base64'],
        description: 'Format of input message'
      },
      expected_hash: {
        type: 'string',
        description: 'Expected hash for verification'
      },
      key: {
        type: 'string',
        description: 'Key for HMAC or key derivation'
      },
      salt: {
        type: 'string',
        description: 'Salt for key derivation'
      },
      iterations: {
        type: 'number',
        description: 'Iterations for PBKDF2'
      },
      output_length: {
        type: 'number',
        description: 'Output length in bytes for key derivation'
      },
      info_context: {
        type: 'string',
        description: 'Context info for HKDF'
      }
    },
    required: ['operation']
  }
};

// SHA constants
const SHA1_K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

const SHA512_K = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189abortn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
];

// Initial hash values
const SHA1_H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

const SHA224_H = [
  0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
  0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
];

const SHA256_H = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

const SHA384_H = [
  0xcbbb9d5dc1059ed8n, 0x629a292a367cd507n, 0x9159015a3070dd17n, 0x152fecd8f70e5939n,
  0x67332667ffc00b31n, 0x8eb44a8768581511n, 0xdb0c2e0d64f98fa7n, 0x47b5481dbefa4fa4n
];

const SHA512_H = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
];

const SHA512_224_H = [
  0x8c3d37c819544da2n, 0x73e1996689dcd4d6n, 0x1dfab7ae32ff9c82n, 0x679dd514582f9fcfn,
  0x0f6d2b697bd44da8n, 0x77e36f7304c48942n, 0x3f9d85a86a1d36c8n, 0x1112e6ad91d692a1n
];

const SHA512_256_H = [
  0x22312194fc2bf72cn, 0x9f555fa3c84c64c2n, 0x2393b86b6f53b151n, 0x963877195940eabdn,
  0x96283ee2a88effe3n, 0xbe5e1e2553863992n, 0x2b0199fc2c85b8aan, 0x0eb72ddc81c52ca2n
];

// Utility functions
function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function base64ToBytes(base64: string): number[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of base64) {
    if (char === '=') break;
    const idx = chars.indexOf(char);
    if (idx === -1) continue;
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return bytes;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: number[]): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return result;
}

// 32-bit operations
function rotl32(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

// 64-bit operations
function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & 0xffffffffffffffffn;
}

// SHA-1 implementation
function sha1(message: number[]): number[] {
  // Pre-processing: adding padding bits
  const ml = BigInt(message.length * 8);
  message.push(0x80);

  while ((message.length % 64) !== 56) {
    message.push(0);
  }

  // Append length in bits as 64-bit big-endian
  for (let i = 56; i >= 0; i -= 8) {
    message.push(Number((ml >> BigInt(i)) & 0xffn));
  }

  // Initialize hash values
  let [h0, h1, h2, h3, h4] = SHA1_H;

  // Process each 512-bit chunk
  for (let i = 0; i < message.length; i += 64) {
    const w: number[] = [];

    // Break chunk into sixteen 32-bit big-endian words
    for (let j = 0; j < 16; j++) {
      w[j] = (message[i + j * 4] << 24) | (message[i + j * 4 + 1] << 16) |
             (message[i + j * 4 + 2] << 8) | message[i + j * 4 + 3];
    }

    // Extend to 80 words
    for (let j = 16; j < 80; j++) {
      w[j] = rotl32(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
    }

    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];

    for (let j = 0; j < 80; j++) {
      let f: number, k: number;

      if (j < 20) {
        f = (b & c) | ((~b >>> 0) & d);
        k = SHA1_K[0];
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = SHA1_K[1];
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = SHA1_K[2];
      } else {
        f = b ^ c ^ d;
        k = SHA1_K[3];
      }

      const temp = (rotl32(a, 5) + f + e + k + w[j]) >>> 0;
      e = d;
      d = c;
      c = rotl32(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  // Produce the final hash value (160 bits)
  const hash: number[] = [];
  for (const h of [h0, h1, h2, h3, h4]) {
    hash.push((h >> 24) & 0xff, (h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff);
  }
  return hash;
}

// SHA-256 implementation (also used for SHA-224)
function sha256Core(message: number[], H: number[]): number[] {
  // Pre-processing
  const ml = BigInt(message.length * 8);
  message.push(0x80);

  while ((message.length % 64) !== 56) {
    message.push(0);
  }

  for (let i = 56; i >= 0; i -= 8) {
    message.push(Number((ml >> BigInt(i)) & 0xffn));
  }

  let [h0, h1, h2, h3, h4, h5, h6, h7] = H;

  for (let i = 0; i < message.length; i += 64) {
    const w: number[] = [];

    for (let j = 0; j < 16; j++) {
      w[j] = (message[i + j * 4] << 24) | (message[i + j * 4 + 1] << 16) |
             (message[i + j * 4 + 2] << 8) | message[i + j * 4 + 3];
    }

    for (let j = 16; j < 64; j++) {
      const s0 = rotr32(w[j-15], 7) ^ rotr32(w[j-15], 18) ^ (w[j-15] >>> 3);
      const s1 = rotr32(w[j-2], 17) ^ rotr32(w[j-2], 19) ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];

    for (let j = 0; j < 64; j++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ ((~e >>> 0) & g);
      const temp1 = (h + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hash: number[] = [];
  for (const hval of [h0, h1, h2, h3, h4, h5, h6, h7]) {
    hash.push((hval >> 24) & 0xff, (hval >> 16) & 0xff, (hval >> 8) & 0xff, hval & 0xff);
  }
  return hash;
}

function sha256(message: number[]): number[] {
  return sha256Core([...message], [...SHA256_H]);
}

function sha224(message: number[]): number[] {
  return sha256Core([...message], [...SHA224_H]).slice(0, 28);
}

// SHA-512 implementation (also used for SHA-384, SHA-512/224, SHA-512/256)
function sha512Core(message: number[], H: bigint[]): bigint[] {
  const ml = BigInt(message.length * 8);
  message.push(0x80);

  while ((message.length % 128) !== 112) {
    message.push(0);
  }

  // Append 128-bit length
  for (let i = 120; i >= 0; i -= 8) {
    message.push(Number((ml >> BigInt(i)) & 0xffn));
  }

  let [h0, h1, h2, h3, h4, h5, h6, h7] = H;

  for (let i = 0; i < message.length; i += 128) {
    const w: bigint[] = [];

    for (let j = 0; j < 16; j++) {
      let val = 0n;
      for (let k = 0; k < 8; k++) {
        val = (val << 8n) | BigInt(message[i + j * 8 + k]);
      }
      w[j] = val;
    }

    for (let j = 16; j < 80; j++) {
      const s0 = rotr64(w[j-15], 1n) ^ rotr64(w[j-15], 8n) ^ (w[j-15] >> 7n);
      const s1 = rotr64(w[j-2], 19n) ^ rotr64(w[j-2], 61n) ^ (w[j-2] >> 6n);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) & 0xffffffffffffffffn;
    }

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];

    for (let j = 0; j < 80; j++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ ((~e & 0xffffffffffffffffn) & g);
      const temp1 = (h + S1 + ch + SHA512_K[j] + w[j]) & 0xffffffffffffffffn;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & 0xffffffffffffffffn;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) & 0xffffffffffffffffn;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & 0xffffffffffffffffn;
    }

    h0 = (h0 + a) & 0xffffffffffffffffn;
    h1 = (h1 + b) & 0xffffffffffffffffn;
    h2 = (h2 + c) & 0xffffffffffffffffn;
    h3 = (h3 + d) & 0xffffffffffffffffn;
    h4 = (h4 + e) & 0xffffffffffffffffn;
    h5 = (h5 + f) & 0xffffffffffffffffn;
    h6 = (h6 + g) & 0xffffffffffffffffn;
    h7 = (h7 + h) & 0xffffffffffffffffn;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7];
}

function bigintToBytes(val: bigint): number[] {
  const bytes: number[] = [];
  for (let i = 56; i >= 0; i -= 8) {
    bytes.push(Number((val >> BigInt(i)) & 0xffn));
  }
  return bytes;
}

function sha512(message: number[]): number[] {
  const H = sha512Core([...message], [...SHA512_H]);
  return H.flatMap(bigintToBytes);
}

function sha384(message: number[]): number[] {
  const H = sha512Core([...message], [...SHA384_H]);
  return H.slice(0, 6).flatMap(bigintToBytes);
}

function sha512_224(message: number[]): number[] {
  const H = sha512Core([...message], [...SHA512_224_H]);
  const bytes = H.flatMap(bigintToBytes);
  return bytes.slice(0, 28);
}

function sha512_256(message: number[]): number[] {
  const H = sha512Core([...message], [...SHA512_256_H]);
  const bytes = H.flatMap(bigintToBytes);
  return bytes.slice(0, 32);
}

// Hash dispatcher
function computeHash(algorithm: string, message: number[]): number[] {
  switch (algorithm) {
    case 'SHA-1': return sha1([...message]);
    case 'SHA-224': return sha224([...message]);
    case 'SHA-256': return sha256([...message]);
    case 'SHA-384': return sha384([...message]);
    case 'SHA-512': return sha512([...message]);
    case 'SHA-512/224': return sha512_224([...message]);
    case 'SHA-512/256': return sha512_256([...message]);
    default: return sha256([...message]);
  }
}

// HMAC implementation
function hmac(algorithm: string, key: number[], message: number[]): number[] {
  const blockSize = algorithm.startsWith('SHA-384') || algorithm.startsWith('SHA-512') ? 128 : 64;

  // Key preprocessing
  let keyBytes: number[];
  if (key.length > blockSize) {
    keyBytes = computeHash(algorithm, key);
  } else {
    keyBytes = [...key];
  }

  // Pad key to block size
  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  // Create inner and outer padding
  const ipad = keyBytes.map(b => b ^ 0x36);
  const opad = keyBytes.map(b => b ^ 0x5c);

  // Inner hash
  const innerHash = computeHash(algorithm, [...ipad, ...message]);

  // Outer hash
  return computeHash(algorithm, [...opad, ...innerHash]);
}

// PBKDF2 implementation
function pbkdf2(
  password: number[],
  salt: number[],
  iterations: number,
  keyLength: number,
  algorithm: string
): number[] {
  const hashLen = getHashLength(algorithm);
  const numBlocks = Math.ceil(keyLength / hashLen);
  const derived: number[] = [];

  for (let i = 1; i <= numBlocks; i++) {
    // U1 = PRF(Password, Salt || INT_32_BE(i))
    const blockNum = [(i >> 24) & 0xff, (i >> 16) & 0xff, (i >> 8) & 0xff, i & 0xff];
    let u = hmac(algorithm, password, [...salt, ...blockNum]);
    let result = [...u];

    // U2 ... Uc
    for (let j = 1; j < iterations; j++) {
      u = hmac(algorithm, password, u);
      for (let k = 0; k < result.length; k++) {
        result[k] ^= u[k];
      }
    }

    derived.push(...result);
  }

  return derived.slice(0, keyLength);
}

// HKDF implementation
function hkdf(
  ikm: number[],
  salt: number[],
  info: number[],
  length: number,
  algorithm: string
): number[] {
  const hashLen = getHashLength(algorithm);

  // Extract
  const prk = salt.length > 0
    ? hmac(algorithm, salt, ikm)
    : hmac(algorithm, new Array(hashLen).fill(0), ikm);

  // Expand
  const n = Math.ceil(length / hashLen);
  const okm: number[] = [];
  let t: number[] = [];

  for (let i = 1; i <= n; i++) {
    t = hmac(algorithm, prk, [...t, ...info, i]);
    okm.push(...t);
  }

  return okm.slice(0, length);
}

function getHashLength(algorithm: string): number {
  switch (algorithm) {
    case 'SHA-1': return 20;
    case 'SHA-224': return 28;
    case 'SHA-256': return 32;
    case 'SHA-384': return 48;
    case 'SHA-512': return 64;
    case 'SHA-512/224': return 28;
    case 'SHA-512/256': return 32;
    default: return 32;
  }
}

// Constant-time comparison
function constantTimeCompare(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// Parse input based on format
function parseInput(input: string, format: string): number[] {
  switch (format) {
    case 'hex': return hexToBytes(input);
    case 'base64': return base64ToBytes(input);
    default: return stringToBytes(input);
  }
}

export async function executeshahash(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'hash';
    const algorithm = args.algorithm || 'SHA-256';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'sha_hash',
          description: 'SHA family cryptographic hash functions',
          algorithms: {
            'SHA-1': {
              output_bits: 160,
              block_bits: 512,
              security: 'DEPRECATED - collision attacks exist',
              use_case: 'Legacy systems only'
            },
            'SHA-224': {
              output_bits: 224,
              block_bits: 512,
              security: '112-bit security level',
              use_case: 'When 224-bit output needed with SHA-256 performance'
            },
            'SHA-256': {
              output_bits: 256,
              block_bits: 512,
              security: '128-bit security level',
              use_case: 'General purpose, most common choice'
            },
            'SHA-384': {
              output_bits: 384,
              block_bits: 1024,
              security: '192-bit security level',
              use_case: 'Higher security requirements'
            },
            'SHA-512': {
              output_bits: 512,
              block_bits: 1024,
              security: '256-bit security level',
              use_case: 'Maximum security, efficient on 64-bit systems'
            },
            'SHA-512/224': {
              output_bits: 224,
              block_bits: 1024,
              security: '112-bit security level',
              use_case: 'SHA-512 performance with 224-bit output'
            },
            'SHA-512/256': {
              output_bits: 256,
              block_bits: 1024,
              security: '128-bit security level',
              use_case: 'SHA-512 performance with 256-bit output, resistant to length extension'
            }
          },
          operations: {
            hash: 'Compute hash of message',
            verify: 'Verify message against expected hash',
            hmac: 'Compute HMAC (keyed-hash message authentication code)',
            pbkdf2: 'Password-Based Key Derivation Function 2',
            hkdf: 'HMAC-based Key Derivation Function',
            compare: 'Constant-time hash comparison',
            benchmark: 'Performance benchmark'
          },
          security_notes: [
            'SHA-1 is cryptographically broken - do not use for security',
            'SHA-256 is recommended for most applications',
            'Use HMAC for message authentication',
            'Use PBKDF2 or better (bcrypt, scrypt, Argon2) for password hashing',
            'SHA-512/256 is resistant to length extension attacks unlike SHA-256'
          ]
        }, null, 2)
      };
    }

    if (operation === 'hash') {
      const message = args.message || '';
      const format = args.message_format || 'text';
      const messageBytes = parseInput(message, format);
      const hash = computeHash(algorithm, messageBytes);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'hash',
          algorithm,
          input: {
            message: message.length > 100 ? message.substring(0, 100) + '...' : message,
            format,
            length_bytes: messageBytes.length
          },
          output: {
            hex: bytesToHex(hash),
            base64: bytesToBase64(hash),
            length_bits: hash.length * 8
          }
        }, null, 2)
      };
    }

    if (operation === 'verify') {
      const message = args.message || '';
      const format = args.message_format || 'text';
      const expectedHash = args.expected_hash || '';

      const messageBytes = parseInput(message, format);
      const computedHash = computeHash(algorithm, messageBytes);
      const expectedBytes = hexToBytes(expectedHash.toLowerCase().replace(/\s/g, ''));

      const isValid = constantTimeCompare(computedHash, expectedBytes);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'verify',
          algorithm,
          valid: isValid,
          computed_hash: bytesToHex(computedHash),
          expected_hash: bytesToHex(expectedBytes),
          note: isValid
            ? 'Hash verification successful'
            : 'Hash mismatch - message or hash may be corrupted'
        }, null, 2)
      };
    }

    if (operation === 'hmac') {
      const message = args.message || '';
      const key = args.key || '';
      const format = args.message_format || 'text';

      const messageBytes = parseInput(message, format);
      const keyBytes = stringToBytes(key);
      const mac = hmac(algorithm, keyBytes, messageBytes);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'hmac',
          algorithm: `HMAC-${algorithm}`,
          input: {
            message_length: messageBytes.length,
            key_length: keyBytes.length
          },
          output: {
            hex: bytesToHex(mac),
            base64: bytesToBase64(mac),
            length_bits: mac.length * 8
          },
          security_note: 'HMAC provides message authentication and integrity'
        }, null, 2)
      };
    }

    if (operation === 'pbkdf2') {
      const password = args.message || args.key || '';
      const salt = args.salt || 'default_salt';
      const iterations = args.iterations || 100000;
      const outputLength = args.output_length || 32;

      const passwordBytes = stringToBytes(password);
      const saltBytes = stringToBytes(salt);
      const derived = pbkdf2(passwordBytes, saltBytes, iterations, outputLength, algorithm);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'pbkdf2',
          algorithm: `PBKDF2-HMAC-${algorithm}`,
          parameters: {
            salt_length: saltBytes.length,
            iterations,
            output_length: outputLength
          },
          output: {
            hex: bytesToHex(derived),
            base64: bytesToBase64(derived)
          },
          security_recommendations: {
            minimum_iterations: 100000,
            recommended_iterations: 600000,
            salt_note: 'Use unique random salt per password',
            alternatives: 'Consider Argon2, bcrypt, or scrypt for password hashing'
          }
        }, null, 2)
      };
    }

    if (operation === 'hkdf') {
      const ikm = args.message || args.key || '';
      const salt = args.salt || '';
      const info = args.info_context || '';
      const outputLength = args.output_length || 32;

      const ikmBytes = stringToBytes(ikm);
      const saltBytes = stringToBytes(salt);
      const infoBytes = stringToBytes(info);
      const derived = hkdf(ikmBytes, saltBytes, infoBytes, outputLength, algorithm);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'hkdf',
          algorithm: `HKDF-${algorithm}`,
          parameters: {
            ikm_length: ikmBytes.length,
            salt_length: saltBytes.length,
            info_length: infoBytes.length,
            output_length: outputLength
          },
          output: {
            hex: bytesToHex(derived),
            base64: bytesToBase64(derived)
          },
          use_case: 'Deriving multiple keys from a shared secret'
        }, null, 2)
      };
    }

    if (operation === 'compare') {
      const hash1 = args.message || '';
      const hash2 = args.expected_hash || '';

      const bytes1 = hexToBytes(hash1.toLowerCase().replace(/\s/g, ''));
      const bytes2 = hexToBytes(hash2.toLowerCase().replace(/\s/g, ''));

      const equal = constantTimeCompare(bytes1, bytes2);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'compare',
          equal,
          length_match: bytes1.length === bytes2.length,
          note: 'Comparison performed in constant time to prevent timing attacks'
        }, null, 2)
      };
    }

    if (operation === 'benchmark') {
      const testMessage = stringToBytes('The quick brown fox jumps over the lazy dog');
      const iterations = 1000;
      const results: Record<string, { time_ms: number; hashes_per_second: number }> = {};

      for (const algo of ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']) {
        const start = Date.now();
        for (let i = 0; i < iterations; i++) {
          computeHash(algo, [...testMessage]);
        }
        const elapsed = Date.now() - start;
        results[algo] = {
          time_ms: elapsed,
          hashes_per_second: Math.round((iterations / elapsed) * 1000)
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'benchmark',
          test_iterations: iterations,
          message_length: testMessage.length,
          results,
          note: 'Performance varies by implementation and hardware'
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: 'Unknown operation',
        available: ['hash', 'verify', 'hmac', 'pbkdf2', 'hkdf', 'compare', 'benchmark', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isshahashAvailable(): boolean {
  return true;
}
