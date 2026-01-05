/**
 * JCIL AGENT CORE TYPES
 *
 * The foundation for all agents in the system.
 * Built for streaming, dynamic execution, and self-evaluation.
 */

// =============================================================================
// STREAMING & PROGRESS
// =============================================================================

export type AgentStreamEventType =
  | 'thinking'      // Agent is planning/analyzing
  | 'searching'     // Executing a search
  | 'evaluating'    // Evaluating results
  | 'pivoting'      // Changing strategy based on results
  | 'synthesizing'  // Creating final output
  | 'complete'      // Done
  | 'error';        // Something went wrong

export interface AgentStreamEvent {
  type: AgentStreamEventType;
  message: string;
  progress?: number;        // 0-100
  phase?: string;           // Current phase name
  details?: unknown;        // Additional data for the UI
  timestamp: number;
}

export type AgentStreamCallback = (event: AgentStreamEvent) => void;

// =============================================================================
// AGENT EXECUTION CONTEXT
// =============================================================================

export interface AgentContext {
  userId: string;
  conversationId?: string;
  previousMessages?: Array<{ role: string; content: string }>;
  userDocuments?: string[];  // RAG context if available
  preferences?: {
    depth?: 'quick' | 'standard' | 'deep';
    maxIterations?: number;
    sources?: string[];
  };
}

// =============================================================================
// AGENT RESULTS
// =============================================================================

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    executionTime: number;
    iterations: number;
    sourcesUsed: string[];
    confidenceScore: number;  // 0-1
  };
}

// =============================================================================
// BASE AGENT INTERFACE
// =============================================================================

export interface IAgent<TInput, TOutput> {
  name: string;
  description: string;
  version: string;

  // Main execution - always streaming
  execute(
    input: TInput,
    context: AgentContext,
    onStream: AgentStreamCallback
  ): Promise<AgentResult<TOutput>>;

  // Can this agent handle this input?
  canHandle(input: unknown): boolean;
}

// =============================================================================
// RESEARCH AGENT SPECIFIC TYPES
// =============================================================================

export interface ResearchIntent {
  originalQuery: string;
  refinedQuery: string;
  topics: string[];
  requiredDepth: 'quick' | 'standard' | 'deep';
  expectedOutputs: string[];  // What the user expects to learn
  contextClues: {
    industry?: string;
    location?: string;
    timeframe?: string;
    competitors?: string[];
  };
}

export interface ResearchStrategy {
  id: string;
  phases: ResearchPhase[];
  maxIterations: number;
  stopConditions: StopCondition[];
  createdAt: number;
}

export interface ResearchPhase {
  id: string;
  name: string;
  type: 'broad_scan' | 'deep_dive' | 'gap_fill' | 'validation';
  queries: GeneratedQuery[];
  sources: ('google' | 'perplexity')[];
  isConditional: boolean;  // Only runs if previous phase has gaps
  dependsOn?: string;      // Phase ID this depends on
}

export interface GeneratedQuery {
  id: string;
  query: string;
  purpose: string;         // Why this query?
  expectedInfo: string[];  // What we expect to find
  source: 'google' | 'perplexity';
  priority: number;        // 1-10, higher = more important
}

export interface StopCondition {
  type: 'coverage_threshold' | 'max_iterations' | 'no_new_info' | 'user_satisfied';
  threshold?: number;
}

// =============================================================================
// SEARCH RESULTS
// =============================================================================

export interface SearchResult {
  id: string;
  query: string;
  source: 'google' | 'perplexity';
  content: string;
  url?: string;
  title?: string;
  timestamp: number;
  relevanceScore?: number;
}

export interface EvaluatedResults {
  results: SearchResult[];
  coverage: {
    score: number;           // 0-1
    topicsCovered: string[];
    topicsMissing: string[];
  };
  quality: {
    score: number;           // 0-1
    conflicts: string[];     // Contradicting information
    gaps: string[];          // Missing information
  };
  recommendation: {
    action: 'continue' | 'pivot' | 'synthesize';
    reason: string;
    suggestedQueries?: GeneratedQuery[];
  };
}

// =============================================================================
// FINAL RESEARCH OUTPUT
// =============================================================================

export interface ResearchOutput {
  executiveSummary: string;
  keyFindings: KeyFinding[];
  detailedSections: ResearchSection[];
  gaps: string[];           // What couldn't be found
  suggestions: string[];    // What user should research next
  sources: SourceCitation[];
  metadata: {
    totalQueries: number;
    iterations: number;
    sourcesUsed: string[];
    confidenceScore: number;
    executionTime: number;
  };
}

export interface KeyFinding {
  finding: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
}

export interface ResearchSection {
  title: string;
  content: string;
  findings: KeyFinding[];
}

