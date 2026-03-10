/**
 * USER DOCUMENTS FILES API TESTS
 *
 * Tests for /api/documents/user/files endpoint:
 * - GET: List user's documents (with optional folderId filter)
 * - POST: Upload new document (file validation, size limits, quota)
 * - PUT: Rename/move document
 * - DELETE: Delete document (ownership check, storage cleanup)
 * - Auth guard rejection for all methods
 * - Error handling for all methods
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

vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn(
    (data: unknown, status = 200) => new Response(JSON.stringify({ ok: true, data }), { status })
  ),
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
    notFound: vi.fn(
      (resource: string) =>
        new Response(JSON.stringify({ ok: false, error: `${resource} not found` }), { status: 404 })
    ),
    forbidden: vi.fn(
      (msg: string) => new Response(JSON.stringify({ ok: false, error: msg }), { status: 403 })
    ),
    unauthorized: vi.fn(
      () => new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 })
    ),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Storage client mock (service role - via createClient)
const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
const mockStorageFrom = vi.fn().mockReturnValue({
  upload: mockStorageUpload,
  remove: mockStorageRemove,
});

const mockServiceFrom = vi.fn();
const mockServiceSupabase = {
  from: mockServiceFrom,
  storage: { from: mockStorageFrom },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockServiceSupabase),
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'mock-uuid-1234' });

// ============================================================================
// HELPERS
// ============================================================================

const TEST_USER_ID = 'test-user-id';
const TEST_EMAIL = 'test@example.com';

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as never);
}

/** Build a chainable supabase mock for user-scoped queries */
function makeUserSupabase() {
  return {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

function authSuccess() {
  const supabase = makeUserSupabase();
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: { id: TEST_USER_ID, email: TEST_EMAIL },
    supabase,
  });
  return supabase;
}

function authFailure() {
  mockRequireUser.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  });
}

/**
 * Create a NextRequest with a mocked formData() method.
 * This avoids the timeout issue where NextRequest.formData() hangs in vitest.
 */
function makeFormDataRequest(fields: Record<string, unknown>): NextRequest {
  const request = makeRequest('/api/documents/user/files', { method: 'POST' });
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof File || value instanceof Blob) {
      formData.append(key, value);
    } else if (typeof value === 'string') {
      formData.append(key, value);
    }
  }
  vi.spyOn(request, 'formData').mockResolvedValue(formData);
  return request;
}

function makePdfFile(size = 100): File {
  const buffer = new Uint8Array(size);
  const file = new File([buffer], 'test.pdf', { type: 'application/pdf' });
  // Polyfill arrayBuffer() for jsdom/happy-dom environments
  if (!file.arrayBuffer) {
    file.arrayBuffer = () => Promise.resolve(buffer.buffer);
  }
  return file;
}

// ============================================================================
// IMPORT ROUTE HANDLERS
// ============================================================================

// Import once at the top - mocks are hoisted so this works
import { GET, POST, PUT, DELETE } from './route';

// ============================================================================
// TESTS
// ============================================================================

