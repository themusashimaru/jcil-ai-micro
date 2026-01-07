/**
 * CODE AGENT BRAIN
 *
 * The cognitive system that powers the Code Agent.
 *
 * Components:
 * - IntentAnalyzer: Understands user requirements
 * - ProjectPlanner: Creates architecture and file structure
 * - CodeGenerator: Generates production-quality code
 * - ErrorAnalyzer: Diagnoses and fixes errors
 * - Reasoner: Chain-of-Thought and Tree-of-Thought reasoning
 * - CodebaseAnalyzer: Understands existing projects
 * - SecurityScanner: Finds vulnerabilities (OWASP, CVE)
 * - PerformanceAnalyzer: Identifies bottlenecks
 * - TestGenerator: Auto-generates comprehensive tests
 * - AutoFixer: Self-heals code issues
 * - DocGenerator: Creates documentation
 * - MemorySystem: Learns and remembers patterns
 *
 * Powered by Claude Opus 4.5.
 */

// Core analysis
export { CodeIntentAnalyzer, codeIntentAnalyzer } from './IntentAnalyzer';
export type { ClarificationResult, ClarifyingQuestion } from './IntentAnalyzer';

// Planning
export { ProjectPlanner, projectPlanner } from './ProjectPlanner';

// Code generation
export { CodeGenerator, codeGenerator } from './CodeGenerator';

// Error handling
export { ErrorAnalyzer, errorAnalyzer } from './ErrorAnalyzer';

// Advanced reasoning
export {
  Reasoner,
  reasoner,
  ChainOfThought,
  TreeOfThought,
  SelfReflector,
} from './Reasoner';
export type {
  ThoughtNode,
  ReasoningPath,
  ReasoningResult,
  SelfReflection,
} from './Reasoner';

// Codebase understanding
export { CodebaseAnalyzer, codebaseAnalyzer } from './CodebaseAnalyzer';
export type {
  CodebaseProfile,
  LanguageBreakdown,
  FrameworkInfo,
  ArchitectureInfo,
  CodingConventions,
  DependencyInfo,
  CodebaseInsight,
} from './CodebaseAnalyzer';

// Security
export { SecurityScanner, securityScanner } from './SecurityScanner';
export type {
  SecurityVulnerability,
  SecurityScanResult,
  VulnerabilityType,
} from './SecurityScanner';

// Performance
export { PerformanceAnalyzer, performanceAnalyzer } from './PerformanceAnalyzer';
export type {
  PerformanceIssue,
  PerformanceReport,
  OptimizationSuggestion,
} from './PerformanceAnalyzer';

// Testing
export { TestGenerator, testGenerator } from './TestGenerator';
export type {
  TestSuite,
  TestCase,
  TestGenerationResult,
  MockDefinition,
} from './TestGenerator';

// Auto-fixing
export { AutoFixer, autoFixer } from './AutoFixer';
export type {
  CodeIssue,
  Fix,
  FixResult,
} from './AutoFixer';

// Documentation
export { DocGenerator, docGenerator } from './DocGenerator';
export type {
  DocumentationResult,
  DocConfig,
} from './DocGenerator';

// Memory & Learning
export { MemorySystem, memorySystem } from './MemorySystem';
export type {
  UserProfile,
  CodingPreferences,
  ProjectHistory,
  LearnedPattern,
  ContextMemory,
} from './MemorySystem';
