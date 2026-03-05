// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 *
 * Tests for POST /api/create/edit
 * Image editing API using BFL FLUX models
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// MOCKS
// =============================================================================

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock auth guard
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock safeParseJSON
const mockSafeParseJSON = vi.fn();
vi.mock('@/lib/security/validation', () => ({
  safeParseJSON: (...args: unknown[]) => mockSafeParseJSON(...args),
}));

// Mock BFL connector
const mockIsBFLConfigured = vi.fn();
const mockEditImage = vi.fn();
const mockDownloadAndStore = vi.fn();
const mockValidateDimensions = vi.fn();
const mockExtractBase64 = vi.fn();
const mockEnhanceEditPromptWithVision = vi.fn();

vi.mock('@/lib/connectors/bfl', () => ({
  isBFLConfigured: (...args: unknown[]) => mockIsBFLConfigured(...args),
  editImage: (...args: unknown[]) => mockEditImage(...args),
  downloadAndStore: (...args: unknown[]) => mockDownloadAndStore(...args),
  validateDimensions: (...args: unknown[]) => mockValidateDimensions(...args),
  extractBase64: (...args: unknown[]) => mockExtractBase64(...args),
  enhanceEditPromptWithVision: (...args: unknown[]) => mockEnhanceEditPromptWithVision(...args),
  FLUX_MODELS: {
    'flux-2-pro': {
      id: 'flux-2-pro',
      name: 'FLUX.2 Pro',
      capabilities: {
        textToImage: true,
        imageEditing: true,
        maxReferenceImages: 8,
        promptUpsampling: true,
        redux: true,
      },
    },
    'flux-2-klein-4b': {
      id: 'flux-2-klein-4b',
      name: 'FLUX.2 Klein 4B',
      capabilities: {
        textToImage: true,
        imageEditing: false,
        maxReferenceImages: 0,
        promptUpsampling: false,
        redux: false,
      },
    },
  },
  BFLError: class BFLError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.name = 'BFLError';
      this.code = code;
      this.status = status;
    }
  },
}));

// Mock Supabase service role client
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn();
mockUpdate.mockReturnValue({ eq: mockEq });

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: vi.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
  })),
}));

// Mock crypto
vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

