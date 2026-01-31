/**
 * CRYPTOGRAPHY TOOL
 *
 * JWT, encryption, signing, and key operations using jose.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - JWT creation and verification
 * - Encryption (JWE)
 * - Digital signatures (JWS)
 * - Key generation
 * - Hashing
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded jose
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jose: any = null;

async function initJose(): Promise<boolean> {
  if (jose) return true;
  try {
    jose = await import('jose');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const cryptoTool: UnifiedTool = {
  name: 'crypto_toolkit',
  description: `Cryptographic operations: JWT, encryption, signing, hashing.

Operations:
- jwt_create: Create a signed JWT token
- jwt_verify: Verify and decode a JWT
- jwt_decode: Decode JWT without verification (unsafe inspection)
- encrypt: Encrypt data with JWE
- decrypt: Decrypt JWE encrypted data
- generate_key: Generate cryptographic keys
- hash: Hash data with SHA-256/384/512

Use cases:
- Create authentication tokens
- Verify API tokens
- Encrypt sensitive data
- Generate secure keys
- Hash passwords/data

All operations run locally - keys and data stay private.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'jwt_create',
          'jwt_verify',
          'jwt_decode',
          'encrypt',
          'decrypt',
          'generate_key',
          'hash',
        ],
        description: 'Cryptographic operation to perform',
      },
      payload: {
        type: 'object',
        description: 'For jwt_create: JWT payload data (claims)',
      },
      token: {
        type: 'string',
        description: 'For jwt_verify/jwt_decode: JWT token string',
      },
      secret: {
        type: 'string',
        description: 'Secret key for symmetric operations (HS256, etc.)',
      },
      algorithm: {
        type: 'string',
        enum: ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
        description: 'Algorithm for JWT/signing (default: HS256)',
      },
      expires_in: {
        type: 'string',
        description: 'For jwt_create: Token expiration (e.g., "1h", "7d", "30m")',
      },
      issuer: {
        type: 'string',
        description: 'For jwt_create: Token issuer (iss claim)',
      },
      audience: {
        type: 'string',
        description: 'For jwt_create: Token audience (aud claim)',
      },
      data: {
        type: 'string',
        description: 'For encrypt/hash: Data to encrypt or hash',
      },
      key_type: {
        type: 'string',
        enum: ['symmetric', 'rsa', 'ec'],
        description: 'For generate_key: Type of key to generate',
      },
      hash_algorithm: {
        type: 'string',
        enum: ['SHA-256', 'SHA-384', 'SHA-512'],
        description: 'For hash: Hash algorithm (default: SHA-256)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCryptoToolAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeCryptoTool(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    payload?: Record<string, unknown>;
    token?: string;
    secret?: string;
    algorithm?: string;
    expires_in?: string;
    issuer?: string;
    audience?: string;
    data?: string;
    key_type?: string;
    hash_algorithm?: string;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initJose();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize jose' }),
        isError: true,
      };
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'jwt_create': {
        if (!args.payload || !args.secret) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Payload and secret required for jwt_create' }),
            isError: true,
          };
        }

        const alg = args.algorithm || 'HS256';
        const secretKey = new TextEncoder().encode(args.secret);

        let jwtBuilder = new jose.SignJWT(args.payload).setProtectedHeader({ alg }).setIssuedAt();

        if (args.expires_in) {
          jwtBuilder = jwtBuilder.setExpirationTime(args.expires_in);
        }
        if (args.issuer) {
          jwtBuilder = jwtBuilder.setIssuer(args.issuer);
        }
        if (args.audience) {
          jwtBuilder = jwtBuilder.setAudience(args.audience);
        }

        const jwt = await jwtBuilder.sign(secretKey);

        result = {
          operation: 'jwt_create',
          algorithm: alg,
          token: jwt,
          expires_in: args.expires_in || 'never',
        };
        break;
      }

      case 'jwt_verify': {
        if (!args.token || !args.secret) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Token and secret required for jwt_verify' }),
            isError: true,
          };
        }

        const secretKey = new TextEncoder().encode(args.secret);

        try {
          const { payload, protectedHeader } = await jose.jwtVerify(args.token, secretKey);

          result = {
            operation: 'jwt_verify',
            valid: true,
            header: protectedHeader,
            payload,
          };
        } catch (verifyError) {
          result = {
            operation: 'jwt_verify',
            valid: false,
            error: verifyError instanceof Error ? verifyError.message : 'Verification failed',
          };
        }
        break;
      }

      case 'jwt_decode': {
        if (!args.token) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Token required for jwt_decode' }),
            isError: true,
          };
        }

        const decoded = jose.decodeJwt(args.token);
        const header = jose.decodeProtectedHeader(args.token);

        result = {
          operation: 'jwt_decode',
          warning: 'Token signature NOT verified - do not trust this data',
          header,
          payload: decoded,
        };
        break;
      }

      case 'encrypt': {
        if (!args.data || !args.secret) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Data and secret required for encrypt' }),
            isError: true,
          };
        }

        // Use direct encryption with A256GCM
        const secretKey = new TextEncoder().encode(args.secret.padEnd(32, '0').slice(0, 32));

        const jwe = await new jose.CompactEncrypt(new TextEncoder().encode(args.data))
          .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
          .encrypt(secretKey);

        result = {
          operation: 'encrypt',
          algorithm: 'A256GCM',
          encrypted: jwe,
        };
        break;
      }

      case 'decrypt': {
        if (!args.data || !args.secret) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Encrypted data and secret required for decrypt' }),
            isError: true,
          };
        }

        const secretKey = new TextEncoder().encode(args.secret.padEnd(32, '0').slice(0, 32));

        const { plaintext } = await jose.compactDecrypt(args.data, secretKey);
        const decrypted = new TextDecoder().decode(plaintext);

        result = {
          operation: 'decrypt',
          decrypted,
        };
        break;
      }

      case 'generate_key': {
        const keyType = args.key_type || 'symmetric';

        if (keyType === 'symmetric') {
          const key = crypto.getRandomValues(new Uint8Array(32));
          const keyBase64 = Buffer.from(key).toString('base64');

          result = {
            operation: 'generate_key',
            type: 'symmetric',
            bits: 256,
            key_base64: keyBase64,
          };
        } else if (keyType === 'rsa') {
          const { publicKey, privateKey } = await jose.generateKeyPair('RS256');

          result = {
            operation: 'generate_key',
            type: 'rsa',
            algorithm: 'RS256',
            public_key: await jose.exportSPKI(publicKey),
            private_key: await jose.exportPKCS8(privateKey),
          };
        } else if (keyType === 'ec') {
          const { publicKey, privateKey } = await jose.generateKeyPair('ES256');

          result = {
            operation: 'generate_key',
            type: 'ec',
            algorithm: 'ES256',
            curve: 'P-256',
            public_key: await jose.exportSPKI(publicKey),
            private_key: await jose.exportPKCS8(privateKey),
          };
        } else {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Unknown key type: ${keyType}` }),
            isError: true,
          };
        }
        break;
      }

      case 'hash': {
        if (!args.data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Data required for hash' }),
            isError: true,
          };
        }

        const algorithm = args.hash_algorithm || 'SHA-256';
        const data = new TextEncoder().encode(args.data);
        const hashBuffer = await crypto.subtle.digest(algorithm, data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        result = {
          operation: 'hash',
          algorithm,
          input_length: args.data.length,
          hash_hex: hashHex,
          hash_base64: Buffer.from(hashBuffer).toString('base64'),
        };
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Crypto operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
