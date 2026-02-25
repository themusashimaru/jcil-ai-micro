/**
 * Tests for readFileContent utility
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock FileReader
const mockFileReader = {
  readAsText: vi.fn(),
  readAsDataURL: vi.fn(),
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  result: null as string | null,
};

vi.stubGlobal(
  'FileReader',
  vi.fn(() => ({
    ...mockFileReader,
    readAsText: vi.fn(function (this: typeof mockFileReader) {
      this.result = 'file-text-content';
      if (this.onload) this.onload();
    }),
    readAsDataURL: vi.fn(function (this: typeof mockFileReader) {
      this.result = 'data:application/octet-stream;base64,ABC123';
      if (this.onload) this.onload();
    }),
    onload: null,
    onerror: null,
    result: null,
  }))
);

import { readFileContent } from './readFileContent';

function createFile(name: string, type: string, content = 'test'): File {
  return new File([content], name, { type });
}

describe('readFileContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSV files', () => {
    it('should read CSV files as text', async () => {
      const file = createFile('data.csv', 'text/csv');
      const result = await readFileContent(file);
      expect(result.content).toBe('file-text-content');
      expect(result.rawData).toBe('file-text-content');
    });

    it('should detect CSV by file extension', async () => {
      const file = createFile('data.csv', 'application/octet-stream');
      const result = await readFileContent(file);
      expect(result.content).toBe('file-text-content');
      expect(result.rawData).toBe('file-text-content');
    });
  });

  describe('plain text files', () => {
    it('should read plain text files', async () => {
      const file = createFile('notes.txt', 'text/plain');
      const result = await readFileContent(file);
      expect(result.content).toBe('file-text-content');
      expect(result.rawData).toBeUndefined();
    });
  });

  describe('Excel files', () => {
    it('should parse xlsx files and keep rawData', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parsedText: 'parsed spreadsheet data' }),
      });

      const file = createFile(
        'report.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const result = await readFileContent(file);

      expect(result.content).toBe('parsed spreadsheet data');
      expect(result.rawData).toBe('data:application/octet-stream;base64,ABC123');
      expect(mockFetch).toHaveBeenCalledWith('/api/files/parse', expect.any(Object));
    });

    it('should detect xls by extension', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parsedText: 'xls data' }),
      });

      const file = createFile('old.xls', 'application/octet-stream');
      const result = await readFileContent(file);
      expect(result.content).toBe('xls data');
      expect(result.rawData).toBeDefined();
    });

    it('should detect xls by mime type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parsedText: 'xls data' }),
      });

      const file = createFile('report', 'application/vnd.ms-excel');
      const result = await readFileContent(file);
      expect(result.content).toBe('xls data');
      expect(result.rawData).toBeDefined();
    });

    it('should fall back to base64 on parse failure for Excel', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Parse failed'));

      const file = createFile(
        'report.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const result = await readFileContent(file);

      expect(result.content).toBe('data:application/octet-stream;base64,ABC123');
      expect(result.rawData).toBe('data:application/octet-stream;base64,ABC123');
    });
  });

  describe('PDF files', () => {
    it('should parse PDF via API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parsedText: 'extracted PDF text' }),
      });

      const file = createFile('doc.pdf', 'application/pdf');
      const result = await readFileContent(file);

      expect(result.content).toBe('extracted PDF text');
      expect(result.rawData).toBeUndefined();
    });

    it('should fall back to base64 when API returns non-ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const file = createFile('doc.pdf', 'application/pdf');
      const result = await readFileContent(file);

      expect(result.content).toBe('data:application/octet-stream;base64,ABC123');
      expect(result.rawData).toBeUndefined();
    });

    it('should fall back to base64 when parsedText is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parsedText: '' }),
      });

      const file = createFile('doc.pdf', 'application/pdf');
      const result = await readFileContent(file);

      // Empty string is falsy, so it falls back to base64Content
      expect(result.content).toBe('data:application/octet-stream;base64,ABC123');
    });
  });

  describe('API request format', () => {
    it('should send correct payload to parse API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parsedText: 'parsed' }),
      });

      const file = createFile('test.pdf', 'application/pdf');
      await readFileContent(file);

      expect(mockFetch).toHaveBeenCalledWith('/api/files/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"fileName":"test.pdf"'),
      });
    });
  });
});
