// @ts-nocheck - Test file with extensive mocking

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockStartRegistration,
  mockStartAuthentication,
  mockBrowserSupportsWebAuthn,
  mockPlatformAuthenticatorIsAvailable,
  mockFetch,
  mockCreateBrowserClient,
} = vi.hoisted(() => ({
  mockStartRegistration: vi.fn(),
  mockStartAuthentication: vi.fn(),
  mockBrowserSupportsWebAuthn: vi.fn(),
  mockPlatformAuthenticatorIsAvailable: vi.fn(),
  mockFetch: vi.fn(),
  mockCreateBrowserClient: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: (...args: unknown[]) => mockStartRegistration(...args),
  startAuthentication: (...args: unknown[]) => mockStartAuthentication(...args),
  browserSupportsWebAuthn: () => mockBrowserSupportsWebAuthn(),
  platformAuthenticatorIsAvailable: () => mockPlatformAuthenticatorIsAvailable(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => mockCreateBrowserClient(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.stubGlobal('fetch', mockFetch);

import {
  supportsPasskeys,
  getBiometricName,
  registerPasskey,
  authenticateWithPasskey,
  getPasskeys,
  deletePasskey,
} from './webauthn-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('webauthn-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserSupportsWebAuthn.mockReturnValue(true);
    mockPlatformAuthenticatorIsAvailable.mockResolvedValue(true);
  });

  // =========================================================================
  // supportsPasskeys
  // =========================================================================

  describe('supportsPasskeys', () => {
    it('should return true when both browser and platform support', async () => {
      expect(await supportsPasskeys()).toBe(true);
    });

    it('should return false when browser does not support', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(false);
      expect(await supportsPasskeys()).toBe(false);
    });

    it('should return false when platform authenticator not available', async () => {
      mockPlatformAuthenticatorIsAvailable.mockResolvedValue(false);
      expect(await supportsPasskeys()).toBe(false);
    });
  });

  // =========================================================================
  // getBiometricName
  // =========================================================================

  describe('getBiometricName', () => {
    const originalUA = navigator.userAgent;

    it('should return Face ID for iPhone', () => {
      Object.defineProperty(navigator, 'userAgent', { value: 'iPhone', configurable: true });
      expect(getBiometricName()).toBe('Face ID');
      Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    });

    it('should return Face ID for iPad', () => {
      Object.defineProperty(navigator, 'userAgent', { value: 'iPad', configurable: true });
      expect(getBiometricName()).toBe('Face ID');
      Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    });

    it('should return Touch ID for Mac', () => {
      Object.defineProperty(navigator, 'userAgent', { value: 'Macintosh', configurable: true });
      expect(getBiometricName()).toBe('Touch ID');
      Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    });

    it('should return Fingerprint for Android', () => {
      Object.defineProperty(navigator, 'userAgent', { value: 'Android', configurable: true });
      expect(getBiometricName()).toBe('Fingerprint');
      Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    });

    it('should return Windows Hello for Windows', () => {
      Object.defineProperty(navigator, 'userAgent', { value: 'Windows NT 10', configurable: true });
      expect(getBiometricName()).toBe('Windows Hello');
      Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    });

    it('should return Biometric Login for unknown', () => {
      Object.defineProperty(navigator, 'userAgent', { value: 'Linux', configurable: true });
      expect(getBiometricName()).toBe('Biometric Login');
      Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    });
  });

  // =========================================================================
  // registerPasskey
  // =========================================================================

  describe('registerPasskey', () => {
    it('should register successfully', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ challenge: 'abc' })) // options
        .mockResolvedValueOnce(jsonResponse({ success: true })); // verify
      mockStartRegistration.mockResolvedValue({ id: 'cred-1' });

      const result = await registerPasskey();
      expect(result.success).toBe(true);
    });

    it('should fail when options request fails', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));

      const result = await registerPasskey();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should fail when verify request fails', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ challenge: 'abc' }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Invalid' }, 400));
      mockStartRegistration.mockResolvedValue({ id: 'cred-1' });

      const result = await registerPasskey();
      expect(result.success).toBe(false);
    });

    it('should handle user cancellation (NotAllowedError)', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ challenge: 'abc' }));
      const error = new Error('User cancelled');
      error.name = 'NotAllowedError';
      mockStartRegistration.mockRejectedValue(error);

      const result = await registerPasskey();
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should handle generic errors', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ challenge: 'abc' }));
      mockStartRegistration.mockRejectedValue(new Error('Something broke'));

      const result = await registerPasskey();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to register passkey');
    });

    it('should use default error when none provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

      const result = await registerPasskey();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get registration options');
    });
  });

  // =========================================================================
  // authenticateWithPasskey
  // =========================================================================

  describe('authenticateWithPasskey', () => {
    it('should authenticate successfully with session', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ challengeKey: 'ck', challenge: 'abc' }))
        .mockResolvedValueOnce(jsonResponse({ token: 'tok', user: { email: 'a@b.com' } }));
      mockStartAuthentication.mockResolvedValue({ id: 'cred-1' });
      mockCreateBrowserClient.mockReturnValue({
        auth: { verifyOtp: vi.fn().mockResolvedValue({ error: null }) },
      });

      const result = await authenticateWithPasskey('a@b.com');
      expect(result.success).toBe(true);
    });

    it('should pass email in request', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ challengeKey: 'ck' }))
        .mockResolvedValueOnce(jsonResponse({ token: 't', user: { email: 'e' } }));
      mockStartAuthentication.mockResolvedValue({});
      mockCreateBrowserClient.mockReturnValue({
        auth: { verifyOtp: vi.fn().mockResolvedValue({ error: null }) },
      });

      await authenticateWithPasskey('test@x.com');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.email).toBe('test@x.com');
    });

    it('should fail when options request fails', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Not found' }, 404));

      const result = await authenticateWithPasskey();
      expect(result.success).toBe(false);
    });

    it('should fail when verify request fails', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ challengeKey: 'ck' }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Invalid' }, 401));
      mockStartAuthentication.mockResolvedValue({});

      const result = await authenticateWithPasskey();
      expect(result.success).toBe(false);
    });

    it('should fail when OTP verification fails', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ challengeKey: 'ck' }))
        .mockResolvedValueOnce(jsonResponse({ token: 't', user: { email: 'e' } }));
      mockStartAuthentication.mockResolvedValue({});
      mockCreateBrowserClient.mockReturnValue({
        auth: { verifyOtp: vi.fn().mockResolvedValue({ error: new Error('OTP failed') }) },
      });

      const result = await authenticateWithPasskey();
      expect(result.success).toBe(false);
      expect(result.error).toContain('session');
    });

    it('should fail when response missing token', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ challengeKey: 'ck' }))
        .mockResolvedValueOnce(jsonResponse({ success: true }));
      mockStartAuthentication.mockResolvedValue({});

      const result = await authenticateWithPasskey();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response');
    });

    it('should handle user cancellation', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ challengeKey: 'ck' }));
      const error = new Error('Cancelled');
      error.name = 'NotAllowedError';
      mockStartAuthentication.mockRejectedValue(error);

      const result = await authenticateWithPasskey();
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should handle generic errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await authenticateWithPasskey();
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // getPasskeys
  // =========================================================================

  describe('getPasskeys', () => {
    it('should return passkeys list', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          data: {
            passkeys: [
              { id: '1', device_name: 'iPhone', created_at: '2026-01-01', last_used_at: null },
            ],
          },
        })
      );

      const result = await getPasskeys();
      expect(result.passkeys).toHaveLength(1);
      expect(result.passkeys[0].device_name).toBe('iPhone');
    });

    it('should handle response without data wrapper', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          passkeys: [{ id: '1', device_name: 'Mac', created_at: '2026-01-01', last_used_at: null }],
        })
      );

      const result = await getPasskeys();
      expect(result.passkeys).toHaveLength(1);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));

      const result = await getPasskeys();
      expect(result.passkeys).toEqual([]);
      expect(result.error).toBeTruthy();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network'));

      const result = await getPasskeys();
      expect(result.passkeys).toEqual([]);
      expect(result.error).toContain('Failed to fetch');
    });
  });

  // =========================================================================
  // deletePasskey
  // =========================================================================

  describe('deletePasskey', () => {
    it('should delete successfully', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ success: true }));

      const result = await deletePasskey('pk-123');
      expect(result.success).toBe(true);
    });

    it('should include id in URL', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ success: true }));

      await deletePasskey('pk-456');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id=pk-456'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should fail on error response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Not found' }, 404));

      const result = await deletePasskey('pk-123');
      expect(result.success).toBe(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network'));

      const result = await deletePasskey('pk-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to delete');
    });
  });
});
