/**
 * ADVANCED AI CAPABILITIES
 *
 * This module exports all advanced AI features for the Deep Strategy Agent:
 *
 * 1. ReflectionEngine - Meta-cognitive reflection (thinking about thinking)
 * 2. AdversarialVerifier - Self-challenging verification layer
 * 3. KnowledgeGraph - Structured knowledge representation
 * 4. CausalReasoningEngine - Cause-effect analysis
 * 5. PredictiveSimulator - Scenario modeling and what-if analysis
 * 6. DocumentAnalyzer - Multi-modal document understanding
 * 7. AdaptiveModelRouter - Smart model selection
 * 8. AuditTrail - Full decision logging and explainability
 *
 * Advanced Puppeteering is exported separately from tools/AdvancedPuppeteer.ts
 */

// Meta-cognitive Reflection
export {
  ReflectionEngine,
  createReflectionEngine,
  type ReflectionResult,
  type Assumption,
  type BiasDetection,
  type BiasType,
  type LogicGap,
  type MetaObservation,
  type ReflectionContext,
} from '../ReflectionEngine';

// Adversarial Verification
export {
  AdversarialVerifier,
  createAdversarialVerifier,
  type AdversarialResult,
  type CounterArgument,
  type Contradiction,
  type StressTestResult,
  type Perspective,
  type DevilsAdvocateAssessment,
  type VerificationVerdict,
  type AdversarialContext,
} from '../AdversarialVerifier';

// Knowledge Graph
export {
  KnowledgeGraph,
  createKnowledgeGraph,
  type Entity,
  type EntityType,
  type Relationship,
  type RelationshipType,
  type Cluster,
  type GraphQuery,
  type GraphQueryResult,
  type Path,
  type GraphStatistics,
  type ExtractionResult,
} from '../KnowledgeGraph';

// Causal Reasoning
export {
  CausalReasoningEngine,
  createCausalReasoningEngine,
  type CausalGraph,
  type CausalNode,
  type CausalEdge,
  type Confounder,
  type InterventionPoint,
  type CausalChain,
  type CounterfactualAnalysis,
  type RootCauseAnalysis,
  type CausalAnalysisResult,
} from '../CausalReasoningEngine';

// Predictive Simulation
export {
  PredictiveSimulator,
  createPredictiveSimulator,
  type Scenario,
  type ScenarioVariable,
  type TimelineEvent,
  type Outcome,
  type ScenarioRisk,
  type WhatIfQuery,
  type WhatIfResult,
  type SensitivityAnalysis,
  type DecisionTree,
  type DecisionNode,
  type SimulationResult,
} from '../PredictiveSimulator';

// Document Analysis
export {
  DocumentAnalyzer,
  createDocumentAnalyzer,
  type DocumentAnalysis,
  type DocumentType,
  type StructuredData,
  type ExtractedTable,
  type ExtractedImage,
  type DocumentEntity,
  type DocumentMetadata,
  type ChartDataExtraction,
  type ComparisonExtraction,
} from '../DocumentAnalyzer';

// Adaptive Model Routing
export {
  AdaptiveModelRouter,
  createAdaptiveModelRouter,
  type TaskProfile,
  type TaskType,
  type ComplexityLevel,
  type Capability,
  type RoutingDecision,
  type PerformanceRecord,
  type RouterConfig,
} from '../AdaptiveModelRouter';

// Audit Trail & Explainability
export {
  AuditTrail,
  createAuditTrail,
  type AuditEvent,
  type AuditEventType,
  type DecisionExplanation,
  type ReasoningChain,
  type ReasoningStep,
  type ExplainabilityReport,
  type DataFlowNode,
  type AuditQuery,
  type AuditQueryResult,
} from '../AuditTrail';

// Advanced Puppeteering (from tools)
export {
  AdvancedPuppeteer,
  createAdvancedPuppeteer,
  type BrowserConfig,
  type ProxyConfig,
  type ProxyServer,
  type BrowserSession,
  type BrowserCookie,
  type FingerprintProfile,
  type PageResult,
  type NavigationOptions,
} from '../tools/AdvancedPuppeteer';
