import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { ExecutionQueue, createExecutionQueue } from './ExecutionQueue';
import { DEFAULT_LIMITS } from './constants';

describe('ExecutionQueue', () => {
  let queue: ExecutionQueue;

  beforeEach(() => {
    queue = new ExecutionQueue();
  });

  describe('constructor', () => {
    it('should create with default limits', () => {
      expect(queue).toBeInstanceOf(ExecutionQueue);
    });

    it('should create with custom limits', () => {
      const q = new ExecutionQueue(DEFAULT_LIMITS);
      expect(q).toBeInstanceOf(ExecutionQueue);
    });

    it('should accept optional onStream callback', () => {
      const onStream = vi.fn();
      const q = new ExecutionQueue(DEFAULT_LIMITS, onStream);
      expect(q).toBeInstanceOf(ExecutionQueue);
    });
  });

  describe('enqueue', () => {
    it('should add a task and return an id', () => {
      const id = queue.enqueue({
        type: 'search',
        priority: 5,
        execute: vi.fn(),
        description: 'test task',
        maxAttempts: 3,
      });

      expect(id).toMatch(/^task_/);
    });

    it('should add multiple tasks in priority order', () => {
      queue.enqueue({
        type: 'search',
        priority: 1,
        execute: vi.fn(),
        description: 'low priority',
        maxAttempts: 3,
      });
      const highId = queue.enqueue({
        type: 'search',
        priority: 10,
        execute: vi.fn(),
        description: 'high priority',
        maxAttempts: 3,
      });

      const task = queue.getTask(highId);
      expect(task).toBeDefined();
      expect(task?.priority).toBe(10);
    });

    it('should throw when queue is killed', () => {
      queue.kill('test');

      expect(() =>
        queue.enqueue({
          type: 'search',
          priority: 1,
          execute: vi.fn(),
          description: 'test',
          maxAttempts: 3,
        })
      ).toThrow('Queue has been killed');
    });
  });

  describe('enqueueBatch', () => {
    it('should add multiple tasks at once', () => {
      const ids = queue.enqueueBatch([
        { type: 'search', priority: 1, execute: vi.fn(), description: 'task1', maxAttempts: 3 },
        { type: 'search', priority: 2, execute: vi.fn(), description: 'task2', maxAttempts: 3 },
        { type: 'search', priority: 3, execute: vi.fn(), description: 'task3', maxAttempts: 3 },
      ]);

      expect(ids).toHaveLength(3);
      ids.forEach((id) => expect(id).toMatch(/^task_/));
    });
  });

  describe('getTask', () => {
    it('should return task by id', () => {
      const id = queue.enqueue({
        type: 'search',
        priority: 5,
        execute: vi.fn(),
        description: 'findable',
        maxAttempts: 3,
      });

      const task = queue.getTask(id);
      expect(task).toBeDefined();
      expect(task?.description).toBe('findable');
    });

    it('should return undefined for non-existent id', () => {
      const task = queue.getTask('nonexistent');
      expect(task).toBeUndefined();
    });
  });

  describe('pause/resume', () => {
    it('should pause without error', () => {
      expect(() => queue.pause()).not.toThrow();
    });

    it('should resume without error', () => {
      queue.pause();
      expect(() => queue.resume()).not.toThrow();
    });
  });

  describe('kill', () => {
    it('should kill the queue', () => {
      expect(() => queue.kill('test reason')).not.toThrow();
    });

    it('should prevent new tasks after kill', () => {
      queue.kill('done');
      expect(() =>
        queue.enqueue({
          type: 'search',
          priority: 1,
          execute: vi.fn(),
          description: 'test',
          maxAttempts: 3,
        })
      ).toThrow();
    });
  });

  describe('getProgress', () => {
    it('should return progress object', () => {
      const progress = queue.getProgress();
      expect(progress).toHaveProperty('total');
      expect(progress).toHaveProperty('completed');
      expect(progress).toHaveProperty('failed');
      expect(progress).toHaveProperty('inProgress');
      expect(progress).toHaveProperty('queued');
      expect(progress).toHaveProperty('estimatedTimeRemaining');
    });

    it('should start with 0 progress', () => {
      const progress = queue.getProgress();
      expect(progress.total).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.failed).toBe(0);
    });
  });
});

// -------------------------------------------------------------------
// createExecutionQueue factory
// -------------------------------------------------------------------
describe('createExecutionQueue', () => {
  it('should return an ExecutionQueue instance', () => {
    const q = createExecutionQueue(DEFAULT_LIMITS);
    expect(q).toBeInstanceOf(ExecutionQueue);
  });

  it('should accept optional onStream', () => {
    const onStream = vi.fn();
    const q = createExecutionQueue(DEFAULT_LIMITS, onStream);
    expect(q).toBeInstanceOf(ExecutionQueue);
  });
});
