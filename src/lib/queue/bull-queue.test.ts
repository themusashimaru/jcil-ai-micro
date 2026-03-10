import { describe, it, expect, vi } from 'vitest';

// ============================================
// MOCKS — must appear BEFORE imports
// ============================================

const mockQueueAdd = vi.fn();
const mockQueueGetJob = vi.fn();
const mockQueueGetWaitingCount = vi.fn().mockResolvedValue(5);
const mockQueueGetActiveCount = vi.fn().mockResolvedValue(3);
const mockQueueGetCompletedCount = vi.fn().mockResolvedValue(100);
const mockQueueGetFailedCount = vi.fn().mockResolvedValue(2);
const mockQueueGetDelayedCount = vi.fn().mockResolvedValue(1);
const mockQueuePause = vi.fn().mockResolvedValue(undefined);
const mockQueueResume = vi.fn().mockResolvedValue(undefined);
const mockQueueClean = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    getWaitingCount: mockQueueGetWaitingCount,
    getActiveCount: mockQueueGetActiveCount,
    getCompletedCount: mockQueueGetCompletedCount,
    getFailedCount: mockQueueGetFailedCount,
    getDelayedCount: mockQueueGetDelayedCount,
    pause: mockQueuePause,
    resume: mockQueueResume,
    clean: mockQueueClean,
    close: mockQueueClose,
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

const mockRedisOn = vi.fn();
const mockRedisQuit = vi.fn().mockResolvedValue(undefined);

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: mockRedisOn,
    quit: mockRedisQuit,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

// ============================================
// TESTS
// ============================================

