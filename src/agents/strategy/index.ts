/**
 * DEEP STRATEGY AGENT
 *
 * The most advanced self-replicating AI agent ever built.
 *
 * Uses:
 * - Opus 4.5: Master Architect, Quality Control, Final Synthesis
 * - Sonnet 4.5: Project Managers (coordination)
 * - Haiku 4.5: Scout Army (research execution)
 *
 * Features:
 * - Self-designing agent architecture
 * - Up to 100 parallel research scouts
 * - Dynamic agent spawning based on problem complexity
 * - Quality control with automatic kill switch
 * - Rate-limited execution queue
 * - Real-time streaming progress
 * - Comprehensive strategy synthesis
 * - Persistent Knowledge Base (cross-session learning)
 * - Scout Performance Tracking (architect optimization)
 * - Real-time Steering Engine (mid-execution control)
 * - Auto-generated Artifacts (CSVs, reports, charts)
 */

// Main exports
export { StrategyAgent, createStrategyAgent } from './StrategyAgent';
export { ForensicIntake, createForensicIntake } from './ForensicIntake';
export { MasterArchitect, createMasterArchitect } from './MasterArchitect';
export { QualityControl, createQualityControl } from './QualityControl';
export { Scout, createScout, executeScoutBatch } from './Scout';
export { ExecutionQueue, createExecutionQueue } from './ExecutionQueue';

// Enhancement modules
export { SteeringEngine, createSteeringEngine } from './SteeringEngine';
export {
  storeFindings,
  queryKnowledge,
  getKnowledgeSummary,
  buildKnowledgePromptContext,
} from './KnowledgeBase';
export {
  recordScoutPerformance,
  getPerformanceInsights,
  buildPerformancePromptContext,
} from './PerformanceTracker';
export { generateArtifacts, getSessionArtifacts } from './ArtifactGenerator';

// Prompt system
export { getPrompts, getAvailableModes } from './prompts';
export type { PromptSet } from './prompts';

// Types
export type {
  // Context & Config
  AgentMode,
  StrategyContext,
  StrategyLimits,
  ModelTier,
  ModelConfig,
  CostTracker,
  KillReason,

  // Problem & Intake
  UserProblem,
  SynthesizedProblem,
  PriorityItem,

  // Agent Blueprints
  AgentBlueprint,
  ResearchApproach,
  OutputFormat,

  // Agent Hierarchy
  AgentHierarchy,
  MasterArchitectState,
  QualityControlState,
  ProjectManagerState,
  ScoutState,
  AgentStatus,

  // Findings & Results
  Finding,
  FindingType,
  DataPoint,
  SourceCitation,

  // Quality Control
  QualityIssue,
  QualityIssueType,
  QualityAction,

  // Execution Queue
  QueuedTask,
  TaskType,
  QueueProgress,

  // Final Output
  StrategyOutput,
  StrategyRecommendation,
  StrategyAlternative,
  DomainAnalysis,
  ComparisonTable,
  ComparisonRow,
  RiskAssessment,
  RiskItem,
  FinancialAnalysis,
  TimelineAnalysis,
  TimelinePhase,
  ActionItem,
  StrategyMetadata,

  // Streaming
  StrategyStreamEventType,
  StrategyStreamEvent,
  StrategyStreamCallback,

  // Knowledge Base
  KnowledgeEntry,
  KnowledgeQuery,
  KnowledgeContext,

  // Performance Tracking
  ScoutPerformanceRecord,
  PerformanceInsight,

  // Steering
  SteeringAction,
  SteeringCommand,

  // Artifacts
  ArtifactType,
  Artifact,
} from './types';

// Constants
export {
  CLAUDE_OPUS_45,
  CLAUDE_SONNET_45,
  CLAUDE_HAIKU_45,
  MODEL_CONFIGS,
  DEFAULT_LIMITS,
  BRAVE_COST_PER_QUERY,
} from './constants';
