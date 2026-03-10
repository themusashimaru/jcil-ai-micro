/**
 * JCIL AGENTS
 *
 * Enterprise-grade AI agent system.
 * Dynamic, self-evaluating, streaming-first architecture.
 *
 * Note: Research Agent has been replaced by quick-research mode
 * which uses the strategy engine. See /src/agents/strategy/
 */

// Core infrastructure
export * from './core';

// Strategy Agent (Deep Strategy, Deep Research, Quick Research)
// Note: Using specific exports to avoid naming conflicts with core
export {
  createStrategyAgent,
  createExecutionQueue,
  getSessionArtifacts,
  type StrategyAgent,
  type StrategyStreamEvent,
  type StrategyOutput,
  type Finding,
  type AgentMode,
  type Artifact,
} from './strategy';
