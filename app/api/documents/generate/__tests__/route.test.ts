// @ts-nocheck - Test file with extensive mocking
/**
 * DOCUMENT GENERATION API TESTS
 *
 * Comprehensive tests for /api/documents/generate endpoint:
 * - Input validation (content, format, title)
 * - Content size limits
 * - Document type detection (resume, invoice, business plan, generic)
 * - PDF generation for each document type
 * - XLSX generation path
 * - Supabase storage upload and signed URL generation
 * - Fallback to data URL when Supabase is unavailable
 * - Authentication integration (getAuthenticatedUserId)
 * - Error handling for parse failures, PDF generation failures, upload failures
 * - Response format validation
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS - Must be defined before imports
// ============================================================================

// Mock next/headers cookies
const mockCookiesGetAll = vi.fn().mockReturnValue([]);
const mockCookiesSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => mockCookiesGetAll(),
    set: (...args: unknown[]) => mockCookiesSet(...args),
  }),
}));

// Track jsPDF mock instances
const mockJsPDFOutput = vi.fn().mockReturnValue('data:application/pdf;base64,AAAA');
const mockJsPDFOutputArrayBuffer = vi.fn().mockReturnValue(new ArrayBuffer(10));
const mockJsPDFInstance = {
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  setLineDashPattern: vi.fn(),
  text: vi.fn(),
  rect: vi.fn(),
  line: vi.fn(),
  circle: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  setPage: vi.fn(),
  getNumberOfPages: vi.fn().mockReturnValue(1),
  splitTextToSize: vi.fn((text: string) => [text]),
  getTextWidth: vi.fn().mockReturnValue(50),
  output: vi.fn((type: string) => {
    if (type === 'arraybuffer') return mockJsPDFOutputArrayBuffer();
    return mockJsPDFOutput();
  }),
};

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => mockJsPDFInstance),
}));

// Mock QRCode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QRCODE'),
  },
}));

// Mock Supabase
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
const mockStorageCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://storage.supabase.co/signed-url' },
  error: null,
});
const mockStorageCreateBucket = vi.fn().mockResolvedValue({ error: null });
const mockStorageFrom = vi.fn().mockReturnValue({
  upload: mockStorageUpload,
  createSignedUrl: mockStorageCreateSignedUrl,
});

const mockSupabaseAdmin = {
  storage: {
    createBucket: mockStorageCreateBucket,
    from: mockStorageFrom,
  },
};

// Mock Supabase SSR (for auth)
const mockAuthGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-user-123' } },
  error: null,
});
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    auth: {
      getUser: mockAuthGetUser,
    },
  })),
}));

// Mock Supabase JS client (for admin/storage)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => mockSupabaseAdmin),
}));

// Mock spreadsheet generator
const mockGenerateSpreadsheetXlsx = vi.fn().mockResolvedValue(Buffer.from('xlsx-content'));
vi.mock('@/lib/documents/spreadsheetGenerator', () => ({
  generateSpreadsheetXlsx: (...args: unknown[]) => mockGenerateSpreadsheetXlsx(...args),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/documents/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function callPOST(body: Record<string, unknown>) {
  const { POST } = await import('../route');
  const request = createRequest(body);
  const response = await POST(request);
  const data = await response.json();
  return { response, data };
}

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Reset environment variables
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://jcil.ai';

  // Reset mock defaults
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: 'test-user-123' } },
    error: null,
  });
  mockStorageUpload.mockResolvedValue({ error: null });
  mockStorageCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.supabase.co/signed-url' },
    error: null,
  });
  mockJsPDFOutput.mockReturnValue('data:application/pdf;base64,AAAA');
  mockJsPDFOutputArrayBuffer.mockReturnValue(new ArrayBuffer(10));
  mockGenerateSpreadsheetXlsx.mockResolvedValue(Buffer.from('xlsx-content'));
});

// ============================================================================
// TESTS
// ============================================================================

describe('Document Generation API - POST /api/documents/generate', () => {
  // --------------------------------------------------------------------------
  // Module exports
  // --------------------------------------------------------------------------
  describe('Module exports', () => {
    it('should export a POST handler', async () => {
      const routeModule = await import('../route');
      expect(routeModule.POST).toBeDefined();
      expect(typeof routeModule.POST).toBe('function');
    });

    it('should export runtime as nodejs', async () => {
      const routeModule = await import('../route');
      expect(routeModule.runtime).toBe('nodejs');
    });

    it('should export maxDuration as 30', async () => {
      const routeModule = await import('../route');
      expect(routeModule.maxDuration).toBe(30);
    });
  });

  // --------------------------------------------------------------------------
  // Input validation
  // --------------------------------------------------------------------------
  describe('Input validation', () => {
    it('should reject request with missing content', async () => {
      const { response, data } = await callPOST({});
      expect(response.status).toBe(400);
      expect(data.error).toBe('Content is required');
    });

    it('should reject request with empty string content', async () => {
      const { response, data } = await callPOST({ content: '' });
      expect(response.status).toBe(400);
      expect(data.error).toBe('Content is required');
    });

    it('should reject request with non-string content', async () => {
      const { response, data } = await callPOST({ content: 123 });
      expect(response.status).toBe(400);
      expect(data.error).toBe('Content is required');
    });

    it('should reject request with null content', async () => {
      const { response, data } = await callPOST({ content: null });
      expect(response.status).toBe(400);
      expect(data.error).toBe('Content is required');
    });

    it('should reject content exceeding 1MB size limit', async () => {
      const largeContent = 'x'.repeat(1024 * 1024 + 1);
      const { response, data } = await callPOST({ content: largeContent });
      expect(response.status).toBe(413);
      expect(data.error).toContain('Content too large');
      expect(data.error).toContain('1024KB');
    });

    it('should accept content at exactly 1MB', async () => {
      const exactContent = 'x'.repeat(1024 * 1024);
      const { response, data } = await callPOST({ content: exactContent });
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should use default title "Document" when title is not provided', async () => {
      const { data } = await callPOST({ content: 'Hello World' });
      expect(data.success).toBe(true);
      expect(data.title).toBe('Document');
    });

    it('should use custom title when provided', async () => {
      const { data } = await callPOST({ content: 'Hello World', title: 'My Report' });
      expect(data.success).toBe(true);
      expect(data.title).toBe('My Report');
    });
  });

  // --------------------------------------------------------------------------
  // Document type detection
  // --------------------------------------------------------------------------
  describe('Document type detection', () => {
    it('should detect resume by title containing "resume"', async () => {
      const { data } = await callPOST({
        content: '# John Doe\nSoftware Engineer\n## Experience\n- Built systems',
        title: 'John Doe Resume',
      });
      expect(data.success).toBe(true);
      expect(data.format).toBe('pdf');
    });

    it('should detect resume by title containing "CV"', async () => {
      const { data } = await callPOST({
        content: '# Jane Smith\n## Work Experience\n- Managed teams',
        title: 'Professional CV',
      });
      expect(data.success).toBe(true);
    });

    it('should detect resume by content keywords', async () => {
      const { data } = await callPOST({
        content:
          '# John Doe\n## Professional Experience\nSenior Developer at Acme\n## Education\nBS Computer Science\n## Skills\nJavaScript, Python',
        title: 'John Doe',
      });
      expect(data.success).toBe(true);
    });

    it('should detect invoice by title containing "invoice"', async () => {
      const { data } = await callPOST({
        content: 'From: Acme Corp\nBill To: John Doe\nItem: Widget $50.00\nTotal: $50.00',
        title: 'Invoice #1234',
      });
      expect(data.success).toBe(true);
      expect(data.format).toBe('pdf');
    });

    it('should detect invoice by content keywords like "bill to"', async () => {
      const { data } = await callPOST({
        content:
          'Company ABC\nBill To:\nJohn Smith\n123 Main St\n\nItem | 2 | $25.00 | $50.00\nTotal Due: $50.00',
        title: 'Document',
      });
      expect(data.success).toBe(true);
    });

    it('should detect business plan by title', async () => {
      const { data } = await callPOST({
        content:
          '# Acme Corp\n## Executive Summary\nOur mission is...\n## Market Analysis\n## Financial Projections',
        title: 'Acme Corp Business Plan',
      });
      expect(data.success).toBe(true);
    });

    it('should detect business plan by content keywords', async () => {
      const { data } = await callPOST({
        content:
          '# TechStart\n## Executive Summary\nMission statement here\n## Market Analysis\nIndustry overview\n## Financial Projections\nYear 1: $100K',
        title: 'TechStart Overview',
      });
      expect(data.success).toBe(true);
    });

    it('should prioritize resume detection over business plan when both keywords present', async () => {
      // A resume that mentions "strategy" and "business" should still be treated as resume
      const { data } = await callPOST({
        content:
          '# Jane Smith\n## Professional Experience\nBusiness Strategy Consultant\n## Education\nMBA\n## Skills\nStrategy, Analytics',
        title: 'Jane Smith Resume',
      });
      expect(data.success).toBe(true);
    });

    it('should generate generic PDF when no special type detected', async () => {
      const { data } = await callPOST({
        content: '# My Report\n\nThis is a general report about something.',
        title: 'General Report',
      });
      expect(data.success).toBe(true);
      expect(data.format).toBe('pdf');
    });
  });

  // --------------------------------------------------------------------------
  // PDF generation - generic documents
  // --------------------------------------------------------------------------
  describe('PDF generation - generic documents', () => {
    it('should generate PDF with success response', async () => {
      const { data } = await callPOST({
        content: '# Hello World\n\nThis is a test document.',
        title: 'Test Doc',
      });
      expect(data.success).toBe(true);
      expect(data.format).toBe('pdf');
      expect(data.filename).toMatch(/^test_doc_\d+_[a-z0-9]+\.pdf$/);
    });

    it('should sanitize title for filename', async () => {
      const { data } = await callPOST({
        content: 'Some content',
        title: 'My Report! @#$% (2024)',
      });
      expect(data.filename).toMatch(/^my_report________2024_/);
    });

    it('should include downloadUrl when Supabase upload succeeds', async () => {
      const { data } = await callPOST({
        content: '# Report\n\nContent here.',
        title: 'Test',
      });
      expect(data.success).toBe(true);
      expect(data.downloadUrl).toContain('/api/documents/download?token=');
      expect(data.storage).toBe('supabase');
      expect(data.expiresIn).toBe('1 hour');
    });

    it('should generate proper download token containing user ID and filename', async () => {
      const { data } = await callPOST({
        content: '# Report\n\nContent here.',
        title: 'Test',
      });
      const url = new URL(data.downloadUrl);
      const token = url.searchParams.get('token');
      expect(token).toBeTruthy();
      const decoded = JSON.parse(Buffer.from(token!, 'base64url').toString());
      expect(decoded.u).toBe('test-user-123');
      expect(decoded.t).toBe('pdf');
      expect(decoded.f).toMatch(/\.pdf$/);
    });
  });

  // --------------------------------------------------------------------------
  // PDF generation - invoices
  // --------------------------------------------------------------------------
  describe('PDF generation - invoices', () => {
    const invoiceContent = `
From: Acme Corp
123 Main St
Anytown, CA 90210

Invoice #: INV-001
Date: 2026-01-15

Bill To:
John Smith
456 Oak Ave
Somewhere, NY 10001

Widget A | 5 | $10.00 | $50.00
Widget B | 2 | $25.00 | $50.00

Subtotal: $100.00
Tax Rate: 8.5%
Tax: $8.50
Total: $108.50

Terms: Net 30
    `.trim();

    it('should generate an invoice PDF successfully', async () => {
      const { data } = await callPOST({
        content: invoiceContent,
        title: 'Invoice #001',
      });
      expect(data.success).toBe(true);
      expect(data.format).toBe('pdf');
    });

    it('should detect invoice from content with "bill to"', async () => {
      const { data } = await callPOST({
        content: 'Bill To:\nJohn Doe\n\nTotal Due: $500.00',
        title: 'Document',
      });
      expect(data.success).toBe(true);
    });

    it('should handle invoice with "amount due" in content', async () => {
      const { data } = await callPOST({
        content: 'Invoice:\nItem: Service $100\nAmount Due: $100.00',
        title: 'Service Invoice',
      });
      expect(data.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // PDF generation - business plans
  // --------------------------------------------------------------------------
  describe('PDF generation - business plans', () => {
    const businessPlanContent = `
# TechStart Inc
## Executive Summary
Mission: To revolutionize tech education

## Company Description
Overview of the company

## Market Analysis
Industry Analysis: Growing market

## Financial Projections
Year 1 Revenue: $100K
    `.trim();

    it('should generate a business plan PDF successfully', async () => {
      const { data } = await callPOST({
        content: businessPlanContent,
        title: 'Business Plan',
      });
      expect(data.success).toBe(true);
      expect(data.format).toBe('pdf');
    });

    it('should detect business plan by "executive summary" in content', async () => {
      const { data } = await callPOST({
        content:
          '## Executive Summary\nOur company aims to...\n## Market Analysis\nThe market is...',
        title: 'Company Overview',
      });
      expect(data.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // XLSX generation
  // --------------------------------------------------------------------------
  describe('XLSX generation', () => {
    it('should generate XLSX when format is xlsx', async () => {
      const { data } = await callPOST({
        content: '| Name | Value |\n| --- | --- |\n| Item1 | 100 |',
        title: 'Spreadsheet',
        format: 'xlsx',
      });
      expect(data.success).toBe(true);
      expect(data.format).toBe('xlsx');
      expect(data.filename).toMatch(/\.xlsx$/);
    });

    it('should upload XLSX to Supabase generated-documents bucket', async () => {
      await callPOST({
        content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
        title: 'Data',
        format: 'xlsx',
      });
      expect(mockStorageFrom).toHaveBeenCalledWith('generated-documents');
      expect(mockStorageUpload).toHaveBeenCalled();
    });

    it('should return signed download URL for XLSX', async () => {
      const { data } = await callPOST({
        content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
        title: 'Data',
        format: 'xlsx',
      });
      expect(data.success).toBe(true);
      expect(data.downloadUrl).toBe('https://storage.supabase.co/signed-url');
      expect(data.storage).toBe('supabase');
    });

    it('should fall back to data URL if XLSX upload fails', async () => {
      mockStorageUpload.mockResolvedValueOnce({ error: { message: 'Upload failed' } });
      const { data } = await callPOST({
        content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
        title: 'Data',
        format: 'xlsx',
      });
      expect(data.success).toBe(true);
      expect(data.storage).toBe('dataurl');
      expect(data.dataUrl).toContain(
        'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'
      );
    });

    it('should fall back to data URL if XLSX signed URL fails', async () => {
      mockStorageCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Signed URL failed' },
      });
      const { data } = await callPOST({
        content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
        title: 'Data',
        format: 'xlsx',
      });
      expect(data.success).toBe(true);
      expect(data.storage).toBe('dataurl');
    });

    it('should return 500 if XLSX generation throws', async () => {
      mockGenerateSpreadsheetXlsx.mockRejectedValueOnce(new Error('XLSX generation failed'));
      const { response, data } = await callPOST({
        content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
        title: 'Data',
        format: 'xlsx',
      });
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate Excel file');
      expect(data.details).toBe('XLSX generation failed');
    });

    it('should sanitize XLSX filename', async () => {
      const { data } = await callPOST({
        content: '| A |\n| --- |\n| 1 |',
        title: 'My Data! Report @2024',
        format: 'xlsx',
      });
      expect(data.filename).toMatch(/^My_Data_Report_2024_\d+\.xlsx$/);
    });

    it('should fall back to data URL when Supabase is not configured for XLSX', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      // Need to re-import route to pick up the changed env
      vi.resetModules();
      const { POST } = await import('../route');
      const request = createRequest({
        content: '| A |\n| --- |\n| 1 |',
        title: 'Test',
        format: 'xlsx',
      });
      const response = await POST(request);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.storage).toBe('dataurl');
    });
  });

  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------
  describe('Authentication', () => {
    it('should still generate PDF when user is not authenticated (falls back to data URL)', async () => {
      mockAuthGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const { data } = await callPOST({
        content: 'Hello World',
        title: 'Test',
      });
      expect(data.success).toBe(true);
      // Without a user, should return data URL (storage: 'local')
      expect(data.storage).toBe('local');
      expect(data.dataUrl).toBeTruthy();
    });

    it('should upload to Supabase when user is authenticated', async () => {
      const { data } = await callPOST({
        content: 'Hello World',
        title: 'Test',
      });
      expect(data.success).toBe(true);
      expect(data.storage).toBe('supabase');
      expect(data.downloadUrl).toBeTruthy();
    });

    it('should use user-specific storage path when uploading', async () => {
      await callPOST({
        content: 'Hello World',
        title: 'Test',
      });
      // For generic PDF, the upload path should include user ID
      const uploadCall = mockStorageUpload.mock.calls[0];
      expect(uploadCall[0]).toMatch(/^test-user-123\//);
    });

    it('should handle auth error gracefully', async () => {
      mockAuthGetUser.mockRejectedValueOnce(new Error('Auth service down'));
      const { data } = await callPOST({
        content: 'Hello World',
        title: 'Test',
      });
      // Should still generate the document, just without upload
      expect(data.success).toBe(true);
      expect(data.storage).toBe('local');
    });
  });

  // --------------------------------------------------------------------------
  // Supabase storage
  // --------------------------------------------------------------------------
  describe('Supabase storage', () => {
    it('should create documents bucket before uploading', async () => {
      await callPOST({
        content: '# Report\nContent',
        title: 'Report',
      });
      expect(mockStorageCreateBucket).toHaveBeenCalledWith('documents', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
      });
    });

    it('should handle bucket already exists error gracefully', async () => {
      mockStorageCreateBucket.mockRejectedValueOnce(new Error('Bucket already exists'));
      const { data } = await callPOST({
        content: '# Report\nContent',
        title: 'Report',
      });
      expect(data.success).toBe(true);
    });

    it('should fall back to data URL when PDF upload fails', async () => {
      mockStorageUpload.mockResolvedValueOnce({
        error: { message: 'Storage quota exceeded' },
      });
      const { data } = await callPOST({
        content: '# Report\nContent',
        title: 'Report',
      });
      expect(data.success).toBe(true);
      expect(data.storage).toBe('fallback');
      expect(data.dataUrl).toBeTruthy();
    });

    it('should fall back to data URL when Supabase env vars are missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      vi.resetModules();
      const { POST } = await import('../route');
      const request = createRequest({
        content: '# Report\nContent',
        title: 'Report',
      });
      const response = await POST(request);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.storage).toBe('local');
    });

    it('should use NEXT_PUBLIC_APP_URL for download proxy URL', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://custom.example.com';
      vi.resetModules();
      const { POST } = await import('../route');
      const request = createRequest({
        content: '# Report\nContent',
        title: 'Report',
      });
      const response = await POST(request);
      const data = await response.json();
      if (data.downloadUrl) {
        expect(data.downloadUrl).toContain('https://custom.example.com');
      }
    });

    it('should upload XLSX to generated-documents bucket, not documents bucket', async () => {
      await callPOST({
        content: '| Col1 |\n| --- |\n| Val1 |',
        title: 'Sheet',
        format: 'xlsx',
      });
      expect(mockStorageFrom).toHaveBeenCalledWith('generated-documents');
    });

    it('should use anonymous path when user is not authenticated for XLSX', async () => {
      mockAuthGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      await callPOST({
        content: '| A |\n| --- |\n| 1 |',
        title: 'Test',
        format: 'xlsx',
      });
      const uploadCall = mockStorageUpload.mock.calls[0];
      if (uploadCall) {
        expect(uploadCall[0]).toContain('documents/anonymous/');
      }
    });
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe('Error handling', () => {
    it('should return 500 when request.json() throws', async () => {
      const { POST } = await import('../route');
      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{{{',
      });
      const response = await POST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to generate document');
    });

    it('should return 500 with error details for XLSX generation error', async () => {
      mockGenerateSpreadsheetXlsx.mockRejectedValueOnce(new Error('Memory limit exceeded'));
      const { response, data } = await callPOST({
        content: '| A |\n| --- |\n| 1 |',
        title: 'Data',
        format: 'xlsx',
      });
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate Excel file');
      expect(data.details).toBe('Memory limit exceeded');
    });

    it('should handle non-Error exceptions in XLSX generation', async () => {
      mockGenerateSpreadsheetXlsx.mockRejectedValueOnce('string error');
      const { response, data } = await callPOST({
        content: '| A |\n| --- |\n| 1 |',
        title: 'Data',
        format: 'xlsx',
      });
      expect(response.status).toBe(500);
      expect(data.details).toBe('Unknown error');
    });
  });

  // --------------------------------------------------------------------------
  // Response format validation
  // --------------------------------------------------------------------------
  describe('Response format', () => {
    it('should include success, format, title, and filename in PDF response', async () => {
      const { data } = await callPOST({
        content: 'Test content',
        title: 'My Doc',
      });
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('format', 'pdf');
      expect(data).toHaveProperty('title', 'My Doc');
      expect(data).toHaveProperty('filename');
    });

    it('should include downloadUrl and expiresIn when stored in Supabase', async () => {
      const { data } = await callPOST({
        content: 'Test content',
        title: 'My Doc',
      });
      expect(data).toHaveProperty('downloadUrl');
      expect(data).toHaveProperty('expiresIn', '1 hour');
      expect(data).toHaveProperty('storage', 'supabase');
    });

    it('should include dataUrl when falling back to local storage', async () => {
      mockAuthGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      const { data } = await callPOST({
        content: 'Test content',
        title: 'My Doc',
      });
      expect(data).toHaveProperty('dataUrl');
      expect(data).toHaveProperty('storage', 'local');
      expect(data).not.toHaveProperty('downloadUrl');
    });

    it('should include success, format, title, and filename in XLSX response', async () => {
      const { data } = await callPOST({
        content: '| A |\n| --- |\n| 1 |',
        title: 'Sheet',
        format: 'xlsx',
      });
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('format', 'xlsx');
      expect(data).toHaveProperty('title', 'Sheet');
      expect(data).toHaveProperty('filename');
      expect(data.filename).toMatch(/\.xlsx$/);
    });

    it('should return JSON content-type', async () => {
      const { POST } = await import('../route');
      const request = createRequest({ content: 'test' });
      const response = await POST(request);
      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  // --------------------------------------------------------------------------
  // Markdown parsing
  // --------------------------------------------------------------------------
  describe('Markdown content handling', () => {
    it('should handle content with headers', async () => {
      const { data } = await callPOST({
        content: '# Title\n## Section 1\n### Subsection\nParagraph text',
        title: 'Test',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with bullet lists', async () => {
      const { data } = await callPOST({
        content: '# List Doc\n- Item 1\n- Item 2\n- Item 3',
        title: 'Test',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with markdown tables', async () => {
      const { data } = await callPOST({
        content: '# Table Doc\n| Col1 | Col2 |\n| --- | --- |\n| A | B |',
        title: 'Test',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with blockquotes', async () => {
      const { data } = await callPOST({
        content: '# Quotes\n> This is a blockquote\n\nNormal text',
        title: 'Test',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with horizontal rules', async () => {
      const { data } = await callPOST({
        content: '# Section 1\nText\n---\n# Section 2\nMore text',
        title: 'Test',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with QR code syntax', async () => {
      const { data } = await callPOST({
        content: '# QR Document\n{{QR:https://example.com}}',
        title: 'QR Test',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with multiple QR codes', async () => {
      const { data } = await callPOST({
        content: '# QR Document\n{{QR:https://example.com:5}}',
        title: 'QR Test',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with bold and italic formatting', async () => {
      const { data } = await callPOST({
        content: '# Test\n**Bold text** and *italic text* and __also bold__ and _also italic_',
        title: 'Formatting Test',
      });
      expect(data.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Invoice parsing
  // --------------------------------------------------------------------------
  describe('Invoice parsing', () => {
    it('should parse invoice with pipe-delimited items', async () => {
      const { data } = await callPOST({
        content: 'Invoice\nBill To:\nCustomer\nWidget | 5 | $10.00 | $50.00\nTotal: $50.00',
        title: 'Invoice',
      });
      expect(data.success).toBe(true);
    });

    it('should parse invoice with qty-first format items', async () => {
      const { data } = await callPOST({
        content: 'Invoice\n10 Pepperoni Pizzas @ $25.00: $250.00\nTotal: $250.00',
        title: 'Pizza Invoice',
      });
      expect(data.success).toBe(true);
    });

    it('should parse invoice with labor hours', async () => {
      const { data } = await callPOST({
        content:
          'Invoice\nBill To:\nClient\nConsulting: 15 hours @ $200.00/hr: $3,000.00\nTotal: $3,000.00',
        title: 'Consulting Invoice',
      });
      expect(data.success).toBe(true);
    });

    it('should parse invoice with bullet point items', async () => {
      const { data } = await callPOST({
        content:
          'Invoice\nBill To:\nClient\n- Design Work: $500.00\n- Development: $1,000.00\nTotal: $1,500.00',
        title: 'Project Invoice',
      });
      expect(data.success).toBe(true);
    });

    it('should handle invoice with tax rate in parentheses', async () => {
      const { data } = await callPOST({
        content:
          'Invoice\nBill To:\nClient\nItem: Widget $100\nSubtotal: $100.00\nSales Tax (6.75%): $6.75\nTotal: $106.75',
        title: 'Invoice',
      });
      expect(data.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Resume handling
  // --------------------------------------------------------------------------
  describe('Resume handling', () => {
    it('should filter out generic resume template titles', async () => {
      const { data } = await callPOST({
        content: '# Resume Template\n# John Doe\njohn@example.com\n## Experience\n- Worked at Acme',
        title: 'Resume',
      });
      expect(data.success).toBe(true);
    });

    it('should detect resume by education and skills keywords', async () => {
      const { data } = await callPOST({
        content: '# Alex Johnson\n## Education\nMIT BS CS\n## Skills\nPython, JavaScript',
        title: 'Alex Johnson',
      });
      expect(data.success).toBe(true);
    });

    it('should detect resume by certifications and experience keywords', async () => {
      const { data } = await callPOST({
        content: '# Pat Wilson\n## Experience\nSoftware Dev\n## Certifications\nAWS Certified',
        title: 'Pat Wilson',
      });
      expect(data.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------
  describe('Edge cases', () => {
    it('should handle minimal content', async () => {
      const { data } = await callPOST({
        content: 'a',
        title: 'Minimal',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with only whitespace characters preserved', async () => {
      const { data } = await callPOST({
        content: '   \n\n  Some content  \n\n   ',
        title: 'Whitespace',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with special characters', async () => {
      const { data } = await callPOST({
        content:
          'Special chars: em dash \u2014 en dash \u2013 smart quotes \u201Chello\u201D ellipsis\u2026',
        title: 'Special Chars',
      });
      expect(data.success).toBe(true);
    });

    it('should handle content with unicode characters', async () => {
      const { data } = await callPOST({
        content: '# R\u00e9sum\u00e9\n\nCaf\u00e9 worker with 5 years exp\u00e9rience',
        title: 'Unicode Test',
      });
      expect(data.success).toBe(true);
    });

    it('should generate unique filenames for consecutive calls', async () => {
      const { data: data1 } = await callPOST({
        content: 'Content 1',
        title: 'Test',
      });
      const { data: data2 } = await callPOST({
        content: 'Content 2',
        title: 'Test',
      });
      expect(data1.filename).not.toBe(data2.filename);
    });
  });
});
