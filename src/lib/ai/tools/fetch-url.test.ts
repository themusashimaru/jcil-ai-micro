/**
 * FETCH URL TOOL TESTS
 *
 * Tests for the URL content fetcher tool:
 * - URL safety validation (blocked domains, protocols, private IPs)
 * - HTML text extraction
 * - Link extraction
 * - Error handling (timeouts, 404s, 403s)
 * - Tool executor behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeFetchUrl, fetchUrlTool, isFetchUrlAvailable } from './fetch-url';
import type { UnifiedToolCall } from '../providers/types';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper to create a tool call
function makeToolCall(args: Record<string, unknown>): UnifiedToolCall {
  return {
    id: `call-${Date.now()}`,
    name: 'fetch_url',
    arguments: args,
  };
}

// Helper to create a mock Response
function mockResponse(body: string, options: { status?: number; contentType?: string } = {}) {
  const { status = 200, contentType = 'text/html' } = options;
  return new Response(body, {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'content-type': contentType },
  });
}

describe('Fetch URL Tool', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(fetchUrlTool.name).toBe('fetch_url');
    });

    it('should have a description', () => {
      expect(fetchUrlTool.description).toBeTruthy();
      expect(fetchUrlTool.description.length).toBeGreaterThan(10);
    });

    it('should require url parameter', () => {
      expect(fetchUrlTool.parameters.required).toContain('url');
    });

    it('should support extract_type parameter', () => {
      const props = fetchUrlTool.parameters.properties as Record<string, unknown>;
      expect(props.extract_type).toBeDefined();
    });
  });

  describe('isFetchUrlAvailable', () => {
    it('should always return true (uses native fetch)', () => {
      expect(isFetchUrlAvailable()).toBe(true);
    });
  });

  describe('URL Safety', () => {
    it('should block .gov domains', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'https://www.whitehouse.gov' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('blocked');
    });

    it('should block .mil domains', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'https://www.defense.mil' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('blocked');
    });

    it('should block sanctioned nation TLDs', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.kp' }));
      expect(result.isError).toBe(true);
    });

    it('should block .onion domains', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'https://hidden.onion/page' }));
      expect(result.isError).toBe(true);
    });

    it('should block localhost', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'http://localhost:3000' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('local');
    });

    it('should block private IP ranges (192.168.x.x)', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'http://192.168.1.1' }));
      expect(result.isError).toBe(true);
    });

    it('should block 127.0.0.1', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'http://127.0.0.1:8080' }));
      expect(result.isError).toBe(true);
    });

    it('should block 10.x.x.x private IPs', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'http://10.0.0.1/admin' }));
      expect(result.isError).toBe(true);
    });

    it('should block state media domains', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'https://rt.com/news' }));
      expect(result.isError).toBe(true);
    });

    it('should block ftp:// protocol', async () => {
      const result = await executeFetchUrl(makeToolCall({ url: 'ftp://files.example.com/data' }));
      expect(result.isError).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should return error when no URL provided', async () => {
      const result = await executeFetchUrl(makeToolCall({}));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('No URL');
    });

    it('should add https:// prefix when protocol missing', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse('<html><body><p>Hello World</p></body></html>'));

      const result = await executeFetchUrl(makeToolCall({ url: 'example.com' }));
      expect(result.isError).toBe(false);

      // Should have been called with https:// prefix
      expect(global.fetch).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should reject wrong tool name', async () => {
      const call: UnifiedToolCall = {
        id: 'test-1',
        name: 'wrong_tool',
        arguments: { url: 'https://example.com' },
      };
      const result = await executeFetchUrl(call);
      expect(result.isError).toBe(true);
      expect(result.content).toContain('Unknown tool');
    });

    it('should handle string arguments gracefully', async () => {
      const call: UnifiedToolCall = {
        id: 'test-1',
        name: 'fetch_url',
        arguments: 'not an object' as unknown as Record<string, unknown>,
      };
      const result = await executeFetchUrl(call);
      expect(result.isError).toBe(true);
    });
  });

  describe('HTML Content Extraction', () => {
    it('should extract text from simple HTML', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(`
          <html>
          <head><title>Test Page</title></head>
          <body>
            <p>Hello World</p>
            <p>This is a test.</p>
          </body>
          </html>
        `)
      );

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('Test Page');
      expect(result.content).toContain('Hello World');
      expect(result.content).toContain('This is a test');
    });

    it('should strip script and style tags', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(`
          <html><body>
            <script>alert('xss')</script>
            <style>body { color: red; }</style>
            <p>Safe content</p>
          </body></html>
        `)
      );

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('Safe content');
      expect(result.content).not.toContain('alert');
      expect(result.content).not.toContain('color: red');
    });

    it('should strip nav, header, footer, aside elements', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(`
          <html><body>
            <nav>Navigation items</nav>
            <header>Site header</header>
            <main><p>Main content</p></main>
            <footer>Footer text</footer>
            <aside>Sidebar ad</aside>
          </body></html>
        `)
      );

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('Main content');
      expect(result.content).not.toContain('Navigation items');
      expect(result.content).not.toContain('Site header');
      expect(result.content).not.toContain('Footer text');
      expect(result.content).not.toContain('Sidebar ad');
    });

    it('should convert headers to markdown', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(`
          <html><body>
            <h1>Title</h1>
            <h2>Subtitle</h2>
            <h3>Section</h3>
            <p>Content here</p>
          </body></html>
        `)
      );

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('# Title');
      expect(result.content).toContain('## Subtitle');
      expect(result.content).toContain('### Section');
    });

    it('should decode HTML entities', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(`
          <html><body>
            <p>Tom &amp; Jerry &mdash; best &copy; show</p>
          </body></html>
        `)
      );

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('Tom & Jerry');
    });

    it('should extract meta description', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(`
          <html>
          <head>
            <title>Page Title</title>
            <meta name="description" content="A great description">
          </head>
          <body><p>Body text</p></body>
          </html>
        `)
      );

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('A great description');
    });
  });

  describe('Link Extraction', () => {
    it('should extract links when extract_type is "links"', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(`
          <html><body>
            <a href="https://example.com/page1">Page One</a>
            <a href="https://example.com/page2">Page Two</a>
            <a href="/relative">Relative Link</a>
          </body></html>
        `)
      );

      const result = await executeFetchUrl(
        makeToolCall({ url: 'https://example.com', extract_type: 'links' })
      );
      expect(result.isError).toBe(false);
      expect(result.content).toContain('Page One');
      expect(result.content).toContain('Page Two');
    });

    it('should report when no links found', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse('<html><body><p>No links here</p></body></html>'));

      const result = await executeFetchUrl(
        makeToolCall({ url: 'https://example.com', extract_type: 'links' })
      );
      expect(result.isError).toBe(false);
      expect(result.content).toContain('No links');
    });
  });

  describe('HTTP Error Handling', () => {
    it('should handle 403 Forbidden', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse('Forbidden', { status: 403 }));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com/private' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('403');
    });

    it('should handle 404 Not Found', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse('Not Found', { status: 404 }));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com/missing' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('404');
    });

    it('should handle 429 Rate Limited', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse('Too Many Requests', { status: 429 }));

      const result = await executeFetchUrl(
        makeToolCall({ url: 'https://example.com/rate-limited' })
      );
      expect(result.isError).toBe(true);
      expect(result.content).toContain('429');
    });

    it('should handle 500 Server Error', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse('Internal Server Error', { status: 500 }));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com/broken' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('500');
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(JSON.stringify({ key: 'value', num: 42 }), {
          contentType: 'application/json',
        })
      );

      const result = await executeFetchUrl(makeToolCall({ url: 'https://api.example.com/data' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('key');
      expect(result.content).toContain('value');
      expect(result.content).toContain('json');
    });

    it('should handle plain text content', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse('Just plain text here', { contentType: 'text/plain' }));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com/robots.txt' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('Just plain text here');
    });

    it('should reject unsupported content types', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse('binary data', { contentType: 'application/pdf' }));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com/doc.pdf' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('Unsupported content type');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle DNS resolution failures', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND example.invalid'));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.invalid/page' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('resolve domain');
    });

    it('should handle connection refused', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 1.2.3.4:443'));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://down-server.com' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('refused');
    });

    it('should handle timeout / abort errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted'));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://slow-server.com' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('timed out');
    });

    it('should handle generic fetch errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Something unexpected'));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(true);
      expect(result.content).toContain('Something unexpected');
    });
  });

  describe('Content Truncation', () => {
    it('should truncate very long content', async () => {
      const longContent = 'A'.repeat(100000);
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse(`<html><body><p>${longContent}</p></body></html>`));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com' }));
      expect(result.isError).toBe(false);
      // The content should be truncated (MAX_CONTENT_LENGTH is 50000)
      expect(result.content!.length).toBeLessThanOrEqual(60000); // Allow some overhead for metadata
      expect(result.content).toContain('truncated');
    });
  });

  describe('Source URL Attribution', () => {
    it('should include source URL in text extraction', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse('<html><body><p>Content</p></body></html>'));

      const result = await executeFetchUrl(makeToolCall({ url: 'https://example.com/article' }));
      expect(result.isError).toBe(false);
      expect(result.content).toContain('Source: https://example.com/article');
    });
  });
});
