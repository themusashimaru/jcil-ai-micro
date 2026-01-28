/**
 * OMEGA AGENT TYPES
 *
 * The most powerful AI agent ever built.
 * Types for the unified super-agent that combines ALL capabilities.
 */

import type { Finding, StrategyOutput, SynthesizedProblem } from '../strategy/types';
import type { GeneratedFile, SandboxTestResult } from '../core/types';
import type { CausalAnalysisResult } from '../strategy/CausalReasoningEngine';
import type { SimulationResult } from '../strategy/PredictiveSimulator';
import type { GraphStatistics, Entity, Relationship } from '../strategy/KnowledgeGraph';
import type { ReflectionResult } from '../strategy/ReflectionEngine';
import type { AdversarialResult } from '../strategy/AdversarialVerifier';

// =============================================================================
// CORE TYPES
// =============================================================================

export type OmegaMode =
  | 'full_auto' // Research → Analyze → Build → Deploy (Elon mode)
  | 'research_only' // Deep research with all AI capabilities
  | 'build_from_research' // Take findings and build solution
  | 'competitive_intel' // Full competitive intelligence suite
  | 'market_monitor' // Real-time market/web monitoring
  | 'strategic_advisor' // Strategic decision support
  | 'code_architect' // Architecture design + implementation
  | 'problem_solver'; // General problem solving with all tools

export interface OmegaConfig {
  mode: OmegaMode;
  maxBudget: number; // USD
  maxTimeMinutes: number;
  autoApproveCode: boolean; // Auto-deploy without review
  enableAllCapabilities: boolean;

  // Capability toggles
  capabilities: {
    causalReasoning: boolean;
    predictiveSimulation: boolean;
    knowledgeGraph: boolean;
    reflection: boolean;
    adversarialVerification: boolean;
    documentAnalysis: boolean;
    codeGeneration: boolean;
    deployment: boolean;
    monitoring: boolean;
    competitiveIntel: boolean;
  };

  // Output preferences
  output: {
    generateCode: boolean;
    generateDocs: boolean;
    generateArtifacts: boolean;
    deployToGitHub: boolean;
    deployToVercel: boolean;
    createPRs: boolean;
  };

  // Safety limits
  safety: {
    requireHumanApproval: boolean;
    maxConcurrentAgents: number;
    maxSearches: number;
    maxCodeFiles: number;
    blockedDomains: string[];
  };
}

export const DEFAULT_OMEGA_CONFIG: OmegaConfig = {
  mode: 'full_auto',
  maxBudget: 50, // $50 for full auto mode
  maxTimeMinutes: 30,
  autoApproveCode: false,
  enableAllCapabilities: true,

  capabilities: {
    causalReasoning: true,
    predictiveSimulation: true,
    knowledgeGraph: true,
    reflection: true,
    adversarialVerification: true,
    documentAnalysis: true,
    codeGeneration: true,
    deployment: true,
    monitoring: true,
    competitiveIntel: true,
  },

  output: {
    generateCode: true,
    generateDocs: true,
    generateArtifacts: true,
    deployToGitHub: true,
    deployToVercel: false,
    createPRs: true,
  },

  safety: {
    requireHumanApproval: true,
    maxConcurrentAgents: 100,
    maxSearches: 1000,
    maxCodeFiles: 100,
    blockedDomains: [],
  },
};

// =============================================================================
// MISSION TYPES
// =============================================================================

