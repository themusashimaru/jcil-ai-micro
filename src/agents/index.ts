/**
 * JCIL AGENTS
 *
 * Enterprise-grade AI agent system.
 * Dynamic, self-evaluating, streaming-first architecture.
 */

// Core infrastructure
export * from './core';

// Research Agent
export { researchAgent, ResearchAgent } from './research';

// Agent registry for easy access
import { researchAgent } from './research';
import { IAgent } from './core/types';

export const agents: Record<string, IAgent<unknown, unknown>> = {
  research: researchAgent as IAgent<unknown, unknown>,
};

/**
 * Get an agent by name
 */
export function getAgent(name: string): IAgent<unknown, unknown> | undefined {
  return agents[name];
}

/**
 * List all available agents
 */
export function listAgents(): string[] {
  return Object.keys(agents);
}
