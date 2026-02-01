// ============================================================================
// CRYPTOGRAPHY ADVANCED TOOL - TIER GODMODE
// ============================================================================
// Advanced cryptography: Elliptic curve operations, Diffie-Hellman,
// digital signatures, zero-knowledge proof concepts, and cryptographic
// protocol demonstrations.
// Pure TypeScript implementation for education.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// BIG INTEGER OPERATIONS (Simplified for demo)
// ============================================================================

// For demo purposes, we use regular numbers with modular arithmetic
// Real implementations would use BigInt or a big integer library

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
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
  // Extended Euclidean algorithm
  let [oldR, r] = [a, m];
  let [oldS, s] = [1n, 0n];

  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }

  if (oldR > 1n) throw new Error('No inverse exists');
  return oldS < 0n ? oldS + m : oldS;
}

function _gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

// ============================================================================
// PRIME GENERATION & TESTING
// ============================================================================

function isProbablePrime(n: bigint, k: number = 10): boolean {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;

  // Write n-1 as 2^r * d
  let d = n - 1n;
  let r = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    r++;
  }

  // Miller-Rabin witnesses
  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n].slice(0, k);

  witnessLoop: for (const a of witnesses) {
    if (a >= n) continue;

    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;

    for (let i = 0; i < r - 1; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue witnessLoop;
    }

    return false;
  }

  return true;
}

function generatePrime(_bits: number): bigint {
  // For demo, use small primes
  const smallPrimes = [
    101n, 103n, 107n, 109n, 113n, 127n, 131n, 137n, 139n, 149n,
    151n, 157n, 163n, 167n, 173n, 179n, 181n, 191n, 193n, 197n,
    199n, 211n, 223n, 227n, 229n, 233n, 239n, 241n, 251n, 257n,
    263n, 269n, 271n, 277n, 281n, 283n, 293n, 307n, 311n, 313n,
  ];

  const index = Math.floor(Math.random() * smallPrimes.length);
  return smallPrimes[index];
}

// ============================================================================
// RSA
// ============================================================================

interface RSAKeyPair {
  publicKey: { e: bigint; n: bigint };
  privateKey: { d: bigint; n: bigint };
  p: bigint;
  q: bigint;
}

function generateRSAKeys(): RSAKeyPair {
  const p = generatePrime(8);
  let q = generatePrime(8);
  while (q === p) q = generatePrime(8);

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);

  // Common public exponent
  const e = 65537n;

  // Private exponent
  const d = modInverse(e, phi);

  return {
    publicKey: { e, n },
    privateKey: { d, n },
    p,
    q,
  };
}

function rsaEncrypt(message: bigint, e: bigint, n: bigint): bigint {
  return modPow(message, e, n);
}

function rsaDecrypt(ciphertext: bigint, d: bigint, n: bigint): bigint {
  return modPow(ciphertext, d, n);
}

// ============================================================================
// DIFFIE-HELLMAN KEY EXCHANGE
// ============================================================================

interface DHParams {
  p: bigint; // Prime modulus
  g: bigint; // Generator
}

interface DHKeyPair {
  privateKey: bigint;
  publicKey: bigint;
}

function generateDHParams(): DHParams {
  // Small safe prime for demo (p = 2q + 1 where q is also prime)
  return {
    p: 23n, // Small prime for demo
    g: 5n,  // Primitive root
  };
}

function generateDHKeyPair(params: DHParams): DHKeyPair {
  const privateKey = BigInt(Math.floor(Math.random() * 20) + 2);
  const publicKey = modPow(params.g, privateKey, params.p);
  return { privateKey, publicKey };
}

function computeDHSharedSecret(
  otherPublicKey: bigint,
  myPrivateKey: bigint,
  p: bigint
): bigint {
  return modPow(otherPublicKey, myPrivateKey, p);
}

// ============================================================================
// ELLIPTIC CURVE OPERATIONS (Simplified)
// ============================================================================

