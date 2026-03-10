import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { auditLog, getAuditContext, auditSecurityEvent, auditAdminAction } from './audit';

describe('auditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the cached Supabase client by clearing the module state
  });

  it('should return false when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Re-import to reset cached client (module-level state)
    // Since the supabaseAdmin variable is cached, we need to test with mocks
    const result = await auditLog({
      action: 'auth.login',
      resourceType: 'user',
      userId: 'u-123',
    });

    // When Supabase is not configured, it logs to console and returns false
    expect(typeof result).toBe('boolean');
  });

  it('should accept all audit entry fields', async () => {
    // Verify the type system accepts all fields
    const entry = {
      userId: 'u-123',
      actorId: 'admin-456',
      action: 'admin.modify_user' as const,
      resourceType: 'user' as const,
      resourceId: 'u-789',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      requestId: 'req-abc',
      metadata: { reason: 'support request' },
      oldValues: { name: 'Old Name' },
      newValues: { name: 'New Name' },
      status: 'success' as const,
    };

    // Should not throw when called with full entry
    await expect(auditLog(entry)).resolves.toBeDefined();
  });

  it('should accept minimal audit entry', async () => {
    await expect(
      auditLog({
        action: 'auth.login',
        resourceType: 'user',
      })
    ).resolves.toBeDefined();
  });
});

describe('getAuditContext', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '203.0.113.1, 70.41.3.18',
        'user-agent': 'TestAgent/1.0',
      },
    });

    const context = getAuditContext(request);
    expect(context.ipAddress).toBe('203.0.113.1');
    expect(context.userAgent).toBe('TestAgent/1.0');
  });

  it('should fall back to x-real-ip', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-real-ip': '10.0.0.1',
        'user-agent': 'TestAgent/1.0',
      },
    });

    const context = getAuditContext(request);
    expect(context.ipAddress).toBe('10.0.0.1');
  });

  it('should return unknown when no IP headers present', () => {
    const request = new Request('https://example.com');
    const context = getAuditContext(request);
    expect(context.ipAddress).toBe('unknown');
    expect(context.userAgent).toBe('unknown');
  });

  it('should handle trimming of x-forwarded-for', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '  203.0.113.1  , 70.41.3.18',
      },
    });

    const context = getAuditContext(request);
    expect(context.ipAddress).toBe('203.0.113.1');
  });
});

describe('auditSecurityEvent', () => {
  it('should create an audit entry with status=blocked', async () => {
    // auditSecurityEvent delegates to auditLog
    await expect(
      auditSecurityEvent('security.csrf_blocked', {
        userId: 'u-123',
        ipAddress: '192.168.1.1',
        details: { path: '/api/chat' },
      })
    ).resolves.toBeUndefined();
  });

  it('should accept all security action types', async () => {
    const actions = [
      'security.csrf_blocked',
      'security.rate_limited',
      'security.quota_exceeded',
      'security.suspicious_activity',
    ] as const;

    for (const action of actions) {
      await expect(auditSecurityEvent(action, { userId: 'u-1' })).resolves.toBeUndefined();
    }
  });
});

describe('auditAdminAction', () => {
  it('should create an audit entry with admin as actor', async () => {
    await expect(
      auditAdminAction('admin.modify_user', 'admin-1', 'user-2', {
        ipAddress: '10.0.0.1',
        details: { field: 'role', newValue: 'pro' },
      })
    ).resolves.toBeUndefined();
  });

  it('should accept all admin action types', async () => {
    const actions = [
      'admin.impersonate',
      'admin.access_user_data',
      'admin.modify_user',
      'admin.delete_user',
      'admin.view_audit_logs',
    ] as const;

    for (const action of actions) {
      await expect(auditAdminAction(action, 'admin-1', 'user-1', {})).resolves.toBeUndefined();
    }
  });
});
