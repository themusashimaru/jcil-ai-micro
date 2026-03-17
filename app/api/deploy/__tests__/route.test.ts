import { describe, it, expect } from 'vitest';

const { POST } = await import('../route');

describe('POST /api/deploy', () => {
  it('returns 410 Gone with deprecation message', async () => {
    const request = new Request('http://localhost/api/deploy', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toContain('Composio connectors');
    expect(body.code).toBe('USE_COMPOSIO_CONNECTOR');
  });

  it('returns 410 regardless of request body content', async () => {
    const request = new Request('http://localhost/api/deploy', {
      method: 'POST',
      body: JSON.stringify({ projectName: 'my-app', framework: 'next' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(410);
  });

  it('includes guidance about Composio connectors in error', async () => {
    const request = new Request('http://localhost/api/deploy', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(body.error).toContain('Connectors panel');
  });
});
