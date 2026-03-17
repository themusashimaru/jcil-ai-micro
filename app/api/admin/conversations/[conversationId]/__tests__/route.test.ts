import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock requireAdmin and checkPermission
const mockAdminUser = { id: 'admin-123', email: 'admin@example.com' };
const mockAdminRecord = {
  id: 'admin-row-1',
  permissions: {
    can_view_users: true,
    can_edit_users: true,
    can_view_conversations: true,
    can_export_data: true,
    can_manage_subscriptions: true,
    can_ban_users: true,
  },
};
const mockRequireAdmin = vi.fn();
const mockCheckPermission = vi.fn();
vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

// Mock rate limiting
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  };
});

// Mock Supabase createClient
const _mockSelect = vi.fn();
const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

// Import after mocks
const { GET } = await import('../route');

const mockParams = { params: { conversationId: 'conv-uuid-123' } };

describe('GET /api/admin/conversations/[conversationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: mockAdminUser,
      adminUser: mockAdminRecord,
    });
    mockCheckPermission.mockReturnValue({ allowed: true });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Set env vars for getSupabaseAdmin
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('returns 401 when not authenticated as admin', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const request = new Request('http://localhost/api/admin/conversations/conv-uuid-123');
    const response = await GET(request as any, mockParams as any);
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing can_view_conversations permission', async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({ ok: false, error: 'Insufficient permissions' }),
      { status: 403 }
    );
    mockCheckPermission.mockReturnValue({
      allowed: false,
      response: forbiddenResponse,
    });

    const request = new Request('http://localhost/api/admin/conversations/conv-uuid-123');
    const response = await GET(request as any, mockParams as any);
    expect(response.status).toBe(403);
  });

  it('returns 404 when conversation not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Row not found' },
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/admin/conversations/conv-uuid-123');
    const response = await GET(request as any, mockParams as any);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it('returns conversation with messages successfully', async () => {
    const mockConversation = {
      id: 'conv-uuid-123',
      title: 'Test Conversation',
      tool_context: 'general',
      created_at: '2026-01-01T00:00:00Z',
      last_message_at: '2026-01-01T01:00:00Z',
      message_count: 2,
      user_id: 'user-456',
      users: { id: 'user-456', email: 'user@example.com', full_name: 'Test User' },
    };
    const mockMessages = [
      { id: 'msg-1', role: 'user', content: 'Hello' },
      { id: 'msg-2', role: 'assistant', content: 'Hi there' },
    ];

    // First call: conversations query
    const _callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockConversation,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockMessages,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const request = new Request('http://localhost/api/admin/conversations/conv-uuid-123');
    const response = await GET(request as any, mockParams as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.conversation.id).toBe('conv-uuid-123');
    expect(json.conversation.title).toBe('Test Conversation');
    expect(json.conversation.user).toEqual(mockConversation.users);
    expect(json.messages).toHaveLength(2);
    expect(json.timestamp).toBeDefined();
  });

  it('handles database error when fetching messages', async () => {
    const mockConversation = {
      id: 'conv-uuid-123',
      title: 'Test Conversation',
      tool_context: 'general',
      created_at: '2026-01-01T00:00:00Z',
      last_message_at: '2026-01-01T01:00:00Z',
      message_count: 0,
      user_id: 'user-456',
      users: { id: 'user-456', email: 'user@example.com', full_name: 'Test User' },
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockConversation,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST500', message: 'Database error' },
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const request = new Request('http://localhost/api/admin/conversations/conv-uuid-123');
    const response = await GET(request as any, mockParams as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.ok).toBe(false);
  });
});
