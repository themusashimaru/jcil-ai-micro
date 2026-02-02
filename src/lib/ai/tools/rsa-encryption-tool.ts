/**
 * RSA-ENCRYPTION TOOL
 * RSA public key cryptography with real mathematical operations
 * Implements modular exponentiation, key generation, encryption/decryption
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const rsaencryptionTool: UnifiedTool = {
  name: 'rsa_encryption',
  description: `RSA public key encryption and digital signatures.

Operations:
- info: RSA algorithm explanation and security analysis
- generate_keypair: Generate RSA key pair (educational demonstration)
- encrypt: Encrypt message with public key
- decrypt: Decrypt ciphertext with private key
- sign: Create digital signature
- verify: Verify digital signature
- analyze: Security analysis for given key size
- demonstrate: Step-by-step RSA walkthrough

Parameters:
- operation: The operation to perform
- key_size: Key size in bits (2048, 3072, 4096)
- message: Message to encrypt/sign (number or text)
- public_key: Public key {e, n} for encryption/verification
- private_key: Private key {d, n} for decryption/signing
- signature: Signature to verify`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'generate_keypair', 'encrypt', 'decrypt', 'sign', 'verify', 'analyze', 'demonstrate'],
        description: 'Operation to perform'
      },
      key_size: {
        type: 'number',
        enum: [512, 1024, 2048, 3072, 4096],
        description: 'Key size in bits'
      },
      message: { type: 'string', description: 'Message to encrypt/sign' },
      public_key: { type: 'object', description: 'Public key {e, n}' },
      private_key: { type: 'object', description: 'Private key {d, n}' },
      signature: { type: 'string', description: 'Signature to verify' }
    },
    required: ['operation']
  }
};

// ============================================================================
// RSA MATHEMATICS
// ============================================================================

/**
 * Greatest Common Divisor using Euclidean algorithm
 */
function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Extended Euclidean Algorithm
 * Returns [gcd, x, y] where ax + by = gcd(a, b)
 */
function extendedGcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) {
    return [a, 1n, 0n];
  }
  const [g, x1, y1] = extendedGcd(b, a % b);
  const x = y1;
  const y = x1 - (a / b) * y1;
  return [g, x, y];
}

/**
 * Modular multiplicative inverse
 * Find x such that (a * x) mod m = 1
 */
function modInverse(a: bigint, m: bigint): bigint {
  const [g, x] = extendedGcd(a % m, m);
  if (g !== 1n) {
    throw new Error('Modular inverse does not exist');
  }
  return ((x % m) + m) % m;
}

/**
 * Modular exponentiation: (base^exp) mod mod
 * Uses square-and-multiply for efficiency
 */
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

/**
 * Miller-Rabin primality test
 */
