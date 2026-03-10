/**
 * Tests for the multi-agent barrel export (index.ts).
 *
 * Ensures all public types, constants, and functions are
 * correctly re-exported from the package entry point.
 */
import { describe, it, expect, vi } from 'vitest';

// ── Mocks must be declared before the module-under-test import ──

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

// ── Now import from the barrel entry point ──────────────────────

import * as MultiAgent from './index';

describe('multi-agent/index (barrel exports)', () => {
  // ── Types module re-exports (runtime values are not exported for
  //    pure types, but we verify the module loads without error) ───

  it('should export the module without errors', () => {
    expect(MultiAgent).toBeDefined();
  });

  // ── agents.ts re-exports ──────────────────────────────────────

  it('should export frontendAgent', () => {
    expect(MultiAgent.frontendAgent).toBeDefined();
    expect(MultiAgent.frontendAgent.role).toBe('frontend');
  });

  it('should export backendAgent', () => {
    expect(MultiAgent.backendAgent).toBeDefined();
    expect(MultiAgent.backendAgent.role).toBe('backend');
  });

  it('should export testAgent', () => {
    expect(MultiAgent.testAgent).toBeDefined();
    expect(MultiAgent.testAgent.role).toBe('test');
  });

  it('should export reviewerAgent', () => {
    expect(MultiAgent.reviewerAgent).toBeDefined();
    expect(MultiAgent.reviewerAgent.role).toBe('reviewer');
  });

  it('should export orchestratorAgent', () => {
    expect(MultiAgent.orchestratorAgent).toBeDefined();
    expect(MultiAgent.orchestratorAgent.role).toBe('orchestrator');
  });

  it('should export agentRegistry', () => {
    expect(MultiAgent.agentRegistry).toBeDefined();
    expect(Object.keys(MultiAgent.agentRegistry)).toHaveLength(5);
  });

  it('should export getAgent as a function', () => {
    expect(typeof MultiAgent.getAgent).toBe('function');
  });

  it('should export getSpecializedAgents as a function', () => {
    expect(typeof MultiAgent.getSpecializedAgents).toBe('function');
  });

  // ── orchestrator.ts re-exports ────────────────────────────────

  it('should export orchestrate as a function', () => {
    expect(typeof MultiAgent.orchestrate).toBe('function');
  });

  it('should export orchestrateStream as a function', () => {
    expect(typeof MultiAgent.orchestrateStream).toBe('function');
  });

  it('should export shouldUseMultiAgent as a function', () => {
    expect(typeof MultiAgent.shouldUseMultiAgent).toBe('function');
  });

  it('should export getSuggestedAgents as a function', () => {
    expect(typeof MultiAgent.getSuggestedAgents).toBe('function');
  });

  it('should export planOrchestration as a function', () => {
    expect(typeof MultiAgent.planOrchestration).toBe('function');
  });

  it('should export executeAgent as a function', () => {
    expect(typeof MultiAgent.executeAgent).toBe('function');
  });

  it('should export executeMultiAgent as a function', () => {
    expect(typeof MultiAgent.executeMultiAgent).toBe('function');
  });

  // ── Functional verification through barrel ────────────────────

  it('getAgent via barrel should return the correct agent', () => {
    const agent = MultiAgent.getAgent('frontend');
    expect(agent).toBe(MultiAgent.frontendAgent);
  });

  it('getSpecializedAgents via barrel should exclude orchestrator', () => {
    const agents = MultiAgent.getSpecializedAgents();
    expect(agents).toHaveLength(4);
    const roles = agents.map((a: { role: string }) => a.role);
    expect(roles).not.toContain('orchestrator');
  });

  it('shouldUseMultiAgent via barrel should detect multi-agent triggers', () => {
    expect(MultiAgent.shouldUseMultiAgent('Use multi-agent mode')).toBe(true);
    expect(MultiAgent.shouldUseMultiAgent('Fix a typo')).toBe(false);
  });

  it('getSuggestedAgents via barrel should suggest agents from keywords', () => {
    const agents = MultiAgent.getSuggestedAgents('Build a react component');
    expect(agents).toContain('frontend');
  });
});
