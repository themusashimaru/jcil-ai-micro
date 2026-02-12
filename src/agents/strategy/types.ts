/**
 * DEEP STRATEGY AGENT - TYPE DEFINITIONS
 *
 * The most advanced self-replicating AI agent ever built.
 * Uses Opus 4.5 for architecture, Sonnet 4.5 for management, Haiku 4.5 for execution.
 *
 * This agent can spawn up to 100 sub-agents dynamically based on the problem.
 */

// =============================================================================
// MODEL CONFIGURATION
// =============================================================================

/**
 * Agent mode - determines which prompt set the engine uses.
 * The engine is mode-agnostic; only the prompts change.
 */
export type AgentMode = 'strategy' | 'research' | 'quick-research' | 'quick-strategy' | 'deep-writer' | 'quick-writer';

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export interface ModelConfig {
  id: string;
  tier: ModelTier;
  costPerMillionInput: number;
  costPerMillionOutput: number;
  maxTokens: number;
  description: string;
}

// =============================================================================
// SAFETY & LIMITS
// =============================================================================

export interface StrategyLimits {
  maxBudget: number; // $20 max
  maxScouts: number; // 100 max agents
  maxSearches: number; // 500 max Brave searches
  maxTimeMinutes: number; // 10 minute timeout
  maxDepth: number; // 50 levels deep max
  maxConcurrentCalls: number; // 10 simultaneous API calls
  batchDelayMs: number; // Delay between batches
  minConfidenceScore: number; // Minimum quality threshold
  maxErrorRate: number; // Error rate that triggers kill
}

export interface CostTracker {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  searchCost: number;
  breakdown: {
    opus: { tokens: number; cost: number };
    sonnet: { tokens: number; cost: number };
    haiku: { tokens: number; cost: number };
    brave: { queries: number; cost: number };
  };
}

export type KillReason =
  | 'budget_exceeded'
  | 'time_exceeded'
  | 'error_rate_exceeded'
  | 'user_cancelled'
  | 'quality_control_failed'
  | 'infinite_loop_detected'
  | 'manual_kill';

// =============================================================================
// INTAKE & PROBLEM ANALYSIS
// =============================================================================

export interface UserProblem {
  rawInput: string; // Original user input
  clarifyingResponses: string[]; // User's responses to follow-up questions
  synthesizedProblem: SynthesizedProblem;
  intakeTimestamp: number;
  intakeComplete: boolean;
}

export interface SynthesizedProblem {
  summary: string; // One paragraph summary
  coreQuestion: string; // The fundamental question to answer
  constraints: string[]; // Limitations (budget, time, location, etc.)
  priorities: PriorityItem[]; // Ranked priorities
  stakeholders: string[]; // Who is affected
  timeframe: string; // When does this need to be decided
  riskTolerance: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex' | 'extreme';
  domains: string[]; // Areas to research (housing, career, finance, etc.)
  hiddenFactors: string[]; // Things user might not have mentioned
  successCriteria: string[]; // What does a good outcome look like
}

export interface PriorityItem {
  factor: string;
  importance: number; // 1-10
  isNegotiable: boolean;
}

// =============================================================================
// AGENT BLUEPRINTS - Self-Designing Agents
// =============================================================================

export interface AgentBlueprint {
  id: string;
  name: string; // e.g., "Jersey City Housing Scout"
  role: string; // e.g., "Real estate research specialist"
  expertise: string[]; // e.g., ["NJ housing market", "transit accessibility"]
  purpose: string; // What this agent will accomplish
  keyQuestions: string[]; // Questions this agent must answer
  researchApproach: ResearchApproach;
  dataSources: string[]; // Where to look
  searchQueries: string[]; // Specific queries to run
  deliverable: string; // What it produces
  outputFormat: OutputFormat;
  modelTier: ModelTier; // Which model to use
  priority: number; // Execution priority (1-10)
  estimatedSearches: number; // How many Brave searches
  parentId?: string; // If this is a sub-agent
  depth: number; // How deep in the hierarchy
  canSpawnChildren: boolean; // Can this agent create sub-agents
  maxChildren: number; // Max sub-agents it can create
  // Tool capabilities (NEW)
  tools?: ScoutToolType[]; // Which tools this scout can use
  browserTargets?: string[]; // Specific URLs to visit with browser
}

export type ResearchApproach =
  | 'broad_scan' // Quick overview
  | 'deep_dive' // Comprehensive research
  | 'comparative' // Compare options
  | 'risk_analysis' // Assess risks
  | 'opportunity_scan' // Find opportunities
  | 'validation' // Verify information
  | 'synthesis'; // Combine findings

