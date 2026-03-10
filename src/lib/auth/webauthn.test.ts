import { describe, it, expect, vi } from 'vitest';

// Mock the @simplewebauthn/server module (heavy dependency)
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

import {
  getDeviceNameFromUserAgent,
  base64URLToUint8Array,
  uint8ArrayToBase64URL,
} from './webauthn';

// -------------------------------------------------------------------
// getDeviceNameFromUserAgent — pure function, no external deps
// -------------------------------------------------------------------
describe('getDeviceNameFromUserAgent', () => {
  it('should detect iPhone', () => {
    expect(getDeviceNameFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iPhone');
  });

  it('should detect iPad', () => {
    expect(getDeviceNameFromUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('iPad');
  });

  it('should detect Mac', () => {
    expect(getDeviceNameFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(
      'Mac'
    );
  });

  it('should detect Mac via "Mac OS" substring', () => {
    expect(getDeviceNameFromUserAgent('Some agent Mac OS stuff')).toBe('Mac');
  });

  it('should detect Windows PC', () => {
    expect(getDeviceNameFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'Windows PC'
    );
  });

  it('should detect Android', () => {
    expect(getDeviceNameFromUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(
      'Android Device'
    );
  });

  it('should detect Linux', () => {
    expect(getDeviceNameFromUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux Device');
  });

  it('should return Unknown Device for unrecognized UA', () => {
    expect(getDeviceNameFromUserAgent('curl/7.88.1')).toBe('Unknown Device');
  });

  it('should return Unknown Device for empty string', () => {
    expect(getDeviceNameFromUserAgent('')).toBe('Unknown Device');
  });
});

// -------------------------------------------------------------------
// base64URLToUint8Array / uint8ArrayToBase64URL — roundtrip
// -------------------------------------------------------------------
describe('base64URLToUint8Array', () => {
  it('should convert base64url to Uint8Array', () => {
    // "Hello" in base64url is "SGVsbG8"
    const bytes = base64URLToUint8Array('SGVsbG8');
    expect(String.fromCharCode(...bytes)).toBe('Hello');
  });

  it('should handle base64url with - and _ characters', () => {
    // These chars differ from standard base64 (+ and /)
    const input = 'ab-cd_ef'; // base64url variant
    const bytes = base64URLToUint8Array(input);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('should handle padding correctly', () => {
    // "A" in base64url is "QQ" (needs == padding)
    const bytes = base64URLToUint8Array('QQ');
    expect(bytes[0]).toBe(65); // ASCII 'A'
  });

  it('should handle empty string', () => {
    const bytes = base64URLToUint8Array('');
    expect(bytes.length).toBe(0);
  });
});

describe('uint8ArrayToBase64URL', () => {
  it('should convert Uint8Array to base64url', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(uint8ArrayToBase64URL(bytes)).toBe('SGVsbG8');
  });

  it('should produce base64url (no + / =)', () => {
    // Use bytes that would produce + / = in standard base64
    const bytes = new Uint8Array([255, 254, 253]);
    const result = uint8ArrayToBase64URL(bytes);
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
    expect(result).not.toContain('=');
  });

  it('should handle empty array', () => {
    expect(uint8ArrayToBase64URL(new Uint8Array([]))).toBe('');
  });
});

describe('base64URL roundtrip', () => {
  it('should survive encode → decode → encode', () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const encoded = uint8ArrayToBase64URL(original);
    const decoded = base64URLToUint8Array(encoded);
    const reEncoded = uint8ArrayToBase64URL(decoded);
    expect(reEncoded).toBe(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});