export interface OmegaMission {
  id: string;
  objective: string;
  context?: string;
  constraints?: string[];
  desiredOutcome: string;
  deliverables: MissionDeliverable[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline?: Date;
}

export type MissionDeliverable =
  | 'strategy_report'
  | 'working_code'
  | 'deployed_app'
  | 'competitive_analysis'
  | 'market_research'
  | 'technical_documentation'
  | 'action_plan'
  | 'risk_assessment'
  | 'financial_model'
  | 'comparison_matrix'
  | 'decision_tree'
  | 'knowledge_graph'
  | 'monitoring_dashboard'
  | 'pull_request';

// =============================================================================
// EXECUTION TYPES
// =============================================================================

export interface OmegaPhase {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  progress: number;
  startTime?: number;
  endTime?: number;
  findings?: Finding[];
  artifacts?: OmegaArtifact[];
  errors?: string[];
}

export type OmegaPhaseType =
  | 'intake' // Problem understanding
  | 'research' // Deep research with scouts
  | 'analysis' // Causal reasoning + simulation
  | 'verification' // Adversarial verification
  | 'planning' // Architecture + action planning
  | 'code_generation' // Generate code solution
  | 'testing' // Test generated code
  | 'deployment' // Deploy to GitHub/Vercel
  | 'monitoring_setup' // Set up real-time monitoring
  | 'synthesis' // Final synthesis + deliverables
  | 'learning'; // Self-improvement from session

export interface OmegaExecutionPlan {
  mission: OmegaMission;
  phases: OmegaPhase[];
  estimatedCost: number;
  estimatedTimeMinutes: number;
  requiredCapabilities: string[];
}

// =============================================================================
// OUTPUT TYPES
// =============================================================================

export interface OmegaOutput {
  id: string;
  mission: OmegaMission;

  // Core outputs
  strategy?: StrategyOutput;
  problem?: SynthesizedProblem;

  // AI Analysis outputs
  causalAnalysis?: CausalAnalysisResult;
  simulation?: SimulationResult;
  knowledgeGraph?: {
    statistics: GraphStatistics;
    keyEntities: Entity[];
    keyRelationships: Relationship[];
  };
  reflection?: ReflectionResult;
  adversarialVerification?: AdversarialResult;

  // Code outputs
  generatedCode?: {
    files: GeneratedFile[];
    buildResult: SandboxTestResult;
    testsPassed: boolean;
    securityScore: number;
    performanceScore: number;
  };

  // Deployment outputs
  deployment?: {
    github?: {
      pushed: boolean;
      repoUrl?: string;
      commitSha?: string;
      prUrl?: string;
    };
    vercel?: {
      deployed: boolean;
      url?: string;
      deploymentId?: string;
    };
  };

  // Competitive intelligence
  competitiveIntel?: CompetitiveIntelReport;

  // Monitoring setup
  monitoring?: MonitoringSetup;

  // Artifacts
  artifacts: OmegaArtifact[];

  // Metadata
  metadata: OmegaMetadata;
}

export interface OmegaArtifact {
  id: string;
  type: 'report' | 'code' | 'diagram' | 'spreadsheet' | 'dashboard' | 'presentation';
  title: string;
  description: string;
  format: 'markdown' | 'json' | 'csv' | 'html' | 'typescript' | 'python' | 'yaml';
  content: string;
  url?: string;
  createdAt: number;
}

export interface OmegaMetadata {
  executionTimeMs: number;
  totalCost: number;
  phasesCompleted: number;
  totalPhases: number;
  agentsUsed: number;
  searchesExecuted: number;
  codeFilesGenerated: number;
  confidenceScore: number;
  completedAt: number;
  modelUsage: {
    opus: { calls: number; tokens: number; cost: number };
    sonnet: { calls: number; tokens: number; cost: number };
    haiku: { calls: number; tokens: number; cost: number };
  };
  learnings: string[];
}

// =============================================================================
// COMPETITIVE INTELLIGENCE TYPES
// =============================================================================

export interface CompetitiveIntelReport {
  targetCompany?: string;
  targetProduct?: string;
  analyzedAt: number;

  // Company analysis
  companyProfile?: {
    name: string;
    description: string;
    founded?: string;
    headquarters?: string;
    employeeCount?: string;
    funding?: string;
    revenue?: string;
    keyPeople: Array<{ name: string; role: string }>;
    socialMedia: Record<string, string>;
  };

