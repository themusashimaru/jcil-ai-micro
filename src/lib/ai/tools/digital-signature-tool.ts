/**
 * DIGITAL-SIGNATURE TOOL
 * Digital signature schemes and verification
 * Implements: RSA-PSS, ECDSA, EdDSA concepts and demonstrations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const digitalsignatureTool: UnifiedTool = {
  name: 'digital_signature',
  description: 'Digital signature creation, verification, and education',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'sign', 'verify', 'generate_keypair', 'compare', 'hash', 'demonstrate'],
        description: 'Operation to perform'
      },
      algorithm: {
        type: 'string',
        enum: ['RSA-PSS', 'RSA-PKCS1', 'ECDSA', 'EdDSA', 'Schnorr'],
        description: 'Signature algorithm'
      },
      message: { type: 'string', description: 'Message to sign' },
      hash_algorithm: { type: 'string', enum: ['SHA-256', 'SHA-384', 'SHA-512'], description: 'Hash algorithm' },
      key_size: { type: 'number', description: 'Key size in bits' }
    },
    required: ['operation']
  }
};

// Simple hash function for educational purposes (NOT cryptographically secure)
function simpleHash(message: string, algorithm: string = 'SHA-256'): { hex: string; bits: number } {
  let hash = 0n;
  const bits = algorithm === 'SHA-512' ? 512 : algorithm === 'SHA-384' ? 384 : 256;

  // Educational hash - NOT for production use
  for (let i = 0; i < message.length; i++) {
    const char = BigInt(message.charCodeAt(i));
    hash = ((hash << 5n) - hash + char) & ((1n << BigInt(bits)) - 1n);
    hash = hash ^ (hash >> 13n);
    hash = ((hash * 0x5bd1e995n) & ((1n << BigInt(bits)) - 1n));
  }

  // Add algorithm-specific mixing
  if (algorithm === 'SHA-384') {
    hash = (hash ^ 0xcbbb9d5dc1059ed8n) & ((1n << 384n) - 1n);
  } else if (algorithm === 'SHA-512') {
    hash = (hash ^ 0x6a09e667f3bcc908n) & ((1n << 512n) - 1n);
  }

  return {
    hex: hash.toString(16).padStart(bits / 4, '0'),
    bits
  };
}

// Modular exponentiation
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

// Extended Euclidean Algorithm for modular inverse
function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  return ((old_s % m) + m) % m;
}

// Simple prime check (for educational small primes)
function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  if (n === 2n) return true;
  if (n % 2n === 0n) return false;
  for (let i = 3n; i * i <= n; i += 2n) {
    if (n % i === 0n) return false;
  }
  return true;
}

// Generate small RSA-like keypair for education
function generateRSAKeypair(bits: number = 64): {
  publicKey: { n: string; e: string };
  privateKey: { n: string; d: string; p: string; q: string };
} {
  // Use small fixed primes for demonstration
  const primes = [
    65537n, 65539n, 65543n, 65551n, 65557n, 65563n,
    65579n, 65581n, 65587n, 65599n, 65609n, 65617n
  ];

  const p = primes[Math.floor(Math.random() * 6)];
  const q = primes[Math.floor(Math.random() * 6) + 6];

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  const e = 65537n;
  const d = modInverse(e, phi);

  return {
    publicKey: { n: n.toString(16), e: e.toString(16) },
    privateKey: { n: n.toString(16), d: d.toString(16), p: p.toString(16), q: q.toString(16) }
  };
}

// RSA signature (simplified for education)
function rsaSign(messageHash: bigint, d: bigint, n: bigint): bigint {
  return modPow(messageHash, d, n);
}

// RSA verification (simplified for education)
function rsaVerify(signature: bigint, e: bigint, n: bigint): bigint {
  return modPow(signature, e, n);
}

// ECDSA signature simulation
function ecdsaSign(messageHash: string, privateKey: string): {
  r: string;
  s: string;
  steps: string[];
} {
  // Simulated ECDSA - educational only
  const hash = BigInt('0x' + messageHash.slice(0, 16));
  const priv = BigInt('0x' + privateKey.slice(0, 8)) || 12345n;

  // Random k (in real ECDSA, this MUST be cryptographically random)
  const k = BigInt(Math.floor(Math.random() * 1000000) + 1);

  // Simulated curve order
  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

  // r = (k * G).x mod n (simulated)
  const r = ((k * 0x79BE667EF9DCBBACn) % n);

  // s = k^(-1) * (hash + r * privateKey) mod n
  const kInv = modInverse(k, n);
  const s = (kInv * (hash + r * priv)) % n;

  return {
    r: r.toString(16).padStart(64, '0'),
    s: s.toString(16).padStart(64, '0'),
    steps: [
      '1. Generate random k',
      '2. Compute R = k × G (point on curve)',
      '3. r = R.x mod n',
      '4. s = k⁻¹ × (hash + r × privateKey) mod n',
      '5. Signature = (r, s)'
    ]
  };
}

// EdDSA signature simulation
function eddsaSign(message: string, privateKey: string): {
  R: string;
  s: string;
  steps: string[];
} {
  // Simulated EdDSA - educational only
  const hash = simpleHash(message, 'SHA-512');

  // Simulated values
  const r = BigInt('0x' + hash.hex.slice(0, 32));
  const R = (r * 0x216936D3CD6E53FEC0A4E231FDD6DCn) % (2n ** 255n);
  const s = (r + BigInt('0x' + privateKey.slice(0, 16)) * BigInt('0x' + hash.hex.slice(32, 64))) % (2n ** 255n);

  return {
    R: R.toString(16).padStart(64, '0'),
    s: s.toString(16).padStart(64, '0'),
    steps: [
      '1. Hash private key to get (a, prefix)',
      '2. r = H(prefix || message)',
      '3. R = r × B (base point)',
      '4. h = H(R || public_key || message)',
      '5. s = r + h × a mod L',
      '6. Signature = (R, s)'
    ]
  };
}

// Schnorr signature simulation
function schnorrSign(messageHash: string, privateKey: string): {
  R: string;
  s: string;
  steps: string[];
} {
  const hash = BigInt('0x' + messageHash.slice(0, 16));
  const priv = BigInt('0x' + privateKey.slice(0, 8)) || 12345n;

  const k = BigInt(Math.floor(Math.random() * 1000000) + 1);
  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

  const R = (k * 0x79BE667EF9DCBBACn) % n;
  const e = (hash + R) % n;
  const s = (k + e * priv) % n;

  return {
    R: R.toString(16).padStart(64, '0'),
    s: s.toString(16).padStart(64, '0'),
    steps: [
      '1. Generate random k',
      '2. R = k × G',
      '3. e = H(R || public_key || message)',
      '4. s = k + e × private_key mod n',
      '5. Signature = (R, s)'
    ]
  };
}

// Format hex with ellipsis
function shortHex(hex: string, maxLen: number = 16): string {
  if (hex.length <= maxLen) return hex;
  return hex.slice(0, maxLen / 2) + '...' + hex.slice(-maxLen / 2);
}

// Algorithm comparison
function compareAlgorithms(): {
  algorithms: { name: string; keySize: string; sigSize: string; speed: string; security: string; usage: string }[];
} {
  return {
    algorithms: [
      {
        name: 'RSA-PSS',
        keySize: '2048-4096 bits',
        sigSize: 'Same as key size',
        speed: 'Slow (large exponents)',
        security: 'Based on factoring',
        usage: 'Legacy systems, certificates'
      },
      {
        name: 'ECDSA',
        keySize: '256-521 bits',
        sigSize: '512-1042 bits',
        speed: 'Medium',
        security: 'Based on ECDLP',
        usage: 'TLS, Bitcoin, Ethereum'
      },
      {
        name: 'EdDSA (Ed25519)',
        keySize: '256 bits',
        sigSize: '512 bits',
        speed: 'Fast',
        security: 'Based on ECDLP',
        usage: 'SSH, modern protocols'
      },
      {
        name: 'Schnorr',
        keySize: '256 bits',
        sigSize: '512 bits',
        speed: 'Fast',
        security: 'Based on ECDLP',
        usage: 'Bitcoin Taproot'
      }
    ]
  };
}

export async function executedigitalsignature(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';
    const algorithm = args.algorithm || 'ECDSA';

    let result: any;

    switch (operation) {
      case 'info':
        result = {
          tool: 'digital-signature',
          description: 'Digital signature schemes for authentication and integrity',
          operations: [
            'info - Tool information',
            'sign - Sign a message (educational)',
            'verify - Verify a signature',
            'generate_keypair - Generate signing keypair',
            'compare - Compare signature algorithms',
            'hash - Hash a message',
            'demonstrate - Show signature concepts'
          ],
          algorithms: ['RSA-PSS', 'RSA-PKCS1', 'ECDSA', 'EdDSA', 'Schnorr'],
          purposes: [
            'Authentication - Prove identity',
            'Integrity - Detect tampering',
            'Non-repudiation - Cannot deny signing'
          ],
          process: [
            '1. Hash the message',
            '2. Sign the hash with private key',
            '3. Anyone can verify with public key'
          ]
        };
        break;

      case 'hash': {
        const message = args.message || 'Hello, World!';
        const hashAlg = args.hash_algorithm || 'SHA-256';

        const hash = simpleHash(message, hashAlg);

        result = {
          operation: 'Hash Message',
          algorithm: hashAlg,
          message: message.length > 50 ? message.slice(0, 50) + '...' : message,
          messageLength: message.length + ' characters',
          hash: {
            hex: shortHex(hash.hex, 32),
            fullHex: hash.hex,
            bits: hash.bits
          },
          properties: [
            'Deterministic: Same input → same output',
            'One-way: Cannot reverse to get input',
            'Collision-resistant: Hard to find two inputs with same hash',
            'Avalanche effect: Small change → completely different hash'
          ],
          note: 'Educational hash - use crypto libraries for real applications'
        };
        break;
      }

      case 'sign': {
        const message = args.message || 'Sign this message';
        const hashAlg = args.hash_algorithm || 'SHA-256';

        const hash = simpleHash(message, hashAlg);
        let signature: any;
        let steps: string[];

        if (algorithm === 'RSA-PSS' || algorithm === 'RSA-PKCS1') {
          const keypair = generateRSAKeypair();
          const hashBigInt = BigInt('0x' + hash.hex.slice(0, 16));
          const n = BigInt('0x' + keypair.privateKey.n);
          const d = BigInt('0x' + keypair.privateKey.d);
          const sig = rsaSign(hashBigInt, d, n);

          signature = {
            algorithm,
            signature: sig.toString(16),
            publicKey: keypair.publicKey
          };
          steps = [
            '1. Hash message: H(m)',
            '2. Pad hash (PSS or PKCS#1)',
            '3. Sign: s = padded_hash^d mod n',
            '4. Output signature s'
          ];
        } else if (algorithm === 'ECDSA') {
          const privateKey = Math.random().toString(16).slice(2, 34);
          signature = ecdsaSign(hash.hex, privateKey);
          steps = signature.steps;
          delete signature.steps;
        } else if (algorithm === 'EdDSA') {
          const privateKey = Math.random().toString(16).slice(2, 66);
          signature = eddsaSign(message, privateKey);
          steps = signature.steps;
          delete signature.steps;
        } else {
          const privateKey = Math.random().toString(16).slice(2, 34);
          signature = schnorrSign(hash.hex, privateKey);
          steps = signature.steps;
          delete signature.steps;
        }

        result = {
          operation: 'Sign Message',
          algorithm,
          message: message.length > 50 ? message.slice(0, 50) + '...' : message,
          hash: shortHex(hash.hex, 24),
          signature,
          steps,
          securityNote: 'Educational implementation - use crypto libraries for real signatures'
        };
        break;
      }

      case 'verify': {
        const message = args.message || 'Verify this message';
        const hashAlg = args.hash_algorithm || 'SHA-256';
        const hash = simpleHash(message, hashAlg);

        result = {
          operation: 'Verify Signature',
          algorithm,
          message: message.length > 50 ? message.slice(0, 50) + '...' : message,
          hash: shortHex(hash.hex, 24),
          verificationSteps: algorithm.startsWith('RSA') ? [
            '1. Hash the message: H(m)',
            '2. Recover hash from signature: H\' = s^e mod n',
            '3. Verify padding and compare hashes',
            '4. Accept if H = H\', reject otherwise'
          ] : algorithm === 'ECDSA' ? [
            '1. Hash the message: e = H(m)',
            '2. Compute u1 = e × s⁻¹ mod n',
            '3. Compute u2 = r × s⁻¹ mod n',
            '4. Compute R = u1×G + u2×Q',
            '5. Accept if R.x ≡ r (mod n)'
          ] : [
            '1. Hash message with public key and R',
            '2. Compute verification equation',
            '3. Check if s×B = R + H(R||P||m)×P'
          ],
          result: 'VALID (simulated)',
          securityProperties: [
            'Unforgeability: Cannot create valid signature without private key',
            'Non-repudiation: Signer cannot deny creating signature',
            'Integrity: Any message modification invalidates signature'
          ]
        };
        break;
      }

      case 'generate_keypair': {
        let keypair: any;

        if (algorithm.startsWith('RSA')) {
          keypair = generateRSAKeypair(2048);
          result = {
            operation: 'Generate RSA Keypair',
            algorithm,
            publicKey: {
              n: shortHex(keypair.publicKey.n, 32) + '...',
              e: keypair.publicKey.e
            },
            privateKey: {
              d: shortHex(keypair.privateKey.d, 32) + '... (SECRET)',
              p: keypair.privateKey.p + ' (SECRET)',
              q: keypair.privateKey.q + ' (SECRET)'
            },
            keyGenSteps: [
              '1. Generate two large primes p, q',
              '2. Compute n = p × q',
              '3. Compute φ(n) = (p-1)(q-1)',
              '4. Choose e (typically 65537)',
              '5. Compute d = e⁻¹ mod φ(n)',
              '6. Public: (n, e), Private: (d, p, q)'
            ],
            securityNote: 'Educational small primes - use 2048+ bits for real use'
          };
        } else {
          const privateKey = Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
          ).join('');

          // Simulated public key derivation
          const pubX = simpleHash(privateKey, 'SHA-256').hex;
          const pubY = simpleHash(pubX, 'SHA-256').hex;

          result = {
            operation: `Generate ${algorithm} Keypair`,
            algorithm,
            curve: algorithm === 'EdDSA' ? 'Ed25519' : 'secp256k1',
            publicKey: {
              x: shortHex(pubX, 24),
              y: shortHex(pubY, 24)
            },
            privateKey: shortHex(privateKey, 24) + '... (SECRET)',
            keyGenSteps: [
              '1. Generate random 256-bit private key d',
              '2. Compute public key Q = d × G',
              '3. Public: Q (point), Private: d (scalar)'
            ],
            securityNote: 'Educational - use crypto libraries for real key generation'
          };
        }
        break;
      }

      case 'compare': {
        const comparison = compareAlgorithms();

        result = {
          operation: 'Compare Signature Algorithms',
          algorithms: comparison.algorithms,
          recommendations: {
            legacy: 'RSA-PSS with 2048+ bits',
            modern: 'Ed25519 for new systems',
            blockchain: 'ECDSA (secp256k1) or Schnorr',
            highSecurity: 'ECDSA with P-384 or Ed448'
          },
          keyTakeaways: [
            'ECC algorithms have smaller keys/signatures than RSA',
            'EdDSA is deterministic (no random k needed)',
            'Schnorr enables signature aggregation',
            'RSA still widely used for legacy compatibility'
          ]
        };
        break;
      }

      case 'demonstrate': {
        const message = 'Hello, this is a signed message!';
        const hash = simpleHash(message, 'SHA-256');

        let demo = `
╔═══════════════════════════════════════════════════════════════════════╗
║                 DIGITAL SIGNATURES DEMONSTRATION                      ║
╚═══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
                     WHAT IS A DIGITAL SIGNATURE?
═══════════════════════════════════════════════════════════════════════

A digital signature provides:
  ✓ AUTHENTICATION - Proves the signer's identity
  ✓ INTEGRITY - Detects if message was modified
  ✓ NON-REPUDIATION - Signer cannot deny signing

Unlike handwritten signatures:
  • Bound to specific message (not transferable)
  • Mathematically verifiable
  • Cannot be forged without private key

═══════════════════════════════════════════════════════════════════════
                        THE SIGNING PROCESS
═══════════════════════════════════════════════════════════════════════

Message: "${message}"

Step 1: HASH THE MESSAGE
┌─────────────────────────────────────────────────────────────────────┐
│ Input:  "${message}"                                                │
│ Hash:   ${shortHex(hash.hex, 48)}     │
│ Size:   ${hash.bits} bits (fixed)                                           │
└─────────────────────────────────────────────────────────────────────┘

Step 2: SIGN THE HASH
┌─────────────────────────────────────────────────────────────────────┐
│ Input:  Hash + Private Key                                          │
│ Output: Digital Signature                                           │
│ Only the private key holder can create a valid signature            │
└─────────────────────────────────────────────────────────────────────┘

Step 3: VERIFY (anyone can do this)
┌─────────────────────────────────────────────────────────────────────┐
│ Input:  Message + Signature + Public Key                            │
│ Output: VALID or INVALID                                            │
│ Anyone can verify without knowing the private key                   │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                        RSA SIGNATURES
═══════════════════════════════════════════════════════════════════════

RSA Digital Signature:
  • Sign:    signature = hash^d mod n
  • Verify:  hash' = signature^e mod n, check hash' = hash

`;

        const rsaKeys = generateRSAKeypair();
        const hashNum = BigInt('0x' + hash.hex.slice(0, 16));
        const n = BigInt('0x' + rsaKeys.privateKey.n);
        const d = BigInt('0x' + rsaKeys.privateKey.d);
        const e = BigInt('0x' + rsaKeys.publicKey.e);
        const sig = rsaSign(hashNum, d, n);
        const recovered = rsaVerify(sig, e, n);

        demo += `Example (small educational primes):
  Public Key:  n = ${rsaKeys.publicKey.n}, e = ${rsaKeys.publicKey.e}
  Private Key: d = ${shortHex(rsaKeys.privateKey.d, 12)}

  Hash (truncated): ${hashNum.toString(16)}
  Signature:        ${sig.toString(16)}
  Recovered Hash:   ${recovered.toString(16)}
  Match: ${hashNum === recovered ? 'YES ✓' : 'NO ✗'}

Security: Breaking RSA requires factoring n = p × q

═══════════════════════════════════════════════════════════════════════
                       ECDSA SIGNATURES
═══════════════════════════════════════════════════════════════════════

ECDSA (used in Bitcoin, Ethereum):

  Sign:
    1. Generate random k
    2. R = k × G (point on curve)
    3. r = R.x mod n
    4. s = k⁻¹ × (hash + r × private_key) mod n
    5. Signature = (r, s)

  Verify:
    1. u₁ = hash × s⁻¹ mod n
    2. u₂ = r × s⁻¹ mod n
    3. R' = u₁×G + u₂×Q
    4. Valid if R'.x ≡ r (mod n)

`;

        const ecdsaSig = ecdsaSign(hash.hex, 'abcd1234');
        demo += `Example:
  r = ${shortHex(ecdsaSig.r, 32)}
  s = ${shortHex(ecdsaSig.s, 32)}

⚠️  CRITICAL: k must be random and secret!
    If k is reused or predictable, private key can be recovered.
    (This happened to PlayStation 3 and many Bitcoin wallets)

═══════════════════════════════════════════════════════════════════════
                      EdDSA (Ed25519)
═══════════════════════════════════════════════════════════════════════

EdDSA is deterministic - no random k needed!

  Sign:
    1. (a, prefix) = H(private_key)  [expand key]
    2. r = H(prefix || message)       [deterministic!]
    3. R = r × B                      [base point]
    4. h = H(R || public_key || message)
    5. s = r + h × a mod L
    6. Signature = (R, s)

`;

        const eddsaSig = eddsaSign(message, 'abcd1234567890abcdef');
        demo += `Example:
  R = ${shortHex(eddsaSig.R, 32)}
  s = ${shortHex(eddsaSig.s, 32)}

Advantages:
  ✓ Deterministic (no RNG failures)
  ✓ Fast signing and verification
  ✓ Small keys and signatures (32 + 32 bytes)
  ✓ Resistant to side-channel attacks

═══════════════════════════════════════════════════════════════════════
                      SCHNORR SIGNATURES
═══════════════════════════════════════════════════════════════════════

Schnorr signatures are simpler than ECDSA:

  Sign:
    1. Generate random k
    2. R = k × G
    3. e = H(R || P || message)
    4. s = k + e × private_key mod n
    5. Signature = (R, s)

  Verify:
    s × G = R + e × P

Key advantage: SIGNATURE AGGREGATION
  Multiple signatures can be combined into one!
  Used in Bitcoin Taproot for privacy and efficiency.

═══════════════════════════════════════════════════════════════════════
                     ALGORITHM COMPARISON
═══════════════════════════════════════════════════════════════════════

┌─────────────┬───────────────┬─────────────┬──────────────────────────┐
│ Algorithm   │ Key Size      │ Sig Size    │ Best For                 │
├─────────────┼───────────────┼─────────────┼──────────────────────────┤
│ RSA-2048    │ 2048 bits     │ 2048 bits   │ Legacy, certificates     │
│ RSA-4096    │ 4096 bits     │ 4096 bits   │ Long-term security       │
│ ECDSA P-256 │ 256 bits      │ 512 bits    │ TLS, general use         │
│ secp256k1   │ 256 bits      │ 512 bits    │ Bitcoin, Ethereum        │
│ Ed25519     │ 256 bits      │ 512 bits    │ Modern applications      │
│ Schnorr     │ 256 bits      │ 512 bits    │ Bitcoin Taproot          │
└─────────────┴───────────────┴─────────────┴──────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                        KEY INSIGHTS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│ 1. Always HASH before signing (fixed-size input)                   │
│                                                                     │
│ 2. NEVER reuse random k in ECDSA (catastrophic!)                   │
│                                                                     │
│ 3. EdDSA eliminates RNG risk with deterministic signing            │
│                                                                     │
│ 4. ECC signatures are much smaller than RSA                        │
│                                                                     │
│ 5. Schnorr enables advanced features (MuSig, adaptor sigs)         │
│                                                                     │
│ 6. Public key distribution is the key challenge (PKI, Web of Trust)│
└─────────────────────────────────────────────────────────────────────┘
`;

        result = {
          demonstration: demo,
          summary: {
            purpose: ['Authentication', 'Integrity', 'Non-repudiation'],
            algorithms: ['RSA-PSS', 'ECDSA', 'EdDSA', 'Schnorr'],
            recommendation: 'Ed25519 for new systems',
            keyPoint: 'Sign the hash, not the message directly'
          }
        };
        break;
      }

      default:
        result = { error: `Unknown operation: ${operation}`, availableOperations: ['info', 'sign', 'verify', 'generate_keypair', 'compare', 'hash', 'demonstrate'] };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isdigitalsignatureAvailable(): boolean { return true; }