export type ScoutToolType =
  | 'brave_search' // Web search via Brave API
  | 'browser_visit' // Visit URLs with E2B + Puppeteer
  | 'run_code' // Execute Python/JS in E2B sandbox
  | 'screenshot' // Capture page screenshots
  | 'vision_analyze' // Claude Vision screenshot analysis
  | 'extract_table' // Extract pricing tables via Vision AI
  | 'compare_screenshots' // Side-by-side comparison of multiple URLs
  | 'safe_form_fill' // Fill search/filter forms (blocked: login, signup, payment)
  | 'paginate' // Navigate through multi-page results
  | 'infinite_scroll' // Handle infinite scroll pages
  | 'click_navigate' // Click elements and extract resulting content
  | 'extract_pdf' // Download and extract text from PDFs
  | 'generate_comparison'; // Create formatted comparison tables

export type OutputFormat =
  | 'summary' // Brief text summary
  | 'bullet_points' // Key points
  | 'comparison_matrix' // Table comparing options
  | 'comparison_table' // Alias for comparison_matrix (used in prompts)
  | 'swot_analysis' // Strengths/Weaknesses/Opportunities/Threats
  | 'risk_assessment' // Risk matrix
  | 'recommendation' // Specific recommendation with reasoning
  | 'action_plan' // Step-by-step plan
  | 'data_table'; // Raw data in table format

// =============================================================================
// AGENT HIERARCHY
// =============================================================================

export interface AgentHierarchy {
  masterArchitect: MasterArchitectState;
  qualityControl: QualityControlState;
  projectManagers: ProjectManagerState[];
  scouts: ScoutState[];
  totalAgents: number;
  activeAgents: number;
  completedAgents: number;
  failedAgents: number;
}

export interface MasterArchitectState {
  status: AgentStatus;
  blueprintsCreated: number;
  lastAction: string;
  thinking?: string; // Current reasoning
}

export interface QualityControlState {
  status: AgentStatus;
  issuesFound: QualityIssue[];
  killSwitchTriggered: boolean;
  killReason?: KillReason;
  overallQualityScore: number;
  lastCheck: number;
}

export interface ProjectManagerState {
  id: string;
  name: string;
  domain: string; // e.g., "Housing", "Career", "Finance"
  status: AgentStatus;
  assignedScouts: string[];
  completedScouts: number;
  findings: Finding[];
  synthesizedReport?: string;
}

export interface ScoutState {
  id: string;
  blueprintId: string;
  name: string;
  status: AgentStatus;
  progress: number; // 0-100
  searchesCompleted: number;
  searchesTotal: number;
  findings: Finding[];
  errors: string[];
  startTime: number;
  endTime?: number;
  tokensUsed: number;
  costIncurred: number;
}

export type AgentStatus =
  | 'pending'
  | 'initializing'
  | 'researching'
  | 'synthesizing'
  | 'complete'
  | 'failed'
  | 'killed';

// =============================================================================
// FINDINGS & RESULTS
// =============================================================================

export interface Finding {
  id: string;
  agentId: string;
  agentName: string;
  type: FindingType;
  title: string;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  sources: SourceCitation[];
  dataPoints?: DataPoint[];
  timestamp: number;
  relevanceScore: number; // 0-1, how relevant to the problem
}

export type FindingType =
  | 'fact' // Verified information
  | 'insight' // Analysis/interpretation
  | 'recommendation' // Suggested action
  | 'warning' // Risk or concern
  | 'opportunity' // Potential benefit
  | 'comparison' // Comparison data
  | 'data' // Raw data point
  | 'gap'; // Missing information

export interface DataPoint {
  label: string;
  value: string | number;
  unit?: string;
  source?: string;
  timestamp?: number;
}

export interface SourceCitation {
  title: string;
  url?: string;
  type: 'web' | 'search' | 'analysis' | 'calculation';
  accessedAt: number;
  reliability: 'high' | 'medium' | 'low';
}

// =============================================================================
// QUALITY CONTROL
// =============================================================================

export interface QualityIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: QualityIssueType;
  description: string;
  affectedAgents: string[];
  suggestedAction: QualityAction;
  resolved: boolean;
  timestamp: number;
}

export type QualityIssueType =
  | 'low_confidence' // Findings have low confidence
  | 'conflicting_data' // Agents found contradicting info
  | 'insufficient_coverage' // Not enough research on a topic
  | 'high_error_rate' // Too many agent failures
  | 'budget_warning' // Approaching budget limit
  | 'time_warning' // Approaching time limit
  | 'stale_data' // Data might be outdated
  | 'missing_critical'; // Missing info on critical topic

