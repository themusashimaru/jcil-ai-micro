import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS — must appear BEFORE imports
// ============================================

const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerIsRunning = vi.fn().mockReturnValue(true);

vi.mock('bullmq', () => ({
  Worker: vi
    .fn()
    .mockImplementation((name: string, _processor: unknown, opts: Record<string, unknown>) => ({
      name,
      on: mockWorkerOn,
      close: mockWorkerClose,
      isRunning: mockWorkerIsRunning,
      opts: { concurrency: (opts && opts.concurrency) || 1 },
    })),
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

vi.mock('@/lib/anthropic/client', () => ({
  createAnthropicCompletion: vi.fn().mockResolvedValue({
    text: 'Hello from AI',
    model: 'claude-3-opus',
    citations: [],
  }),
  createAnthropicCompletionWithSearch: vi.fn().mockResolvedValue({
    text: 'Search result',
    model: 'claude-3-opus',
    citations: [{ title: 'Test', url: 'https://example.com' }],
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

// ============================================
// TESTS
// ============================================

describe('workers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createChatWorker', () => {
    it('should return null when Redis is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { createChatWorker } = await import('./workers');
      const worker = createChatWorker();
      expect(worker).toBeNull();
    });

    it('should create a worker when Redis is available', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { createChatWorker } = await import('./workers');
      const worker = createChatWorker();
      expect(worker).not.toBeNull();
      delete process.env.REDIS_HOST;
    });

    it('should create worker with chat-requests queue name', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { Worker } = await import('bullmq');
      const { createChatWorker } = await import('./workers');
      createChatWorker();
      expect(Worker).toHaveBeenCalledWith(
        'chat-requests',
        expect.any(Function),
        expect.any(Object)
      );
      delete process.env.REDIS_HOST;
    });

    it('should use default concurrency of 10', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      delete process.env.WORKER_CONCURRENCY;
      const { Worker } = await import('bullmq');
      const { createChatWorker } = await import('./workers');
      createChatWorker();
      expect(Worker).toHaveBeenCalledWith(
        'chat-requests',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 10,
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should respect WORKER_CONCURRENCY env var', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      process.env.WORKER_CONCURRENCY = '20';
      const { Worker } = await import('bullmq');
      const { createChatWorker } = await import('./workers');
      createChatWorker();
      expect(Worker).toHaveBeenCalledWith(
        'chat-requests',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 20,
        })
      );
      delete process.env.REDIS_HOST;
      delete process.env.WORKER_CONCURRENCY;
    });

    it('should configure rate limiter with default max 100 per minute', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      delete process.env.WORKER_RATE_LIMIT;
      const { Worker } = await import('bullmq');
      const { createChatWorker } = await import('./workers');
      createChatWorker();
      expect(Worker).toHaveBeenCalledWith(
        'chat-requests',
        expect.any(Function),
        expect.objectContaining({
          limiter: {
            max: 100,
            duration: 60000,
          },
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should set lock duration to 5 minutes', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { Worker } = await import('bullmq');
      const { createChatWorker } = await import('./workers');
      createChatWorker();
      expect(Worker).toHaveBeenCalledWith(
        'chat-requests',
        expect.any(Function),
        expect.objectContaining({
          lockDuration: 300000,
          stalledInterval: 60000,
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should register event handlers on the worker', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { createChatWorker } = await import('./workers');
      createChatWorker();
      // Worker.on should be called for completed, failed, stalled, error
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function));
      delete process.env.REDIS_HOST;
    });
  });

  describe('createCodeLabWorker', () => {
    it('should return null when Redis is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { createCodeLabWorker } = await import('./workers');
      const worker = createCodeLabWorker();
      expect(worker).toBeNull();
    });

    it('should create a worker when Redis is available', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { createCodeLabWorker } = await import('./workers');
      const worker = createCodeLabWorker();
      expect(worker).not.toBeNull();
      delete process.env.REDIS_HOST;
    });

    it('should create worker with codelab-requests queue name', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { Worker } = await import('bullmq');
      const { createCodeLabWorker } = await import('./workers');
      createCodeLabWorker();
      expect(Worker).toHaveBeenCalledWith(
        'codelab-requests',
        expect.any(Function),
        expect.any(Object)
      );
      delete process.env.REDIS_HOST;
    });

    it('should use default concurrency of 5 for code lab', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      delete process.env.CODELAB_WORKER_CONCURRENCY;
      const { Worker } = await import('bullmq');
      const { createCodeLabWorker } = await import('./workers');
      createCodeLabWorker();
      expect(Worker).toHaveBeenCalledWith(
        'codelab-requests',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 5,
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should respect CODELAB_WORKER_CONCURRENCY env var', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      process.env.CODELAB_WORKER_CONCURRENCY = '8';
      const { Worker } = await import('bullmq');
      const { createCodeLabWorker } = await import('./workers');
      createCodeLabWorker();
      expect(Worker).toHaveBeenCalledWith(
        'codelab-requests',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 8,
        })
      );
      delete process.env.REDIS_HOST;
      delete process.env.CODELAB_WORKER_CONCURRENCY;
    });

    it('should set lock duration to 10 minutes for code lab', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { Worker } = await import('bullmq');
      const { createCodeLabWorker } = await import('./workers');
      createCodeLabWorker();
      expect(Worker).toHaveBeenCalledWith(
        'codelab-requests',
        expect.any(Function),
        expect.objectContaining({
          lockDuration: 600000,
        })
      );
      delete process.env.REDIS_HOST;
    });
  });

  describe('startAllWorkers', () => {
    it('should create both chat and code lab workers', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      const { Worker } = await import('bullmq');
      const { startAllWorkers } = await import('./workers');
      startAllWorkers();
      // Worker constructor should be called twice (chat + codelab)
      expect(Worker).toHaveBeenCalledTimes(2);
      delete process.env.REDIS_HOST;
    });

    it('should not throw when Redis is not available', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { startAllWorkers } = await import('./workers');
      expect(() => startAllWorkers()).not.toThrow();
    });
  });

  describe('shutdownAllWorkers', () => {
    it('should close all active workers', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockWorkerClose.mockClear();

      const { startAllWorkers, shutdownAllWorkers } = await import('./workers');
      startAllWorkers();
      await shutdownAllWorkers();

      expect(mockWorkerClose).toHaveBeenCalled();
      delete process.env.REDIS_HOST;
    });

    it('should clear the active workers list after shutdown', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';

      const { startAllWorkers, shutdownAllWorkers, getWorkerStats } = await import('./workers');
      startAllWorkers();
      await shutdownAllWorkers();

      const stats = getWorkerStats();
      expect(stats.activeWorkers).toBe(0);
      expect(stats.workers).toHaveLength(0);
      delete process.env.REDIS_HOST;
    });

    it('should not throw when no workers are active', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { shutdownAllWorkers } = await import('./workers');
      await expect(shutdownAllWorkers()).resolves.not.toThrow();
    });
  });

  describe('getWorkerStats', () => {
    it('should return zero active workers initially', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;
      const { getWorkerStats } = await import('./workers');
      const stats = getWorkerStats();
      expect(stats.activeWorkers).toBe(0);
      expect(stats.workers).toEqual([]);
    });

    it('should return stats for all active workers', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';

      const { startAllWorkers, getWorkerStats } = await import('./workers');
      startAllWorkers();

      const stats = getWorkerStats();
      expect(stats.activeWorkers).toBe(2);
      expect(stats.workers).toHaveLength(2);
      delete process.env.REDIS_HOST;
    });

    it('should include worker name, running status, and concurrency', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';

      const { createChatWorker, getWorkerStats } = await import('./workers');
      createChatWorker();

      const stats = getWorkerStats();
      expect(stats.workers[0]).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          running: expect.any(Boolean),
          concurrency: expect.any(Number),
        })
      );
      delete process.env.REDIS_HOST;
    });

    it('should report chat worker as running', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      mockWorkerIsRunning.mockReturnValue(true);

      const { createChatWorker, getWorkerStats } = await import('./workers');
      createChatWorker();

      const stats = getWorkerStats();
      const chatWorker = stats.workers.find((w) => w.name === 'chat-requests');
      expect(chatWorker?.running).toBe(true);
      delete process.env.REDIS_HOST;
    });

    it('should report correct concurrency for code lab worker', async () => {
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost';
      process.env.CODELAB_WORKER_CONCURRENCY = '3';

      const { createCodeLabWorker, getWorkerStats } = await import('./workers');
      createCodeLabWorker();

      const stats = getWorkerStats();
      const codeLab = stats.workers.find((w) => w.name === 'codelab-requests');
      expect(codeLab?.concurrency).toBe(3);
      delete process.env.REDIS_HOST;
      delete process.env.CODELAB_WORKER_CONCURRENCY;
    });
  });
});
