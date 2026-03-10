/**
 * MULTI-AGENT ARCHITECTURE
 *
 * A system of specialized AI agents that work together
 * to handle complex software development tasks.
 *
 * Agents:
 * - Frontend Architect: React, UI/UX, CSS
 * - Backend Engineer: APIs, databases, server-side
 * - Test Engineer: Unit tests, E2E, coverage
 * - Code Reviewer: Quality, security, best practices
 *
 * The orchestrator analyzes requests and delegates
 * to the appropriate agent(s).
 */

export * from './types';
export * from './agents';
export {
  orchestrate,
  orchestrateStream,
  shouldUseMultiAgent,
  getSuggestedAgents,
  planOrchestration,
  executeAgent,
  executeMultiAgent,
} from './orchestrator';