// Mock API utils — use actual-like implementations
vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data: unknown) => {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    badRequest: vi.fn(
      (msg: string) =>
        new Response(JSON.stringify({ ok: false, error: msg }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
    serverError: vi.fn(
      (msg: string) =>
        new Response(JSON.stringify({ ok: false, error: msg }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
    serviceUnavailable: vi.fn(
      (msg: string) =>
        new Response(JSON.stringify({ ok: false, error: msg }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
  },
}));

// Import after mocks
import { POST } from './route';
import { BFLError } from '@/lib/connectors/bfl';

// =============================================================================
// HELPERS
// =============================================================================

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/create/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BASE64_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function defaultBody(overrides: Record<string, unknown> = {}) {
  return {
    prompt: 'Make the background blue',
    images: [VALID_BASE64_IMAGE],
    model: 'flux-2-pro',
    width: 1024,
    height: 1024,
    strength: 0.8,
    ...overrides,
  };
}

function setupAuthSuccess() {
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: { id: 'user-123', email: 'test@example.com' },
  });
}

function setupHappyPath() {
  setupAuthSuccess();
  mockIsBFLConfigured.mockReturnValue(true);
  mockSafeParseJSON.mockResolvedValue({
    success: true,
    data: defaultBody(),
  });
  mockExtractBase64.mockReturnValue('iVBORw0KGgo...');
  mockValidateDimensions.mockReturnValue({ valid: true });
  mockEnhanceEditPromptWithVision.mockResolvedValue('Enhanced: Make the background blue');
  mockInsert.mockResolvedValue({ error: null });
  mockEditImage.mockResolvedValue({
    imageUrl: 'https://bfl.example.com/temp-image.png',
    seed: 42,
    cost: 0.05,
  });
  mockDownloadAndStore.mockResolvedValue('https://storage.example.com/stored-image.png');
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/create/edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });

  // ===========================================================================
  // BFL NOT CONFIGURED
  // ===========================================================================

  describe('when BFL is not configured', () => {
    it('should return 503 service unavailable', async () => {
      mockIsBFLConfigured.mockReturnValue(false);

      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('not configured');
    });

    it('should not call requireUser when BFL is not configured', async () => {
      mockIsBFLConfigured.mockReturnValue(false);

      await POST(makeRequest(defaultBody()));

      expect(mockRequireUser).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // AUTH GUARD
  // ===========================================================================

  describe('auth guard', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockIsBFLConfigured.mockReturnValue(true);
      const authResponse = new Response(
        JSON.stringify({ ok: false, error: 'Authentication required' }),
        { status: 401 }
      );
      mockRequireUser.mockResolvedValue({
        authorized: false,
        response: authResponse,
      });

      const res = await POST(makeRequest(defaultBody()));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.ok).toBe(false);
    });

    it('should pass the request object to requireUser for CSRF check', async () => {
      mockIsBFLConfigured.mockReturnValue(true);
      mockRequireUser.mockResolvedValue({
        authorized: false,
        response: new Response('{}', { status: 401 }),
      });

      const req = makeRequest(defaultBody());
      await POST(req);

      expect(mockRequireUser).toHaveBeenCalledWith(req);
    });
  });

  // ===========================================================================
  // JSON PARSING
  // ===========================================================================

  describe('request parsing', () => {
    it('should return 400 when JSON is invalid', async () => {
      mockIsBFLConfigured.mockReturnValue(true);
      setupAuthSuccess();
      mockSafeParseJSON.mockResolvedValue({
        success: false,
        error: 'Invalid JSON in request body',
      });

      const res = await POST(makeRequest({}));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });
  });

  // ===========================================================================
  // INPUT VALIDATION
  // ===========================================================================

  describe('input validation', () => {
    beforeEach(() => {
      mockIsBFLConfigured.mockReturnValue(true);
      setupAuthSuccess();
    });

    it('should reject empty prompt', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ prompt: '' }),
      });

      const res = await POST(makeRequest(defaultBody({ prompt: '' })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Prompt is required');
    });

    it('should reject whitespace-only prompt', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ prompt: '   ' }),
      });

      const res = await POST(makeRequest(defaultBody({ prompt: '   ' })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Prompt is required');
    });

    it('should reject prompt over 2000 characters', async () => {
      const longPrompt = 'a'.repeat(2001);
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ prompt: longPrompt }),
      });

      const res = await POST(makeRequest(defaultBody({ prompt: longPrompt })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('2000 characters');
    });

    it('should reject when no images provided', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ images: [] }),
      });

      const res = await POST(makeRequest(defaultBody({ images: [] })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('At least one reference image');
    });

    it('should reject when images is undefined', async () => {
      const data = defaultBody();
      delete (data as Record<string, unknown>).images;
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: { ...data, images: undefined },
      });

      const res = await POST(makeRequest(data));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('At least one reference image');
    });

    it('should reject model that does not support image editing', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ model: 'flux-2-klein-4b' }),
      });

      const res = await POST(makeRequest(defaultBody({ model: 'flux-2-klein-4b' })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('does not support image editing');
    });

    it('should reject too many reference images for model', async () => {
      const tooManyImages = Array(9).fill(VALID_BASE64_IMAGE);
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ images: tooManyImages }),
      });

      const res = await POST(makeRequest(defaultBody({ images: tooManyImages })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Maximum 8 reference images');
    });

    it('should reject image exceeding 10MB', async () => {
      // Create a string whose base64 size estimate exceeds 10MB
      const oversizedImage = 'x'.repeat(14 * 1024 * 1024); // ~10.5MB decoded
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ images: [oversizedImage] }),
      });

      const res = await POST(makeRequest(defaultBody({ images: [oversizedImage] })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('exceeds maximum size of 10MB');
    });

    it('should reject invalid dimensions', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ width: 100, height: 100 }),
      });
      mockExtractBase64.mockReturnValue('base64data');
      mockValidateDimensions.mockReturnValue({
        valid: false,
        error: 'Width must be between 256 and 2048',
      });

      const res = await POST(makeRequest(defaultBody({ width: 100, height: 100 })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Width must be between');
    });

    it('should reject strength below 0', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ strength: -0.1 }),
      });
      mockExtractBase64.mockReturnValue('base64data');
      mockValidateDimensions.mockReturnValue({ valid: true });

      const res = await POST(makeRequest(defaultBody({ strength: -0.1 })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Strength must be between 0 and 1');
    });

    it('should reject strength above 1', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ strength: 1.5 }),
      });
      mockExtractBase64.mockReturnValue('base64data');
      mockValidateDimensions.mockReturnValue({ valid: true });

      const res = await POST(makeRequest(defaultBody({ strength: 1.5 })));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Strength must be between 0 and 1');
    });
  });

  // ===========================================================================
  // HAPPY PATH
  // ===========================================================================

  describe('happy path', () => {
    beforeEach(() => {
      setupHappyPath();
    });

    it('should return 200 with completed edit result', async () => {
      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('test-uuid-1234');
      expect(body.data.status).toBe('completed');
      expect(body.data.imageUrl).toBe('https://storage.example.com/stored-image.png');
      expect(body.data.model).toBe('flux-2-pro');
      expect(body.data.seed).toBe(42);
      expect(body.data.cost).toBe(0.05);
    });

    it('should include enhanced prompt in response', async () => {
      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(body.data.enhancedPrompt).toBe('Enhanced: Make the background blue');
      expect(body.data.prompt).toBe('Make the background blue');
    });

    it('should include dimensions in response', async () => {
      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(body.data.dimensions).toEqual({ width: 1024, height: 1024 });
    });

    it('should call extractBase64 for each image', async () => {
      const images = [VALID_BASE64_IMAGE, VALID_BASE64_IMAGE];
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ images }),
      });

      await POST(makeRequest(defaultBody({ images })));

      expect(mockExtractBase64).toHaveBeenCalledTimes(2);
    });

    it('should call editImage with processed images and options', async () => {
      mockExtractBase64.mockReturnValue('processed-base64');

      await POST(makeRequest(defaultBody()));

      expect(mockEditImage).toHaveBeenCalledWith(
        'Enhanced: Make the background blue',
        ['processed-base64'],
        {
          model: 'flux-2-pro',
          width: 1024,
          height: 1024,
          strength: 0.8,
        }
      );
    });

    it('should call downloadAndStore with correct arguments', async () => {
      await POST(makeRequest(defaultBody()));

      expect(mockDownloadAndStore).toHaveBeenCalledWith(
        'https://bfl.example.com/temp-image.png',
        'user-123',
        'test-uuid-1234',
        'png'
      );
    });

    it('should use default model when none specified', async () => {
      const data = defaultBody();
      delete (data as Record<string, unknown>).model;
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: { ...data, model: 'flux-2-pro' },
      });

      const res = await POST(makeRequest(data));
      const body = await res.json();

      expect(body.data.model).toBe('flux-2-pro');
    });

    it('should use original prompt if vision enhancement fails', async () => {
      mockEnhanceEditPromptWithVision.mockRejectedValue(new Error('Vision API failed'));

      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      // Should still succeed, using original prompt
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      // editImage should be called with the trimmed original prompt
      expect(mockEditImage).toHaveBeenCalledWith(
        'Make the background blue',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should create generation record in database before editing', async () => {
      await POST(makeRequest(defaultBody()));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-1234',
          user_id: 'user-123',
          type: 'edit',
          model: 'flux-2-pro',
          status: 'processing',
        })
      );
    });

    it('should pass conversationId to generation record when provided', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ conversationId: 'conv-456' }),
      });

      await POST(makeRequest(defaultBody({ conversationId: 'conv-456' })));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: 'conv-456',
        })
      );
    });

    it('should pass null conversationId when not provided', async () => {
      const data = defaultBody();
      delete (data as Record<string, unknown>).conversationId;
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data,
      });

      await POST(makeRequest(data));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: null,
        })
      );
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(() => {
      setupHappyPath();
    });

    it('should return 500 when database insert fails', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'DB insert error' } });

      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toContain('Failed to start edit');
    });

    it('should return 500 when editImage throws', async () => {
      mockEditImage.mockRejectedValue(new Error('BFL API timeout'));

      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toContain('Image edit failed');
    });

    it('should update generation record as failed when editImage throws', async () => {
      mockEditImage.mockRejectedValue(new Error('BFL API timeout'));

      await POST(makeRequest(defaultBody()));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_code: 'EDIT_ERROR',
          error_message: 'BFL API timeout',
        })
      );
    });

    it('should update generation record as moderated when BFLError with CONTENT_MODERATED', async () => {
      const bflError = new BFLError('Content was moderated', 'CONTENT_MODERATED', 400);
      mockEditImage.mockRejectedValue(bflError);

      await POST(makeRequest(defaultBody()));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'moderated',
          error_code: 'CONTENT_MODERATED',
        })
      );
    });

    it('should update generation record as moderated when BFLError with REQUEST_MODERATED', async () => {
      const bflError = new BFLError('Request was moderated', 'REQUEST_MODERATED', 400);
      mockEditImage.mockRejectedValue(bflError);

      await POST(makeRequest(defaultBody()));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'moderated',
          error_code: 'REQUEST_MODERATED',
        })
      );
    });

    it('should return 500 when downloadAndStore throws', async () => {
      mockDownloadAndStore.mockRejectedValue(new Error('Storage unavailable'));

      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toContain('Failed to store image');
    });

    it('should update generation record with STORAGE_FAILED when downloadAndStore throws', async () => {
      mockDownloadAndStore.mockRejectedValue(new Error('Storage unavailable'));

      await POST(makeRequest(defaultBody()));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_code: 'STORAGE_FAILED',
        })
      );
    });

    it('should return 500 for unexpected errors in outer try/catch', async () => {
      // Force safeParseJSON to throw (not return error), triggering outer catch
      mockSafeParseJSON.mockRejectedValue(new Error('Unexpected crash'));

      const res = await POST(makeRequest(defaultBody()));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toContain('Edit generation failed');
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      setupHappyPath();
    });

    it('should accept prompt with exactly 2000 characters', async () => {
      const exactPrompt = 'a'.repeat(2000);
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ prompt: exactPrompt }),
      });

      const res = await POST(makeRequest(defaultBody({ prompt: exactPrompt })));

      expect(res.status).toBe(200);
    });

    it('should accept strength at boundary 0', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ strength: 0 }),
      });

      const res = await POST(makeRequest(defaultBody({ strength: 0 })));

      expect(res.status).toBe(200);
    });

    it('should accept strength at boundary 1', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ strength: 1 }),
      });

      const res = await POST(makeRequest(defaultBody({ strength: 1 })));

      expect(res.status).toBe(200);
    });

    it('should trim prompt before using it', async () => {
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ prompt: '  Make it blue  ' }),
      });
      mockEnhanceEditPromptWithVision.mockResolvedValue('Enhanced: Make it blue');

      const res = await POST(makeRequest(defaultBody({ prompt: '  Make it blue  ' })));
      const body = await res.json();

      expect(body.data.prompt).toBe('Make it blue');
      expect(mockEnhanceEditPromptWithVision).toHaveBeenCalledWith(
        'Make it blue',
        expect.any(String)
      );
    });

    it('should accept exactly 8 images for flux-2-pro', async () => {
      const eightImages = Array(8).fill(VALID_BASE64_IMAGE);
      mockSafeParseJSON.mockResolvedValue({
        success: true,
        data: defaultBody({ images: eightImages }),
      });

      const res = await POST(makeRequest(defaultBody({ images: eightImages })));

      expect(res.status).toBe(200);
    });

    it('should update generation record on success with result data', async () => {
      await POST(makeRequest(defaultBody()));

      // The last call to update should be the success update
      const updateCalls = mockUpdate.mock.calls;
      const lastUpdateArg = updateCalls[updateCalls.length - 1][0];

      expect(lastUpdateArg).toEqual(
        expect.objectContaining({
          status: 'completed',
          result_url: 'https://storage.example.com/stored-image.png',
          cost_credits: 0.05,
        })
      );
      expect(lastUpdateArg.result_data).toEqual(
        expect.objectContaining({
          seed: 42,
          originalUrl: 'https://bfl.example.com/temp-image.png',
        })
      );
    });
  });
});
