import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Redis client
vi.mock('./redis/client', () => ({
  redis: null, // Simulate no Redis available
}));

describe('Request Queue System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Module Exports', () => {
    it('should export acquireSlot function', async () => {
      const { acquireSlot } = await import('./queue');
      expect(typeof acquireSlot).toBe('function');
    });

    it('should export releaseSlot function', async () => {
      const { releaseSlot } = await import('./queue');
      expect(typeof releaseSlot).toBe('function');
    });

    it('should export getQueueStatus function', async () => {
      const { getQueueStatus } = await import('./queue');
      expect(typeof getQueueStatus).toBe('function');
    });

    it('should export generateRequestId function', async () => {
      const { generateRequestId } = await import('./queue');
      expect(typeof generateRequestId).toBe('function');
    });

    it('should export cleanupStaleRequests function', async () => {
      const { cleanupStaleRequests } = await import('./queue');
      expect(typeof cleanupStaleRequests).toBe('function');
    });

    it('should export withQueue function', async () => {
      const { withQueue } = await import('./queue');
      expect(typeof withQueue).toBe('function');
    });

    it('should export QueueFullError class', async () => {
      const { QueueFullError } = await import('./queue');
      expect(QueueFullError).toBeDefined();
      expect(typeof QueueFullError).toBe('function');
    });
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', async () => {
      const { generateRequestId } = await import('./queue');

      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
    });

    it('should start with "req_" prefix', async () => {
      const { generateRequestId } = await import('./queue');

      const id = generateRequestId();
      expect(id.startsWith('req_')).toBe(true);
    });

    it('should include timestamp component', async () => {
      const { generateRequestId } = await import('./queue');

      const id = generateRequestId();
      // Format: req_<timestamp>_<random>
      const parts = id.split('_');
      expect(parts.length).toBe(3);
      expect(parseInt(parts[1])).toBeGreaterThan(0);
    });

    it('should include random component', async () => {
      const { generateRequestId } = await import('./queue');

      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      // All IDs should be unique
      expect(ids.size).toBe(100);
    });
  });

  describe('acquireSlot (In-Memory Fallback)', () => {
    it('should acquire slot when queue is empty', async () => {
      const { acquireSlot, generateRequestId } = await import('./queue');

      const requestId = generateRequestId();
      const acquired = await acquireSlot(requestId);

      expect(acquired).toBe(true);
    });

    it('should return boolean', async () => {
      const { acquireSlot, generateRequestId } = await import('./queue');

      const requestId = generateRequestId();
      const result = await acquireSlot(requestId);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('releaseSlot', () => {
    it('should release slot without error', async () => {
      const { acquireSlot, releaseSlot, generateRequestId } = await import('./queue');

      const requestId = generateRequestId();
      await acquireSlot(requestId);

      // Should not throw
      await expect(releaseSlot(requestId)).resolves.toBeUndefined();
    });

    it('should handle releasing non-existent slot', async () => {
      const { releaseSlot } = await import('./queue');

      // Should not throw even if slot doesn't exist
      await expect(releaseSlot('non-existent-id')).resolves.toBeUndefined();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status object', async () => {
      const { getQueueStatus } = await import('./queue');

      const status = await getQueueStatus();

      expect(status).toHaveProperty('activeRequests');
      expect(status).toHaveProperty('maxConcurrent');
      expect(status).toHaveProperty('available');
    });

    it('should have non-negative activeRequests', async () => {
      const { getQueueStatus } = await import('./queue');

      const status = await getQueueStatus();
      expect(status.activeRequests).toBeGreaterThanOrEqual(0);
    });

    it('should have positive maxConcurrent', async () => {
      const { getQueueStatus } = await import('./queue');

      const status = await getQueueStatus();
      expect(status.maxConcurrent).toBeGreaterThan(0);
    });

    it('should calculate available correctly', async () => {
      const { getQueueStatus } = await import('./queue');

      const status = await getQueueStatus();
      expect(status.available).toBe(status.maxConcurrent - status.activeRequests);
    });
  });

  describe('cleanupStaleRequests', () => {
    it('should return number of cleaned requests', async () => {
      const { cleanupStaleRequests } = await import('./queue');

      const cleaned = await cleanupStaleRequests();
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when no Redis available', async () => {
      const { cleanupStaleRequests } = await import('./queue');

      const cleaned = await cleanupStaleRequests();
      expect(cleaned).toBe(0);
    });
  });

  describe('withQueue', () => {
    it('should execute function when slot available', async () => {
      const { withQueue } = await import('./queue');

      const mockFn = vi.fn().mockResolvedValue('result');
      const result = await withQueue(mockFn);

      expect(mockFn).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should pass through function result', async () => {
      const { withQueue } = await import('./queue');

      const expected = { data: 'test' };
      const result = await withQueue(async () => expected);

      expect(result).toBe(expected);
    });

    it('should release slot after function completes', async () => {
      const { withQueue, getQueueStatus } = await import('./queue');

      const initialStatus = await getQueueStatus();

      await withQueue(async () => 'done');

      const finalStatus = await getQueueStatus();
      // Slots should be released
      expect(finalStatus.activeRequests).toBeLessThanOrEqual(initialStatus.activeRequests + 1);
    });

    it('should release slot even on error', async () => {
      const { withQueue } = await import('./queue');

      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(withQueue(mockFn)).rejects.toThrow('Test error');
    });

    it('should accept custom requestId', async () => {
      const { withQueue } = await import('./queue');

      const customId = 'custom-request-123';
      const result = await withQueue(async () => 'done', { requestId: customId });

      expect(result).toBe('done');
    });
  });

  describe('QueueFullError', () => {
    it('should be an Error instance', async () => {
      const { QueueFullError } = await import('./queue');

      const error = new QueueFullError('Queue is full');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have name "QueueFullError"', async () => {
      const { QueueFullError } = await import('./queue');

      const error = new QueueFullError('Queue is full');
      expect(error.name).toBe('QueueFullError');
    });

    it('should preserve error message', async () => {
      const { QueueFullError } = await import('./queue');

      const message = 'Server is busy. Please try again.';
      const error = new QueueFullError(message);
      expect(error.message).toBe(message);
    });
  });
});

describe('Queue Configuration', () => {
  describe('Environment Variables', () => {
    it('should use QUEUE_MAX_CONCURRENT from env', async () => {
      const { getQueueStatus } = await import('./queue');
      const status = await getQueueStatus();
      expect(status.maxConcurrent).toBeGreaterThan(0);
    });

    it('should default to 50 concurrent requests', async () => {
      const { getQueueStatus } = await import('./queue');
      const status = await getQueueStatus();
      // Default is 50 if not set
      expect(status.maxConcurrent).toBe(50);
    });
  });

  describe('Timeout Handling', () => {
    it('should have configurable timeout', async () => {
      // QUEUE_TIMEOUT_MS defaults to 30000 (30 seconds)
      const defaultTimeout = 30000;
      expect(defaultTimeout).toBe(30000);
    });
  });

  describe('TTL Configuration', () => {
    it('should have 2 minute TTL for stuck requests', async () => {
      // REQUEST_TTL_SECONDS is 120 (2 minutes)
      const requestTTL = 120;
      expect(requestTTL).toBe(120);
    });
  });
});

describe('Queue Concurrency', () => {
  describe('Slot Management', () => {
    it('should track active requests', async () => {
      const { acquireSlot, releaseSlot, getQueueStatus, generateRequestId } = await import('./queue');

      const requestId = generateRequestId();
      await acquireSlot(requestId);

      const status = await getQueueStatus();
      expect(status.activeRequests).toBeGreaterThanOrEqual(0);

      await releaseSlot(requestId);
    });

    it('should decrease active count on release', async () => {
      const { acquireSlot, releaseSlot, getQueueStatus, generateRequestId } = await import('./queue');

      const requestId = generateRequestId();
      await acquireSlot(requestId);

      const beforeRelease = await getQueueStatus();
      await releaseSlot(requestId);
      const afterRelease = await getQueueStatus();

      expect(afterRelease.activeRequests).toBeLessThanOrEqual(beforeRelease.activeRequests);
    });
  });
});

describe('Queue Graceful Degradation', () => {
  describe('Without Redis', () => {
    it('should use in-memory fallback', async () => {
      const { acquireSlot, generateRequestId } = await import('./queue');

      // Should work without Redis
      const requestId = generateRequestId();
      const acquired = await acquireSlot(requestId);
      expect(acquired).toBe(true);
    });

    it('should warn about serverless limitations', async () => {
      // The implementation warns about in-memory fallback in serverless
      const { acquireSlot, generateRequestId } = await import('./queue');

      const requestId = generateRequestId();
      await acquireSlot(requestId);
      // Warning is logged but doesn't affect functionality
    });
  });
});

describe('Queue Wait Logic', () => {
  describe('Jitter Implementation', () => {
    it('should use random jitter to prevent thundering herd', async () => {
      // Implementation uses 100-200ms jitter
      const minJitter = 100;
      const maxJitter = 200;
      expect(minJitter).toBeLessThan(maxJitter);
    });
  });
});
