/**
 * Tests for specialized agent definitions.
 *
 * Validates all exported agent configs, the agent registry,
 * and helper functions.
 */
import { describe, it, expect } from 'vitest';
import {
  frontendAgent,
  backendAgent,
  testAgent,
  reviewerAgent,
  orchestratorAgent,
  agentRegistry,
  getAgent,
  getSpecializedAgents,
} from './agents';
import type { AgentRole } from './types';

describe('multi-agent/agents', () => {
  // ─── frontendAgent ────────────────────────────────────────────

  describe('frontendAgent', () => {
    it('should have the role "frontend"', () => {
      expect(frontendAgent.role).toBe('frontend');
    });

    it('should have a descriptive name', () => {
      expect(frontendAgent.name).toBe('Frontend Architect');
    });

    it('should have a non-empty description', () => {
      expect(frontendAgent.description.length).toBeGreaterThan(0);
    });

    it('should list at least 5 capabilities', () => {
      expect(frontendAgent.capabilities.length).toBeGreaterThanOrEqual(5);
    });

    it('should include React as a capability', () => {
      const hasReact = frontendAgent.capabilities.some((c) => c.toLowerCase().includes('react'));
      expect(hasReact).toBe(true);
    });

    it('should use the claude-sonnet-4-6 model', () => {
      expect(frontendAgent.model).toBe('claude-sonnet-4-6');
    });

    it('should have maxTokens of 8192', () => {
      expect(frontendAgent.maxTokens).toBe(8192);
    });

    it('should have a non-empty system prompt', () => {
      expect(frontendAgent.systemPrompt.length).toBeGreaterThan(0);
    });
  });

  // ─── backendAgent ─────────────────────────────────────────────

  describe('backendAgent', () => {
    it('should have the role "backend"', () => {
      expect(backendAgent.role).toBe('backend');
    });

    it('should have the name "Backend Engineer"', () => {
      expect(backendAgent.name).toBe('Backend Engineer');
    });

    it('should list at least 5 capabilities', () => {
      expect(backendAgent.capabilities.length).toBeGreaterThanOrEqual(5);
    });

    it('should include API design as a capability', () => {
      const hasAPI = backendAgent.capabilities.some((c) => c.toLowerCase().includes('api'));
      expect(hasAPI).toBe(true);
    });

    it('should use the claude-sonnet-4-6 model', () => {
      expect(backendAgent.model).toBe('claude-sonnet-4-6');
    });

    it('should have maxTokens of 8192', () => {
      expect(backendAgent.maxTokens).toBe(8192);
    });

    it('should have a system prompt mentioning security', () => {
      expect(backendAgent.systemPrompt.toLowerCase()).toContain('security');
    });
  });

  // ─── testAgent ────────────────────────────────────────────────

  describe('testAgent', () => {
    it('should have the role "test"', () => {
      expect(testAgent.role).toBe('test');
    });

    it('should have the name "Test Engineer"', () => {
      expect(testAgent.name).toBe('Test Engineer');
    });

    it('should list at least 5 capabilities', () => {
      expect(testAgent.capabilities.length).toBeGreaterThanOrEqual(5);
    });

    it('should include unit testing capability', () => {
      const hasUnit = testAgent.capabilities.some(
        (c) =>
          c.toLowerCase().includes('unit test') ||
          c.toLowerCase().includes('jest') ||
          c.toLowerCase().includes('vitest')
      );
      expect(hasUnit).toBe(true);
    });

    it('should use the claude-sonnet-4-6 model', () => {
      expect(testAgent.model).toBe('claude-sonnet-4-6');
    });
  });

  // ─── reviewerAgent ────────────────────────────────────────────

  describe('reviewerAgent', () => {
    it('should have the role "reviewer"', () => {
      expect(reviewerAgent.role).toBe('reviewer');
    });

    it('should have the name "Code Reviewer"', () => {
      expect(reviewerAgent.name).toBe('Code Reviewer');
    });

    it('should list at least 5 capabilities', () => {
      expect(reviewerAgent.capabilities.length).toBeGreaterThanOrEqual(5);
    });

    it('should include security-related capability', () => {
      const hasSecurity = reviewerAgent.capabilities.some((c) =>
        c.toLowerCase().includes('security')
      );
      expect(hasSecurity).toBe(true);
    });

    it('should use the claude-sonnet-4-6 model', () => {
      expect(reviewerAgent.model).toBe('claude-sonnet-4-6');
    });
  });

  // ─── orchestratorAgent ────────────────────────────────────────

  describe('orchestratorAgent', () => {
    it('should have the role "orchestrator"', () => {
      expect(orchestratorAgent.role).toBe('orchestrator');
    });

    it('should have the name "Task Orchestrator"', () => {
      expect(orchestratorAgent.name).toBe('Task Orchestrator');
    });

    it('should use a lower maxTokens than specialized agents', () => {
      expect(orchestratorAgent.maxTokens).toBeLessThan(frontendAgent.maxTokens);
    });

    it('should have maxTokens of 2048', () => {
      expect(orchestratorAgent.maxTokens).toBe(2048);
    });

    it('should have a system prompt that references JSON output', () => {
      expect(orchestratorAgent.systemPrompt.toLowerCase()).toContain('json');
    });
  });

  // ─── agentRegistry ───────────────────────────────────────────

  describe('agentRegistry', () => {
    it('should contain all 5 agent roles', () => {
      const roles: AgentRole[] = ['frontend', 'backend', 'test', 'reviewer', 'orchestrator'];
      for (const role of roles) {
        expect(agentRegistry[role]).toBeDefined();
      }
    });

    it('should map frontend to frontendAgent', () => {
      expect(agentRegistry.frontend).toBe(frontendAgent);
    });

    it('should map backend to backendAgent', () => {
      expect(agentRegistry.backend).toBe(backendAgent);
    });

    it('should map test to testAgent', () => {
      expect(agentRegistry.test).toBe(testAgent);
    });

    it('should map reviewer to reviewerAgent', () => {
      expect(agentRegistry.reviewer).toBe(reviewerAgent);
    });

    it('should map orchestrator to orchestratorAgent', () => {
      expect(agentRegistry.orchestrator).toBe(orchestratorAgent);
    });

    it('should have exactly 5 entries', () => {
      expect(Object.keys(agentRegistry)).toHaveLength(5);
    });
  });

  // ─── getAgent() ───────────────────────────────────────────────

  describe('getAgent()', () => {
    it('should return the frontend agent for role "frontend"', () => {
      const agent = getAgent('frontend');
      expect(agent).toBe(frontendAgent);
    });

    it('should return the backend agent for role "backend"', () => {
      const agent = getAgent('backend');
      expect(agent).toBe(backendAgent);
    });

    it('should return the test agent for role "test"', () => {
      const agent = getAgent('test');
      expect(agent).toBe(testAgent);
    });

    it('should return the reviewer agent for role "reviewer"', () => {
      const agent = getAgent('reviewer');
      expect(agent).toBe(reviewerAgent);
    });

    it('should return the orchestrator agent for role "orchestrator"', () => {
      const agent = getAgent('orchestrator');
      expect(agent).toBe(orchestratorAgent);
    });
  });

  // ─── getSpecializedAgents() ───────────────────────────────────

  describe('getSpecializedAgents()', () => {
    it('should return exactly 4 agents', () => {
      const agents = getSpecializedAgents();
      expect(agents).toHaveLength(4);
    });

    it('should not include the orchestrator agent', () => {
      const agents = getSpecializedAgents();
      const roles = agents.map((a) => a.role);
      expect(roles).not.toContain('orchestrator');
    });

    it('should include the frontend agent', () => {
      const agents = getSpecializedAgents();
      expect(agents).toContain(frontendAgent);
    });

    it('should include the backend agent', () => {
      const agents = getSpecializedAgents();
      expect(agents).toContain(backendAgent);
    });

    it('should include the test agent', () => {
      const agents = getSpecializedAgents();
      expect(agents).toContain(testAgent);
    });

    it('should include the reviewer agent', () => {
      const agents = getSpecializedAgents();
      expect(agents).toContain(reviewerAgent);
    });

    it('should return agents in the order: frontend, backend, test, reviewer', () => {
      const agents = getSpecializedAgents();
      expect(agents[0].role).toBe('frontend');
      expect(agents[1].role).toBe('backend');
      expect(agents[2].role).toBe('test');
      expect(agents[3].role).toBe('reviewer');
    });
  });

  // ─── Cross-cutting agent config validation ────────────────────

  describe('agent config consistency', () => {
    const allAgents = [frontendAgent, backendAgent, testAgent, reviewerAgent, orchestratorAgent];

    it('every agent should have a non-empty name', () => {
      for (const agent of allAgents) {
        expect(agent.name.length).toBeGreaterThan(0);
      }
    });

    it('every agent should have a non-empty description', () => {
      for (const agent of allAgents) {
        expect(agent.description.length).toBeGreaterThan(0);
      }
    });

    it('every agent should have a capabilities array', () => {
      for (const agent of allAgents) {
        expect(Array.isArray(agent.capabilities)).toBe(true);
      }
    });

    it('every agent should have maxTokens > 0', () => {
      for (const agent of allAgents) {
        expect(agent.maxTokens).toBeGreaterThan(0);
      }
    });

    it('every agent should have a valid model value', () => {
      const validModels = ['claude-opus-4-6', 'claude-sonnet-4-6'];
      for (const agent of allAgents) {
        expect(validModels).toContain(agent.model);
      }
    });
  });
});
