// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ========================================
// MOCKS
// ========================================

// Mock logger
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

// Mock ExcelJS
const mockEachSheet = vi.fn();
const mockXlsxLoad = vi.fn();
vi.mock('exceljs', () => {
  return {
    default: {
      Workbook: class {
        worksheets = [];
        xlsx = {
          load: (...args: unknown[]) => mockXlsxLoad(...args),
        };
        eachSheet = (...args: unknown[]) => mockEachSheet(...args);
      },
    },
  };
});

// Mock unpdf
const mockExtractText = vi.fn();
const mockGetDocumentProxy = vi.fn();
vi.mock('unpdf', () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
  getDocumentProxy: (...args: unknown[]) => mockGetDocumentProxy(...args),
}));

// ========================================
// HELPERS
// ========================================

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/files/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const fakeUser = {
  authorized: true,
  user: { id: 'user-123', email: 'test@example.com' },
  supabase: {},
};

const unauthorizedResponse = {
  authorized: false,
  response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
};

// ========================================
// TESTS
// ========================================

// Import after mocks
import { POST } from './route';

describe('POST /api/files/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue(fakeUser);
  });

  // ---- Auth guard ----

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockRequireUser.mockResolvedValue(unauthorizedResponse);

      const req = createRequest({
        fileName: 'test.txt',
        fileType: 'text/plain',
        content: 'hello',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('passes the request to requireUser for CSRF validation', async () => {
      const req = createRequest({
        fileName: 'test.txt',
        fileType: 'text/plain',
        content: 'hello',
      });

      await POST(req);
      expect(mockRequireUser).toHaveBeenCalledWith(req);
    });
  });

  // ---- Input validation ----

  describe('input validation', () => {
    it('returns 400 when content is empty', async () => {
      const req = createRequest({
        fileName: 'test.txt',
        fileType: 'text/plain',
        content: '',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('No file content provided');
    });

    it('returns 400 when content is missing', async () => {
      const req = createRequest({
        fileName: 'test.txt',
        fileType: 'text/plain',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('No file content provided');
    });

    it('returns 400 for unsupported file types', async () => {
      const req = createRequest({
        fileName: 'test.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: 'some-content',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Unsupported file type');
    });
  });

  // ---- Plain text parsing ----

  describe('text/plain files', () => {
    it('returns the content as-is for plain text', async () => {
      const textContent = 'Hello, this is a plain text file.\nLine 2.';
      const req = createRequest({
        fileName: 'readme.txt',
        fileType: 'text/plain',
        content: textContent,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toBe(textContent);
      expect(data.data.fileName).toBe('readme.txt');
      expect(data.data.fileType).toBe('text/plain');
      expect(data.data.charCount).toBe(textContent.length);
    });
  });

  // ---- CSV parsing ----

  describe('text/csv files', () => {
    it('returns the CSV content as-is', async () => {
      const csvContent = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
      const req = createRequest({
        fileName: 'data.csv',
        fileType: 'text/csv',
        content: csvContent,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toBe(csvContent);
      expect(data.data.fileName).toBe('data.csv');
      expect(data.data.fileType).toBe('text/csv');
      expect(data.data.charCount).toBe(csvContent.length);
    });
  });

  // ---- Excel parsing ----

  describe('Excel files', () => {
    const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const xlsType = 'application/vnd.ms-excel';
    const fakeBase64 = 'data:application/vnd.ms-excel;base64,AAAA';

    it('parses .xlsx files via ExcelJS', async () => {
      // Set up mock: eachSheet calls the callback with a worksheet
      mockXlsxLoad.mockResolvedValue(undefined);
      mockEachSheet.mockImplementation((cb) => {
        const mockRow = {
          values: [undefined, 'Name', 'Age'],
          getCell: () => ({ font: { bold: true } }),
        };
        cb({
          name: 'Sheet1',
          columns: [{ width: 15 }, { width: 10 }],
          eachRow: (rowCb) => {
            rowCb(mockRow, 1);
          },
        });
      });

      const req = createRequest({
        fileName: 'data.xlsx',
        fileType: xlsxType,
        content: fakeBase64,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toContain('Sheet1');
      expect(data.data.parsedText).toContain('Name');
      expect(data.data.fileName).toBe('data.xlsx');
    });

    it('also handles application/vnd.ms-excel type', async () => {
      mockXlsxLoad.mockResolvedValue(undefined);
      mockEachSheet.mockImplementation((cb) => {
        cb({
          name: 'Data',
          columns: [],
          eachRow: () => {},
        });
      });

      const req = createRequest({
        fileName: 'legacy.xls',
        fileType: xlsType,
        content: fakeBase64,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toContain('Data');
    });

    it('returns 500 when Excel parsing fails', async () => {
      mockXlsxLoad.mockRejectedValue(new Error('Corrupt file'));

      const req = createRequest({
        fileName: 'bad.xlsx',
        fileType: xlsxType,
        content: fakeBase64,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to parse file');
    });

    it('extracts style info from Excel when extractStyle is true', async () => {
      // For parseExcel call
      mockXlsxLoad.mockResolvedValue(undefined);
      mockEachSheet.mockImplementation((cb) => {
        const mockRow = {
          values: [undefined, 'Revenue', '$1,000.00'],
          getCell: () => ({ font: { bold: true } }),
        };
        cb({
          name: 'Financial',
          columns: [{ width: 20 }, { width: 15 }],
          eachRow: (rowCb) => {
            rowCb(mockRow, 1);
          },
        });
      });

      const req = createRequest({
        fileName: 'report.xlsx',
        fileType: xlsxType,
        content: fakeBase64,
        extractStyle: true,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.styleInfo).toBeDefined();
      expect(data.data.styleInfo.sheets).toBeInstanceOf(Array);
    });

    it('continues without style if style extraction fails', async () => {
      // The first call to eachSheet (parseExcel) works
      // The second call (extractExcelStyle) will fail because mockXlsxLoad rejects on 2nd call
      let callCount = 0;
      mockXlsxLoad.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(undefined);
        return Promise.reject(new Error('Style extraction error'));
      });
      mockEachSheet.mockImplementation((cb) => {
        cb({
          name: 'Sheet1',
          columns: [],
          eachRow: () => {},
        });
      });

      const req = createRequest({
        fileName: 'report.xlsx',
        fileType: xlsxType,
        content: fakeBase64,
        extractStyle: true,
      });

      const res = await POST(req);
      const data = await res.json();

      // Should succeed even if style extraction fails
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toContain('Sheet1');
    });
  });

  // ---- PDF parsing ----

  describe('PDF files', () => {
    const pdfType = 'application/pdf';
    const fakeBase64Pdf = 'data:application/pdf;base64,JVBERi0=';

    it('parses PDF files and returns text with page count', async () => {
      mockGetDocumentProxy.mockResolvedValue({ numPages: 3 });
      mockExtractText.mockResolvedValue({
        text: 'This is page one content. Page two content here.',
      });

      const req = createRequest({
        fileName: 'document.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toContain('Pages: 3');
      expect(data.data.parsedText).toContain('page one content');
      expect(data.data.fileName).toBe('document.pdf');
      expect(data.data.fileType).toBe(pdfType);
    });

    it('returns graceful error message when PDF parsing fails', async () => {
      mockGetDocumentProxy.mockRejectedValue(new Error('Invalid PDF'));

      const req = createRequest({
        fileName: 'corrupt.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
      });

      const res = await POST(req);
      const data = await res.json();

      // parsePDF catches errors and returns a graceful message rather than throwing
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toContain('PDF text extraction encountered an error');
    });

    it('extracts PDF style info when extractStyle is true', async () => {
      const pdfText =
        'Invoice\n\nBill To: John Doe\nAmount Due: $500\nPayment Terms: Net 30\n\nItem | | Qty | | Price\n';
      mockGetDocumentProxy.mockResolvedValue({ numPages: 1 });
      mockExtractText.mockResolvedValue({ text: pdfText });

      const req = createRequest({
        fileName: 'invoice.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
        extractStyle: true,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.styleInfo).toBeDefined();
      expect(data.data.styleInfo.estimatedLayout).toBe('invoice');
      expect(data.data.styleInfo.pageCount).toBe(1);
      expect(data.data.styleInfo.hasTable).toBe(true);
    });

    it('detects resume layout', async () => {
      const resumeText =
        'EXPERIENCE\nSenior Developer at Acme Corp\n\nEDUCATION\nBS Computer Science\n\nSKILLS\nJavaScript, TypeScript';
      mockGetDocumentProxy.mockResolvedValue({ numPages: 1 });
      mockExtractText.mockResolvedValue({ text: resumeText });

      const req = createRequest({
        fileName: 'resume.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
        extractStyle: true,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.styleInfo.estimatedLayout).toBe('resume');
    });

    it('detects letter layout', async () => {
      const letterText = 'Dear Mr. Smith,\n\nI am writing to...\n\nSincerely,\nJane Doe';
      mockGetDocumentProxy.mockResolvedValue({ numPages: 1 });
      mockExtractText.mockResolvedValue({ text: letterText });

      const req = createRequest({
        fileName: 'letter.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
        extractStyle: true,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.styleInfo.estimatedLayout).toBe('letter');
    });

    it('detects memo layout', async () => {
      const memoText =
        'MEMO\n\nTo: All Staff\nFrom: Management\nRe: Policy Update\n\nContent here.';
      mockGetDocumentProxy.mockResolvedValue({ numPages: 1 });
      mockExtractText.mockResolvedValue({ text: memoText });

      const req = createRequest({
        fileName: 'memo.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
        extractStyle: true,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.styleInfo.estimatedLayout).toBe('memo');
    });

    it('detects bullet points in PDF', async () => {
      const bulletText = 'Overview\n\n• Item one\n• Item two\n• Item three';
      mockGetDocumentProxy.mockResolvedValue({ numPages: 1 });
      mockExtractText.mockResolvedValue({ text: bulletText });

      const req = createRequest({
        fileName: 'notes.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
        extractStyle: true,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.styleInfo.hasBulletPoints).toBe(true);
    });

    it('handles null text from extractText', async () => {
      mockGetDocumentProxy.mockResolvedValue({ numPages: 2 });
      mockExtractText.mockResolvedValue({ text: null });

      const req = createRequest({
        fileName: 'empty.pdf',
        fileType: pdfType,
        content: fakeBase64Pdf,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data.parsedText).toContain('Pages: 2');
    });
  });

  // ---- Response structure ----

  describe('response structure', () => {
    it('includes success flag, fileName, fileType, parsedText, and charCount', async () => {
      const req = createRequest({
        fileName: 'test.txt',
        fileType: 'text/plain',
        content: 'hello world',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.ok).toBe(true);
      expect(data.data).toEqual({
        success: true,
        fileName: 'test.txt',
        fileType: 'text/plain',
        parsedText: 'hello world',
        charCount: 11,
      });
    });

    it('does not include styleInfo when extractStyle is not requested', async () => {
      const req = createRequest({
        fileName: 'test.txt',
        fileType: 'text/plain',
        content: 'hello',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.data.styleInfo).toBeUndefined();
    });
  });

  // ---- Error handling ----

  describe('error handling', () => {
    it('returns 500 if request.json() throws', async () => {
      const req = new NextRequest('http://localhost:3000/api/files/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{{{',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to parse file');
    });
  });
});
