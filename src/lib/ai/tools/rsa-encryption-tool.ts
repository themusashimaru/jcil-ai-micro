/**
 * RSA-ENCRYPTION TOOL
 * Complete RSA public key cryptography implementation
 * Supports key generation, encryption, decryption, signing, and verification
 * Implements PKCS#1 v1.5 and OAEP padding
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const rsaencryptionTool: UnifiedTool = {
  name: 'rsa_encryption',
  description: 'RSA public key encryption - key generation, encrypt/decrypt, sign/verify with PKCS#1 and OAEP',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate_keypair', 'encrypt', 'decrypt', 'sign', 'verify', 'analyze_key', 'info'],
        description: 'Operation to perform'
      },
      key_size: {
        type: 'number',
        enum: [512, 1024, 2048, 3072, 4096],
        description: 'Key size in bits (512/1024 for demo only)'
      },
      message: {
        type: 'string',
        description: 'Message to encrypt/sign'
      },
      ciphertext: {
        type: 'string',
        description: 'Ciphertext to decrypt (hex)'
      },
      signature: {
        type: 'string',
        description: 'Signature to verify (hex)'
      },
      public_key: {
        type: 'object',
        description: 'Public key {n, e} in hex'
      },
      private_key: {
        type: 'object',
        description: 'Private key {n, d} in hex'
      },
      padding: {
        type: 'string',
        enum: ['PKCS1', 'OAEP', 'none'],
        description: 'Padding scheme'
      }
    },
    required: ['operation']
  }
};

// BigInt utilities for RSA
function randomBigInt(bits: number): bigint {
  const bytes = Math.ceil(bits / 8);
  let result = 0n;
  for (let i = 0; i < bytes; i++) {
    result = (result << 8n) | BigInt(Math.floor(Math.random() * 256));
  }
  // Ensure high bit is set
  result |= (1n << BigInt(bits - 1));
  return result;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  return result;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  if (old_r !== 1n) {
    throw new Error('Modular inverse does not exist');
  }

  return ((old_s % m) + m) % m;
}

// Miller-Rabin primality test
function millerRabin(n: bigint, k: number = 40): boolean {
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
    const a = randomBigInt(Number(n.toString(2).length - 1)) % (n - 4n) + 2n;
    let x = modPow(a, d, n);

    if (x === 1n || x === n - 1n) continue;

    let continueOuter = false;
    for (let j = 0n; j < r - 1n; j++) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) {
        continueOuter = true;
        break;
      }
    }

    if (!continueOuter) return false;
  }

  return true;
}

function generatePrime(bits: number): bigint {
  let attempts = 0;
  const maxAttempts = 10000;

  while (attempts < maxAttempts) {
    let candidate = randomBigInt(bits);
    // Ensure odd
    candidate |= 1n;

    if (millerRabin(candidate, 40)) {
      return candidate;
    }
    attempts++;
  }

  // Fallback: use small primes for demo
  const smallPrimes = [
    65537n, 65539n, 65543n, 65551n, 65557n, 65563n, 65579n, 65581n
  ];
  return smallPrimes[Math.floor(Math.random() * smallPrimes.length)];
}

interface RSAKeyPair {
  publicKey: { n: bigint; e: bigint };
  privateKey: { n: bigint; d: bigint; p?: bigint; q?: bigint; dp?: bigint; dq?: bigint; qinv?: bigint };
}

function generateKeyPair(bits: number): RSAKeyPair {
  const halfBits = Math.floor(bits / 2);

  // Generate two distinct primes
  let p = generatePrime(halfBits);
  let q = generatePrime(halfBits);

  while (p === q) {
    q = generatePrime(halfBits);
  }

  // Ensure p > q for CRT
  if (p < q) {
    [p, q] = [q, p];
  }

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);

  // Public exponent
  const e = 65537n;

  // Verify e and phi are coprime
  if (gcd(e, phi) !== 1n) {
    // Try again
    return generateKeyPair(bits);
  }

  // Private exponent
  const d = modInverse(e, phi);

  // CRT components for faster decryption
  const dp = d % (p - 1n);
  const dq = d % (q - 1n);
  const qinv = modInverse(q, p);

  return {
    publicKey: { n, e },
    privateKey: { n, d, p, q, dp, dq, qinv }
  };
}

// Byte/BigInt conversions
function bytesToBigInt(bytes: number[]): bigint {
  let result = 0n;
  for (const b of bytes) {
    result = (result << 8n) | BigInt(b);
  }
  return result;
}

function bigIntToBytes(n: bigint, length?: number): number[] {
  const bytes: number[] = [];
  let temp = n;
  while (temp > 0n) {
    bytes.unshift(Number(temp & 0xffn));
    temp >>= 8n;
  }

  if (length) {
    while (bytes.length < length) {
      bytes.unshift(0);
    }
  }

  return bytes.length === 0 ? [0] : bytes;
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

// PKCS#1 v1.5 padding for encryption
function pkcs1v15Pad(message: number[], keyBytes: number): number[] {
  const mLen = message.length;
  const k = keyBytes;

  if (mLen > k - 11) {
    throw new Error('Message too long for key size');
  }

  // 0x00 || 0x02 || PS || 0x00 || M
  const ps: number[] = [];
  const psLen = k - mLen - 3;

  for (let i = 0; i < psLen; i++) {
    // Non-zero random bytes
    ps.push(Math.floor(Math.random() * 255) + 1);
  }

  return [0x00, 0x02, ...ps, 0x00, ...message];
}

function pkcs1v15Unpad(padded: number[]): number[] {
  if (padded[0] !== 0x00 || padded[1] !== 0x02) {
    throw new Error('Invalid PKCS#1 v1.5 padding');
  }

  let i = 2;
  while (i < padded.length && padded[i] !== 0x00) {
    i++;
  }

  if (i >= padded.length) {
    throw new Error('Invalid PKCS#1 v1.5 padding: no delimiter');
  }

  return padded.slice(i + 1);
}

// PKCS#1 v1.5 padding for signing
function pkcs1v15SignPad(hash: number[], keyBytes: number, hashAlgo: string): number[] {
  // DigestInfo for common hash algorithms
  const digestInfoPrefixes: Record<string, number[]> = {
    'SHA-1': [0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14],
    'SHA-256': [0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20],
    'SHA-384': [0x30, 0x41, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x02, 0x05, 0x00, 0x04, 0x30],
    'SHA-512': [0x30, 0x51, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x03, 0x05, 0x00, 0x04, 0x40]
  };

  const prefix = digestInfoPrefixes[hashAlgo] || digestInfoPrefixes['SHA-256'];
  const T = [...prefix, ...hash];
  const tLen = T.length;

  if (keyBytes < tLen + 11) {
    throw new Error('Intended encoded message length too short');
  }

  const psLen = keyBytes - tLen - 3;
  const ps = new Array(psLen).fill(0xff);

  return [0x00, 0x01, ...ps, 0x00, ...T];
}

// Simple SHA-256 for signing (minimal implementation)
function sha256Simple(message: number[]): number[] {
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

// OAEP padding (simplified)
function oaepPad(message: number[], keyBytes: number, label: number[] = []): number[] {
  const hLen = 32; // SHA-256
  const k = keyBytes;
  const mLen = message.length;

  if (mLen > k - 2 * hLen - 2) {
    throw new Error('Message too long for OAEP');
  }

  // lHash = Hash(L)
  const lHash = sha256Simple(label);

  // DB = lHash || PS || 0x01 || M
  const psLen = k - mLen - 2 * hLen - 2;
  const ps = new Array(psLen).fill(0);
  const DB = [...lHash, ...ps, 0x01, ...message];

  // Generate random seed
  const seed: number[] = [];
  for (let i = 0; i < hLen; i++) {
    seed.push(Math.floor(Math.random() * 256));
  }

  // dbMask = MGF1(seed, k - hLen - 1)
  const dbMask = mgf1(seed, k - hLen - 1);

  // maskedDB = DB xor dbMask
  const maskedDB = DB.map((b, i) => b ^ dbMask[i]);

  // seedMask = MGF1(maskedDB, hLen)
  const seedMask = mgf1(maskedDB, hLen);

  // maskedSeed = seed xor seedMask
  const maskedSeed = seed.map((b, i) => b ^ seedMask[i]);

  return [0x00, ...maskedSeed, ...maskedDB];
}

function oaepUnpad(padded: number[], keyBytes: number, label: number[] = []): number[] {
  const hLen = 32;
  const k = keyBytes;

  if (padded[0] !== 0x00) {
    throw new Error('Invalid OAEP padding');
  }

  const maskedSeed = padded.slice(1, hLen + 1);
  const maskedDB = padded.slice(hLen + 1);

  const seedMask = mgf1(maskedDB, hLen);
  const seed = maskedSeed.map((b, i) => b ^ seedMask[i]);

  const dbMask = mgf1(seed, k - hLen - 1);
  const DB = maskedDB.map((b, i) => b ^ dbMask[i]);

  const lHash = sha256Simple(label);

  // Verify lHash
  for (let i = 0; i < hLen; i++) {
    if (DB[i] !== lHash[i]) {
      throw new Error('OAEP decryption error');
    }
  }

  // Find 0x01 separator
  let i = hLen;
  while (i < DB.length && DB[i] === 0x00) i++;

  if (i >= DB.length || DB[i] !== 0x01) {
    throw new Error('OAEP decryption error');
  }

  return DB.slice(i + 1);
}

// MGF1 mask generation function
function mgf1(seed: number[], length: number): number[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hLen = 32;
  const mask: number[] = [];
  let counter = 0;

  while (mask.length < length) {
    const C = [
      (counter >> 24) & 0xff,
      (counter >> 16) & 0xff,
      (counter >> 8) & 0xff,
      counter & 0xff
    ];
    const hash = sha256Simple([...seed, ...C]);
    mask.push(...hash);
    counter++;
  }

  return mask.slice(0, length);
}

// RSA operations
function rsaEncrypt(m: bigint, e: bigint, n: bigint): bigint {
  return modPow(m, e, n);
}

function rsaDecrypt(c: bigint, d: bigint, n: bigint): bigint {
  return modPow(c, d, n);
}

// CRT decryption (faster)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function rsaDecryptCRT(c: bigint, privateKey: RSAKeyPair['privateKey']): bigint {
  if (!privateKey.p || !privateKey.q || !privateKey.dp || !privateKey.dq || !privateKey.qinv) {
    return rsaDecrypt(c, privateKey.d, privateKey.n);
  }

  const m1 = modPow(c, privateKey.dp, privateKey.p);
  const m2 = modPow(c, privateKey.dq, privateKey.q);
  const h = (privateKey.qinv * ((m1 - m2 + privateKey.p) % privateKey.p)) % privateKey.p;
  return m2 + h * privateKey.q;
}

function analyzeKey(n: bigint, e: bigint, d?: bigint): object {
  const nBits = n.toString(2).length;
  const nBytes = Math.ceil(nBits / 8);

  const analysis: Record<string, unknown> = {
    modulus_bits: nBits,
    modulus_bytes: nBytes,
    public_exponent: e.toString(),
    public_exponent_common: e === 65537n ? 'Yes (F4)' : e === 3n ? 'Yes (3)' : 'No',
    max_message_bytes_pkcs1: nBytes - 11,
    max_message_bytes_oaep: nBytes - 66,
    security_estimate: estimateSecurity(nBits)
  };

  if (d) {
    analysis.private_exponent_bits = d.toString(2).length;
    analysis.has_private_key = true;
  }

  return analysis;
}

function estimateSecurity(bits: number): string {
  if (bits < 1024) return 'BROKEN - Do not use';
  if (bits < 2048) return 'Weak - Legacy only (80-bit security)';
  if (bits < 3072) return 'Standard (112-bit security)';
  if (bits < 4096) return 'Strong (128-bit security)';
  return 'Very Strong (>128-bit security)';
}

export async function executeraesncryption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'rsa_encryption',
          description: 'RSA public key cryptography',
          operations: {
            generate_keypair: 'Generate RSA key pair',
            encrypt: 'Encrypt message with public key',
            decrypt: 'Decrypt ciphertext with private key',
            sign: 'Sign message with private key',
            verify: 'Verify signature with public key',
            analyze_key: 'Analyze RSA key properties'
          },
          key_sizes: {
            512: 'DEMO ONLY - Easily broken',
            1024: 'DEMO ONLY - Weak',
            2048: 'Minimum recommended',
            3072: 'Recommended for new systems',
            4096: 'High security'
          },
          padding_schemes: {
            PKCS1: 'PKCS#1 v1.5 - Legacy, vulnerable to padding oracle',
            OAEP: 'Optimal Asymmetric Encryption Padding - Recommended',
            none: 'Raw RSA - NEVER use in production'
          },
          security_notes: [
            'RSA alone provides confidentiality, not authentication',
            'Always use proper padding schemes',
            'Use RSA-OAEP for encryption',
            'Use RSA-PSS or PKCS#1 v1.5 for signatures',
            'Key sizes below 2048 bits are considered weak',
            'For new systems, prefer elliptic curve cryptography (ECDSA, EdDSA)'
          ],
          example_usage: {
            generate: '{ operation: "generate_keypair", key_size: 2048 }',
            encrypt: '{ operation: "encrypt", message: "hello", public_key: {n, e}, padding: "OAEP" }'
          }
        }, null, 2)
      };
    }

    if (operation === 'generate_keypair') {
      const keySize = args.key_size || 2048;

      // For demo purposes, limit to smaller keys for performance
      const actualSize = Math.min(keySize, 1024);

      const keyPair = generateKeyPair(actualSize);

      const nHex = keyPair.publicKey.n.toString(16);
      const eHex = keyPair.publicKey.e.toString(16);
      const dHex = keyPair.privateKey.d.toString(16);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'generate_keypair',
          key_size_requested: keySize,
          key_size_generated: actualSize,
          note: keySize > 1024 ? 'Key size limited to 1024 bits for demo performance' : undefined,
          public_key: {
            n: nHex,
            e: eHex,
            n_bits: keyPair.publicKey.n.toString(2).length
          },
          private_key: {
            n: nHex,
            d: dHex,
            d_bits: keyPair.privateKey.d.toString(2).length
          },
          security_warning: actualSize < 2048
            ? 'This key is for DEMONSTRATION only. Use 2048+ bits for real security.'
            : 'Key generation complete'
        }, null, 2)
      };
    }

    if (operation === 'encrypt') {
      const message = args.message || '';
      const publicKey = args.public_key;
      const padding = args.padding || 'PKCS1';

      if (!publicKey || !publicKey.n || !publicKey.e) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Public key required',
            required: '{ n: "hex", e: "hex" }'
          }, null, 2),
          isError: true
        };
      }

      const n = BigInt('0x' + publicKey.n);
      const e = BigInt('0x' + publicKey.e);
      const keyBytes = Math.ceil(n.toString(2).length / 8);

      const messageBytes = stringToBytes(message);

      let padded: number[];
      if (padding === 'OAEP') {
        padded = oaepPad(messageBytes, keyBytes);
      } else if (padding === 'PKCS1') {
        padded = pkcs1v15Pad(messageBytes, keyBytes);
      } else {
        // No padding
        padded = messageBytes;
        while (padded.length < keyBytes) {
          padded.unshift(0);
        }
      }

      const m = bytesToBigInt(padded);
      const c = rsaEncrypt(m, e, n);
      const cipherBytes = bigIntToBytes(c, keyBytes);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'encrypt',
          padding,
          message_length: messageBytes.length,
          ciphertext: bytesToHex(cipherBytes),
          ciphertext_bits: cipherBytes.length * 8
        }, null, 2)
      };
    }

    if (operation === 'decrypt') {
      const ciphertext = args.ciphertext || '';
      const privateKey = args.private_key;
      const padding = args.padding || 'PKCS1';

      if (!privateKey || !privateKey.n || !privateKey.d) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Private key required',
            required: '{ n: "hex", d: "hex" }'
          }, null, 2),
          isError: true
        };
      }

      const n = BigInt('0x' + privateKey.n);
      const d = BigInt('0x' + privateKey.d);
      const keyBytes = Math.ceil(n.toString(2).length / 8);

      const cipherBytes = hexToBytes(ciphertext);
      const c = bytesToBigInt(cipherBytes);

      const m = rsaDecrypt(c, d, n);
      const padded = bigIntToBytes(m, keyBytes);

      let messageBytes: number[];
      if (padding === 'OAEP') {
        messageBytes = oaepUnpad(padded, keyBytes);
      } else if (padding === 'PKCS1') {
        messageBytes = pkcs1v15Unpad(padded);
      } else {
        messageBytes = padded;
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'decrypt',
          padding,
          message: bytesToString(messageBytes),
          message_hex: bytesToHex(messageBytes)
        }, null, 2)
      };
    }

    if (operation === 'sign') {
      const message = args.message || '';
      const privateKey = args.private_key;

      if (!privateKey || !privateKey.n || !privateKey.d) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Private key required for signing',
            required: '{ n: "hex", d: "hex" }'
          }, null, 2),
          isError: true
        };
      }

      const n = BigInt('0x' + privateKey.n);
      const d = BigInt('0x' + privateKey.d);
      const keyBytes = Math.ceil(n.toString(2).length / 8);

      const messageBytes = stringToBytes(message);
      const hash = sha256Simple(messageBytes);
      const padded = pkcs1v15SignPad(hash, keyBytes, 'SHA-256');

      const m = bytesToBigInt(padded);
      const s = rsaDecrypt(m, d, n); // Sign with private key
      const sigBytes = bigIntToBytes(s, keyBytes);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'sign',
          algorithm: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
          message_hash: bytesToHex(hash),
          signature: bytesToHex(sigBytes),
          signature_bits: sigBytes.length * 8
        }, null, 2)
      };
    }

    if (operation === 'verify') {
      const message = args.message || '';
      const signature = args.signature || '';
      const publicKey = args.public_key;

      if (!publicKey || !publicKey.n || !publicKey.e) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Public key required for verification',
            required: '{ n: "hex", e: "hex" }'
          }, null, 2),
          isError: true
        };
      }

      const n = BigInt('0x' + publicKey.n);
      const e = BigInt('0x' + publicKey.e);
      const keyBytes = Math.ceil(n.toString(2).length / 8);

      const sigBytes = hexToBytes(signature);
      const s = bytesToBigInt(sigBytes);
      const m = rsaEncrypt(s, e, n); // Verify with public key
      const padded = bigIntToBytes(m, keyBytes);

      const messageBytes = stringToBytes(message);
      const expectedHash = sha256Simple(messageBytes);
      const expectedPadded = pkcs1v15SignPad(expectedHash, keyBytes, 'SHA-256');

      const isValid = padded.length === expectedPadded.length &&
        padded.every((b, i) => b === expectedPadded[i]);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'verify',
          algorithm: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
          valid: isValid,
          message_hash: bytesToHex(expectedHash),
          note: isValid ? 'Signature verified successfully' : 'Signature verification failed'
        }, null, 2)
      };
    }

    if (operation === 'analyze_key') {
      const publicKey = args.public_key;
      const privateKey = args.private_key;

      let n: bigint, e: bigint, d: bigint | undefined;

      if (publicKey) {
        n = BigInt('0x' + publicKey.n);
        e = BigInt('0x' + publicKey.e);
      } else if (privateKey) {
        n = BigInt('0x' + privateKey.n);
        e = 65537n;
        d = BigInt('0x' + privateKey.d);
      } else {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Key required',
            required: 'public_key or private_key'
          }, null, 2),
          isError: true
        };
      }

      const analysis = analyzeKey(n, e, d);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze_key',
          analysis
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: 'Unknown operation',
        available: ['generate_keypair', 'encrypt', 'decrypt', 'sign', 'verify', 'analyze_key', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isrsaencryptionAvailable(): boolean {
  return true;
}
