import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHttpRequest, isHttpRequestAvailable, httpRequestTool } from './http-request-tool';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'http_request', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockFetch.mockReset();
});

function mockFetchSuccess(data: string, status = 200, contentType = 'text/plain') {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Map([
      ['content-type', contentType],
      ['content-length', String(data.length)],
    ]) as unknown as Headers,
    text: () => Promise.resolve(data),
    json: () => Promise.resolve(JSON.parse(data)),
  });
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('httpRequestTool metadata', () => {
  it('should have correct name', () => {
    expect(httpRequestTool.name).toBe('http_request');
  });

  it('should require url', () => {
    expect(httpRequestTool.parameters.required).toContain('url');
  });
});

describe('isHttpRequestAvailable', () => {
  it('should return true', () => {
    expect(isHttpRequestAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Basic request
// -------------------------------------------------------------------
describe('executeHttpRequest - basic', () => {
  it('should make a GET request', async () => {
    mockFetchSuccess('Hello World');
    const res = await executeHttpRequest(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('HTTP GET');
    expect(res.content).toContain('200');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should make a POST request with JSON body', async () => {
    mockFetchSuccess('{"ok": true}', 200, 'application/json');
    const res = await executeHttpRequest(
      makeCall({
        url: 'https://example.com/api',
        method: 'POST',
        body: { key: 'value' },
      })
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('HTTP POST');
    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe('{"key":"value"}');
  });

  it('should support raw body', async () => {
    mockFetchSuccess('ok');
    await executeHttpRequest(
      makeCall({
        url: 'https://example.com/api',
        method: 'POST',
        body_raw: 'raw data',
      })
    );
    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.body).toBe('raw data');
  });

  it('should support custom headers', async () => {
    mockFetchSuccess('ok');
    await executeHttpRequest(
      makeCall({
        url: 'https://example.com',
        headers: { Authorization: 'Bearer token123' },
      })
    );
    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.headers.Authorization).toBe('Bearer token123');
  });

  it('should support custom content type', async () => {
    mockFetchSuccess('ok');
    await executeHttpRequest(
      makeCall({
        url: 'https://example.com',
        method: 'POST',
        body_raw: 'x=1',
        content_type: 'application/x-www-form-urlencoded',
      })
    );
    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });
});

// -------------------------------------------------------------------
// URL safety checks
// -------------------------------------------------------------------
describe('executeHttpRequest - URL safety', () => {
  it('should block localhost', async () => {
    const res = await executeHttpRequest(makeCall({ url: 'http://localhost:3000/secret' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Blocked');
  });

  it('should block 127.0.0.1', async () => {
    const res = await executeHttpRequest(makeCall({ url: 'http://127.0.0.1/secret' }));
    expect(res.isError).toBe(true);
  });

  it('should block private 10.x.x.x', async () => {
    const res = await executeHttpRequest(makeCall({ url: 'http://10.0.0.1/internal' }));
    expect(res.isError).toBe(true);
  });

  it('should block private 192.168.x.x', async () => {
    const res = await executeHttpRequest(makeCall({ url: 'http://192.168.1.1/admin' }));
    expect(res.isError).toBe(true);
  });

  it('should block private 172.16-31.x.x', async () => {
    const res = await executeHttpRequest(makeCall({ url: 'http://172.16.0.1/internal' }));
    expect(res.isError).toBe(true);
  });

  it('should block AWS metadata', async () => {
    const res = await executeHttpRequest(
      makeCall({ url: 'http://169.254.169.254/latest/meta-data/' })
    );
    expect(res.isError).toBe(true);
  });

  it('should block .local domains', async () => {
    const res = await executeHttpRequest(makeCall({ url: 'http://myservice.local/api' }));
    expect(res.isError).toBe(true);
  });

  it('should block .internal domains', async () => {
    const res = await executeHttpRequest(makeCall({ url: 'http://myservice.internal/api' }));
    expect(res.isError).toBe(true);
  });

  it('should block metadata.google', async () => {
    const res = await executeHttpRequest(
      makeCall({ url: 'http://metadata.google.internal/computeMetadata/v1/' })
    );
    expect(res.isError).toBe(true);
  });

  it('should allow public URLs', async () => {
    mockFetchSuccess('ok');
    const res = await executeHttpRequest(makeCall({ url: 'https://api.example.com/data' }));
    expect(res.isError).toBeFalsy();
  });
});

// -------------------------------------------------------------------
// Input validation
// -------------------------------------------------------------------
describe('executeHttpRequest - validation', () => {
  it('should error without URL', async () => {
    const res = await executeHttpRequest(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('URL');
  });

  it('should error with invalid method', async () => {
    const res = await executeHttpRequest(
      makeCall({ url: 'https://example.com', method: 'INVALID' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid HTTP method');
  });

  it('should error for wrong tool name', async () => {
    const res = await executeHttpRequest({
      id: 'test',
      name: 'wrong_tool',
      arguments: { url: 'https://example.com' },
    });
    expect(res.isError).toBe(true);
  });

  it('should handle string arguments', async () => {
    mockFetchSuccess('ok');
    const res = await executeHttpRequest({
      id: 'test',
      name: 'http_request',
      arguments: JSON.stringify({ url: 'https://example.com' }),
      sessionId: 'test-session',
    });
    expect(res.isError).toBeFalsy();
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeHttpRequest - errors', () => {
  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const res = await executeHttpRequest(makeCall({ url: 'https://unreachable.example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Network error');
  });

  it('should return toolCallId', async () => {
    mockFetchSuccess('ok');
    const res = await executeHttpRequest({
      id: 'my-id',
      name: 'http_request',
      arguments: { url: 'https://example.com' },
      sessionId: 'test-session',
    });
    expect(res.toolCallId).toBe('my-id');
  });

  it('should handle non-OK status', async () => {
    mockFetchSuccess('Not Found', 404);
    const res = await executeHttpRequest(makeCall({ url: 'https://example.com/missing' }));
    expect(res.content).toContain('404');
  });
});