function isProbablePrime(n: bigint, k: number = 10): boolean {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;

  // Write n-1 as 2^r * d
  let r = 0n;
  let d = n - 1n;
  while (d % 2n === 0n) {
    r++;
    d /= 2n;
  }

  // Witness loop
  for (let i = 0; i < k; i++) {
    // Random witness between 2 and n-2
    const a = 2n + BigInt(Math.floor(Math.random() * Number(n - 4n)));
    let x = modPow(a, d, n);

    if (x === 1n || x === n - 1n) continue;

    let composite = true;
    for (let j = 0n; j < r - 1n; j++) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

/**
 * Generate random prime of approximately the given bit length
 */
function generatePrime(bits: number): bigint {
  const min = 2n ** BigInt(bits - 1);
  const max = 2n ** BigInt(bits) - 1n;

  while (true) {
    // Generate random odd number in range
    let candidate = min + BigInt(Math.floor(Math.random() * Number(max - min)));
    if (candidate % 2n === 0n) candidate++;

    if (isProbablePrime(candidate, 20)) {
      return candidate;
    }
  }
}

/**
 * Calculate Euler's totient function φ(n) for n = p*q
 */
function eulerTotient(p: bigint, q: bigint): bigint {
  return (p - 1n) * (q - 1n);
}

/**
 * Generate RSA key pair
 */
function generateKeyPair(bitSize: number): {
  publicKey: { e: string; n: string };
  privateKey: { d: string; p: string; q: string; n: string };
  phi: string;
} {
  // For educational purposes, use smaller primes
  const halfBits = Math.floor(bitSize / 2);

  // Generate two distinct primes
  const p = generatePrime(Math.min(halfBits, 32)); // Limit for demo
  let q = generatePrime(Math.min(halfBits, 32));
  while (q === p) {
    q = generatePrime(Math.min(halfBits, 32));
  }

  // Calculate n = p * q
  const n = p * q;

  // Calculate φ(n) = (p-1)(q-1)
  const phi = eulerTotient(p, q);

  // Choose public exponent e (commonly 65537)
  let e = 65537n;
  while (gcd(e, phi) !== 1n) {
    e += 2n;
  }

  // Calculate private exponent d = e^(-1) mod φ(n)
  const d = modInverse(e, phi);

  return {
    publicKey: { e: e.toString(), n: n.toString() },
    privateKey: { d: d.toString(), p: p.toString(), q: q.toString(), n: n.toString() },
    phi: phi.toString()
  };
}

/**
 * Encrypt message using public key
 */
function encrypt(message: bigint, e: bigint, n: bigint): bigint {
  if (message >= n) {
    throw new Error('Message must be less than n');
  }
  return modPow(message, e, n);
}

/**
 * Decrypt ciphertext using private key
 */
function decrypt(ciphertext: bigint, d: bigint, n: bigint): bigint {
  return modPow(ciphertext, d, n);
}

/**
 * Convert text to number for encryption
 */
function textToNumber(text: string): bigint {
  let result = 0n;
  for (let i = 0; i < text.length; i++) {
    result = result * 256n + BigInt(text.charCodeAt(i));
  }
  return result;
}

/**
 * Convert number back to text
 */
function numberToText(num: bigint): string {
  let result = '';
  while (num > 0n) {
    result = String.fromCharCode(Number(num % 256n)) + result;
    num = num / 256n;
  }
  return result;
}

/**
 * Analyze RSA security
 */
function analyzeSecur(keySize: number): {
  keySize: number;
  securityBits: number;
  factorizationDifficulty: string;
  quantumVulnerable: boolean;
  recommendedUntil: string;
  attacks: string[];
} {
  const securityBits = Math.floor(keySize / 20); // Approximate

  let difficulty: string;
  let recommended: string;

  if (keySize <= 512) {
    difficulty = 'Trivially broken - can be factored in seconds';
    recommended = 'Already broken';
  } else if (keySize <= 1024) {
    difficulty = 'Weak - factored by nation-state actors';
    recommended = 'Deprecated since 2013';
  } else if (keySize <= 2048) {
    difficulty = 'Currently secure for most applications';
    recommended = '~2030';
  } else if (keySize <= 3072) {
    difficulty = 'Strong security margin';
    recommended = '~2040';
  } else {
    difficulty = 'Very strong - significant safety margin';
    recommended = 'Beyond 2040';
  }

  return {
    keySize,
    securityBits,
    factorizationDifficulty: difficulty,
    quantumVulnerable: true, // Shor's algorithm
    recommendedUntil: recommended,
    attacks: [
      'Factorization (GNFS) - classical threat',
      "Shor's algorithm - quantum threat",
      'Timing attacks - implementation vulnerability',
      'Padding oracle - if using PKCS#1 v1.5',
      'Bleichenbacher attack - on PKCS#1 v1.5'
    ]
  };
}

export async function executeraesncryption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'RSA Encryption',
          description: 'RSA (Rivest-Shamir-Adleman) is a public-key cryptosystem',

          mathematicalBasis: {
            problem: 'Integer Factorization Problem',
            assumption: 'Factoring n=pq is computationally hard when p,q are large primes',
            keyGeneration: [
              '1. Choose two large primes p and q',
              '2. Compute n = p × q (modulus)',
              '3. Compute φ(n) = (p-1)(q-1) (Euler totient)',
              '4. Choose e coprime to φ(n) (public exponent, often 65537)',
              '5. Compute d ≡ e⁻¹ (mod φ(n)) (private exponent)'
            ],
            publicKey: '(n, e)',
            privateKey: '(n, d) or (p, q, d)'
          },

          operations: {
            encryption: 'c ≡ m^e (mod n)',
            decryption: 'm ≡ c^d (mod n)',
            signing: 's ≡ m^d (mod n)',
            verification: 'm ≡ s^e (mod n)'
          },

          correctnessProof: {
            statement: 'Decryption recovers the original message',
            proof: [
              'c^d ≡ (m^e)^d ≡ m^(ed) (mod n)',
              'Since ed ≡ 1 (mod φ(n)), we have ed = 1 + kφ(n)',
              'By Euler\'s theorem: m^φ(n) ≡ 1 (mod n)',
              'Therefore: m^(ed) = m × (m^φ(n))^k ≡ m × 1 ≡ m (mod n)'
            ]
          },

          keySizes: {
            '1024': 'DEPRECATED - can be factored',
            '2048': 'Minimum recommended (128-bit security)',
            '3072': 'Good for sensitive data (128+ bit security)',
            '4096': 'High security applications'
          },

          padding: {
            'PKCS#1 v1.5': 'Legacy, vulnerable to Bleichenbacher attack',
            'OAEP': 'Optimal Asymmetric Encryption Padding - recommended',
            'PSS': 'Probabilistic Signature Scheme - recommended for signing'
          },

          usage: 'Use operation: generate_keypair, encrypt, decrypt, sign, verify, analyze, demonstrate'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'generate_keypair': {
        const keySize = args.key_size || 64; // Small for demo
        const keys = generateKeyPair(keySize);

        const result = {
          operation: 'generate_keypair',
          requestedBits: keySize,
          note: 'Educational demonstration with small primes',

          publicKey: keys.publicKey,
          privateKey: keys.privateKey,

          calculations: {
            p: keys.privateKey.p,
            q: keys.privateKey.q,
            'n = p × q': keys.publicKey.n,
            'φ(n) = (p-1)(q-1)': keys.phi,
            'e (public exponent)': keys.publicKey.e,
            'd ≡ e⁻¹ (mod φ(n))': keys.privateKey.d
          },

          verification: {
            'e × d mod φ(n)': ((BigInt(keys.publicKey.e) * BigInt(keys.privateKey.d)) % BigInt(keys.phi)).toString(),
            'Should equal 1': '1'
          },

          warning: 'DO NOT use for real encryption - educational demo only!'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'encrypt': {
        const message = args.message;
        const pubKey = args.public_key;

        if (!pubKey || !pubKey.e || !pubKey.n) {
          throw new Error('Public key {e, n} required');
        }

        const e = BigInt(pubKey.e);
        const n = BigInt(pubKey.n);

        let m: bigint;
        if (/^\d+$/.test(message)) {
          m = BigInt(message);
        } else {
          m = textToNumber(message);
        }

        if (m >= n) {
          throw new Error('Message too large for key size');
        }

        const c = encrypt(m, e, n);

        const result = {
          operation: 'encrypt',
          plaintext: message,
          plaintextNumeric: m.toString(),
          publicKey: pubKey,

          calculation: {
            formula: 'c ≡ m^e (mod n)',
            'm': m.toString(),
            'e': e.toString(),
            'n': n.toString(),
            'c = m^e mod n': c.toString()
          },

          ciphertext: c.toString()
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'decrypt': {
        const ciphertext = args.message;
        const privKey = args.private_key;

        if (!privKey || !privKey.d || !privKey.n) {
          throw new Error('Private key {d, n} required');
        }

        const d = BigInt(privKey.d);
        const n = BigInt(privKey.n);
        const c = BigInt(ciphertext);

        const m = decrypt(c, d, n);
        const textResult = numberToText(m);

        const result = {
          operation: 'decrypt',
          ciphertext: ciphertext,
          privateKeyUsed: { d: d.toString(), n: n.toString() },

          calculation: {
            formula: 'm ≡ c^d (mod n)',
            'c': c.toString(),
            'd': d.toString(),
            'n': n.toString(),
            'm = c^d mod n': m.toString()
          },

          plaintextNumeric: m.toString(),
          plaintextText: textResult || '(non-text data)'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'sign': {
        const message = args.message;
        const privKey = args.private_key;

        if (!privKey || !privKey.d || !privKey.n) {
          throw new Error('Private key {d, n} required');
        }

        const d = BigInt(privKey.d);
        const n = BigInt(privKey.n);

        // Hash the message (simplified - just use the numeric representation)
        let m: bigint;
        if (/^\d+$/.test(message)) {
          m = BigInt(message);
        } else {
          m = textToNumber(message);
        }

        // Signature is message raised to private exponent
        const signature = modPow(m, d, n);

        const result = {
          operation: 'sign',
          message: message,
          messageHash: m.toString(),

          calculation: {
            formula: 's ≡ m^d (mod n)',
            'm (hash)': m.toString(),
            'd': d.toString(),
            'n': n.toString(),
            's = m^d mod n': signature.toString()
          },

          signature: signature.toString(),
          note: 'In practice, sign hash of message with proper padding (PSS)'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'verify': {
        const message = args.message;
        const signature = args.signature;
        const pubKey = args.public_key;

        if (!pubKey || !pubKey.e || !pubKey.n) {
          throw new Error('Public key {e, n} required');
        }

        const e = BigInt(pubKey.e);
        const n = BigInt(pubKey.n);
        const s = BigInt(signature);

        // Recover message hash from signature
        const recovered = modPow(s, e, n);

        // Calculate expected hash
        let expected: bigint;
        if (/^\d+$/.test(message)) {
          expected = BigInt(message);
        } else {
          expected = textToNumber(message);
        }

        const valid = recovered === expected;

        const result = {
          operation: 'verify',
          message: message,
          signature: signature,

          calculation: {
            formula: 'm\' ≡ s^e (mod n)',
            's': s.toString(),
            'e': e.toString(),
            'n': n.toString(),
            'recovered = s^e mod n': recovered.toString(),
            'expected (message hash)': expected.toString()
          },

          valid: valid,
          verification: valid ? 'SIGNATURE VALID ✓' : 'SIGNATURE INVALID ✗'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'analyze': {
        const keySize = args.key_size || 2048;
        const analysis = analyzeSecur(keySize);

        const result = {
          operation: 'security_analysis',
          ...analysis,

          nistRecommendations: {
            '2024-2030': 'Minimum 2048-bit',
            '2031+': '3072-bit recommended',
            'Long-term': 'Consider post-quantum alternatives'
          },

          performanceNotes: {
            keyGeneration: `~${Math.pow(keySize / 1024, 3) * 100}ms typical`,
            encryption: 'Fast (public exponent is small)',
            decryption: `~${keySize / 10}x slower than encryption`,
            signing: 'Similar to decryption',
            verification: 'Similar to encryption'
          },

          postQuantumAlternatives: [
            'CRYSTALS-Kyber (key encapsulation)',
            'CRYSTALS-Dilithium (signatures)',
            'SPHINCS+ (hash-based signatures)',
            'NTRU (lattice-based)'
          ]
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'demonstrate': {
        // Full end-to-end demonstration
        const keys = generateKeyPair(64);
        const message = args.message || 'Hi';
        const m = textToNumber(message);

        const e = BigInt(keys.publicKey.e);
        const d = BigInt(keys.privateKey.d);
        const n = BigInt(keys.publicKey.n);

        const ciphertext = encrypt(m, e, n);
        const decrypted = decrypt(ciphertext, d, n);
        const decryptedText = numberToText(decrypted);

        const result = {
          operation: 'demonstrate',
          title: 'Complete RSA Encryption/Decryption Demo',

          step1_keyGeneration: {
            description: 'Generate two primes and compute keys',
            p: keys.privateKey.p,
            q: keys.privateKey.q,
            'n = p × q': keys.publicKey.n,
            'φ(n)': keys.phi,
            'e (chosen)': keys.publicKey.e,
            'd = e⁻¹ mod φ(n)': keys.privateKey.d
          },

          step2_encryption: {
            description: 'Alice encrypts message with Bob\'s public key',
            message: message,
            'message as number': m.toString(),
            formula: 'c = m^e mod n',
            ciphertext: ciphertext.toString()
          },

          step3_decryption: {
            description: 'Bob decrypts with his private key',
            ciphertext: ciphertext.toString(),
            formula: 'm = c^d mod n',
            'decrypted number': decrypted.toString(),
            'decrypted text': decryptedText
          },

          verification: {
            originalMessage: message,
            recoveredMessage: decryptedText,
            success: message === decryptedText
          },

          mathematicalProof: {
            'c^d mod n': `(${m}^${e})^${d} mod ${n}`,
            'Simplifies to': `${m}^(${e}×${d}) mod ${n}`,
            'Since e×d ≡ 1 mod φ(n)': `${m}^1 = ${m}`,
            'Result': decrypted.toString()
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, generate_keypair, encrypt, decrypt, sign, verify, analyze, demonstrate`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isrsaencryptionAvailable(): boolean { return true; }
