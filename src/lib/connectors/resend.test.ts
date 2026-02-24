import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  type ResendConnector,
  type ResendEmailOptions,
  type ResendAttachment,
  type ResendEmailResult,
  type ResendDomain,
  type ResendApiKey,
  isResendConfigured,
  sendEmail,
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  getDomains,
  getApiKeyInfo,
  getResendConnectionStatus,
} from './resend';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('Resend type exports', () => {
  it('should export ResendConnector interface', () => {
    const c: ResendConnector = {
      type: 'resend',
      status: 'connected',
      displayName: 'Resend',
      icon: '📧',
      description: 'Email service',
      metadata: { email: 'test@example.com', verified: true },
    };
    expect(c.type).toBe('resend');
  });

  it('should export ResendEmailOptions interface', () => {
    const opts: ResendEmailOptions = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
      replyTo: 'reply@example.com',
      cc: 'cc@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com'],
      attachments: [{ filename: 'file.txt', content: 'base64data' }],
      tags: [{ name: 'type', value: 'test' }],
    };
    expect(opts.from).toBe('sender@example.com');
  });

  it('should export ResendAttachment interface', () => {
    const a: ResendAttachment = {
      filename: 'doc.pdf',
      content: 'base64content',
      path: 'https://example.com/doc.pdf',
    };
    expect(a.filename).toBe('doc.pdf');
  });

  it('should export ResendEmailResult interface', () => {
    const r: ResendEmailResult = { success: true, id: 'email-123' };
    expect(r.success).toBe(true);
  });

  it('should export ResendDomain interface', () => {
    const d: ResendDomain = {
      id: 'd-1',
      name: 'example.com',
      status: 'verified',
      createdAt: '2024-01-01',
      region: 'us-east-1',
    };
    expect(d.status).toBe('verified');
  });

  it('should export ResendApiKey interface', () => {
    const k: ResendApiKey = {
      id: 'k-1',
      name: 'Production',
      createdAt: '2024-01-01',
      permission: 'full_access',
    };
    expect(k.permission).toBe('full_access');
  });
});

// ============================================================================
// CONFIGURATION
// ============================================================================

describe('isResendConfigured', () => {
  const originalEnv = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalEnv) {
      process.env.RESEND_API_KEY = originalEnv;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });

  it('should return true when API key is set', () => {
    process.env.RESEND_API_KEY = 'test-key';
    expect(isResendConfigured()).toBe(true);
  });

  it('should return false when API key is not set', () => {
    delete process.env.RESEND_API_KEY;
    expect(isResendConfigured()).toBe(false);
  });
});

// ============================================================================
// API FUNCTIONS
// ============================================================================

describe('sendEmail', () => {
  const originalEnv = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv) {
      process.env.RESEND_API_KEY = originalEnv;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });

  it('should return error when API key is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('API key not configured');
  });

  it('should call fetch with correct parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const opts: ResendEmailOptions = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Email',
      html: '<p>Hello</p>',
    };

    const result = await sendEmail(opts);
    expect(result.success).toBe(true);
    expect(result.id).toBe('email-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    );
  });

  it('should handle API error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid email' }),
      })
    );

    const result = await sendEmail({
      from: 'test@example.com',
      to: 'invalid',
      subject: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email');
  });

  it('should handle API error without message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );

    const result = await sendEmail({
      from: 'test@example.com',
      to: 'r@example.com',
      subject: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('should handle network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await sendEmail({
      from: 'test@example.com',
      to: 'r@example.com',
      subject: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should handle non-Error throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

    const result = await sendEmail({
      from: 'test@example.com',
      to: 'r@example.com',
      subject: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to send email');
  });
});

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

describe('sendMagicLinkEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'ml-1' }),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send magic link email', async () => {
    const result = await sendMagicLinkEmail('user@example.com', 'https://example.com/magic');
    expect(result.success).toBe(true);
  });

  it('should include magic link in email body', async () => {
    await sendMagicLinkEmail('user@example.com', 'https://example.com/magic');
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.html).toContain('https://example.com/magic');
    expect(body.text).toContain('https://example.com/magic');
  });

  it('should use custom business name', async () => {
    await sendMagicLinkEmail('user@example.com', 'https://link', 'MyApp');
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.subject).toContain('MyApp');
    expect(body.html).toContain('MyApp');
  });

  it('should include magic-link tag', async () => {
    await sendMagicLinkEmail('user@example.com', 'https://link');
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.tags).toEqual([{ name: 'type', value: 'magic-link' }]);
  });
});

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'pr-1' }),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send password reset email', async () => {
    const result = await sendPasswordResetEmail('user@example.com', 'https://reset');
    expect(result.success).toBe(true);
  });

  it('should include reset link', async () => {
    await sendPasswordResetEmail('user@example.com', 'https://reset-link');
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.html).toContain('https://reset-link');
    expect(body.text).toContain('https://reset-link');
  });

  it('should include password-reset tag', async () => {
    await sendPasswordResetEmail('user@example.com', 'https://link');
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.tags).toEqual([{ name: 'type', value: 'password-reset' }]);
  });
});

