/**
 * Tests for autonomous-task type definitions
 */
import { describe, it, expect } from 'vitest';
import type {
  TaskStatus,
  TaskStep,
  AutonomousTask,
  TaskContext,
  TaskPlan,
  TaskResult,
} from './types';

describe('autonomous-task types', () => {
  describe('TaskStatus', () => {
    it('accepts valid status values', () => {
      const statuses: TaskStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
      expect(statuses).toHaveLength(5);
      expect(statuses).toContain('queued');
      expect(statuses).toContain('running');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('cancelled');
    });
  });

  describe('TaskStep', () => {
    it('creates a minimal task step', () => {
      const step: TaskStep = {
        id: 'step-1',
        name: 'Analyze code',
        description: 'Review the codebase',
        status: 'queued',
      };
      expect(step.id).toBe('step-1');
      expect(step.status).toBe('queued');
      expect(step.output).toBeUndefined();
    });

    it('creates a completed task step with all fields', () => {
      const step: TaskStep = {
        id: 'step-2',
        name: 'Generate code',
        description: 'Create new files',
        status: 'completed',
        output: 'Created 3 files',
        error: undefined,
        startedAt: new Date(),
        completedAt: new Date(),
      };
      expect(step.status).toBe('completed');
      expect(step.output).toBe('Created 3 files');
    });
  });

  describe('AutonomousTask', () => {
    it('creates a full task object', () => {
      const task: AutonomousTask = {
        id: 'task_abc123',
        userId: 'user-1',
        sessionId: 'session-1',
        title: 'Refactor auth module',
        description: 'Break down auth into smaller modules',
        status: 'running',
        steps: [],
        currentStep: 0,
        totalSteps: 3,
        progress: 33,
        createdAt: new Date(),
      };
      expect(task.id).toBe('task_abc123');
      expect(task.progress).toBe(33);
      expect(task.repo).toBeUndefined();
    });

    it('supports repo context', () => {
      const task: AutonomousTask = {
        id: 'task_xyz',
        userId: 'user-1',
        sessionId: 'session-1',
        title: 'Deploy',
        description: 'Deploy to prod',
        status: 'queued',
        steps: [],
        currentStep: 0,
        totalSteps: 1,
        progress: 0,
        createdAt: new Date(),
        repo: { owner: 'org', name: 'app', branch: 'main' },
      };
      expect(task.repo?.owner).toBe('org');
    });
  });

  describe('TaskContext', () => {
    it('creates minimal context', () => {
      const ctx: TaskContext = {
        userId: 'user-1',
        sessionId: 'session-1',
      };
      expect(ctx.userId).toBe('user-1');
      expect(ctx.repo).toBeUndefined();
    });

    it('creates full context', () => {
      const ctx: TaskContext = {
        userId: 'user-1',
        sessionId: 'session-1',
        repo: { owner: 'org', name: 'repo', branch: 'dev' },
        conversationHistory: [{ role: 'user', content: 'hello' }],
        githubToken: 'ghp_xxx',
      };
      expect(ctx.conversationHistory).toHaveLength(1);
      expect(ctx.githubToken).toBe('ghp_xxx');
    });
  });

  describe('TaskPlan', () => {
    it('creates a task plan with steps', () => {
      const plan: TaskPlan = {
        title: 'Add auth',
        description: 'Implement authentication',
        steps: [
          { name: 'Analyze', description: 'Review requirements', type: 'analyze' },
          {
            name: 'Generate',
            description: 'Create auth module',
            type: 'generate',
            agentType: 'backend',
          },
          { name: 'Test', description: 'Add tests', type: 'test', agentType: 'test' },
        ],
        estimatedDuration: 300,
      };
      expect(plan.steps).toHaveLength(3);
      expect(plan.steps[1].agentType).toBe('backend');
    });
  });

  describe('TaskResult', () => {
    it('creates a success result', () => {
      const result: TaskResult = {
        success: true,
        output: 'Task completed successfully',
        files: [{ path: 'src/auth.ts', content: 'export const auth = {};', action: 'create' }],
        suggestions: ['Add rate limiting'],
        nextSteps: ['Deploy to staging'],
      };
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
    });

    it('creates a failure result', () => {
      const result: TaskResult = {
        success: false,
        output: 'Task failed: missing API key',
      };
      expect(result.success).toBe(false);
      expect(result.files).toBeUndefined();
    });
  });
});
