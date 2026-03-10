import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: { user: { id: 'user-1' } } },
  error: null,
});
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-1', email: 'test@example.com' } },
  error: null,
});
const mockFromSelect = vi.fn().mockReturnThis();
const mockFromEq = vi.fn().mockReturnThis();
const mockFromSingle = vi.fn().mockResolvedValue({
  data: { id: '1', user_id: 'user-1', email: 'admin@example.com' },
  error: null,
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: mockFromSelect,
      eq: mockFromEq,
      single: mockFromSingle,
    })),
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  createServerSupabaseClient,
  getServerSession,
  getServerUser,
  isServerAuthenticated,
  isServerAdmin,
} from './server-auth';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
    error: null,
  });
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@example.com' } },
    error: null,
  });
  mockFromSelect.mockReturnThis();
  mockFromEq.mockReturnThis();
  mockFromSingle.mockResolvedValue({
    data: { id: '1', user_id: 'user-1', email: 'admin@example.com' },
    error: null,
  });
});

describe('createServerSupabaseClient', () => {
  it('should return a supabase client', async () => {
    const client = await createServerSupabaseClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});

describe('getServerSession', () => {
  it('should return session when available', async () => {
    const session = await getServerSession();
    expect(session).toBeDefined();
    expect(session?.user?.id).toBe('user-1');
  });

  it('should return null on error', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Session error'),
    });
    const session = await getServerSession();
    expect(session).toBeNull();
  });
});

describe('getServerUser', () => {
  it('should return user when available', async () => {
    const user = await getServerUser();
    expect(user).toBeDefined();
    expect(user?.id).toBe('user-1');
  });

  it('should return null on error', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('User error'),
    });
    const user = await getServerUser();
    expect(user).toBeNull();
  });
});

describe('isServerAuthenticated', () => {
  it('should return true when session exists', async () => {
    const result = await isServerAuthenticated();
    expect(result).toBe(true);
  });

  it('should return false when no session', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const result = await isServerAuthenticated();
    expect(result).toBe(false);
  });
});

describe('isServerAdmin', () => {
  it('should return true for admin users', async () => {
    const result = await isServerAdmin();
    expect(result).toBe(true);
  });

  it('should return false when no user', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const result = await isServerAdmin();
    expect(result).toBe(false);
  });

  it('should return false on database error', async () => {
    mockFromSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows' },
    });
    const result = await isServerAdmin();
    expect(result).toBe(false);
  });

  it('should return false when user_id does not match', async () => {
    mockFromSingle.mockResolvedValueOnce({
      data: { id: '1', user_id: 'different-user', email: 'admin@example.com' },
      error: null,
    });
    const result = await isServerAdmin();
    expect(result).toBe(false);
  });

  it('should return false on unexpected error', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('Unexpected'));
    const result = await isServerAdmin();
    expect(result).toBe(false);
  });
});
