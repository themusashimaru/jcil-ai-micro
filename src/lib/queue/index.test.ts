import { describe, it, expect, vi } from 'vitest';

// ============================================
// MOCKS — must appear BEFORE imports
// ============================================

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    getJob: vi.fn(),
    getWaitingCount: vi.fn(),
    getActiveCount: vi.fn(),
    getCompletedCount: vi.fn(),
    getFailedCount: vi.fn(),
    getDelayedCount: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clean: vi.fn(),
    close: vi.fn(),
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
  })),
  Worker: vi
    .fn()
    .mockImplementation((name: string, _processor: unknown, opts: Record<string, unknown>) => ({
      name,
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      isRunning: vi.fn().mockReturnValue(true),
      opts: { concurrency: (opts && opts.concurrency) || 1 },
    })),
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@upstash/qstash', () => ({
  Client: vi.fn().mockImplementation(() => ({
    publishJSON: vi.fn(),
  })),
  Receiver: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scard: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(0),
  })),
}));

vi.mock('@/lib/redis/client', () => ({
  redis: null,
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/anthropic/client', () => ({
  createAnthropicCompletion: vi.fn(),
  createAnthropicCompletionWithSearch: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

// ============================================
// TESTS
// ============================================

describe('queue/index barrel exports', () => {
  describe('Simple queue exports (from ../queue)', () => {
    it('should export acquireSlot function', async () => {
      const mod = await import('./index');
      expect(typeof mod.acquireSlot).toBe('function');
    });

    it('should export releaseSlot function', async () => {
      const mod = await import('./index');
      expect(typeof mod.releaseSlot).toBe('function');
    });

    it('should export getQueueStatus function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getQueueStatus).toBe('function');
    });

    it('should export generateRequestId function', async () => {
      const mod = await import('./index');
      expect(typeof mod.generateRequestId).toBe('function');
    });

    it('should export cleanupStaleRequests function', async () => {
      const mod = await import('./index');
      expect(typeof mod.cleanupStaleRequests).toBe('function');
    });

    it('should export withQueue function', async () => {
      const mod = await import('./index');
      expect(typeof mod.withQueue).toBe('function');
    });

    it('should export QueueFullError class', async () => {
      const mod = await import('./index');
      expect(mod.QueueFullError).toBeDefined();
      const err = new mod.QueueFullError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('QueueFullError');
      expect(err.message).toBe('test');
    });
  });

  describe('BullMQ exports (from ./bull-queue)', () => {
    it('should export getChatQueue function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getChatQueue).toBe('function');
    });

    it('should export getCodeLabQueue function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getCodeLabQueue).toBe('function');
    });

    it('should export getChatQueueEvents function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getChatQueueEvents).toBe('function');
    });

    it('should export isBullMQAvailable function', async () => {
      const mod = await import('./index');
      expect(typeof mod.isBullMQAvailable).toBe('function');
    });

    it('should export closeAllQueues function', async () => {
      const mod = await import('./index');
      expect(typeof mod.closeAllQueues).toBe('function');
    });

    it('should export pauseAllQueues function', async () => {
      const mod = await import('./index');
      expect(typeof mod.pauseAllQueues).toBe('function');
    });

    it('should export resumeAllQueues function', async () => {
      const mod = await import('./index');
      expect(typeof mod.resumeAllQueues).toBe('function');
    });

    it('should export cleanAllQueues function', async () => {
      const mod = await import('./index');
      expect(typeof mod.cleanAllQueues).toBe('function');
    });

    it('should export addChatJob function', async () => {
      const mod = await import('./index');
      expect(typeof mod.addChatJob).toBe('function');
    });

    it('should export getChatJob function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getChatJob).toBe('function');
    });

    it('should export getChatQueueStats function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getChatQueueStats).toBe('function');
    });

    it('should export getPriorityFromPlan function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getPriorityFromPlan).toBe('function');
    });
  });

  describe('Worker exports (from ./workers)', () => {
    it('should export createChatWorker function', async () => {
      const mod = await import('./index');
      expect(typeof mod.createChatWorker).toBe('function');
    });

    it('should export createCodeLabWorker function', async () => {
      const mod = await import('./index');
      expect(typeof mod.createCodeLabWorker).toBe('function');
    });

    it('should export startAllWorkers function', async () => {
      const mod = await import('./index');
      expect(typeof mod.startAllWorkers).toBe('function');
    });

    it('should export shutdownAllWorkers function', async () => {
      const mod = await import('./index');
      expect(typeof mod.shutdownAllWorkers).toBe('function');
    });

    it('should export getWorkerStats function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getWorkerStats).toBe('function');
    });
  });

  describe('QStash exports (from ./qstash)', () => {
    it('should export getQStashClient function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getQStashClient).toBe('function');
    });

    it('should export isQStashAvailable function', async () => {
      const mod = await import('./index');
      expect(typeof mod.isQStashAvailable).toBe('function');
    });

    it('should export publishChatJob function', async () => {
      const mod = await import('./index');
      expect(typeof mod.publishChatJob).toBe('function');
    });

    it('should export publishCodeLabJob function', async () => {
      const mod = await import('./index');
      expect(typeof mod.publishCodeLabJob).toBe('function');
    });

    it('should export scheduleJob function', async () => {
      const mod = await import('./index');
      expect(typeof mod.scheduleJob).toBe('function');
    });

    it('should export getPriorityDelay function', async () => {
      const mod = await import('./index');
      expect(typeof mod.getPriorityDelay).toBe('function');
    });

    it('should export verifyWebhookSignature function', async () => {
      const mod = await import('./index');
      expect(typeof mod.verifyWebhookSignature).toBe('function');
    });
  });

  describe('Functional behavior through barrel exports', () => {
    it('should generate unique request IDs', async () => {
      const mod = await import('./index');
      const id1 = mod.generateRequestId();
      const id2 = mod.generateRequestId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should return correct priority from plan via barrel export', async () => {
      const mod = await import('./index');
      expect(mod.getPriorityFromPlan('executive')).toBe(1);
      expect(mod.getPriorityFromPlan('pro')).toBe(2);
      expect(mod.getPriorityFromPlan('free')).toBe(5);
    });

    it('should return correct priority delay via barrel export', async () => {
      const mod = await import('./index');
      expect(mod.getPriorityDelay('executive')).toBe(0);
      expect(mod.getPriorityDelay('pro')).toBe(1);
      expect(mod.getPriorityDelay('free')).toBe(10);
    });

    it('should throw QueueFullError with correct message', async () => {
      const mod = await import('./index');
      const error = new mod.QueueFullError('Server busy');
      expect(error.message).toBe('Server busy');
      expect(error.name).toBe('QueueFullError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should return worker stats with correct shape', async () => {
      const mod = await import('./index');
      const stats = mod.getWorkerStats();
      expect(stats).toHaveProperty('activeWorkers');
      expect(stats).toHaveProperty('workers');
      expect(typeof stats.activeWorkers).toBe('number');
      expect(Array.isArray(stats.workers)).toBe(true);
    });

    it('should return queue status with correct shape', async () => {
      const mod = await import('./index');
      const status = await mod.getQueueStatus();
      expect(status).toHaveProperty('activeRequests');
      expect(status).toHaveProperty('maxConcurrent');
      expect(status).toHaveProperty('available');
      expect(typeof status.activeRequests).toBe('number');
      expect(typeof status.maxConcurrent).toBe('number');
      expect(typeof status.available).toBe('number');
    });
  });
});
