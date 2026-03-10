/**
 * Tests for multi-agent architecture type definitions.
 *
 * Since types.ts exports only TypeScript types/interfaces,
 * these tests verify compile-time type contracts by constructing
 * valid and structurally correct objects at runtime.
 */
import { describe, it, expect } from 'vitest';
import type {
  AgentRole,
  AgentContext,
  AgentTask,
  AgentResponse,
  OrchestrationPlan,
  AgentConfig,
} from './types';

describe('multi-agent/types', () => {
  // ─── AgentRole ────────────────────────────────────────────────

  describe('AgentRole', () => {
    it('should accept "frontend" as a valid role', () => {
      const role: AgentRole = 'frontend';
      expect(role).toBe('frontend');
    });

    it('should accept "backend" as a valid role', () => {
      const role: AgentRole = 'backend';
      expect(role).toBe('backend');
    });

    it('should accept "test" as a valid role', () => {
      const role: AgentRole = 'test';
      expect(role).toBe('test');
    });

    it('should accept "reviewer" as a valid role', () => {
      const role: AgentRole = 'reviewer';
      expect(role).toBe('reviewer');
    });

    it('should accept "orchestrator" as a valid role', () => {
      const role: AgentRole = 'orchestrator';
      expect(role).toBe('orchestrator');
    });
  });

  // ─── AgentContext ─────────────────────────────────────────────

  describe('AgentContext', () => {
    it('should construct a minimal context with required fields', () => {
      const ctx: AgentContext = {
        userId: 'user-1',
        sessionId: 'sess-1',
      };
      expect(ctx.userId).toBe('user-1');
      expect(ctx.sessionId).toBe('sess-1');
      expect(ctx.repo).toBeUndefined();
      expect(ctx.previousMessages).toBeUndefined();
      expect(ctx.files).toBeUndefined();
    });

    it('should construct a context with repo information', () => {
      const ctx: AgentContext = {
        userId: 'user-2',
        sessionId: 'sess-2',
        repo: {
          owner: 'acme',
          name: 'app',
          branch: 'main',
          fullName: 'acme/app',
        },
      };
      expect(ctx.repo?.owner).toBe('acme');
      expect(ctx.repo?.fullName).toBe('acme/app');
    });

    it('should construct a context with previous messages', () => {
      const ctx: AgentContext = {
        userId: 'u',
        sessionId: 's',
        previousMessages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi there' },
        ],
      };
      expect(ctx.previousMessages).toHaveLength(2);
      expect(ctx.previousMessages![0].role).toBe('user');
    });

    it('should construct a context with file attachments', () => {
      const ctx: AgentContext = {
        userId: 'u',
        sessionId: 's',
        files: [{ path: 'src/index.ts', content: 'console.log("hi")' }],
      };
      expect(ctx.files).toHaveLength(1);
      expect(ctx.files![0].path).toBe('src/index.ts');
    });
  });

  // ─── AgentTask ────────────────────────────────────────────────

  describe('AgentTask', () => {
    it('should construct a pending task with no dependencies', () => {
      const task: AgentTask = {
        id: 'task-1',
        type: 'frontend',
        description: 'Build a button',
        input: 'Create a button component',
        context: { userId: 'u', sessionId: 's' },
        status: 'pending',
      };
      expect(task.id).toBe('task-1');
      expect(task.status).toBe('pending');
      expect(task.dependencies).toBeUndefined();
      expect(task.output).toBeUndefined();
      expect(task.error).toBeUndefined();
    });

    it('should construct a running task', () => {
      const task: AgentTask = {
        id: 'task-2',
        type: 'backend',
        description: 'Build API',
        input: 'Create REST endpoint',
        context: { userId: 'u', sessionId: 's' },
        status: 'running',
      };
      expect(task.status).toBe('running');
    });

    it('should construct a completed task with output', () => {
      const task: AgentTask = {
        id: 'task-3',
        type: 'test',
        description: 'Write tests',
        input: 'Create unit tests',
        context: { userId: 'u', sessionId: 's' },
        status: 'completed',
        output: 'All 5 tests passing',
      };
      expect(task.status).toBe('completed');
      expect(task.output).toBe('All 5 tests passing');
    });

    it('should construct a failed task with error', () => {
      const task: AgentTask = {
        id: 'task-4',
        type: 'reviewer',
        description: 'Review PR',
        input: 'Review PR #42',
        context: { userId: 'u', sessionId: 's' },
        status: 'failed',
        error: 'Timeout exceeded',
      };
      expect(task.status).toBe('failed');
      expect(task.error).toBe('Timeout exceeded');
    });

    it('should construct a task with dependencies', () => {
      const task: AgentTask = {
        id: 'task-5',
        type: 'test',
        description: 'Test after build',
        input: 'Test the component',
        context: { userId: 'u', sessionId: 's' },
        dependencies: ['task-1', 'task-2'],
        status: 'pending',
      };
      expect(task.dependencies).toEqual(['task-1', 'task-2']);
    });
  });

  // ─── AgentResponse ────────────────────────────────────────────

  describe('AgentResponse', () => {
    it('should construct a minimal response', () => {
      const resp: AgentResponse = {
        role: 'frontend',
        content: 'Here is your component.',
        confidence: 0.9,
      };
      expect(resp.role).toBe('frontend');
      expect(resp.confidence).toBe(0.9);
      expect(resp.files).toBeUndefined();
      expect(resp.suggestions).toBeUndefined();
    });

    it('should construct a response with files', () => {
      const resp: AgentResponse = {
        role: 'backend',
        content: 'Created the API route.',
        confidence: 0.85,
        files: [{ path: 'api/route.ts', content: 'export default handler;', language: 'ts' }],
      };
      expect(resp.files).toHaveLength(1);
      expect(resp.files![0].language).toBe('ts');
    });

    it('should construct a response with suggestions', () => {
      const resp: AgentResponse = {
        role: 'reviewer',
        content: 'Review complete.',
        confidence: 0.7,
        suggestions: ['Add error handling', 'Improve naming'],
      };
      expect(resp.suggestions).toHaveLength(2);
    });

    it('should accept a confidence of 0', () => {
      const resp: AgentResponse = {
        role: 'test',
        content: 'Error occurred.',
        confidence: 0,
      };
      expect(resp.confidence).toBe(0);
    });

    it('should accept a confidence of 1', () => {
      const resp: AgentResponse = {
        role: 'orchestrator',
        content: 'Perfect.',
        confidence: 1,
      };
      expect(resp.confidence).toBe(1);
    });
  });

  // ─── OrchestrationPlan ────────────────────────────────────────

  describe('OrchestrationPlan', () => {
    it('should construct a parallel plan', () => {
      const plan: OrchestrationPlan = {
        tasks: [],
        sequence: 'parallel',
        reasoning: 'Independent tasks',
      };
      expect(plan.sequence).toBe('parallel');
    });

    it('should construct a sequential plan', () => {
      const plan: OrchestrationPlan = {
        tasks: [
          {
            id: 't1',
            type: 'frontend',
            description: 'Build UI',
            input: 'Create component',
            context: { userId: 'u', sessionId: 's' },
            status: 'pending',
          },
        ],
        sequence: 'sequential',
        reasoning: 'Tasks depend on each other',
      };
      expect(plan.sequence).toBe('sequential');
      expect(plan.tasks).toHaveLength(1);
    });

    it('should construct a mixed plan', () => {
      const plan: OrchestrationPlan = {
        tasks: [],
        sequence: 'mixed',
        reasoning: 'Some parallel, some sequential',
      };
      expect(plan.sequence).toBe('mixed');
    });
  });

  // ─── AgentConfig ──────────────────────────────────────────────

  describe('AgentConfig', () => {
    it('should construct a config with required fields', () => {
      const config: AgentConfig = {
        role: 'frontend',
        name: 'Frontend Agent',
        description: 'Handles UI work',
        capabilities: ['React', 'CSS'],
        systemPrompt: 'You are a frontend agent.',
        model: 'claude-sonnet-4-6',
        maxTokens: 4096,
      };
      expect(config.role).toBe('frontend');
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.temperature).toBeUndefined();
    });

    it('should construct a config with optional temperature', () => {
      const config: AgentConfig = {
        role: 'backend',
        name: 'Backend Agent',
        description: 'Handles server-side',
        capabilities: ['Node.js'],
        systemPrompt: 'You are a backend agent.',
        model: 'claude-opus-4-6',
        maxTokens: 8192,
        temperature: 0.3,
      };
      expect(config.temperature).toBe(0.3);
      expect(config.model).toBe('claude-opus-4-6');
    });

    it('should allow an empty capabilities array', () => {
      const config: AgentConfig = {
        role: 'orchestrator',
        name: 'Orchestrator',
        description: 'Plans tasks',
        capabilities: [],
        systemPrompt: 'You plan.',
        model: 'claude-sonnet-4-6',
        maxTokens: 2048,
      };
      expect(config.capabilities).toEqual([]);
    });
  });
});
