/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TEST-002: Fetch URL Tool Tests
 *
 * Tests URL safety checks, HTML extraction, and tool configuration.
 * Mocks native fetch to avoid real HTTP requests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Access the module internals via the exported tool and executor
import { fetchUrlTool, isFetchUrlAvailable, executeFetchUrl } from './fetch-url';

describe('Fetch URL Tool', () => {
  describe('fetchUrlTool definition', () => {
    it('should have correct name', () => {
      expect(fetchUrlTool.name).toBe('fetch_url');
    });

    it('should require url parameter', () => {
      expect(fetchUrlTool.parameters.required).toContain('url');
    });

    it('should support text, links, and structured extract types', () => {
      const extractType = fetchUrlTool.parameters.properties.extract_type;
      expect(extractType.enum).toContain('text');
      expect(extractType.enum).toContain('links');
      expect(extractType.enum).toContain('structured');
    });
  });

  describe('isFetchUrlAvailable', () => {
    it('should always return true (uses native fetch)', () => {
      expect(isFetchUrlAvailable()).toBe(true);
    });
  });

  describe('executeFetchUrl', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should reject missing URL', async () => {
      const result = await executeFetchUrl({
        id: 'test-1',
        name: 'fetch_url',
        arguments: {},
      } as any);
      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/no url|url.*required|missing|invalid/i);
    });

    it('should reject blocked domains', async () => {
      const blockedUrls = [
        'https://example.gov/page',
        'https://site.mil/doc',
        'https://news.kp/article',
        'https://rt.com/news',
        'https://bad.onion/hidden',
        'https://pornsite.com/bad',
      ];

      for (const url of blockedUrls) {
        const result = await executeFetchUrl({
          id: 'test-blocked',
          name: 'fetch_url',
          arguments: { url },
        } as any);
        expect(result.isError).toBe(true);
        expect(result.content).toMatch(/blocked|denied|not allowed/i);
      }
    });

    it('should reject local/private network URLs', async () => {
      const localUrls = [
        'http://localhost:3000/api',
        'http://127.0.0.1:8080/admin',
        'http://192.168.1.1/router',
        'http://10.0.0.1/internal',
      ];

      for (const url of localUrls) {
        const result = await executeFetchUrl({
          id: 'test-local',
          name: 'fetch_url',
          arguments: { url },
        } as any);
        expect(result.isError).toBe(true);
        expect(result.content).toMatch(/local|private|blocked/i);
      }
    });

    it('should reject non-HTTP protocols', async () => {
      const result = await executeFetchUrl({
        id: 'test-proto',
        name: 'fetch_url',
        arguments: { url: 'ftp://example.com/file' },
      } as any);
      expect(result.isError).toBe(true);
    });

    // Helper to create mock response headers
    function mockHeaders(contentType: string) {
      return { get: (name: string) => (name === 'content-type' ? contentType : null) };
    }

    it('should successfully fetch HTML content', async () => {
      const longContent = 'This is test content. '.repeat(30); // Ensure > 500 chars
      const mockHtml = `<html><head><title>Test Page</title></head><body><article><h1>Hello World</h1><p>${longContent}</p></article></body></html>`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders('text/html'),
        text: () => Promise.resolve(mockHtml),
      });

      const result = await executeFetchUrl({
        id: 'test-ok',
        name: 'fetch_url',
        arguments: { url: 'https://example.com/article' },
      } as any);

      expect(result.isError).toBe(false);
      expect(result.content).toContain('Hello World');
      expect(result.content).toContain('test content');
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await executeFetchUrl({
        id: 'test-err',
        name: 'fetch_url',
        arguments: { url: 'https://unreachable-site.com' },
      } as any);

      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/error|failed|could not/i);
    });

    it('should handle HTTP error status codes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders(''),
      });

      const result = await executeFetchUrl({
        id: 'test-404',
        name: 'fetch_url',
        arguments: { url: 'https://example.com/missing' },
      } as any);

      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/404|not found|error/i);
    });

    it('should handle JSON content type', async () => {
      const jsonData = { key: 'value', nested: { a: 1 } };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders('application/json'),
        json: () => Promise.resolve(jsonData),
        text: () => Promise.resolve(JSON.stringify(jsonData)),
      });

      const result = await executeFetchUrl({
        id: 'test-json',
        name: 'fetch_url',
        arguments: { url: 'https://api.example.com/data' },
      } as any);

      expect(result.isError).toBe(false);
      expect(result.content).toContain('key');
      expect(result.content).toContain('value');
    });

    it('should return the tool call ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders('text/plain'),
        text: () => Promise.resolve('Plain text content'),
      });

      const result = await executeFetchUrl({
        id: 'unique-call-id',
        name: 'fetch_url',
        arguments: { url: 'https://example.com/text' },
      } as any);

      expect(result.toolCallId).toBe('unique-call-id');
    });
  });
});