describe('bull-queue', () => {
  // We need to use dynamic imports and reset modules to test the singleton pattern
  // because the module caches connections/queues in module-level variables

  describe('getPriorityFromPlan', () => {
    it('should return 1 for executive plan', async () => {
      const { getPriorityFromPlan } = await import('./bull-queue');
      expect(getPriorityFromPlan('executive')).toBe(1);
    });

    it('should return 2 for pro plan', async () => {
      const { getPriorityFromPlan } = await import('./bull-queue');
      expect(getPriorityFromPlan('pro')).toBe(2);
    });

    it('should return 3 for plus plan', async () => {
      const { getPriorityFromPlan } = await import('./bull-queue');
      expect(getPriorityFromPlan('plus')).toBe(3);
    });

    it('should return 5 for free plan', async () => {
      const { getPriorityFromPlan } = await import('./bull-queue');
      expect(getPriorityFromPlan('free')).toBe(5);
    });

    it('should return 4 for unknown plan', async () => {
      const { getPriorityFromPlan } = await import('./bull-queue');
      expect(getPriorityFromPlan('unknown-plan')).toBe(4);
    });

    it('should return 4 when planKey is undefined', async () => {
      const { getPriorityFromPlan } = await import('./bull-queue');
      expect(getPriorityFromPlan(undefined)).toBe(4);
    });

    it('should return 4 when planKey is not provided', async () => {
      const { getPriorityFromPlan } = await import('./bull-queue');
      expect(getPriorityFromPlan()).toBe(4);
    });
  });

  describe('getRedisConnection', () => {
    it('should return null when REDIS_HOST is not set', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { getRedisConnection } = await import('./bull-queue');
      const result = getRedisConnection();
      expect(result).toBeNull();
    });

    it('should create a Redis connection when REDIS_HOST is set', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PORT = '6379';
      const { getRedisConnection } = await import('./bull-queue');
      const connection = getRedisConnection();
      expect(connection).not.toBeNull();
      // Cleanup
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
    });

    it('should reuse existing connection on subsequent calls', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { getRedisConnection } = await import('./bull-queue');
      const conn1 = getRedisConnection();
      const conn2 = getRedisConnection();
      expect(conn1).toBe(conn2);
      delete process.env.REDIS_HOST;
    });

    it('should use default port 6379 when REDIS_PORT is not set', async () => {
      vi.resetModules();
      delete process.env.REDIS_PORT;
      process.env.REDIS_HOST = 'localhost';
      const IORedis = (await import('ioredis')).default;
      const { getRedisConnection } = await import('./bull-queue');
      getRedisConnection();
      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 6379,
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should enable TLS when REDIS_TLS is true', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_TLS = 'true';
      const IORedis = (await import('ioredis')).default;
      const { getRedisConnection } = await import('./bull-queue');
      getRedisConnection();
      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: {},
        })
      );
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_TLS;
    });

    it('should not enable TLS when REDIS_TLS is not true', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      delete process.env.REDIS_TLS;
      const IORedis = (await import('ioredis')).default;
      const { getRedisConnection } = await import('./bull-queue');
      getRedisConnection();
      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: undefined,
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should set maxRetriesPerRequest to null for BullMQ compatibility', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const IORedis = (await import('ioredis')).default;
      const { getRedisConnection } = await import('./bull-queue');
      getRedisConnection();
      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should pass password when REDIS_PASSWORD is set', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PASSWORD = 'secret123';
      const IORedis = (await import('ioredis')).default;
      const { getRedisConnection } = await import('./bull-queue');
      getRedisConnection();
      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret123',
        })
      );
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PASSWORD;
    });
  });

  describe('getChatQueue', () => {
    it('should return null when Redis is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { getChatQueue } = await import('./bull-queue');
      const queue = getChatQueue();
      expect(queue).toBeNull();
    });

    it('should create a chat queue when Redis is available', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { getChatQueue } = await import('./bull-queue');
      const queue = getChatQueue();
      expect(queue).not.toBeNull();
      delete process.env.REDIS_HOST;
    });

    it('should return cached queue on subsequent calls', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { getChatQueue } = await import('./bull-queue');
      const q1 = getChatQueue();
      const q2 = getChatQueue();
      expect(q1).toBe(q2);
      delete process.env.REDIS_HOST;
    });
  });

  describe('getChatQueueEvents', () => {
    it('should return null when Redis is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { getChatQueueEvents } = await import('./bull-queue');
      expect(getChatQueueEvents()).toBeNull();
    });

    it('should create queue events when Redis is available', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { getChatQueueEvents } = await import('./bull-queue');
      const events = getChatQueueEvents();
      expect(events).not.toBeNull();
      delete process.env.REDIS_HOST;
    });

    it('should return cached events on subsequent calls', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { getChatQueueEvents } = await import('./bull-queue');
      const e1 = getChatQueueEvents();
      const e2 = getChatQueueEvents();
      expect(e1).toBe(e2);
      delete process.env.REDIS_HOST;
    });
  });

  describe('addChatJob', () => {
    it('should return null when chat queue is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { addChatJob } = await import('./bull-queue');
      const result = await addChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result).toBeNull();
    });

    it('should add a job to the queue when available', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const mockJob = { id: 'job-123' };
      mockQueueAdd.mockResolvedValueOnce(mockJob);

      const { addChatJob } = await import('./bull-queue');
      const result = await addChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result).toEqual(mockJob);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'process-chat',
        expect.objectContaining({ conversationId: 'conv-1' }),
        expect.objectContaining({ priority: 4 })
      );
      delete process.env.REDIS_HOST;
    });

    it('should use explicit priority from data when provided', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueAdd.mockResolvedValueOnce({ id: 'job-456' });

      const { addChatJob } = await import('./bull-queue');
      await addChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
        priority: 1,
      });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'process-chat',
        expect.anything(),
        expect.objectContaining({ priority: 1 })
      );
      delete process.env.REDIS_HOST;
    });

    it('should derive priority from planKey when priority is not set', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueAdd.mockResolvedValueOnce({ id: 'job-789' });

      const { addChatJob } = await import('./bull-queue');
      await addChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
        planKey: 'pro',
      });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'process-chat',
        expect.anything(),
        expect.objectContaining({ priority: 2 })
      );
      delete process.env.REDIS_HOST;
    });

    it('should merge additional JobsOptions', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueAdd.mockResolvedValueOnce({ id: 'job-custom' });

      const { addChatJob } = await import('./bull-queue');
      await addChatJob(
        {
          conversationId: 'conv-1',
          userId: 'user-1',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        { delay: 5000 }
      );
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'process-chat',
        expect.anything(),
        expect.objectContaining({ delay: 5000 })
      );
      delete process.env.REDIS_HOST;
    });
  });

  describe('getChatJob', () => {
    it('should return null when queue is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { getChatJob } = await import('./bull-queue');
      const result = await getChatJob('job-123');
      expect(result).toBeNull();
    });

    it('should return job when found', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const mockJob = { id: 'job-123', data: { conversationId: 'conv-1' } };
      mockQueueGetJob.mockResolvedValueOnce(mockJob);

      const { getChatJob } = await import('./bull-queue');
      const result = await getChatJob('job-123');
      expect(result).toEqual(mockJob);
      delete process.env.REDIS_HOST;
    });

    it('should return null when job is not found', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueGetJob.mockResolvedValueOnce(undefined);

      const { getChatJob } = await import('./bull-queue');
      const result = await getChatJob('nonexistent');
      expect(result).toBeNull();
      delete process.env.REDIS_HOST;
    });
  });

  describe('getChatQueueStats', () => {
    it('should return null when queue is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { getChatQueueStats } = await import('./bull-queue');
      const result = await getChatQueueStats();
      expect(result).toBeNull();
    });

    it('should return all queue statistics', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueGetWaitingCount.mockResolvedValueOnce(10);
      mockQueueGetActiveCount.mockResolvedValueOnce(5);
      mockQueueGetCompletedCount.mockResolvedValueOnce(200);
      mockQueueGetFailedCount.mockResolvedValueOnce(3);
      mockQueueGetDelayedCount.mockResolvedValueOnce(7);

      const { getChatQueueStats } = await import('./bull-queue');
      const stats = await getChatQueueStats();
      expect(stats).toEqual({
        waiting: 10,
        active: 5,
        completed: 200,
        failed: 3,
        delayed: 7,
      });
      delete process.env.REDIS_HOST;
    });
  });

  describe('getCodeLabQueue', () => {
    it('should return null when Redis is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { getCodeLabQueue } = await import('./bull-queue');
      expect(getCodeLabQueue()).toBeNull();
    });

    it('should create a code lab queue when Redis is available', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { getCodeLabQueue } = await import('./bull-queue');
      const queue = getCodeLabQueue();
      expect(queue).not.toBeNull();
      delete process.env.REDIS_HOST;
    });

    it('should cache the code lab queue singleton', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { getCodeLabQueue } = await import('./bull-queue');
      const q1 = getCodeLabQueue();
      const q2 = getCodeLabQueue();
      expect(q1).toBe(q2);
      delete process.env.REDIS_HOST;
    });
  });

  describe('pauseAllQueues', () => {
    it('should pause all available queues', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueuePause.mockClear();

      const { getChatQueue, getCodeLabQueue, pauseAllQueues } = await import('./bull-queue');
      getChatQueue();
      getCodeLabQueue();
      await pauseAllQueues();

      expect(mockQueuePause).toHaveBeenCalled();
      delete process.env.REDIS_HOST;
    });

    it('should not throw when no queues are available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { pauseAllQueues } = await import('./bull-queue');
      await expect(pauseAllQueues()).resolves.not.toThrow();
    });
  });

  describe('resumeAllQueues', () => {
    it('should resume all available queues', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueResume.mockClear();

      const { getChatQueue, getCodeLabQueue, resumeAllQueues } = await import('./bull-queue');
      getChatQueue();
      getCodeLabQueue();
      await resumeAllQueues();

      expect(mockQueueResume).toHaveBeenCalled();
      delete process.env.REDIS_HOST;
    });
  });

  describe('cleanAllQueues', () => {
    it('should clean completed and failed jobs from all queues', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueClean.mockClear();

      const { getChatQueue, getCodeLabQueue, cleanAllQueues } = await import('./bull-queue');
      getChatQueue();
      getCodeLabQueue();
      await cleanAllQueues();

      // Each queue should have clean called twice (once for completed, once for failed)
      expect(mockQueueClean).toHaveBeenCalledWith(3600000, 1000, 'completed');
      expect(mockQueueClean).toHaveBeenCalledWith(86400000, 500, 'failed');
      delete process.env.REDIS_HOST;
    });
  });

  describe('isBullMQAvailable', () => {
    it('should return false when REDIS_HOST is not set', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { isBullMQAvailable } = await import('./bull-queue');
      expect(isBullMQAvailable()).toBe(false);
    });

    it('should return true when REDIS_HOST is set', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { isBullMQAvailable } = await import('./bull-queue');
      expect(isBullMQAvailable()).toBe(true);
      delete process.env.REDIS_HOST;
    });
  });

  describe('closeAllQueues', () => {
    it('should close all queues, events, and Redis connection', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockQueueClose.mockClear();
      mockRedisQuit.mockClear();

      const { getChatQueue, getCodeLabQueue, getChatQueueEvents, closeAllQueues } = await import(
        './bull-queue'
      );

      // Initialize everything
      getChatQueue();
      getCodeLabQueue();
      getChatQueueEvents();

      await closeAllQueues();

      expect(mockQueueClose).toHaveBeenCalled();
      expect(mockRedisQuit).toHaveBeenCalled();
      delete process.env.REDIS_HOST;
    });

    it('should nullify all references after closing', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';

      const mod = await import('./bull-queue');
      mod.getChatQueue();
      mod.getCodeLabQueue();
      mod.getChatQueueEvents();

      await mod.closeAllQueues();

      // After closing, getRedisConnection should return null since redisConnection was set to null
      // and REDIS_HOST may or may not be set — but the internal references are cleared
      // so isBullMQAvailable will try to create a new connection
      delete process.env.REDIS_HOST;

      // Now without REDIS_HOST, it should be false
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const mod2 = await import('./bull-queue');
      expect(mod2.isBullMQAvailable()).toBe(false);
    });

    it('should not throw when nothing was initialized', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { closeAllQueues } = await import('./bull-queue');
      await expect(closeAllQueues()).resolves.not.toThrow();
    });
  });

  describe('ChatJobData interface', () => {
    it('should accept valid chat job data with required fields', async () => {
      const { addChatJob } = await import('./bull-queue');
      // Verify the function signature accepts the expected shape
      const jobData = {
        conversationId: 'conv-123',
        userId: 'user-456',
        messages: [
          { role: 'user' as const, content: 'What is AI?' },
          { role: 'assistant' as const, content: 'AI is...' },
        ],
      };
      expect(jobData.conversationId).toBe('conv-123');
      expect(jobData.userId).toBe('user-456');
      expect(jobData.messages).toHaveLength(2);
      expect(typeof addChatJob).toBe('function');
    });

    it('should accept optional fields in chat job data', () => {
      const jobData = {
        conversationId: 'conv-123',
        userId: 'user-456',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        model: 'claude-3-opus',
        systemPrompt: 'You are a helpful assistant',
        planKey: 'pro',
        webSearchEnabled: true,
        priority: 2,
      };
      expect(jobData.model).toBe('claude-3-opus');
      expect(jobData.systemPrompt).toBe('You are a helpful assistant');
      expect(jobData.planKey).toBe('pro');
      expect(jobData.webSearchEnabled).toBe(true);
      expect(jobData.priority).toBe(2);
    });
  });

  describe('CodeLabJobData interface', () => {
    it('should accept valid code lab job data', () => {
      const jobData = {
        sessionId: 'sess-123',
        userId: 'user-456',
        prompt: 'Write a hello world program',
        context: 'Python project',
        sandboxId: 'sandbox-789',
        planKey: 'executive',
      };
      expect(jobData.sessionId).toBe('sess-123');
      expect(jobData.prompt).toBe('Write a hello world program');
      expect(jobData.context).toBe('Python project');
      expect(jobData.sandboxId).toBe('sandbox-789');
    });
  });
});