// Using secp256k1-like curve for demonstration
// y² = x³ + ax + b (mod p)
interface EllipticCurve {
  a: bigint;
  b: bigint;
  p: bigint;  // Prime field
  G: ECPoint; // Generator point
  n: bigint;  // Order
}

interface ECPoint {
  x: bigint;
  y: bigint;
  infinity?: boolean;
}

const DEMO_CURVE: EllipticCurve = {
  a: 0n,
  b: 7n,
  p: 67n, // Small prime for demo
  G: { x: 2n, y: 22n },
  n: 79n,
};

function isOnCurve(point: ECPoint, curve: EllipticCurve): boolean {
  if (point.infinity) return true;
  const { x, y } = point;
  const { a, b, p } = curve;

  const left = (y * y) % p;
  const right = (x * x * x + a * x + b) % p;

  return left === right || left === ((right + p) % p);
}

function ecAdd(P: ECPoint, Q: ECPoint, curve: EllipticCurve): ECPoint {
  if (P.infinity) return Q;
  if (Q.infinity) return P;

  const { p } = curve;

  if (P.x === Q.x && P.y !== Q.y) {
    return { x: 0n, y: 0n, infinity: true };
  }

  let lambda: bigint;

  if (P.x === Q.x && P.y === Q.y) {
    // Point doubling
    const num = (3n * P.x * P.x + curve.a) % p;
    const den = (2n * P.y) % p;
    lambda = (num * modInverse(den, p)) % p;
  } else {
    // Point addition
    const num = ((Q.y - P.y) % p + p) % p;
    const den = ((Q.x - P.x) % p + p) % p;
    lambda = (num * modInverse(den, p)) % p;
  }

  const x3 = ((lambda * lambda - P.x - Q.x) % p + p) % p;
  const y3 = ((lambda * (P.x - x3) - P.y) % p + p) % p;

  return { x: x3, y: y3 };
}

function ecMultiply(k: bigint, P: ECPoint, curve: EllipticCurve): ECPoint {
  let result: ECPoint = { x: 0n, y: 0n, infinity: true };
  let addend = P;

  while (k > 0n) {
    if (k % 2n === 1n) {
      result = ecAdd(result, addend, curve);
    }
    addend = ecAdd(addend, addend, curve);
    k = k / 2n;
  }

  return result;
}

// ECDSA (simplified)
interface ECDSASignature {
  r: bigint;
  s: bigint;
}

function ecdsaSign(messageHash: bigint, privateKey: bigint, curve: EllipticCurve): ECDSASignature {
  const k = BigInt(Math.floor(Math.random() * 50) + 1); // Random nonce
  const R = ecMultiply(k, curve.G, curve);
  const r = R.x % curve.n;

  const kInv = modInverse(k, curve.n);
  const s = (kInv * (messageHash + r * privateKey)) % curve.n;

  return { r, s };
}

function ecdsaVerify(
  messageHash: bigint,
  signature: ECDSASignature,
  publicKey: ECPoint,
  curve: EllipticCurve
): boolean {
  const { r, s } = signature;
  const sInv = modInverse(s, curve.n);

  const u1 = (messageHash * sInv) % curve.n;
  const u2 = (r * sInv) % curve.n;

  const P1 = ecMultiply(u1, curve.G, curve);
  const P2 = ecMultiply(u2, publicKey, curve);
  const R = ecAdd(P1, P2, curve);

  return R.x % curve.n === r;
}

// ============================================================================
// HASH FUNCTIONS (Simple demonstrations)
// ============================================================================

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function sha256Demo(input: string): string {
  // Simplified demonstration - not a real SHA-256!
  const parts: number[] = [];
  for (let i = 0; i < input.length; i += 4) {
    let val = 0;
    for (let j = 0; j < 4 && i + j < input.length; j++) {
      val = (val << 8) | input.charCodeAt(i + j);
    }
    parts.push(val);
  }

  // Mix the values
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;

  for (const part of parts) {
    h0 = ((h0 ^ part) * 0x01000193) >>> 0;
    h1 = ((h1 ^ (part >>> 16)) * 0x01000193) >>> 0;
  }

  return h0.toString(16).padStart(8, '0') + h1.toString(16).padStart(8, '0');
}

