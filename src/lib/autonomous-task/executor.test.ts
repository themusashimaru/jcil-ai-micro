/**
 * Tests for autonomous-task executor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Test Task',
              description: 'A test task',
              steps: [
                { name: 'Step 1', description: 'Do something', type: 'analyze' },
                { name: 'Step 2', description: 'Do more', type: 'generate' },
              ],
              estimatedDuration: 60,
            }),
          },
        ],
      }),
    },
  })),
}));

// Mock Supabase
const mockFrom = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'task_123',
        user_id: 'user-1',
        session_id: 'sess-1',
        title: 'Test Task',
        description: 'A test',
        status: 'queued',
        steps: '[]',
        current_step: 0,
        total_steps: 2,
        progress: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    }),
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task_1',
            user_id: 'user-1',
            session_id: 'sess-1',
            title: 'Task 1',
            description: 'First',
            status: 'completed',
            steps: '[]',
            current_step: 2,
            total_steps: 2,
            progress: 100,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    }),
  }),
});

mockFrom.mockReturnValue({
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock multi-agent orchestrator
vi.mock('@/lib/multi-agent/orchestrator', () => ({
  executeAgent: vi.fn().mockResolvedValue({
    content: 'Agent output',
    files: [{ path: 'test.ts', content: 'code' }],
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { planTask, createTask, cancelTask, getTaskStatus, getUserTasks } from './executor';

describe('autonomous-task executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
    });
  });

  describe('planTask', () => {
    it('should return a task plan from AI response', async () => {
      const plan = await planTask('Add authentication', {
        userId: 'user-1',
        sessionId: 'sess-1',
      });

      expect(plan.title).toBe('Test Task');
      expect(plan.steps).toHaveLength(2);
      expect(plan.estimatedDuration).toBe(60);
    });

    it('should include repo info when provided', async () => {
      const plan = await planTask('Fix bug', {
        userId: 'user-1',
        sessionId: 'sess-1',
        repo: { owner: 'org', name: 'app', branch: 'main' },
      });

      expect(plan).toBeDefined();
      expect(plan.title).toBeDefined();
    });
  });

  describe('createTask', () => {
    it('should create a task and store it', async () => {
      const task = await createTask('Build feature', {
        userId: 'user-1',
        sessionId: 'sess-1',
      });

      expect(task.id).toMatch(/^task_/);
      expect(task.userId).toBe('user-1');
      expect(task.status).toBe('queued');
      expect(task.steps.length).toBeGreaterThan(0);
      expect(mockFrom).toHaveBeenCalledWith('autonomous_tasks');
    });

    it('should set initial progress to 0', async () => {
      const task = await createTask('Build feature', {
        userId: 'user-1',
        sessionId: 'sess-1',
      });

      expect(task.progress).toBe(0);
      expect(task.currentStep).toBe(0);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a task', async () => {
      const result = await cancelTask('task_123');
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('autonomous_tasks');
    });

    it('should return false on error', async () => {
      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('DB error') }),
        }),
      });

      const result = await cancelTask('task_bad');
      expect(result).toBe(false);
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status', async () => {
      const task = await getTaskStatus('task_123');
      expect(task).not.toBeNull();
      expect(task?.id).toBe('task_123');
      expect(task?.status).toBe('queued');
    });

    it('should return null for non-existent task', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      const task = await getTaskStatus('task_nonexistent');
      expect(task).toBeNull();
    });
  });

  describe('getUserTasks', () => {
    it('should return user tasks', async () => {
      const tasks = await getUserTasks('user-1');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task_1');
    });

    it('should return empty array on error', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
            }),
          }),
        }),
      });

      const tasks = await getUserTasks('user-nonexistent');
      expect(tasks).toEqual([]);
    });
  });
});
