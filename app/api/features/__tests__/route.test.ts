import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return actual;
});

const { GET } = await import('../route');

describe('GET /api/features', () => {
  it('returns feature flags with correct values', async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.imageGeneration).toBe(false);
    expect(body.data.videoGeneration).toBe(false);
    expect(body.data.webSearch).toBe(true);
    expect(body.data.activeProvider).toBe('anthropic');
  });

  it('returns all expected feature keys', async () => {
    const response = await GET();
    const body = await response.json();
    const keys = Object.keys(body.data);
    expect(keys).toContain('imageGeneration');
    expect(keys).toContain('videoGeneration');
    expect(keys).toContain('webSearch');
    expect(keys).toContain('activeProvider');
  });

  it('always returns 200 status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