export interface SourceCitation {
  id: string;
  title: string;
  url?: string;
  source: 'google' | 'perplexity';
  accessedAt: number;
}

// =============================================================================
// CODE AGENT TYPES - THE MANUS KILLER
// =============================================================================

/**
 * What the user wants to build - deeply analyzed
 */
export interface CodeIntent {
  originalRequest: string;
  refinedDescription: string;
  projectType: ProjectType;
  requirements: {
    functional: string[];      // What it should DO
    technical: string[];       // Technologies/frameworks to use
    constraints: string[];     // Limitations/requirements
  };
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  estimatedFiles: number;
  technologies: TechnologyStack;
  contextClues: {
    hasExistingCode?: boolean;
    targetPlatform?: string;
    integrations?: string[];
  };
}

export type ProjectType =
  | 'web_app'           // React, Next.js, Vue, etc.
  | 'api'               // Express, FastAPI, etc.
  | 'cli'               // Command line tool
  | 'library'           // NPM package, Python module
  | 'script'            // Single file automation
  | 'full_stack'        // Frontend + Backend
  | 'mobile'            // React Native, etc.
  | 'extension'         // Browser extension, VS Code, etc.
  | 'automation'        // Bots, scrapers, workflows
  | 'data'              // Data processing, ML
  | 'unknown';

export interface TechnologyStack {
  primary: string;           // Main language/framework
  secondary: string[];       // Additional libs
  runtime: 'node' | 'python' | 'both';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip';
  buildTool?: string;
  testFramework?: string;
}

/**
 * Project architecture and file structure
 */
export interface ProjectPlan {
  id: string;
  name: string;
  description: string;
  architecture: {
    pattern: string;         // MVC, Clean, Modular, etc.
    layers: ArchitectureLayer[];
    rationale: string;       // Why this architecture
  };
  fileTree: PlannedFile[];
  dependencies: {
    production: Record<string, string>;
    development: Record<string, string>;
  };
  buildSteps: BuildStep[];
  testStrategy: {
    approach: string;
    testFiles: string[];
  };
  risks: string[];
  taskBreakdown: PlanTask[];
}

export interface ArchitectureLayer {
  name: string;
  purpose: string;
  files: string[];
}

export interface PlannedFile {
  path: string;
  purpose: string;
  dependencies: string[];    // Other files this depends on
  priority: number;          // Build order (1 = first)
  estimatedLines: number;
  isEntryPoint?: boolean;
  isConfig?: boolean;
}

export interface BuildStep {
  order: number;
  command: string;
  description: string;
  failureAction: 'stop' | 'continue' | 'retry';
}

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  files: string[];
  estimatedTime?: string;
}

/**
 * Generated code file
 */
export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  purpose: string;
  linesOfCode: number;
  generatedAt: number;
  version: number;
}

/**
 * Sandbox execution result
 */
export interface SandboxTestResult {
  success: boolean;
  phase: 'install' | 'build' | 'test' | 'run';
  outputs: {
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
  }[];
  errors: CodeError[];
  executionTime: number;
}

export interface CodeError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  type: 'syntax' | 'type' | 'runtime' | 'build' | 'test' | 'unknown';
  severity: 'error' | 'warning';
  suggestion?: string;
}

/**
 * Error analysis and fix
 */
export interface ErrorAnalysis {
  error: CodeError;
  rootCause: string;
  suggestedFix: {
    file: string;
    oldCode: string;
    newCode: string;
    explanation: string;
  };
  confidence: 'high' | 'medium' | 'low';
  requiresReplan: boolean;
}

/**
 * Self-evaluation of generated code
 */
export interface CodeEvaluation {
  iteration: number;
  buildStatus: 'success' | 'failed' | 'partial';
  coverage: {
    filesGenerated: number;
    filesPlanned: number;
    percentComplete: number;
  };
  quality: {
    score: number;           // 0-1
    issues: string[];
    strengths: string[];
  };
  recommendation: {
    action: 'continue' | 'fix_errors' | 'replan' | 'deliver';
    reason: string;
    nextSteps?: string[];
  };
}

/**
 * Final Code Agent output
 */
export interface CodeAgentOutput {
  projectName: string;
  description: string;
  files: GeneratedFile[];
  buildResult: SandboxTestResult;
  github?: {
    pushed: boolean;
    repoUrl?: string;
    commitSha?: string;
    error?: string;
  };
  summary: {
    totalFiles: number;
    totalLines: number;
    technologies: string[];
    architecture: string;
  };
  nextSteps: string[];
  metadata: {
    totalIterations: number;
    errorsFixed: number;
    executionTime: number;
    confidenceScore: number;
  };
}
