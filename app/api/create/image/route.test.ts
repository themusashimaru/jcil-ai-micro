/**
 * IMAGE GENERATION API TESTS
 *
 * Tests for /api/create/image endpoint:
 * - POST: Submit image generation request
 * - GET: Retrieve user's generations
 * - Auth guard (requireUser) rejecting unauthenticated requests
 * - Validation errors (missing prompt, prompt too long, bad dimensions)
 * - BFL not configured
 * - Generation failure, storage failure, and error handling paths
 * - Happy path with full generation + storage + verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

// untypedFrom mock: returns a chainable object with configurable behavior
let insertResult: { error: unknown } = { error: null };
const mockUpdateCalls: unknown[] = [];

const mockUntypedFrom = vi.fn(() => ({
  insert: vi.fn((data: unknown) => {
    // Capture what was inserted
    mockInsertCalls.push(data);
    return insertResult;
  }),
  update: vi.fn((data: unknown) => {
    mockUpdateCalls.push(data);
    return {
      eq: vi.fn().mockReturnValue({ error: null }),
    };
  }),
}));

let mockInsertCalls: unknown[] = [];

const mockUserSupabase = { from: vi.fn() };

// Auth mocks
const mockRequireUser = vi.fn();

vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data: unknown) => {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    badRequest: vi.fn(
      (msg: string) => new Response(JSON.stringify({ ok: false, error: msg }), { status: 400 })
    ),
    serverError: vi.fn(
      (msg?: string) =>
        new Response(JSON.stringify({ ok: false, error: msg || 'Internal server error' }), {
          status: 500,
        })
    ),
    serviceUnavailable: vi.fn(
      (msg: string) => new Response(JSON.stringify({ ok: false, error: msg }), { status: 503 })
    ),
  },
}));

vi.mock('@/lib/security/validation', () => ({
  safeParseJSON: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockIsBFLConfigured = vi.fn();
const mockGenerateImage = vi.fn();
const mockDownloadAndStore = vi.fn();
const mockValidateDimensions = vi.fn();
const mockEnhanceImagePrompt = vi.fn();
const mockVerifyGenerationResult = vi.fn();

vi.mock('@/lib/connectors/bfl', () => ({
  isBFLConfigured: (...args: unknown[]) => mockIsBFLConfigured(...args),
  generateImage: (...args: unknown[]) => mockGenerateImage(...args),
  downloadAndStore: (...args: unknown[]) => mockDownloadAndStore(...args),
  validateDimensions: (...args: unknown[]) => mockValidateDimensions(...args),
  enhanceImagePrompt: (...args: unknown[]) => mockEnhanceImagePrompt(...args),
  verifyGenerationResult: (...args: unknown[]) => mockVerifyGenerationResult(...args),
  ASPECT_RATIOS: {
    '1:1': { width: 1024, height: 1024, label: 'Square' },
    '4:3': { width: 1024, height: 768, label: 'Landscape 4:3' },
    '16:9': { width: 1280, height: 720, label: 'Widescreen' },
  },
  BFLError: class BFLError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.name = 'BFLError';
      this.code = code;
    }
  },
}));

const mockServiceClient = { id: 'service-client' };

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => mockServiceClient),
}));

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: (...args: unknown[]) => mockUntypedFrom(...args),
}));

// ============================================================================
// HELPERS
// ============================================================================

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/create/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/create/image');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: 'GET' });
}

const fakeUser = {
  id: 'user-123',
  email: 'test@example.com',
};

const fakeAuthSuccess = {
  authorized: true as const,
  user: fakeUser,
  supabase: mockUserSupabase,
};

const fakeAuthFailure = {
  authorized: false as const,
  response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
};

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { POST, GET } from './route';
import { safeParseJSON } from '@/lib/security/validation';
import { BFLError } from '@/lib/connectors/bfl';

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertCalls = [];
  mockUpdateCalls.length = 0;
  insertResult = { error: null };

  // Defaults for happy path
  mockRequireUser.mockResolvedValue(fakeAuthSuccess);
  mockIsBFLConfigured.mockReturnValue(true);
  mockValidateDimensions.mockReturnValue({ valid: true });
  mockEnhanceImagePrompt.mockResolvedValue('Enhanced: a beautiful sunset');
  mockGenerateImage.mockResolvedValue({
    imageUrl: 'https://bfl.example.com/temp-image.png',
    seed: 42,
    enhancedPrompt: 'Enhanced: a beautiful sunset',
    cost: 5,
  });
  mockDownloadAndStore.mockResolvedValue('https://storage.example.com/stored-image.png');
  mockVerifyGenerationResult.mockResolvedValue({
    matches: true,
    feedback: 'Image matches the prompt well',
  });

  // Mock global fetch for verification image download
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as unknown as typeof fetch;

  // User supabase chain for GET
  mockUserSupabase.from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockReturnValue({
              data: [
                { id: 'gen-1', type: 'image', status: 'completed', prompt: 'test' },
                { id: 'gen-2', type: 'image', status: 'completed', prompt: 'test2' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }),
  });
});

// ============================================================================
// POST TESTS
// ============================================================================

describe('POST /api/create/image', () => {
  // --------------------------------------------------------------------------
  // Auth & config checks
  // --------------------------------------------------------------------------

  describe('authentication and configuration', () => {
    it('returns 503 when BFL is not configured (before auth check)', async () => {
      mockIsBFLConfigured.mockReturnValue(false);
      const req = makePostRequest({ prompt: 'test' });
      const res = await POST(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toContain('not available');
    });

    it('does not call requireUser when BFL is not configured', async () => {
      mockIsBFLConfigured.mockReturnValue(false);
      const req = makePostRequest({ prompt: 'test' });
      await POST(req);
      expect(mockRequireUser).not.toHaveBeenCalled();
    });

    it('returns 401 when user is not authenticated', async () => {
      mockRequireUser.mockResolvedValue(fakeAuthFailure);
      const req = makePostRequest({ prompt: 'test' });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('passes the request object to requireUser for CSRF validation', async () => {
      mockRequireUser.mockResolvedValue(fakeAuthFailure);
      const req = makePostRequest({ prompt: 'test' });
      await POST(req);
      expect(mockRequireUser).toHaveBeenCalledWith(req);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  describe('input validation', () => {
    it('returns 400 when JSON parsing fails', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: false,
        error: 'Invalid JSON in request body',
      });
      const req = makePostRequest({});
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 when prompt is empty string', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: '' },
      });
      const req = makePostRequest({ prompt: '' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Prompt is required');
    });

    it('returns 400 when prompt is only whitespace', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: '   ' },
      });
      const req = makePostRequest({ prompt: '   ' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Prompt is required');
    });

    it('returns 400 when prompt exceeds 2000 characters', async () => {
      const longPrompt = 'a'.repeat(2001);
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: longPrompt },
      });
      const req = makePostRequest({ prompt: longPrompt });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('2000 characters');
    });

    it('accepts a prompt at exactly 2000 characters', async () => {
      const maxPrompt = 'a'.repeat(2000);
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: maxPrompt },
      });
      const req = makePostRequest({ prompt: maxPrompt });
      const res = await POST(req);
      // Should not return 400 for the length check
      expect(res.status).not.toBe(400);
    });

    it('returns 400 when dimensions are invalid', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset', width: 99999, height: 99999 },
      });
      mockValidateDimensions.mockReturnValue({
        valid: false,
        error: 'Width must be between 256 and 1440',
      });
      const req = makePostRequest({ prompt: 'a sunset', width: 99999, height: 99999 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Width must be between');
    });
  });

  // --------------------------------------------------------------------------
  // Dimension resolution
  // --------------------------------------------------------------------------

  describe('dimension resolution', () => {
    it('uses aspect ratio dimensions when provided', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset', aspectRatio: '16:9' },
      });
      const req = makePostRequest({ prompt: 'a sunset', aspectRatio: '16:9' });
      await POST(req);
      expect(mockValidateDimensions).toHaveBeenCalledWith('flux-2-pro', 1280, 720);
    });

    it('uses custom width/height when no aspect ratio', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset', width: 800, height: 600 },
      });
      const req = makePostRequest({ prompt: 'a sunset', width: 800, height: 600 });
      await POST(req);
      expect(mockValidateDimensions).toHaveBeenCalledWith('flux-2-pro', 800, 600);
    });

    it('defaults to 1024x1024 when no dimensions specified', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);
      expect(mockValidateDimensions).toHaveBeenCalledWith('flux-2-pro', 1024, 1024);
    });

    it('prefers aspect ratio over custom dimensions', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset', aspectRatio: '4:3', width: 500, height: 500 },
      });
      const req = makePostRequest({
        prompt: 'a sunset',
        aspectRatio: '4:3',
        width: 500,
        height: 500,
      });
      await POST(req);
      // Should use aspect ratio dimensions (1024x768), not custom (500x500)
      expect(mockValidateDimensions).toHaveBeenCalledWith('flux-2-pro', 1024, 768);
    });
  });

  // --------------------------------------------------------------------------
  // Prompt enhancement
  // --------------------------------------------------------------------------

  describe('prompt enhancement', () => {
    it('enhances the prompt before generation', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset', aspectRatio: '1:1' },
      });
      mockEnhanceImagePrompt.mockResolvedValue(
        'Enhanced: a beautiful golden sunset over the ocean'
      );
      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);
      expect(mockEnhanceImagePrompt).toHaveBeenCalledWith('a sunset', {
        type: 'create',
        aspectRatio: '1:1',
      });
      expect(mockGenerateImage).toHaveBeenCalledWith(
        'Enhanced: a beautiful golden sunset over the ocean',
        expect.any(Object)
      );
    });

    it('falls back to original prompt when enhancement fails', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      mockEnhanceImagePrompt.mockRejectedValue(new Error('Enhancement service down'));
      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);
      expect(mockGenerateImage).toHaveBeenCalledWith('a sunset', expect.any(Object));
    });

    it('trims the prompt before enhancing', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: '  a sunset  ' },
      });
      const req = makePostRequest({ prompt: '  a sunset  ' });
      await POST(req);
      expect(mockEnhanceImagePrompt).toHaveBeenCalledWith('a sunset', expect.any(Object));
    });
  });

  // --------------------------------------------------------------------------
  // Database insert failure
  // --------------------------------------------------------------------------

  describe('database errors', () => {
    it('returns 500 when generation record insert fails', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      insertResult = { error: { message: 'DB insert failed' } };
      const req = makePostRequest({ prompt: 'a sunset' });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Failed to start generation');
    });

    it('does not call generateImage when insert fails', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      insertResult = { error: { message: 'DB insert failed' } };
      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);
      expect(mockGenerateImage).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Generation failure
  // --------------------------------------------------------------------------

  describe('generation errors', () => {
    it('returns 500 when generateImage throws a generic error', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      mockGenerateImage.mockRejectedValue(new Error('Network timeout'));
      const req = makePostRequest({ prompt: 'a sunset' });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Image generation failed');
    });

    it('updates DB with moderated status on CONTENT_MODERATED BFLError', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      const bflError = new BFLError('Content was moderated', 'CONTENT_MODERATED');
      mockGenerateImage.mockRejectedValue(bflError);

      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);

      // The second untypedFrom call (the update) should have 'moderated' status
      expect(mockUpdateCalls.length).toBeGreaterThan(0);
      expect(mockUpdateCalls[0]).toEqual(
        expect.objectContaining({
          status: 'moderated',
          error_code: 'CONTENT_MODERATED',
        })
      );
    });

    it('updates DB with moderated status on REQUEST_MODERATED BFLError', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      const bflError = new BFLError('Request was moderated', 'REQUEST_MODERATED');
      mockGenerateImage.mockRejectedValue(bflError);

      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);

      expect(mockUpdateCalls[0]).toEqual(
        expect.objectContaining({
          status: 'moderated',
          error_code: 'REQUEST_MODERATED',
        })
      );
    });

    it('updates DB with failed status on non-moderation BFLError', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      const bflError = new BFLError('Server error', 'SERVER_ERROR');
      mockGenerateImage.mockRejectedValue(bflError);

      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);

      expect(mockUpdateCalls[0]).toEqual(
        expect.objectContaining({
          status: 'failed',
          error_code: 'SERVER_ERROR',
        })
      );
    });

    it('uses GENERATION_ERROR code for non-BFLError exceptions', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      mockGenerateImage.mockRejectedValue(new Error('Generic failure'));

      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);

      expect(mockUpdateCalls[0]).toEqual(
        expect.objectContaining({
          status: 'failed',
          error_code: 'GENERATION_ERROR',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Storage failure
  // --------------------------------------------------------------------------

  describe('storage errors', () => {
    it('returns 500 when downloadAndStore fails', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      mockDownloadAndStore.mockRejectedValue(new Error('Storage bucket full'));

      const req = makePostRequest({ prompt: 'a sunset' });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Failed to store image');
    });

    it('updates DB with STORAGE_FAILED error code when storage fails', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      mockDownloadAndStore.mockRejectedValue(new Error('Storage bucket full'));

      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);

      // Find the update call with STORAGE_FAILED
      const storageUpdate = mockUpdateCalls.find(
        (call: unknown) => (call as Record<string, string>).error_code === 'STORAGE_FAILED'
      );
      expect(storageUpdate).toEqual(
        expect.objectContaining({
          status: 'failed',
          error_code: 'STORAGE_FAILED',
          error_message: 'Failed to store generated image',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------

  describe('happy path', () => {
    beforeEach(() => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a beautiful sunset', model: 'flux-2-pro', aspectRatio: '1:1' },
      });
    });

    it('returns 200 with generation result', async () => {
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data).toMatchObject({
        status: 'completed',
        imageUrl: 'https://storage.example.com/stored-image.png',
        model: 'flux-2-pro',
        prompt: 'a beautiful sunset',
        dimensions: { width: 1024, height: 1024 },
        seed: 42,
        cost: 5,
      });
      // id should be a UUID string
      expect(body.data.id).toBeDefined();
      expect(typeof body.data.id).toBe('string');
    });

    it('calls generateImage with correct parameters', async () => {
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      await POST(req);
      expect(mockGenerateImage).toHaveBeenCalledWith('Enhanced: a beautiful sunset', {
        model: 'flux-2-pro',
        width: 1024,
        height: 1024,
        promptUpsampling: true,
      });
    });

    it('calls downloadAndStore with correct arguments', async () => {
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      await POST(req);
      expect(mockDownloadAndStore).toHaveBeenCalledWith(
        'https://bfl.example.com/temp-image.png',
        'user-123',
        expect.any(String), // generationId (UUID)
        'png'
      );
    });

    it('includes verification result in response when available', async () => {
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      const res = await POST(req);
      const body = await res.json();
      expect(body.data.verification).toEqual({
        matches: true,
        feedback: 'Image matches the prompt well',
      });
    });

    it('still succeeds when verification throws', async () => {
      mockVerifyGenerationResult.mockRejectedValue(new Error('Vision API down'));
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('completed');
    });

    it('still succeeds when verification image fetch returns non-ok', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
      });
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('uses default model flux-2-pro when not specified', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'flux-2-pro' })
      );
    });

    it('uses promptUpsampling=true by default', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ promptUpsampling: true })
      );
    });

    it('passes promptUpsampling=false when explicitly set', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset', promptUpsampling: false },
      });
      const req = makePostRequest({ prompt: 'a sunset', promptUpsampling: false });
      await POST(req);
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ promptUpsampling: false })
      );
    });

    it('includes conversationId in DB record when provided', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset', conversationId: 'conv-abc' },
      });
      const req = makePostRequest({ prompt: 'a sunset', conversationId: 'conv-abc' });
      await POST(req);
      expect(mockInsertCalls[0]).toEqual(
        expect.objectContaining({
          conversation_id: 'conv-abc',
        })
      );
    });

    it('sets conversation_id to null when not provided', async () => {
      vi.mocked(safeParseJSON).mockResolvedValue({
        success: true,
        data: { prompt: 'a sunset' },
      });
      const req = makePostRequest({ prompt: 'a sunset' });
      await POST(req);
      expect(mockInsertCalls[0]).toEqual(
        expect.objectContaining({
          conversation_id: null,
        })
      );
    });

    it('inserts generation record with correct fields', async () => {
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      await POST(req);
      expect(mockInsertCalls[0]).toEqual(
        expect.objectContaining({
          user_id: 'user-123',
          type: 'image',
          model: 'flux-2-pro',
          provider: 'bfl',
          status: 'processing',
          dimensions: { width: 1024, height: 1024 },
        })
      );
    });

    it('returns the enhanced prompt in the response', async () => {
      const req = makePostRequest({ prompt: 'a beautiful sunset' });
      const res = await POST(req);
      const body = await res.json();
      expect(body.data.enhancedPrompt).toBe('Enhanced: a beautiful sunset');
    });
  });

  // --------------------------------------------------------------------------
  // Unexpected errors (outer catch)
  // --------------------------------------------------------------------------

  describe('unexpected errors', () => {
    it('returns 500 on unexpected synchronous exception', async () => {
      vi.mocked(safeParseJSON).mockImplementation(() => {
        throw new Error('Unexpected runtime error');
      });
      const req = makePostRequest({ prompt: 'test' });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });
});

// ============================================================================
// GET TESTS
// ============================================================================

describe('GET /api/create/image', () => {
  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockRequireUser.mockResolvedValue(fakeAuthFailure);
      const req = makeGetRequest();
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('calls requireUser without request arg (no CSRF for GET)', async () => {
      const req = makeGetRequest();
      await GET(req);
      // GET handler calls requireUser() with no arguments
      expect(mockRequireUser).toHaveBeenCalledWith();
    });
  });

  describe('happy path', () => {
    it('returns 200 with generations list', async () => {
      const req = makeGetRequest();
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.generations).toHaveLength(2);
      expect(body.data.pagination).toMatchObject({
        limit: 20,
        offset: 0,
      });
    });

    it('respects limit and offset query params', async () => {
      const selectChain = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
          }),
        }),
      });
      mockUserSupabase.from = vi.fn().mockReturnValue({ select: selectChain });

      const req = makeGetRequest({ limit: '5', offset: '10' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.pagination.limit).toBe(5);
      expect(body.data.pagination.offset).toBe(10);
    });

    it('filters by type query param', async () => {
      const mockEqType = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockReturnValue({ data: [], error: null }),
        }),
      });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
      mockUserSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEqUser }),
      });

      const req = makeGetRequest({ type: 'video' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(mockEqType).toHaveBeenCalledWith('type', 'video');
    });

    it('defaults type to image when not specified', async () => {
      const mockEqType = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockReturnValue({ data: [], error: null }),
        }),
      });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
      mockUserSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEqUser }),
      });

      const req = makeGetRequest();
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(mockEqType).toHaveBeenCalledWith('type', 'image');
    });

    it('sets hasMore=true when results count equals limit', async () => {
      const fiveItems = Array.from({ length: 5 }, (_, i) => ({
        id: `gen-${i}`,
        type: 'image',
        status: 'completed',
      }));
      mockUserSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockReturnValue({ data: fiveItems, error: null }),
              }),
            }),
          }),
        }),
      });

      const req = makeGetRequest({ limit: '5' });
      const res = await GET(req);
      const body = await res.json();
      expect(body.data.pagination.hasMore).toBe(true);
    });

    it('sets hasMore=false when results fewer than limit', async () => {
      mockUserSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockReturnValue({
                  data: [{ id: 'gen-1' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const req = makeGetRequest({ limit: '20' });
      const res = await GET(req);
      const body = await res.json();
      expect(body.data.pagination.hasMore).toBe(false);
    });

    it('returns empty array when no generations exist', async () => {
      mockUserSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      });

      const req = makeGetRequest();
      const res = await GET(req);
      const body = await res.json();
      expect(body.data.generations).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('returns 500 when supabase query returns an error', async () => {
      mockUserSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockReturnValue({
                  data: null,
                  error: { message: 'DB connection lost' },
                }),
              }),
            }),
          }),
        }),
      });

      const req = makeGetRequest();
      const res = await GET(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Failed to get generations');
    });
  });
});