export type QualityAction =
  | 'continue' // Keep going
  | 'spawn_more_agents' // Create additional scouts
  | 'redirect_focus' // Change research direction
  | 'request_user_input' // Ask user for clarification
  | 'pause_and_review' // Halt for manual review
  | 'kill'; // Stop everything

// =============================================================================
// EXECUTION QUEUE
// =============================================================================

export interface QueuedTask {
  id: string;
  type: TaskType;
  agentId: string;
  priority: number;
  payload: unknown;
  status: 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
}

export type TaskType =
  | 'agent_execution' // Run an agent
  | 'brave_search' // Execute a web search
  | 'synthesis' // Synthesize results
  | 'quality_check'; // Run quality check

export interface QueueProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  queued: number;
  estimatedTimeRemaining: number;
  currentBatch: number;
  totalBatches: number;
}

// =============================================================================
// FINAL STRATEGY OUTPUT
// =============================================================================

export interface StrategyOutput {
  id: string;
  problem: SynthesizedProblem;

  // Top-line recommendation
  recommendation: StrategyRecommendation;

  // Alternative options
  alternatives: StrategyAlternative[];

  // Detailed analysis
  analysis: {
    byDomain: DomainAnalysis[];
    riskAssessment: RiskAssessment;
    financialImpact?: FinancialAnalysis;
    timeline?: TimelineAnalysis;
  };

  // Action plan
  actionPlan: ActionItem[];

  // What we couldn't find
  gaps: string[];

  // Follow-up suggestions
  nextSteps: string[];

  // Written document (for writer modes — creative, articles, etc.)
  document?: {
    title: string;
    content: string;
    citations?: string[];
  };

  // Metadata
  metadata: StrategyMetadata;
}

export interface StrategyRecommendation {
  title: string; // e.g., "Move to Jersey City"
  summary: string; // 2-3 sentence summary
  confidence: number; // 0-100
  reasoning: string[]; // Why this recommendation
  tradeoffs: string[]; // What you give up
  bestFor: string; // "Best for people who..."
}

export interface StrategyAlternative {
  title: string;
  summary: string;
  confidence: number;
  whyNotTop: string; // Why it's not the top choice
  bestFor: string;
}

export interface DomainAnalysis {
  domain: string; // e.g., "Housing", "Career"
  summary: string;
  keyFindings: Finding[];
  comparisonTable?: ComparisonTable;
  recommendation?: string;
}

export interface ComparisonTable {
  headers: string[];
  rows: ComparisonRow[];
}

export interface ComparisonRow {
  option: string;
  values: (string | number)[];
  score?: number;
  highlight?: boolean;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  risks: RiskItem[];
  mitigations: string[];
}

