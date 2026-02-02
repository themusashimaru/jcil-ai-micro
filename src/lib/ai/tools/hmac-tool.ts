/**
 * HMAC TOOL
 * Hash-based Message Authentication Code
 *
 * Implements:
 * - HMAC-SHA-256
 * - HMAC-SHA-384
 * - HMAC-SHA-512
 * - HMAC-SHA-1 (legacy)
 * - Message authentication
 * - Timing-safe verification
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const hmacTool: UnifiedTool = {
  name: 'hmac',
  description: 'HMAC (Hash-based Message Authentication Code) generation and verification',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'verify', 'derive_key', 'info'],
        description: 'Operation to perform'
      },
      hash: {
        type: 'string',
        enum: ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
        description: 'Hash algorithm (default: SHA-256)'
      },
      key: {
        type: 'string',
        description: 'Secret key for HMAC (hex or string)'
      },
      message: {
        type: 'string',
        description: 'Message to authenticate'
      },
      mac: {
        type: 'string',
        description: 'MAC value to verify (hex string)'
      },
      key_format: {
        type: 'string',
        enum: ['hex', 'utf8'],
        description: 'Key format (default: utf8)'
      },
      output_format: {
        type: 'string',
        enum: ['hex', 'base64'],
        description: 'Output format (default: hex)'
      }
    },
    required: ['operation']
  }
};

// SHA-256 implementation
function sha256(message: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  let H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  // Padding
  const msgLen = message.length;
  const bitLen = msgLen * 8;
  const padLen = ((msgLen + 8) % 64 < 56) ? 56 - (msgLen + 8) % 64 : 120 - (msgLen + 8) % 64;
  const padded = new Uint8Array(msgLen + 1 + padLen + 8);
  padded.set(message);
  padded[msgLen] = 0x80;
  // Length in bits as 64-bit big-endian
  for (let i = 0; i < 8; i++) {
    padded[padded.length - 8 + i] = (bitLen / Math.pow(256, 7 - i)) & 0xff;
  }

  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;

  // Process blocks
  for (let offset = 0; offset < padded.length; offset += 64) {
    const W = new Uint32Array(64);

    for (let i = 0; i < 16; i++) {
      W[i] = (padded[offset + i * 4] << 24) |
             (padded[offset + i * 4 + 1] << 16) |
             (padded[offset + i * 4 + 2] << 8) |
             padded[offset + i * 4 + 3];
    }

    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
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

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const result = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    result[i * 4] = (H[i] >> 24) & 0xff;
    result[i * 4 + 1] = (H[i] >> 16) & 0xff;
    result[i * 4 + 2] = (H[i] >> 8) & 0xff;
    result[i * 4 + 3] = H[i] & 0xff;
  }

  return result;
}

// SHA-512 implementation
function sha512(message: Uint8Array): Uint8Array {
  // 64-bit operations using BigInt
  const K = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
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

  let H = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn,
    0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn,
    0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
  ];

  const mask64 = 0xffffffffffffffffn;

  // Padding
  const msgLen = message.length;
  const bitLen = BigInt(msgLen * 8);
  const padLen = ((msgLen + 16) % 128 < 112) ? 112 - (msgLen + 16) % 128 : 240 - (msgLen + 16) % 128;
  const padded = new Uint8Array(msgLen + 1 + padLen + 16);
  padded.set(message);
  padded[msgLen] = 0x80;

  // Length as 128-bit big-endian (we only use lower 64 bits)
  for (let i = 0; i < 8; i++) {
    padded[padded.length - 8 + i] = Number((bitLen >> BigInt((7 - i) * 8)) & 0xffn);
  }

  const rotr = (x: bigint, n: number) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & mask64;

  // Process blocks
  for (let offset = 0; offset < padded.length; offset += 128) {
    const W: bigint[] = new Array(80);

    for (let i = 0; i < 16; i++) {
      W[i] = 0n;
      for (let j = 0; j < 8; j++) {
        W[i] = (W[i] << 8n) | BigInt(padded[offset + i * 8 + j]);
      }
    }

    for (let i = 16; i < 80; i++) {
      const s0 = rotr(W[i - 15], 1) ^ rotr(W[i - 15], 8) ^ (W[i - 15] >> 7n);
      const s1 = rotr(W[i - 2], 19) ^ rotr(W[i - 2], 61) ^ (W[i - 2] >> 6n);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) & mask64;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 80; i++) {
      const S1 = rotr(e, 14) ^ rotr(e, 18) ^ rotr(e, 41);
      const ch = (e & f) ^ (~e & mask64 & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) & mask64;
      const S0 = rotr(a, 28) ^ rotr(a, 34) ^ rotr(a, 39);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & mask64;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) & mask64;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & mask64;
    }

    H[0] = (H[0] + a) & mask64;
    H[1] = (H[1] + b) & mask64;
    H[2] = (H[2] + c) & mask64;
    H[3] = (H[3] + d) & mask64;
    H[4] = (H[4] + e) & mask64;
    H[5] = (H[5] + f) & mask64;
    H[6] = (H[6] + g) & mask64;
    H[7] = (H[7] + h) & mask64;
  }

  const result = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      result[i * 8 + j] = Number((H[i] >> BigInt((7 - j) * 8)) & 0xffn);
    }
  }

  return result;
}

// SHA-384 (truncated SHA-512 with different IV)
function sha384(message: Uint8Array): Uint8Array {
  // Use SHA-512 logic with different IV
  const fullHash = sha512WithIV(message, [
    0xcbbb9d5dc1059ed8n, 0x629a292a367cd507n,
    0x9159015a3070dd17n, 0x152fecd8f70e5939n,
    0x67332667ffc00b31n, 0x8eb44a8768581511n,
    0xdb0c2e0d64f98fa7n, 0x47b5481dbefa4fa4n
  ]);
  return fullHash.slice(0, 48);
}

function sha512WithIV(message: Uint8Array, iv: bigint[]): Uint8Array {
  const K = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbortn,
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

  let H = [...iv];
  const mask64 = 0xffffffffffffffffn;

  const msgLen = message.length;
  const bitLen = BigInt(msgLen * 8);
  const padLen = ((msgLen + 16) % 128 < 112) ? 112 - (msgLen + 16) % 128 : 240 - (msgLen + 16) % 128;
  const padded = new Uint8Array(msgLen + 1 + padLen + 16);
  padded.set(message);
  padded[msgLen] = 0x80;

  for (let i = 0; i < 8; i++) {
    padded[padded.length - 8 + i] = Number((bitLen >> BigInt((7 - i) * 8)) & 0xffn);
  }

  const rotr = (x: bigint, n: number) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & mask64;

  for (let offset = 0; offset < padded.length; offset += 128) {
    const W: bigint[] = new Array(80);

    for (let i = 0; i < 16; i++) {
      W[i] = 0n;
      for (let j = 0; j < 8; j++) {
        W[i] = (W[i] << 8n) | BigInt(padded[offset + i * 8 + j]);
      }
    }

    for (let i = 16; i < 80; i++) {
      const s0 = rotr(W[i - 15], 1) ^ rotr(W[i - 15], 8) ^ (W[i - 15] >> 7n);
      const s1 = rotr(W[i - 2], 19) ^ rotr(W[i - 2], 61) ^ (W[i - 2] >> 6n);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) & mask64;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 80; i++) {
      const S1 = rotr(e, 14) ^ rotr(e, 18) ^ rotr(e, 41);
      const ch = (e & f) ^ (~e & mask64 & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) & mask64;
      const S0 = rotr(a, 28) ^ rotr(a, 34) ^ rotr(a, 39);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & mask64;

      h = g; g = f; f = e;
      e = (d + temp1) & mask64;
      d = c; c = b; b = a;
      a = (temp1 + temp2) & mask64;
    }

    H[0] = (H[0] + a) & mask64;
    H[1] = (H[1] + b) & mask64;
    H[2] = (H[2] + c) & mask64;
    H[3] = (H[3] + d) & mask64;
    H[4] = (H[4] + e) & mask64;
    H[5] = (H[5] + f) & mask64;
    H[6] = (H[6] + g) & mask64;
    H[7] = (H[7] + h) & mask64;
  }

  const result = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      result[i * 8 + j] = Number((H[i] >> BigInt((7 - j) * 8)) & 0xffn);
    }
  }

  return result;
}

// SHA-1 (legacy, not recommended for security)
function sha1(message: Uint8Array): Uint8Array {
  let H = new Uint32Array([
    0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0
  ]);

  const msgLen = message.length;
  const bitLen = msgLen * 8;
  const padLen = ((msgLen + 8) % 64 < 56) ? 56 - (msgLen + 8) % 64 : 120 - (msgLen + 8) % 64;
  const padded = new Uint8Array(msgLen + 1 + padLen + 8);
  padded.set(message);
  padded[msgLen] = 0x80;

  for (let i = 0; i < 8; i++) {
    padded[padded.length - 8 + i] = (bitLen / Math.pow(256, 7 - i)) & 0xff;
  }

  const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const W = new Uint32Array(80);

    for (let i = 0; i < 16; i++) {
      W[i] = (padded[offset + i * 4] << 24) |
             (padded[offset + i * 4 + 1] << 16) |
             (padded[offset + i * 4 + 2] << 8) |
             padded[offset + i * 4 + 3];
    }

    for (let i = 16; i < 80; i++) {
      W[i] = rotl(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
    }

    let [a, b, c, d, e] = H;

    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (rotl(a, 5) + f + e + k + W[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
  }

  const result = new Uint8Array(20);
  for (let i = 0; i < 5; i++) {
    result[i * 4] = (H[i] >> 24) & 0xff;
    result[i * 4 + 1] = (H[i] >> 16) & 0xff;
    result[i * 4 + 2] = (H[i] >> 8) & 0xff;
    result[i * 4 + 3] = H[i] & 0xff;
  }

  return result;
}

// HMAC implementation
function hmac(
  hashFunc: (msg: Uint8Array) => Uint8Array,
  blockSize: number,
  key: Uint8Array,
  message: Uint8Array
): Uint8Array {
  // Key preparation
  let keyBlock: Uint8Array;

  if (key.length > blockSize) {
    keyBlock = new Uint8Array(blockSize);
    const hashedKey = hashFunc(key);
    keyBlock.set(hashedKey);
  } else if (key.length < blockSize) {
    keyBlock = new Uint8Array(blockSize);
    keyBlock.set(key);
  } else {
    keyBlock = key;
  }

  // Create ipad and opad
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyBlock[i] ^ 0x36;
    opad[i] = keyBlock[i] ^ 0x5c;
  }

  // Inner hash: H(ipad || message)
  const innerData = new Uint8Array(blockSize + message.length);
  innerData.set(ipad);
  innerData.set(message, blockSize);
  const innerHash = hashFunc(innerData);

  // Outer hash: H(opad || innerHash)
  const outerData = new Uint8Array(blockSize + innerHash.length);
  outerData.set(opad);
  outerData.set(innerHash, blockSize);

  return hashFunc(outerData);
}

// Utility functions
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] || 0;
    const c = bytes[i + 2] || 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[c & 63] : '=';
  }
  return result;
}

function stringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// Timing-safe comparison
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function executehmac(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;
    const hashAlgo = (args.hash as string) || 'SHA-256';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'hmac',
          description: 'HMAC (Hash-based Message Authentication Code) for message authentication',
          operations: {
            generate: 'Generate HMAC tag for a message using a secret key',
            verify: 'Verify HMAC tag with timing-safe comparison',
            derive_key: 'Use HMAC for key derivation (HKDF-Extract)'
          },
          algorithms: {
            'SHA-256': '256-bit output, 64-byte block size (recommended)',
            'SHA-384': '384-bit output, 128-byte block size',
            'SHA-512': '512-bit output, 128-byte block size',
            'SHA-1': '160-bit output, 64-byte block size (legacy, not recommended)'
          },
          parameters: {
            key: 'Secret key (hex or UTF-8 string)',
            message: 'Message to authenticate',
            mac: 'MAC to verify (hex string)',
            key_format: 'Key format: hex or utf8 (default: utf8)',
            output_format: 'Output format: hex or base64 (default: hex)'
          },
          security: {
            key_length: 'Should be at least as long as hash output for full security',
            verification: 'Always use timing-safe comparison to prevent timing attacks',
            usage: 'HMAC provides authenticity and integrity, not confidentiality'
          }
        }, null, 2)
      };
    }

    // Get hash function and block size
    let hashFunc: (msg: Uint8Array) => Uint8Array;
    let blockSize: number;
    let outputSize: number;

    switch (hashAlgo) {
      case 'SHA-1':
        hashFunc = sha1;
        blockSize = 64;
        outputSize = 20;
        break;
      case 'SHA-256':
        hashFunc = sha256;
        blockSize = 64;
        outputSize = 32;
        break;
      case 'SHA-384':
        hashFunc = sha384;
        blockSize = 128;
        outputSize = 48;
        break;
      case 'SHA-512':
        hashFunc = sha512;
        blockSize = 128;
        outputSize = 64;
        break;
      default:
        throw new Error(`Unsupported hash algorithm: ${hashAlgo}`);
    }

    let result: Record<string, unknown>;

    switch (operation) {
      case 'generate': {
        const keyStr = args.key as string;
        const message = args.message as string;
        const keyFormat = args.key_format || 'utf8';
        const outputFormat = args.output_format || 'hex';

        if (!keyStr) throw new Error('Key is required');
        if (!message) throw new Error('Message is required');

        const key = keyFormat === 'hex' ? hexToBytes(keyStr) : stringToBytes(keyStr);
        const msgBytes = stringToBytes(message);

        const mac = hmac(hashFunc, blockSize, key, msgBytes);
        const macStr = outputFormat === 'base64' ? bytesToBase64(mac) : bytesToHex(mac);

        result = {
          mac: macStr,
          algorithm: `HMAC-${hashAlgo}`,
          mac_length_bits: outputSize * 8,
          key_length_bytes: key.length,
          message_length_bytes: msgBytes.length,
          output_format: outputFormat
        };
        break;
      }

      case 'verify': {
        const keyStr = args.key as string;
        const message = args.message as string;
        const macStr = args.mac as string;
        const keyFormat = args.key_format || 'utf8';

        if (!keyStr) throw new Error('Key is required');
        if (!message) throw new Error('Message is required');
        if (!macStr) throw new Error('MAC is required for verification');

        const key = keyFormat === 'hex' ? hexToBytes(keyStr) : stringToBytes(keyStr);
        const msgBytes = stringToBytes(message);
        const expectedMac = hexToBytes(macStr);

        const computedMac = hmac(hashFunc, blockSize, key, msgBytes);
        const valid = timingSafeEqual(computedMac, expectedMac);

        result = {
          valid,
          algorithm: `HMAC-${hashAlgo}`,
          computed_mac: bytesToHex(computedMac),
          verification: valid ? 'Message is authentic' : 'MAC verification failed'
        };
        break;
      }

      case 'derive_key': {
        const keyStr = args.key as string;
        const salt = args.salt as string || '';
        const keyFormat = args.key_format || 'utf8';
        const outputFormat = args.output_format || 'hex';

        if (!keyStr) throw new Error('Input key material is required');

        const ikm = keyFormat === 'hex' ? hexToBytes(keyStr) : stringToBytes(keyStr);
        const saltBytes = salt ? stringToBytes(salt) : new Uint8Array(outputSize);

        // HKDF-Extract: PRK = HMAC(salt, IKM)
        const prk = hmac(hashFunc, blockSize, saltBytes, ikm);
        const prkStr = outputFormat === 'base64' ? bytesToBase64(prk) : bytesToHex(prk);

        result = {
          derived_key: prkStr,
          algorithm: `HKDF-Extract-${hashAlgo}`,
          key_length_bits: outputSize * 8,
          output_format: outputFormat,
          note: 'This is HKDF-Extract. Use with HKDF-Expand for complete key derivation.'
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        operation,
        ...result
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ishmacAvailable(): boolean { return true; }
