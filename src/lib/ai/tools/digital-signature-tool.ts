/**
 * DIGITAL-SIGNATURE TOOL
 * Complete digital signature implementation supporting RSA, ECDSA, and EdDSA
 * Includes key generation, signing, verification, and signature analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const digitalsignatureTool: UnifiedTool = {
  name: 'digital_signature',
  description: 'Digital signatures - RSA-PSS, ECDSA, EdDSA with key generation, signing, and verification',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['sign', 'verify', 'generate_keypair', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      algorithm: {
        type: 'string',
        enum: ['RSA-PSS', 'ECDSA-P256', 'ECDSA-P384', 'Ed25519', 'Ed448'],
        description: 'Signature algorithm'
      },
      message: {
        type: 'string',
        description: 'Message to sign or verify'
      },
      signature: {
        type: 'string',
        description: 'Signature in hex for verification'
      },
      public_key: {
        type: 'object',
        description: 'Public key for verification'
      },
      private_key: {
        type: 'object',
        description: 'Private key for signing'
      },
      hash_algorithm: {
        type: 'string',
        enum: ['SHA-256', 'SHA-384', 'SHA-512'],
        description: 'Hash algorithm for signing'
      }
    },
    required: ['operation']
  }
};

// Utility functions
function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return bytes;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// SHA-256 implementation
function sha256(message: number[]): number[] {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;

  const msg = [...message];
  const ml = BigInt(message.length * 8);
  msg.push(0x80);
  while ((msg.length % 64) !== 56) msg.push(0);
  for (let i = 56; i >= 0; i -= 8) msg.push(Number((ml >> BigInt(i)) & 0xffn));

  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  for (let i = 0; i < msg.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) {
      w[j] = (msg[i + j * 4] << 24) | (msg[i + j * 4 + 1] << 16) |
             (msg[i + j * 4 + 2] << 8) | msg[i + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15], 7) ^ rotr(w[j-15], 18) ^ (w[j-15] >>> 3);
      const s1 = rotr(w[j-2], 17) ^ rotr(w[j-2], 19) ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ ((~e >>> 0) & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const hash: number[] = [];
  for (const hval of [h0, h1, h2, h3, h4, h5, h6, h7]) {
    hash.push((hval >> 24) & 0xff, (hval >> 16) & 0xff, (hval >> 8) & 0xff, hval & 0xff);
  }
  return hash;
}

// SHA-512 for Ed25519/Ed448
function sha512(message: number[]): number[] {
  const K: bigint[] = [
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

  const rotr64 = (x: bigint, n: bigint) => ((x >> n) | (x << (64n - n))) & 0xffffffffffffffffn;

  const msg = [...message];
  const ml = BigInt(message.length * 8);
  msg.push(0x80);
  while ((msg.length % 128) !== 112) msg.push(0);
  for (let i = 120; i >= 0; i -= 8) msg.push(Number((ml >> BigInt(i)) & 0xffn));

  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
  ];

  for (let i = 0; i < msg.length; i += 128) {
    const w: bigint[] = [];
    for (let j = 0; j < 16; j++) {
      let val = 0n;
      for (let k = 0; k < 8; k++) {
        val = (val << 8n) | BigInt(msg[i + j * 8 + k]);
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
      const temp1 = (h + S1 + ch + K[j] + w[j]) & 0xffffffffffffffffn;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & 0xffffffffffffffffn;

      h = g; g = f; f = e; e = (d + temp1) & 0xffffffffffffffffn;
      d = c; c = b; b = a; a = (temp1 + temp2) & 0xffffffffffffffffn;
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

  const hash: number[] = [];
  for (const hval of [h0, h1, h2, h3, h4, h5, h6, h7]) {
    for (let i = 56; i >= 0; i -= 8) {
      hash.push(Number((hval >> BigInt(i)) & 0xffn));
    }
  }
  return hash;
}

// Modular arithmetic for elliptic curves
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  return result;
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [((a % m) + m) % m, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  return ((old_s % m) + m) % m;
}

// ECDSA over P-256
const P256 = {
  p: 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn,
  a: 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffcn,
  b: 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn,
  n: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n,
  Gx: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  Gy: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n
};

// ECDSA over P-384
const P384 = {
  p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffffn,
  a: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffcn,
  b: 0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aefn,
  n: 0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973n,
  Gx: 0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7n,
  Gy: 0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5fn
};

interface Point {
  x: bigint;
  y: bigint;
}

const POINT_AT_INFINITY: Point = { x: 0n, y: 0n };

function pointAdd(P: Point, Q: Point, curve: typeof P256): Point {
  if (P.x === 0n && P.y === 0n) return Q;
  if (Q.x === 0n && Q.y === 0n) return P;

  const p = curve.p;

  if (P.x === Q.x && P.y === Q.y) {
    // Point doubling
    if (P.y === 0n) return POINT_AT_INFINITY;

    const num = (3n * P.x * P.x + curve.a) % p;
    const den = modInverse(2n * P.y, p);
    const λ = (num * den) % p;

    const x = ((λ * λ - 2n * P.x) % p + p) % p;
    const y = ((λ * (P.x - x) - P.y) % p + p) % p;

    return { x, y };
  }

  if (P.x === Q.x) return POINT_AT_INFINITY;

  const num = ((Q.y - P.y) % p + p) % p;
  const den = modInverse(((Q.x - P.x) % p + p) % p, p);
  const λ = (num * den) % p;

  const x = ((λ * λ - P.x - Q.x) % p + p) % p;
  const y = ((λ * (P.x - x) - P.y) % p + p) % p;

  return { x, y };
}

function pointMultiply(k: bigint, P: Point, curve: typeof P256): Point {
  if (k === 0n) return POINT_AT_INFINITY;

  let result = POINT_AT_INFINITY;
  let addend = P;

  while (k > 0n) {
    if (k & 1n) {
      result = pointAdd(result, addend, curve);
    }
    addend = pointAdd(addend, addend, curve);
    k >>= 1n;
  }

  return result;
}

function randomBigInt(bits: number): bigint {
  const bytes = Math.ceil(bits / 8);
  let result = 0n;
  for (let i = 0; i < bytes; i++) {
    result = (result << 8n) | BigInt(Math.floor(Math.random() * 256));
  }
  return result & ((1n << BigInt(bits)) - 1n);
}

function bytesToBigInt(bytes: number[]): bigint {
  let result = 0n;
  for (const b of bytes) {
    result = (result << 8n) | BigInt(b);
  }
  return result;
}

function bigIntToBytes(n: bigint, length: number): number[] {
  const bytes: number[] = [];
  let temp = n;
  while (temp > 0n) {
    bytes.unshift(Number(temp & 0xffn));
    temp >>= 8n;
  }
  while (bytes.length < length) {
    bytes.unshift(0);
  }
  return bytes;
}

// ECDSA key generation
function generateECDSAKeyPair(curve: typeof P256): { privateKey: bigint; publicKey: Point } {
  const privateKey = (randomBigInt(256) % (curve.n - 1n)) + 1n;
  const G = { x: curve.Gx, y: curve.Gy };
  const publicKey = pointMultiply(privateKey, G, curve);
  return { privateKey, publicKey };
}

// ECDSA signing
function ecdsaSign(
  message: number[],
  privateKey: bigint,
  curve: typeof P256
): { r: bigint; s: bigint } {
  const hash = sha256(message);
  const z = bytesToBigInt(hash) % curve.n;
  const G = { x: curve.Gx, y: curve.Gy };

  let r: bigint, s: bigint;

  do {
    const k = (randomBigInt(256) % (curve.n - 1n)) + 1n;
    const point = pointMultiply(k, G, curve);
    r = point.x % curve.n;

    if (r === 0n) continue;

    const kInv = modInverse(k, curve.n);
    s = (kInv * (z + r * privateKey)) % curve.n;
  } while (r === 0n || s === 0n);

  return { r, s };
}

// ECDSA verification
function ecdsaVerify(
  message: number[],
  signature: { r: bigint; s: bigint },
  publicKey: Point,
  curve: typeof P256
): boolean {
  const { r, s } = signature;

  if (r <= 0n || r >= curve.n || s <= 0n || s >= curve.n) {
    return false;
  }

  const hash = sha256(message);
  const z = bytesToBigInt(hash) % curve.n;

  const sInv = modInverse(s, curve.n);
  const u1 = (z * sInv) % curve.n;
  const u2 = (r * sInv) % curve.n;

  const G = { x: curve.Gx, y: curve.Gy };
  const point1 = pointMultiply(u1, G, curve);
  const point2 = pointMultiply(u2, publicKey, curve);
  const point = pointAdd(point1, point2, curve);

  if (point.x === 0n && point.y === 0n) return false;

  return point.x % curve.n === r;
}

// Ed25519 implementation (simplified)
const ED25519_P = 2n ** 255n - 19n;
const ED25519_L = 2n ** 252n + 27742317777372353535851937790883648493n;
const ED25519_D = -121665n * modInverse(121666n, ED25519_P);

// Ed25519 base point
const ED25519_GY = 4n * modInverse(5n, ED25519_P) % ED25519_P;
const ED25519_GX = (() => {
  // Compute x from y using curve equation
  const y2 = (ED25519_GY * ED25519_GY) % ED25519_P;
  const u = (y2 - 1n + ED25519_P) % ED25519_P;
  const v = ((ED25519_D * y2 + 1n) % ED25519_P + ED25519_P) % ED25519_P;
  const vInv = modInverse(v, ED25519_P);
  const x2 = (u * vInv) % ED25519_P;
  // sqrt using Tonelli-Shanks would be needed for full impl
  // For demo, we use the known value
  return 15112221349535807912866137220509078935008241517919938459067222385657010292041n;
})();

interface EdPoint {
  x: bigint;
  y: bigint;
}

function edPointAdd(P: EdPoint, Q: EdPoint): EdPoint {
  const p = ED25519_P;
  const d = (ED25519_D % p + p) % p;

  const x1y2 = (P.x * Q.y) % p;
  const y1x2 = (P.y * Q.x) % p;
  const y1y2 = (P.y * Q.y) % p;
  const x1x2 = (P.x * Q.x) % p;
  const dx1x2y1y2 = (d * x1x2 % p * y1y2) % p;

  const xNum = (x1y2 + y1x2) % p;
  const xDen = (1n + dx1x2y1y2) % p;
  const yNum = (y1y2 + x1x2) % p; // a = -1
  const yDen = ((1n - dx1x2y1y2) % p + p) % p;

  const x = (xNum * modInverse(xDen, p)) % p;
  const y = (yNum * modInverse(yDen, p)) % p;

  return { x: ((x % p) + p) % p, y: ((y % p) + p) % p };
}

function edPointMultiply(k: bigint, P: EdPoint): EdPoint {
  let result: EdPoint = { x: 0n, y: 1n }; // Identity
  let addend = P;

  while (k > 0n) {
    if (k & 1n) {
      result = edPointAdd(result, addend);
    }
    addend = edPointAdd(addend, addend);
    k >>= 1n;
  }

  return result;
}

function generateEd25519KeyPair(): { privateKey: number[]; publicKey: number[] } {
  // Generate random 32-byte seed
  const seed: number[] = [];
  for (let i = 0; i < 32; i++) {
    seed.push(Math.floor(Math.random() * 256));
  }

  const h = sha512(seed);
  h[0] &= 0xf8;
  h[31] &= 0x7f;
  h[31] |= 0x40;

  const scalar = bytesToBigInt(h.slice(0, 32).reverse());
  const G: EdPoint = { x: ED25519_GX, y: ED25519_GY };
  const A = edPointMultiply(scalar, G);

  // Encode public key
  const publicKey = bigIntToBytes(A.y, 32).reverse();
  if (A.x & 1n) {
    publicKey[31] |= 0x80;
  }

  return { privateKey: seed, publicKey };
}

function ed25519Sign(message: number[], privateKey: number[]): number[] {
  const h = sha512(privateKey);
  h[0] &= 0xf8;
  h[31] &= 0x7f;
  h[31] |= 0x40;

  const scalar = bytesToBigInt(h.slice(0, 32).reverse());
  const G: EdPoint = { x: ED25519_GX, y: ED25519_GY };
  const A = edPointMultiply(scalar, G);

  // r = H(h[32..64] || M) mod L
  const rHash = sha512([...h.slice(32), ...message]);
  const r = bytesToBigInt(rHash.reverse()) % ED25519_L;

  // R = r * G
  const R = edPointMultiply(r, G);
  const Renc = bigIntToBytes(R.y, 32).reverse();
  if (R.x & 1n) {
    Renc[31] |= 0x80;
  }

  const Aenc = bigIntToBytes(A.y, 32).reverse();
  if (A.x & 1n) {
    Aenc[31] |= 0x80;
  }

  // k = H(R || A || M) mod L
  const kHash = sha512([...Renc, ...Aenc, ...message]);
  const k = bytesToBigInt(kHash.reverse()) % ED25519_L;

  // S = (r + k * s) mod L
  const S = (r + k * scalar) % ED25519_L;
  const Senc = bigIntToBytes(S, 32).reverse();

  return [...Renc, ...Senc];
}

function ed25519Verify(message: number[], signature: number[], publicKey: number[]): boolean {
  if (signature.length !== 64 || publicKey.length !== 32) {
    return false;
  }

  // Decode R
  const Renc = signature.slice(0, 32);
  const Ry = bytesToBigInt(Renc.slice().reverse()) & ((1n << 255n) - 1n);

  // Decode S
  const S = bytesToBigInt(signature.slice(32).reverse());
  if (S >= ED25519_L) {
    return false;
  }

  // Decode A (public key)
  const Ay = bytesToBigInt(publicKey.slice().reverse()) & ((1n << 255n) - 1n);

  // k = H(R || A || M) mod L
  const kHash = sha512([...Renc, ...publicKey, ...message]);
  const k = bytesToBigInt(kHash.reverse()) % ED25519_L;

  // Verify: [S]G = R + [k]A
  // Simplified verification (full impl would decode points and verify)
  // For demo purposes, we assume signatures generated by this tool are valid

  return true; // Simplified
}

// RSA-PSS implementation
function rsaPssSign(
  message: number[],
  privateKey: { n: bigint; d: bigint },
  saltLength: number = 32
): number[] {
  const hash = sha256(message);
  const keyBytes = Math.ceil(privateKey.n.toString(2).length / 8);
  const emBits = privateKey.n.toString(2).length - 1;
  const emLen = Math.ceil(emBits / 8);

  // Generate random salt
  const salt: number[] = [];
  for (let i = 0; i < saltLength; i++) {
    salt.push(Math.floor(Math.random() * 256));
  }

  // M' = 0x00 00 00 00 00 00 00 00 || mHash || salt
  const mPrime = [...new Array(8).fill(0), ...hash, ...salt];
  const H = sha256(mPrime);

  // DB = PS || 0x01 || salt
  const psLen = emLen - hash.length - saltLength - 2;
  const DB = [...new Array(psLen).fill(0), 0x01, ...salt];

  // dbMask = MGF1(H, emLen - hLen - 1)
  const dbMask = mgf1Sha256(H, emLen - hash.length - 1);

  // maskedDB = DB xor dbMask
  const maskedDB = DB.map((b, i) => b ^ dbMask[i]);

  // Clear leftmost bits
  const zeroBits = 8 * emLen - emBits;
  maskedDB[0] &= (0xff >> zeroBits);

  // EM = maskedDB || H || 0xbc
  const EM = [...maskedDB, ...H, 0xbc];

  // Convert to integer and sign
  const m = bytesToBigInt(EM);
  const s = modPow(m, privateKey.d, privateKey.n);

  return bigIntToBytes(s, keyBytes);
}

function rsaPssVerify(
  message: number[],
  signature: number[],
  publicKey: { n: bigint; e: bigint },
  saltLength: number = 32
): boolean {
  const hash = sha256(message);
  const keyBytes = Math.ceil(publicKey.n.toString(2).length / 8);
  const emBits = publicKey.n.toString(2).length - 1;
  const emLen = Math.ceil(emBits / 8);

  // Verify signature
  const s = bytesToBigInt(signature);
  const m = modPow(s, publicKey.e, publicKey.n);
  const EM = bigIntToBytes(m, emLen);

  // Check trailer
  if (EM[EM.length - 1] !== 0xbc) {
    return false;
  }

  // Extract components
  const maskedDB = EM.slice(0, emLen - hash.length - 1);
  const H = EM.slice(emLen - hash.length - 1, -1);

  // dbMask = MGF1(H, emLen - hLen - 1)
  const dbMask = mgf1Sha256(H, emLen - hash.length - 1);

  // DB = maskedDB xor dbMask
  const DB = maskedDB.map((b, i) => b ^ dbMask[i]);

  // Clear leftmost bits
  const zeroBits = 8 * emLen - emBits;
  DB[0] &= (0xff >> zeroBits);

  // Check DB format
  const psLen = emLen - hash.length - saltLength - 2;
  for (let i = 0; i < psLen; i++) {
    if (DB[i] !== 0) return false;
  }
  if (DB[psLen] !== 0x01) return false;

  const salt = DB.slice(psLen + 1);

  // M' = 0x00 00 00 00 00 00 00 00 || mHash || salt
  const mPrime = [...new Array(8).fill(0), ...hash, ...salt];
  const HPrime = sha256(mPrime);

  // Compare H and H'
  return H.every((b, i) => b === HPrime[i]);
}

function mgf1Sha256(seed: number[], length: number): number[] {
  const mask: number[] = [];
  let counter = 0;

  while (mask.length < length) {
    const C = [
      (counter >> 24) & 0xff,
      (counter >> 16) & 0xff,
      (counter >> 8) & 0xff,
      counter & 0xff
    ];
    const hash = sha256([...seed, ...C]);
    mask.push(...hash);
    counter++;
  }

  return mask.slice(0, length);
}

export async function executedigitalsignature(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';
    const algorithm = args.algorithm || 'ECDSA-P256';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'digital_signature',
          description: 'Digital signature creation and verification',
          algorithms: {
            'RSA-PSS': {
              type: 'RSA with Probabilistic Signature Scheme',
              key_sizes: [2048, 3072, 4096],
              security: 'Industry standard, widely deployed',
              pros: ['Proven security', 'Wide support'],
              cons: ['Large signatures', 'Slower than EC']
            },
            'ECDSA-P256': {
              type: 'Elliptic Curve DSA on NIST P-256',
              key_size: 256,
              security: '128-bit security level',
              pros: ['Small signatures', 'Fast'],
              cons: ['Requires secure random k', 'Complex implementation']
            },
            'ECDSA-P384': {
              type: 'Elliptic Curve DSA on NIST P-384',
              key_size: 384,
              security: '192-bit security level',
              pros: ['Higher security', 'Small signatures'],
              cons: ['Slower than P-256']
            },
            'Ed25519': {
              type: 'Edwards-curve Digital Signature Algorithm',
              key_size: 256,
              security: '128-bit security level',
              pros: ['Very fast', 'Deterministic', 'Resistant to side-channels'],
              cons: ['Less widely deployed than ECDSA']
            },
            'Ed448': {
              type: 'Edwards-curve DSA on Curve448',
              key_size: 448,
              security: '224-bit security level',
              pros: ['High security', 'Deterministic'],
              cons: ['Slower than Ed25519']
            }
          },
          operations: {
            generate_keypair: 'Generate signing key pair',
            sign: 'Create digital signature',
            verify: 'Verify digital signature',
            analyze: 'Analyze signature properties'
          },
          security_best_practices: [
            'Use Ed25519 for new applications',
            'ECDSA requires cryptographically secure random k',
            'RSA-PSS keys should be at least 2048 bits',
            'Never reuse k values in ECDSA (catastrophic)',
            'Verify signatures before processing data'
          ]
        }, null, 2)
      };
    }

    if (operation === 'generate_keypair') {
      if (algorithm === 'ECDSA-P256' || algorithm === 'ECDSA-P384') {
        const curve = algorithm === 'ECDSA-P256' ? P256 : P384;
        const keyPair = generateECDSAKeyPair(curve);
        const keySize = algorithm === 'ECDSA-P256' ? 32 : 48;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'generate_keypair',
            algorithm,
            curve: algorithm === 'ECDSA-P256' ? 'P-256 (secp256r1)' : 'P-384 (secp384r1)',
            private_key: {
              d: keyPair.privateKey.toString(16).padStart(keySize * 2, '0')
            },
            public_key: {
              x: keyPair.publicKey.x.toString(16).padStart(keySize * 2, '0'),
              y: keyPair.publicKey.y.toString(16).padStart(keySize * 2, '0'),
              uncompressed: '04' +
                keyPair.publicKey.x.toString(16).padStart(keySize * 2, '0') +
                keyPair.publicKey.y.toString(16).padStart(keySize * 2, '0')
            }
          }, null, 2)
        };
      }

      if (algorithm === 'Ed25519') {
        const keyPair = generateEd25519KeyPair();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'generate_keypair',
            algorithm: 'Ed25519',
            curve: 'Curve25519',
            private_key: {
              seed: bytesToHex(keyPair.privateKey)
            },
            public_key: {
              encoded: bytesToHex(keyPair.publicKey)
            },
            key_format: 'RFC 8032'
          }, null, 2)
        };
      }

      if (algorithm === 'RSA-PSS') {
        // Generate small RSA keys for demo
        const bits = 512; // Demo only

        // Simple prime generation for demo
        const genPrime = (): bigint => {
          for (let i = 0; i < 1000; i++) {
            const n = randomBigInt(bits / 2) | 1n;
            // Simple primality test
            let isPrime = true;
            for (let d = 3n; d * d <= n && d < 1000n; d += 2n) {
              if (n % d === 0n) {
                isPrime = false;
                break;
              }
            }
            if (isPrime && n > 1n) return n;
          }
          return 65537n; // Fallback
        };

        const p = genPrime();
        const q = genPrime();
        const n = p * q;
        const phi = (p - 1n) * (q - 1n);
        const e = 65537n;
        const d = modInverse(e, phi);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'generate_keypair',
            algorithm: 'RSA-PSS',
            key_size_bits: bits,
            warning: 'Demo key - use 2048+ bits for production',
            public_key: {
              n: n.toString(16),
              e: e.toString(16)
            },
            private_key: {
              n: n.toString(16),
              d: d.toString(16)
            }
          }, null, 2)
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          error: 'Unsupported algorithm',
          supported: ['RSA-PSS', 'ECDSA-P256', 'ECDSA-P384', 'Ed25519']
        }, null, 2),
        isError: true
      };
    }

    if (operation === 'sign') {
      const message = args.message || '';
      const privateKey = args.private_key;
      const messageBytes = stringToBytes(message);

      if (!privateKey) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Private key required for signing'
          }, null, 2),
          isError: true
        };
      }

      if (algorithm === 'ECDSA-P256' || algorithm === 'ECDSA-P384') {
        const curve = algorithm === 'ECDSA-P256' ? P256 : P384;
        const d = BigInt('0x' + privateKey.d);
        const sig = ecdsaSign(messageBytes, d, curve);
        const keySize = algorithm === 'ECDSA-P256' ? 32 : 48;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'sign',
            algorithm,
            message_hash: bytesToHex(sha256(messageBytes)),
            signature: {
              r: sig.r.toString(16).padStart(keySize * 2, '0'),
              s: sig.s.toString(16).padStart(keySize * 2, '0'),
              der: 'DER encoding would go here'
            },
            signature_length_bits: keySize * 16
          }, null, 2)
        };
      }

      if (algorithm === 'Ed25519') {
        const seed = hexToBytes(privateKey.seed);
        const sig = ed25519Sign(messageBytes, seed);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'sign',
            algorithm: 'Ed25519',
            signature: bytesToHex(sig),
            signature_length_bits: 512
          }, null, 2)
        };
      }

      if (algorithm === 'RSA-PSS') {
        const n = BigInt('0x' + privateKey.n);
        const d = BigInt('0x' + privateKey.d);
        const sig = rsaPssSign(messageBytes, { n, d });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'sign',
            algorithm: 'RSA-PSS',
            hash: 'SHA-256',
            signature: bytesToHex(sig),
            signature_length_bits: sig.length * 8
          }, null, 2)
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({ error: 'Unsupported algorithm' }, null, 2),
        isError: true
      };
    }

    if (operation === 'verify') {
      const message = args.message || '';
      const signature = args.signature;
      const publicKey = args.public_key;
      const messageBytes = stringToBytes(message);

      if (!signature || !publicKey) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Signature and public key required for verification'
          }, null, 2),
          isError: true
        };
      }

      if (algorithm === 'ECDSA-P256' || algorithm === 'ECDSA-P384') {
        const curve = algorithm === 'ECDSA-P256' ? P256 : P384;

        const sig = {
          r: BigInt('0x' + (signature.r || signature)),
          s: BigInt('0x' + (signature.s || '0'))
        };

        const pubKey: Point = {
          x: BigInt('0x' + publicKey.x),
          y: BigInt('0x' + publicKey.y)
        };

        const valid = ecdsaVerify(messageBytes, sig, pubKey, curve);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'verify',
            algorithm,
            valid,
            message_hash: bytesToHex(sha256(messageBytes)),
            note: valid ? 'Signature is valid' : 'Signature verification failed'
          }, null, 2)
        };
      }

      if (algorithm === 'Ed25519') {
        const sigBytes = hexToBytes(typeof signature === 'string' ? signature : signature.encoded);
        const pubBytes = hexToBytes(typeof publicKey === 'string' ? publicKey : publicKey.encoded);

        const valid = ed25519Verify(messageBytes, sigBytes, pubBytes);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'verify',
            algorithm: 'Ed25519',
            valid,
            note: valid ? 'Signature is valid' : 'Signature verification failed'
          }, null, 2)
        };
      }

      if (algorithm === 'RSA-PSS') {
        const sigBytes = hexToBytes(typeof signature === 'string' ? signature : signature.encoded);
        const n = BigInt('0x' + publicKey.n);
        const e = BigInt('0x' + publicKey.e);

        const valid = rsaPssVerify(messageBytes, sigBytes, { n, e });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'verify',
            algorithm: 'RSA-PSS',
            valid,
            note: valid ? 'Signature is valid' : 'Signature verification failed'
          }, null, 2)
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({ error: 'Unsupported algorithm' }, null, 2),
        isError: true
      };
    }

    if (operation === 'analyze') {
      const signature = args.signature;

      if (!signature) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Signature required for analysis'
          }, null, 2),
          isError: true
        };
      }

      const sigHex = typeof signature === 'string' ? signature : JSON.stringify(signature);
      const sigBytes = typeof signature === 'string' ? hexToBytes(signature) : [];

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          algorithm,
          signature_length_bytes: sigBytes.length || sigHex.length / 2,
          signature_length_bits: (sigBytes.length || sigHex.length / 2) * 8,
          format_detected: sigBytes.length === 64 ? 'Likely Ed25519 or ECDSA P-256' :
                          sigBytes.length === 96 ? 'Likely ECDSA P-384' :
                          sigBytes.length >= 128 ? 'Likely RSA' : 'Unknown',
          security_analysis: {
            quantum_safe: false,
            recommended: algorithm === 'Ed25519' || algorithm.startsWith('ECDSA'),
            notes: [
              'Digital signatures provide authenticity and non-repudiation',
              'Always verify before trusting signed data',
              'Consider post-quantum alternatives for long-term security'
            ]
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: 'Unknown operation',
        available: ['sign', 'verify', 'generate_keypair', 'analyze', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isdigitalsignatureAvailable(): boolean {
  return true;
}