export interface RiskItem {
  risk: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface FinancialAnalysis {
  summary: string;
  costs: DataPoint[];
  savings?: DataPoint[];
  breakEven?: string;
  recommendations: string[];
}

export interface TimelineAnalysis {
  summary: string;
  phases: TimelinePhase[];
  criticalDates?: string[];
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  actions: string[];
  dependencies?: string[];
}

export interface ActionItem {
  order: number;
  action: string;
  timeframe: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  details?: string;
  resources?: string[];
}

export interface StrategyMetadata {
  executionTime: number;
  totalAgents: number;
  totalSearches: number;
  totalCost: number;
  confidenceScore: number;
  completedAt: number;
  modelUsage: {
    opus: { calls: number; tokens: number };
    sonnet: { calls: number; tokens: number };
    haiku: { calls: number; tokens: number };
  };
  qualityScore: number;
}

// =============================================================================
// STREAMING EVENTS
// =============================================================================

export type StrategyStreamEventType =
  | 'intake_start'
  | 'intake_question'
  | 'intake_complete'
  | 'architect_designing'
  | 'agent_spawned'
  | 'agent_progress'
  | 'agent_complete'
  | 'agent_failed'
  | 'search_executing'
  | 'search_complete'
  | 'browser_visiting'
  | 'screenshot_captured'
  | 'code_executing'
  // New tool events
  | 'vision_analyzing'
  | 'table_extracting'
  | 'form_filling'
  | 'paginating'
  | 'scrolling'
  | 'pdf_extracting'
  | 'comparing'
  | 'finding_discovered'
  | 'quality_check'
  | 'quality_issue'
  | 'synthesis_starting'
  | 'synthesis_complete'
  | 'synthesis_error'
  | 'quick_synthesis'
  | 'synthesis_start'
  | 'synthesis_progress'
  | 'strategy_complete'
  | 'user_context_added'
  | 'error'
  | 'kill_switch';

export interface StrategyStreamEvent {
  type: StrategyStreamEventType;
  message: string;
  timestamp: number;
  data?: {
    agentId?: string;
    agentName?: string;
    progress?: number;
    totalAgents?: number;
    completedAgents?: number;
    cost?: number;
    finding?: Finding;
    issue?: QualityIssue;
    phase?: string;
    searchQuery?: string;
    url?: string;
    language?: string;
    error?: string;
    // New tool event data
    prompt?: string;
    maxPages?: number;
    urlCount?: number;
    killReason?: KillReason;
    // Completion event data
    result?: StrategyOutput;
    artifacts?: Artifact[];
    output?: StrategyOutput;
  };
}

export type StrategyStreamCallback = (event: StrategyStreamEvent) => void;

// =============================================================================
// AGENT CONTEXT
// =============================================================================

// Attachment for strategy (documents, images, etc.)
export interface StrategyAttachment {
  name: string;
  type: string; // MIME type
  content: string; // base64 encoded
}

export interface StrategyContext {
  userId: string;
  sessionId: string;
  isAdmin: boolean;
  startTime: number;
  limits: StrategyLimits;
  costTracker: CostTracker;
  mode?: AgentMode; // Which prompt set to use (default: 'strategy')
  problem?: UserProblem;
  hierarchy?: AgentHierarchy;
  queue?: QueueProgress;
  attachments?: StrategyAttachment[];
  userContext?: string[]; // Mid-execution context messages from user
}

// =============================================================================
// KNOWLEDGE BASE - Persistent Memory
// =============================================================================

export interface KnowledgeEntry {
  id: string;
  userId: string;
  sessionId: string;
  agentMode: AgentMode;
  findingType: string;
  title: string;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  relevanceScore: number;
  sources: SourceCitation[];
  dataPoints: DataPoint[];
  domain?: string;
  topicTags: string[];
  searchQueries: string[];
  scoutName?: string;
  scoutToolsUsed: string[];
  createdAt: number;
}

export interface KnowledgeQuery {
  userId: string;
  searchText?: string;
  domain?: string;
  tags?: string[];
  agentMode?: AgentMode;
  limit?: number;
  minRelevance?: number;
}

export interface KnowledgeContext {
  entries: KnowledgeEntry[];
  summary: string;
  domains: string[];
  totalFindings: number;
}

// =============================================================================
// SCOUT PERFORMANCE - Learning System
// =============================================================================

export interface ScoutPerformanceRecord {
  scoutId: string;
  scoutName: string;
  scoutRole?: string;
  expertise: string[];
  modelTier: ModelTier;
  toolsAssigned: string[];
  researchApproach?: string;
  searchQueries: string[];
  browserTargets: string[];
  findingsCount: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  avgRelevanceScore: number;
  executionTimeMs: number;
  tokensUsed: number;
  costIncurred: number;
  searchesExecuted: number;
  pagesVisited: number;
  screenshotsTaken: number;
  toolCallsTotal: number;
  toolCallsSucceeded: number;
  toolCallsFailed: number;
  status: 'pending' | 'complete' | 'failed' | 'killed';
  errorMessage?: string;
  spawnedChildren: number;
  gapsIdentified: string[];
  domain?: string;
  problemComplexity?: string;
}

export interface PerformanceInsight {
  toolCombo: string[];
  avgFindingsCount: number;
  avgConfidenceScore: number;
  avgRelevanceScore: number;
  successRate: number;
  avgExecutionTimeMs: number;
  sampleSize: number;
}

// =============================================================================
// STEERING - Real-time Execution Control
// =============================================================================

export type SteeringAction =
  | 'kill_domain' // Kill all scouts in a domain
  | 'kill_scout' // Kill a specific scout
  | 'focus_domain' // Reallocate budget to a domain
  | 'spawn_scouts' // Spawn additional scouts
  | 'pause' // Pause execution
  | 'resume' // Resume execution
  | 'adjust_budget' // Change budget allocation
  | 'redirect'; // General redirect instruction

export interface SteeringCommand {
  action: SteeringAction;
  target?: string; // Domain name, scout ID, etc.
  message: string; // Original user message
  parameters?: {
    domain?: string;
    scoutCount?: number;
    budgetPercent?: number;
    queries?: string[];
    focus?: string;
  };
  timestamp: number;
}

// =============================================================================
// ARTIFACTS - Generated Deliverables
// =============================================================================

export type ArtifactType = 'chart' | 'table' | 'csv' | 'report';

export interface Artifact {
  id: string;
  sessionId: string;
  type: ArtifactType;
  title: string;
  description?: string;
  mimeType: string;
  fileName: string;
  contentBase64?: string; // For binary content (images, PDFs)
  contentText?: string; // For text content (CSV, markdown)
  sizeBytes: number;
  createdAt: number;
}
