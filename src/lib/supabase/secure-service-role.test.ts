import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => {
  const single = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });
  const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), single });
  eq.mockReturnValue({ eq, single });
  const sel = vi.fn().mockReturnValue({ eq, single, count: 10 });
  const ins = vi.fn().mockReturnValue({ select: sel, eq, single });
  const upd = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select: sel, insert: ins, update: upd, eq, single });
  return {
    createClient: vi.fn().mockReturnValue({ from }),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  auditLog: {
    log: vi.fn(),
  },
}));

import {
  type AuthenticatedUserContext,
  type RequestContext,
  type SecureOperation,
  SecurityError,
  SecureServiceRoleClient,
  createSecureServiceClient,
  extractRequestContext,
} from './secure-service-role';

describe('Type exports', () => {
  it('should export AuthenticatedUserContext', () => {
    const ctx: AuthenticatedUserContext = {
      id: 'user-1234567890',
      email: 'test@example.com',
      isAdmin: false,
    };
    expect(ctx.id).toBe('user-1234567890');
  });

  it('should export RequestContext', () => {
    const ctx: RequestContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test/1.0',
      endpoint: '/api/test',
      method: 'GET',
    };
    expect(ctx.endpoint).toBe('/api/test');
  });

  it('should export SecureOperation type', () => {
    const ops: SecureOperation[] = [
      'user.read',
      'user.update',
      'user.github_token',
      'session.read',
      'session.update',
      'message.create',
      'admin.user_read',
      'admin.user_update',
      'admin.stats',
    ];
    expect(ops).toHaveLength(9);
  });
});

describe('SecurityError', () => {
  it('should be an instance of Error', () => {
    const err = new SecurityError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have name SecurityError', () => {
    const err = new SecurityError('test');
    expect(err.name).toBe('SecurityError');
  });

  it('should preserve the message', () => {
    const err = new SecurityError('Access denied');
    expect(err.message).toBe('Access denied');
  });
});

describe('SecureServiceRoleClient', () => {
  const validUser: AuthenticatedUserContext = {
    id: 'user-1234567890',
    email: 'test@example.com',
    isAdmin: false,
  };

  const adminUser: AuthenticatedUserContext = {
    id: 'admin-1234567890',
    email: 'admin@example.com',
    isAdmin: true,
  };

  const requestCtx: RequestContext = {
    ipAddress: '127.0.0.1',
    endpoint: '/api/test',
  };

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      },
    });
  });

  describe('constructor validation', () => {
    it('should throw for null user context', () => {
      expect(() => new SecureServiceRoleClient(null as never, requestCtx)).toThrow(SecurityError);
    });

    it('should throw for empty user ID', () => {
      expect(
        () => new SecureServiceRoleClient({ id: '', email: 'test@example.com' }, requestCtx)
      ).toThrow(SecurityError);
    });

    it('should throw for short user ID', () => {
      expect(
        () => new SecureServiceRoleClient({ id: 'abc', email: 'test@example.com' }, requestCtx)
      ).toThrow(SecurityError);
    });

    it('should throw if Supabase URL is missing', () => {
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: 'key' },
      });
      expect(() => new SecureServiceRoleClient(validUser, requestCtx)).toThrow(
        'Supabase configuration is missing'
      );
    });

    it('should throw if service role key is missing', () => {
      vi.stubGlobal('process', {
        ...process,
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: '',
        },
      });
      expect(() => new SecureServiceRoleClient(validUser, requestCtx)).toThrow(
        'Supabase configuration is missing'
      );
    });

    it('should succeed with valid user and config', () => {
      expect(() => new SecureServiceRoleClient(validUser, requestCtx)).not.toThrow();
    });
  });

  describe('getUserData', () => {
    it('should allow user to get their own data', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      const result = await client.getUserData(validUser.id);
      expect(result).toBeDefined();
    });

    it('should deny non-admin accessing other user data', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(client.getUserData('other-user-12345')).rejects.toThrow(SecurityError);
    });

    it('should allow admin to access any user data', async () => {
      const client = new SecureServiceRoleClient(adminUser, requestCtx);
      const result = await client.getUserData('other-user-12345');
      expect(result).toBeDefined();
    });
  });

  describe('getUserGitHubToken', () => {
    it('should deny non-admin accessing other user token', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(client.getUserGitHubToken('other-user-12345')).rejects.toThrow(SecurityError);
    });
  });

  describe('updateUserData', () => {
    it('should block non-admin from updating protected fields', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(
        client.updateUserData(validUser.id, { subscription_tier: 'executive' })
      ).rejects.toThrow(SecurityError);
    });

    it('should block non-admin from updating email', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(
        client.updateUserData(validUser.id, { email: 'new@example.com' })
      ).rejects.toThrow('Cannot update protected fields');
    });

    it('should deny non-admin from updating other user', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(
        client.updateUserData('other-user-12345', { full_name: 'Test' })
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('admin operations', () => {
    it('should deny non-admin from adminGetUser', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(client.adminGetUser('other-user-12345')).rejects.toThrow(SecurityError);
    });

    it('should allow admin to get any user', async () => {
      const client = new SecureServiceRoleClient(adminUser, requestCtx);
      const result = await client.adminGetUser('other-user-12345');
      expect(result).toBeDefined();
    });

    it('should deny non-admin from adminUpdateUser', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(client.adminUpdateUser('other-user-12345', { is_banned: true })).rejects.toThrow(
        SecurityError
      );
    });

    it('should deny non-admin from adminGetStats', async () => {
      const client = new SecureServiceRoleClient(validUser, requestCtx);
      await expect(client.adminGetStats()).rejects.toThrow(SecurityError);
    });
  });
});

describe('createSecureServiceClient', () => {
  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      },
    });
  });

  it('should return a SecureServiceRoleClient instance', () => {
    const client = createSecureServiceClient({
      id: 'user-1234567890',
      email: 'test@example.com',
    });
    expect(client).toBeInstanceOf(SecureServiceRoleClient);
  });

  it('should accept request context', () => {
    const client = createSecureServiceClient(
      { id: 'user-1234567890', email: 'test@example.com' },
      { endpoint: '/api/chat', ipAddress: '10.0.0.1' }
    );
    expect(client).toBeInstanceOf(SecureServiceRoleClient);
  });
});

describe('extractRequestContext', () => {
  it('should extract IP from x-forwarded-for', () => {
    const req = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'user-agent': 'TestAgent/1.0',
      },
    });
    const ctx = extractRequestContext(req, '/api/test');
    expect(ctx.ipAddress).toBe('1.2.3.4');
    expect(ctx.userAgent).toBe('TestAgent/1.0');
    expect(ctx.endpoint).toBe('/api/test');
  });

  it('should extract IP from x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    const ctx = extractRequestContext(req, '/api/chat');
    expect(ctx.ipAddress).toBe('10.0.0.1');
  });

  it('should default IP to unknown', () => {
    const req = new Request('https://example.com');
    const ctx = extractRequestContext(req, '/api/data');
    expect(ctx.ipAddress).toBe('unknown');
  });

  it('should extract request method', () => {
    const req = new Request('https://example.com', { method: 'POST' });
    const ctx = extractRequestContext(req, '/api/submit');
    expect(ctx.method).toBe('POST');
  });

  it('should default user-agent to unknown', () => {
    const req = new Request('https://example.com');
    const ctx = extractRequestContext(req, '/api/test');
    expect(ctx.userAgent).toBe('unknown');
  });
});
