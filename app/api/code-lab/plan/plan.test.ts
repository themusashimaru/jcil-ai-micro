import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger (not used directly but needed by some imports)
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
vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: () => mockGetUser(),
      },
    }),
}));

// Mock CSRF
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock rate limiter
const mockCodeLabEdit = vi.fn();
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabEdit: (...args: unknown[]) => mockCodeLabEdit(...args),
  },
}));

// Mock plan manager
const mockGetCurrentPlan = vi.fn();
const mockGetProgress = vi.fn();
const mockNeedsApproval = vi.fn();
const mockApprovePlan = vi.fn();
const mockStartPlan = vi.fn();
const mockSkipCurrentStep = vi.fn();
const mockCompleteCurrentStep = vi.fn();
const mockFailCurrentStep = vi.fn();
const mockCancelPlan = vi.fn();

vi.mock('@/lib/workspace/plan-mode', () => ({
  getPlanManager: () => ({
    getCurrentPlan: () => mockGetCurrentPlan(),
    getProgress: () => mockGetProgress(),
    needsApproval: () => mockNeedsApproval(),
    approvePlan: () => mockApprovePlan(),
    startPlan: () => mockStartPlan(),
    skipCurrentStep: (...args: unknown[]) => mockSkipCurrentStep(...args),
    completeCurrentStep: (...args: unknown[]) => mockCompleteCurrentStep(...args),
    failCurrentStep: (...args: unknown[]) => mockFailCurrentStep(...args),
    cancelPlan: () => mockCancelPlan(),
  }),
}));

const { GET, POST } = await import('./route');

describe('GET /api/code-lab/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCodeLabEdit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockCodeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const res = await GET();

    expect(res.status).toBe(429);
  });

  it('returns current plan status', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockGetCurrentPlan.mockReturnValue({ id: 'plan-1', steps: [] });
    mockGetProgress.mockReturnValue({ completed: 2, total: 5 });
    mockNeedsApproval.mockReturnValue(false);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.plan).toEqual({ id: 'plan-1', steps: [] });
    expect(data.data.progress).toEqual({ completed: 2, total: 5 });
    expect(data.data.needsApproval).toBe(false);
  });
});

describe('POST /api/code-lab/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockCodeLabEdit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockValidateCSRF.mockReturnValue({ valid: false });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('approves and starts plan', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockApprovePlan.mockReturnValue(true);
    mockGetCurrentPlan.mockReturnValue({ id: 'plan-1', status: 'running' });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.data.success).toBe(true);
    expect(mockStartPlan).toHaveBeenCalled();
  });

  it('skips current step with reason', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockSkipCurrentStep.mockReturnValue({ id: 'step-1', status: 'skipped' });
    mockGetCurrentPlan.mockReturnValue({ id: 'plan-1' });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'skip', reason: 'Not needed' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.data.success).toBe(true);
    expect(data.data.skippedStep).toBeDefined();
  });

  it('cancels plan', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockCancelPlan.mockReturnValue(true);
    mockGetCurrentPlan.mockReturnValue({ id: 'plan-1', status: 'cancelled' });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.data.success).toBe(true);
  });

  it('returns 400 for unknown action', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'destroy' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
