/**
 * COGNITIVE DEBUGGER TYPES
 *
 * Type definitions for the advanced cognitive debugging system.
 * These types model how a senior engineer thinks about code.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type DebugLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'kotlin'
  | 'swift'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'scala'
  | 'haskell'
  | 'elixir'
  | 'clojure'
  | 'lua'
  | 'perl'
  | 'r'
  | 'julia'
  | 'dart'
  | 'zig'
  | 'nim'
  | 'crystal'
  | 'ocaml'
  | 'fsharp'
  | 'erlang'
  | 'bash'
  | 'powershell'
  | 'sql'
  | 'graphql'
  | 'solidity'
  | 'move'
  | 'cairo'
  | 'unknown';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'certain' | 'high' | 'medium' | 'low' | 'speculative';

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  language?: DebugLanguage;
}

export interface CodeContext {
  code: string;
  language: DebugLanguage;
  file?: string;
  startLine?: number;
  imports?: string[];
  exports?: string[];
  dependencies?: string[];
}

// ============================================================================
// PREDICTIVE ANALYSIS
// ============================================================================

export interface PredictedIssue {
  id: string;
  type:
    | 'runtime_error'
    | 'logic_error'
    | 'type_error'
    | 'null_reference'
    | 'race_condition'
    | 'memory_leak'
    | 'security_vuln'
    | 'performance'
    | 'edge_case'
    | 'integration_failure'
    | 'data_corruption'
    | 'deadlock'
    | 'infinite_loop'
    | 'resource_exhaustion'
    | 'api_misuse';
  location: SourceLocation;
  description: string;
  probability: number; // 0-1, how likely this will occur
  severity: Severity;
  confidence: Confidence;
  conditions: string[]; // Under what conditions this occurs
  preventionStrategy: string;
  suggestedFix?: CodeFix;
  relatedIssues?: string[]; // IDs of related issues
}

export interface PredictiveAnalysisResult {
  issues: PredictedIssue[];
  hotspots: CodeHotspot[]; // High-risk areas
  safetyScore: number; // 0-100, overall code safety
  analysisDepth: 'surface' | 'shallow' | 'deep' | 'exhaustive';
  executionPaths: ExecutionPath[];
  dataFlows: DataFlowPath[];
}

export interface CodeHotspot {
  location: SourceLocation;
  riskLevel: Severity;
  riskFactors: string[];
  complexity: number; // Cyclomatic complexity or similar
  changeFrequency?: number; // How often this code changes
  bugHistory?: number; // Historical bug count
}

// ============================================================================
// INTENT-TO-FAILURE MAPPING
// ============================================================================

export interface UserIntent {
  id: string;
  description: string;
  goals: string[];
  constraints: string[];
  expectedBehavior: string[];
  inputDomain?: DataDomain;
  outputExpectation?: DataDomain;
}

export interface DataDomain {
  type: string;
  range?: { min?: number; max?: number };
  format?: string;
  validValues?: unknown[];
  constraints?: string[];
}

export interface IntentFailureMap {
  intent: UserIntent;
  possibleFailures: FailurePoint[];
  criticalPaths: CriticalPath[];
  assumptionRisks: AssumptionRisk[];
  edgeCases: EdgeCase[];
  successProbability: number;
}

export interface FailurePoint {
  id: string;
  description: string;
  location?: SourceLocation;
  triggerConditions: string[];
  impact: string;
  severity: Severity;
  likelihood: number; // 0-1
  mitigations: Mitigation[];
}

export interface CriticalPath {
  steps: PathStep[];
  failureProbability: number;
  bottlenecks: SourceLocation[];
}

export interface PathStep {
  description: string;
  location?: SourceLocation;
  riskLevel: Severity;
  dependencies: string[];
}

export interface AssumptionRisk {
  assumption: string;
  validity: 'valid' | 'questionable' | 'invalid' | 'untested';
  consequence: string;
  verification?: string;
}

export interface EdgeCase {
  description: string;
  inputs: Record<string, unknown>;
  expectedBehavior: string;
  actualBehavior?: string;
  handled: boolean;
  location?: SourceLocation;
}

export interface Mitigation {
  strategy: string;
  implementation: string;
  effectiveness: 'high' | 'medium' | 'low';
  cost: 'trivial' | 'minor' | 'moderate' | 'significant';
}

// ============================================================================
// EXECUTION TRACING
// ============================================================================

export interface ExecutionPath {
  id: string;
  name: string;
  steps: ExecutionStep[];
  probability: number; // How likely this path is taken
  complexity: number;
  isCritical: boolean;
}

export interface ExecutionStep {
  location: SourceLocation;
  operation: string;
  inputs: Variable[];
  outputs: Variable[];
  sideEffects: SideEffect[];
  branches: Branch[];
  timestamp?: number;
}

export interface Variable {
  name: string;
  type: string;
  value?: unknown;
  isMutable: boolean;
  origin?: SourceLocation;
  mutations?: VariableMutation[];
}

export interface VariableMutation {
  location: SourceLocation;
  oldValue?: unknown;
  newValue?: unknown;
  operation: string;
}

export interface SideEffect {
  type: 'io' | 'state' | 'network' | 'database' | 'file' | 'memory' | 'external';
  description: string;
  reversible: boolean;
  idempotent: boolean;
}

export interface Branch {
  condition: string;
  truePath: string; // Path ID
  falsePath?: string; // Path ID
  probability?: { true: number; false: number };
}

export interface DataFlowPath {
  source: DataSource;
  transformations: DataTransformation[];
  sink: DataSink;
  tainted: boolean; // Is the data potentially unsafe
  validations: DataValidation[];
}

export interface DataSource {
  type: 'user_input' | 'database' | 'api' | 'file' | 'config' | 'environment' | 'hardcoded';
  location: SourceLocation;
  trusted: boolean;
}

export interface DataTransformation {
  operation: string;
  location: SourceLocation;
  sanitizes: boolean;
  validates: boolean;
}

export interface DataSink {
  type: 'output' | 'database' | 'api' | 'file' | 'eval' | 'query' | 'command';
  location: SourceLocation;
  dangerous: boolean;
}

export interface DataValidation {
  type: string;
  location: SourceLocation;
  effective: boolean;
}

// ============================================================================
// PATTERN RECOGNITION
// ============================================================================

export interface BugPattern {
  id: string;
  name: string;
  description: string;
  language: DebugLanguage | 'universal';
  category: 'syntax' | 'semantic' | 'logic' | 'performance' | 'security' | 'concurrency';
  signature: PatternSignature;
  severity: Severity;
  frequency: number; // How often this pattern occurs in codebases
  fix: PatternFix;
  examples: PatternExample[];
}

export interface PatternSignature {
  type: 'ast' | 'regex' | 'semantic' | 'dataflow' | 'control_flow';
  pattern: string | object;
  antiPatterns?: string[]; // Patterns that exclude this match
}

export interface PatternFix {
  automatic: boolean;
  template: string;
  variables: string[];
  validation?: string;
}

export interface PatternExample {
  bad: string;
  good: string;
  explanation: string;
}

export interface PatternMatch {
  pattern: BugPattern;
  location: SourceLocation;
  confidence: Confidence;
  context: string;
  suggestedFix?: CodeFix;
}

// ============================================================================
// MULTI-DIMENSIONAL ANALYSIS
// ============================================================================

export interface MultiDimensionalReport {
  security: SecurityAnalysis;
  performance: PerformanceAnalysis;
  logic: LogicAnalysis;
  architecture: ArchitectureAnalysis;
  maintainability: MaintainabilityAnalysis;
  testability: TestabilityAnalysis;
  reliability: ReliabilityAnalysis;
  overallScore: number;
  prioritizedActions: PrioritizedAction[];
}

export interface SecurityAnalysis {
  score: number; // 0-100
  vulnerabilities: SecurityVulnerability[];
  attackVectors: AttackVector[];
  dataExposure: DataExposureRisk[];
  complianceIssues: ComplianceIssue[];
}

export interface SecurityVulnerability {
  id: string;
  type: string;
  cwe?: string;
  owasp?: string;
  location: SourceLocation;
  severity: Severity;
  exploitability: 'trivial' | 'easy' | 'moderate' | 'difficult';
  description: string;
  fix: CodeFix;
}

export interface AttackVector {
  name: string;
  entryPoint: SourceLocation;
  path: SourceLocation[];
  impact: string;
  likelihood: number;
}

export interface DataExposureRisk {
  dataType: string;
  location: SourceLocation;
  exposure: 'direct' | 'indirect' | 'logged' | 'transmitted';
  risk: Severity;
}

export interface ComplianceIssue {
  standard: string; // GDPR, HIPAA, PCI-DSS, etc.
  requirement: string;
  violation: string;
  location?: SourceLocation;
}

export interface PerformanceAnalysis {
  score: number;
  bottlenecks: PerformanceBottleneck[];
  memoryIssues: MemoryIssue[];
  algorithmicIssues: AlgorithmicIssue[];
  resourceUsage: ResourceUsage;
}

export interface PerformanceBottleneck {
  location: SourceLocation;
  type: 'cpu' | 'memory' | 'io' | 'network' | 'database';
  impact: 'blocking' | 'degrading' | 'inefficient';
  description: string;
  optimization: CodeFix;
}

export interface MemoryIssue {
  type: 'leak' | 'unbounded_growth' | 'unnecessary_retention' | 'large_allocation';
  location: SourceLocation;
  description: string;
  fix: CodeFix;
}

export interface AlgorithmicIssue {
  location: SourceLocation;
  currentComplexity: string; // O(n^2), etc.
  optimalComplexity: string;
  suggestion: string;
}

export interface ResourceUsage {
  estimatedMemory: string;
  estimatedCpu: string;
  ioOperations: number;
  networkCalls: number;
  databaseQueries: number;
}

export interface LogicAnalysis {
  score: number;
  deadCode: DeadCode[];
  unreachableCode: SourceLocation[];
  redundantOperations: RedundantOperation[];
  logicErrors: LogicError[];
  inconsistencies: CodeInconsistency[];
}

export interface DeadCode {
  location: SourceLocation;
  type: 'unreachable' | 'unused_variable' | 'unused_function' | 'unused_import';
  confidence: Confidence;
}

export interface RedundantOperation {
  location: SourceLocation;
  description: string;
  canRemove: boolean;
}

export interface LogicError {
  location: SourceLocation;
  description: string;
  type:
    | 'off_by_one'
    | 'wrong_operator'
    | 'inverted_condition'
    | 'missing_case'
    | 'null_check_after_use'
    | 'type_confusion'
    | 'other';
  fix: CodeFix;
}

export interface CodeInconsistency {
  locations: SourceLocation[];
  description: string;
  recommendation: string;
}

export interface ArchitectureAnalysis {
  score: number;
  violations: ArchitectureViolation[];
  dependencies: DependencyAnalysis;
  coupling: CouplingAnalysis;
  cohesion: CohesionAnalysis;
  patterns: PatternUsage[];
  antiPatterns: AntiPatternUsage[];
}

export interface ArchitectureViolation {
  type: string;
  description: string;
  locations: SourceLocation[];
  recommendation: string;
}

export interface DependencyAnalysis {
  directDeps: number;
  transitiveDeps: number;
  circularDeps: string[][];
  outdatedDeps: string[];
  vulnerableDeps: string[];
}

export interface CouplingAnalysis {
  overall: 'low' | 'medium' | 'high';
  tightlyCoupled: Array<{ a: string; b: string; reason: string }>;
}

export interface CohesionAnalysis {
  overall: 'low' | 'medium' | 'high';
  lowCohesionModules: Array<{ module: string; reason: string }>;
}

export interface PatternUsage {
  pattern: string;
  locations: SourceLocation[];
  appropriate: boolean;
}

export interface AntiPatternUsage {
  antiPattern: string;
  locations: SourceLocation[];
  impact: string;
  refactoring: string;
}

export interface MaintainabilityAnalysis {
  score: number;
  complexity: ComplexityMetrics;
  documentation: DocumentationAnalysis;
  naming: NamingAnalysis;
  codeSmells: CodeSmell[];
}

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  halstead: number;
  linesOfCode: number;
  maintainabilityIndex: number;
}

export interface DocumentationAnalysis {
  coverage: number;
  quality: 'poor' | 'adequate' | 'good' | 'excellent';
  missingDocs: SourceLocation[];
  outdatedDocs: SourceLocation[];
}

export interface NamingAnalysis {
  conventions: 'consistent' | 'inconsistent';
  issues: Array<{ location: SourceLocation; current: string; suggested: string }>;
}

export interface CodeSmell {
  type: string;
  location: SourceLocation;
  description: string;
  refactoring: string;
}

export interface TestabilityAnalysis {
  score: number;
  untestedPaths: ExecutionPath[];
  hardToTest: Array<{ location: SourceLocation; reason: string }>;
  mockRequirements: string[];
  suggestedTests: SuggestedTest[];
}

export interface SuggestedTest {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  target: SourceLocation;
  code: string;
  coverage: string[];
}

export interface ReliabilityAnalysis {
  score: number;
  errorHandling: ErrorHandlingAnalysis;
  faultTolerance: FaultToleranceAnalysis;
  recoverability: RecoverabilityAnalysis;
}

export interface ErrorHandlingAnalysis {
  coverage: number;
  unhandledExceptions: SourceLocation[];
  swallowedErrors: SourceLocation[];
  improperErrorMessages: SourceLocation[];
}

export interface FaultToleranceAnalysis {
  singlePointsOfFailure: SourceLocation[];
  missingRetries: SourceLocation[];
  missingCircuitBreakers: SourceLocation[];
}

export interface RecoverabilityAnalysis {
  gracefulDegradation: boolean;
  stateRecovery: boolean;
  missingRollbacks: SourceLocation[];
}

export interface PrioritizedAction {
  priority: number;
  category: string;
  description: string;
  location?: SourceLocation;
  fix?: CodeFix;
  effort: 'trivial' | 'small' | 'medium' | 'large';
  impact: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================================================
// COGNITIVE REASONING
// ============================================================================

export interface CognitiveAnalysis {
  reasoning: ReasoningChain;
  hypotheses: Hypothesis[];
  conclusions: Conclusion[];
  uncertainties: Uncertainty[];
  mentalModel: MentalModel;
  recommendations: Recommendation[];
}

export interface ReasoningChain {
  steps: ReasoningStep[];
  confidence: Confidence;
  alternativePaths: ReasoningChain[];
}

export interface ReasoningStep {
  observation: string;
  inference: string;
  evidence: string[];
  confidence: Confidence;
}

export interface Hypothesis {
  statement: string;
  probability: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  testable: boolean;
  testStrategy?: string;
}

export interface Conclusion {
  statement: string;
  confidence: Confidence;
  basis: string[];
  implications: string[];
}

export interface Uncertainty {
  aspect: string;
  unknowns: string[];
  impact: 'blocking' | 'significant' | 'minor';
  resolutionStrategy?: string;
}

export interface MentalModel {
  components: ModelComponent[];
  relationships: ModelRelationship[];
  invariants: string[];
  assumptions: string[];
}

export interface ModelComponent {
  name: string;
  type: string;
  responsibilities: string[];
  constraints: string[];
}

export interface ModelRelationship {
  from: string;
  to: string;
  type: 'depends_on' | 'uses' | 'owns' | 'creates' | 'transforms' | 'validates';
  cardinality: '1:1' | '1:n' | 'n:1' | 'n:n';
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  rationale: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'fix' | 'improvement' | 'refactor' | 'test' | 'documentation' | 'monitoring';
  action: CodeFix | string;
  dependencies?: string[]; // IDs of recommendations this depends on
}

// ============================================================================
// CODE FIXES
// ============================================================================

export interface CodeFix {
  type: 'replace' | 'insert' | 'delete' | 'refactor';
  location: SourceLocation;
  oldCode?: string;
  newCode: string;
  explanation: string;
  confidence: Confidence;
  sideEffects?: string[];
  requiresReview: boolean;
  testCoverage?: string;
}

// ============================================================================
// SESSION & STATE
// ============================================================================

export interface CognitiveDebugSession {
  id: string;
  workspaceId: string;
  userId: string;
  startTime: number;
  lastActivity: number;

  // Accumulated knowledge
  codeContext: Map<string, CodeContext>;
  predictedIssues: PredictedIssue[];
  executionPaths: ExecutionPath[];
  patterns: PatternMatch[];

  // Analysis results
  multiDimensionalReport?: MultiDimensionalReport;
  cognitiveAnalysis?: CognitiveAnalysis;
  intentFailureMaps: Map<string, IntentFailureMap>;

  // Learning
  learnedPatterns: BugPattern[];
  userPreferences: UserPreferences;
}

export interface UserPreferences {
  verbosity: 'minimal' | 'normal' | 'verbose';
  autoFix: boolean;
  focusAreas: string[];
  ignoredRules: string[];
}

// ============================================================================
// EVENTS
// ============================================================================

export type CognitiveDebugEvent =
  | { type: 'session_started'; session: CognitiveDebugSession }
  | { type: 'issue_predicted'; issue: PredictedIssue }
  | { type: 'pattern_detected'; match: PatternMatch }
  | { type: 'analysis_complete'; report: MultiDimensionalReport }
  | { type: 'fix_suggested'; fix: CodeFix }
  | { type: 'fix_applied'; fix: CodeFix; result: 'success' | 'failed' }
  | { type: 'reasoning_update'; analysis: CognitiveAnalysis }
  | { type: 'hotspot_identified'; hotspot: CodeHotspot }
  | { type: 'session_ended'; session: CognitiveDebugSession };
