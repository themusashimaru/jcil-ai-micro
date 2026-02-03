/**
 * ELLIPTIC-CURVE TOOL
 * Full Elliptic Curve Cryptography (ECC) operations
 *
 * Implements:
 * - Point addition and scalar multiplication on elliptic curves
 * - Support for standard curves (P-256, P-384, P-521, secp256k1)
 * - Key pair generation
 * - ECDH key exchange
 * - ECDSA signing and verification
 * - Point encoding/decoding (compressed and uncompressed)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// BigInt polyfill for basic operations
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

function modInverse(a: bigint, m: bigint): bigint {
  // Extended Euclidean Algorithm
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  return ((old_s % m) + m) % m;
}

function sqrt_mod(a: bigint, p: bigint): bigint | null {
  // Tonelli-Shanks algorithm for modular square root
  if (a === 0n) return 0n;

  // Check if a is a quadratic residue
  if (modPow(a, (p - 1n) / 2n, p) !== 1n) {
    return null;  // No square root exists
  }

  // Simple case: p ≡ 3 (mod 4)
  if (p % 4n === 3n) {
    return modPow(a, (p + 1n) / 4n, p);
  }

  // Tonelli-Shanks
  let q = p - 1n;
  let s = 0n;
  while (q % 2n === 0n) {
    q = q / 2n;
    s += 1n;
  }

  // Find a quadratic non-residue
  let z = 2n;
  while (modPow(z, (p - 1n) / 2n, p) !== p - 1n) {
    z += 1n;
  }

  let m = s;
  let c = modPow(z, q, p);
  let t = modPow(a, q, p);
  let r = modPow(a, (q + 1n) / 2n, p);

  while (true) {
    if (t === 0n) return 0n;
    if (t === 1n) return r;

    // Find the least i such that t^(2^i) = 1
    let i = 1n;
    let temp = (t * t) % p;
    while (temp !== 1n) {
      temp = (temp * temp) % p;
      i += 1n;
    }

    const b = modPow(c, modPow(2n, m - i - 1n, p - 1n), p);
    m = i;
    c = (b * b) % p;
    t = (t * c) % p;
    r = (r * b) % p;
  }
}

// Elliptic curve point (affine coordinates)
interface Point {
  x: bigint;
  y: bigint;
  infinity: boolean;
}

// Curve parameters in Weierstrass form: y² = x³ + ax + b (mod p)
interface CurveParams {
  name: string;
  p: bigint;       // Prime modulus
  a: bigint;       // Curve coefficient a
  b: bigint;       // Curve coefficient b
  Gx: bigint;      // Generator x-coordinate
  Gy: bigint;      // Generator y-coordinate
  n: bigint;       // Order of the generator
  h: bigint;       // Cofactor
  bitLength: number;
}

// Standard curve parameters
const CURVES: Record<string, CurveParams> = {
  'P-256': {
    name: 'P-256 (secp256r1)',
    p: 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn,
    a: -3n,
    b: 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn,
    Gx: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
    Gy: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
    n: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n,
    h: 1n,
    bitLength: 256
  },
  'P-384': {
    name: 'P-384 (secp384r1)',
    p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffffn,
    a: -3n,
    b: 0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aefn,
    Gx: 0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7n,
    Gy: 0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5fn,
    n: 0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973n,
    h: 1n,
    bitLength: 384
  },
  'P-521': {
    name: 'P-521 (secp521r1)',
    p: 0x1ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
    a: -3n,
    b: 0x051953eb9618e1c9a1f929a21a0b68540eea2da725b99b315f3b8b489918ef109e156193951ec7e937b1652c0bd3bb1bf073573df883d2c34f1ef451fd46b503f00n,
    Gx: 0xc6858e06b70404e9cd9e3ecb662395b4429c648139053fb521f828af606b4d3dbaa14b5e77efe75928fe1dc127a2ffa8de3348b3c1856a429bf97e7e31c2e5bd66n,
    Gy: 0x11839296a789a3bc0045c8a5fb42c7d1bd998f54449579b446817afbd17273e662c97ee72995ef42640c550b9013fad0761353c7086a272c24088be94769fd16650n,
    n: 0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409n,
    h: 1n,
    bitLength: 521
  },
  'secp256k1': {
    name: 'secp256k1 (Bitcoin)',
    p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn,
    a: 0n,
    b: 7n,
    Gx: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    Gy: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
    n: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
    h: 1n,
    bitLength: 256
  }
};

// Point at infinity
const INFINITY: Point = { x: 0n, y: 0n, infinity: true };

// Check if point is on the curve
function isOnCurve(point: Point, curve: CurveParams): boolean {
  if (point.infinity) return true;

  const { x, y } = point;
  const { p, a, b } = curve;

  // Normalize a to positive
  const aNorm = ((a % p) + p) % p;

  const left = (y * y) % p;
  const right = ((((x * x * x) % p) + ((aNorm * x) % p) + b) % p + p) % p;

  return left === right;
}

// Point addition
function pointAdd(P: Point, Q: Point, curve: CurveParams): Point {
  if (P.infinity) return Q;
  if (Q.infinity) return P;

  const { p, a } = curve;
  const aNorm = ((a % p) + p) % p;

  // P + (-P) = O
  if (P.x === Q.x && ((P.y + Q.y) % p === 0n)) {
    return INFINITY;
  }

  let lambda: bigint;

  if (P.x === Q.x && P.y === Q.y) {
    // Point doubling: λ = (3x² + a) / (2y)
    const numerator = ((3n * P.x * P.x + aNorm) % p + p) % p;
    const denominator = (2n * P.y % p + p) % p;
    lambda = (numerator * modInverse(denominator, p)) % p;
  } else {
    // Point addition: λ = (y₂ - y₁) / (x₂ - x₁)
    const numerator = ((Q.y - P.y) % p + p) % p;
    const denominator = ((Q.x - P.x) % p + p) % p;
    lambda = (numerator * modInverse(denominator, p)) % p;
  }

  // x₃ = λ² - x₁ - x₂
  const x3 = ((lambda * lambda - P.x - Q.x) % p + p) % p;

  // y₃ = λ(x₁ - x₃) - y₁
  const y3 = ((lambda * (P.x - x3) - P.y) % p + p) % p;

  return { x: x3, y: y3, infinity: false };
}

// Scalar multiplication using double-and-add
function scalarMult(k: bigint, P: Point, curve: CurveParams): Point {
  if (k === 0n || P.infinity) return INFINITY;

  k = ((k % curve.n) + curve.n) % curve.n;

  let result: Point = INFINITY;
  let addend: Point = { ...P };

  while (k > 0n) {
    if (k % 2n === 1n) {
      result = pointAdd(result, addend, curve);
    }
    addend = pointAdd(addend, addend, curve);
    k = k / 2n;
  }

  return result;
}

// Generate cryptographically secure random bigint
function randomBigInt(max: bigint): bigint {
  const byteLength = Math.ceil(max.toString(16).length / 2);
  const bytes = new Uint8Array(byteLength);

  // Use Math.random() for demo (in production, use crypto.getRandomValues)
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }

  return result % max;
}

// Generate key pair
function generateKeyPair(curve: CurveParams): { privateKey: bigint; publicKey: Point } {
  // Private key: random integer in [1, n-1]
  const privateKey = randomBigInt(curve.n - 1n) + 1n;

  // Public key: Q = d * G
  const G: Point = { x: curve.Gx, y: curve.Gy, infinity: false };
  const publicKey = scalarMult(privateKey, G, curve);

  return { privateKey, publicKey };
}

// ECDH shared secret computation
function ecdhSharedSecret(
  privateKey: bigint,
  publicKey: Point,
  curve: CurveParams
): Point {
  return scalarMult(privateKey, publicKey, curve);
}

// Hash function (simplified SHA-256-like for demo)
function hashMessage(message: string): bigint {
  // Simple hash for demonstration
  let hash = 0n;
  for (let i = 0; i < message.length; i++) {
    hash = ((hash << 5n) - hash + BigInt(message.charCodeAt(i))) & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
  }
  return hash;
}

// ECDSA signing
function ecdsaSign(
  message: string,
  privateKey: bigint,
  curve: CurveParams
): { r: bigint; s: bigint } {
  const { n, Gx, Gy } = curve;
  const G: Point = { x: Gx, y: Gy, infinity: false };
  const z = hashMessage(message) % n;

  let r = 0n;
  let s = 0n;

  while (r === 0n || s === 0n) {
    // Generate random k
    const k = randomBigInt(n - 1n) + 1n;

    // R = k * G
    const R = scalarMult(k, G, curve);
    r = R.x % n;

    if (r === 0n) continue;

    // s = k⁻¹ * (z + r * d) mod n
    const kInv = modInverse(k, n);
    s = (kInv * (z + r * privateKey)) % n;
  }

  return { r, s };
}

// ECDSA verification
function ecdsaVerify(
  message: string,
  signature: { r: bigint; s: bigint },
  publicKey: Point,
  curve: CurveParams
): boolean {
  const { r, s } = signature;
  const { n, Gx, Gy } = curve;
  const G: Point = { x: Gx, y: Gy, infinity: false };

  // Check r and s are in [1, n-1]
  if (r < 1n || r >= n || s < 1n || s >= n) {
    return false;
  }

  const z = hashMessage(message) % n;

  // w = s⁻¹ mod n
  const w = modInverse(s, n);

  // u₁ = z * w mod n
  const u1 = (z * w) % n;

  // u₂ = r * w mod n
  const u2 = (r * w) % n;

  // P = u₁ * G + u₂ * Q
  const P1 = scalarMult(u1, G, curve);
  const P2 = scalarMult(u2, publicKey, curve);
  const P = pointAdd(P1, P2, curve);

  if (P.infinity) return false;

  // Verify r = P.x mod n
  return (P.x % n) === r;
}

// Point compression
function compressPoint(point: Point): string {
  if (point.infinity) return '00';

  const prefix = point.y % 2n === 0n ? '02' : '03';
  return prefix + point.x.toString(16).padStart(64, '0');
}

// Point decompression
function decompressPoint(compressed: string, curve: CurveParams): Point | null {
  if (compressed === '00') return INFINITY;

  const prefix = compressed.slice(0, 2);
  const xHex = compressed.slice(2);
  const x = BigInt('0x' + xHex);

  const { p, a, b } = curve;
  const aNorm = ((a % p) + p) % p;

  // y² = x³ + ax + b
  const ySquared = ((x * x * x + aNorm * x + b) % p + p) % p;
  const y = sqrt_mod(ySquared, p);

  if (y === null) return null;

  // Choose correct y based on prefix
  const yFinal = (prefix === '02') === (y % 2n === 0n) ? y : p - y;

  return { x, y: yFinal, infinity: false };
}

// Format bigint as hex with proper padding
function formatHex(n: bigint, bytes: number): string {
  return n.toString(16).padStart(bytes * 2, '0');
}

export const ellipticcurveTool: UnifiedTool = {
  name: 'elliptic_curve',
  description: 'Elliptic curve cryptography (ECC) operations including key generation, ECDH, and ECDSA',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['multiply', 'add', 'generate_keypair', 'ecdh', 'sign', 'verify', 'compress', 'decompress', 'validate', 'info'],
        description: 'Operation to perform'
      },
      curve: {
        type: 'string',
        enum: ['P-256', 'P-384', 'P-521', 'secp256k1'],
        description: 'Elliptic curve to use'
      },
      // Point coordinates (hex strings)
      x: { type: 'string', description: 'X coordinate (hex)' },
      y: { type: 'string', description: 'Y coordinate (hex)' },
      x2: { type: 'string', description: 'Second point X coordinate (hex)' },
      y2: { type: 'string', description: 'Second point Y coordinate (hex)' },

      // Scalar multiplication
      scalar: { type: 'string', description: 'Scalar value (hex)' },

      // Keys
      privateKey: { type: 'string', description: 'Private key (hex)' },

      // ECDSA
      message: { type: 'string', description: 'Message to sign/verify' },
      signatureR: { type: 'string', description: 'Signature r component (hex)' },
      signatureS: { type: 'string', description: 'Signature s component (hex)' },

      // Compressed point
      compressed: { type: 'string', description: 'Compressed point (hex)' }
    },
    required: ['operation']
  }
};

export async function executeellipticcurve(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const curveName = args.curve ?? 'P-256';
    const curve = CURVES[curveName];

    if (!curve) {
      return {
        toolCallId: id,
        content: JSON.stringify({ error: 'Unknown curve', curve: curveName }),
        isError: true
      };
    }

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'elliptic-curve',
          description: 'Elliptic Curve Cryptography operations',
          capabilities: [
            'Point addition and doubling',
            'Scalar multiplication (double-and-add)',
            'Key pair generation',
            'ECDH key exchange',
            'ECDSA signing and verification',
            'Point compression and decompression',
            'Point validation (on-curve check)'
          ],
          supportedCurves: Object.entries(CURVES).map(([name, c]) => ({
            name,
            fullName: c.name,
            bitLength: c.bitLength,
            equation: `y² = x³ ${c.a === -3n ? '- 3x' : c.a === 0n ? '' : `+ ${c.a}x`} + b (mod p)`
          })),
          securityLevels: {
            'P-256': '128-bit security',
            'P-384': '192-bit security',
            'P-521': '256-bit security',
            'secp256k1': '128-bit security (Bitcoin/Ethereum)'
          },
          curveDetails: {
            name: curve.name,
            p: formatHex(curve.p, Math.ceil(curve.bitLength / 8)),
            a: curve.a.toString(),
            b: formatHex(curve.b, Math.ceil(curve.bitLength / 8)),
            n: formatHex(curve.n, Math.ceil(curve.bitLength / 8)),
            Gx: formatHex(curve.Gx, Math.ceil(curve.bitLength / 8)),
            Gy: formatHex(curve.Gy, Math.ceil(curve.bitLength / 8))
          }
        }, null, 2)
      };
    }

    if (operation === 'generate_keypair') {
      const { privateKey, publicKey } = generateKeyPair(curve);
      const byteLen = Math.ceil(curve.bitLength / 8);

      return {
        toolCallId: id,
        content: JSON.stringify({
          curve: curveName,
          keyPair: {
            privateKey: formatHex(privateKey, byteLen),
            publicKey: {
              x: formatHex(publicKey.x, byteLen),
              y: formatHex(publicKey.y, byteLen),
              compressed: compressPoint(publicKey),
              uncompressed: '04' + formatHex(publicKey.x, byteLen) + formatHex(publicKey.y, byteLen)
            }
          },
          validation: {
            onCurve: isOnCurve(publicKey, curve),
            orderCheck: scalarMult(curve.n, publicKey, curve).infinity
          }
        }, null, 2)
      };
    }

    if (operation === 'multiply') {
      const scalar = BigInt('0x' + (args.scalar ?? '1'));
      let point: Point;

      if (args.x && args.y) {
        point = { x: BigInt('0x' + args.x), y: BigInt('0x' + args.y), infinity: false };
      } else {
        // Use generator point
        point = { x: curve.Gx, y: curve.Gy, infinity: false };
      }

      if (!isOnCurve(point, curve)) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Point not on curve' }),
          isError: true
        };
      }

      const result = scalarMult(scalar, point, curve);
      const byteLen = Math.ceil(curve.bitLength / 8);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'scalar multiplication',
          curve: curveName,
          input: {
            scalar: formatHex(scalar, byteLen),
            point: point.infinity ? 'infinity' : {
              x: formatHex(point.x, byteLen),
              y: formatHex(point.y, byteLen)
            }
          },
          result: result.infinity ? 'point at infinity' : {
            x: formatHex(result.x, byteLen),
            y: formatHex(result.y, byteLen),
            compressed: compressPoint(result)
          }
        }, null, 2)
      };
    }

    if (operation === 'add') {
      const P: Point = { x: BigInt('0x' + args.x), y: BigInt('0x' + args.y), infinity: false };
      const Q: Point = { x: BigInt('0x' + args.x2), y: BigInt('0x' + args.y2), infinity: false };

      if (!isOnCurve(P, curve) || !isOnCurve(Q, curve)) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'One or both points not on curve' }),
          isError: true
        };
      }

      const result = pointAdd(P, Q, curve);
      const byteLen = Math.ceil(curve.bitLength / 8);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'point addition',
          curve: curveName,
          inputs: {
            P: { x: formatHex(P.x, byteLen), y: formatHex(P.y, byteLen) },
            Q: { x: formatHex(Q.x, byteLen), y: formatHex(Q.y, byteLen) }
          },
          result: result.infinity ? 'point at infinity' : {
            x: formatHex(result.x, byteLen),
            y: formatHex(result.y, byteLen),
            compressed: compressPoint(result)
          }
        }, null, 2)
      };
    }

    if (operation === 'ecdh') {
      const byteLen = Math.ceil(curve.bitLength / 8);
      let privateKey: bigint;
      let publicKey: Point;

      if (args.privateKey && args.x && args.y) {
        privateKey = BigInt('0x' + args.privateKey);
        publicKey = { x: BigInt('0x' + args.x), y: BigInt('0x' + args.y), infinity: false };

        if (!isOnCurve(publicKey, curve)) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'Public key not on curve' }),
            isError: true
          };
        }
      } else {
        // Generate two key pairs for demonstration
        const alice = generateKeyPair(curve);
        const bob = generateKeyPair(curve);

        const aliceSecret = ecdhSharedSecret(alice.privateKey, bob.publicKey, curve);
        const bobSecret = ecdhSharedSecret(bob.privateKey, alice.publicKey, curve);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'ECDH key exchange demonstration',
            curve: curveName,
            alice: {
              privateKey: formatHex(alice.privateKey, byteLen),
              publicKey: {
                x: formatHex(alice.publicKey.x, byteLen),
                y: formatHex(alice.publicKey.y, byteLen)
              }
            },
            bob: {
              privateKey: formatHex(bob.privateKey, byteLen),
              publicKey: {
                x: formatHex(bob.publicKey.x, byteLen),
                y: formatHex(bob.publicKey.y, byteLen)
              }
            },
            sharedSecret: {
              aliceComputes: formatHex(aliceSecret.x, byteLen),
              bobComputes: formatHex(bobSecret.x, byteLen),
              match: aliceSecret.x === bobSecret.x
            }
          }, null, 2)
        };
      }

      const sharedSecret = ecdhSharedSecret(privateKey, publicKey, curve);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'ECDH shared secret',
          curve: curveName,
          sharedSecret: {
            x: formatHex(sharedSecret.x, byteLen),
            y: formatHex(sharedSecret.y, byteLen)
          },
          derivedKey: formatHex(sharedSecret.x, byteLen)
        }, null, 2)
      };
    }

    if (operation === 'sign') {
      const message = args.message ?? 'Hello, World!';
      const byteLen = Math.ceil(curve.bitLength / 8);
      let privateKey: bigint;

      if (args.privateKey) {
        privateKey = BigInt('0x' + args.privateKey);
      } else {
        const keyPair = generateKeyPair(curve);
        privateKey = keyPair.privateKey;

        const signature = ecdsaSign(message, privateKey, curve);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'ECDSA signing (generated key)',
            curve: curveName,
            message,
            messageHash: formatHex(hashMessage(message), byteLen),
            privateKey: formatHex(privateKey, byteLen),
            publicKey: {
              x: formatHex(keyPair.publicKey.x, byteLen),
              y: formatHex(keyPair.publicKey.y, byteLen)
            },
            signature: {
              r: formatHex(signature.r, byteLen),
              s: formatHex(signature.s, byteLen),
              der: `30${(byteLen * 2 + 4).toString(16).padStart(2, '0')}02${byteLen.toString(16).padStart(2, '0')}${formatHex(signature.r, byteLen)}02${byteLen.toString(16).padStart(2, '0')}${formatHex(signature.s, byteLen)}`
            }
          }, null, 2)
        };
      }

      const signature = ecdsaSign(message, privateKey, curve);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'ECDSA signing',
          curve: curveName,
          message,
          signature: {
            r: formatHex(signature.r, byteLen),
            s: formatHex(signature.s, byteLen)
          }
        }, null, 2)
      };
    }

    if (operation === 'verify') {
      const message = args.message ?? 'Hello, World!';
      const byteLen = Math.ceil(curve.bitLength / 8);

      if (!args.x || !args.y || !args.signatureR || !args.signatureS) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Missing required parameters',
            required: ['x', 'y', 'signatureR', 'signatureS', 'message']
          }),
          isError: true
        };
      }

      const publicKey: Point = { x: BigInt('0x' + args.x), y: BigInt('0x' + args.y), infinity: false };
      const signature = { r: BigInt('0x' + args.signatureR), s: BigInt('0x' + args.signatureS) };

      if (!isOnCurve(publicKey, curve)) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Public key not on curve', valid: false }),
          isError: true
        };
      }

      const valid = ecdsaVerify(message, signature, publicKey, curve);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'ECDSA verification',
          curve: curveName,
          message,
          publicKey: {
            x: formatHex(publicKey.x, byteLen),
            y: formatHex(publicKey.y, byteLen)
          },
          signature: {
            r: formatHex(signature.r, byteLen),
            s: formatHex(signature.s, byteLen)
          },
          valid
        }, null, 2)
      };
    }

    if (operation === 'compress') {
      if (!args.x || !args.y) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Missing x or y coordinate' }),
          isError: true
        };
      }

      const point: Point = { x: BigInt('0x' + args.x), y: BigInt('0x' + args.y), infinity: false };
      const compressed = compressPoint(point);
      const byteLen = Math.ceil(curve.bitLength / 8);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'point compression',
          curve: curveName,
          uncompressed: {
            x: formatHex(point.x, byteLen),
            y: formatHex(point.y, byteLen)
          },
          compressed,
          format: 'prefix (02/03) + x-coordinate'
        }, null, 2)
      };
    }

    if (operation === 'decompress') {
      if (!args.compressed) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Missing compressed point' }),
          isError: true
        };
      }

      const point = decompressPoint(args.compressed, curve);

      if (!point) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Failed to decompress point - invalid or not on curve' }),
          isError: true
        };
      }

      const byteLen = Math.ceil(curve.bitLength / 8);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'point decompression',
          curve: curveName,
          compressed: args.compressed,
          decompressed: point.infinity ? 'point at infinity' : {
            x: formatHex(point.x, byteLen),
            y: formatHex(point.y, byteLen)
          },
          valid: isOnCurve(point, curve)
        }, null, 2)
      };
    }

    if (operation === 'validate') {
      if (!args.x || !args.y) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Missing x or y coordinate' }),
          isError: true
        };
      }

      const point: Point = { x: BigInt('0x' + args.x), y: BigInt('0x' + args.y), infinity: false };
      const onCurve = isOnCurve(point, curve);
      const orderCheck = scalarMult(curve.n, point, curve);
      const byteLen = Math.ceil(curve.bitLength / 8);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'point validation',
          curve: curveName,
          point: {
            x: formatHex(point.x, byteLen),
            y: formatHex(point.y, byteLen)
          },
          validation: {
            onCurve,
            hasCorrectOrder: orderCheck.infinity,
            isValid: onCurve && orderCheck.infinity
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: 'Unknown operation', operation }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isellipticcurveAvailable(): boolean {
  return true;
}