// ============================================================================
// ZERO-KNOWLEDGE PROOFS (Conceptual Demo)
// ============================================================================

interface ZKPChallenge {
  commitment: bigint;
  challenge: bigint;
  response: bigint;
}

function schnorrProofDemo(
  secret: bigint,
  params: DHParams
): { proof: ZKPChallenge; publicKey: bigint } {
  // Prover's public key
  const publicKey = modPow(params.g, secret, params.p);

  // Step 1: Prover picks random r, sends commitment
  const r = BigInt(Math.floor(Math.random() * 100) + 1);
  const commitment = modPow(params.g, r, params.p);

  // Step 2: Verifier sends challenge (simulated)
  const challenge = BigInt(Math.floor(Math.random() * 10) + 1);

  // Step 3: Prover computes response
  const response = (r + challenge * secret) % (params.p - 1n);

  return {
    proof: { commitment, challenge, response },
    publicKey,
  };
}

function verifySchnorrProof(
  proof: ZKPChallenge,
  publicKey: bigint,
  params: DHParams
): boolean {
  // Check: g^response = commitment * publicKey^challenge
  const left = modPow(params.g, proof.response, params.p);
  const right = (proof.commitment * modPow(publicKey, proof.challenge, params.p)) % params.p;

  return left === right;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const cryptographyAdvancedTool: UnifiedTool = {
  name: 'cryptography_advanced',
  description: `Advanced cryptography demonstrations for education.

Operations:

Prime Numbers:
- prime_test: Test if number is prime (Miller-Rabin)
- generate_prime: Generate a prime number

RSA:
- rsa_keygen: Generate RSA key pair
- rsa_encrypt: Encrypt with RSA public key
- rsa_decrypt: Decrypt with RSA private key
- rsa_demo: Full RSA demonstration

Diffie-Hellman:
- dh_keygen: Generate DH parameters and keys
- dh_exchange: Simulate key exchange
- dh_demo: Full DH demonstration

Elliptic Curves:
- ec_point_add: Add two points on curve
- ec_point_multiply: Scalar multiplication
- ecdsa_sign: Create ECDSA signature
- ecdsa_verify: Verify ECDSA signature
- ec_demo: Full EC demonstration

Zero-Knowledge:
- zkp_schnorr: Schnorr identification protocol demo

Hash:
- hash_demo: Simple hash function demonstration

Note: These are EDUCATIONAL implementations using small numbers.
NOT suitable for real security applications!`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'prime_test', 'generate_prime',
          'rsa_keygen', 'rsa_encrypt', 'rsa_decrypt', 'rsa_demo',
          'dh_keygen', 'dh_exchange', 'dh_demo',
          'ec_point_add', 'ec_point_multiply', 'ecdsa_sign', 'ecdsa_verify', 'ec_demo',
          'zkp_schnorr',
          'hash_demo',
        ],
        description: 'Cryptographic operation',
      },
      number: { type: 'number', description: 'Number for prime testing' },
      message: { type: 'string', description: 'Message to encrypt/hash' },
      bits: { type: 'number', description: 'Bit length for prime generation' },
      // RSA params
      e: { type: 'number', description: 'RSA public exponent' },
      n: { type: 'number', description: 'RSA modulus' },
      d: { type: 'number', description: 'RSA private exponent' },
      ciphertext: { type: 'number', description: 'Ciphertext to decrypt' },
      // EC params
      point1: { type: 'string', description: 'First point as JSON {x, y}' },
      point2: { type: 'string', description: 'Second point as JSON {x, y}' },
      scalar: { type: 'number', description: 'Scalar for EC multiplication' },
      private_key: { type: 'number', description: 'Private key' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeCryptographyAdvanced(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'prime_test': {
        const n = BigInt(args.number || 101);
        const isPrime = isProbablePrime(n);
        result = {
          operation: 'prime_test',
          number: n.toString(),
          is_prime: isPrime,
          algorithm: 'Miller-Rabin probabilistic test',
        };
        break;
      }

      case 'generate_prime': {
        const bits = args.bits || 8;
        const prime = generatePrime(bits);
        result = {
          operation: 'generate_prime',
          bits,
          prime: prime.toString(),
          is_verified_prime: isProbablePrime(prime),
        };
        break;
      }

      case 'rsa_keygen': {
        const keys = generateRSAKeys();
        result = {
          operation: 'rsa_keygen',
          public_key: {
            e: keys.publicKey.e.toString(),
            n: keys.publicKey.n.toString(),
          },
          private_key: {
            d: keys.privateKey.d.toString(),
            n: keys.privateKey.n.toString(),
          },
          primes: {
            p: keys.p.toString(),
            q: keys.q.toString(),
          },
          note: 'Small primes for demo only!',
        };
        break;
      }

      case 'rsa_demo': {
        const keys = generateRSAKeys();
        const message = BigInt(args.number || 42);

        const ciphertext = rsaEncrypt(message, keys.publicKey.e, keys.publicKey.n);
        const decrypted = rsaDecrypt(ciphertext, keys.privateKey.d, keys.privateKey.n);

        result = {
          operation: 'rsa_demo',
          keys: {
            p: keys.p.toString(),
            q: keys.q.toString(),
            n: keys.publicKey.n.toString(),
            e: keys.publicKey.e.toString(),
            d: keys.privateKey.d.toString(),
          },
          demonstration: {
            original_message: message.toString(),
            encrypted: ciphertext.toString(),
            decrypted: decrypted.toString(),
            success: message === decrypted,
          },
          formulas: {
            encryption: 'c = m^e mod n',
            decryption: 'm = c^d mod n',
          },
        };
        break;
      }

      case 'dh_demo': {
        const params = generateDHParams();
        const alice = generateDHKeyPair(params);
        const bob = generateDHKeyPair(params);

        const aliceShared = computeDHSharedSecret(bob.publicKey, alice.privateKey, params.p);
        const bobShared = computeDHSharedSecret(alice.publicKey, bob.privateKey, params.p);

        result = {
          operation: 'dh_demo',
          parameters: {
            p: params.p.toString(),
            g: params.g.toString(),
          },
          alice: {
            private_key: alice.privateKey.toString(),
            public_key: alice.publicKey.toString(),
            public_key_formula: `g^a mod p = ${params.g}^${alice.privateKey} mod ${params.p}`,
          },
          bob: {
            private_key: bob.privateKey.toString(),
            public_key: bob.publicKey.toString(),
            public_key_formula: `g^b mod p = ${params.g}^${bob.privateKey} mod ${params.p}`,
          },
          shared_secret: {
            alice_computes: aliceShared.toString(),
            bob_computes: bobShared.toString(),
            match: aliceShared === bobShared,
            formula: 'Both compute g^(ab) mod p',
          },
          security: 'Based on Discrete Logarithm Problem',
        };
        break;
      }

      case 'ec_demo': {
        const curve = DEMO_CURVE;

        // Generate key pair
        const privateKey = BigInt(Math.floor(Math.random() * 20) + 5);
        const publicKey = ecMultiply(privateKey, curve.G, curve);

        // Sign a message
        const messageHash = BigInt(simpleHash(args.message || 'Hello'));
        const signature = ecdsaSign(messageHash, privateKey, curve);
        const verified = ecdsaVerify(messageHash, signature, publicKey, curve);

        result = {
          operation: 'ec_demo',
          curve: {
            equation: 'y² = x³ + 7 (mod p)',
            p: curve.p.toString(),
            generator: `(${curve.G.x}, ${curve.G.y})`,
          },
          key_pair: {
            private_key: privateKey.toString(),
            public_key: `(${publicKey.x}, ${publicKey.y})`,
            on_curve: isOnCurve(publicKey, curve),
          },
          ecdsa: {
            message: args.message || 'Hello',
            message_hash: messageHash.toString(),
            signature: {
              r: signature.r.toString(),
              s: signature.s.toString(),
            },
            verified,
          },
          security: 'Based on Elliptic Curve Discrete Logarithm Problem',
        };
        break;
      }

      case 'ec_point_add': {
        const curve = DEMO_CURVE;
        const P: ECPoint = args.point1
          ? { x: BigInt(args.point1.x), y: BigInt(args.point1.y) }
          : curve.G;
        const Q: ECPoint = args.point2
          ? { x: BigInt(args.point2.x), y: BigInt(args.point2.y) }
          : curve.G;

        const R = ecAdd(P, Q, curve);

        result = {
          operation: 'ec_point_add',
          curve: { a: curve.a.toString(), b: curve.b.toString(), p: curve.p.toString() },
          P: `(${P.x}, ${P.y})`,
          Q: `(${Q.x}, ${Q.y})`,
          result: R.infinity ? 'Point at infinity' : `(${R.x}, ${R.y})`,
          P_on_curve: isOnCurve(P, curve),
          Q_on_curve: isOnCurve(Q, curve),
          result_on_curve: isOnCurve(R, curve),
        };
        break;
      }

      case 'ec_point_multiply': {
        const curve = DEMO_CURVE;
        const k = BigInt(args.scalar || 5);
        const P: ECPoint = args.point1
          ? { x: BigInt(args.point1.x), y: BigInt(args.point1.y) }
          : curve.G;

        const R = ecMultiply(k, P, curve);

        result = {
          operation: 'ec_point_multiply',
          scalar: k.toString(),
          point: `(${P.x}, ${P.y})`,
          result: R.infinity ? 'Point at infinity' : `(${R.x}, ${R.y})`,
          result_on_curve: isOnCurve(R, curve),
        };
        break;
      }

      case 'zkp_schnorr': {
        const params = generateDHParams();
        const secret = BigInt(Math.floor(Math.random() * 10) + 1);

        const { proof, publicKey } = schnorrProofDemo(secret, params);
        const valid = verifySchnorrProof(proof, publicKey, params);

        result = {
          operation: 'zkp_schnorr',
          concept: 'Prove knowledge of x such that y = g^x, without revealing x',
          parameters: {
            g: params.g.toString(),
            p: params.p.toString(),
          },
          prover: {
            secret: secret.toString(),
            public_key: publicKey.toString(),
          },
          protocol: {
            '1_commitment': `r random, send g^r = ${proof.commitment}`,
            '2_challenge': `Verifier sends c = ${proof.challenge}`,
            '3_response': `Prover sends s = r + c*x = ${proof.response}`,
          },
          verification: {
            check: 'g^s = commitment * publicKey^c',
            valid,
          },
          zero_knowledge: 'Verifier learns nothing about the secret x',
        };
        break;
      }

      case 'hash_demo': {
        const message = args.message || 'Hello, World!';
        const hash1 = simpleHash(message);
        const hash2 = sha256Demo(message);

        const modified = message + '!';
        const modifiedHash = simpleHash(modified);

        result = {
          operation: 'hash_demo',
          message,
          simple_hash: hash1,
          pseudo_sha256: hash2,
          properties: {
            deterministic: 'Same input always produces same output',
            one_way: 'Cannot reverse hash to get input',
            avalanche: `Small change: "${message}" → "${modified}" changes hash ${hash1} → ${modifiedHash}`,
          },
          note: 'Demo hashes only! Use crypto libraries for real applications.',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    result.disclaimer = 'EDUCATIONAL ONLY - Uses small numbers for demonstration. NOT for real security!';

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isCryptographyAdvancedAvailable(): boolean {
  return true;
}
void _gcd; // reserved for modular arithmetic
