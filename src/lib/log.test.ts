/* eslint-disable no-console */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logEvent,
  logRequestStart,
  logRequestEnd,
  logError,
  logImageGeneration,
  logVideoGeneration,
  hashParams,
} from './log';

describe('logEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output a JSON string with type=telemetry', () => {
    logEvent({ user_id: 'u-123', model: 'sonnet' });
    expect(console.log).toHaveBeenCalledTimes(1);
    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.type).toBe('telemetry');
    expect(logged.user_id).toBe('u-123');
    expect(logged.model).toBe('sonnet');
    expect(logged.ts).toBeTypeOf('number');
  });

  it('should include all provided fields', () => {
    logEvent({
      user_id: 'u-1',
      tool_name: 'web_search',
      tokens_in: 100,
      tokens_out: 200,
      ok: true,
      cached: true,
    });
    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.tool_name).toBe('web_search');
    expect(logged.tokens_in).toBe(100);
    expect(logged.tokens_out).toBe(200);
    expect(logged.ok).toBe(true);
    expect(logged.cached).toBe(true);
  });

  it('should handle empty event', () => {
    logEvent({});
    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.type).toBe('telemetry');
    expect(logged.ts).toBeTypeOf('number');
  });
});

describe('logRequestStart', () => {
  it('should return an object with startTime and context', () => {
    const before = Date.now();
    const result = logRequestStart({
      user_id: 'u-123',
      model: 'opus',
    });
    const after = Date.now();

    expect(result.startTime).toBeGreaterThanOrEqual(before);
    expect(result.startTime).toBeLessThanOrEqual(after);
    expect(result.context.user_id).toBe('u-123');
    expect(result.context.model).toBe('opus');
  });

  it('should accept partial context', () => {
    const result = logRequestStart({ tool_name: 'run_code' });
    expect(result.context.tool_name).toBe('run_code');
    expect(result.context.user_id).toBeUndefined();
  });
});

describe('logRequestEnd', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log combined tracker context and result', () => {
    const tracker = {
      startTime: Date.now() - 500,
      context: { user_id: 'u-1', model: 'sonnet' },
    };

    logRequestEnd(tracker, {
      ok: true,
      tokens_in: 100,
      tokens_out: 50,
    });

    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.user_id).toBe('u-1');
    expect(logged.model).toBe('sonnet');
    expect(logged.ok).toBe(true);
    expect(logged.tokens_in).toBe(100);
    expect(logged.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('should include error info when ok=false', () => {
    const tracker = {
      startTime: Date.now(),
      context: { user_id: 'u-1' },
    };

    logRequestEnd(tracker, {
      ok: false,
      err_code: 'TIMEOUT',
      err_message: 'Request timed out',
    });

    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.ok).toBe(false);
    expect(logged.err_code).toBe('TIMEOUT');
    expect(logged.err_message).toBe('Request timed out');
  });
});

describe('logError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log Error instances with name and message', () => {
    const error = new TypeError('Cannot read property x');
    logError(error, { user_id: 'u-1', operation: 'fetch' });

    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.ok).toBe(false);
    expect(logged.err_code).toBe('TypeError');
    expect(logged.err_message).toBe('Cannot read property x');
    expect(logged.user_id).toBe('u-1');
  });

  it('should convert non-Error values to string', () => {
    logError('string error', { operation: 'test' });

    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.err_message).toBe('string error');
  });

  it('should convert number errors to string', () => {
    logError(42, { operation: 'test' });

    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.err_message).toBe('42');
  });
});

describe('logImageGeneration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log image billing event', () => {
    logImageGeneration('u-1', 'dall-e-3', '1024x1024', 0.04, true, 2500);

    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.type).toBe('image_billing');
    expect(logged.user_id).toBe('u-1');
    expect(logged.model).toBe('dall-e-3');
    expect(logged.size).toBe('1024x1024');
    expect(logged.cost).toBe(0.04);
    expect(logged.ok).toBe(true);
    expect(logged.latency_ms).toBe(2500);
  });
});

describe('logVideoGeneration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log video billing event', () => {
    logVideoGeneration('u-1', 'sora', '1080p', 10, 0.5, true, 30000);

    const logged = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(logged.type).toBe('video_billing');
    expect(logged.user_id).toBe('u-1');
    expect(logged.model).toBe('sora');
    expect(logged.size).toBe('1080p');
    expect(logged.seconds).toBe(10);
    expect(logged.cost).toBe(0.5);
    expect(logged.ok).toBe(true);
  });
});

describe('hashParams', () => {
  it('should return a 16-char hex string', () => {
    const hash = hashParams({ query: 'hello world' });
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should produce same hash for same input', () => {
    const hash1 = hashParams({ a: 1, b: 'test' });
    const hash2 = hashParams({ a: 1, b: 'test' });
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different input', () => {
    const hash1 = hashParams({ a: 1 });
    const hash2 = hashParams({ a: 2 });
    expect(hash1).not.toBe(hash2);
  });

  it('should strip sensitive fields before hashing', () => {
    // These two should produce the same hash because sensitive fields are removed
    const hash1 = hashParams({ query: 'test' });
    const hash2 = hashParams({ query: 'test', token: 'secret-123' });
    expect(hash1).toBe(hash2);
  });

  it('should strip api_key, password, and secret', () => {
    const hashBase = hashParams({ data: 'value' });
    expect(hashParams({ data: 'value', api_key: 'key' })).toBe(hashBase);
    expect(hashParams({ data: 'value', password: 'pass' })).toBe(hashBase);
    expect(hashParams({ data: 'value', secret: 'shhh' })).toBe(hashBase);
  });

  it('should handle empty object', () => {
    const hash = hashParams({});
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});
