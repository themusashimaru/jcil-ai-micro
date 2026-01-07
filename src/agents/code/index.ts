/**
 * CODE AGENT MODULE
 *
 * Enterprise-grade autonomous code generation system.
 * Powered by Claude Opus 4.5.
 *
 * Capabilities:
 * - Advanced reasoning (Chain-of-Thought, Tree-of-Thought)
 * - Self-reflection and self-healing
 * - Security scanning (OWASP Top 10)
 * - Performance analysis
 * - Automated test generation
 * - Documentation generation
 * - Memory and learning
 * - GitHub integration
 */

// ============================================================================
// MAIN AGENTS
// ============================================================================

// V1 Agent (backwards compatibility)
export { codeAgent, CodeAgent } from './CodeAgent';
export type { CodeAgentInput } from './CodeAgent';

// V2 Agent (THE ULTIMATE)
export { codeAgentV2, CodeAgentV2 } from './CodeAgentV2';
export type { CodeAgentV2Input, CodeAgentV2Output } from './CodeAgentV2';

// ============================================================================
// BRAIN MODULES
// ============================================================================

// Core
export { codeIntentAnalyzer, CodeIntentAnalyzer } from './brain/IntentAnalyzer';
export type { ClarificationResult, ClarifyingQuestion } from './brain/IntentAnalyzer';
export { projectPlanner, ProjectPlanner } from './brain/ProjectPlanner';
export { codeGenerator, CodeGenerator } from './brain/CodeGenerator';
export { errorAnalyzer, ErrorAnalyzer } from './brain/ErrorAnalyzer';

// Advanced Reasoning
export { reasoner, Reasoner, ChainOfThought, TreeOfThought, SelfReflector } from './brain/Reasoner';
export type { ThoughtNode, ReasoningPath, ReasoningResult, SelfReflection } from './brain/Reasoner';

// Analysis
export { codebaseAnalyzer, CodebaseAnalyzer } from './brain/CodebaseAnalyzer';
export type { CodebaseProfile, FrameworkInfo, ArchitectureInfo, CodingConventions } from './brain/CodebaseAnalyzer';
export { securityScanner, SecurityScanner } from './brain/SecurityScanner';
export type { SecurityVulnerability, SecurityScanResult } from './brain/SecurityScanner';
export { performanceAnalyzer, PerformanceAnalyzer } from './brain/PerformanceAnalyzer';
export type { PerformanceIssue, PerformanceReport } from './brain/PerformanceAnalyzer';

// Generation
export { testGenerator, TestGenerator } from './brain/TestGenerator';
export type { TestSuite, TestCase, TestGenerationResult } from './brain/TestGenerator';
export { docGenerator, DocGenerator } from './brain/DocGenerator';
export type { DocumentationResult, DocConfig } from './brain/DocGenerator';

// Auto-fix
export { autoFixer, AutoFixer } from './brain/AutoFixer';
export type { CodeIssue, Fix, FixResult } from './brain/AutoFixer';

// Memory
export { memorySystem, MemorySystem } from './brain/MemorySystem';
export type { UserProfile, CodingPreferences, ContextMemory } from './brain/MemorySystem';

// ============================================================================
// TOOLS
// ============================================================================

export { toolOrchestrator, ToolOrchestrator } from './tools/ToolOrchestrator';
export { readTool, ReadTool } from './tools/ReadTool';
export { searchTool, SearchTool } from './tools/SearchTool';
export { bashTool, BashTool } from './tools/BashTool';
export type { ToolDefinition, ToolInput, ToolOutput, OrchestratorResult } from './tools';

// ============================================================================
// EXECUTORS
// ============================================================================

export { sandboxExecutor, SandboxExecutor } from './executors/SandboxExecutor';
export { githubExecutor, GitHubExecutor } from './executors/GitHubExecutor';
export type { GitHubPushResult } from './executors/GitHubExecutor';

// ============================================================================
// INTEGRATION
// ============================================================================

export {
  executeCodeAgent,
  shouldUseCodeAgent,
  isCodeReviewRequest,
  generateNoRepoSelectedResponse,
  generateCodeFiles,
  isCodeAgentEnabled,
} from './integration';
