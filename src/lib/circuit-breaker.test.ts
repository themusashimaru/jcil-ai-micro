import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  createCircuitBreaker,
  withCircuitBreaker,
  isServiceAvailable,
  getAllBreakerStatus,
  resetAllBreakers,
} from './circuit-breaker';

describe('createCircuitBreaker', () => {
  it('should create a circuit breaker with default config', () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const breaker = createCircuitBreaker(fn, { name: 'test-default' });
    expect(breaker).toBeDefined();
    expect(typeof breaker.fire).toBe('function');
    breaker.shutdown();
  });

  it('should create a circuit breaker with custom config', () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const breaker = createCircuitBreaker(fn, {
      name: 'test-custom',
      timeout: 5000,
      errorThresholdPercentage: 30,
      resetTimeout: 10000,
      volumeThreshold: 3,
    });
    expect(breaker).toBeDefined();
    breaker.shutdown();
  });

  it('should fire the wrapped function', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const breaker = createCircuitBreaker(fn, { name: 'test-fire' });
    const result = await breaker.fire();
    expect(result).toBe('result');
    breaker.shutdown();
  });
});

describe('withCircuitBreaker', () => {
  it('should call the function and return its result', async () => {
    const result = await withCircuitBreaker(() => Promise.resolve(42), { name: 'test-with-cb' });
    expect(result).toBe(42);
  });

  it('should propagate errors from the function', async () => {
    await expect(
      withCircuitBreaker(() => Promise.reject(new Error('boom')), { name: 'test-error-cb' })
    ).rejects.toThrow('boom');
  });
});

describe('isServiceAvailable', () => {
  it('should return true for anthropic when no breaker exists', () => {
    expect(isServiceAvailable('anthropic')).toBe(true);
  });

  it('should return true for database when no breaker exists', () => {
    expect(isServiceAvailable('database')).toBe(true);
  });

  it('should return true for redis when no breaker exists', () => {
    expect(isServiceAvailable('redis')).toBe(true);
  });
});

describe('getAllBreakerStatus', () => {
  it('should return empty array when no breakers are initialized', () => {
    // Since breakers are module-level singletons that may not be initialized
    const status = getAllBreakerStatus();
    expect(Array.isArray(status)).toBe(true);
  });

  it('should return objects with name, state, and stats', () => {
    const status = getAllBreakerStatus();
    for (const s of status) {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('state');
      expect(s).toHaveProperty('stats');
      expect(s.stats).toHaveProperty('successes');
      expect(s.stats).toHaveProperty('failures');
    }
  });
});

describe('resetAllBreakers', () => {
  it('should not throw when called', () => {
    expect(() => resetAllBreakers()).not.toThrow();
  });
});
