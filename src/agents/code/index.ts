/**
 * CODE AGENT MODULE
 *
 * The MANUS KILLER - Fully autonomous code generation.
 *
 * Export the main agent and integration functions.
 */

// Main agent
export { codeAgent, CodeAgent } from './CodeAgent';
export type { CodeAgentInput } from './CodeAgent';

// Brain components
export { codeIntentAnalyzer, CodeIntentAnalyzer } from './brain/IntentAnalyzer';
export { projectPlanner, ProjectPlanner } from './brain/ProjectPlanner';
export { codeGenerator, CodeGenerator } from './brain/CodeGenerator';
export { errorAnalyzer, ErrorAnalyzer } from './brain/ErrorAnalyzer';

// Executors
export { sandboxExecutor, SandboxExecutor } from './executors/SandboxExecutor';
export { githubExecutor, GitHubExecutor } from './executors/GitHubExecutor';
export type { GitHubPushResult } from './executors/GitHubExecutor';

// Integration
export {
  executeCodeAgent,
  shouldUseCodeAgent,
  generateCodeFiles,
  isCodeAgentEnabled,
} from './integration';
