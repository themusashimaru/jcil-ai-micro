import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeLinkShorten, isLinkShortenAvailable, linkShortenTool } from './link-shorten-tool';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'shorten_link', arguments: args };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('linkShortenTool metadata', () => {
  it('should have correct name', () => {
    expect(linkShortenTool.name).toBe('shorten_link');
  });

  it('should require url', () => {
    expect(linkShortenTool.parameters.required).toContain('url');
  });
});

describe('isLinkShortenAvailable', () => {
  it('should return true', () => {
    expect(isLinkShortenAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Successful shortening
// -------------------------------------------------------------------
describe('executeLinkShorten - success', () => {
  it('should shorten URL via TinyURL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('https://tinyurl.com/abc123'),
    });
    const res = await executeLinkShorten(makeCall({ url: 'https://example.com/very-long-url' }));
    const result = JSON.parse(res.content);
    expect(result.success).toBe(true);
    expect(result.shortUrl).toBe('https://tinyurl.com/abc123');
    expect(result.service).toBe('TinyURL');
    expect(result.originalUrl).toContain('example.com');
  });

  it('should fall back to is.gd when TinyURL fails', async () => {
    // TinyURL fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    // is.gd succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('https://is.gd/xyz789'),
    });
    const res = await executeLinkShorten(makeCall({ url: 'https://example.com/path' }));
    const result = JSON.parse(res.content);
    expect(result.success).toBe(true);
    expect(result.shortUrl).toBe('https://is.gd/xyz789');
    expect(result.service).toBe('is.gd');
  });

  it('should fall back to v.gd when both TinyURL and is.gd fail', async () => {
    // TinyURL fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    // is.gd fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    // v.gd succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('https://v.gd/short1'),
    });
    const res = await executeLinkShorten(makeCall({ url: 'https://example.com/path' }));
    const result = JSON.parse(res.content);
    expect(result.success).toBe(true);
    expect(result.service).toBe('v.gd');
  });

  it('should prepend https:// if protocol missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('https://tinyurl.com/abc'),
    });
    const res = await executeLinkShorten(makeCall({ url: 'example.com/page' }));
    const result = JSON.parse(res.content);
    expect(result.originalUrl).toBe('https://example.com/page');
  });
});

// -------------------------------------------------------------------
// All services fail
// -------------------------------------------------------------------
describe('executeLinkShorten - all fail', () => {
  it('should return error when all services fail', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const res = await executeLinkShorten(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Failed to shorten');
  });
});

// -------------------------------------------------------------------
// Input validation
// -------------------------------------------------------------------
describe('executeLinkShorten - validation', () => {
  it('should error without URL', async () => {
    const res = await executeLinkShorten(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should error with invalid URL', async () => {
    const res = await executeLinkShorten(makeCall({ url: 'not a url at all' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid URL');
  });

  it('should error with too-long URL', async () => {
    const res = await executeLinkShorten(
      makeCall({ url: 'https://example.com/' + 'a'.repeat(2000) })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('too long');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeLinkShorten - errors', () => {
  it('should return toolCallId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('https://tinyurl.com/abc'),
    });
    const res = await executeLinkShorten({
      id: 'my-id',
      name: 'shorten_link',
      arguments: { url: 'https://example.com' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
