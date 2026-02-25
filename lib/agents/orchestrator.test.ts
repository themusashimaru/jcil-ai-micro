import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test output from agent' }],
      }),
    },
  })),
}));

import {
  AGENT_SPECS,
  createOrchestrationPlan,
  getAgentSpec,
  listAgents,
  type AgentType,
  type AgentTask,
  type AgentResult,
  type OrchestrationPlan,
} from './orchestrator';

describe('lib/agents/orchestrator', () => {
  // ── AGENT_SPECS ───────────────────────────────────────────────

  describe('AGENT_SPECS', () => {
    it('has all 5 agent types', () => {
      expect(Object.keys(AGENT_SPECS)).toHaveLength(5);
      expect(AGENT_SPECS.researcher).toBeDefined();
      expect(AGENT_SPECS.architect).toBeDefined();
      expect(AGENT_SPECS.coder).toBeDefined();
      expect(AGENT_SPECS.reviewer).toBeDefined();
      expect(AGENT_SPECS.tester).toBeDefined();
    });

    it('each agent has required fields', () => {
      for (const spec of Object.values(AGENT_SPECS)) {
        expect(spec.name).toBeDefined();
        expect(spec.icon).toBeDefined();
        expect(spec.description).toBeDefined();
        expect(spec.capabilities.length).toBeGreaterThan(0);
        expect(spec.systemPrompt.length).toBeGreaterThan(0);
      }
    });
  });

  // ── createOrchestrationPlan ───────────────────────────────────

  describe('createOrchestrationPlan', () => {
    it('creates a project plan with 5 tasks', () => {
      const plan = createOrchestrationPlan('Build a todo app', 'project');
      expect(plan.tasks).toHaveLength(5);
      expect(plan.id).toContain('plan_');
    });

    it('creates a feature plan', () => {
      const plan = createOrchestrationPlan('Add dark mode', 'feature');
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.name).toBeDefined();
    });

    it('creates a bugfix plan', () => {
      const plan = createOrchestrationPlan('Fix login crash', 'bugfix');
      expect(plan.tasks.length).toBeGreaterThan(0);
    });

    it('creates a review plan', () => {
      const plan = createOrchestrationPlan('Review auth module', 'review');
      expect(plan.tasks.length).toBeGreaterThan(0);
    });

    it('sets dependencies between tasks', () => {
      const plan = createOrchestrationPlan('Build app', 'project');
      const codingTask = plan.tasks.find((t) => t.type === 'coder');
      expect(codingTask?.dependencies).toBeDefined();
      expect(codingTask!.dependencies!.length).toBeGreaterThan(0);
    });

    it('includes task description in prompts', () => {
      const plan = createOrchestrationPlan('Add user authentication', 'feature');
      expect(plan.tasks.some((t) => t.prompt.includes('user authentication'))).toBe(true);
    });

    it('generates plan ID with timestamp prefix', () => {
      const plan = createOrchestrationPlan('Task 1', 'project');
      expect(plan.id).toMatch(/^plan_\d+$/);
    });
  });

  // ── getAgentSpec ──────────────────────────────────────────────

  describe('getAgentSpec', () => {
    it('returns researcher spec', () => {
      const spec = getAgentSpec('researcher');
      expect(spec.name).toContain('Research');
    });

    it('returns coder spec', () => {
      const spec = getAgentSpec('coder');
      expect(spec.capabilities.length).toBeGreaterThan(0);
    });

    it('returns all agent types', () => {
      const types: AgentType[] = ['researcher', 'architect', 'coder', 'reviewer', 'tester'];
      for (const type of types) {
        expect(getAgentSpec(type)).toBeDefined();
      }
    });
  });

  // ── listAgents ────────────────────────────────────────────────

  describe('listAgents', () => {
    it('returns all 5 agents', () => {
      const agents = listAgents();
      expect(agents).toHaveLength(5);
    });

    it('includes type field in each agent', () => {
      const agents = listAgents();
      for (const agent of agents) {
        expect(agent.type).toBeDefined();
        expect(['researcher', 'architect', 'coder', 'reviewer', 'tester']).toContain(agent.type);
      }
    });

    it('spreads spec fields into result', () => {
      const agents = listAgents();
      for (const agent of agents) {
        expect(agent.name).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(agent.capabilities).toBeDefined();
      }
    });
  });

  // ── Types ─────────────────────────────────────────────────────

  describe('type exports', () => {
    it('AgentType has valid values', () => {
      const types: AgentType[] = ['researcher', 'architect', 'coder', 'reviewer', 'tester'];
      expect(types).toHaveLength(5);
    });

    it('AgentTask has required shape', () => {
      const task: AgentTask = { id: 't1', type: 'coder', prompt: 'Code it' };
      expect(task.id).toBe('t1');
    });

    it('AgentResult has required shape', () => {
      const result: AgentResult = {
        taskId: 't1',
        agentType: 'coder',
        success: true,
        output: 'done',
        duration: 100,
      };
      expect(result.success).toBe(true);
    });

    it('OrchestrationPlan has required shape', () => {
      const plan: OrchestrationPlan = {
        id: 'p1',
        name: 'Plan',
        description: 'A plan',
        tasks: [],
        createdAt: new Date(),
      };
      expect(plan.tasks).toEqual([]);
    });
  });
});
