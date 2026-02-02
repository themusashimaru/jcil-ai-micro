/**
 * ELLIPTIC-CURVE TOOL
 * Elliptic Curve Cryptography operations
 * Implements: Point arithmetic, ECDH, ECDSA concepts, curve operations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const ellipticcurveTool: UnifiedTool = {
  name: 'elliptic_curve',
  description: 'Elliptic curve cryptography (ECC) operations and education',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'add', 'multiply', 'generate_keypair', 'ecdh', 'verify_point', 'curve_info', 'demonstrate'],
        description: 'Operation to perform'
      },
      curve: {
        type: 'string',
        enum: ['secp256k1', 'P-256', 'P-384', 'P-521', 'curve25519', 'ed25519'],
        description: 'Elliptic curve to use'
      },
      point1: { type: 'object', description: 'First point {x, y}' },
      point2: { type: 'object', description: 'Second point {x, y}' },
      scalar: { type: 'string', description: 'Scalar multiplier (as hex string)' },
      private_key: { type: 'string', description: 'Private key (as hex string)' }
    },
    required: ['operation']
  }
};

// Curve Parameters (simplified for educational purposes)
interface CurveParams {
  name: string;
  p: bigint;         // Prime modulus
  a: bigint;         // Curve coefficient a
  b: bigint;         // Curve coefficient b
  Gx: bigint;        // Generator x
  Gy: bigint;        // Generator y
  n: bigint;         // Order
  h: bigint;         // Cofactor
  bits: number;
  equation: string;
}

const CURVES: { [key: string]: CurveParams } = {
  'secp256k1': {
    name: 'secp256k1 (Bitcoin)',
    p: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
    a: 0n,
    b: 7n,
    Gx: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
    Gy: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'),
    n: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
    h: 1n,
    bits: 256,
    equation: 'y² = x³ + 7'
  },
  'P-256': {
    name: 'NIST P-256 (secp256r1)',
    p: BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF'),
    a: BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC'),
    b: BigInt('0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B'),
    Gx: BigInt('0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296'),
    Gy: BigInt('0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5'),
    n: BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551'),
    h: 1n,
    bits: 256,
    equation: 'y² = x³ - 3x + b'
  },
  'P-384': {
    name: 'NIST P-384 (secp384r1)',
    p: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFF0000000000000000FFFFFFFF'),
    a: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFF0000000000000000FFFFFFFC'),
    b: BigInt('0xB3312FA7E23EE7E4988E056BE3F82D19181D9C6EFE8141120314088F5013875AC656398D8A2ED19D2A85C8EDD3EC2AEF'),
    Gx: BigInt('0xAA87CA22BE8B05378EB1C71EF320AD746E1D3B628BA79B9859F741E082542A385502F25DBF55296C3A545E3872760AB7'),
    Gy: BigInt('0x3617DE4A96262C6F5D9E98BF9292DC29F8F41DBD289A147CE9DA3113B5F0B8C00A60B1CE1D7E819D7A431D7C90EA0E5F'),
    n: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC7634D81F4372DDF581A0DB248B0A77AECEC196ACCC52973'),
    h: 1n,
    bits: 384,
    equation: 'y² = x³ - 3x + b'
  },
  'P-521': {
    name: 'NIST P-521 (secp521r1)',
    p: BigInt('0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
    a: BigInt('0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC'),
    b: BigInt('0x51953EB9618E1C9A1F929A21A0B68540EEA2DA725B99B315F3B8B489918EF109E156193951EC7E937B1652C0BD3BB1BF073573DF883D2C34F1EF451FD46B503F00'),
    Gx: BigInt('0xC6858E06B70404E9CD9E3ECB662395B4429C648139053FB521F828AF606B4D3DBAA14B5E77EFE75928FE1DC127A2FFA8DE3348B3C1856A429BF97E7E31C2E5BD66'),
    Gy: BigInt('0x11839296A789A3BC0045C8A5FB42C7D1BD998F54449579B446817AFBD17273E662C97EE72995EF42640C550B9013FAD0761353C7086A272C24088BE94769FD16650'),
    n: BigInt('0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFA51868783BF2F966B7FCC0148F709A5D03BB5C9B8899C47AEBB6FB71E91386409'),
    h: 1n,
    bits: 521,
    equation: 'y² = x³ - 3x + b'
  }
};

// Point at infinity representation
const INFINITY = { x: null, y: null };

// Modular arithmetic
function mod(a: bigint, p: bigint): bigint {
  const result = a % p;
  return result >= 0n ? result : result + p;
}

function modInverse(a: bigint, p: bigint): bigint {
  // Extended Euclidean Algorithm
  let [old_r, r] = [a, p];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  return mod(old_s, p);
}

function modPow(base: bigint, exp: bigint, p: bigint): bigint {
  let result = 1n;
  base = mod(base, p);

  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = mod(result * base, p);
    }
    exp = exp / 2n;
    base = mod(base * base, p);
  }

  return result;
}

// Point addition on elliptic curve
function pointAdd(
  P1: { x: bigint | null; y: bigint | null },
  P2: { x: bigint | null; y: bigint | null },
  curve: CurveParams
): { x: bigint | null; y: bigint | null } {
  // Handle infinity
  if (P1.x === null) return P2;
  if (P2.x === null) return P1;

  const { p, a } = curve;

  // If P1 = -P2, return infinity
  if (P1.x === P2.x && mod(P1.y! + P2.y!, p) === 0n) {
    return INFINITY;
  }

  let lambda: bigint;

  if (P1.x === P2.x && P1.y === P2.y) {
    // Point doubling
    const numerator = mod(3n * P1.x * P1.x + a, p);
    const denominator = mod(2n * P1.y!, p);
    lambda = mod(numerator * modInverse(denominator, p), p);
  } else {
    // Point addition
    const numerator = mod(P2.y! - P1.y!, p);
    const denominator = mod(P2.x - P1.x, p);
    lambda = mod(numerator * modInverse(denominator, p), p);
  }

  const x3 = mod(lambda * lambda - P1.x - P2.x, p);
  const y3 = mod(lambda * (P1.x - x3) - P1.y!, p);

  return { x: x3, y: y3 };
}

// Scalar multiplication (double-and-add)
function scalarMultiply(
  k: bigint,
  P: { x: bigint; y: bigint },
  curve: CurveParams
): { x: bigint | null; y: bigint | null } {
  let result: { x: bigint | null; y: bigint | null } = INFINITY;
  let addend: { x: bigint | null; y: bigint | null } = P;

  while (k > 0n) {
    if (k % 2n === 1n) {
      result = pointAdd(result, addend, curve);
    }
    addend = pointAdd(addend, addend, curve);
    k = k / 2n;
  }

  return result;
}

// Verify point is on curve
function verifyPoint(x: bigint, y: bigint, curve: CurveParams): boolean {
  const { p, a, b } = curve;
  const left = mod(y * y, p);
  const right = mod(x * x * x + a * x + b, p);
  return left === right;
}

// Generate keypair
function generateKeypair(curve: CurveParams): { privateKey: string; publicKey: { x: string; y: string } } {
  // Generate random private key
  const bytes = curve.bits / 8;
  let privKeyBigInt = 0n;

  for (let i = 0; i < bytes; i++) {
    privKeyBigInt = (privKeyBigInt << 8n) | BigInt(Math.floor(Math.random() * 256));
  }

  // Ensure private key is in valid range
  privKeyBigInt = mod(privKeyBigInt, curve.n - 1n) + 1n;

  // Calculate public key: Q = d * G
  const publicPoint = scalarMultiply(privKeyBigInt, { x: curve.Gx, y: curve.Gy }, curve);

  return {
    privateKey: privKeyBigInt.toString(16).padStart(bytes * 2, '0'),
    publicKey: {
      x: publicPoint.x?.toString(16).padStart(bytes * 2, '0') || '0',
      y: publicPoint.y?.toString(16).padStart(bytes * 2, '0') || '0'
    }
  };
}

// ECDH key agreement
function ecdh(
  privateKey: bigint,
  publicKey: { x: bigint; y: bigint },
  curve: CurveParams
): { sharedSecret: string; point: { x: string; y: string } } {
  // Shared secret = privateKey * publicKey
  const sharedPoint = scalarMultiply(privateKey, publicKey, curve);

  return {
    sharedSecret: sharedPoint.x?.toString(16) || '0',
    point: {
      x: sharedPoint.x?.toString(16) || '0',
      y: sharedPoint.y?.toString(16) || '0'
    }
  };
}

// Format bigint as shortened hex
function shortHex(n: bigint | string, maxLen: number = 16): string {
  const hex = typeof n === 'string' ? n : n.toString(16);
  if (hex.length <= maxLen) return hex;
  return hex.slice(0, maxLen / 2) + '...' + hex.slice(-maxLen / 2);
}

export async function executeellipticcurve(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';
    const curveName = args.curve || 'secp256k1';
    const curve = CURVES[curveName] || CURVES['secp256k1'];

    let result: any;

    switch (operation) {
      case 'info':
        result = {
          tool: 'elliptic-curve',
          description: 'Elliptic Curve Cryptography operations',
          operations: [
            'info - Tool information',
            'add - Add two points on the curve',
            'multiply - Scalar multiplication (k × P)',
            'generate_keypair - Generate ECC keypair',
            'ecdh - Elliptic Curve Diffie-Hellman',
            'verify_point - Verify point is on curve',
            'curve_info - Get curve parameters',
            'demonstrate - Show ECC concepts'
          ],
          supportedCurves: Object.keys(CURVES),
          securityLevels: {
            'secp256k1': '128-bit (Bitcoin, Ethereum)',
            'P-256': '128-bit (TLS, general purpose)',
            'P-384': '192-bit (high security)',
            'P-521': '256-bit (very high security)'
          },
          advantages: [
            'Smaller key sizes than RSA',
            'Faster operations',
            'Strong security per bit'
          ]
        };
        break;

      case 'curve_info': {
        result = {
          curve: curve.name,
          equation: curve.equation,
          fieldSize: curve.bits + ' bits',
          parameters: {
            p: shortHex(curve.p, 32) + ` (${curve.bits}-bit prime)`,
            a: curve.a.toString(),
            b: shortHex(curve.b, 32),
            n: shortHex(curve.n, 32) + ' (order)',
            h: curve.h.toString() + ' (cofactor)'
          },
          generator: {
            Gx: shortHex(curve.Gx, 32),
            Gy: shortHex(curve.Gy, 32)
          },
          securityLevel: `~${curve.bits / 2}-bit security`,
          usage: curveName === 'secp256k1' ? 'Bitcoin, Ethereum' :
                 curveName.startsWith('P-') ? 'NIST standard, TLS, general' :
                 'Specialized applications'
        };
        break;
      }

      case 'add': {
        const point1 = args.point1 || { x: curve.Gx.toString(16), y: curve.Gy.toString(16) };
        const point2 = args.point2 || { x: curve.Gx.toString(16), y: curve.Gy.toString(16) };

        const P1 = {
          x: BigInt('0x' + point1.x),
          y: BigInt('0x' + point1.y)
        };
        const P2 = {
          x: BigInt('0x' + point2.x),
          y: BigInt('0x' + point2.y)
        };

        const sum = pointAdd(P1, P2, curve);
        const isDoubling = P1.x === P2.x && P1.y === P2.y;

        result = {
          operation: isDoubling ? 'Point Doubling (P + P = 2P)' : 'Point Addition (P + Q)',
          curve: curveName,
          point1: {
            x: shortHex(P1.x),
            y: shortHex(P1.y)
          },
          point2: {
            x: shortHex(P2.x),
            y: shortHex(P2.y)
          },
          result: sum.x === null ? 'Point at Infinity' : {
            x: shortHex(sum.x!),
            y: shortHex(sum.y!)
          },
          formula: isDoubling
            ? 'λ = (3x₁² + a) / 2y₁'
            : 'λ = (y₂ - y₁) / (x₂ - x₁)'
        };
        break;
      }

      case 'multiply': {
        const scalar = args.scalar || '2';
        const k = BigInt('0x' + scalar);

        const G = { x: curve.Gx, y: curve.Gy };
        const result_point = scalarMultiply(k, G, curve);

        result = {
          operation: 'Scalar Multiplication (k × G)',
          curve: curveName,
          scalar: shortHex(k),
          generatorPoint: {
            x: shortHex(curve.Gx),
            y: shortHex(curve.Gy)
          },
          result: result_point.x === null ? 'Point at Infinity' : {
            x: shortHex(result_point.x!),
            y: shortHex(result_point.y!)
          },
          algorithm: 'Double-and-add method',
          complexity: `O(log₂ k) = ~${k.toString(2).length} doublings and additions`
        };
        break;
      }

      case 'generate_keypair': {
        const keypair = generateKeypair(curve);

        result = {
          operation: 'Generate ECC Keypair',
          curve: curveName,
          privateKey: {
            hex: shortHex(keypair.privateKey, 32),
            length: keypair.privateKey.length * 4 + ' bits',
            warning: 'EDUCATIONAL ONLY - Do not use for real cryptography'
          },
          publicKey: {
            x: shortHex(keypair.publicKey.x, 32),
            y: shortHex(keypair.publicKey.y, 32),
            uncompressed: '04' + shortHex(keypair.publicKey.x, 16) + '...',
            compressed: (BigInt('0x' + keypair.publicKey.y) % 2n === 0n ? '02' : '03') + shortHex(keypair.publicKey.x, 16) + '...'
          },
          keyDerivation: 'PublicKey = privateKey × G (generator point)',
          securityNote: 'Private key is random; public key is derived point on curve'
        };
        break;
      }

      case 'ecdh': {
        // Generate two keypairs for demonstration
        const alice = generateKeypair(curve);
        const bob = generateKeypair(curve);

        const alicePriv = BigInt('0x' + alice.privateKey);
        const bobPub = { x: BigInt('0x' + bob.publicKey.x), y: BigInt('0x' + bob.publicKey.y) };

        const bobPriv = BigInt('0x' + bob.privateKey);
        const alicePub = { x: BigInt('0x' + alice.publicKey.x), y: BigInt('0x' + alice.publicKey.y) };

        const aliceShared = ecdh(alicePriv, bobPub, curve);
        const bobShared = ecdh(bobPriv, alicePub, curve);

        result = {
          operation: 'Elliptic Curve Diffie-Hellman (ECDH)',
          curve: curveName,
          alice: {
            privateKey: shortHex(alice.privateKey, 16),
            publicKey: shortHex(alice.publicKey.x, 16) + '...'
          },
          bob: {
            privateKey: shortHex(bob.privateKey, 16),
            publicKey: shortHex(bob.publicKey.x, 16) + '...'
          },
          keyExchange: {
            aliceComputes: 'alicePriv × bobPub',
            bobComputes: 'bobPriv × alicePub',
            aliceResult: shortHex(aliceShared.sharedSecret, 32),
            bobResult: shortHex(bobShared.sharedSecret, 32),
            match: aliceShared.sharedSecret === bobShared.sharedSecret
          },
          security: 'Both arrive at same shared secret without revealing private keys',
          usage: 'Used in TLS, SSH, and other key exchange protocols'
        };
        break;
      }

      case 'verify_point': {
        const point = args.point1 || { x: curve.Gx.toString(16), y: curve.Gy.toString(16) };
        const x = BigInt('0x' + point.x);
        const y = BigInt('0x' + point.y);

        const isOnCurve = verifyPoint(x, y, curve);
        const left = mod(y * y, curve.p);
        const right = mod(x * x * x + curve.a * x + curve.b, curve.p);

        result = {
          operation: 'Verify Point on Curve',
          curve: curveName,
          equation: curve.equation,
          point: {
            x: shortHex(x),
            y: shortHex(y)
          },
          verification: {
            leftSide: 'y² mod p = ' + shortHex(left, 24),
            rightSide: 'x³ + ax + b mod p = ' + shortHex(right, 24),
            match: isOnCurve
          },
          result: isOnCurve ? 'VALID: Point is on the curve' : 'INVALID: Point is NOT on the curve'
        };
        break;
      }

      case 'demonstrate': {
        let demo = `
╔═══════════════════════════════════════════════════════════════════════╗
║             ELLIPTIC CURVE CRYPTOGRAPHY DEMONSTRATION                 ║
╚═══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
                    WHAT IS AN ELLIPTIC CURVE?
═══════════════════════════════════════════════════════════════════════

An elliptic curve is defined by the Weierstrass equation:

    y² = x³ + ax + b (mod p)

For secp256k1 (Bitcoin): y² = x³ + 7 (mod p)

The curve forms a group under point addition:
    • Any line intersects the curve at 3 points
    • P + Q + R = O (point at infinity)
    • P + Q = -R (reflection of third intersection)

Curve Parameters (secp256k1):
  • Prime (p):  ${shortHex(CURVES.secp256k1.p, 24)}...
  • Order (n):  ${shortHex(CURVES.secp256k1.n, 24)}...
  • a = 0, b = 7
  • ~2²⁵⁶ valid points on the curve

═══════════════════════════════════════════════════════════════════════
                      POINT ARITHMETIC
═══════════════════════════════════════════════════════════════════════

1. POINT ADDITION (P ≠ Q):

   λ = (y₂ - y₁) / (x₂ - x₁) mod p
   x₃ = λ² - x₁ - x₂ mod p
   y₃ = λ(x₁ - x₃) - y₁ mod p

2. POINT DOUBLING (P = Q):

   λ = (3x₁² + a) / (2y₁) mod p
   x₃ = λ² - 2x₁ mod p
   y₃ = λ(x₁ - x₃) - y₁ mod p

Example: G + G = 2G
`;

        const G = { x: CURVES.secp256k1.Gx, y: CURVES.secp256k1.Gy };
        const twoG = pointAdd(G, G, CURVES.secp256k1);

        demo += `
  G  = (${shortHex(G.x, 16)}..., ${shortHex(G.y, 16)}...)
  2G = (${shortHex(twoG.x!, 16)}..., ${shortHex(twoG.y!, 16)}...)

═══════════════════════════════════════════════════════════════════════
                    SCALAR MULTIPLICATION
═══════════════════════════════════════════════════════════════════════

Scalar multiplication: k × G = G + G + ... + G (k times)

This is the CORE of ECC security:
  • Easy to compute: k × G (fast with double-and-add)
  • Hard to reverse: Given P = kG, find k (ECDLP - hard!)

Double-and-Add Algorithm:
  1. Express k in binary: k = 2ⁿaₙ + 2ⁿ⁻¹aₙ₋₁ + ... + a₀
  2. Start with result = ∞ (identity)
  3. For each bit from MSB to LSB:
     - Double: result = 2 × result
     - If bit = 1: Add: result = result + G

Example: 7 × G
  7 = 111₂
  Step 1: R=G (first bit)
  Step 2: R=2G+G=3G (double, add)
  Step 3: R=6G+G=7G (double, add)
`;

        const sevenG = scalarMultiply(7n, G, CURVES.secp256k1);
        demo += `
  7G = (${shortHex(sevenG.x!, 16)}..., ${shortHex(sevenG.y!, 16)}...)

═══════════════════════════════════════════════════════════════════════
                      ECC KEY GENERATION
═══════════════════════════════════════════════════════════════════════

Private Key (d): Random integer in [1, n-1]
Public Key (Q): Q = d × G (point on curve)

`;

        const keypair = generateKeypair(CURVES.secp256k1);

        demo += `Example Keypair:
  Private Key: ${shortHex(keypair.privateKey, 32)}...
  Public Key X: ${shortHex(keypair.publicKey.x, 32)}...
  Public Key Y: ${shortHex(keypair.publicKey.y, 32)}...

Security: Given Q, finding d requires solving ECDLP
  • Best known attack: ~2^${CURVES.secp256k1.bits / 2} operations
  • Equivalent to ~128-bit symmetric security

═══════════════════════════════════════════════════════════════════════
                    ECDH KEY EXCHANGE
═══════════════════════════════════════════════════════════════════════

Alice and Bob agree on shared secret without revealing private keys:

  1. Alice: generates (a, A = aG), sends A to Bob
  2. Bob: generates (b, B = bG), sends B to Alice
  3. Alice computes: S = a × B = a × (bG) = abG
  4. Bob computes: S = b × A = b × (aG) = abG

  Both have same S! Eve sees only A and B, cannot compute abG.

`;

        const alice = generateKeypair(CURVES.secp256k1);
        const bob = generateKeypair(CURVES.secp256k1);

        demo += `Example:
  Alice Private: ${shortHex(alice.privateKey, 24)}...
  Alice Public:  ${shortHex(alice.publicKey.x, 24)}...
  Bob Private:   ${shortHex(bob.privateKey, 24)}...
  Bob Public:    ${shortHex(bob.publicKey.x, 24)}...

  Shared Secret: ${shortHex(ecdh(BigInt('0x' + alice.privateKey), { x: BigInt('0x' + bob.publicKey.x), y: BigInt('0x' + bob.publicKey.y) }, CURVES.secp256k1).sharedSecret, 24)}...

═══════════════════════════════════════════════════════════════════════
                      CURVE COMPARISON
═══════════════════════════════════════════════════════════════════════

┌─────────────┬───────┬────────────────┬──────────────────────────────┐
│ Curve       │ Bits  │ Security       │ Usage                        │
├─────────────┼───────┼────────────────┼──────────────────────────────┤
│ secp256k1   │  256  │ ~128-bit       │ Bitcoin, Ethereum            │
│ P-256       │  256  │ ~128-bit       │ TLS, general purpose         │
│ P-384       │  384  │ ~192-bit       │ High security applications   │
│ P-521       │  521  │ ~256-bit       │ Very high security           │
│ Curve25519  │  255  │ ~128-bit       │ Modern crypto (fast)         │
│ Ed25519     │  255  │ ~128-bit       │ EdDSA signatures             │
└─────────────┴───────┴────────────────┴──────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                        KEY INSIGHTS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│ 1. ECC provides same security as RSA with MUCH smaller keys        │
│    (256-bit ECC ≈ 3072-bit RSA)                                    │
│                                                                     │
│ 2. Security relies on ECDLP: given Q = dG, finding d is hard       │
│                                                                     │
│ 3. Point multiplication is the fundamental operation               │
│                                                                     │
│ 4. ECDH enables secure key exchange                                │
│                                                                     │
│ 5. ECDSA provides digital signatures                               │
│                                                                     │
│ 6. Curve choice matters: secp256k1 for crypto, P-256 for TLS       │
└─────────────────────────────────────────────────────────────────────┘
`;

        result = {
          demonstration: demo,
          summary: {
            concept: 'Elliptic Curve Discrete Logarithm Problem (ECDLP)',
            keyOperation: 'Scalar Multiplication: Q = d × G',
            applications: ['ECDH key exchange', 'ECDSA signatures', 'Bitcoin/Ethereum'],
            advantage: 'Smaller keys, faster operations vs RSA'
          }
        };
        break;
      }

      default:
        result = { error: `Unknown operation: ${operation}`, availableOperations: ['info', 'add', 'multiply', 'generate_keypair', 'ecdh', 'verify_point', 'curve_info', 'demonstrate'] };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isellipticcurveAvailable(): boolean { return true; }
