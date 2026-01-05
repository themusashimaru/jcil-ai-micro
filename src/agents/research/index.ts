/**
 * Research Agent - Main exports
 */

export { researchAgent, ResearchAgent } from './ResearchAgent';
export type { ResearchInput } from './ResearchAgent';
export * from './brain';
export * from './executors';

// Integration with chat route
export {
  shouldUseResearchAgent,
  executeResearchAgent,
  isResearchAgentEnabled,
} from './integration';
