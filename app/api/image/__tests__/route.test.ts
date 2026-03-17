import { describe, it, expect } from 'vitest';

const { POST, GET } = await import('../route');

describe('POST /api/image', () => {
  it('returns 410 Gone with discontinuation message', async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe('Feature discontinued');
    expect(body.message).toContain('discontinued');
  });

  it('suggests alternative features in the message', async () => {
    const response = await POST();
    const body = await response.json();
    expect(body.message).toContain('AI chat');
  });
});

describe('GET /api/image', () => {
  it('returns 410 Gone with discontinuation message', async () => {
    const response = await GET();
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe('Feature discontinued');
  });

  it('includes discontinuation notice', async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.message).toContain('discontinued');
  });
});