  // Product analysis
  productAnalysis?: {
    name: string;
    description: string;
    pricing: PricingInfo[];
    features: string[];
    strengths: string[];
    weaknesses: string[];
    targetAudience: string;
    techStack?: string[];
  };

  // Market position
  marketPosition?: {
    marketShare?: string;
    competitors: CompetitorInfo[];
    differentiators: string[];
    marketTrends: string[];
  };

  // SWOT analysis
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };

  // Recommendations
  recommendations: string[];
  opportunities: string[];
  threats: string[];
}

export interface PricingInfo {
  tier: string;
  price: string;
  billing: 'monthly' | 'yearly' | 'one-time' | 'usage-based';
  features: string[];
}

export interface CompetitorInfo {
  name: string;
  description: string;
  website?: string;
  pricing?: string;
  marketShare?: string;
  strengthsVsTarget: string[];
  weaknessesVsTarget: string[];
}

// =============================================================================
// MONITORING TYPES
// =============================================================================

export interface MonitoringSetup {
  configured: boolean;
  monitors: WebMonitor[];
  alertRules: AlertRule[];
  dashboardUrl?: string;
}

export interface WebMonitor {
  id: string;
  name: string;
  type: 'price' | 'content' | 'availability' | 'competitor' | 'news' | 'social';
  url: string;
  selector?: string;
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  enabled: boolean;
  lastCheck?: number;
  lastValue?: string;
}

export interface AlertRule {
  id: string;
  monitorId: string;
  condition: 'change' | 'threshold' | 'contains' | 'not_contains';
  threshold?: number;
  value?: string;
  notifyVia: ('email' | 'webhook' | 'slack')[];
  enabled: boolean;
}

// =============================================================================
// SELF-IMPROVEMENT TYPES
// =============================================================================

export interface OmegaLearning {
  sessionId: string;
  timestamp: number;

  // What worked
  successfulStrategies: string[];
  effectiveTools: string[];
  highQualityFindings: string[];

  // What didn't work
  failedApproaches: string[];
  ineffectiveQueries: string[];
  errorPatterns: string[];

  // Insights
  domainInsights: Record<string, string[]>;
  userPreferences: string[];
  optimizationOpportunities: string[];

  // Metrics for ML
  metrics: {
    timeEfficiency: number; // 0-1
    costEfficiency: number; // 0-1
    qualityScore: number; // 0-1
    userSatisfaction?: number; // 0-1 if feedback provided
  };
}

// =============================================================================
// STREAM TYPES
// =============================================================================

export type OmegaStreamEventType =
  | 'mission_start'
  | 'phase_start'
  | 'phase_progress'
  | 'phase_complete'
  | 'capability_activated'
  | 'agent_spawned'
  | 'agent_complete'
  | 'finding_discovered'
  | 'code_generated'
  | 'code_tested'
  | 'deployment_started'
  | 'deployment_complete'
  | 'insight_generated'
  | 'warning'
  | 'error'
  | 'mission_complete';

export interface OmegaStreamEvent {
  type: OmegaStreamEventType;
  message: string;
  timestamp: number;
  phase?: string;
  progress?: number;
  data?: Record<string, unknown>;
}

export type OmegaStreamCallback = (event: OmegaStreamEvent) => void;

// =============================================================================
// BUILDER PATTERN TYPES
// =============================================================================

export interface OmegaMissionBuilder {
  setObjective(objective: string): OmegaMissionBuilder;
  setContext(context: string): OmegaMissionBuilder;
  addConstraint(constraint: string): OmegaMissionBuilder;
  setDesiredOutcome(outcome: string): OmegaMissionBuilder;
  addDeliverable(deliverable: MissionDeliverable): OmegaMissionBuilder;
  setPriority(priority: OmegaMission['priority']): OmegaMissionBuilder;
  setDeadline(deadline: Date): OmegaMissionBuilder;
  build(): OmegaMission;
}
