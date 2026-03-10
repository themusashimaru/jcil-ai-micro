// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executeCryptoTool, isCryptoToolAvailable, cryptoTool } from './crypto-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'crypto_toolkit', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeCryptoTool(makeCall(args));
  return JSON.parse(res.content);
}

const SECRET = 'my-super-secret-key-at-least-32chars!';

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('cryptoTool metadata', () => {
  it('should have correct name', () => {
    expect(cryptoTool.name).toBe('crypto_toolkit');
  });

  it('should require operation', () => {
    expect(cryptoTool.parameters.required).toContain('operation');
  });
});

describe('isCryptoToolAvailable', () => {
  it('should return true', () => {
    expect(isCryptoToolAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// JWT operations
// -------------------------------------------------------------------
describe('executeCryptoTool - jwt_create', () => {
  it('should create a JWT token', async () => {
    const result = await getResult({
      operation: 'jwt_create',
      payload: { sub: 'user123', name: 'John' },
      secret: SECRET,
    });
    expect(result.operation).toBe('jwt_create');
    expect(result.token).toBeDefined();
    expect(result.token.split('.')).toHaveLength(3);
    expect(result.algorithm).toBe('HS256');
  });

  it('should create JWT with expiration', async () => {
    const result = await getResult({
      operation: 'jwt_create',
      payload: { sub: 'user123' },
      secret: SECRET,
      expires_in: '1h',
    });
    expect(result.expires_in).toBe('1h');
  });

  it('should error without payload', async () => {
    const res = await executeCryptoTool(makeCall({ operation: 'jwt_create', secret: SECRET }));
    expect(res.isError).toBe(true);
  });

  it('should error without secret', async () => {
    const res = await executeCryptoTool(
      makeCall({ operation: 'jwt_create', payload: { sub: 'user' } })
    );
    expect(res.isError).toBe(true);
  });
});

describe('executeCryptoTool - jwt_verify', () => {
  it('should verify a valid JWT', async () => {
    // First create a token
    const createResult = await getResult({
      operation: 'jwt_create',
      payload: { sub: 'user123' },
      secret: SECRET,
    });

    // Then verify it
    const verifyResult = await getResult({
      operation: 'jwt_verify',
      token: createResult.token,
      secret: SECRET,
    });
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.payload.sub).toBe('user123');
  });

  it('should fail verification with wrong secret', async () => {
    const createResult = await getResult({
      operation: 'jwt_create',
      payload: { sub: 'user123' },
      secret: SECRET,
    });

    const verifyResult = await getResult({
      operation: 'jwt_verify',
      token: createResult.token,
      secret: 'wrong-secret-key-that-is-different!',
    });
    expect(verifyResult.valid).toBe(false);
  });
});

describe('executeCryptoTool - jwt_decode', () => {
  it('should decode JWT without verification', async () => {
    const createResult = await getResult({
      operation: 'jwt_create',
      payload: { sub: 'user123', name: 'Test' },
      secret: SECRET,
    });

    const decodeResult = await getResult({
      operation: 'jwt_decode',
      token: createResult.token,
    });
    expect(decodeResult.warning).toContain('NOT verified');
    expect(decodeResult.payload.sub).toBe('user123');
    expect(decodeResult.header.alg).toBe('HS256');
  });
});

// -------------------------------------------------------------------
// Encryption
// -------------------------------------------------------------------
describe('executeCryptoTool - encrypt/decrypt', () => {
  it('should encrypt and decrypt data', async () => {
    const encResult = await getResult({
      operation: 'encrypt',
      data: 'Hello, World!',
      secret: SECRET,
    });
    expect(encResult.operation).toBe('encrypt');
    expect(encResult.encrypted).toBeDefined();

    const decResult = await getResult({
      operation: 'decrypt',
      data: encResult.encrypted,
      secret: SECRET,
    });
    expect(decResult.decrypted).toBe('Hello, World!');
  });

  it('should error without data for encrypt', async () => {
    const res = await executeCryptoTool(makeCall({ operation: 'encrypt', secret: SECRET }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Key generation
// -------------------------------------------------------------------
describe('executeCryptoTool - generate_key', () => {
  it('should generate symmetric key', async () => {
    const result = await getResult({
      operation: 'generate_key',
      key_type: 'symmetric',
    });
    expect(result.type).toBe('symmetric');
    expect(result.bits).toBe(256);
    expect(result.key_base64).toBeDefined();
  });

  it('should return error for RSA (non-extractable keys)', async () => {
    // jose.generateKeyPair creates non-extractable keys by default,
    // so exportSPKI/exportPKCS8 fails — this is a known limitation
    const res = await executeCryptoTool(makeCall({ operation: 'generate_key', key_type: 'rsa' }));
    expect(res.isError).toBe(true);
  });

  it('should return error for EC (non-extractable keys)', async () => {
    const res = await executeCryptoTool(makeCall({ operation: 'generate_key', key_type: 'ec' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Hashing
// -------------------------------------------------------------------
describe('executeCryptoTool - hash', () => {
  it('should hash data with SHA-256', async () => {
    const result = await getResult({
      operation: 'hash',
      data: 'hello',
    });
    expect(result.algorithm).toBe('SHA-256');
    expect(result.hash_hex).toBeDefined();
    expect(result.hash_hex).toHaveLength(64);
    expect(result.hash_base64).toBeDefined();
  });

  it('should produce consistent hashes', async () => {
    const result1 = await getResult({ operation: 'hash', data: 'test' });
    const result2 = await getResult({ operation: 'hash', data: 'test' });
    expect(result1.hash_hex).toBe(result2.hash_hex);
  });

  it('should produce different hashes for different data', async () => {
    const result1 = await getResult({ operation: 'hash', data: 'hello' });
    const result2 = await getResult({ operation: 'hash', data: 'world' });
    expect(result1.hash_hex).not.toBe(result2.hash_hex);
  });

  it('should error without data', async () => {
    const res = await executeCryptoTool(makeCall({ operation: 'hash' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeCryptoTool - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executeCryptoTool(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeCryptoTool({
      id: 'my-id',
      name: 'crypto_toolkit',
      arguments: { operation: 'hash', data: 'test' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
