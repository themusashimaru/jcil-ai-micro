import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Supabase
const mockGetUser = vi.fn();
const mockSelectSingle = vi.fn();
const mockUpdate = vi.fn();
const mockEqChain = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: () => mockGetUser(),
      },
    }),
}));

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: () => mockSelectSingle(),
        }),
      }),
    }),
    update: (data: unknown) => {
      mockUpdate(data);
      return {
        eq: () => mockEqChain(),
      };
    },
  }),
}));

// Mock CSRF
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: () => ({ valid: true }),
}));

// Mock rate limiter
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabEdit: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

const { GET, POST } = await import('./route');

describe('GET /api/code-lab/memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new NextRequest('http://localhost/api/code-lab/memory?sessionId=s1');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 400 when sessionId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    const req = new NextRequest('http://localhost/api/code-lab/memory');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('sessionId required');
  });

  it('returns 404 when session not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockSelectSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const req = new NextRequest('http://localhost/api/code-lab/memory?sessionId=s1');
    const res = await GET(req);

    expect(res.status).toBe(404);
  });

  it('returns memory content when session exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockSelectSingle.mockResolvedValue({
      data: {
        id: 's1',
        settings: { memory_content: '# Project Notes\nThis is a test.' },
        updated_at: '2026-02-27T00:00:00Z',
      },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/code-lab/memory?sessionId=s1');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.content).toBe('# Project Notes\nThis is a test.');
    expect(data.exists).toBe(true);
    expect(data.path).toBe('/workspace/CLAUDE.md');
  });

  it('returns empty content when no memory set', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockSelectSingle.mockResolvedValue({
      data: { id: 's1', settings: {}, updated_at: '2026-02-27T00:00:00Z' },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/code-lab/memory?sessionId=s1');
    const res = await GET(req);
    const data = await res.json();

    expect(data.content).toBe('');
    expect(data.exists).toBe(false);
  });
});

describe('POST /api/code-lab/memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEqChain.mockResolvedValue({ error: null });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new NextRequest('http://localhost/api/code-lab/memory', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', content: 'test' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 400 when sessionId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    const req = new NextRequest('http://localhost/api/code-lab/memory', {
      method: 'POST',
      body: JSON.stringify({ content: 'test' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockSelectSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const req = new NextRequest('http://localhost/api/code-lab/memory', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', content: 'test' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it('saves memory content successfully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockSelectSingle.mockResolvedValue({
      data: { id: 's1', settings: {} },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/code-lab/memory', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', content: '# New memory content' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.path).toBe('/workspace/CLAUDE.md');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ memory_content: '# New memory content' }),
      })
    );
  });
});
