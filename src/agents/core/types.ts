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