describe('Documents User Files API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  // ==========================================================================
  // GET /api/documents/user/files
  // ==========================================================================
  describe('GET', () => {
    it('should reject unauthenticated requests', async () => {
      authFailure();
      const request = makeRequest('/api/documents/user/files');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return documents list with stats on success', async () => {
      const supabase = authSuccess();
      const mockDocs = [{ id: 'doc-1', name: 'Test Doc', file_type: 'pdf', folder: null }];
      const mockStats = [
        { total_documents: 1, total_folders: 0, total_size_bytes: 1024, total_chunks: 5 },
      ];

      // Chain: from('user_documents').select(...).eq('user_id', ...).order(...)
      const orderFn = vi.fn().mockResolvedValue({ data: mockDocs, error: null });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      supabase.from.mockReturnValue({ select: selectFn });
      supabase.rpc.mockResolvedValue({ data: mockStats });

      const request = makeRequest('/api/documents/user/files');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.documents).toEqual(mockDocs);
      expect(body.data.stats).toEqual(mockStats[0]);
    });

    it('should filter by folderId when provided', async () => {
      const supabase = authSuccess();

      // Route chain: from -> select -> eq(user_id) -> order -> eq(folder_id) -> [await]
      const eqFolder = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderFn = vi.fn().mockReturnValue({ eq: eqFolder, is: vi.fn() });
      const eqUser = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqUser });
      supabase.from.mockReturnValue({ select: selectFn });

      const request = makeRequest('/api/documents/user/files?folderId=folder-123');
      await GET(request);

      expect(eqUser).toHaveBeenCalledWith('user_id', TEST_USER_ID);
      expect(eqFolder).toHaveBeenCalledWith('folder_id', 'folder-123');
    });

    it('should filter by null folder when folderId is "null"', async () => {
      const supabase = authSuccess();

      // Route chain: from -> select -> eq(user_id) -> order -> is(folder_id, null) -> [await]
      const isFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderFn = vi.fn().mockReturnValue({ is: isFn, eq: vi.fn() });
      const eqUser = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqUser });
      supabase.from.mockReturnValue({ select: selectFn });

      const request = makeRequest('/api/documents/user/files?folderId=null');
      await GET(request);

      expect(isFn).toHaveBeenCalledWith('folder_id', null);
    });

    it('should filter by null folder when folderId is empty string', async () => {
      const supabase = authSuccess();

      // Route chain: from -> select -> eq(user_id) -> order -> is(folder_id, null) -> [await]
      const isFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderFn = vi.fn().mockReturnValue({ is: isFn, eq: vi.fn() });
      const eqUser = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqUser });
      supabase.from.mockReturnValue({ select: selectFn });

      const request = makeRequest('/api/documents/user/files?folderId=');
      await GET(request);

      expect(isFn).toHaveBeenCalledWith('folder_id', null);
    });

    it('should return all documents when no folderId provided', async () => {
      const supabase = authSuccess();

      const orderFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqUser = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqUser });
      supabase.from.mockReturnValue({ select: selectFn });

      const request = makeRequest('/api/documents/user/files');
      await GET(request);

      // Should call eq only for user_id, not for folder_id
      expect(eqUser).toHaveBeenCalledTimes(1);
      expect(eqUser).toHaveBeenCalledWith('user_id', TEST_USER_ID);
    });

    it('should return default stats when rpc returns null', async () => {
      const supabase = authSuccess();

      const orderFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      supabase.from.mockReturnValue({ select: selectFn });
      supabase.rpc.mockResolvedValue({ data: null });

      const request = makeRequest('/api/documents/user/files');
      const response = await GET(request);

      const body = await response.json();
      expect(body.data.stats).toEqual({
        total_documents: 0,
        total_folders: 0,
        total_size_bytes: 0,
        total_chunks: 0,
      });
    });

    it('should return server error when query fails', async () => {
      const supabase = authSuccess();

      const orderFn = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('DB error'),
      });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      supabase.from.mockReturnValue({ select: selectFn });

      const request = makeRequest('/api/documents/user/files');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unexpected'));

      const request = makeRequest('/api/documents/user/files');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  // ==========================================================================
  // POST /api/documents/user/files
  // ==========================================================================
  describe('POST', () => {
    it('should reject unauthenticated requests', async () => {
      authFailure();
      const request = makeFormDataRequest({ file: makePdfFile() });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should reject request with no file', async () => {
      authSuccess();
      const request = makeFormDataRequest({});
      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('No file provided');
    });

    it('should reject unsupported file type', async () => {
      authSuccess();
      const file = new File([new Uint8Array(10)], 'test.exe', {
        type: 'application/x-msdownload',
      });
      const request = makeFormDataRequest({ file });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid file type');
    });

    it('should reject files exceeding 10MB', async () => {
      authSuccess();
      const largeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'huge.pdf', {
        type: 'application/pdf',
      });
      const request = makeFormDataRequest({ file: largeFile });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('File too large');
    });

    it('should reject when document limit is reached', async () => {
      const supabase = authSuccess();

      // count query: from('user_documents').select('*', opts).eq('user_id', ...)
      const eqFn = vi.fn().mockResolvedValue({ count: 30, error: null });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      supabase.from.mockReturnValue({ select: selectFn });

      const request = makeFormDataRequest({ file: makePdfFile() });
      const response = await POST(request);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Document limit reached');
    });

    it('should upload file and create document record on success', async () => {
      const supabase = authSuccess();

      // Count query (under limit)
      const countEq = vi.fn().mockResolvedValue({ count: 5, error: null });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });
      supabase.from.mockReturnValue({ select: countSelect });

      // Storage upload
      mockStorageUpload.mockResolvedValue({ error: null });

      // Insert via service client
      const mockDoc = { id: 'mock-uuid-1234', name: 'test', status: 'pending' };
      const insertSingle = vi.fn().mockResolvedValue({ data: mockDoc, error: null });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertFn = vi.fn().mockReturnValue({ select: insertSelect });
      mockServiceFrom.mockReturnValue({ insert: insertFn });

      const request = makeFormDataRequest({ file: makePdfFile() });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.document).toEqual(mockDoc);
    });

    it('should use custom name when provided', async () => {
      const supabase = authSuccess();

      const countEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });
      supabase.from.mockReturnValue({ select: countSelect });

      mockStorageUpload.mockResolvedValue({ error: null });

      const insertSingle = vi.fn().mockResolvedValue({
        data: { id: 'mock-uuid-1234', name: 'Custom Name' },
        error: null,
      });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertFn = vi.fn().mockReturnValue({ select: insertSelect });
      mockServiceFrom.mockReturnValue({ insert: insertFn });

      const request = makeFormDataRequest({
        file: makePdfFile(),
        name: '  Custom Name  ',
      });
      await POST(request);

      expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Custom Name' }));
    });

    it('should strip file extension for display name when no custom name', async () => {
      const supabase = authSuccess();

      const countEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });
      supabase.from.mockReturnValue({ select: countSelect });

      mockStorageUpload.mockResolvedValue({ error: null });

      const insertSingle = vi.fn().mockResolvedValue({
        data: { id: 'mock-uuid-1234', name: 'test' },
        error: null,
      });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertFn = vi.fn().mockReturnValue({ select: insertSelect });
      mockServiceFrom.mockReturnValue({ insert: insertFn });

      const request = makeFormDataRequest({ file: makePdfFile() });
      await POST(request);

      // 'test.pdf' -> display name 'test'
      expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'test' }));
    });

    it('should set folder_id from formData folderId field', async () => {
      const supabase = authSuccess();

      const countEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });
      supabase.from.mockReturnValue({ select: countSelect });

      mockStorageUpload.mockResolvedValue({ error: null });

      const insertSingle = vi.fn().mockResolvedValue({
        data: { id: 'mock-uuid-1234' },
        error: null,
      });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertFn = vi.fn().mockReturnValue({ select: insertSelect });
      mockServiceFrom.mockReturnValue({ insert: insertFn });

      const request = makeFormDataRequest({
        file: makePdfFile(),
        folderId: 'folder-abc',
      });
      await POST(request);

      expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({ folder_id: 'folder-abc' }));
    });

    it('should return server error when storage upload fails', async () => {
      const supabase = authSuccess();

      const countEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });
      supabase.from.mockReturnValue({ select: countSelect });

      mockStorageUpload.mockResolvedValue({ error: new Error('Upload failed') });

      const request = makeFormDataRequest({ file: makePdfFile() });
      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should clean up storage file when database insert fails', async () => {
      const supabase = authSuccess();

      const countEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });
      supabase.from.mockReturnValue({ select: countSelect });

      mockStorageUpload.mockResolvedValue({ error: null });

      const insertSingle = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Insert failed'),
      });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertFn = vi.fn().mockReturnValue({ select: insertSelect });
      mockServiceFrom.mockReturnValue({ insert: insertFn });

      const request = makeFormDataRequest({ file: makePdfFile() });
      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(mockStorageRemove).toHaveBeenCalledWith([
        expect.stringContaining('test-user-id/mock-uuid-1234/'),
      ]);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unexpected'));
      const request = makeFormDataRequest({ file: makePdfFile() });
      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should pass request to requireUser for CSRF validation', async () => {
      authSuccess();
      const supabase = authSuccess();
      const countEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });
      supabase.from.mockReturnValue({ select: countSelect });
      mockStorageUpload.mockResolvedValue({ error: null });
      const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      mockServiceFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: insertSelect }),
      });

      const request = makeFormDataRequest({ file: makePdfFile() });
      await POST(request);

      // requireUser should be called with the request object for CSRF
      expect(mockRequireUser).toHaveBeenCalledWith(request);
    });

    it('should accept all allowed MIME types', async () => {
      const allowedTypes: Array<{ mime: string; ext: string; filename: string }> = [
        { mime: 'application/pdf', ext: 'pdf', filename: 'doc.pdf' },
        {
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ext: 'docx',
          filename: 'doc.docx',
        },
        { mime: 'application/msword', ext: 'doc', filename: 'doc.doc' },
        {
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ext: 'xlsx',
          filename: 'data.xlsx',
        },
        { mime: 'application/vnd.ms-excel', ext: 'xls', filename: 'data.xls' },
        { mime: 'text/plain', ext: 'txt', filename: 'notes.txt' },
        { mime: 'text/csv', ext: 'csv', filename: 'data.csv' },
      ];

      for (const { mime, ext, filename } of allowedTypes) {
        vi.clearAllMocks();
        const supabase = authSuccess();

        const countEq = vi.fn().mockResolvedValue({ count: 0, error: null });
        const countSelect = vi.fn().mockReturnValue({ eq: countEq });
        supabase.from.mockReturnValue({ select: countSelect });

        mockStorageUpload.mockResolvedValue({ error: null });

        const insertSingle = vi.fn().mockResolvedValue({
          data: { id: 'mock-uuid-1234', file_type: ext },
          error: null,
        });
        const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
        const insertFn = vi.fn().mockReturnValue({ select: insertSelect });
        mockServiceFrom.mockReturnValue({ insert: insertFn });

        const buf = new Uint8Array(10);
        const file = new File([buf], filename, { type: mime });
        if (!file.arrayBuffer) {
          file.arrayBuffer = () => Promise.resolve(buf.buffer);
        }
        const request = makeFormDataRequest({ file });
        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(insertFn).toHaveBeenCalledWith(
          expect.objectContaining({ file_type: ext, mime_type: mime })
        );
      }
    });
  });

  // ==========================================================================
  // PUT /api/documents/user/files
  // ==========================================================================
  describe('PUT', () => {
    function makePutRequest(body: Record<string, unknown>): NextRequest {
      return new NextRequest(new URL('/api/documents/user/files', 'http://localhost:3000'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    it('should reject unauthenticated requests', async () => {
      authFailure();
      const request = makePutRequest({ id: 'doc-1', name: 'New Name' });
      const response = await PUT(request);
      expect(response.status).toBe(401);
    });

    it('should reject request without document ID', async () => {
      authSuccess();
      const request = makePutRequest({ name: 'New Name' });
      const response = await PUT(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Document ID is required');
    });

    it('should update document name on success', async () => {
      const supabase = authSuccess();

      const mockUpdated = { id: 'doc-1', name: 'New Name' };
      const singleFn = vi.fn().mockResolvedValue({ data: mockUpdated, error: null });
      const selectFn = vi.fn().mockReturnValue({ single: singleFn });
      const eqUser = vi.fn().mockReturnValue({ select: selectFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const updateFn = vi.fn().mockReturnValue({ eq: eqId });
      supabase.from.mockReturnValue({ update: updateFn });

      const request = makePutRequest({ id: 'doc-1', name: 'New Name' });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.document).toEqual(mockUpdated);
    });

    it('should update folder assignment', async () => {
      const supabase = authSuccess();

      const singleFn = vi.fn().mockResolvedValue({
        data: { id: 'doc-1', folder_id: 'folder-2' },
        error: null,
      });
      const selectFn = vi.fn().mockReturnValue({ single: singleFn });
      const eqUser = vi.fn().mockReturnValue({ select: selectFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const updateFn = vi.fn().mockReturnValue({ eq: eqId });
      supabase.from.mockReturnValue({ update: updateFn });

      const request = makePutRequest({ id: 'doc-1', folderId: 'folder-2' });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ folder_id: 'folder-2' }));
    });

    it('should set folder_id to null when folderId is empty string', async () => {
      const supabase = authSuccess();

      const singleFn = vi.fn().mockResolvedValue({
        data: { id: 'doc-1', folder_id: null },
        error: null,
      });
      const selectFn = vi.fn().mockReturnValue({ single: singleFn });
      const eqUser = vi.fn().mockReturnValue({ select: selectFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const updateFn = vi.fn().mockReturnValue({ eq: eqId });
      supabase.from.mockReturnValue({ update: updateFn });

      const request = makePutRequest({ id: 'doc-1', folderId: '' });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ folder_id: null }));
    });

    it('should trim name whitespace', async () => {
      const supabase = authSuccess();

      const singleFn = vi.fn().mockResolvedValue({
        data: { id: 'doc-1', name: 'Trimmed' },
        error: null,
      });
      const selectFn = vi.fn().mockReturnValue({ single: singleFn });
      const eqUser = vi.fn().mockReturnValue({ select: selectFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const updateFn = vi.fn().mockReturnValue({ eq: eqId });
      supabase.from.mockReturnValue({ update: updateFn });

      const request = makePutRequest({ id: 'doc-1', name: '  Trimmed  ' });
      await PUT(request);

      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trimmed' }));
    });

    it('should return server error when update fails', async () => {
      const supabase = authSuccess();

      const singleFn = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Update failed'),
      });
      const selectFn = vi.fn().mockReturnValue({ single: singleFn });
      const eqUser = vi.fn().mockReturnValue({ select: selectFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const updateFn = vi.fn().mockReturnValue({ eq: eqId });
      supabase.from.mockReturnValue({ update: updateFn });

      const request = makePutRequest({ id: 'doc-1', name: 'Test' });
      const response = await PUT(request);
      expect(response.status).toBe(500);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unexpected'));
      const request = makePutRequest({ id: 'doc-1' });
      const response = await PUT(request);
      expect(response.status).toBe(500);
    });

    it('should pass request to requireUser for CSRF validation', async () => {
      const supabase = authSuccess();
      const singleFn = vi.fn().mockResolvedValue({ data: {}, error: null });
      const selectFn = vi.fn().mockReturnValue({ single: singleFn });
      const eqUser = vi.fn().mockReturnValue({ select: selectFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      supabase.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqId }) });

      const request = makePutRequest({ id: 'doc-1', name: 'x' });
      await PUT(request);

      expect(mockRequireUser).toHaveBeenCalledWith(request);
    });
  });

  // ==========================================================================
  // DELETE /api/documents/user/files
  // ==========================================================================
  describe('DELETE', () => {
    it('should reject unauthenticated requests', async () => {
      authFailure();
      const request = makeRequest('/api/documents/user/files?id=doc-1', { method: 'DELETE' });
      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });

    it('should reject request without document ID', async () => {
      authSuccess();
      const request = makeRequest('/api/documents/user/files', { method: 'DELETE' });
      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Document ID is required');
    });

    it('should return not found when document does not exist', async () => {
      authSuccess();

      const singleFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqFn = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      mockServiceFrom.mockReturnValue({ select: selectFn });

      const request = makeRequest('/api/documents/user/files?id=nonexistent', { method: 'DELETE' });
      const response = await DELETE(request);
      expect(response.status).toBe(404);
    });

    it('should return not found when document belongs to another user', async () => {
      authSuccess();

      const singleFn = vi.fn().mockResolvedValue({
        data: { storage_path: 'other-user/doc/file.pdf', user_id: 'other-user-id' },
        error: null,
      });
      const eqFn = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      mockServiceFrom.mockReturnValue({ select: selectFn });

      const request = makeRequest('/api/documents/user/files?id=doc-1', { method: 'DELETE' });
      const response = await DELETE(request);
      expect(response.status).toBe(404);
    });

    it('should delete document, chunks, and storage on success', async () => {
      authSuccess();

      const storagePath = 'test-user-id/doc-1/file.pdf';

      // select to get document info
      const singleFn = vi.fn().mockResolvedValue({
        data: { storage_path: storagePath, user_id: TEST_USER_ID },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: selectEq });

      // delete chunks
      const deleteChunksEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChunksFn = vi.fn().mockReturnValue({ eq: deleteChunksEq });

      // delete document
      const deleteDocEq = vi.fn().mockResolvedValue({ error: null });
      const deleteDocFn = vi.fn().mockReturnValue({ eq: deleteDocEq });

      let callCount = 0;
      mockServiceFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'user_documents' && callCount === 1) {
          return { select: selectFn };
        }
        if (table === 'user_document_chunks') {
          return { delete: deleteChunksFn };
        }
        // user_documents delete (second call)
        return { delete: deleteDocFn };
      });

      mockStorageRemove.mockResolvedValue({ error: null });

      const request = makeRequest('/api/documents/user/files?id=doc-1', { method: 'DELETE' });
      const response = await DELETE(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.success).toBe(true);

      // Verify storage cleanup
      expect(mockStorageRemove).toHaveBeenCalledWith([storagePath]);
      // Verify chunks deleted
      expect(deleteChunksEq).toHaveBeenCalledWith('document_id', 'doc-1');
    });

    it('should return server error when final delete fails', async () => {
      authSuccess();

      const singleFn = vi.fn().mockResolvedValue({
        data: { storage_path: 'test/path', user_id: TEST_USER_ID },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: selectEq });

      const deleteChunksEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChunksFn = vi.fn().mockReturnValue({ eq: deleteChunksEq });

      const deleteDocEq = vi.fn().mockResolvedValue({ error: new Error('Delete failed') });
      const deleteDocFn = vi.fn().mockReturnValue({ eq: deleteDocEq });

      let callCount = 0;
      mockServiceFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'user_documents' && callCount === 1) {
          return { select: selectFn };
        }
        if (table === 'user_document_chunks') {
          return { delete: deleteChunksFn };
        }
        return { delete: deleteDocFn };
      });

      mockStorageRemove.mockResolvedValue({ error: null });

      const request = makeRequest('/api/documents/user/files?id=doc-1', { method: 'DELETE' });
      const response = await DELETE(request);
      expect(response.status).toBe(500);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unexpected'));
      const request = makeRequest('/api/documents/user/files?id=doc-1', { method: 'DELETE' });
      const response = await DELETE(request);
      expect(response.status).toBe(500);
    });

    it('should skip storage removal when storage_path is null', async () => {
      authSuccess();

      const singleFn = vi.fn().mockResolvedValue({
        data: { storage_path: null, user_id: TEST_USER_ID },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: selectEq });

      const deleteChunksEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChunksFn = vi.fn().mockReturnValue({ eq: deleteChunksEq });

      const deleteDocEq = vi.fn().mockResolvedValue({ error: null });
      const deleteDocFn = vi.fn().mockReturnValue({ eq: deleteDocEq });

      let callCount = 0;
      mockServiceFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'user_documents' && callCount === 1) {
          return { select: selectFn };
        }
        if (table === 'user_document_chunks') {
          return { delete: deleteChunksFn };
        }
        return { delete: deleteDocFn };
      });

      const request = makeRequest('/api/documents/user/files?id=doc-1', { method: 'DELETE' });
      const response = await DELETE(request);

      expect(response.status).toBe(200);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it('should pass request to requireUser for CSRF validation', async () => {
      authFailure();
      const request = makeRequest('/api/documents/user/files?id=doc-1', { method: 'DELETE' });
      await DELETE(request);
      expect(mockRequireUser).toHaveBeenCalledWith(request);
    });
  });
});