describe('sendWelcomeEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'w-1' }),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send welcome email', async () => {
    const result = await sendWelcomeEmail('user@example.com', 'John');
    expect(result.success).toBe(true);
  });

  it('should include user name', async () => {
    await sendWelcomeEmail('user@example.com', 'Jane');
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.html).toContain('Jane');
    expect(body.text).toContain('Jane');
  });

  it('should include welcome tag', async () => {
    await sendWelcomeEmail('user@example.com', 'John');
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.tags).toEqual([{ name: 'type', value: 'welcome' }]);
  });
});

// ============================================================================
// DOMAIN & API KEY
// ============================================================================

describe('getDomains', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when no API key', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await getDomains();
    expect(result).toEqual([]);
  });

  it('should return domains on success', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'd1',
                name: 'example.com',
                status: 'verified',
                createdAt: '2024-01-01',
                region: 'us-east-1',
              },
            ],
          }),
      })
    );
    const result = await getDomains();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('example.com');
  });

  it('should return empty array on error', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const result = await getDomains();
    expect(result).toEqual([]);
  });

  it('should return empty array on non-ok response', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await getDomains();
    expect(result).toEqual([]);
  });
});

describe('getApiKeyInfo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return error when no API key', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await getApiKeyInfo();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No API key');
  });

  it('should return success on valid key', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    );
    const result = await getApiKeyInfo();
    expect(result.success).toBe(true);
  });

  it('should return error on non-ok response', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const result = await getApiKeyInfo();
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('should handle network error', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
    const result = await getApiKeyInfo();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});

// ============================================================================
// CONNECTION STATUS
// ============================================================================

describe('getResendConnectionStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return disconnected when not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const status = await getResendConnectionStatus();
    expect(status.status).toBe('disconnected');
    expect(status.type).toBe('resend');
    expect(status.displayName).toBe('Resend');
  });

  it('should return error when key verification fails', async () => {
    process.env.RESEND_API_KEY = 'bad-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const status = await getResendConnectionStatus();
    expect(status.status).toBe('error');
  });

  it('should return connected with verified domain', async () => {
    process.env.RESEND_API_KEY = 'good-key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'd1',
                  name: 'example.com',
                  status: 'verified',
                  createdAt: '2024',
                  region: 'us',
                },
              ],
            }),
        })
    );
    const status = await getResendConnectionStatus();
    expect(status.status).toBe('connected');
    expect(status.metadata?.domain).toBe('example.com');
    expect(status.metadata?.verified).toBe(true);
  });

  it('should return connected without verified domain', async () => {
    process.env.RESEND_API_KEY = 'good-key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'd1',
                  name: 'example.com',
                  status: 'pending',
                  createdAt: '2024',
                  region: 'us',
                },
              ],
            }),
        })
    );
    const status = await getResendConnectionStatus();
    expect(status.status).toBe('connected');
    expect(status.metadata?.verified).toBe(false);
  });
});
