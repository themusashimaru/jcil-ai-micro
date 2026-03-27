/**
 * NATIVE DOCUMENT GENERATION API TESTS
 *
 * Tests for /api/documents/native endpoint:
 * - GET: Returns schema information (no auth required)
 * - POST: Generates native documents from structured JSON
 *   - Auth guard rejection
 *   - Missing documentData validation
 *   - Invalid documentData validation
 *   - Binary return type
 *   - Base64 return type
 *   - URL return type with Supabase upload
 *   - URL return type fallback when no Supabase
 *   - URL return type fallback on upload error
 *   - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

const mockRequireUser = vi.fn();

vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

const mockSuccessResponse = vi.fn();
const mockErrors = {
  badRequest: vi.fn(
    (msg: string) => new Response(JSON.stringify({ ok: false, error: msg }), { status: 400 })
  ),
  serverError: vi.fn(
    (msg: string) => new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 })
  ),
};

vi.mock('@/lib/api/utils', () => ({
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  errors: {
    badRequest: (msg: string) => mockErrors.badRequest(msg),
    serverError: (msg: string) => mockErrors.serverError(msg),
  },
}));

const mockGenerateDocument = vi.fn();
const mockValidateDocumentJSON = vi.fn();

vi.mock('@/lib/documents', () => ({
  generateDocument: (...args: unknown[]) => mockGenerateDocument(...args),
  validateDocumentJSON: (...args: unknown[]) => mockValidateDocumentJSON(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockUpload = vi.fn();
const mockCreateBucket = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      createBucket: (...args: unknown[]) => mockCreateBucket(...args),
      from: (...args: unknown[]) => mockFrom(...args),
    },
  })),
}));

// ============================================================================
// HELPERS
// ============================================================================

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/documents/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const fakeUserId = 'user-1234-5678-abcd-efgh';
const fakeAuthSuccess = {
  authorized: true as const,
  user: { id: fakeUserId, email: 'test@example.com' },
};

const fakeAuthFailure = {
  authorized: false as const,
  response: new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 }),
};

const fakeResumeData = {
  type: 'resume' as const,
  name: 'John Doe',
  contact: { email: 'john@example.com', phone: '555-1234' },
  experience: [
    { title: 'Engineer', company: 'Acme', startDate: '2020-01', bullets: ['Did things'] },
  ],
  education: [{ degree: 'BS CS', school: 'MIT' }],
};

const fakeGeneratedDoc = {
  buffer: Buffer.from('fake-document-content'),
  filename: 'John_Doe_Resume.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  extension: 'docx',
};

// ============================================================================
// TESTS
// ============================================================================

describe('POST /api/documents/native', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: auth succeeds
    mockRequireUser.mockResolvedValue(fakeAuthSuccess);

    // Default: validation passes
    mockValidateDocumentJSON.mockReturnValue({ valid: true });

    // Default: document generation succeeds
    mockGenerateDocument.mockResolvedValue({ ...fakeGeneratedDoc });

    // Default: successResponse returns a proper Response
    mockSuccessResponse.mockImplementation(
      (data: unknown) =>
        new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    // Default: Supabase storage mock
    mockFrom.mockReturnValue({
      upload: mockUpload,
    });
    mockUpload.mockResolvedValue({ error: null });
    mockCreateBucket.mockResolvedValue({ data: null, error: null });

    // Default: Supabase env vars set
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.NEXT_PUBLIC_APP_URL = 'https://jcil.ai';
  });

  // --------------------------------------------------------------------------
  // AUTH GUARD
  // --------------------------------------------------------------------------

  it('rejects unauthenticated requests', async () => {
    mockRequireUser.mockResolvedValue(fakeAuthFailure);
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockRequireUser).toHaveBeenCalledWith(request);
  });

  // --------------------------------------------------------------------------
  // VALIDATION ERRORS
  // --------------------------------------------------------------------------

  it('returns 400 when documentData is missing', async () => {
    const { POST } = await import('./route');

    const request = createPostRequest({});
    await POST(request);

    expect(mockErrors.badRequest).toHaveBeenCalledWith('Missing documentData in request body');
  });

  it('returns 400 when documentData is null', async () => {
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: null });
    await POST(request);

    expect(mockErrors.badRequest).toHaveBeenCalledWith('Missing documentData in request body');
  });

  it('returns 400 when document validation fails', async () => {
    mockValidateDocumentJSON.mockReturnValue({ valid: false, error: 'Missing "type" field' });
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: { bad: 'data' } });
    await POST(request);

    expect(mockValidateDocumentJSON).toHaveBeenCalledWith({ bad: 'data' });
    expect(mockErrors.badRequest).toHaveBeenCalledWith(
      'Invalid document data: Missing "type" field'
    );
  });

  // --------------------------------------------------------------------------
  // BINARY RETURN TYPE
  // --------------------------------------------------------------------------

  it('returns binary response when returnType is binary', async () => {
    const { POST } = await import('./route');

    const request = createPostRequest({
      documentData: fakeResumeData,
      returnType: 'binary',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(fakeGeneratedDoc.mimeType);
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="${fakeGeneratedDoc.filename}"`
    );
    expect(response.headers.get('Content-Length')).toBe(fakeGeneratedDoc.buffer.length.toString());
    expect(response.headers.get('X-Document-Type')).toBe('resume');
    expect(response.headers.get('X-Document-Extension')).toBe('docx');

    const body = await response.arrayBuffer();
    expect(new Uint8Array(body)).toEqual(new Uint8Array(fakeGeneratedDoc.buffer));
  });

  // --------------------------------------------------------------------------
  // BASE64 RETURN TYPE
  // --------------------------------------------------------------------------

  it('returns base64 data URL when returnType is base64', async () => {
    const { POST } = await import('./route');

    const request = createPostRequest({
      documentData: fakeResumeData,
      returnType: 'base64',
    });
    await POST(request);

    const expectedBase64 = fakeGeneratedDoc.buffer.toString('base64');
    const expectedDataUrl = `data:${fakeGeneratedDoc.mimeType};base64,${expectedBase64}`;

    expect(mockSuccessResponse).toHaveBeenCalledWith({
      success: true,
      format: 'docx',
      title: 'John Doe - Resume',
      filename: fakeGeneratedDoc.filename,
      mimeType: fakeGeneratedDoc.mimeType,
      dataUrl: expectedDataUrl,
      storage: 'local',
    });
  });

  // --------------------------------------------------------------------------
  // URL RETURN TYPE (DEFAULT) — SUPABASE UPLOAD
  // --------------------------------------------------------------------------

  it('uploads to Supabase and returns download URL by default', async () => {
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    await POST(request);

    // Should attempt to create bucket
    expect(mockCreateBucket).toHaveBeenCalledWith('documents', {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });

    // Should upload file
    expect(mockFrom).toHaveBeenCalledWith('documents');
    expect(mockUpload).toHaveBeenCalledWith(
      `${fakeUserId}/${fakeGeneratedDoc.filename}`,
      fakeGeneratedDoc.buffer,
      {
        contentType: fakeGeneratedDoc.mimeType,
        cacheControl: '3600',
        upsert: false,
      }
    );

    // Should return success with download URL
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        format: 'docx',
        title: 'John Doe - Resume',
        filename: fakeGeneratedDoc.filename,
        mimeType: fakeGeneratedDoc.mimeType,
        storage: 'supabase',
        expiresIn: '1 hour',
      })
    );

    // Verify the download URL structure
    const callArgs = mockSuccessResponse.mock.calls[0][0] as { downloadUrl: string };
    expect(callArgs.downloadUrl).toContain('https://jcil.ai/api/documents/download?token=');
  });

  it('includes correct token in download URL', async () => {
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    await POST(request);

    const callArgs = mockSuccessResponse.mock.calls[0][0] as { downloadUrl: string };
    const url = new URL(callArgs.downloadUrl);
    const token = url.searchParams.get('token')!;

    // Token is now HMAC-signed: base64url(payload).base64url(signature)
    const parts = token.split('.');
    expect(parts.length).toBe(2);
    const decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

    expect(decoded.u).toBe(fakeUserId);
    expect(decoded.f).toBe(fakeGeneratedDoc.filename);
    expect(decoded.t).toBe('docx');
    expect(decoded.iat).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // URL RETURN TYPE — FALLBACK PATHS
  // --------------------------------------------------------------------------

  it('falls back to base64 when Supabase env vars are missing', async () => {
    // getSupabaseAdmin() checks env vars at call time, not import time
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    await POST(request);

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        storage: 'fallback',
        dataUrl: expect.stringContaining('data:'),
      })
    );
  });

  it('falls back to base64 when Supabase upload fails', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Upload failed' } });
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    await POST(request);

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        storage: 'fallback',
        dataUrl: expect.stringContaining('data:'),
      })
    );
  });

  // --------------------------------------------------------------------------
  // CUSTOM FILENAME
  // --------------------------------------------------------------------------

  it('passes custom filename to generateDocument', async () => {
    const { POST } = await import('./route');

    const request = createPostRequest({
      documentData: fakeResumeData,
      filename: 'custom-name.docx',
      returnType: 'base64',
    });
    await POST(request);

    expect(mockGenerateDocument).toHaveBeenCalledWith(fakeResumeData, 'custom-name.docx');
  });

  // --------------------------------------------------------------------------
  // DOCUMENT TYPE TITLES
  // --------------------------------------------------------------------------

  it('generates correct title for spreadsheet type', async () => {
    const spreadsheetData = {
      type: 'spreadsheet',
      title: 'Q4 Budget',
      sheets: [{ name: 'Sheet1', rows: [{ cells: [{ value: 'A' }] }] }],
    };
    mockGenerateDocument.mockResolvedValue({
      buffer: Buffer.from('xlsx-content'),
      filename: 'Q4_Budget.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    });
    const { POST } = await import('./route');

    const request = createPostRequest({
      documentData: spreadsheetData,
      returnType: 'base64',
    });
    await POST(request);

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Q4 Budget' })
    );
  });

  it('generates correct title for document type', async () => {
    const docData = {
      type: 'document',
      title: 'Cover Letter',
      sections: [{ type: 'paragraph', text: 'Hello' }],
    };
    mockGenerateDocument.mockResolvedValue({
      buffer: Buffer.from('docx-content'),
      filename: 'Cover_Letter.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    });
    const { POST } = await import('./route');

    const request = createPostRequest({
      documentData: docData,
      returnType: 'base64',
    });
    await POST(request);

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cover Letter' })
    );
  });

  it('generates correct title for invoice type', async () => {
    const invoiceData = {
      type: 'invoice',
      invoiceNumber: 'INV-2026-001',
      from: { name: 'Acme Corp' },
      to: { name: 'Client Co' },
      items: [{ description: 'Widget', quantity: 1, unitPrice: 100 }],
    };
    mockGenerateDocument.mockResolvedValue({
      buffer: Buffer.from('pdf-content'),
      filename: 'Invoice_INV-2026-001.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
    });
    const { POST } = await import('./route');

    const request = createPostRequest({
      documentData: invoiceData,
      returnType: 'base64',
    });
    await POST(request);

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invoice INV-2026-001' })
    );
  });

  // --------------------------------------------------------------------------
  // ERROR HANDLING
  // --------------------------------------------------------------------------

  it('returns 500 when generateDocument throws', async () => {
    mockGenerateDocument.mockRejectedValue(new Error('Generation failed'));
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    await POST(request);

    expect(mockErrors.serverError).toHaveBeenCalledWith('Failed to generate document');
  });

  it('returns 500 when request.json() throws', async () => {
    const { POST } = await import('./route');

    // Create a request whose json() will throw
    const request = new NextRequest('http://localhost:3000/api/documents/native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    });
    await POST(request);

    expect(mockErrors.serverError).toHaveBeenCalledWith('Failed to generate document');
  });

  it('handles non-Error thrown objects', async () => {
    mockGenerateDocument.mockRejectedValue('string error');
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    await POST(request);

    expect(mockErrors.serverError).toHaveBeenCalledWith('Failed to generate document');
  });

  // --------------------------------------------------------------------------
  // BUCKET CREATION ERROR IS SILENCED
  // --------------------------------------------------------------------------

  it('continues even when bucket creation throws', async () => {
    mockCreateBucket.mockRejectedValue(new Error('Bucket already exists'));
    const { POST } = await import('./route');

    const request = createPostRequest({ documentData: fakeResumeData });
    await POST(request);

    // Should still attempt upload
    expect(mockUpload).toHaveBeenCalled();
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({ storage: 'supabase' })
    );
  });
});

// ==============================================================================
// GET ENDPOINT
// ==============================================================================

describe('GET /api/documents/native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccessResponse.mockImplementation(
      (data: unknown) =>
        new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
  });

  it('returns schema information without requiring auth', async () => {
    const { GET } = await import('./route');

    await GET();

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Native Document Generation API',
        info: 'Generates real DOCX and XLSX files from structured JSON',
        endpoint: expect.objectContaining({
          method: 'POST',
        }),
        supportedTypes: expect.objectContaining({
          resume: expect.objectContaining({ outputFormat: '.docx' }),
          spreadsheet: expect.objectContaining({ outputFormat: '.xlsx' }),
          document: expect.objectContaining({ outputFormat: '.docx' }),
          invoice: expect.objectContaining({ outputFormat: '.pdf' }),
        }),
      })
    );
  });

  it('does not call requireUser for GET', async () => {
    const { GET } = await import('./route');

    await GET();

    expect(mockRequireUser).not.toHaveBeenCalled();
  });
});

// ==============================================================================
// EXPORTED CONSTANTS
// ==============================================================================

describe('Route exports', () => {
  it('exports runtime as nodejs', async () => {
    const mod = await import('./route');
    expect(mod.runtime).toBe('nodejs');
  });

  it('exports maxDuration as 30', async () => {
    const mod = await import('./route');
    expect(mod.maxDuration).toBe(30);
  });
});
