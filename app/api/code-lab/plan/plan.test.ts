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

// Mock auth
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
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
    mockRequireUser.mockResolvedValue({ authorized: true, user: { id: 'user-123' } });
    mockCodeLabEdit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockCodeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const res = await GET();

    expect(res.status).toBe(429);
  });

  it('returns current plan status', async () => {
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
    mockRequireUser.mockResolvedValue({ authorized: true, user: { id: 'user-123' } });
    mockCodeLabEdit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'CSRF validation failed' }), { status: 403 }),
    });

    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('approves and starts plan', async () => {
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
    const req = new NextRequest('http://localhost/api/code-lab/plan', {
      method: 'POST',
      body: JSON.stringify({ action: 'destroy' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
